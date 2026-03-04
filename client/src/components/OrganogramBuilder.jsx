import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, User, Archive, Save, ArrowRight, Trash2, Camera, Move, Link as LinkIcon, AlertCircle, Printer } from 'lucide-react';

const OrganogramBuilder = () => {
    // --- State ---
    const [charts, setCharts] = useState(() => {
        const saved = localStorage.getItem('sgq_organograms');
        return saved ? JSON.parse(saved) : [
            {
                id: 1,
                name: 'Organograma Geral',
                nodes: [{ id: 101, x: 300, y: 50, type: 'person', data: { name: 'Diretoria', role: 'Diretor Geral', sector: 'Estratégico' } }],
                connections: []
            }
        ];
    });

    const [activeChartId, setActiveChartId] = useState(1);

    // Inline Editing State
    const [editingChartId, setEditingChartId] = useState(null);
    const [editNameValue, setEditNameValue] = useState('');

    // Persistence Effect
    useEffect(() => {
        localStorage.setItem('sgq_organograms', JSON.stringify(charts));
    }, [charts]);

    // Derived state for current chart
    const activeChart = charts.find(c => c.id === activeChartId) || charts[0];
    const nodes = activeChart.nodes;
    const connections = activeChart.connections;

    const [selectedConnectionId, setSelectedConnectionId] = useState(null);
    const [lineStyle, setLineStyle] = useState('smooth'); // 'straight', 'smooth', 'orthogonal'
    const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const [showChartList, setShowChartList] = useState(true);
    const [selectedNode, setSelectedNode] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [connectionMode, setConnectionMode] = useState(false);
    const [connectSource, setConnectSource] = useState(null);

    const canvasRef = useRef(null);

    // --- Actions ---

    // Chart Management
    const addChart = () => {
        const newChart = {
            id: Date.now(),
            name: `Novo Organograma ${charts.length + 1}`,
            nodes: [],
            connections: []
        };
        setCharts([...charts, newChart]);
        setActiveChartId(newChart.id);
    };

    const deleteChart = (id) => {
        if (charts.length <= 1) return; // Prevent deleting last chart
        setCharts(charts.filter(c => c.id !== id));
        if (activeChartId === id) {
            setActiveChartId(charts[0].id);
        }
    };

    const updateChartName = (id, name) => {
        setCharts(charts.map(c => c.id === id ? { ...c, name } : c));
    };

    // Inline Editing Actions
    const startEditing = (e, chart) => {
        e.stopPropagation();
        setEditingChartId(chart.id);
        setEditNameValue(chart.name);
    };

    const saveEditing = (e) => {
        if (e) e.stopPropagation();
        if (editingChartId) {
            updateChartName(editingChartId, editNameValue);
            setEditingChartId(null);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') saveEditing(e);
    };

    // Node Management
    const setNodes = (newNodesOrFn) => {
        setCharts(prev => prev.map(c => {
            if (c.id === activeChartId) {
                const newNodes = typeof newNodesOrFn === 'function' ? newNodesOrFn(c.nodes) : newNodesOrFn;
                return { ...c, nodes: newNodes };
            }
            return c;
        }));
    };

    const setConnections = (newConns) => {
        setCharts(prev => prev.map(c => c.id === activeChartId ? { ...c, connections: newConns } : c));
    };

    const addNode = (type = 'person') => {
        const offset = nodes.length * 20;
        const newNode = {
            id: Date.now(),
            x: 100 + offset,
            y: 100 + offset,
            type, // 'person' or 'group'
            data: {
                name: type === 'group' ? 'Novo Grupo' : 'Novo Colaborador',
                role: type === 'group' ? 'Sub-organograma' : 'Cargo',
                sector: 'Operacional',
                linkedChartId: '' // For group nodes
            }
        };
        setNodes([...nodes, newNode]);
        setSelectedNode(newNode.id);
    };

    const deleteNode = (id) => {
        const newNodes = nodes.filter(n => n.id !== id);
        const newConns = connections.filter(c => c.from !== id && c.to !== id);

        setCharts(prev => prev.map(c => c.id === activeChartId ? { ...c, nodes: newNodes, connections: newConns } : c));
        setSelectedNode(null);
    };

    // Drag Logic
    const handleDragMove = (e) => {
        if (!isDragging) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left - dragStart.x;
        const y = e.clientY - rect.top - dragStart.y;

        setNodes(prev => prev.map(n =>
            n.id === isDragging ? { ...n, x, y } : n
        ));
    };

    const handleConnect = (id) => {
        if (!connectSource) {
            setConnectSource(id);
        } else {
            if (connectSource !== id) {
                const exists = connections.some(c =>
                    (c.from === connectSource && c.to === id) ||
                    (c.from === id && c.to === connectSource)
                );

                if (!exists) {
                    setConnections([...connections, { id: Date.now(), from: connectSource, to: id }]);
                }
            }
            setConnectSource(null);
            setConnectionMode(false);
        }
    };

    const updateNodeData = (id, key, value) => {
        setNodes(prev => prev.map(n =>
            n.id === id ? { ...n, data: { ...n.data, [key]: value } } : n
        ));
    };

    const deleteConnection = (id) => {
        setConnections(connections.filter(c => c.id !== id));
        if (selectedConnectionId === id) setSelectedConnectionId(null);
    };

    // Zoom and Pan Logic
    const handleWheel = (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            const newScale = Math.min(Math.max(transform.scale * delta, 0.1), 3);
            setTransform(prev => ({ ...prev, scale: newScale }));
        }
    };

    const handleCanvasMouseDown = (e) => {
        if (e.button === 0 && !connectionMode && !isDragging) {
            setIsPanning(true);
            setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
            setSelectedNode(null);
            setSelectedConnectionId(null);
        }
    };

    const handleCanvasMouseMove = (e) => {
        if (isPanning) {
            setTransform(prev => ({
                ...prev,
                x: e.clientX - panStart.x,
                y: e.clientY - panStart.y
            }));
        }
        if (isDragging) {
            handleDragMove(e);
        }
    };

    const handleCanvasMouseUp = () => {
        setIsPanning(false);
        setIsDragging(false);
    };

    // Auto-Layout Algorithm (Hierarchical)
    const autoOrganize = () => {
        if (nodes.length === 0) return;

        const newNodes = [...nodes];
        const visited = new Set();
        const levels = {};

        // 1. Find root nodes (no incoming connections)
        const childNodes = new Set(connections.map(c => c.to));
        const roots = nodes.filter(n => !childNodes.has(n.id));

        // 2. BFS to determine levels
        const queue = roots.map(r => ({ id: r.id, level: 0 }));
        roots.forEach(r => levels[r.id] = 0);

        while (queue.length > 0) {
            const { id, level } = queue.shift();
            visited.add(id);

            const children = connections.filter(c => c.from === id).map(c => c.to);
            children.forEach(childId => {
                if (!visited.has(childId)) {
                    levels[childId] = Math.max(levels[childId] || 0, level + 1);
                    queue.push({ id: childId, level: level + 1 });
                }
            });
        }

        // Handle disconnected nodes if any
        nodes.forEach(n => {
            if (levels[n.id] === undefined) levels[n.id] = 0;
        });

        // 3. Position nodes by level
        const nodesPerLevel = {};
        nodes.forEach(n => {
            const l = levels[n.id];
            if (!nodesPerLevel[l]) nodesPerLevel[l] = [];
            nodesPerLevel[l].push(n.id);
        });

        const levelHeight = 200;
        const nodeWidth = 250;

        Object.keys(nodesPerLevel).forEach(l => {
            const levelNodes = nodesPerLevel[l];
            const startX = -(levelNodes.length * nodeWidth) / 2 + 300;

            levelNodes.forEach((nodeId, idx) => {
                const nodeIdx = newNodes.findIndex(n => n.id === nodeId);
                if (nodeIdx !== -1) {
                    newNodes[nodeIdx] = {
                        ...newNodes[nodeIdx],
                        x: startX + (idx * nodeWidth),
                        y: 50 + (l * levelHeight)
                    };
                }
            });
        });

        setNodes(newNodes);
        setTransform({ x: 0, y: 0, scale: 1 }); // Reset zoom/pan to see result
    };

    // --- Rendering Helpers ---
    const getNodeCenter = (id) => {
        const node = nodes.find(n => n.id === id);
        if (!node) return { x: 0, y: 0 };
        return { x: node.x + 100, y: node.y + 40 };
    };

    const MiniMap = ({ chartId }) => {
        const targetChart = charts.find(c => c.id === Number(chartId));
        if (!targetChart || targetChart.nodes.length === 0) return (
            <div className="text-[10px] text-gray-400 italic text-center mt-2">Vazio</div>
        );

        // Calculate Scale to fit
        const scale = 0.15; // Small preview

        return (
            <div className="absolute top-12 left-0 right-0 h-32 overflow-hidden bg-white/50 pointer-events-none border-t border-indigo-100">
                <div style={{ transform: `scale(${scale})`, transformOrigin: 'top center', width: '100%', height: '100%', position: 'relative' }}>
                    {targetChart.connections.map(conn => {
                        const start = targetChart.nodes.find(n => n.id === conn.from);
                        const end = targetChart.nodes.find(n => n.id === conn.to);
                        if (!start || !end) return null;
                        return (
                            <line
                                key={conn.id}
                                x1={start.x + 100} y1={start.y + 40}
                                x2={end.x + 100} y2={end.y + 40}
                                stroke="#cbd5e1"
                                strokeWidth="8"
                            />
                        )
                    })}
                    {targetChart.nodes.map(n => (
                        <div
                            key={n.id}
                            style={{ left: n.x, top: n.y, width: 200 }}
                            className="absolute bg-white border-2 border-gray-300 rounded-lg p-2 shadow-sm"
                        >
                            <div className="h-full w-full bg-gray-100 rounded"></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const NodeComponent = ({ node }) => (
        <div
            style={{ left: node.x, top: node.y, width: 200, height: node.type === 'group' ? 160 : 'auto' }}
            className={`
                absolute rounded-lg shadow-md border-2 p-3 cursor-move
                flex flex-col gap-1 transition-shadow hover:shadow-lg select-none
                ${selectedNode === node.id ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200'}
                ${connectSource === node.id ? 'ring-4 ring-green-300 border-green-500' : ''}
                ${node.type === 'group' ? 'bg-indigo-50 border-indigo-200' : 'bg-white'}
            `}
            onMouseDown={(e) => {
                e.stopPropagation();
                if (connectionMode) {
                    handleConnect(node.id);
                    return;
                }
                const rect = e.currentTarget.getBoundingClientRect();
                setDragStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                setIsDragging(node.id);
                setSelectedNode(node.id);
            }}
            onClick={(e) => {
                e.stopPropagation();
                if (!isDragging && !connectionMode) setSelectedNode(node.id);
            }}
            onDoubleClick={(e) => {
                e.stopPropagation(); // Explicit stop
                if (node.type === 'group' && node.data.linkedChartId) {
                    const targetId = Number(node.data.linkedChartId);
                    if (targetId && charts.some(c => c.id === targetId)) {
                        setActiveChartId(targetId);
                        setSelectedNode(null); // Deselect on switch
                    }
                }
            }}
        >
            <div className="flex items-start gap-3 z-10 relative">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 border overflow-hidden ${node.type === 'group' ? 'bg-indigo-100 border-indigo-300 text-indigo-600' : 'bg-gray-100 border-gray-200 text-gray-400'}`}>
                    {node.type === 'group' ? <Archive className="h-5 w-5" /> : (
                        node.data.photo ? <img src={node.data.photo} alt="Foto do Membro" className="w-full h-full object-cover" /> : <User className="h-5 w-5" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-800 text-sm truncate">{node.data.name}</div>
                    <div className="text-xs text-blue-600 truncate">{node.data.role}</div>
                </div>
            </div>

            {node.type === 'group' && (
                <>
                    <MiniMap chartId={node.data.linkedChartId} />
                    <div className="absolute bottom-2 left-0 right-0 flex justify-center z-20">
                        <button
                            onMouseDown={(e) => e.stopPropagation()} // Prevent drag start on button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (node.data.linkedChartId) {
                                    const targetId = Number(node.data.linkedChartId);
                                    if (targetId && charts.some(c => c.id === targetId)) {
                                        setActiveChartId(targetId);
                                        setSelectedNode(null);
                                    }
                                }
                            }}
                            className="bg-indigo-600 text-white text-[10px] px-3 py-1 rounded-full shadow hover:bg-indigo-700 active:scale-95 transition-all font-bold flex items-center gap-1 cursor-pointer"
                        >
                            <ArrowRight className="h-3 w-3" />
                            ABRIR
                        </button>
                    </div>
                </>
            )}

            {/* Handles */}
            <div className={`absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-blue-400 rounded-full opacity-0 ${connectionMode ? 'opacity-100' : ''}`}></div>
            <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-blue-400 rounded-full opacity-0 ${connectionMode ? 'opacity-100' : ''}`}></div>
        </div>
    );

    return (
        <div className="flex h-[calc(100vh-200px)] bg-gray-100 rounded-xl overflow-hidden border border-gray-300">
            {/* Left Sidebar - Charts List */}
            <div className={`bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ${showChartList ? 'w-64' : 'w-0 overflow-hidden'}`}>
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-700 text-sm">Organogramas</h3>
                    <button onClick={addChart} className="p-1 hover:bg-blue-100 text-blue-600 rounded">
                        <Plus className="h-4 w-4" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {charts.map(chart => (
                        <div
                            key={chart.id}
                            onClick={() => setActiveChartId(chart.id)}
                            className={`p-3 rounded-lg cursor-pointer flex items-center justify-between group ${activeChartId === chart.id ? 'bg-blue-50 border border-blue-200 shadow-sm' : 'hover:bg-gray-50 border border-transparent'}`}
                        >
                            {editingChartId === chart.id ? (
                                <div className="flex items-center gap-2 w-full">
                                    <input
                                        value={editNameValue}
                                        onChange={(e) => setEditNameValue(e.target.value)}
                                        onBlur={saveEditing}
                                        onKeyDown={handleKeyDown}
                                        autoFocus
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-full text-sm p-1 border border-blue-300 rounded focus:ring-2 focus:ring-blue-200 outline-none"
                                    />
                                </div>
                            ) : (
                                <>
                                    <span className={`text-sm font-medium truncate flex-1 ${activeChartId === chart.id ? 'text-blue-800' : 'text-gray-600'}`}>
                                        {chart.name}
                                    </span>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => startEditing(e, chart)}
                                            className="p-1 text-gray-400 hover:text-blue-500 rounded hover:bg-blue-50"
                                            title="Renomear"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                                        </button>
                                        {charts.length > 1 && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); deleteChart(chart.id); }}
                                                className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-red-50"
                                                title="Excluir"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </button>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col relative">
                {/* Toolbar */}
                <div className="bg-white border-b border-gray-200 p-3 flex items-center justify-between z-20">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setShowChartList(!showChartList)} className="mr-2 text-gray-500 hover:bg-gray-100 p-1 rounded">
                            <Move className="h-4 w-4 rotate-90" />
                        </button>

                        <div className="flex flex-col">
                            <input
                                value={activeChart.name}
                                onChange={(e) => updateChartName(activeChart.id, e.target.value)}
                                className="font-bold text-gray-800 text-sm border-none focus:ring-0 p-0 m-0 w-40 bg-transparent"
                            />
                            <span className="text-[10px] text-gray-400 truncate">Clique para renomear</span>
                        </div>

                        <div className="h-6 w-px bg-gray-200 mx-1"></div>

                        <button onClick={() => addNode('person')} className="flex items-center gap-1.5 px-2 py-1.5 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 text-[13px] font-medium">
                            <Plus className="h-4 w-4" /> Pessoa
                        </button>
                        <button onClick={() => addNode('group')} className="flex items-center gap-1.5 px-2 py-1.5 bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100 text-[13px] font-medium">
                            <Archive className="h-4 w-4" /> Grupo
                        </button>

                        <div className="h-6 w-px bg-gray-200 mx-1"></div>

                        <button
                            onClick={() => { setConnectionMode(!connectionMode); setConnectSource(null); }}
                            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-colors text-[13px] font-medium ${connectionMode ? 'bg-green-100 text-green-700 ring-2' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
                        >
                            <LinkIcon className="h-4 w-4" />
                            {connectionMode ? 'Ligar...' : 'Ligar'}
                        </button>

                        <div className="h-6 w-px bg-gray-200 mx-1"></div>

                        <select
                            value={lineStyle}
                            onChange={(e) => setLineStyle(e.target.value)}
                            className="text-[12px] bg-gray-50 border-gray-200 rounded px-2 py-1.5 outline-none font-medium text-gray-600"
                        >
                            <option value="straight">Linha Reta</option>
                            <option value="smooth">Linha Curva</option>
                            <option value="orthogonal">Ortogonal</option>
                        </select>

                        <button
                            onClick={autoOrganize}
                            className="bg-indigo-50 text-indigo-700 px-2 py-1.5 rounded-md hover:bg-indigo-100 text-[13px] font-medium flex items-center gap-1.5"
                            title="Organizar Automaticamente"
                        >
                            <Move className="h-4 w-4" /> Arrumar
                        </button>

                        <div className="h-6 w-px bg-gray-200 mx-1"></div>

                        {(selectedNode || selectedConnectionId) && (
                            <button onClick={() => {
                                if (selectedNode) deleteNode(selectedNode);
                                else if (selectedConnectionId) deleteConnection(selectedConnectionId);
                            }} className="px-2 py-1.5 bg-red-50 text-red-700 rounded-md hover:bg-red-100 text-[13px] font-medium">
                                <Trash2 className="h-4 w-4" />
                            </button>
                        )}

                        <div className="h-6 w-px bg-gray-200 mx-1"></div>

                        <button
                            onClick={() => window.print()}
                            className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="Imprimir"
                        >
                            <Printer className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <style>{`
                    @media print {
                        @page { size: landscape; margin: 10mm; }
                        body * { visibility: hidden; }
                        
                        /* Container Visibility */
                        #organogram-print-container, 
                        #organogram-print-container * {
                             visibility: visible;
                        }
                        
                        /* Page Reset */
                        #organogram-print-container {
                            position: fixed !important;
                            top: 0 !important;
                            left: 0 !important;
                            width: 100vw !important;
                            height: 100vh !important;
                            background: white !important;
                            z-index: 9999;
                            display: flex !important;
                            flex-direction: column !important;
                        }

                        /* Header Styles */
                        .technical-header {
                            display: flex !important;
                            width: 100% !important;
                            border: 2px solid black !important;
                            margin-bottom: 20px !important;
                        }
                        .th-logo { width: 150px; border-right: 2px solid black; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 24px; background: #f3f4f6; }
                        .th-title { flex: 1; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 20px; text-transform: uppercase; }
                        .th-info { width: 120px; border-left: 2px solid black; display: flex; flex-direction: column; }
                        .th-info div { flex: 1; border-bottom: 1px solid black; display: flex; align-items: center; justify-content: center; font-size: 12px; font-family: monospace; }
                        .th-info div:last-child { border-bottom: none; }

                        /* Canvas Centering */
                        .print-canvas-wrapper {
                            flex: 1 !important;
                            position: relative !important;
                            border: 1px solid #ccc !important;
                            border-radius: 8px !important;
                            overflow: hidden !important;
                            display: flex !important;
                            align-items: center !important;
                            justify-content: center !important;
                        }
                        
                        /* Hide everything else */
                        .fixed, .sticky, button { display: none !important; }
                    }
                `}</style>

                {/* Print Container Wrapper (Invisible on screen, visible on print) */}
                <div id="organogram-print-container" className="hidden print:flex flex-col h-full w-full">
                    <div className="technical-header">
                        <div className="th-logo">METALFISA</div>
                        <div className="th-title">ORGANOGRAMA: {activeChart.name}</div>
                        <div className="th-info">
                            <div>{new Date().toLocaleDateString()}</div>
                            <div>REV: 01</div>
                        </div>
                    </div>

                    {/* Centering Logic */}
                    <div className="print-canvas-wrapper relative w-full h-full bg-white flex items-center justify-center p-4">
                        {(() => {
                            // 1. Calculate Bounds
                            if (nodes.length === 0) return <div>Vazio</div>;

                            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                            nodes.forEach(n => {
                                const nW = 200; // Fixed width
                                const nH = n.type === 'group' ? 160 : 100; // Approx height
                                if (n.x < minX) minX = n.x;
                                if (n.y < minY) minY = n.y;
                                if (n.x + nW > maxX) maxX = n.x + nW;
                                if (n.y + nH > maxY) maxY = n.y + nH;
                            });

                            const contentWidth = maxX - minX;
                            const contentHeight = maxY - minY;

                            // 2. Render Shifted Content in a Relative Container - PREVENTING MINI MAP IN PRINT
                            return (
                                <div style={{ position: 'relative', width: contentWidth, height: contentHeight }}>
                                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible">
                                        {connections.map(conn => {
                                            const startNode = nodes.find(n => n.id === conn.from);
                                            const endNode = nodes.find(n => n.id === conn.to);
                                            if (!startNode || !endNode) return null;

                                            // Shift coordinates
                                            const x1 = (startNode.x - minX) + 100; // Center of node
                                            const y1 = (startNode.y - minY) + 40;
                                            const x2 = (endNode.x - minX) + 100;
                                            const y2 = (endNode.y - minY) + 40;

                                            return <line key={conn.id} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#000" strokeWidth="2" />;
                                        })}
                                    </svg>
                                    {nodes.map(node => (
                                        <div
                                            key={node.id}
                                            style={{
                                                left: node.x - minX,
                                                top: node.y - minY,
                                                width: 200,
                                                height: node.type === 'group' ? 160 : 'auto',
                                                position: 'absolute'
                                            }}
                                            className={`border-2 border-black p-3 bg-white rounded-lg shadow-none`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-bold text-black text-sm truncate">{node.data.name}</div>
                                                    <div className="text-xs text-black truncate">{node.data.role}</div>
                                                </div>
                                            </div>
                                            {node.type === 'group' && (
                                                <div className="mt-2 h-20 border border-gray-300 rounded bg-gray-50 flex items-center justify-center text-[10px] text-gray-500 uppercase">
                                                    (Sub-Organograma)
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
                    </div>
                </div>

                {/* Canvas */}
                <div
                    ref={canvasRef}
                    data-print-title={activeChart.name}
                    className="flex-1 relative overflow-hidden bg-slate-50 cursor-grab active:cursor-grabbing select-none"
                    onWheel={handleWheel}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onMouseLeave={handleCanvasMouseUp}
                >
                    <div
                        style={{
                            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                            transformOrigin: '0 0',
                            transition: isPanning || isDragging ? 'none' : 'transform 0.1s ease-out'
                        }}
                        className="absolute inset-0"
                    >
                        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible">
                            <defs>
                                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orientation="auto">
                                    <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
                                </marker>
                            </defs>
                            {connections.map(conn => {
                                const start = getNodeCenter(conn.from);
                                const end = getNodeCenter(conn.to);
                                if (!start || !end) return null;

                                let d = "";
                                if (lineStyle === 'smooth') {
                                    const midY = (start.y + end.y) / 2;
                                    d = `M ${start.x} ${start.y} C ${start.x} ${midY}, ${end.x} ${midY}, ${end.x} ${end.y}`;
                                } else if (lineStyle === 'orthogonal') {
                                    const midY = (start.y + end.y) / 2;
                                    d = `M ${start.x} ${start.y} L ${start.x} ${midY} L ${end.x} ${midY} L ${end.x} ${end.y}`;
                                } else {
                                    d = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
                                }

                                return (
                                    <g key={conn.id} className="pointer-events-auto cursor-pointer group">
                                        <path
                                            d={d}
                                            stroke="transparent"
                                            strokeWidth="12"
                                            fill="none"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedConnectionId(conn.id);
                                                setSelectedNode(null);
                                            }}
                                        />
                                        <path
                                            d={d}
                                            stroke={selectedConnectionId === conn.id ? "#3b82f6" : "#94a3b8"}
                                            strokeWidth={selectedConnectionId === conn.id ? "3" : "2"}
                                            fill="none"
                                            className="transition-colors group-hover:stroke-blue-400"
                                            markerEnd="url(#arrowhead)"
                                        />
                                    </g>
                                );
                            })}
                        </svg>
                        <div className="absolute inset-0 z-0 pointer-events-none" style={{
                            backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
                            backgroundSize: '20px 20px',
                            width: '5000px',
                            height: '5000px',
                            opacity: 0.5
                        }}></div>
                        {nodes.map(node => <NodeComponent key={node.id} node={node} />)}
                    </div>

                    {/* Zoom / Reset Controls */}
                    <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-20">
                        <div className="bg-white/80 backdrop-blur shadow-lg border border-gray-200 rounded-lg p-1 flex flex-col">
                            <button onClick={() => setTransform(prev => ({ ...prev, scale: Math.min(prev.scale + 0.1, 3) }))} className="p-2 hover:bg-gray-100 text-gray-600 rounded">
                                <Plus className="h-4 w-4" />
                            </button>
                            <div className="h-px bg-gray-200 mx-1"></div>
                            <button onClick={() => setTransform(prev => ({ ...prev, scale: Math.max(prev.scale - 0.1, 0.1) }))} className="p-2 hover:bg-gray-100 text-gray-600 rounded">
                                <Plus className="h-4 w-4 rotate-45" />
                            </button>
                        </div>
                        <button
                            onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}
                            className="bg-white/80 backdrop-blur shadow-lg border border-gray-200 rounded-lg p-2 hover:bg-gray-100 text-gray-600 font-bold text-xs"
                        >
                            RESET
                        </button>
                    </div>
                </div>
            </div>

            {/* Right Sidebar - Properties */}
            {(selectedNode || selectedConnectionId) && (
                <div className="w-80 bg-white border-l border-gray-200 p-6 overflow-y-auto z-30 shadow-2xl animate-in slide-in-from-right duration-200">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            {selectedNode ? 'Detalhes do Nó' : 'Detalhes da Conexão'}
                        </h3>
                        <button onClick={() => { setSelectedNode(null); setSelectedConnectionId(null); }}><X className="h-5 w-5 text-gray-400" /></button>
                    </div>

                    {selectedNode ? (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Nome</label>
                                <input
                                    value={nodes.find(n => n.id === selectedNode)?.data.name || ''}
                                    onChange={(e) => updateNodeData(selectedNode, 'name', e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-md text-sm outline-none focus:border-blue-500 shadow-sm"
                                />
                            </div>

                            {nodes.find(n => n.id === selectedNode)?.type === 'group' ? (
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Vincular ao Organograma</label>
                                    <select
                                        value={nodes.find(n => n.id === selectedNode)?.data.linkedChartId || ''}
                                        onChange={(e) => updateNodeData(selectedNode, 'linkedChartId', e.target.value)}
                                        className="w-full p-2 border border-blue-300 rounded-md text-sm outline-none focus:border-blue-500 shadow-sm"
                                    >
                                        <option value="">Selecione um organograma...</option>
                                        {charts.filter(c => c.id !== activeChartId).map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-indigo-500 mt-2 font-medium">Dica: Clique duplo no nó para navegar até este organograma.</p>
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Cargo</label>
                                        <input
                                            value={nodes.find(n => n.id === selectedNode)?.data.role || ''}
                                            onChange={(e) => updateNodeData(selectedNode, 'role', e.target.value)}
                                            className="w-full p-2 border border-gray-300 rounded-md text-sm outline-none focus:border-blue-500 shadow-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Setor</label>
                                        <select
                                            value={nodes.find(n => n.id === selectedNode)?.data.sector || ''}
                                            onChange={(e) => updateNodeData(selectedNode, 'sector', e.target.value)}
                                            className="w-full p-2 border border-gray-300 rounded-md text-sm outline-none focus:border-blue-500 shadow-sm"
                                        >
                                            <option value="Estratégico">Estratégico</option>
                                            <option value="Tático">Tático</option>
                                            <option value="Operacional">Operacional</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Foto URL</label>
                                        <input
                                            value={nodes.find(n => n.id === selectedNode)?.data.photo || ''}
                                            onChange={(e) => updateNodeData(selectedNode, 'photo', e.target.value)}
                                            className="w-full p-2 border border-gray-300 rounded-md text-sm outline-none focus:border-blue-500 shadow-sm"
                                        />
                                    </div>
                                </>
                            )}
                            <div className="pt-4">
                                <button
                                    onClick={() => deleteNode(selectedNode)}
                                    className="w-full py-2 bg-red-50 text-red-700 rounded-md hover:bg-red-100 text-sm font-bold border border-red-200 flex items-center justify-center gap-2"
                                >
                                    <Trash2 className="h-4 w-4" /> EXCLUIR NÓ
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                                <p className="text-sm text-blue-800 font-medium">Conexão selecionada</p>
                                <p className="text-xs text-blue-600 mt-1">Conecta "{(nodes.find(n => n.id === (connections.find(c => c.id === selectedConnectionId)?.from))?.data.name)}" a "{(nodes.find(n => n.id === (connections.find(c => c.id === selectedConnectionId)?.to))?.data.name)}"</p>
                            </div>

                            <button
                                onClick={() => deleteConnection(selectedConnectionId)}
                                className="w-full py-2 bg-red-50 text-red-700 rounded-md hover:bg-red-100 text-sm font-bold border border-red-200 flex items-center justify-center gap-2"
                            >
                                <Trash2 className="h-4 w-4" /> EXCLUIR CONEXÃO
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default OrganogramBuilder;
