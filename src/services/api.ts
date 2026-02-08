const API_URL = '/api';

export const api = {
    // Agents
    getAgents: async () => {
        const response = await fetch(`${API_URL}/agents`);
        return response.json();
    },

    createAgent: async (name: string) => {
        const response = await fetch(`${API_URL}/agents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        });
        return response.json();
    },

    getAgent: async (id: number) => {
        const response = await fetch(`${API_URL}/agents/${id}`);
        return response.json();
    },

    updateAgent: async (id: number, settings: any) => {
        const response = await fetch(`${API_URL}/agents/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings),
        });
        return response.json();
    },

    deleteAgent: async (id: number) => {
        const response = await fetch(`${API_URL}/agents/${id}`, {
            method: 'DELETE',
        });
        return response.json();
    },

    triggerHandover: async (agentId: number) => {
        const response = await fetch(`${API_URL}/agents/${agentId}/handover`, {
            method: 'POST',
        });
        return response.json();
    },

    // Resources (scoped by agentId)
    getChunks: async (agentId: number) => {
        const response = await fetch(`${API_URL}/chunks?agentId=${agentId}`);
        return response.json();
    },

    getRules: async (agentId: number) => {
        const response = await fetch(`${API_URL}/rules?agentId=${agentId}`);
        return response.json();
    },

    getNotes: async (agentId: number) => {
        const response = await fetch(`${API_URL}/notes?agentId=${agentId}`);
        return response.json();
    },

    addChunk: async (content: string, agentId: number) => {
        const response = await fetch(`${API_URL}/chunks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, agentId }),
        });
        return response.json();
    },

    addRule: async (instruction: string, agentId: number) => {
        const response = await fetch(`${API_URL}/rules`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instruction, agentId }),
        });
        return response.json();
    },

    deleteChunk: async (id: number) => {
        const response = await fetch(`${API_URL}/chunks/${id}`, {
            method: 'DELETE',
        });
        return response.json();
    },

    deleteRule: async (id: number) => {
        const response = await fetch(`${API_URL}/rules/${id}`, {
            method: 'DELETE',
        });
        return response.json();
    },

    deleteNote: async (id: number) => {
        const response = await fetch(`${API_URL}/notes/${id}`, {
            method: 'DELETE',
        });
        return response.json();
    },

    updateChunk: async (id: number, content: string) => {
        const response = await fetch(`${API_URL}/chunks/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
        });
        return response.json();
    },

    updateRule: async (id: number, instruction: string) => {
        const response = await fetch(`${API_URL}/rules/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instruction }),
        });
        return response.json();
    },

    // Processing
    processChunks: async (agentId: number) => {
        const response = await fetch(`${API_URL}/process`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agentId }),
        });
        return response.json(); // { success: true, processedCount: number }
    },

    processChunk: async (chunkId: number, agentId: number) => {
        const response = await fetch(`${API_URL}/process-chunk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chunkId, agentId }),
        });
        return response.json(); // { success: true, note: Note }
    },

    reorderChunks: async (orderedIds: number[]) => {
        const response = await fetch(`${API_URL}/chunks/reorder`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderedIds }),
        });
        return response.json();
    },

    reorderRules: async (orderedIds: number[]) => {
        const response = await fetch(`${API_URL}/rules/reorder`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderedIds }),
        });
        return response.json();
    },

    // Utilities
    optimizePrompt: async (prompt: string) => {
        const response = await fetch(`${API_URL}/optimize-prompt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt }),
        });
        return response.json();
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
    async getHistoryLimit() {
        const res = await fetch('/api/settings/history_limit');
        return res.json();
    },
    async updateHistoryLimit(value: number) {
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'history_limit', value: value.toString() }),
        });
        return res.json();
    }
};
