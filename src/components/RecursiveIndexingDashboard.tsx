import { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function Dashboard() {
    const [chunkInput, setChunkInput] = useState('');
    const [ruleInput, setRuleInput] = useState('');
    const [chunks, setChunks] = useState<any[]>([]);
    const [rules, setRules] = useState<any[]>([]);
    const [notes, setNotes] = useState<any[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingChunkId, setProcessingChunkId] = useState<number | null>(null);
    const [status, setStatus] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [c, r, n] = await Promise.all([
                api.getChunks(),
                api.getRules(),
                api.getNotes()
            ]);
            setChunks(c);
            setRules(r);
            setNotes(n);
        } catch (err) {
            console.error('Failed to fetch data', err);
        }
    };

    const handleAddChunk = async () => {
        if (!chunkInput.trim()) return;
        try {
            await api.addChunk(chunkInput);
            setChunkInput('');
            fetchData();
        } catch (err) {
            console.error('Failed to add chunk', err);
        }
    };

    const handleAddRule = async () => {
        if (!ruleInput.trim()) return;
        try {
            await api.addRule(ruleInput);
            setRuleInput('');
            fetchData();
        } catch (err) {
            console.error('Failed to add rule', err);
        }
    };

    const handleProcess = async () => {
        setIsProcessing(true);
        setStatus('Starting sequential processing...');

        try {
            let processedCount = 0;
            // Iterate through chunks sequentially
            for (const chunk of chunks) {
                setProcessingChunkId(chunk.id);
                // setStatus(`Processing chunk #${chunk.id}...`);

                try {
                    const result = await api.processChunk(chunk.id);
                    if (result.success && result.note) {
                        setNotes(prev => [...prev, result.note]);
                        processedCount++;
                    } else {
                        // Maybe it was skipped or failed
                    }
                } catch (err) {
                    console.error(`Failed to process chunk ${chunk.id}`, err);
                }

                // Small delay for visual pacing
                await new Promise(r => setTimeout(r, 500));
            }
            setStatus(`Processing complete. Processed ${processedCount} new notes.`);
            fetchData();

        } catch (err) {
            console.error('Processing loop failed', err);
            setStatus('Processing failed.');
        } finally {
            setIsProcessing(false);
            setProcessingChunkId(null);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8 font-sans text-gray-800">
            <div className="max-w-6xl mx-auto space-y-8">

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Input Section */}
                    <div className="space-y-6">
                        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                Add Context
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">New Text Chunk</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={chunkInput}
                                            onChange={(e) => setChunkInput(e.target.value)}
                                            className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                                            placeholder="Enter raw text content..."
                                        />
                                        <button
                                            onClick={handleAddChunk}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                                        >
                                            Add
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">New Orchestration Rule</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={ruleInput}
                                            onChange={(e) => setRuleInput(e.target.value)}
                                            className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
                                            placeholder="Enter a rule..."
                                        />
                                        <button
                                            onClick={handleAddRule}
                                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                                        >
                                            Add
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h2 className="text-xl font-semibold mb-4">Current Config</h2>
                            <div className="space-y-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                <div>
                                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Text Chunks ({chunks.length})</h3>
                                    <ul className="space-y-2">
                                        {chunks.map((c) => (
                                            <li key={c.id} className={`text-sm p-2 rounded border border-gray-100 flex justify-between items-center group
                                                ${processingChunkId === c.id ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-gray-50'}
                                                transition-colors duration-200
                                            `}>
                                                <div className="flex items-center gap-3 overflow-hidden flex-1">
                                                    {processingChunkId === c.id && (
                                                        <svg className="animate-spin h-4 w-4 text-blue-500 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                    )}
                                                    <span className={`truncate ${processingChunkId === c.id ? 'font-medium text-blue-700' : 'text-gray-700'}`}>{c.content}</span>
                                                </div>
                                                <button
                                                    onClick={async () => { await api.deleteChunk(c.id); fetchData(); }}
                                                    className="bg-red-50 text-red-400 hover:text-red-600 p-1 rounded opacity-0 group-hover:opacity-100 transition"
                                                    title="Delete Chunk"
                                                >
                                                    ✕
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div>
                                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Rules ({rules.length})</h3>
                                    <ul className="space-y-2">
                                        {rules.map((r) => (
                                            <li key={r.id} className="text-sm bg-indigo-50 p-2 rounded border border-indigo-100 text-indigo-900 flex justify-between items-center group">
                                                <span className="flex-1">{r.instruction}</span>
                                                <button
                                                    onClick={async () => { await api.deleteRule(r.id); fetchData(); }}
                                                    className="text-indigo-400 hover:text-red-600 p-1 rounded opacity-0 group-hover:opacity-100 transition"
                                                    title="Delete Rule"
                                                >
                                                    ✕
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Control & Output Section */}
                    <div className="space-y-6">
                        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-semibold flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                    Processing
                                </h2>
                                {status && <span className="text-sm text-gray-500 animate-pulse">{status}</span>}
                            </div>

                            <button
                                onClick={handleProcess}
                                disabled={isProcessing}
                                className={`w-full py-3 rounded-lg font-medium text-white shadow-lg transition transform active:scale-95 ${isProcessing
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
                                    }`}
                            >
                                {isProcessing ? 'Processing...' : 'Run Processing Loop'}
                            </button>
                        </section>

                        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-[500px]">
                            <h2 className="text-xl font-semibold mb-4">Generated Notes ({notes.length})</h2>
                            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                                {notes.length === 0 ? (
                                    <div className="text-center text-gray-400 py-10">No notes generated yet.</div>
                                ) : (
                                    notes.map((note) => (
                                        <article key={note.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition group relative">
                                            <button
                                                onClick={async () => { await api.deleteNote(note.id); fetchData(); }}
                                                className="absolute top-2 right-2 text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition"
                                                title="Delete Note"
                                            >
                                                ✕
                                            </button>
                                            <div className="flex justify-between items-start mb-2 pr-6">
                                                <span className="text-xs font-bold px-2 py-1 bg-blue-100 text-blue-800 rounded">
                                                    Linked to Chunk #{note.text_chunk_id}
                                                </span>
                                                <span className="text-xs text-gray-400">ID: {note.id}</span>
                                            </div>
                                            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                                                {note.content}
                                            </p>
                                        </article>
                                    ))
                                )}
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}
