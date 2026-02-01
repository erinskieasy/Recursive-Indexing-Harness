
async function verifyDeleteApi() {
    const baseUrl = 'http://localhost:3000';

    const api = {
        delete: async (path: string) => {
            const res = await fetch(`${baseUrl}${path}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });
            return { status: res.status, data: await res.json() };
        },
        get: async (path: string) => {
            const res = await fetch(`${baseUrl}${path}`);
            return { status: res.status, data: await res.json() };
        }
    };

    try {
        console.log('Verifying DELETE API...');

        // 1. Get current IDs to delete
        const chunksRes = await api.get('/api/chunks');
        const rulesRes = await api.get('/api/rules');
        const notesRes = await api.get('/api/notes');

        const chunkToDelete = chunksRes.data[0];
        const ruleToDelete = rulesRes.data[0];
        const noteToDelete = notesRes.data[0];

        if (chunkToDelete) {
            console.log(`Deleting Chunk ID ${chunkToDelete.id}...`);
            const delRes = await api.delete(`/api/chunks/${chunkToDelete.id}`);
            console.log('Delete Chunk:', delRes.status, delRes.data);
        } else {
            console.warn('No chunks to delete.');
        }

        if (ruleToDelete) {
            console.log(`Deleting Rule ID ${ruleToDelete.id}...`);
            const delRes = await api.delete(`/api/rules/${ruleToDelete.id}`);
            console.log('Delete Rule:', delRes.status, delRes.data);
        } else {
            console.warn('No rules to delete.');
        }

        if (noteToDelete) {
            console.log(`Deleting Note ID ${noteToDelete.id}...`);
            const delRes = await api.delete(`/api/notes/${noteToDelete.id}`);
            console.log('Delete Note:', delRes.status, delRes.data);
        } else {
            console.warn('No notes to delete.');
        }

        console.log('Verification Complete.');

    } catch (err) {
        console.error('Verification Failed:', err);
    }
}

verifyDeleteApi();
