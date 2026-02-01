
async function verifyChunkApi() {
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
        console.log('Verifying Process Chunk API...');

        // 1. Get a chunk to process
        const chunksRes = await api.get('/api/chunks');
        const chunk = chunksRes.data[0];

        if (chunk) {
            console.log(`Processing Chunk ID ${chunk.id}...`);
            const procRes = await api.post('/api/process-chunk', { chunkId: chunk.id });
            console.log('Process Chunk:', procRes.status, procRes.data);
        } else {
            console.warn('No chunks to test processing.');
        }

    } catch (err) {
        console.error('Verification Failed:', err);
    }
}

verifyChunkApi();
