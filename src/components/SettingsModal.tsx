import { useState, useEffect } from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isOptimizing, setIsOptimizing] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchPrompt();
        }
    }, [isOpen]);

    const fetchPrompt = async () => {
        setIsLoading(true);
        try {
            const res = await api.getSystemPrompt();
            if (res.value) {
                setPrompt(res.value);
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to load System Prompt.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            await api.updateSystemPrompt(prompt);
            toast.success("System Prompt saved!");
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
                                    className="w-full h-64 p-4 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm leading-relaxed text-gray-700"
                                    placeholder="Enter system prompt..."
                                />
                            </div>

                            <div className="flex justify-between items-center text-sm text-gray-500">
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
