
export const api = {
    async getNotes() {
        const res = await fetch('/api/notes');
        return res.json();
    },
    async getChunks() {
        const res = await fetch('/api/chunks');
        return res.json();
    },
    async getRules() {
        const res = await fetch('/api/rules');
        return res.json();
    },
    async addChunk(content: string) {
        const res = await fetch('/api/chunks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
        });
        return res.json();
    },
    async addRule(instruction: string) {
        const res = await fetch('/api/rules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instruction }),
        });
        return res.json();
    },
    async runProcessing() {
        const res = await fetch('/api/process', {
            method: 'POST',
        });
        return res.json();
    },
    async deleteChunk(id: number) {
        const res = await fetch(`/api/chunks/${id}`, {
            method: 'DELETE',
        });
        return res.json();
    },
    async deleteRule(id: number) {
        const res = await fetch(`/api/rules/${id}`, {
            method: 'DELETE',
        });
        return res.json();
    },
    async deleteNote(id: number) {
        const res = await fetch(`/api/notes/${id}`, {
            method: 'DELETE',
        });
        return res.json();
    },
    async updateChunk(id: number, content: string) {
        const res = await fetch(`/api/chunks/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
        });
        return res.json();
    },
    async updateRule(id: number, instruction: string) {
        const res = await fetch(`/api/rules/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instruction }),
        });
        return res.json();
    },
    async processChunk(chunkId: number) {
        const res = await fetch('/api/process-chunk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chunkId }),
        });
        return res.json();
    },
    async getSystemPrompt() {
        const res = await fetch('/api/settings/system_prompt');
        return res.json();
    },
    async updateSystemPrompt(value: string) {
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'system_prompt', value }),
        });
        return res.json();
    },
    async optimizePrompt(prompt: string) {
        const res = await fetch('/api/optimize-prompt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt }),
        });
        return res.json();
    }
};
