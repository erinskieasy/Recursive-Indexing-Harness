import express from 'express'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// Helper to get __dirname in ESM
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

app.use(express.json())

// API Routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' })
})

import { getPool, sql } from '../src/db/index.js'; // Ensure extension if ESM
import { processChunks, processChunkById } from '../src/processor/service.js';

// GET Notes
app.get('/api/notes', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query('SELECT * FROM Notes ORDER BY id ASC');
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch notes' });
    }
});

// GET Chunks
app.get('/api/chunks', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query('SELECT * FROM TextChunks ORDER BY id ASC');
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch chunks' });
    }
});

// GET Rules
app.get('/api/rules', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query('SELECT * FROM OrchestrationRules ORDER BY id ASC');
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch rules' });
    }
});

// POST Chunk
app.post('/api/chunks', async (req, res) => {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Content is required' });
    try {
        const pool = await getPool();
        await pool.request()
            .input('content', sql.NVarChar(sql.MAX), content)
            .query('INSERT INTO TextChunks (content) VALUES (@content)');
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to add chunk' });
    }
});

// POST Rule
app.post('/api/rules', async (req, res) => {
    const { instruction } = req.body;
    if (!instruction) return res.status(400).json({ error: 'Instruction is required' });
    try {
        const pool = await getPool();
        await pool.request()
            .input('instruction', sql.NVarChar(sql.MAX), instruction)
            .query('INSERT INTO OrchestrationRules (instruction) VALUES (@instruction)');
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to add rule' });
    }
});

// POST Process All (Batch)
app.post('/api/process', async (req, res) => {
    try {
        const result = await processChunks();
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Processing failed' });
    }
});

// POST Process Single Chunk
app.post('/api/process-chunk', async (req, res) => {
    const { chunkId } = req.body;
    if (!chunkId) return res.status(400).json({ error: 'chunkId is required' });
    try {
        const result = await processChunkById(chunkId);
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Processing chunk failed' });
    }
});

// DELETE Chunk
app.delete('/api/chunks/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await getPool();
        await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM TextChunks WHERE id = @id');
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete chunk' });
    }
});

// DELETE Rule
app.delete('/api/rules/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await getPool();
        await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM OrchestrationRules WHERE id = @id');
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete rule' });
    }
});

// DELETE Note
app.delete('/api/notes/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await getPool();
        await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM Notes WHERE id = @id');
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete note' });
    }
});



// Database Initialization
async function initDb() {
    try {
        const pool = await getPool();

        // 1. Create Settings Table
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'Settings')
            CREATE TABLE Settings (
                [key] VARCHAR(50) PRIMARY KEY,
                [value] NVARCHAR(MAX)
            )
        `);

        // 2. Seed Default System Prompt
        const defaultPrompt = `You are a recursive indexing assistant.`;

        const checkResult = await pool.request()
            .input('key', sql.VarChar(50), 'system_prompt')
            .query("SELECT [value] FROM Settings WHERE [key] = @key");

        if (checkResult.recordset.length === 0) {
            console.log('Seeding default system prompt...');
            await pool.request()
                .input('key', sql.VarChar(50), 'system_prompt')
                .input('value', sql.NVarChar(sql.MAX), defaultPrompt)
                .query("INSERT INTO Settings ([key], [value]) VALUES (@key, @value)");
        }

        console.log('Database initialized.');
    } catch (err) {
        console.error('Database initialization failed:', err);
    }
}

// Initialize DB then start server
initDb().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`)
    })
});

// Settings API
app.get('/api/settings/:key', async (req, res) => {
    const { key } = req.params;
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('key', sql.VarChar(50), key)
            .query("SELECT [value] FROM Settings WHERE [key] = @key");

        if (result.recordset.length > 0) {
            res.json({ value: result.recordset[0].value });
        } else {
            res.json({ value: null });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch setting' });
    }
});

app.post('/api/settings', async (req, res) => {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: 'Key is required' });

    try {
        const pool = await getPool();
        // Upsert (Merge or Check+Update) - doing simple check+update/insert for MSSQL compatibility
        const check = await pool.request()
            .input('key', sql.VarChar(50), key)
            .query("SELECT [key] FROM Settings WHERE [key] = @key");

        if (check.recordset.length > 0) {
            await pool.request()
                .input('key', sql.VarChar(50), key)
                .input('value', sql.NVarChar(sql.MAX), value)
                .query("UPDATE Settings SET [value] = @value WHERE [key] = @key");
        } else {
            await pool.request()
                .input('key', sql.VarChar(50), key)
                .input('value', sql.NVarChar(sql.MAX), value)
                .query("INSERT INTO Settings ([key], [value]) VALUES (@key, @value)");
        }
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to save setting' });
    }
});

import OpenAI from 'openai';
app.post('/api/optimize-prompt', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "You are an expert prompt engineer. specialized in LLM orchestration. Rewrite the user's system prompt to be more clear, structured, and effective for a recursive context-accumulation task. Return ONLY the rewritten prompt text." },
                { role: "user", content: prompt }
            ],
        });
        res.json({ optimizedPrompt: completion.choices[0].message.content });
    } catch (err) {
        console.error("Optimize failed:", err);
        res.status(500).json({ error: 'Failed to optimize prompt' });
    }
});


// Serve static files in production or Azure
const isProduction = process.env.NODE_ENV === 'production' || !!process.env.WEBSITE_SITE_NAME;

if (isProduction) {
    console.log('Serving static files from ../dist');
    app.use(express.static(path.join(__dirname, '../dist')))

    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../dist/index.html'))
    })
}

