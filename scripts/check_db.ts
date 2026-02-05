import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env from current working directory
dotenv.config({ path: path.join(process.cwd(), '.env') });

const requiredEnv = ['DB_USER', 'DB_PASSWORD', 'DB_SERVER', 'DB_DATABASE'];
const missingEnv = requiredEnv.filter(k => !process.env[k]);
if (missingEnv.length > 0) {
    console.error('Missing env vars:', missingEnv);
    // process.exit(1); 
} else {
    console.log('Env vars loaded.');
}

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    options: {
        encrypt: true,
        trustServerCertificate: true,
    },
};



async function checkDb() {
    console.log('Starting checkDb...');
    try {
        console.log('Connecting to DB...');
        await sql.connect(dbConfig);
        console.log('Connected.');

        console.log('Querying Chunks...');
        const result = await sql.query('SELECT id, position, content FROM TextChunks ORDER BY position ASC, id ASC');
        console.log('Chunks queried. Count:', result.recordset?.length);

        console.log('Querying Rules...');
        const rules = await sql.query('SELECT id, position, instruction FROM OrchestrationRules ORDER BY position ASC, id ASC');
        console.log('Rules queried. Count:', rules.recordset?.length);

        const output = {
            chunks: result.recordset,
            rules: rules.recordset
        };

        const outPath = path.join(process.cwd(), 'debug_output.json');
        console.log('Writing to:', outPath);
        fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
        console.log('Debug output written successfully.');

    } catch (err) {
        console.error('CRITICAL ERROR:', err);
    } finally {
        await sql.close();
        console.log('DB Connection closed.');
    }
}

checkDb();
