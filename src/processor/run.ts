import { getPool, sql } from '../db';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function runProcessor() {
    try {
        const pool = await getPool();

        // 1. Fetch Orchestration Rules
        const rulesResult = await pool.request().query('SELECT instruction FROM OrchestrationRules ORDER BY id ASC');
        const rules = rulesResult.recordset.map((r: any) => r.instruction).join('\n');

        if (!rules) {
            console.warn('Warning: No orchestration rules found.');
        }

        // 2. Fetch Text Chunks
        // We process all chunks. In a real system we might track which are processed, but here we run the loop.
        // The prompt implies we process "the current set of TextChunks". 
        // If we re-run, do we re-process? For a harness, let's assume we allow re-processing or just process everything found.
        // To facilitate testing "recursive accumulation", we can process chunks that haven't been linked to a note?
        // Or just process everything linearly. Let's process everything linearly as a batch job for now.
        // But wait, if I run it twice, I'll get duplicates?
        // Let's just process all chunks for this harness. The user can clear DB if they want to reset.
        // Actually, checking if a chunk already has a note would be smart.
        // "it should read TextChunks one at a time... save a new note entry"
        // Let's check for existing notes for a chunk to avoid double processing if desired, 
        // OR just process them all. The prompt says "reads the current set... and writes... output notes". 
        // I will fetch all chunks. 
        // I will NOT filter by existing notes for simplicity, so we can re-run logic on same data if rules change.
        // Wait, if I re-run, the "prior entries in Notes" will include notes from previous runs?
        // "evaluate it using... all prior entries in Notes". 
        // This implies GLOBAL notes history.
        // So if I run it once with Chunk A, I get Note A.
        // If I run it again with Chunk B (and A is still there), do I re-process A?
        // If I re-process A, I get Note A2. Then for B, I see Note A and Note A2?
        // This sounds messy.
        // Better approach for the harness: 
        // 1. CLEAR existing notes? Or just append?
        // 2. Or, only process chunks that have no notes?
        // Let's ask: "reads the current set of TextChunks... writes resulting output notes".
        // I will assume for this PASS, we iterate through all chunks. 
        // But the "prior entries in Notes" is key.
        // If I have chunks 1, 2, 3.
        // Step 1: Chunk 1. Context: Rules + (Existing DB Notes). Output: Note 1.
        // Step 2: Chunk 2. Context: Rules + (Existing DB Notes + Note 1). Output: Note 2.
        // This means the context grows DYNAMICALLY during the run.

        const chunksResult = await pool.request().query('SELECT id, content FROM TextChunks ORDER BY id ASC');
        const chunks = chunksResult.recordset;

        console.log(`Found ${chunks.length} chunks to process.`);

        for (const chunk of chunks) {
            console.log(`Processing Chunk ID ${chunk.id}...`);

            // Fetch all current notes for context
            // efficient way: fetch all notes once? No, because we add a note in each step.
            // So fetch fresh every time.
            const notesResult = await pool.request().query('SELECT content FROM Notes ORDER BY id ASC');
            const priorNotes = notesResult.recordset.map((n: any) => n.content).join('\n---\n');

            const systemPrompt = `You are a recursive indexing assistant. 
You are given a set of Orchestration Rules and a history of Notes from previous text chunks.
Your task is to read the New Input Chunk and generate a new Note based on the rules and the context of previous notes.`;

            const userMessage = `
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
            } else {
                console.error(`Failed to generate note for Chunk ID ${chunk.id}.`);
            }
        }

        console.log('Processing complete.');
        process.exit(0);

    } catch (err) {
        console.error('Error in processor:', err);
        process.exit(1);
    }
}

runProcessor();
