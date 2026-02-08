import { getPool, sql } from '../db';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function processChunks(agentId: number) {
    const newNotes = [];
    try {
        const pool = await getPool();

        // 0. Fetch Agent Settings
        const agentResult = await pool.request()
            .input('id', sql.Int, agentId)
            .query('SELECT system_prompt, history_limit, handover_to_agent_id, handover_mode, trigger_mode FROM Agents WHERE id = @id');

        if (agentResult.recordset.length === 0) {
            throw new Error(`Agent ID ${agentId} not found`);
        }
        const agent = agentResult.recordset[0];
        const systemPrompt = agent.system_prompt; // Can be null
        const historyLimit = agent.history_limit || 10;

        // Handover settings
        const handoverTargetId = agent.handover_to_agent_id;
        const handoverMode = agent.handover_mode || 'aggregate';
        const triggerMode = agent.trigger_mode || 'manual';

        if (!systemPrompt) {
            throw new Error("System Prompt not set for this agent.");
        }

        // 1. Fetch Orchestration Rules for Agent
        const rulesResult = await pool.request()
            .input('agent_id', sql.Int, agentId)
            .query('SELECT instruction FROM OrchestrationRules WHERE agent_id = @agent_id ORDER BY position ASC, id ASC');
        const rules = rulesResult.recordset.map((r: any) => r.instruction).join('\n');

        if (!rules) {
            console.warn(`Warning: No orchestration rules found for agent ${agentId}.`);
        }

        // 2. Fetch Text Chunks for Agent
        const chunksResult = await pool.request()
            .input('agent_id', sql.Int, agentId)
            .query('SELECT id, content FROM TextChunks WHERE agent_id = @agent_id ORDER BY position ASC, id ASC');
        const chunks = chunksResult.recordset;

        console.log(`Found ${chunks.length} chunks to process for agent ${agentId}.`);

        for (const chunk of chunks) {
            // Idempotency check: if note exists for chunk, skip.
            const existingNote = await pool.request()
                .input('text_chunk_id', sql.Int, chunk.id)
                .query('SELECT id FROM Notes WHERE text_chunk_id = @text_chunk_id');

            if (existingNote.recordset.length > 0) {
                console.log(`Skipping Chunk ID ${chunk.id} (Note exists).`);
                continue;
            }

            console.log(`Processing Chunk ID ${chunk.id}...`);

            // Fetch all current notes for context (for this agent)
            const notesResult = await pool.request()
                .input('agent_id', sql.Int, agentId)
                .query('SELECT content FROM Notes WHERE agent_id = @agent_id ORDER BY created_at ASC, id ASC');

            let notesToUse: any[] = notesResult.recordset;
            if (historyLimit > 0) {
                notesToUse = notesToUse.slice(-historyLimit); // Take last N items
                console.log(`Applying history limit: using last ${notesToUse.length} notes.`);
            }

            const priorNotes = notesToUse.map((n: any) => n.content).join('\n---\n');

            const userMessage = `You are given a set of Orchestration Rules and a history of Notes from previous text chunks.
Your task is to read the New Input Chunk and generate a new Note based on the rules and the context of previous notes.

# Orchestration Rules
${rules}

# Prior Notes History
${priorNotes}

# New Input Chunk
${chunk.content}

Return only the content of the new note.
`;

            const completion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage }
                ],
            });

            const newNoteContent = completion.choices[0].message.content;

            if (newNoteContent) {
                // Save to DB
                await pool.request()
                    .input('agent_id', sql.Int, agentId)
                    .input('text_chunk_id', sql.Int, chunk.id)
                    .input('content', sql.NVarChar(sql.MAX), newNoteContent)
                    .query('INSERT INTO Notes (agent_id, text_chunk_id, content) VALUES (@agent_id, @text_chunk_id, @content)');
                console.log(`Saved Note for Chunk ID ${chunk.id}.`);
                newNotes.push({ chunkId: chunk.id, content: newNoteContent });

                // --- IMMEDIATE HANDOVER LOGIC ---
                if (handoverTargetId && handoverMode === 'immediate') {
                    console.log(`Immediate Handover triggered to Agent ${handoverTargetId}`);
                    const handoverContent = `[IMMEDIATE HANDOVER FROM AGENT ${agentId}]\n\n${newNoteContent}`;

                    await pool.request()
                        .input('content', sql.NVarChar(sql.MAX), handoverContent)
                        .input('agent_id', sql.Int, handoverTargetId)
                        .query(`
                           INSERT INTO TextChunks (content, agent_id, position) 
                           VALUES (@content, @agent_id, (SELECT ISNULL(MAX(position), 0) + 1 FROM TextChunks WHERE agent_id = @agent_id))
                        `);
                }
                // -------------------------------

            } else {
                console.error(`Failed to generate note for Chunk ID ${chunk.id}.`);
            }
        }

        // --- AUTO-AGGREGATE HANDOVER LOGIC ---
        // If we processed some notes (or even if we didn't but finished the loop?),
        // and setting is Aggregate + Auto Trigger, perform bulk handover.
        // We only trigger if triggered via Auto (which calls this func).
        // Actually this func doesn't know WHO called it, but if trigger_mode is auto, we assume it's desired behavior
        // to auto-handover when "done".

        if (handoverTargetId && handoverMode === 'aggregate' && triggerMode === 'auto') {
            console.log(`Auto-Aggregate Handover triggered for Agent ${agentId} -> ${handoverTargetId}`);
            await performHandover(agentId, handoverTargetId);
        }

        return { success: true, processedCount: newNotes.length };

    } catch (err) {
        console.error('Error in processor:', err);
        throw err;
    }
}

// Logic extracted from server/index.ts
export async function performHandover(sourceAgentId: number, targetAgentId: number) {
    const pool = await getPool();

    // 1. Fetch all notes
    const notesResult = await pool.request()
        .input('agent_id', sql.Int, sourceAgentId)
        .query('SELECT content FROM Notes WHERE agent_id = @agent_id ORDER BY id ASC');

    const notes = notesResult.recordset;

    if (notes.length === 0) {
        console.log('No notes to handover.');
        return false;
    }

    // 2. Aggregate
    const aggregatedContent = notes.map((n: any) => n.content).join('\n\n---\n\n');
    const handoverContent = `[HANDOVER FROM AGENT ${sourceAgentId}]\n\n${aggregatedContent}`;

    // 3. Insert
    await pool.request()
        .input('content', sql.NVarChar(sql.MAX), handoverContent)
        .input('agent_id', sql.Int, targetAgentId)
        .query(`
            INSERT INTO TextChunks (content, agent_id, position) 
            VALUES (@content, @agent_id, (SELECT ISNULL(MAX(position), 0) + 1 FROM TextChunks WHERE agent_id = @agent_id))
         `);

    console.log(`Handover complete from ${sourceAgentId} to ${targetAgentId}`);

    // Check for Auto Trigger (for Aggregate Handover, we assume Auto means "Run Batch")
    const targetAgentResult = await pool.request()
        .input('id', sql.Int, targetAgentId)
        .query('SELECT trigger_mode FROM Agents WHERE id = @id');

    if (targetAgentResult.recordset[0]?.trigger_mode === 'auto') {
        console.log(`Auto-triggering Batch Processing for Agent ${targetAgentId}...`);
        // Fire and forget
        processChunks(targetAgentId).catch(err =>
            console.error(`Auto-trigger batch failed for Agent ${targetAgentId}:`, err)
        );
    }

    return true;
}

export async function processChunkById(chunkId: number, agentId: number) {
    try {
        const pool = await getPool();

        // 0. Fetch Agent Settings
        const agentResult = await pool.request()
            .input('id', sql.Int, agentId)
            .query('SELECT system_prompt, history_limit, handover_to_agent_id, handover_mode FROM Agents WHERE id = @id');

        if (agentResult.recordset.length === 0) throw new Error(`Agent ID ${agentId} not found`);
        const agent = agentResult.recordset[0];
        if (!agent.system_prompt) throw new Error("System Prompt not set.");

        // 1. Fetch Chunk (ensure it belongs to agent?)
        // Ideally yes, but for now we trust the caller knows the mapping or we just fetch content.
        const chunkResult = await pool.request()
            .input('id', sql.Int, chunkId)
            // .input('agent_id', sql.Int, agentId) // Optional security check
            .query('SELECT id, content FROM TextChunks WHERE id = @id');

        const chunk = chunkResult.recordset[0];
        if (!chunk) {
            throw new Error(`Chunk ID ${chunkId} not found`);
        }

        // 2. Fetch Rules
        const rulesResult = await pool.request()
            .input('agent_id', sql.Int, agentId)
            .query('SELECT instruction FROM OrchestrationRules WHERE agent_id = @agent_id ORDER BY position ASC, id ASC');
        const rules = rulesResult.recordset.map((r: any) => r.instruction).join('\n');

        const newNotes: any[] = [];
        // We reuse logic but need to pass agent info
        const result = await processChunkLogic(pool, chunk, rules, newNotes, agentId, agent);

        return { success: !!result, note: result };

    } catch (err) {
        console.error(`Error processing chunk ${chunkId}:`, err);
        throw err;
    }
}

async function processChunkLogic(pool: any, chunk: any, rules: string, newNotes: any[], agentId: number, agentSettings: any) {
    // Idempotency check
    const existingNote = await pool.request()
        .input('text_chunk_id', sql.Int, chunk.id)
        .query('SELECT id FROM Notes WHERE text_chunk_id = @text_chunk_id');

    if (existingNote.recordset.length > 0) {
        return null;
    }

    console.log(`Processing Chunk ID ${chunk.id}...`);

    // Fetch all current notes for context
    const notesResult = await pool.request()
        .input('agent_id', sql.Int, agentId)
        .query('SELECT content FROM Notes WHERE agent_id = @agent_id ORDER BY created_at ASC, id ASC');

    let notesToUse: any[] = notesResult.recordset;
    const historyLimit = agentSettings.history_limit || 10;
    if (historyLimit > 0) {
        notesToUse = notesToUse.slice(-historyLimit);
        console.log(`Applying history limit: using last ${notesToUse.length} notes.`);
    }

    const priorNotes = notesToUse.map((n: any) => n.content).join('\n---\n');

    const userMessage = `You are given a set of Orchestration Rules and a history of Notes from previous text chunks.
Your task is to read the New Input Chunk and generate a new Note based on the rules and the context of previous notes.

# Orchestration Rules
${rules}

# Prior Notes History
${priorNotes}

# New Input Chunk
${chunk.content}

Return only the content of the new note.
`;

    // Note: openai instance is available in module scope
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
            { role: "system", content: agentSettings.system_prompt },
            { role: "user", content: userMessage }
        ],
    });

    const newNoteContent = completion.choices[0].message.content;

    if (newNoteContent) {
        await pool.request()
            .input('agent_id', sql.Int, agentId)
            .input('text_chunk_id', sql.Int, chunk.id)
            .input('content', sql.NVarChar(sql.MAX), newNoteContent)
            .query('INSERT INTO Notes (agent_id, text_chunk_id, content) VALUES (@agent_id, @text_chunk_id, @content)');

        console.log(`Saved Note for Chunk ID ${chunk.id}.`);
        const noteObj = { id: Date.now(), text_chunk_id: chunk.id, content: newNoteContent, agent_id: agentId };

        // --- IMMEDIATE HANDOVER LOGIC ---
        if (agentSettings.handover_to_agent_id && agentSettings.handover_mode === 'immediate') {
            const targetAgentId = agentSettings.handover_to_agent_id;
            console.log(`Immediate Handover triggered to Agent ${targetAgentId}`);
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

            // Check if target agent is set to Auto trigger
            const targetAgentResult = await pool.request()
                .input('id', sql.Int, targetAgentId)
                .query('SELECT trigger_mode FROM Agents WHERE id = @id');

            const targetTriggerMode = targetAgentResult.recordset[0]?.trigger_mode;

            if (targetTriggerMode === 'auto') {
                console.log(`Auto-triggering Agent ${targetAgentId} for Chunk ${newChunkId}...`);
                // Fire and forget (don't await) to allow concurrency
                processChunkById(newChunkId, targetAgentId).catch(err =>
                    console.error(`Auto-trigger failed for Agent ${targetAgentId}:`, err)
                );
            }
        }
        // -------------------------------

        newNotes.push(noteObj);
        return noteObj;
    } else {
        console.error(`Failed to generate note for Chunk ID ${chunk.id}.`);
        return null;
    }
}
