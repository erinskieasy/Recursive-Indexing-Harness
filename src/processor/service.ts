import { getPool, sql } from '../db';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function processChunks() {
    const newNotes = [];
    try {
        const pool = await getPool();

        // 1. Fetch Orchestration Rules
        const rulesResult = await pool.request().query('SELECT instruction FROM OrchestrationRules ORDER BY id ASC');
        const rules = rulesResult.recordset.map((r: any) => r.instruction).join('\n');

        if (!rules) {
            console.warn('Warning: No orchestration rules found.');
        }

        // 2. Fetch Text Chunks
        const chunksResult = await pool.request().query('SELECT id, content FROM TextChunks ORDER BY id ASC');
        const chunks = chunksResult.recordset;

        console.log(`Found ${chunks.length} chunks to process.`);

        for (const chunk of chunks) {
            // Check if note already exists for this chunk? 
            // For this "harness", we might want to avoid re-processing if note exists.
            // Let's implemented IDEMPOTENCY check: if note exists for chunk, skip.
            const existingNote = await pool.request()
                .input('text_chunk_id', sql.Int, chunk.id)
                .query('SELECT id FROM Notes WHERE text_chunk_id = @text_chunk_id');

            if (existingNote.recordset.length > 0) {
                console.log(`Skipping Chunk ID ${chunk.id} (Note exists).`);
                continue;
            }

            console.log(`Processing Chunk ID ${chunk.id}...`);

            // Fetch all current notes for context (recursive accumulation)
            const notesResult = await pool.request().query('SELECT content FROM Notes ORDER BY id ASC');
            const priorNotes = notesResult.recordset.map((n: any) => n.content).join('\n---\n');

            // Fetch System Prompt from DB
            const promptResult = await pool.request()
                .input('key', sql.VarChar(50), 'system_prompt')
                .query("SELECT [value] FROM Settings WHERE [key] = @key");

            if (promptResult.recordset.length === 0 || !promptResult.recordset[0].value) {
                throw new Error("System Prompt not set. Please configure it in Settings.");
            }
            const systemPrompt = promptResult.recordset[0].value;

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
                    .input('text_chunk_id', sql.Int, chunk.id)
                    .input('content', sql.NVarChar(sql.MAX), newNoteContent)
                    .query('INSERT INTO Notes (text_chunk_id, content) VALUES (@text_chunk_id, @content)');
                console.log(`Saved Note for Chunk ID ${chunk.id}.`);
                newNotes.push({ chunkId: chunk.id, content: newNoteContent });
            } else {
                console.error(`Failed to generate note for Chunk ID ${chunk.id}.`);
            }
        }

        return { success: true, processedCount: newNotes.length };

    } catch (err) {
        console.error('Error in processor:', err);
        throw err;
    }
}

export async function processChunkById(chunkId: number) {
    try {
        const pool = await getPool();

        // 1. Fetch Chunk
        const chunkResult = await pool.request()
            .input('id', sql.Int, chunkId)
            .query('SELECT id, content FROM TextChunks WHERE id = @id');

        const chunk = chunkResult.recordset[0];
        if (!chunk) {
            throw new Error(`Chunk ID ${chunkId} not found`);
        }

        // 2. Fetch Rules
        const rulesResult = await pool.request().query('SELECT instruction FROM OrchestrationRules ORDER BY id ASC');
        const rules = rulesResult.recordset.map((r: any) => r.instruction).join('\n');

        const newNotes: any[] = [];
        const result = await processChunkLogic(pool, chunk, rules, newNotes);

        return { success: !!result, note: result };

    } catch (err) {
        console.error(`Error processing chunk ${chunkId}:`, err);
        throw err;
    }
}

async function processChunkLogic(pool: any, chunk: any, rules: string, newNotes: any[]) {
    // Idempotency check
    const existingNote = await pool.request()
        .input('text_chunk_id', sql.Int, chunk.id)
        .query('SELECT id FROM Notes WHERE text_chunk_id = @text_chunk_id');

    if (existingNote.recordset.length > 0) {
        // console.log(`Skipping Chunk ID ${chunk.id} (Note exists).`);
        // For single chunk processing, we might WANT to force re-process? 
        // But let's stick to idempotency for now, or maybe return existing?
        // Let's allow re-processing if manually triggered? No, duplicates are bad.
        // Return existing note content? We don't have it here.
        return null;
    }

    console.log(`Processing Chunk ID ${chunk.id}...`);

    // Fetch all current notes for context
    const notesResult = await pool.request().query('SELECT content FROM Notes ORDER BY id ASC');
    const priorNotes = notesResult.recordset.map((n: any) => n.content).join('\n---\n');

    // Fetch System Prompt from DB
    const promptResult = await pool.request()
        .input('key', sql.VarChar(50), 'system_prompt')
        .query("SELECT [value] FROM Settings WHERE [key] = @key");

    if (promptResult.recordset.length === 0 || !promptResult.recordset[0].value) {
        throw new Error("System Prompt not set. Please configure it in Settings.");
    }
    const systemPrompt = promptResult.recordset[0].value;

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
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage }
        ],
    });

    const newNoteContent = completion.choices[0].message.content;

    if (newNoteContent) {
        await pool.request()
            .input('text_chunk_id', sql.Int, chunk.id)
            .input('content', sql.NVarChar(sql.MAX), newNoteContent)
            .query('INSERT INTO Notes (text_chunk_id, content) VALUES (@text_chunk_id, @content)');
        console.log(`Saved Note for Chunk ID ${chunk.id}.`);
        const noteObj = { id: Date.now(), text_chunk_id: chunk.id, content: newNoteContent }; // Mock ID or fetch it? 
        // Ideally fetch real ID, but for UI update mock is okay or fetch fresh.
        // We'll return content. The UI does a fetchNotes() anyway.
        // But my Dashboard implementation uses result.note to update state optimistically?
        // Dashboard: setNotes(prev => [...prev, result.note]);
        // So I should return a shape that matches Note.
        // I'll assume we can use a placeholder ID or just rely on fetchData().
        // Actually Dashboard calls fetchData() at the end of loop.

        newNotes.push(noteObj);
        return noteObj;
    } else {
        console.error(`Failed to generate note for Chunk ID ${chunk.id}.`);
        return null;
    }
}
