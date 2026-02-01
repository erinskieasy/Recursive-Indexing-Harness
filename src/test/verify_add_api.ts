
async function verifyAddApi() {
    const baseUrl = 'http://localhost:3000';

    try {
        console.log('Verifying ADD API...');

        // Test Chunk Add
        const chunkRes = await fetch(`${baseUrl}/api/chunks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: 'Test Chunk from Script' })
        });
        console.log('Add Chunk Status:', chunkRes.status);
        const chunkData = await chunkRes.json();
        console.log('Add Chunk Response:', chunkData);

        // Test Rule Add
        const ruleRes = await fetch(`${baseUrl}/api/rules`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instruction: 'Test Rule from Script' })
        });
        console.log('Add Rule Status:', ruleRes.status);
        const ruleData = await ruleRes.json();
        console.log('Add Rule Response:', ruleData);

    } catch (err) {
        console.error('Verification Failed:', err);
    }
}

verifyAddApi();
