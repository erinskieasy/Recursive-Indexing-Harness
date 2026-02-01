import { getPool, sql } from '../db';

async function listNotes() {
    try {
        const pool = await getPool();
        const result = await pool.request().query('SELECT * FROM Notes ORDER BY id ASC');

        console.log(`Found ${result.recordset.length} notes:`);
        result.recordset.forEach((note: any) => {
            console.log(`\n--- Note ID ${note.id} (for Chunk ${note.text_chunk_id}) ---`);
            console.log(note.content);
        });

        process.exit(0);
    } catch (err) {
        console.error('Error listing notes:', err);
        process.exit(1);
    }
}

listNotes();
