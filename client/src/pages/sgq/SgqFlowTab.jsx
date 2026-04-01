import React, { useMemo } from 'react';
import { ReactFlow, MiniMap, Controls, Background, MarkerType } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// Usado para auto-layoutar em formato de arvore
import * as d3 from 'd3-hierarchy';

const SgqFlowTab = ({ data, onNodeClick }) => {

    const { nodes, edges } = useMemo(() => {
        if (!data || data.length === 0) return { nodes: [], edges: [] };

        // 1. Agrupar por Categorias
        // A raiz é 'MetalFisa'
        const hierarchyData = {
            id: 'root',
            name: 'MetalFisa Sistema',
            type: 'root',
            children: []
        };

        const categoriesMap = {};
        
        data.forEach(proc => {
            const catName = proc.category || 'Outros';
            if (!categoriesMap[catName]) {
                categoriesMap[catName] = { 
                    id: `cat_${catName}`, 
                    name: catName, 
                    type: 'category', 
                    color: proc.category_color || '#64748b',
                    children: [] 
                };
            }
            categoriesMap[catName].children.push({
                ...proc,
                type: 'process',
                name: proc.title || proc.route_path
            });
        });

        hierarchyData.children = Object.values(categoriesMap);

        // 2. Usar d3-hierarchy pra achar coordenadas automáticas
        const root = d3.hierarchy(hierarchyData);
        // Arvore espaçada. d3.tree mapeia [0..1] x [0..1] por padrão, entao setamos o tamanho do grid.
        // dx e dy sao o passo do nó.
        // Reordenando para layout Horizontal (Esquerda-Direita)
        const treeLayout = d3.tree().nodeSize([100, 350]);
        treeLayout(root);

        const flowNodes = [];
        const flowEdges = [];

        root.each(d => {
            const isRoot = d.data.id === 'root';
            const isCategory = d.data.type === 'category';

            flowNodes.push({
                id: d.data.id ? String(d.data.id) : String(d.data.title),
                type: 'default',
                targetPosition: 'left',
                sourcePosition: 'right',
                position: { x: d.y, y: d.x }, // Layout Horizontal
                data: {
                    label: (
                        <div className="flex flex-col items-center justify-center p-2 text-center" 
                             onClick={() => { if(d.data.type === 'process') onNodeClick(d.data.id) }}>
                            <div className="font-bold text-sm mb-1">{d.data.name}</div>
                            {d.data.type === 'process' && d.data.responsables && d.data.responsables.length > 0 && (
                                <div className="text-[10px] text-emerald-700 bg-emerald-100 rounded px-1 max-w-[150px] truncate">
                                    {d.data.responsables.join(', ')}
                                </div>
                            )}
                            {d.data.type === 'process' && (!d.data.responsables || d.data.responsables.length === 0) && (
                                <div className="text-[10px] text-slate-400 bg-slate-100 rounded px-1">Sem responsável</div>
                            )}
                        </div>
                    )
                },
                style: {
                    width: 180,
                    backgroundColor: isRoot ? '#0f172a' : isCategory ? (d.data.color || '#3b82f6') : '#ffffff',
                    color: isCategory || isRoot ? '#ffffff' : '#0f172a',
                    border: isCategory || isRoot ? 'none' : '2px solid #e2e8f0',
                    borderRadius: isRoot ? '12px' : '8px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    cursor: d.data.type === 'process' ? 'pointer' : 'default',
                    transition: 'all 0.2s'
                }
            });

            if (d.parent) {
                flowEdges.push({
                    id: `e_${d.parent.data.name}_to_${d.data.name}`,
                    source: d.parent.data.id ? String(d.parent.data.id) : String(d.parent.data.title),
                    target: d.data.id ? String(d.data.id) : String(d.data.title),
                    type: 'smoothstep',
                    animated: d.data.type === 'process',
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                        color: '#94a3b8',
                    },
                    style: { stroke: '#cbd5e1', strokeWidth: 2 }
                });
            }
        });

        // Corrigindo IDs
        flowNodes.forEach(n => {
            if(n.id.includes('undefined')) n.id = Math.random().toString();
        });

        return { nodes: flowNodes, edges: flowEdges };
    }, [data, onNodeClick]);

    return (
        <div className="w-full h-full absolute inset-0">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.1}
                nodesConnectable={false}
                nodesDraggable={true}
                elementsSelectable={true}
            >
                <Controls />
                <MiniMap />
                <Background variant="dots" gap={12} size={1} color="#cbd5e1" />
            </ReactFlow>
        </div>
    );
}

export default SgqFlowTab;
