import { useState, useEffect } from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';

interface AgentSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    agentId: number;
}

export default function AgentSettingsModal({ isOpen, onClose, agentId }: AgentSettingsModalProps) {
    const [systemPrompt, setSystemPrompt] = useState('');
    const [historyLimit, setHistoryLimit] = useState(10);
    const [triggerMode, setTriggerMode] = useState('manual');
    const [outputMode, setOutputMode] = useState('cycle');
    const [handoverTargetId, setHandoverTargetId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [availableAgents, setAvailableAgents] = useState<any[]>([]);

    useEffect(() => {
        if (isOpen && agentId) {
            fetchSettings();
            fetchAgents();
        }
    }, [isOpen, agentId]);

    const fetchAgents = async () => {
        try {
            const data = await api.getAgents();
            // Filter out current agent to prevent self-selection in UI (though backend supports it)
            // Actually, user might want self-recursion? "Hands back to agent 1".
            // If agent 1 hands to agent 1, it just re-loops. That's fine.
            // Let's allow all agents.
            setAvailableAgents(data);
        } catch (err) {
            console.error('Failed to fetch agents for handover', err);
        }
    };

    const fetchSettings = async () => {
        setIsLoading(true);
        try {
            const agent = await api.getAgent(agentId);
            setSystemPrompt(agent.system_prompt || '');
            setHistoryLimit(agent.history_limit || 10);
            setTriggerMode(agent.trigger_mode || 'manual');
            setOutputMode(agent.output_mode || 'cycle');
            setHandoverTargetId(agent.handover_to_agent_id || null);
        } catch (err) {
            console.error('Failed to fetch settings', err);
            toast.error('Failed to load settings');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            await api.updateAgent(agentId, {
                system_prompt: systemPrompt,
                history_limit: historyLimit,
                trigger_mode: triggerMode,
                output_mode: outputMode,
                handover_to_agent_id: handoverTargetId
            });
            toast.success('Settings saved');
            onClose();
        } catch (err) {
            console.error('Failed to save settings', err);
            toast.error('Failed to save settings');
        }
    };

    const handleOptimize = async () => {
        if (!systemPrompt.trim()) return;
        setIsOptimizing(true);
        try {
            const result = await api.optimizePrompt(systemPrompt);
            if (result.optimizedPrompt) {
                setSystemPrompt(result.optimizedPrompt);
                toast.success('Prompt optimized!');
            }
        } catch (err) {
            toast.error('Optimization failed');
        } finally {
            setIsOptimizing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800">Agent Configuration</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>

                <div className="p-6 space-y-6">
                    {isLoading ? (
                        <div className="text-center py-10 text-gray-500">Loading settings...</div>
                    ) : (
                        <>
                            {/* System Prompt Section */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    System Prompt
                                </label>
                                <div className="space-y-2">
                                    <textarea
                                        value={systemPrompt}
                                        onChange={(e) => setSystemPrompt(e.target.value)}
                                        className="w-full h-40 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3 text-sm font-mono leading-relaxed bg-gray-50"
                                        placeholder="You are a recursive indexing assistant..."
                                    />
                                    <div className="flex justify-end">
                                        <button
                                            onClick={handleOptimize}
                                            disabled={isOptimizing || !systemPrompt}
                                            className="text-xs flex items-center gap-1 text-purple-600 hover:text-purple-700 font-medium px-3 py-1.5 bg-purple-50 rounded-md border border-purple-100 transition"
                                        >
                                            {isOptimizing ? 'Optimizing...' : '✨ AI Optimize Prompt'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* History Limit */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Context History Limit
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="50"
                                        value={historyLimit}
                                        onChange={(e) => setHistoryLimit(parseInt(e.target.value))}
                                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Number of previous notes to include in context.</p>
                                </div>

                                {/* Trigger Mode */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Trigger Mode
                                    </label>
                                    <select
                                        value={triggerMode}
                                        onChange={(e) => setTriggerMode(e.target.value)}
                                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2"
                                    >
                                        <option value="manual">Manual (Button Press)</option>
                                        <option value="auto">Automatic (On New Chunk)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Handover Configuration */}
                            <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
                                <label className="block text-sm font-bold text-orange-800 mb-2 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 1l4 4-4 4"></path><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><path d="M7 23l-4-4 4-4"></path><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
                                    Handover Output To
                                </label>
                                <select
                                    value={handoverTargetId === null ? '' : handoverTargetId}
                                    onChange={(e) => setHandoverTargetId(e.target.value ? parseInt(e.target.value) : null)}
                                    className="w-full rounded-lg border-orange-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 p-2 bg-white"
                                >
                                    <option value="">-- No Handover --</option>
                                    {availableAgents.map(a => (
                                        <option key={a.id} value={a.id}>
                                            {a.id === agentId ? `${a.name} (Self-Recursion)` : a.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-orange-600 mt-2">
                                    All generated notes will be bundled into a single text chunk and sent to the selected agent when you click "Handover".
                                </p>
                            </div>
                        </>
                    )}
                </div>

                <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 rounded-b-xl">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium rounded-lg hover:bg-gray-200 transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-sm transition transform active:scale-95"
                    >
                        Save Configuration
                    </button>
                </div>
            </div>
        </div>
    );
}
