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

// Serve static files in production
// Serve static files in production or Azure
const isProduction = process.env.NODE_ENV === 'production' || !!process.env.WEBSITE_SITE_NAME;

if (isProduction) {
    console.log('Serving static files from ../dist');
    app.use(express.static(path.join(__dirname, '../dist')))

    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../dist/index.html'))
    })
}

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
})
