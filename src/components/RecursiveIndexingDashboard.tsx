import { useState, useEffect } from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import EditModal from './EditModal';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Sortable Item Component
function SortableItem({ id, children, renderHandle }: { id: number, children: React.ReactNode, renderHandle?: (props: any) => React.ReactNode }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <li ref={setNodeRef} style={style} className="flex items-center gap-2 group">
            {renderHandle ? renderHandle({ ...attributes, ...listeners }) : (
                <div {...attributes} {...listeners} className="cursor-grab text-gray-400 hover:text-gray-600 p-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle>
                    </svg>
                </div>
            )}
            <div className="flex-1 min-w-0">
                {children}
            </div>
        </li>
    );
}

export default function Dashboard() {
    const [chunkInput, setChunkInput] = useState('');
    const [ruleInput, setRuleInput] = useState('');
    const [chunks, setChunks] = useState<any[]>([]);
    const [rules, setRules] = useState<any[]>([]);
    const [notes, setNotes] = useState<any[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingChunkId, setProcessingChunkId] = useState<number | null>(null);
    const [status, setStatus] = useState('');
    const [editingItem, setEditingItem] = useState<{ type: 'chunk' | 'rule', id: number, content: string } | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

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

    const handleDragEndChunks = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            const oldIndex = chunks.findIndex((item) => item.id === active.id);
            const newIndex = chunks.findIndex((item) => item.id === over?.id);
            const newItems = arrayMove(chunks, oldIndex, newIndex);

            setChunks(newItems);

            try {
                await api.reorderChunks(newItems.map(i => i.id));
                console.log('Chunk order saved');
            } catch (err) {
                console.error('Failed to save chunk order', err);
                toast.error('Failed to save order');
            }
        }
    };

    const handleDragEndRules = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            const oldIndex = rules.findIndex((item) => item.id === active.id);
            const newIndex = rules.findIndex((item) => item.id === over?.id);
            const newItems = arrayMove(rules, oldIndex, newIndex);

            setRules(newItems);

            try {
                await api.reorderRules(newItems.map(i => i.id));
                console.log('Rule order saved');
            } catch (err) {
                console.error('Failed to save rule order', err);
                toast.error('Failed to save order');
            }
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
                    } else if (result.error) {
                        // Show specific toast for system prompt error
                        if (result.error.includes("System Prompt not set")) {
                            toast.error("Please set system prompt!");
                            // Stop processing loop?
                            break;
                        } else {
                            console.warn(`Chunk ${chunk.id} failed:`, result.error);
                        }
                    } else {
                        // Maybe it was skipped
                    }
                } catch (err: any) {
                    console.error(`Failed to process chunk ${chunk.id}`, err);
                    // Check if it's the specific "System Prompt not set" error or just a failure
                    // Since api.processChunk returns json, we need to check if result has error or if fetch threw.
                    // Actually api.processChunk returns {success: boolean, note: ...} or throws?
                    // api.ts uses fetch(). if server returns 500, response.ok is false? 
                    // No, api.ts currently blindly does res.json(). If 500, it might throw on json parsing OR return {error: ...} object.
                    // Let's assume server returns {error: "..."} on 500.
                }

                // Small delay for visual pacing
                await new Promise(r => setTimeout(r, 500));
            }
            setStatus(`Processing complete. Processed ${processedCount} new notes.`);
            fetchData();

        } catch (err: any) {
            console.error('Processing loop failed', err);
            setStatus('Processing failed.');
            toast.error("Processing failed. Please check your settings.");
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

                                <EditModal
                                    isOpen={!!editingItem}
                                    onClose={() => setEditingItem(null)}
                                    title={editingItem?.type === 'chunk' ? 'Edit Text Chunk' : 'Edit Orchestration Rule'}
                                    initialContent={editingItem?.content || ''}
                                    onSave={async (newContent) => {
                                        if (!editingItem) return;
                                        if (editingItem.type === 'chunk') {
                                            await api.updateChunk(editingItem.id, newContent);
                                        } else {
                                            await api.updateRule(editingItem.id, newContent);
                                        }
                                        fetchData();
                                        toast.success('Updated successfully');
                                    }}
                                />

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
                                    <DndContext
                                        sensors={sensors}
                                        collisionDetection={closestCenter}
                                        onDragEnd={handleDragEndChunks}
                                    >
                                        <SortableContext
                                            items={chunks.map(c => c.id)}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            <ul className="space-y-2">
                                                {chunks.map((c) => (
                                                    <SortableItem key={c.id} id={c.id}>
                                                        <div className={`text-sm p-2 rounded border border-gray-100 flex justify-between items-center group/item w-full
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
                                                            <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition">
                                                                <button
                                                                    onClick={() => setEditingItem({ type: 'chunk', id: c.id, content: c.content })}
                                                                    className="p-1 text-gray-400 hover:text-blue-600 rounded"
                                                                    title="Edit Chunk"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                                    </svg>
                                                                </button>
                                                                <button
                                                                    onClick={async () => { await api.deleteChunk(c.id); fetchData(); }}
                                                                    className="text-red-400 hover:text-red-600 p-1 rounded"
                                                                    title="Delete Chunk"
                                                                >
                                                                    ✕
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </SortableItem>
                                                ))}
                                            </ul>
                                        </SortableContext>
                                    </DndContext>
                                </div>

                                <div>
                                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Rules ({rules.length})</h3>
                                    <DndContext
                                        sensors={sensors}
                                        collisionDetection={closestCenter}
                                        onDragEnd={handleDragEndRules}
                                    >
                                        <SortableContext
                                            items={rules.map(r => r.id)}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            <ul className="space-y-2">
                                                {rules.map((r) => (
                                                    <SortableItem key={r.id} id={r.id}>
                                                        <div className="text-sm bg-indigo-50 p-2 rounded border border-indigo-100 text-indigo-900 flex justify-between items-center group/item w-full">
                                                            <span className="flex-1">{r.instruction}</span>
                                                            <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition">
                                                                <button
                                                                    onClick={() => setEditingItem({ type: 'rule', id: r.id, content: r.instruction })}
                                                                    className="p-1 text-indigo-400 hover:text-indigo-600 rounded"
                                                                    title="Edit Rule"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                                    </svg>
                                                                </button>
                                                                <button
                                                                    onClick={async () => { await api.deleteRule(r.id); fetchData(); }}
                                                                    className="text-indigo-400 hover:text-red-600 p-1 rounded"
                                                                    title="Delete Rule"
                                                                >
                                                                    ✕
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </SortableItem>
                                                ))}
                                            </ul>
                                        </SortableContext>
                                    </DndContext>
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
