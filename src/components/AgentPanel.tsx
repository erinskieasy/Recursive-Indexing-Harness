import { useState, useEffect } from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';

interface Agent {
    id: number;
    name: string;
}

interface AssetTable {
    id: number;
    logical_name: string;
    display_name: string;
    description?: string;
}

interface AgentPanelProps {
    onAgentSelect: (agentId: number) => void;
    selectedAgentId: number | null;
    agentStates?: Record<number, { isProcessing: boolean }>;
}

export default function AgentPanel({ onAgentSelect, selectedAgentId, agentStates }: AgentPanelProps) {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [isExpanded, setIsExpanded] = useState(true);
    const [newAgentName, setNewAgentName] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [editingAgentId, setEditingAgentId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState('');
    const [activeTab, setActiveTab] = useState<'agents' | 'tools' | 'assets'>('agents');

    const [assets, setAssets] = useState<AssetTable[]>([]);
    const [bindings, setBindings] = useState<Record<number, any>>({});
    const [assetLogicalName, setAssetLogicalName] = useState('');
    const [assetDisplayName, setAssetDisplayName] = useState('');
    const [assetDescription, setAssetDescription] = useState('');

    useEffect(() => {
        fetchAgents();
        fetchAssets();
    }, []);

    useEffect(() => {
        if (selectedAgentId) {
            fetchBindings(selectedAgentId);
        } else {
            setBindings({});
        }
    }, [selectedAgentId]);

    const fetchAgents = async () => {
        try {
            const data = await api.getAgents();
            setAgents(data);
            if (data.length > 0 && !selectedAgentId) {
                onAgentSelect(data[0].id);
            }
        } catch (err) {
            console.error('Failed to fetch agents', err);
        }
    };

    const fetchAssets = async () => {
        try {
            const data = await api.getAssetTables();
            setAssets(data);
        } catch (err) {
            console.error('Failed to fetch assets', err);
        }
    };

    const fetchBindings = async (agentId: number) => {
        try {
            const data = await api.getAgentAssetBindings(agentId);
            const mapped = data.reduce((acc: Record<number, any>, item: any) => {
                acc[item.asset_table_id] = item;
                return acc;
            }, {});
            setBindings(mapped);
        } catch (err) {
            console.error('Failed to fetch bindings', err);
        }
    };

    const handleCreateAgent = async () => {
        if (!newAgentName.trim()) return;
        try {
            const newAgent = await api.createAgent(newAgentName);
            setAgents([...agents, newAgent]);
            setNewAgentName('');
            setIsAdding(false);
            onAgentSelect(newAgent.id);
        } catch (err) {
            console.error('Failed to create agent', err);
        }
    };

    const handleDeleteAgent = async (e: React.MouseEvent, agentId: number, agentName: string) => {
        e.stopPropagation();
        if (!confirm(`Are you sure you want to delete agent "${agentName}"? This will delete ALL associated chunks, rules, and notes.`)) {
            return;
        }

        try {
            await api.deleteAgent(agentId);
            const updatedAgents = agents.filter(a => a.id !== agentId);
            setAgents(updatedAgents);

            if (selectedAgentId === agentId) {
                if (updatedAgents.length > 0) {
                    onAgentSelect(updatedAgents[0].id);
                } else {
                    onAgentSelect(0);
                }
            }
        } catch (err) {
            console.error('Failed to delete agent', err);
            alert('Failed to delete agent');
        }
    };

    const startEditing = (e: React.MouseEvent, agent: Agent) => {
        e.stopPropagation();
        setEditingAgentId(agent.id);
        setEditingName(agent.name);
    };

    const handleRename = async (agentId: number) => {
        if (!editingName.trim()) {
            setEditingAgentId(null);
            return;
        }

        try {
            setAgents(agents.map(a => a.id === agentId ? { ...a, name: editingName } : a));
            setEditingAgentId(null);
            await api.updateAgent(agentId, { name: editingName });
        } catch (err) {
            console.error('Failed to rename agent', err);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent, agentId: number) => {
        if (e.key === 'Enter') {
            handleRename(agentId);
        } else if (e.key === 'Escape') {
            setEditingAgentId(null);
        }
    };

    const handleCreateAsset = async () => {
        if (!assetLogicalName.trim() || !assetDisplayName.trim()) {
            toast.error('Logical name and display name are required');
            return;
        }

        try {
            await api.createAssetTable({
                logical_name: assetLogicalName.trim(),
                display_name: assetDisplayName.trim(),
                description: assetDescription.trim() || undefined,
            });
            setAssetLogicalName('');
            setAssetDisplayName('');
            setAssetDescription('');
            await fetchAssets();
            toast.success('Asset table created');
        } catch (err) {
            console.error('Failed to create asset table', err);
            toast.error('Failed to create asset table');
        }
    };

    const updateBinding = (assetTableId: number, key: string, value: any) => {
        const existing = bindings[assetTableId] || {
            asset_table_id: assetTableId,
            can_read: true,
            can_write: false,
            can_search: true,
            include_in_prompt: false,
            prompt_row_limit: 5,
        };

        setBindings(prev => ({
            ...prev,
            [assetTableId]: {
                ...existing,
                [key]: value,
            },
        }));
    };

    const handleSaveBindings = async () => {
        if (!selectedAgentId) {
            toast.error('Select an agent first');
            return;
        }

        try {
            await api.saveAgentAssetBindings(selectedAgentId, Object.values(bindings));
            toast.success('Asset bindings saved');
            await fetchBindings(selectedAgentId);
        } catch (err) {
            console.error('Failed to save bindings', err);
            toast.error('Failed to save asset bindings');
        }
    };

    return (
        <div className="bg-white border-b border-gray-200 transition-all duration-300">
            <div
                className="flex items-center justify-between px-6 py-3 bg-gray-50 border-b border-gray-100 cursor-pointer hover:bg-gray-100 transition"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2">
                    <h2 className="font-scemibold text-gray-700">Recursive Auto-Agents</h2>
                </div>
                <button className="text-gray-400 hover:text-gray-600">
                    {isExpanded ? '▴' : '▾'}
                </button>
            </div>

            {isExpanded && (
                <div className="p-4 px-6 overflow-x-auto">
                    <div className="flex space-x-4 border-b border-gray-200 mb-4 pb-2">
                        <button
                            className={`pb-1 px-1 font-medium text-sm transition-colors ${activeTab === 'agents' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            onClick={() => setActiveTab('agents')}
                        >
                            Agents <span className="ml-1 text-xs bg-gray-100 px-1.5 py-0.5 rounded-full">{agents.length}</span>
                        </button>
                        <button
                            className={`pb-1 px-1 font-medium text-sm transition-colors ${activeTab === 'tools' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            onClick={() => setActiveTab('tools')}
                        >
                            Tools
                        </button>
                        <button
                            className={`pb-1 px-1 font-medium text-sm transition-colors ${activeTab === 'assets' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            onClick={() => setActiveTab('assets')}
                        >
                            Assets
                        </button>
                    </div>

                    {activeTab === 'agents' && (
                        <div className="flex items-center gap-4">
                            {agents.map(agent => (
                                <div
                                    key={agent.id}
                                    onClick={() => onAgentSelect(agent.id)}
                                    className={`
                                    relative flex items-center justify-between min-w-[150px] p-3 rounded-lg border cursor-pointer transition select-none group
                                    ${selectedAgentId === agent.id
                                            ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-100 shadow-sm'
                                            : 'bg-white border-gray-200 hover:border-blue-200 hover:shadow-sm'}
                                `}
                                >
                                    {editingAgentId === agent.id ? (
                                        <input
                                            type="text"
                                            value={editingName}
                                            onChange={(e) => setEditingName(e.target.value)}
                                            onBlur={() => handleRename(agent.id)}
                                            onKeyDown={(e) => handleKeyDown(e, agent.id)}
                                            autoFocus
                                            className="text-sm font-medium border border-blue-300 rounded px-1 py-0.5 w-[120px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        <span className={`font-medium ${selectedAgentId === agent.id ? 'text-blue-700' : 'text-gray-700'}`}>
                                            {agent.name}
                                        </span>
                                    )}

                                    <div className="flex items-center gap-1">
                                        {!editingAgentId && (
                                            <button
                                                onClick={(e) => startEditing(e, agent)}
                                                className="text-gray-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition p-1"
                                                title="Rename Agent"
                                            >
                                                ✎
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => handleDeleteAgent(e, agent.id, agent.name)}
                                            className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition p-1"
                                            title="Delete Agent"
                                        >
                                            ✕
                                        </button>
                                        {selectedAgentId === agent.id && (
                                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                        )}
                                        {agentStates?.[agent.id]?.isProcessing && selectedAgentId !== agent.id && (
                                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Processing..."></span>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {isAdding ? (
                                <div className="flex items-center gap-2 min-w-[200px] bg-gray-50 p-2 rounded-lg border border-gray-200">
                                    <input
                                        type="text"
                                        value={newAgentName}
                                        onChange={(e) => setNewAgentName(e.target.value)}
                                        placeholder="Agent Name"
                                        className="w-full text-sm bg-transparent border-none focus:ring-0 outline-none"
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleCreateAgent();
                                            if (e.key === 'Escape') setIsAdding(false);
                                        }}
                                    />
                                    <button onClick={handleCreateAgent} className="text-green-600 hover:text-green-700">✓</button>
                                    <button onClick={() => setIsAdding(false)} className="text-red-400 hover:text-red-500">✕</button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setIsAdding(true)}
                                    className="flex items-center justify-center p-3 rounded-lg border border-dashed border-gray-300 text-gray-400 hover:text-blue-500 hover:border-blue-300 hover:bg-blue-50 transition min-w-[40px] h-[50px] w-[50px]"
                                    title="Add New Agent"
                                >
                                    +
                                </button>
                            )}
                        </div>
                    )}

                    {activeTab === 'tools' && (
                        <div className="p-4 text-center text-gray-500 italic border border-dashed border-gray-200 rounded-lg min-h-[100px] flex items-center justify-center">
                            Tool calling setup intentionally deferred for this branch.
                        </div>
                    )}

                    {activeTab === 'assets' && (
                        <div className="space-y-4 border border-gray-200 rounded-lg p-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <input value={assetLogicalName} onChange={e => setAssetLogicalName(e.target.value)} placeholder="logical_name" className="rounded border p-2 text-sm" />
                                <input value={assetDisplayName} onChange={e => setAssetDisplayName(e.target.value)} placeholder="Display Name" className="rounded border p-2 text-sm" />
                                <input value={assetDescription} onChange={e => setAssetDescription(e.target.value)} placeholder="Description" className="rounded border p-2 text-sm" />
                            </div>
                            <button onClick={handleCreateAsset} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm">Add Asset Table</button>

                            {!selectedAgentId && (
                                <p className="text-sm text-gray-500">Select an agent to configure read/write/search/prompt permissions.</p>
                            )}

                            <div className="space-y-3">
                                {assets.map(asset => {
                                    const binding = bindings[asset.id] || {
                                        can_read: true,
                                        can_write: false,
                                        can_search: true,
                                        include_in_prompt: false,
                                        prompt_row_limit: 5,
                                    };
                                    return (
                                        <div key={asset.id} className="border rounded p-3 bg-gray-50">
                                            <div className="font-medium text-sm">{asset.display_name} <span className="text-gray-400">({asset.logical_name})</span></div>
                                            {asset.description && <div className="text-xs text-gray-500 mt-1">{asset.description}</div>}
                                            {selectedAgentId && (
                                                <div className="mt-2 flex flex-wrap gap-4 text-xs">
                                                    <label><input type="checkbox" checked={!!binding.can_read} onChange={e => updateBinding(asset.id, 'can_read', e.target.checked)} /> Read</label>
                                                    <label><input type="checkbox" checked={!!binding.can_write} onChange={e => updateBinding(asset.id, 'can_write', e.target.checked)} /> Write</label>
                                                    <label><input type="checkbox" checked={!!binding.can_search} onChange={e => updateBinding(asset.id, 'can_search', e.target.checked)} /> Search</label>
                                                    <label><input type="checkbox" checked={!!binding.include_in_prompt} onChange={e => updateBinding(asset.id, 'include_in_prompt', e.target.checked)} /> Include in prompt</label>
                                                    <label className="flex items-center gap-1">Prompt rows
                                                        <input type="number" min={1} max={25} value={binding.prompt_row_limit || 5} onChange={e => updateBinding(asset.id, 'prompt_row_limit', parseInt(e.target.value || '5'))} className="w-16 rounded border p-1" />
                                                    </label>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {selectedAgentId && (
                                <button onClick={handleSaveBindings} className="px-3 py-1.5 bg-emerald-600 text-white rounded text-sm">Save Agent Asset Permissions</button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
