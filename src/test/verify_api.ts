
async function verifyApi() {
    const baseUrl = 'http://localhost:3000';

    const api = {
        post: async (path: string, body: any) => {
            const res = await fetch(`${baseUrl}${path}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            return { status: res.status, data: await res.json() };
        },
        get: async (path: string) => {
            const res = await fetch(`${baseUrl}${path}`);
            return { status: res.status, data: await res.json() };
        }
    };

    try {
        console.log('Verifying API...');

        // 1. Add Chunk
        const chunkRes = await api.post('/api/chunks', { content: 'API Verification Chunk' });
        console.log('Add Chunk:', chunkRes.status, chunkRes.data);

        // 2. Add Rule
        const ruleRes = await api.post('/api/rules', { instruction: 'API Verification Rule: Be brief.' });
        console.log('Add Rule:', ruleRes.status, ruleRes.data);

        // 3. Process
        const processRes = await api.post('/api/process', {});
        console.log('Process:', processRes.status, processRes.data);

        // 4. Get Notes
        const notesRes = await api.get('/api/notes');
        console.log('Get Notes:', notesRes.status, `Found ${notesRes.data.length} notes`);

        // Check if new note exists
        const newNote = notesRes.data.find((n: any) => n.content && n.content.length > 0);
        if (newNote) {
            console.log('Verification Successful: Notes found.');
        } else {
            console.warn('Verification Warning: No notes found.');
        }

    } catch (err) {
        console.error('Verification Failed:', err);
    }
}

verifyApi();
