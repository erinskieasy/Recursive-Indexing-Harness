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

// --- AGENTS API ---

// GET All Agents
app.get('/api/agents', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query('SELECT * FROM Agents ORDER BY created_at ASC');
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch agents' });
    }
});

// POST Create Agent
app.post('/api/agents', async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('name', sql.NVarChar(255), name)
            .input('system_prompt', sql.NVarChar(sql.MAX), "You are a recursive indexing assistant.")
            .query(`
                INSERT INTO Agents (name, system_prompt) 
                OUTPUT INSERTED.*
                VALUES (@name, @system_prompt)
            `);
        res.json(result.recordset[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create agent' });
    }
});

// GET Agent Details
app.get('/api/agents/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT * FROM Agents WHERE id = @id');
        if (result.recordset.length > 0) {
            res.json(result.recordset[0]);
        } else {
            res.status(404).json({ error: 'Agent not found' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch agent' });
    }
});

// PUT Update Agent Settings (including handover)
app.put('/api/agents/:id', async (req, res) => {
    const { id } = req.params;
    const { system_prompt, history_limit, trigger_mode, output_mode, handover_to_agent_id } = req.body;
    try {
        const pool = await getPool();
        let query = 'UPDATE Agents SET ';
        const updates: string[] = [];

        if (system_prompt !== undefined) {
            updates.push('system_prompt = @system_prompt');
            pool.request().input('system_prompt', sql.NVarChar(sql.MAX), system_prompt);
        }
        if (history_limit !== undefined) {
            updates.push('history_limit = @history_limit');
            pool.request().input('history_limit', sql.Int, history_limit);
        }
        if (trigger_mode !== undefined) {
            updates.push('trigger_mode = @trigger_mode');
            pool.request().input('trigger_mode', sql.VarChar(50), trigger_mode);
        }
        if (output_mode !== undefined) {
            updates.push('output_mode = @output_mode');
            pool.request().input('output_mode', sql.VarChar(50), output_mode);
        }
        if (handover_to_agent_id !== undefined) {
            // handle null for clearing handover
            updates.push('handover_to_agent_id = @handover_to_agent_id');
            // sql.Int allows nulls if passed as null
            pool.request().input('handover_to_agent_id', sql.Int, handover_to_agent_id);
        }

        if (updates.length > 0) {
            query += updates.join(', ');
            query += ' WHERE id = @id';

            // Re-create request to bind parameters correctly including id
            const request = pool.request();
            request.input('id', sql.Int, id);
            if (system_prompt !== undefined) request.input('system_prompt', sql.NVarChar(sql.MAX), system_prompt);
            if (history_limit !== undefined) request.input('history_limit', sql.Int, history_limit);
            if (trigger_mode !== undefined) request.input('trigger_mode', sql.VarChar(50), trigger_mode);
            if (output_mode !== undefined) request.input('output_mode', sql.VarChar(50), output_mode);
            if (handover_to_agent_id !== undefined) request.input('handover_to_agent_id', sql.Int, handover_to_agent_id);

            await request.query(query);
            res.json({ success: true });
        } else {
            res.json({ success: true, message: 'No changes' });
        }

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update agent' });
    }
});

// POST Handover Notes to another Agent
app.post('/api/agents/:id/handover', async (req, res) => {
    const { id } = req.params; // Sending Agent ID

    try {
        const pool = await getPool();

        // 1. Get the target agent ID
        const agentResult = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT handover_to_agent_id FROM Agents WHERE id = @id');

        const targetAgentId = agentResult.recordset[0]?.handover_to_agent_id;

        if (!targetAgentId) {
            return res.status(400).json({ error: 'No handover target configured for this agent.' });
        }

        // 2. Fetch all notes from current agent
        const notesResult = await pool.request()
            .input('agent_id', sql.Int, id)
            .query('SELECT content FROM Notes WHERE agent_id = @agent_id ORDER BY id ASC');

        const notes = notesResult.recordset;

        if (notes.length === 0) {
            return res.status(400).json({ error: 'No notes to handover.' });
        }

        // 3. Aggregate notes
        const aggregatedContent = notes.map((n: any) => n.content).join('\n\n---\n\n');
        const handoverContent = `[HANDOVER FROM AGENT ${id}]\n\n${aggregatedContent}`;

        // 4. Insert as single chunk for target agent
        await pool.request()
            .input('content', sql.NVarChar(sql.MAX), handoverContent)
            .input('agent_id', sql.Int, targetAgentId)
            .query(`
                INSERT INTO TextChunks (content, agent_id, position) 
                VALUES (@content, @agent_id, (SELECT ISNULL(MAX(position), 0) + 1 FROM TextChunks WHERE agent_id = @agent_id))
             `);

        res.json({ success: true, targetAgentId });

    } catch (err) {
        console.error('Handover failed:', err);
        res.status(500).json({ error: 'Handover failed' });
    }
});


// --- RESOURCE API (Agent-Aware) ---

// GET Notes
app.get('/api/notes', async (req, res) => {
    const agentId = req.query.agentId;
    if (!agentId) return res.status(400).json({ error: 'agentId required' });

    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('agent_id', sql.Int, agentId)
            .query('SELECT * FROM Notes WHERE agent_id = @agent_id ORDER BY id ASC');
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch notes' });
    }
});

// GET Chunks
app.get('/api/chunks', async (req, res) => {
    const agentId = req.query.agentId;
    if (!agentId) return res.status(400).json({ error: 'agentId required' });

    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('agent_id', sql.Int, agentId)
            .query('SELECT * FROM TextChunks WHERE agent_id = @agent_id ORDER BY position ASC, id ASC');
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch chunks' });
    }
});

// GET Rules
app.get('/api/rules', async (req, res) => {
    const agentId = req.query.agentId;
    if (!agentId) return res.status(400).json({ error: 'agentId required' });

    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('agent_id', sql.Int, agentId)
            .query('SELECT * FROM OrchestrationRules WHERE agent_id = @agent_id ORDER BY position ASC, id ASC');
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch rules' });
    }
});

// POST Chunk
app.post('/api/chunks', async (req, res) => {
    const { content, agentId } = req.body;
    if (!content) return res.status(400).json({ error: 'Content is required' });
    if (!agentId) return res.status(400).json({ error: 'agentId is required' });

    try {
        const pool = await getPool();
        await pool.request()
            .input('content', sql.NVarChar(sql.MAX), content)
            .input('agent_id', sql.Int, agentId)
            .query(`
                INSERT INTO TextChunks (content, agent_id, position) 
                VALUES (@content, @agent_id, (SELECT ISNULL(MAX(position), 0) + 1 FROM TextChunks WHERE agent_id = @agent_id))
            `);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to add chunk' });
    }
});

// POST Rule
app.post('/api/rules', async (req, res) => {
    const { instruction, agentId } = req.body;
    if (!instruction) return res.status(400).json({ error: 'Instruction is required' });
    if (!agentId) return res.status(400).json({ error: 'agentId is required' });

    try {
        const pool = await getPool();
        await pool.request()
            .input('instruction', sql.NVarChar(sql.MAX), instruction)
            .input('agent_id', sql.Int, agentId)
            .query(`
                INSERT INTO OrchestrationRules (instruction, agent_id, position) 
                VALUES (@instruction, @agent_id, (SELECT ISNULL(MAX(position), 0) + 1 FROM OrchestrationRules WHERE agent_id = @agent_id))
            `);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to add rule' });
    }
});

// POST Process All (Batch)
app.post('/api/process', async (req, res) => {
    const { agentId } = req.body;
    if (!agentId) return res.status(400).json({ error: 'agentId is required' });

    try {
        const result = await processChunks(agentId);
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Processing failed' });
    }
});

// POST Process Single Chunk
app.post('/api/process-chunk', async (req, res) => {
    const { chunkId, agentId } = req.body;
    if (!chunkId) return res.status(400).json({ error: 'chunkId is required' });
    if (!agentId) return res.status(400).json({ error: 'agentId is required' });

    try {
        const result = await processChunkById(chunkId, agentId);
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

// PUT Reorder Chunks
app.put('/api/chunks/reorder', async (req, res) => {
    const { orderedIds } = req.body; // Array of IDs in new order
    if (!Array.isArray(orderedIds)) return res.status(400).json({ error: 'Invalid data' });

    try {
        const pool = await getPool();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        try {
            for (let i = 0; i < orderedIds.length; i++) {
                const id = orderedIds[i];
                await transaction.request()
                    .input('pos', sql.Int, i)
                    .input('id', sql.Int, id)
                    .query('UPDATE TextChunks SET position = @pos WHERE id = @id');
            }
            await transaction.commit();
            res.json({ success: true });
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (err) {
        console.error('Reorder chunks failed:', err);
        res.status(500).json({ error: 'Failed to reorder chunks' });
    }
});

// PUT Reorder Rules
app.put('/api/rules/reorder', async (req, res) => {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) return res.status(400).json({ error: 'Invalid data' });

    try {
        const pool = await getPool();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        try {
            for (let i = 0; i < orderedIds.length; i++) {
                const id = orderedIds[i];
                await transaction.request()
                    .input('pos', sql.Int, i)
                    .input('id', sql.Int, id)
                    .query('UPDATE OrchestrationRules SET position = @pos WHERE id = @id');
            }
            await transaction.commit();
            res.json({ success: true });
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (err) {
        console.error('Reorder rules failed:', err);
        res.status(500).json({ error: 'Failed to reorder rules' });
    }
});

// PUT Update Chunk
app.put('/api/chunks/:id', async (req, res) => {
    const { id } = req.params;
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Content is required' });

    try {
        const pool = await getPool();
        await pool.request()
            .input('id', sql.Int, id)
            .input('content', sql.NVarChar(sql.MAX), content)
            .query('UPDATE TextChunks SET content = @content WHERE id = @id');
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update chunk' });
    }
});

// PUT Update Rule
app.put('/api/rules/:id', async (req, res) => {
    const { id } = req.params;
    const { instruction } = req.body;
    if (!instruction) return res.status(400).json({ error: 'Instruction is required' });

    try {
        const pool = await getPool();
        await pool.request()
            .input('id', sql.Int, id)
            .input('instruction', sql.NVarChar(sql.MAX), instruction)
            .query('UPDATE OrchestrationRules SET instruction = @instruction WHERE id = @id');
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update rule' });
    }
});


// Database Initialization
async function initDb() {
    // Skipping db init on server start as it's handled by init.ts script now generally, 
    // but useful to keep ensure logic if needed. For now, assuming init.ts was run.
    console.log('Server starting...');
}

// Initialize DB then start server
initDb().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`)
    })
});

// Settings API - DEPRECATED / REMOVED in favor of Agent Settings
// We can keep it or remove it. Better to remove to avoid confusion.
// But wait, the frontend might still be calling it until we update.
// Leaving it but it won't impact agents as they read from Agents table.


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

