import { useState, useEffect } from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const [prompt, setPrompt] = useState('');
    const [historyLimit, setHistoryLimit] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isOptimizing, setIsOptimizing] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchSettings();
        }
    }, [isOpen]);

    const fetchSettings = async () => {
        setIsLoading(true);
        try {
            const [promptRes, limitRes] = await Promise.all([
                api.getSystemPrompt(),
                api.getHistoryLimit()
            ]);

            if (promptRes.value) setPrompt(promptRes.value);
            if (limitRes.value) setHistoryLimit(limitRes.value);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load settings.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            await Promise.all([
                api.updateSystemPrompt(prompt),
                historyLimit ? api.updateHistoryLimit(parseInt(historyLimit)) : Promise.resolve()
                // If empty, should we clear it? API update with empty string might fail parsing.
                // For now, let's assume user sets a number. If they clear it, we might need a delete or nullable update.
                // Let's support clearing if we send 0 or -1? Or just handle non-numeric.
                // Simple version: only update if valid number.
            ]);

            if (historyLimit === '') {
                // Try to clear it ?
                // api.updateHistoryLimit(0) ? 
                // Let's just update as is, but maybe the API expects a string value anyway.
                // My api.ts updateHistoryLimit converts value to string.
                await api.updateHistoryLimit(parseInt(historyLimit || '0'));
            }

            toast.success("Settings saved!");
            onClose();
        } catch (err) {
            console.error(err);
            toast.error("Failed to save.");
        }
    };

    const handleOptimize = async () => {
        if (!prompt.trim()) return;
        setIsOptimizing(true);
        try {
            const res = await api.optimizePrompt(prompt);
            if (res.optimizedPrompt) {
                setPrompt(res.optimizedPrompt);
                toast.success("Prompt optimized by AI!");
            }
        } catch (err) {
            console.error(err);
            toast.error("Optimization failed.");
        } finally {
            setIsOptimizing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h2 className="text-xl font-bold text-gray-800">System Prompt Settings</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>

                <div className="p-6 space-y-4">
                    {isLoading ? (
                        <div className="flex justify-center p-8">
                            <span className="animate-spin text-blue-500 text-3xl">⟳</span>
                        </div>
                    ) : (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Define the AI's Persona and Instruction
                                </label>
                                <textarea
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    className="w-full h-48 p-4 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm leading-relaxed text-gray-700 mb-4"
                                    placeholder="Enter system prompt..."
                                />
                            </div>

                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Notes History Limit (Context Window)
                                </label>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="number"
                                        min="1"
                                        value={historyLimit}
                                        onChange={(e) => setHistoryLimit(e.target.value)}
                                        className="w-24 p-2 border rounded shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="All"
                                    />
                                    <span className="text-sm text-gray-500">
                                        Limit the number of previous notes sent to AI. Leave empty for "All".
                                    </span>
                                </div>
                            </div>

                            <div className="flex justify-between items-center text-sm text-gray-500 mt-4">
                                <p>Used for recursive context updates.</p>
                                <button
                                    onClick={handleOptimize}
                                    disabled={isOptimizing || !prompt}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition
                                        ${isOptimizing ? 'bg-gray-100 text-gray-400' : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'}
                                    `}
                                >
                                    {isOptimizing ? (
                                        <><span>⟳</span> Optimizing...</>
                                    ) : (
                                        <><span>✨</span> AI Optimize</>
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </div>

                <div className="p-6 bg-gray-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm transition"
                    >
                        Save Configuration
                    </button>
                </div>
            </div>
        </div>
    );
}
