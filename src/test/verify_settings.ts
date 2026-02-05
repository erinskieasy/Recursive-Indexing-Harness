
async function verifySettings() {
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
        console.log('Verifying Settings API...');

        // 1. GET Default System Prompt (Should be seeded)
        console.log("Checking seeded prompt...");
        const getRes = await api.get('/api/settings/system_prompt');
        console.log('GET /api/settings/system_prompt:', getRes.status, getRes.data.value ? "Found" : "NULL");

        if (!getRes.data.value) {
            console.error("FAIL: Seeding failed, prompt is null");
        } else {
            console.log("SUCCESS: Default prompt is present.");
        }

        // 2. UPDATE System Prompt
        console.log("Updating prompt...");
        const newPrompt = "TEST_PROMPT_" + Date.now();
        const updateRes = await api.post('/api/settings', { key: 'system_prompt', value: newPrompt });
        console.log('POST /api/settings:', updateRes.status, updateRes.data);

        // 3. VERIFY Update
        const verifyRes = await api.get('/api/settings/system_prompt');
        console.log('GET /api/settings/system_prompt:', verifyRes.status);
        if (verifyRes.data.value === newPrompt) {
            console.log("SUCCESS: Prompt updated correctly.");
        } else {
            console.error("FAIL: Prompt update mismatch. Expected", newPrompt, "Got", verifyRes.data.value);
        }

        // 4. Optimize (Mock call? No, call real API if keys set, otherwise expect error or skip)
        // console.log("Testing Optimize...");
        // const optRes = await api.post('/api/optimize-prompt', { prompt: "Be concise." });
        // console.log("Optimize Result:", optRes.data);

    } catch (err) {
        console.error('Verification Failed:', err);
    }
}

verifySettings();
