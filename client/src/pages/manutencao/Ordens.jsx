import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Plus, PenTool, Clock, CheckCircle2, AlertTriangle, AlertCircle, Filter, Search, X, Image as ImageIcon, Trash2, Play, Package, History } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import ExecucaoModal from './ExecucaoModal';

export default function ManutencaoOrdens() {
    const { user, hasPermission } = useAuth();
    const canViewValues = hasPermission('valores_financeiros', 'view');
    const [ordens, setOrdens] = useState([]);
    const [maquinas, setMaquinas] = useState([]);
    const [tecnicos, setTecnicos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        id_maquina: '',
        tipo_manutencao: 'CORRETIVA',
        prioridade: 'MEDIA',
        descricao_problema: '',
        fotos: []
    });

    const [isExecucaoModalOpen, setIsExecucaoModalOpen] = useState(false);
    const [ordemSelecionada, setOrdemSelecionada] = useState(null);

    const loadData = async () => {
        try {
            setLoading(true);
            const [resOrdens, resMaquinas, resTecnicos] = await Promise.all([
                api.get('/manutencao/ordens').catch(() => ({ data: [] })),
                api.get('/manutencao/maquinas').catch(() => ({ data: [] })),
                api.get('/manutencao/tecnicos').catch(() => ({ data: [] }))
            ]);
            setOrdens(resOrdens.data);
            setMaquinas(resMaquinas.data);
            setTecnicos(resTecnicos.data);
        } catch (err) {
            console.error("Erro ao carregar dados:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleOpenModal = (ordem = null) => {
        if (ordem) {
            setFormData({
                id: ordem.id,
                id_maquina: ordem.id_maquina,
                tipo_manutencao: ordem.tipo_manutencao,
                prioridade: ordem.prioridade,
                descricao_problema: ordem.descricao_problema,
                status: ordem.status,
                fotos: typeof ordem.fotos === 'string' ? JSON.parse(ordem.fotos) : (ordem.fotos || [])
            });
        } else {
            setFormData({
                id_maquina: '',
                tipo_manutencao: 'CORRETIVA',
                prioridade: 'MEDIA',
                descricao_problema: '',
                fotos: []
            });
        }
        setIsModalOpen(true);
    };

    const compressImage = (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const max_size = 1200;

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
                    // Comprime para JPEG com 70% de qualidade
                    resolve(canvas.toDataURL('image/jpeg', 0.7));
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    };

    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        for (const file of files) {
            try {
                const compressedBase64 = await compressImage(file);
                setFormData(prev => ({
                    ...prev,
                    fotos: [...prev.fotos, { data: compressedBase64, observacao: '' }]
                }));
            } catch (err) {
                console.error("Erro ao comprimir imagem:", err);
            }
        }
    };

    const removeFoto = (indexToRemove) => {
        setFormData(prev => ({
            ...prev,
            fotos: prev.fotos.filter((_, index) => index !== indexToRemove)
        }));
    };

    const updateFotoObservacao = (index, texto) => {
        setFormData(prev => ({
            ...prev,
            fotos: prev.fotos.map((f, i) => i === index ? { ...f, observacao: texto } : f)
        }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!formData.id_maquina || !formData.descricao_problema) {
            alert("Preencha a máquina e a descrição do problema.");
            return;
        }

        try {
            setSaving(true);
            const payload = {
                ...formData,
                solicitante: user?.idUsuario,
                usuario_id: user?.idUsuario,
                usuario_nome: user?.NomeCompleto || user?.nome
            };
            
            if (formData.id) {
                await api.put(`/manutencao/ordens/${formData.id}`, payload);
            } else {
                await api.post('/manutencao/ordens', payload);
            }
            
            setIsModalOpen(false);
            loadData();
        } catch (err) {
            console.error(err);
            alert("Erro ao salvar ordem de manutenção.");
        } finally {
            setSaving(false);
        }
    };

    const handleOpenExecucao = (ordem, e) => {
        e.stopPropagation();
        setOrdemSelecionada(ordem);
        setIsExecucaoModalOpen(true);
    };

    const getStatusBadge = (status) => {
        const styles = {
            'SOLICITADA': 'bg-blue-600 text-white shadow-md shadow-blue-200',
            'EM_ANDAMENTO': 'bg-yellow-500 text-white shadow-md shadow-yellow-200',
            'AGUARDANDO_PECA': 'bg-orange-500 text-white shadow-md shadow-orange-200',
            'CONCLUIDA': 'bg-green-600 text-white shadow-md shadow-green-200',
            'CANCELADA': 'bg-slate-600 text-white shadow-md shadow-slate-200'
        };
        const activeStyle = styles[status] || styles['SOLICITADA'];
        return <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${activeStyle}`}>{status?.replace('_', ' ')}</span>;
    };

    const getPrioridadeBadge = (prioridade) => {
        const styles = {
            'BAIXA': 'text-slate-600 bg-slate-100',
            'MEDIA': 'text-blue-600 bg-blue-100',
            'ALTA': 'text-orange-600 bg-orange-100',
            'CRITICA': 'text-red-600 bg-red-100 font-bold'
        };
        const activeStyle = styles[prioridade] || styles['MEDIA'];
        return <span className={`px-2 py-0.5 rounded text-[10px] uppercase ${activeStyle}`}>{prioridade}</span>;
    };

    // --- Cálculos de KPIs ---
    const concluídas = ordens.filter(o => o.status === 'CONCLUIDA');
    
    // Cálculo MTTR (Mean Time To Repair) em horas
    let totalRepairTime = 0;
    let mttrCount = 0;
    concluídas.forEach(o => {
        if (o.data_abertura && o.data_fim) {
            const start = new Date(o.data_abertura);
            const end = new Date(o.data_fim);
            const diffMs = end - start;
            if (diffMs > 0) {
                totalRepairTime += diffMs / (1000 * 60 * 60); // converte para horas
                mttrCount++;
            }
        }
    });
    const mttr = mttrCount > 0 ? (totalRepairTime / mttrCount).toFixed(1) : '0.0';

    // Cálculo de Custos Totais (Materiais + Serviços)
    const custoTotalManutencao = ordens.reduce((acc, o) => {
        return acc + Number(o.custo_materiais || 0) + Number(o.custo_servico || 0);
    }, 0);

    return (
        <div className="p-6 h-full flex flex-col bg-slate-50">
            {/* Header */}
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <PenTool className="text-indigo-600" /> Ordens de Manutenção
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">Gerenciamento de solicitações de reparo e manutenções programadas</p>
                </div>
                <button 
                    onClick={handleOpenModal}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-medium"
                >
                    <Plus size={18} /> Nova Ordem
                </button>
            </div>

            {/* KPI Dashboard - Visualização de Gestão */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 border-l-4 border-l-blue-500 flex items-center justify-between">
                    <div>
                        <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Ordens Pendentes</div>
                        <div className="text-3xl font-black text-slate-800">{ordens.filter(o => !['CONCLUIDA', 'CANCELADA'].includes(o.status)).length}</div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600"><AlertCircle size={20}/></div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 border-l-4 border-l-yellow-500 flex items-center justify-between">
                    <div>
                        <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Em Execução</div>
                        <div className="text-3xl font-black text-slate-800">{ordens.filter(o => o.status === 'EM_ANDAMENTO').length}</div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-yellow-50 flex items-center justify-center text-yellow-600"><Play size={20}/></div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 border-l-4 border-l-orange-500 flex items-center justify-between">
                    <div>
                        <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">MTTR (Horas)</div>
                        <div className="text-3xl font-black text-slate-800">{mttr} <span className="text-xs font-normal text-slate-400">h</span></div>
                    </div>
                    <CheckCircle2 className="text-orange-200 w-12 h-12" />
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 border-l-4 border-l-red-500 flex items-center justify-between">
                    <div>
                        <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Críticas (Paradas)</div>
                        <div className="text-3xl font-black text-red-600">{ordens.filter(o => o.prioridade === 'CRITICA' && !['CONCLUIDA', 'CANCELADA'].includes(o.status)).length}</div>
                    </div>
                    <AlertTriangle className="text-red-200 w-12 h-12" />
                </div>
                {canViewValues && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 border-l-4 border-l-emerald-500 flex items-center justify-between">
                        <div>
                            <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Custo Total (R$)</div>
                            <div className="text-2xl font-black text-slate-800">
                                {custoTotalManutencao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace('R$', '').trim()}
                            </div>
                        </div>
                        <PenTool className="text-emerald-200 w-12 h-12" />
                    </div>
                )}
            </div>

            {/* Listagem */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input 
                            type="text" 
                            placeholder="Buscar por máquina ou descrição..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <select 
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="border border-slate-300 rounded-lg text-sm px-3 py-2 bg-white"
                    >
                        <option value="">Todos os Status</option>
                        <option value="SOLICITADA">Solicitada</option>
                        <option value="EM_ANDAMENTO">Em Andamento</option>
                        <option value="AGUARDANDO_PECA">Aguardando Peça</option>
                        <option value="CONCLUIDA">Concluída</option>
                        <option value="CANCELADA">Cancelada</option>
                    </select>
                </div>

                <div className="flex-1 overflow-auto p-4">
                    {loading ? (
                        <div className="flex justify-center p-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : ordens.length === 0 ? (
                        <div className="text-center p-12 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">
                            <PenTool className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                            <h3 className="text-lg font-bold text-slate-700">Nenhuma Ordem de Manutenção</h3>
                            <p className="text-slate-500 mb-4">Ainda não existem ordens registradas no sistema.</p>
                            <button onClick={handleOpenModal} className="text-indigo-600 font-medium hover:text-indigo-800">
                                Abrir a primeira ordem
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {ordens
                                .filter(o => statusFilter ? o.status === statusFilter : true)
                                .filter(o => searchTerm ? (o.maquina_nome || '').toLowerCase().includes(searchTerm.toLowerCase()) || (o.descricao_problema || '').toLowerCase().includes(searchTerm.toLowerCase()) : true)
                                .map(o => {
                                    // Parse tecnicos from DB
                                    let tecnicosOrdem = [];
                                    try {
                                        if (o.tecnicos_execucao && typeof o.tecnicos_execucao === 'string') {
                                            const ids = JSON.parse(o.tecnicos_execucao);
                                            tecnicosOrdem = tecnicos.filter(t => ids.includes(t.id));
                                        }
                                    } catch (e) {}
                                    
                                    return (
                                <div key={o.id} className="border border-slate-200 rounded-lg p-4 hover:border-indigo-300 hover:shadow-sm transition-all bg-white group cursor-pointer">
                                    <div className="flex justify-between items-start mt-3">
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                {getStatusBadge(o.status)}
                                                {getPrioridadeBadge(o.prioridade)}
                                            </div>
                                            <div className="font-bold text-slate-800 text-lg group-hover:text-indigo-600 transition-colors">
                                                {o.maquina_nome || 'Máquina não informada'}
                                            </div>
                                            <div className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                                                <span className="text-indigo-600 font-medium">#{o.id.toString().padStart(4, '0')}</span>
                                                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                                <span>{format(new Date(o.data_abertura), "dd/MM/yyyy HH:mm")}</span>
                                                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                                <span className="font-medium">Criado por: {o.solicitante_nome || 'Sistema'}</span>
                                            </div>
                                            {(o.data_fim || o.tempo_execucao_segundos > 0) && (
                                                <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                                                    {o.data_fim && <span>Fim: {format(new Date(o.data_fim), "dd/MM/yyyy HH:mm")}</span>}
                                                    {o.data_fim && <span className="w-1 h-1 bg-slate-300 rounded-full"></span>}
                                                    {o.tempo_execucao_segundos > 0 && <span>Tempo: {Math.floor(o.tempo_execucao_segundos / 60)} min</span>}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={(e) => handleOpenExecucao(o, e)}
                                                className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                                title="Painel de Execução / Materiais / Histórico"
                                            >
                                                <Play size={18} />
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleOpenModal(o); }}
                                                className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                                                title="Editar Ordem"
                                            >
                                                <PenTool size={18} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="mt-4 bg-slate-50 rounded-lg p-3 text-sm text-slate-700 border border-slate-100 line-clamp-2">
                                        {o.descricao_problema}
                                    </div>
                                    {tecnicosOrdem.length > 0 && (
                                        <div className="mt-3 flex items-center gap-2">
                                            <span className="text-xs font-semibold text-slate-500">Técnicos:</span>
                                            <div className="flex -space-x-2">
                                                {tecnicosOrdem.map(t => (
                                                    <div key={t.id} title={t.NomeCompleto} className="relative z-10 w-7 h-7 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center overflow-hidden">
                                                        {t.fotoUsuario ? <img src={t.fotoUsuario} alt={t.NomeCompleto} className="w-full h-full object-cover"/> : <span className="text-[10px] font-bold text-slate-500">{t.NomeCompleto.charAt(0)}</span>}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )})}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal de Abertura de Ordem */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <PenTool className="text-indigo-600" /> Nova Ordem de Manutenção
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        
                        <div className="p-6">
                            <form id="ordem-form" onSubmit={handleSave} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Máquina / Equipamento *</label>
                                    <select 
                                        required
                                        value={formData.id_maquina}
                                        onChange={e => setFormData({...formData, id_maquina: e.target.value})}
                                        className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 bg-white"
                                    >
                                        <option value="">Selecione o equipamento...</option>
                                        {maquinas.map(m => (
                                            <option key={m.id} value={m.id}>{m.nome} {m.tag_identificacao ? `(${m.tag_identificacao})` : ''}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">Tipo de Manutenção *</label>
                                        <select 
                                            value={formData.tipo_manutencao}
                                            onChange={e => setFormData({...formData, tipo_manutencao: e.target.value})}
                                            className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 bg-white"
                                        >
                                            <option value="CORRETIVA">Corretiva (Quebra/Falha)</option>
                                            <option value="PREVENTIVA">Preventiva (Programada)</option>
                                            <option value="PREDITIVA">Preditiva (Monitoramento)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">Prioridade *</label>
                                        <select 
                                            value={formData.prioridade}
                                            onChange={e => setFormData({...formData, prioridade: e.target.value})}
                                            className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 bg-white"
                                        >
                                            <option value="BAIXA">Baixa (Pode aguardar)</option>
                                            <option value="MEDIA">Média (Requer atenção)</option>
                                            <option value="ALTA">Alta (Impacta produção)</option>
                                            <option value="CRITICA">Crítica (Máquina parada)</option>
                                        </select>
                                    </div>
                                    
                                    {formData.id && (
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-semibold text-slate-700 mb-1">Status</label>
                                            <select 
                                                value={formData.status || 'SOLICITADA'}
                                                onChange={e => setFormData({...formData, status: e.target.value})}
                                                className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 bg-white"
                                            >
                                                <option value="SOLICITADA">Solicitada</option>
                                                <option value="EM_ANDAMENTO">Em Andamento</option>
                                                <option value="AGUARDANDO_PECA">Aguardando Peça</option>
                                                <option value="CONCLUIDA">Concluída</option>
                                                <option value="CANCELADA">Cancelada</option>
                                            </select>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Descrição do Problema / Solicitação *</label>
                                    <textarea 
                                        required
                                        rows="4"
                                        value={formData.descricao_problema}
                                        onChange={e => setFormData({...formData, descricao_problema: e.target.value})}
                                        className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 resize-none"
                                        placeholder="Descreva com detalhes o que está acontecendo com a máquina..."
                                    ></textarea>
                                </div>

                                {/* Evidências Visuais (Fotos) */}
                                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                                        <h3 className="font-semibold text-slate-700 flex items-center gap-2 text-sm">
                                            <ImageIcon size={16} className="text-indigo-600" /> 
                                            Evidências Visuais (Fotos)
                                        </h3>
                                        <div>
                                            <input 
                                                type="file" 
                                                id="upload-fotos" 
                                                multiple 
                                                accept="image/*" 
                                                capture="environment"
                                                className="hidden" 
                                                onChange={handleFileUpload} 
                                            />
                                            <label 
                                                htmlFor="upload-fotos" 
                                                className="text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded cursor-pointer transition-colors"
                                            >
                                                + Adicionar Fotos
                                            </label>
                                        </div>
                                    </div>
                                    <div className="p-4">
                                        {formData.fotos.length === 0 ? (
                                            <p className="text-sm text-slate-400 italic text-center py-4">Nenhuma foto adicionada. Clique em "+  Adicionar Fotos" ou tire uma foto com a câmera.</p>
                                        ) : (
                                            <div className="space-y-3">
                                                {formData.fotos.map((foto, index) => (
                                                    <div key={index} className="flex gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                                        <div className="relative group shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-slate-200">
                                                            <img src={foto.data} alt={`Evidência ${index + 1}`} className="w-full h-full object-cover" />
                                                            <button 
                                                                type="button"
                                                                onClick={() => removeFoto(index)}
                                                                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-sm"
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </div>
                                                        <div className="flex-1">
                                                            <label className="text-xs font-semibold text-slate-600 mb-1 block">Foto {index + 1} — Observação</label>
                                                            <textarea
                                                                value={foto.observacao}
                                                                onChange={e => updateFotoObservacao(index, e.target.value)}
                                                                rows="3"
                                                                className="w-full text-sm border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-400 resize-none"
                                                                placeholder="Descreva o que esta foto mostra (ex: vazamento de óleo no eixo direito)..."
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </form>
                        </div>

                        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                            <button 
                                type="button" 
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="submit" 
                                form="ordem-form"
                                disabled={saving}
                                className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                            >
                                {saving ? 'Abrindo...' : 'Abrir Ordem de Manutenção'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ExecucaoModal 
                isOpen={isExecucaoModalOpen} 
                onClose={() => setIsExecucaoModalOpen(false)} 
                ordem={ordemSelecionada} 
                tecnicos={tecnicos} 
                onSave={loadData} 
            />
        </div>
    );
}
