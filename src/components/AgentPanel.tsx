import { useState, useEffect } from 'react';
import { api } from '../services/api';

interface Agent {
    id: number;
    name: string;
}

interface AgentPanelProps {
    onAgentSelect: (agentId: number) => void;
    selectedAgentId: number | null;
}

export default function AgentPanel({ onAgentSelect, selectedAgentId }: AgentPanelProps) {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [isExpanded, setIsExpanded] = useState(true);
    const [newAgentName, setNewAgentName] = useState('');
    const [isAdding, setIsAdding] = useState(false);

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

    return (
        <div className="bg-white border-b border-gray-200 transition-all duration-300">
            {/* Header / Toggle Bar */}
            <div
                className="flex items-center justify-between px-6 py-3 bg-gray-50 border-b border-gray-100 cursor-pointer hover:bg-gray-100 transition"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2">
                    <span className="text-gray-500">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                    </span>
                    <h2 className="font-semibold text-gray-700">Recursive Auto-Agents</h2>
                    <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">{agents.length}</span>
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
                    <div className="flex items-center gap-4">
                        {agents.map(agent => (
                            <div
                                key={agent.id}
                                onClick={() => onAgentSelect(agent.id)}
                                className={`
                                    relative flex items-center justify-between min-w-[150px] p-3 rounded-lg border cursor-pointer transition select-none
                                    ${selectedAgentId === agent.id
                                        ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-100 shadow-sm'
                                        : 'bg-white border-gray-200 hover:border-blue-200 hover:shadow-sm'}
                                `}
                            >
                                <span className={`font-medium ${selectedAgentId === agent.id ? 'text-blue-700' : 'text-gray-700'}`}>
                                    {agent.name}
                                </span>
                                {selectedAgentId === agent.id && (
                                    <span className="w-2 h-2 rounded-full bg-blue-500 ml-2"></span>
                                )}
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
                </div>
            )}
        </div>
    );
}
