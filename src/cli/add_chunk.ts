import { getPool, sql } from '../db';

async function addChunk() {
    const content = process.argv[2];

    if (!content) {
        console.error('Usage: npx tsx src/cli/add_chunk.ts "Text content"');
        process.exit(1);
    }

    try {
        const pool = await getPool();
        await pool.request()
            .input('content', sql.NVarChar(sql.MAX), content)
            .query('INSERT INTO TextChunks (content) VALUES (@content)');

        console.log('Text chunk added successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Error adding text chunk:', err);
        process.exit(1);
    }
}

addChunk();
