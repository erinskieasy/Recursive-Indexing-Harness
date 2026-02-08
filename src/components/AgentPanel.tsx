import { useState, useEffect } from 'react';
import { api } from '../services/api';

interface Agent {
    id: number;
    name: string;
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

    // Renaming state
    const [editingAgentId, setEditingAgentId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState('');

    // Tab state
    const [activeTab, setActiveTab] = useState<'agents' | 'tools' | 'assets'>('agents');

    useEffect(() => {
        fetchAgents();
    }, []);

    const fetchAgents = async () => {
        try {
            const data = await api.getAgents();
            setAgents(data);
            // Auto-select first agent if none selected and agents exist
            if (data.length > 0 && !selectedAgentId) {
                onAgentSelect(data[0].id);
            }
        } catch (err) {
            console.error('Failed to fetch agents', err);
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
        e.stopPropagation(); // Prevent selection
        if (!confirm(`Are you sure you want to delete agent "${agentName}"? This will delete ALL associated chunks, rules, and notes.`)) {
            return;
        }

        try {
            await api.deleteAgent(agentId);
            const updatedAgents = agents.filter(a => a.id !== agentId);
            setAgents(updatedAgents);

            if (selectedAgentId === agentId) {
                // If we deleted the active agent, switch to first available or none
                if (updatedAgents.length > 0) {
                    onAgentSelect(updatedAgents[0].id);
                } else {
                    onAgentSelect(0); // or null/handle empty state
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
            // Optimistic update
            setAgents(agents.map(a => a.id === agentId ? { ...a, name: editingName } : a));
            setEditingAgentId(null);

            await api.updateAgent(agentId, { name: editingName });
        } catch (err) {
            console.error('Failed to rename agent', err);
            // Revert on failure? For now just log
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent, agentId: number) => {
        if (e.key === 'Enter') {
            handleRename(agentId);
        } else if (e.key === 'Escape') {
            setEditingAgentId(null);
        }
    };

    return (
        <div className="bg-white border-b border-gray-200 transition-all duration-300">
            {/* Header / Toggle Bar */}
            <div
                className="flex items-center justify-between px-6 py-3 bg-gray-50 border-b border-gray-100 cursor-pointer hover:bg-gray-100 transition"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2">
                    <h2 className="font-scemibold text-gray-700">Recursive Auto-Agents</h2>
                </div>
                <button className="text-gray-400 hover:text-gray-600">
                    {isExpanded ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    )}
                </button>
            </div>

            {/* Content */}
            {isExpanded && (
                <div className="p-4 px-6 overflow-x-auto">

                    {/* Tabs */}
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

                    {/* Tab Content */}
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
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => handleDeleteAgent(e, agent.id, agent.name)}
                                            className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition p-1"
                                            title="Delete Agent"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
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

                            {/* Add New Agent Button */}
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
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="12" y1="5" x2="12" y2="19"></line>
                                        <line x1="5" y1="12" x2="19" y2="12"></line>
                                    </svg>
                                </button>
                            )}

                            {/* Flow Arrow (Visual Candy) */}
                            <div className="text-gray-300">
                                <span className="text-xs italic">→ next</span>
                            </div>
                        </div>
                    )}

                    {activeTab === 'tools' && (
                        <div className="p-4 text-center text-gray-500 italic border border-dashed border-gray-200 rounded-lg min-h-[100px] flex items-center justify-center">
                            Tools Registry Coming Soon...
                        </div>
                    )}

                    {activeTab === 'assets' && (
                        <div className="p-4 text-center text-gray-500 italic border border-dashed border-gray-200 rounded-lg min-h-[100px] flex items-center justify-center">
                            Assets Library Coming Soon...
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
