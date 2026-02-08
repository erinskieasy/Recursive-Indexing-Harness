import { getPool, sql } from '../db';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { executeAgentActions, buildAgentPromptAssetContext } from './assets';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function processChunks(agentId: number) {
    const newNotes: Array<{ chunkId: number, content: string }> = [];
    try {
        const pool = await getPool();

        const agentResult = await pool.request()
            .input('id', sql.Int, agentId)
            .query('SELECT system_prompt, history_limit, handover_to_agent_id, handover_mode, trigger_mode, pre_process_asset_actions_json, post_process_asset_actions_json, asset_prompt_context_enabled, asset_prompt_context_header FROM Agents WHERE id = @id');

        if (agentResult.recordset.length === 0) {
            throw new Error(`Agent ID ${agentId} not found`);
        }

        const agent = agentResult.recordset[0];
        const systemPrompt = agent.system_prompt;
        const historyLimit = agent.history_limit || 10;
        const handoverTargetId = agent.handover_to_agent_id;
        const handoverMode = agent.handover_mode || 'aggregate';
        const triggerMode = agent.trigger_mode || 'manual';

        if (!systemPrompt) {
            throw new Error('System Prompt not set for this agent.');
        }

        await executeAgentActions(pool, agentId, agent.pre_process_asset_actions_json, {
            latest_note: '',
            chunk_content: '',
            agent_id: String(agentId)
        });

        const rulesResult = await pool.request()
            .input('agent_id', sql.Int, agentId)
            .query('SELECT instruction FROM OrchestrationRules WHERE agent_id = @agent_id ORDER BY position ASC, id ASC');
        const rules = rulesResult.recordset.map((r: any) => r.instruction).join('\n');

        const chunksResult = await pool.request()
            .input('agent_id', sql.Int, agentId)
            .query('SELECT id, content FROM TextChunks WHERE agent_id = @agent_id ORDER BY position ASC, id ASC');
        const chunks = chunksResult.recordset;

        const promptAssetHeader = agent.asset_prompt_context_header || 'Asset Context';

        for (const chunk of chunks) {
            const existingNote = await pool.request()
                .input('text_chunk_id', sql.Int, chunk.id)
                .query('SELECT id FROM Notes WHERE text_chunk_id = @text_chunk_id');

            if (existingNote.recordset.length > 0) {
                continue;
            }

            const notesResult = await pool.request()
                .input('agent_id', sql.Int, agentId)
                .query('SELECT content FROM Notes WHERE agent_id = @agent_id ORDER BY created_at ASC, id ASC');

            let notesToUse: any[] = notesResult.recordset;
            if (historyLimit > 0) {
                notesToUse = notesToUse.slice(-historyLimit);
            }

            const priorNotes = notesToUse.map((n: any) => n.content).join('\n---\n');
            const promptAssetContext = agent.asset_prompt_context_enabled
                ? await buildAgentPromptAssetContext(pool, agentId)
                : '';

            const userMessage = `You are given a set of Orchestration Rules and a history of Notes from previous text chunks.
Your task is to read the New Input Chunk and generate a new Note based on the rules and the context of previous notes.

# Orchestration Rules
${rules}

# Prior Notes History
${priorNotes}

${promptAssetContext ? `# ${promptAssetHeader}\n${promptAssetContext}\n` : ''}# New Input Chunk
${chunk.content}

Return only the content of the new note.
`;

            const completion = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage }
                ],
            });

            const newNoteContent = completion.choices[0].message.content;
            if (!newNoteContent) continue;

            await pool.request()
                .input('agent_id', sql.Int, agentId)
                .input('text_chunk_id', sql.Int, chunk.id)
                .input('content', sql.NVarChar(sql.MAX), newNoteContent)
                .query('INSERT INTO Notes (agent_id, text_chunk_id, content) VALUES (@agent_id, @text_chunk_id, @content)');

            newNotes.push({ chunkId: chunk.id, content: newNoteContent });

            if (handoverTargetId && handoverMode === 'immediate') {
                const handoverContent = `[IMMEDIATE HANDOVER FROM AGENT ${agentId}]\n\n${newNoteContent}`;
                await pool.request()
                    .input('content', sql.NVarChar(sql.MAX), handoverContent)
                    .input('agent_id', sql.Int, handoverTargetId)
                    .query(`
                        INSERT INTO TextChunks (content, agent_id, position)
                        VALUES (@content, @agent_id, (SELECT ISNULL(MAX(position), 0) + 1 FROM TextChunks WHERE agent_id = @agent_id))
                    `);
            }
        }

        await executeAgentActions(pool, agentId, agent.post_process_asset_actions_json, {
            latest_note: newNotes.length ? newNotes[newNotes.length - 1].content : '',
            chunk_content: '',
            agent_id: String(agentId)
        });

        if (handoverTargetId && handoverMode === 'aggregate' && triggerMode === 'auto') {
            await performHandover(agentId, handoverTargetId);
        }

        return { success: true, processedCount: newNotes.length };
    } catch (err) {
        console.error('Error in processor:', err);
        throw err;
    }
}

export async function performHandover(sourceAgentId: number, targetAgentId: number) {
    const pool = await getPool();

    const notesResult = await pool.request()
        .input('agent_id', sql.Int, sourceAgentId)
        .query('SELECT content FROM Notes WHERE agent_id = @agent_id ORDER BY id ASC');

    const notes = notesResult.recordset;
    if (notes.length === 0) return false;

    const aggregatedContent = notes.map((n: any) => n.content).join('\n\n---\n\n');
    const handoverContent = `[HANDOVER FROM AGENT ${sourceAgentId}]\n\n${aggregatedContent}`;

    await pool.request()
        .input('content', sql.NVarChar(sql.MAX), handoverContent)
        .input('agent_id', sql.Int, targetAgentId)
        .query(`
            INSERT INTO TextChunks (content, agent_id, position)
            VALUES (@content, @agent_id, (SELECT ISNULL(MAX(position), 0) + 1 FROM TextChunks WHERE agent_id = @agent_id))
         `);

    const targetAgentResult = await pool.request()
        .input('id', sql.Int, targetAgentId)
        .query('SELECT trigger_mode FROM Agents WHERE id = @id');

    if (targetAgentResult.recordset[0]?.trigger_mode === 'auto') {
        processChunks(targetAgentId).catch(err =>
            console.error(`Auto-trigger batch failed for Agent ${targetAgentId}:`, err)
        );
    }

    return true;
}

export async function processChunkById(chunkId: number, agentId: number) {
    try {
        const pool = await getPool();

        const agentResult = await pool.request()
            .input('id', sql.Int, agentId)
            .query('SELECT system_prompt, history_limit, handover_to_agent_id, handover_mode, pre_process_asset_actions_json, post_process_asset_actions_json, asset_prompt_context_enabled, asset_prompt_context_header FROM Agents WHERE id = @id');

        if (agentResult.recordset.length === 0) throw new Error(`Agent ID ${agentId} not found`);
        const agent = agentResult.recordset[0];
        if (!agent.system_prompt) throw new Error('System Prompt not set.');

        await executeAgentActions(pool, agentId, agent.pre_process_asset_actions_json, {
            latest_note: '',
            chunk_content: '',
            agent_id: String(agentId)
        });

        const chunkResult = await pool.request()
            .input('id', sql.Int, chunkId)
            .query('SELECT id, content FROM TextChunks WHERE id = @id');

        const chunk = chunkResult.recordset[0];
        if (!chunk) throw new Error(`Chunk ID ${chunkId} not found`);

        const rulesResult = await pool.request()
            .input('agent_id', sql.Int, agentId)
            .query('SELECT instruction FROM OrchestrationRules WHERE agent_id = @agent_id ORDER BY position ASC, id ASC');
        const rules = rulesResult.recordset.map((r: any) => r.instruction).join('\n');

        const newNotes: any[] = [];
        const result = await processChunkLogic(pool, chunk, rules, newNotes, agentId, agent);

        await executeAgentActions(pool, agentId, agent.post_process_asset_actions_json, {
            latest_note: result?.content || '',
            chunk_content: chunk.content || '',
            agent_id: String(agentId)
        });

        return { success: !!result, note: result };
    } catch (err) {
        console.error(`Error processing chunk ${chunkId}:`, err);
        throw err;
    }
}

async function processChunkLogic(pool: any, chunk: any, rules: string, newNotes: any[], agentId: number, agentSettings: any) {
    const existingNote = await pool.request()
        .input('text_chunk_id', sql.Int, chunk.id)
        .query('SELECT id FROM Notes WHERE text_chunk_id = @text_chunk_id');

    if (existingNote.recordset.length > 0) return null;

    const notesResult = await pool.request()
        .input('agent_id', sql.Int, agentId)
        .query('SELECT content FROM Notes WHERE agent_id = @agent_id ORDER BY created_at ASC, id ASC');

    let notesToUse: any[] = notesResult.recordset;
    const historyLimit = agentSettings.history_limit || 10;
    if (historyLimit > 0) notesToUse = notesToUse.slice(-historyLimit);

    const priorNotes = notesToUse.map((n: any) => n.content).join('\n---\n');
    const promptAssetContext = agentSettings.asset_prompt_context_enabled
        ? await buildAgentPromptAssetContext(pool, agentId)
        : '';
    const promptAssetHeader = agentSettings.asset_prompt_context_header || 'Asset Context';

    const userMessage = `You are given a set of Orchestration Rules and a history of Notes from previous text chunks.
Your task is to read the New Input Chunk and generate a new Note based on the rules and the context of previous notes.

# Orchestration Rules
${rules}

# Prior Notes History
${priorNotes}

${promptAssetContext ? `# ${promptAssetHeader}\n${promptAssetContext}\n` : ''}# New Input Chunk
${chunk.content}

Return only the content of the new note.
`;

    const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            { role: 'system', content: agentSettings.system_prompt },
            { role: 'user', content: userMessage }
        ],
    });

    const newNoteContent = completion.choices[0].message.content;
    if (!newNoteContent) return null;

    await pool.request()
        .input('agent_id', sql.Int, agentId)
        .input('text_chunk_id', sql.Int, chunk.id)
        .input('content', sql.NVarChar(sql.MAX), newNoteContent)
        .query('INSERT INTO Notes (agent_id, text_chunk_id, content) VALUES (@agent_id, @text_chunk_id, @content)');

    const noteObj = { id: Date.now(), text_chunk_id: chunk.id, content: newNoteContent, agent_id: agentId };

    if (agentSettings.handover_to_agent_id && agentSettings.handover_mode === 'immediate') {
        const targetAgentId = agentSettings.handover_to_agent_id;
        const handoverContent = `[IMMEDIATE HANDOVER FROM AGENT ${agentId}]\n\n${newNoteContent}`;

        const insertResult = await pool.request()
            .input('content', sql.NVarChar(sql.MAX), handoverContent)
            .input('agent_id', sql.Int, targetAgentId)
            .query(`
               INSERT INTO TextChunks (content, agent_id, position)
               OUTPUT INSERTED.id
               VALUES (@content, @agent_id, (SELECT ISNULL(MAX(position), 0) + 1 FROM TextChunks WHERE agent_id = @agent_id))
            `);

        const newChunkId = insertResult.recordset[0].id;

        const targetAgentResult = await pool.request()
            .input('id', sql.Int, targetAgentId)
            .query('SELECT trigger_mode FROM Agents WHERE id = @id');

        if (targetAgentResult.recordset[0]?.trigger_mode === 'auto') {
            processChunkById(newChunkId, targetAgentId).catch(err =>
                console.error(`Auto-trigger failed for Agent ${targetAgentId}:`, err)
            );
        }
    }

    newNotes.push(noteObj);
    return noteObj;
}
