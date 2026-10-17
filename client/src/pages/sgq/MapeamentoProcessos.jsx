import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Layers, GitCommit, Search, RefreshCw, Loader2 } from 'lucide-react';
import SgqFlowTab from './SgqFlowTab';
import SgqOrganogramTab from './SgqOrganogramTab';
import SgqProcessModal from './SgqProcessModal';

export default function MapeamentoProcessos() {
    const [processos, setProcessos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('flow'); 
    
    // Modal State
    const [selectedProcess, setSelectedProcess] = useState(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('@Lynx:token');
            const res = await axios.get('/api/sgq/processos', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProcessos(res.data);
        } catch (err) {
            console.error(err);
            toast.error('Erro ao carregar Mapeamento SGQ');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleNodeClick = (processOrId) => {
        // processOrId can be the full object or just the ID.
        if (typeof processOrId === 'object') {
            setSelectedProcess(processOrId);
        } else {
            const proc = processos.find(p => p.id === processOrId);
            if (proc) setSelectedProcess(proc);
        }
    };

    const handleSaveProcess = async (updatedData) => {
        try {
             const token = localStorage.getItem('@Lynx:token');
             await axios.put(`/api/sgq/processos/${selectedProcess.id}`, updatedData, {
                 headers: { Authorization: `Bearer ${token}` }
             });
             toast.success('Processo atualizado com sucesso!');
             setSelectedProcess(null);
             loadData(); // refresh tree
        } catch(e) {
             toast.error('Erro ao salvar processo.');
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-6rem)] bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex flex-shrink-0 items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
                <div>
                     <h2 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
                          <Layers className="h-6 w-6 text-blue-600" />
                          Mapeamento de Processos (SGQ)
                     </h2>
                     <p className="text-sm text-slate-500 mt-1">
                          Organograma dinâmico de todos os Módulos do Sistema ERP/PCP.
                     </p>
                </div>
                <div className="flex items-center gap-3">
                     <button
                         onClick={loadData}
                         className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                         title="Recarregar Árvore"
                     >
                         <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                     </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-slate-200 flex gap-1 bg-white px-2">
                 <button
                     onClick={() => setActiveTab('flow')}
                     className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'flow' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                 >
                     <GitCommit className="h-4 w-4" />
                     Aba A: Mapa Mental Interativo (ReactFlow)
                 </button>
                 <button
                     onClick={() => setActiveTab('css')}
                     className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'css' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                 >
                     <Layers className="h-4 w-4" />
                     Aba B: Organograma Nativo
                 </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 relative bg-slate-50 overflow-hidden">
                {loading && processos.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    </div>
                ) : null}

                {!loading && activeTab === 'flow' && <SgqFlowTab data={processos} onNodeClick={handleNodeClick} />}
                {!loading && activeTab === 'css' && <SgqOrganogramTab data={processos} onNodeClick={handleNodeClick} />}
            </div>

            {/* Edicao SGQ Modal */}
            {selectedProcess && (
                <SgqProcessModal 
                    process={selectedProcess} 
                    onClose={() => setSelectedProcess(null)} 
                    onSave={handleSaveProcess} 
                />
            )}
        </div>
    );
}
