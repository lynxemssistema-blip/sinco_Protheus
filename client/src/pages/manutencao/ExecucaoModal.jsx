import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Pause, History, Search, Plus, Package, Trash2, Image as ImageIcon, AlertCircle, CheckCircle2, Printer, HelpCircle, Clock } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import OrdemManutencaoPrint from '../../components/OrdemManutencaoPrint';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useHelp } from '../../contexts/HelpContext';

export default function ExecucaoModal({ isOpen, onClose, ordem, tecnicos, onSave }) {
    const { user, hasPermission } = useAuth();
    const canViewValues = hasPermission('valores_financeiros', 'view');
    const { openHelp } = useHelp();
    const [activeTab, setActiveTab] = useState('execucao'); // 'execucao', 'materiais', 'historico'
    const [loading, setLoading] = useState(false);
    const printRef = useRef();

    // Ajuda e Cronometro
    const [timeElapsed, setTimeElapsed] = useState(0); // in seconds
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const timerRef = useRef(null);

    // Stop timer on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const formatTime = (totalSeconds) => {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleToggleTimer = () => {
        if (isTimerRunning) {
            setIsTimerRunning(false);
            if (timerRef.current) clearInterval(timerRef.current);
        } else {
            setIsTimerRunning(true);
            timerRef.current = setInterval(() => {
                setTimeElapsed(prev => prev + 1);
            }, 1000);
        }
    };

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Ordem_Manutencao_${ordem?.id}`,
    });
    
    // Execução State
    const [execucaoFormData, setExecucaoFormData] = useState({
        tecnicos_execucao: [],
        atividades_realizadas: '',
        fotos_execucao: [],
        resolvido: true
    });

    // Material State
    const [materiais, setMateriais] = useState([]);
    const [searchCode, setSearchCode] = useState('');
    const [searchDesc, setSearchDesc] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [showNewItemForm, setShowNewItemForm] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null); // Para material do Protheus selecionado
    const [newItem, setNewItem] = useState({ descricao: '', quantidade: '', unidade: 'UN', observacao: '', foto: null });

    // Histórico State
    const [historico, setHistorico] = useState([]);

    useEffect(() => {
        if (!isOpen || !ordem) return;
        
        // Reset state
        setActiveTab('execucao');
        setExecucaoFormData({
            tecnicos_execucao: ordem.tecnicos_execucao ? (typeof ordem.tecnicos_execucao === 'string' ? JSON.parse(ordem.tecnicos_execucao) : ordem.tecnicos_execucao) : [],
            atividades_realizadas: ordem.atividades_realizadas || '',
            fotos_execucao: ordem.fotos_execucao ? (typeof ordem.fotos_execucao === 'string' ? JSON.parse(ordem.fotos_execucao) : ordem.fotos_execucao) : [],
            resolvido: ordem.resolvido !== undefined ? (ordem.resolvido === 1 || ordem.resolvido === true) : true
        });

        loadMateriais();
        loadHistorico();
    }, [isOpen, ordem]);

    const loadMateriais = async () => {
        try {
            const res = await api.get(`/manutencao/ordens/${ordem.id}/materiais`);
            setMateriais(res.data);
        } catch (e) {
            console.error(e);
        }
    };

    const loadHistorico = async () => {
        try {
            const res = await api.get(`/manutencao/ordens/${ordem.id}/historico`);
            setHistorico(res.data);
        } catch (e) {
            console.error(e);
        }
    };

    // ----- EXECUÇÃO LOGIC -----
    const compressImage = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const max_size = 1024;
                    if (width > height) {
                        if (width > max_size) {
                            height *= max_size / width;
                            width = max_size;
                        }
                    } else {
                        if (height > max_size) {
                            width *= max_size / height;
                            height = max_size;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.7));
                };
            };
            reader.onerror = error => reject(error);
        });
    };

    const handleFileUploadExecucao = async (e) => {
        const files = Array.from(e.target.files);
        for (const file of files) {
            const compressed = await compressImage(file);
            setExecucaoFormData(prev => ({
                ...prev,
                fotos_execucao: [...prev.fotos_execucao, compressed]
            }));
        }
    };

    const handleToggleTecnico = (tecnicoId) => {
        setExecucaoFormData(prev => {
            const current = [...prev.tecnicos_execucao];
            if (current.includes(tecnicoId)) {
                return { ...prev, tecnicos_execucao: current.filter(id => id !== tecnicoId) };
            } else {
                return { ...prev, tecnicos_execucao: [...current, tecnicoId] };
            }
        });
    };

    const handleSaveExecucao = async (e) => {
        e.preventDefault();
        if (execucaoFormData.tecnicos_execucao.length === 0 || !execucaoFormData.atividades_realizadas) {
            alert("Preencha ao menos um técnico e as atividades realizadas.");
            return;
        }

        setLoading(true);
        try {
            await api.put(`/manutencao/ordens/${ordem.id}/executar`, {
                ...execucaoFormData,
                tempo_execucao_segundos: timeElapsed,
                usuario_id: user?.idUsuario,
                usuario_nome: user?.NomeCompleto || user?.nome
            });
            onSave();
            onClose();
        } catch (err) {
            alert("Erro ao salvar execução.");
        } finally {
            setLoading(false);
        }
    };

    const getFotosArray = (fotosRaw) => {
        if (!fotosRaw) return [];
        if (Array.isArray(fotosRaw)) return fotosRaw;
        try {
            return JSON.parse(fotosRaw);
        } catch (e) {
            return [];
        }
    };

    // ----- MATERIAIS LOGIC -----
    const handleSearchMaterials = async () => {
        if (!searchCode.trim() && !searchDesc.trim()) return;
        setSearching(true);
        try {
            let url = `/produtos?limit=20`;
            if (searchCode.trim()) url += `&code=${searchCode.trim()}`;
            if (searchDesc.trim()) url += `&search=${searchDesc.trim()}`;
            const res = await api.get(url);
            setSearchResults(res.data.data || []);
            setSelectedProduct(null); // reset selected
        } catch (e) {
            console.error(e);
        } finally {
            setSearching(false);
        }
    };

    const handleAddMaterialClick = (prod) => {
        setSelectedProduct(prod);
        setNewItem({ 
            codigo: prod.codigo, 
            descricao: prod.descricao, 
            quantidade: '', 
            unidade: prod.unidade || 'UN', 
            observacao: '', 
            foto: null,
            custo_unitario: prod.custo_padrao || 0
        });
    };
        
    const confirmAddProtheusMaterial = async () => {
        if (!newItem.quantidade) {
            alert("Preencha a quantidade.");
            return;
        }
        await saveMaterialRequest(newItem.codigo, newItem.descricao, newItem.quantidade, newItem.unidade, false, newItem.foto, newItem.observacao, newItem.custo_unitario);
        setSelectedProduct(null);
        setNewItem({ descricao: '', quantidade: '', unidade: 'UN', observacao: '', foto: null, custo_unitario: 0 });
    };

    const handleNewItemImageUpload = async (e) => {
        if (e.target.files && e.target.files[0]) {
            const compressed = await compressImage(e.target.files[0]);
            setNewItem({...newItem, foto: compressed});
        }
    };

    const addCustomMaterial = async () => {
        if (!newItem.descricao || !newItem.quantidade) {
            alert("Preencha descrição e quantidade.");
            return;
        }
        await saveMaterialRequest(null, newItem.descricao, newItem.quantidade, newItem.unidade, true, newItem.foto, newItem.observacao, newItem.custo_unitario);
        setNewItem({ descricao: '', quantidade: '', unidade: 'UN', observacao: '', foto: null, custo_unitario: 0 });
        setShowNewItemForm(false);
    };

    const saveMaterialRequest = async (codigo, descricao, quantidade, unidade, is_novo, foto, observacao, custo_unitario) => {
        try {
            await api.post(`/manutencao/ordens/${ordem.id}/materiais`, {
                codigo, descricao, quantidade, unidade, is_novo, foto, observacao, custo_unitario,
                usuario_id: user?.idUsuario,
                usuario_nome: user?.NomeCompleto || user?.nome
            });
            loadMateriais();
            loadHistorico();
            alert("Material adicionado com sucesso!");
        } catch (e) {
            alert("Erro ao adicionar material.");
        }
    };

    const handleDeleteMaterial = async (matId) => {
        if (!window.confirm("Remover este material?")) return;
        try {
            await api.delete(`/manutencao/ordens/${ordem.id}/materiais/${matId}?usuario_id=${user?.idUsuario}&usuario_nome=${user?.NomeCompleto || user?.nome}`);
            loadMateriais();
            loadHistorico();
        } catch (e) {
            alert("Erro ao remover material.");
        }
    };

    if (!isOpen || !ordem) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl flex flex-col h-[90vh]">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-indigo-600">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Play size={20} /> Painel da Ordem #{ordem.id.toString().padStart(4, '0')}
                        </h2>
                        <p className="text-indigo-100 text-sm mt-0.5">{ordem.maquina_nome}</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => openHelp('/manutencao/execucao-modal')} className="bg-indigo-700 hover:bg-indigo-800 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors shadow">
                            <HelpCircle size={16} /> Ajuda
                        </button>
                        <button onClick={handlePrint} className="bg-indigo-700 hover:bg-indigo-800 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors shadow">
                            <Printer size={16} /> Imprimir / PDF
                        </button>
                        <button onClick={onClose} className="text-indigo-100 hover:text-white p-1 ml-2">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Print Component (Hidden) */}
                <div style={{ display: 'none' }}>
                    <OrdemManutencaoPrint
                        ref={printRef}
                        ordem={ordem}
                        materiais={materiais}
                        historico={historico}
                        user={user}
                        canViewValues={canViewValues}
                    />
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 bg-slate-50 overflow-x-auto">
                    <button 
                        onClick={() => setActiveTab('execucao')}
                        className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 whitespace-nowrap ${activeTab === 'execucao' ? 'border-indigo-600 text-indigo-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
                    >
                        <Play className="inline-block w-4 h-4 mr-2" /> Execução
                    </button>
                    <button 
                        onClick={() => setActiveTab('materiais')}
                        className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 whitespace-nowrap ${activeTab === 'materiais' ? 'border-indigo-600 text-indigo-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
                    >
                        <Package className="inline-block w-4 h-4 mr-2" /> Solicitação de Materiais
                    </button>
                    <button 
                        onClick={() => setActiveTab('historico')}
                        className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 whitespace-nowrap ${activeTab === 'historico' ? 'border-indigo-600 text-indigo-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
                    >
                        <History className="inline-block w-4 h-4 mr-2" /> Histórico
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-auto bg-slate-50 p-6">
                    
                    {/* TAB: EXECUCAO */}
                    {activeTab === 'execucao' && (
                        <form id="execucao-form" onSubmit={handleSaveExecucao} className="space-y-6">
                            
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                                <div>
                                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                                        <Clock size={18} className="text-indigo-600" /> Cronômetro de Execução
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-1">Meça o tempo exato de reparo da máquina</p>
                                </div>
                                <div className="flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-lg border border-slate-200">
                                    <div className="text-3xl font-mono font-bold text-slate-700 tabular-nums">
                                        {formatTime(timeElapsed)}
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={handleToggleTimer}
                                        className={`p-3 rounded-full shadow-sm text-white transition-all hover:scale-105 active:scale-95 ${isTimerRunning ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}
                                        title={isTimerRunning ? "Pausar" : "Iniciar"}
                                    >
                                        {isTimerRunning ? <Pause size={20} /> : <Play size={20} />}
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                    <AlertCircle size={18} className="text-indigo-600" /> Detalhes da Solicitação
                                </h3>
                                
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                    <div>
                                        <span className="block text-xs font-bold text-slate-500 mb-1">Status</span>
                                        <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-1 rounded border border-indigo-100">{ordem.status}</span>
                                    </div>
                                    <div>
                                        <span className="block text-xs font-bold text-slate-500 mb-1">Prioridade</span>
                                        <span className="text-sm font-semibold">{ordem.prioridade}</span>
                                    </div>
                                    <div>
                                        <span className="block text-xs font-bold text-slate-500 mb-1">Tipo</span>
                                        <span className="text-sm font-semibold">{ordem.tipo_manutencao}</span>
                                    </div>
                                    <div>
                                        <span className="block text-xs font-bold text-slate-500 mb-1">Abertura</span>
                                        <span className="text-sm font-semibold">{new Date(ordem.data_abertura).toLocaleString('pt-BR')}</span>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <span className="block text-xs font-bold text-slate-500 mb-1">Descrição do Problema</span>
                                    <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                        {ordem.descricao_problema}
                                    </p>
                                </div>

                                {getFotosArray(ordem.fotos).length > 0 && (
                                    <div className="mt-4">
                                        <span className="block text-xs font-bold text-slate-500 mb-2">Fotos Anexadas (Evidências Iniciais)</span>
                                        <div className="flex gap-3 overflow-x-auto pb-2">
                                            {getFotosArray(ordem.fotos).map((f, i) => (
                                                <a key={i} href={f.data || f} target="_blank" rel="noreferrer" className="shrink-0 group relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 shadow-sm block">
                                                    <img src={f.data || f} alt="Evidência" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                <label className="block font-semibold text-slate-800 mb-3">Técnicos Executores *</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                    {tecnicos.map(t => (
                                        <label key={t.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${execucaoFormData.tecnicos_execucao.includes(t.id) ? 'border-indigo-600 bg-indigo-50 text-indigo-800 shadow-sm' : 'border-slate-200 hover:bg-slate-50'}`}>
                                            <input 
                                                type="checkbox" 
                                                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                                checked={execucaoFormData.tecnicos_execucao.includes(t.id)}
                                                onChange={() => handleToggleTecnico(t.id)}
                                            />
                                            {t.fotoUsuario ? (
                                                <img src={t.fotoUsuario} alt={t.NomeCompleto} className="w-9 h-9 rounded-full object-cover shrink-0 border border-slate-200" />
                                            ) : (
                                                <div className="w-9 h-9 rounded-full bg-slate-200 shrink-0 flex items-center justify-center text-slate-500 font-bold border border-slate-300">
                                                    {t.NomeCompleto.charAt(0)}
                                                </div>
                                            )}
                                            <span className="text-sm font-medium">{t.NomeCompleto} <br/><span className="text-[10px] opacity-70">({t.especialidade})</span></span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                <label className="block font-semibold text-slate-800 mb-2">Atividades Realizadas *</label>
                                <textarea 
                                    required
                                    rows="4"
                                    value={execucaoFormData.atividades_realizadas}
                                    onChange={e => setExecucaoFormData({...execucaoFormData, atividades_realizadas: e.target.value})}
                                    className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 resize-none"
                                    placeholder="Descreva o serviço executado..."
                                />
                            </div>

                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                                        <ImageIcon size={18} className="text-indigo-600" /> Fotos Pós-Manutenção
                                    </h3>
                                    <div>
                                        <input 
                                            type="file" id="upload-fotos-execucao" multiple accept="image/*" capture="environment"
                                            className="hidden" onChange={handleFileUploadExecucao} 
                                        />
                                        <label htmlFor="upload-fotos-execucao" className="text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg cursor-pointer">
                                            + Adicionar Foto
                                        </label>
                                    </div>
                                </div>
                                <div className="flex gap-4 overflow-x-auto pb-2">
                                    {execucaoFormData.fotos_execucao.map((foto, index) => (
                                        <div key={index} className="relative shrink-0 w-24 h-24 rounded-lg overflow-hidden border border-slate-200 group">
                                            <img src={foto} alt={`Foto ${index}`} className="w-full h-full object-cover" />
                                            <button 
                                                type="button"
                                                onClick={() => setExecucaoFormData(prev => ({...prev, fotos_execucao: prev.fotos_execucao.filter((_, i) => i !== index)}))}
                                                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                            ><Trash2 size={14}/></button>
                                        </div>
                                    ))}
                                    {execucaoFormData.fotos_execucao.length === 0 && (
                                        <div className="w-full text-center py-6 border-2 border-dashed border-slate-200 rounded-lg">
                                            <p className="text-sm text-slate-400">Nenhuma evidência fotográfica anexada.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-indigo-50 p-5 rounded-xl border border-indigo-100 flex items-center justify-between">
                                <div>
                                    <h3 className="font-bold text-indigo-900 text-lg">Problema Resolvido?</h3>
                                    <p className="text-sm text-indigo-700">A máquina está liberada para operar?</p>
                                </div>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border cursor-pointer border-slate-200">
                                        <input type="radio" name="resolvido" checked={execucaoFormData.resolvido === true} onChange={() => setExecucaoFormData({...execucaoFormData, resolvido: true})} className="text-green-600 focus:ring-green-500 w-4 h-4" />
                                        <span className="font-bold text-green-700">Sim, Liberada</span>
                                    </label>
                                    <label className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border cursor-pointer border-slate-200">
                                        <input type="radio" name="resolvido" checked={execucaoFormData.resolvido === false} onChange={() => setExecucaoFormData({...execucaoFormData, resolvido: false})} className="text-red-600 focus:ring-red-500 w-4 h-4" />
                                        <span className="font-bold text-red-700">Não, Pendente</span>
                                    </label>
                                </div>
                            </div>
                        </form>
                    )}

                    {/* TAB: MATERIAIS */}
                    {activeTab === 'materiais' && (
                        <div className="h-full flex flex-col gap-6">
                            
                            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold text-slate-800">Solicitar Material</h3>
                                    <button 
                                        onClick={() => setShowNewItemForm(!showNewItemForm)}
                                        className={`px-3 py-1.5 text-xs font-bold rounded-lg ${showNewItemForm ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}
                                    >
                                        {showNewItemForm ? 'VOLTAR A BUSCA' : '+ MATERIAL NÃO CADASTRADO'}
                                    </button>
                                </div>

                                {showNewItemForm ? (
                                    <div className="bg-amber-50/50 p-4 rounded-lg border border-amber-200/50 space-y-4">
                                        <div>
                                            <label className="text-xs font-bold text-amber-800">Descrição do Material *</label>
                                            <input type="text" className="w-full p-2 border border-amber-200 rounded text-sm bg-white" value={newItem.descricao} onChange={e => setNewItem({...newItem, descricao: e.target.value})} placeholder="Ex: Correia dentada XPTO" />
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="flex-[2]">
                                                <label className="text-xs font-bold text-amber-800">Qtd *</label>
                                                <input type="number" className="w-full p-2 border border-amber-200 rounded text-sm bg-white" value={newItem.quantidade} onChange={e => setNewItem({...newItem, quantidade: e.target.value})} />
                                            </div>
                                            {canViewValues && (
                                                <div className="flex-[2]">
                                                    <label className="text-xs font-bold text-amber-800">Custo Un. (R$)</label>
                                                    <input type="number" step="0.01" className="w-full p-2 border border-amber-200 rounded text-sm bg-white" value={newItem.custo_unitario} onChange={e => setNewItem({...newItem, custo_unitario: e.target.value})} />
                                                </div>
                                            )}
                                            <div className="w-24">
                                                <label className="text-xs font-bold text-amber-800">Unidade</label>
                                                <select className="w-full p-2 border border-amber-200 rounded text-sm bg-white" value={newItem.unidade} onChange={e => setNewItem({...newItem, unidade: e.target.value})}>
                                                    <option value="UN">UN</option><option value="PC">PC</option><option value="KG">KG</option><option value="MT">MT</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-amber-800">Observação</label>
                                            <input type="text" className="w-full p-2 border border-amber-200 rounded text-sm bg-white" value={newItem.observacao} onChange={e => setNewItem({...newItem, observacao: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-amber-800 block mb-1">Foto de Referência (Opcional)</label>
                                            {newItem.foto ? (
                                                <div className="relative w-24 h-24 rounded border border-amber-200 group">
                                                    <img src={newItem.foto} alt="Ref" className="w-full h-full object-cover rounded" />
                                                    <button onClick={() => setNewItem({...newItem, foto: null})} className="absolute top-1 right-1 bg-red-500 text-white rounded p-1"><X size={12}/></button>
                                                </div>
                                            ) : (
                                                <input type="file" accept="image/*" capture="environment" onChange={handleNewItemImageUpload} className="text-sm" />
                                            )}
                                        </div>
                                        <button onClick={addCustomMaterial} className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-bold w-full">CRIAR E ADICIONAR MATERIAL</button>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {!selectedProduct ? (
                                            <>
                                                <div className="flex gap-2">
                                                    <input type="text" placeholder="Código Protheus..." className="flex-1 p-2 border border-slate-300 rounded-lg text-sm" value={searchCode} onChange={e => setSearchCode(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearchMaterials()} />
                                                    <input type="text" placeholder="Descrição..." className="flex-[2] p-2 border border-slate-300 rounded-lg text-sm" value={searchDesc} onChange={e => setSearchDesc(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearchMaterials()} />
                                                    <button onClick={handleSearchMaterials} disabled={searching} className="bg-slate-800 text-white px-4 rounded-lg flex items-center justify-center hover:bg-slate-700 transition-colors">
                                                        <Search size={18} />
                                                    </button>
                                                </div>
                                                
                                                {searchResults.length > 0 && (
                                                    <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
                                                        {searchResults.map((p, idx) => (<div key={`${p.codigo}-${idx}`} className="p-3 border-b border-slate-100 flex justify-between items-center hover:bg-slate-50 group">
                                                                <div>
                                                                    <div className="text-xs font-bold text-indigo-600">{p.codigo}</div>
                                                                    <div className="text-sm text-slate-800">{p.descricao}</div>
                                                                </div>
                                                                <button onClick={() => handleAddMaterialClick(p)} className="bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity font-bold text-xs flex items-center gap-1">
                                                                    <Plus size={14} /> ADICIONAR
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="bg-indigo-50/50 p-4 rounded-lg border border-indigo-200/50 space-y-4">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h4 className="text-indigo-900 font-bold text-sm">Adicionar Item Protheus</h4>
                                                        <p className="text-xs text-indigo-700 font-mono mt-1">{selectedProduct.codigo} - {selectedProduct.descricao}</p>
                                                    </div>
                                                    <button onClick={() => setSelectedProduct(null)} className="text-slate-400 hover:text-slate-600"><X size={18}/></button>
                                                </div>
                                                
                                                <div className="flex gap-4">
                                                    <div className="flex-[2]">
                                                        <label className="text-xs font-bold text-indigo-800">Quantidade *</label>
                                                        <input type="number" autoFocus className="w-full p-2 border border-indigo-200 rounded text-sm bg-white" value={newItem.quantidade} onChange={e => setNewItem({...newItem, quantidade: e.target.value})} placeholder="Ex: 2" />
                                                    </div>
                                                    {canViewValues && (
                                                        <div className="flex-[2]">
                                                            <label className="text-xs font-bold text-indigo-800">Custo Un. (R$)</label>
                                                            <input type="number" step="0.01" className="w-full p-2 border border-indigo-200 rounded text-sm bg-white" value={newItem.custo_unitario} onChange={e => setNewItem({...newItem, custo_unitario: e.target.value})} />
                                                        </div>
                                                    )}
                                                    <div className="w-24">
                                                        <label className="text-xs font-bold text-indigo-800">Unidade</label>
                                                        <input type="text" disabled className="w-full p-2 border border-indigo-200 rounded text-sm bg-slate-100 text-slate-500 font-bold" value={newItem.unidade} />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-indigo-800">Observação (Opcional)</label>
                                                    <input type="text" className="w-full p-2 border border-indigo-200 rounded text-sm bg-white" value={newItem.observacao} onChange={e => setNewItem({...newItem, observacao: e.target.value})} placeholder="Ex: Precisa ser do lote X..." />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-indigo-800 block mb-1">Foto de Referência (Opcional)</label>
                                                    {newItem.foto ? (
                                                        <div className="relative w-24 h-24 rounded border border-indigo-200 group">
                                                            <img src={newItem.foto} alt="Ref" className="w-full h-full object-cover rounded" />
                                                            <button onClick={() => setNewItem({...newItem, foto: null})} className="absolute top-1 right-1 bg-red-500 text-white rounded p-1"><X size={12}/></button>
                                                        </div>
                                                    ) : (
                                                        <input type="file" accept="image/*" capture="environment" onChange={handleNewItemImageUpload} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200" />
                                                    )}
                                                </div>
                                                <button onClick={confirmAddProtheusMaterial} className="bg-indigo-600 hover:bg-indigo-700 transition-colors text-white px-4 py-2 rounded-lg text-sm font-bold w-full">CONFIRMAR SOLICITAÇÃO</button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col">
                                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Package size={18}/> Lista de Materiais Solicitados</h3>
                                <div className="flex-1 overflow-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 sticky top-0">
                                            <tr>
                                                <th className="p-3">Código</th>
                                                <th className="p-3">Descrição</th>
                                                <th className="p-3">Qtd</th>
                                                {canViewValues && (
                                                    <>
                                                        <th className="p-3">Custo Un.</th>
                                                        <th className="p-3">Custo Total</th>
                                                    </>
                                                )}
                                                <th className="p-3">Foto</th>
                                                <th className="p-3 text-right">Ação</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {materiais.length === 0 ? (
                                                <tr><td colSpan={canViewValues ? 7 : 5} className="p-6 text-center text-slate-400">Nenhum material solicitado.</td></tr>
                                            ) : materiais.map(m => (
                                                <tr key={m.id} className="hover:bg-slate-50">
                                                    <td className="p-3">
                                                        {m.is_novo ? <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">NÃO CADASTRADO</span> : <span className="font-mono text-xs">{m.codigo}</span>}
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="font-medium text-slate-800">{m.descricao}</div>
                                                        {m.observacao && <div className="text-[10px] text-slate-500 mt-1">Obs: {m.observacao}</div>}
                                                    </td>
                                                    <td className="p-3 font-medium">{Number(m.quantidade)} {m.unidade}</td>
                                                    {canViewValues && (
                                                        <>
                                                            <td className="p-3 text-slate-600">R$ {Number(m.custo_unitario || 0).toFixed(2)}</td>
                                                            <td className="p-3 font-bold text-slate-800">R$ {Number(m.custo_total || 0).toFixed(2)}</td>
                                                        </>
                                                    )}
                                                    <td className="p-3">
                                                        {m.foto ? (
                                                            <a href={m.foto} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline flex items-center gap-1">
                                                                <ImageIcon size={14} /> Ver
                                                            </a>
                                                        ) : '-'}
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <button onClick={() => handleDeleteMaterial(m.id)} className="text-red-500 hover:text-red-700 p-1">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB: HISTORICO */}
                    {activeTab === 'historico' && (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 h-full overflow-y-auto">
                            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2"><History size={18}/> Histórico da Ordem</h3>
                            
                            <div className="space-y-6">
                                {historico.map((h, i) => (
                                    <div key={h.id} className="relative pl-6 border-l-2 border-indigo-100">
                                        <div className="absolute w-3 h-3 bg-indigo-500 rounded-full -left-[7px] top-1.5 border-2 border-white"></div>
                                        <div className="mb-1">
                                            <span className="font-bold text-slate-800 text-sm">{h.usuario_nome}</span>
                                            <span className="text-xs text-slate-500 ml-3">{new Date(h.data_hora).toLocaleString('pt-BR')}</span>
                                        </div>
                                        <div className="text-xs font-semibold text-indigo-600 mb-1">{h.acao}</div>
                                        <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">{h.detalhes}</div>
                                    </div>
                                ))}
                                {historico.length === 0 && (
                                    <div className="text-slate-500 text-sm italic">Nenhum histórico registrado.</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer for Execucao Tab */}
                {activeTab === 'execucao' && (
                    <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-end gap-3">
                        <button onClick={onClose} className="px-5 py-2 text-slate-600 font-semibold hover:bg-slate-100 rounded-lg">Cancelar</button>
                        <button onClick={handleSaveExecucao} disabled={loading} className="px-6 py-2 bg-green-600 text-white font-bold rounded-lg flex items-center gap-2 shadow hover:bg-green-700 disabled:opacity-50">
                            <CheckCircle2 size={18} /> {loading ? 'Salvando...' : 'Finalizar Execução'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
