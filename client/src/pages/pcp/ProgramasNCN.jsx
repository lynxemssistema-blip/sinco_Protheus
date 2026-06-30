import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { 
    Plus, X, Trash2, Calendar, Clock, User, FileText, 
    Factory, AlertCircle, RefreshCw, Search, Edit, GripVertical
} from 'lucide-react';
import { toast } from 'react-toastify';

// Auxiliares de conversão de tempo
function hhmmssToSeconds(str) {
    if (!str) return 0;
    const parts = str.split(':');
    const hrs = parseInt(parts[0]) || 0;
    const mins = parseInt(parts[1]) || 0;
    const secs = parseInt(parts[2]) || 0;
    return (hrs * 3600) + (mins * 60) + secs;
}

function secondsToHhmmss(totalSecs) {
    if (isNaN(totalSecs) || totalSecs < 0) return '00:00:00';
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return [
        String(hrs).padStart(2, '0'),
        String(mins).padStart(2, '0'),
        String(secs).padStart(2, '0')
    ].join(':');
}

export default function ProgramasNCN() {
    const { user } = useAuth();
    
    // State de dados
    const [maquinas, setMaquinas] = useState([]);
    const [loadingMaquinas, setLoadingMaquinas] = useState(true);
    const [programas, setProgramas] = useState([]);
    const [loadingProgramas, setLoadingProgramas] = useState(true);

    // State de filtros
    const [filterMaquinaId, setFilterMaquinaId] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [draggedIndex, setDraggedIndex] = useState(null);
    
    // State do Modal
    const [showFormProg, setShowFormProg] = useState(false);
    const [editingProgId, setEditingProgId] = useState(null);
    const [editingProgram, setEditingProgram] = useState(null);
    const [progForm, setProgForm] = useState({
        maquina_id: '',
        nome_programa: '',
        data_criacao: new Date().toISOString().substring(0, 10),
        tempo_previsto: '00:00:00',
        tipo_material: '',
        quantidade_vezes: 1,
        chapas_planejadas: [{ codigo: '', repeticoes: 1, tempo: '00:00:00', tipo: 'inteira' }],
        criado_por: '',
        turno_previsao: 1,
        recebedor_nome: '',
        recebido_data: '',
        recebido_hora: '',
        notas_instrucoes: ''
    });

    // Carregar máquinas e programas ao montar a tela
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                setLoadingMaquinas(true);
                const resMaquinas = await api.get('/manutencao/maquinas');
                setMaquinas(resMaquinas.data.filter(m => m.status === 'ATIVO'));
            } catch (err) {
                console.error("Erro ao carregar máquinas:", err);
                toast.error("Erro ao carregar máquinas do parque fabril.");
            } finally {
                setLoadingMaquinas(false);
            }

            await loadProgramas();
        };
        fetchInitialData();
    }, []);

    const loadProgramas = async () => {
        try {
            setLoadingProgramas(true);
            const res = await api.get('/pcp/programas/maquina/all');
            setProgramas(res.data);
        } catch (err) {
            console.error("Erro ao carregar programas:", err);
            toast.error("Erro ao carregar programas liberados.");
        } finally {
            setLoadingProgramas(false);
        }
    };

    // Handlers para os campos dinâmicos de Chapas Planejadas
    const handleAddChapaField = () => {
        setProgForm(prev => ({
            ...prev,
            chapas_planejadas: [...prev.chapas_planejadas, { codigo: '', repeticoes: 1, tempo: '00:00:00', tipo: 'inteira' }]
        }));
    };

    const handleRemoveChapaField = (index) => {
        setProgForm(prev => {
            const newChapas = [...prev.chapas_planejadas];
            newChapas.splice(index, 1);
            return {
                ...prev,
                chapas_planejadas: newChapas.length > 0 ? newChapas : [{ codigo: '', repeticoes: 1, tempo: '00:00:00', tipo: 'inteira' }]
            };
        });
    };

    const handleChapaFieldChange = (index, field, value) => {
        setProgForm(prev => {
            const newChapas = [...prev.chapas_planejadas];
            newChapas[index] = { ...newChapas[index], [field]: value };
            return {
                ...prev,
                chapas_planejadas: newChapas
            };
        });
    };

    // Submissão do Formulário (Criar / Editar)
    const handleSubmitForm = async (e) => {
        e.preventDefault();
        try {
            if (!progForm.maquina_id) {
                toast.error("Selecione uma máquina de destino.");
                return;
            }

            const chapasFiltradas = [];
            progForm.chapas_planejadas.forEach(c => {
                const codigo = c.codigo ? c.codigo.trim() : '';
                if (!codigo) return;
                const repeticoes = parseInt(c.repeticoes) || 1;
                const tempo = c.tempo || '00:00:00';
                const tipo = c.tipo || 'inteira';
                for (let i = 0; i < repeticoes; i++) {
                    chapasFiltradas.push({ codigo, tempo, tipo });
                }
            });

            if (chapasFiltradas.length === 0) {
                toast.error("Adicione pelo menos uma chapa planejada.");
                return;
            }

            const payload = {
                ...progForm,
                chapas_planejadas: chapasFiltradas,
                quantidade_vezes: chapasFiltradas.length,
                maquina_id: parseInt(progForm.maquina_id),
                criado_por: progForm.criado_por || user?.NomeCompleto || user?.nome || 'PCP'
            };

            if (editingProgId) {
                await api.put(`/pcp/programas/${editingProgId}`, payload);
                toast.success("Programa CNC atualizado com sucesso!");
            } else {
                await api.post('/pcp/programas', payload);
                toast.success("Programa CNC liberado com sucesso!");
            }

            setShowFormProg(false);
            setEditingProgId(null);
            setEditingProgram(null);
            setProgForm({
                maquina_id: '',
                nome_programa: '',
                data_criacao: new Date().toISOString().substring(0, 10),
                tempo_previsto: '00:00:00',
                tipo_material: '',
                quantidade_vezes: 1,
                chapas_planejadas: [{ codigo: '', repeticoes: 1, tempo: '00:00:00', tipo: 'inteira' }],
                criado_por: user?.NomeCompleto || user?.nome || '',
                turno_previsao: 1,
                recebedor_nome: '',
                recebido_data: '',
                recebido_hora: '',
                notas_instrucoes: ''
            });
            loadProgramas();
        } catch (err) {
            console.error(err);
            toast.error(editingProgId ? "Erro ao atualizar programa CNC." : "Erro ao cadastrar programa CNC.");
        }
    };

    // Carregar programa no formulário de edição
    const handleEditProgram = (prog) => {
        let chapas = [{ codigo: '', repeticoes: 1, tempo: '00:00:00', tipo: 'inteira' }];
        if (prog.chapas_planejadas) {
            try {
                const parsed = typeof prog.chapas_planejadas === 'string'
                    ? JSON.parse(prog.chapas_planejadas)
                    : prog.chapas_planejadas;
                if (Array.isArray(parsed) && parsed.length > 0) {
                    const groupedMap = new Map();
                    parsed.forEach(ch => {
                        const rawCode = typeof ch === 'string' ? ch : (ch.codigo || '');
                        const tempo = typeof ch === 'string' ? '00:00:00' : (ch.tempo || '00:00:00');
                        const tipo = typeof ch === 'string' ? 'inteira' : (ch.tipo || 'inteira');

                        const match = rawCode.match(/^(.*?)\s*\(\d+\)$/);
                        const baseCode = match ? match[1].trim() : rawCode.trim();

                        const key = `${baseCode}|${tempo}|${tipo}`;
                        if (groupedMap.has(key)) {
                            groupedMap.get(key).repeticoes += 1;
                        } else {
                            groupedMap.set(key, { codigo: baseCode, repeticoes: 1, tempo, tipo });
                        }
                    });
                    chapas = Array.from(groupedMap.values());
                }
            } catch (e) {
                chapas = [{ codigo: '', repeticoes: 1, tempo: '00:00:00', tipo: 'inteira' }];
            }
        }
        setProgForm({
            maquina_id: prog.maquina_id || '',
            nome_programa: prog.nome_programa || '',
            data_criacao: prog.data_criacao ? new Date(prog.data_criacao).toISOString().substring(0, 10) : new Date().toISOString().substring(0, 10),
            tempo_previsto: prog.tempo_previsto || '00:00:00',
            tipo_material: prog.tipo_material || '',
            quantidade_vezes: prog.quantidade_vezes || 1,
            chapas_planejadas: chapas,
            criado_por: prog.criado_por || '',
            turno_previsao: prog.turno_previsao || 1,
            recebedor_nome: prog.recebedor_nome || '',
            recebido_data: prog.recebido_data ? new Date(prog.recebido_data).toISOString().substring(0, 10) : '',
            recebido_hora: prog.recebido_hora || '',
            notas_instrucoes: prog.notas_instrucoes || ''
        });
        setEditingProgId(prog.id);
        setEditingProgram(prog);
        setShowFormProg(true);
    };

    // Excluir programa
    const handleDeleteProgram = async (progId) => {
        if (window.confirm("Deseja realmente excluir esta liberação de programa CNC?")) {
            try {
                await api.delete(`/pcp/programas/${progId}`);
                toast.success("Liberação excluída com sucesso.");
                loadProgramas();
            } catch (err) {
                console.error(err);
                toast.error("Erro ao excluir programa.");
            }
        }
    };

    const handleUpdateOrdem = async (prog, valor) => {
        const novaOrdem = parseInt(valor) || 0;
        if (novaOrdem === (prog.ordem_execucao || 0)) return;

        try {
            await api.put(`/pcp/programas/${prog.id}`, { ordem_execucao: novaOrdem });
            toast.success(`Sequência do programa #${prog.id} updated to ${novaOrdem}!`);
            loadProgramas();
        } catch (err) {
            console.error("Erro ao atualizar sequência de execução:", err);
            toast.error("Erro ao salvar sequência de execução.");
        }
    };

    // Atualizar sequência no banco em lote
    const updateSequenciaNoBanco = async (novoArray) => {
        try {
            const programIds = novoArray.map(p => p.id);
            await api.put('/pcp/programas/reordenar', { programIds });
            toast.success("Sequência de execução atualizada com sucesso!");
            await loadProgramas();
        } catch (err) {
            console.error("Erro ao salvar ordenação:", err);
            toast.error("Erro ao salvar a nova sequência de execução.");
        }
    };

    // Drag and Drop Handlers
    const handleDragStart = (e, index) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', index);
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
    };

    const handleDrop = async (e, targetIndex) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === targetIndex) return;

        const novoArray = [...filteredProgramas];
        const [draggedItem] = novoArray.splice(draggedIndex, 1);
        novoArray.splice(targetIndex, 0, draggedItem);

        setDraggedIndex(null);
        await updateSequenciaNoBanco(novoArray);
    };

    // Setas Subir/Descer
    const handleSubir = async (index) => {
        if (index === 0) return;
        const novoArray = [...filteredProgramas];
        const temp = novoArray[index];
        novoArray[index] = novoArray[index - 1];
        novoArray[index - 1] = temp;
        await updateSequenciaNoBanco(novoArray);
    };

    const handleDescer = async (index) => {
        if (index === filteredProgramas.length - 1) return;
        const novoArray = [...filteredProgramas];
        const temp = novoArray[index];
        novoArray[index] = novoArray[index + 1];
        novoArray[index + 1] = temp;
        await updateSequenciaNoBanco(novoArray);
    };

    const handleStatusChange = async (prog, novoStatus) => {
        try {
            const agora = new Date();
            const ano = agora.getFullYear();
            const mes = String(agora.getMonth() + 1).padStart(2, '0');
            const dia = String(agora.getDate()).padStart(2, '0');
            const dataLocal = `${ano}-${mes}-${dia}`;
            const horaLocal = agora.toLocaleTimeString('pt-BR', { hour12: false });
            const nomeUsuario = user?.NomeCompleto || user?.nome || 'Operador';

            const payload = {
                status: novoStatus,
                recebedor_nome: nomeUsuario,
                recebido_data: dataLocal,
                recebido_hora: horaLocal
            };

            await api.put(`/pcp/programas/${prog.id}`, payload);
            toast.success(`Status do programa #${prog.id} atualizado para ${novoStatus}!`);
            loadProgramas();
        } catch (err) {
            console.error("Erro ao alterar status manualmente:", err);
            toast.error("Erro ao atualizar o status do programa.");
        }
    };

    // Filtragem + pré-parse de chapas (evita JSON.parse repetido no render por linha)
    const filteredProgramas = useMemo(() => {
        const term = searchQuery.toLowerCase();
        return programas
            .filter(p => {
                const nome = p.nome_programa ? p.nome_programa.toLowerCase() : '';
                const material = p.tipo_material ? p.tipo_material.toLowerCase() : '';
                const matchesSearch = nome.includes(term) || material.includes(term);
                const matchesMaquina = filterMaquinaId === 'all' || String(p.maquina_id) === String(filterMaquinaId);
                const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
                return matchesSearch && matchesMaquina && matchesStatus;
            })
            .map(p => {
                let _chapas = [];
                try {
                    const raw = typeof p.chapas_planejadas === 'string'
                        ? JSON.parse(p.chapas_planejadas)
                        : (p.chapas_planejadas || []);
                    _chapas = Array.isArray(raw) ? raw : [];
                } catch (_) {}
                return { ...p, _chapas };
            });
    }, [programas, searchQuery, filterMaquinaId, filterStatus]);

    const canChangeMachine = useMemo(() => {
        if (!editingProgId) return true;
        if (!editingProgram) return false;
        const concluidas = Number(editingProgram.chapas_concluidas || 0);
        const emAndamento = Number(editingProgram.chapas_em_andamento || 0);
        return concluidas === 0 && emAndamento === 0;
    }, [editingProgId, editingProgram]);

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scaleUp {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                .animate-fade-in {
                    animation: fadeIn 0.2s ease-out forwards;
                }
                .animate-scale-up {
                    animation: scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
            `}</style>

            {/* Cabeçalho Premium */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 text-white p-6 rounded-2xl shadow-xl border border-slate-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
                <div className="z-10">
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight">Programas CNC</h1>
                    <p className="text-xs md:text-sm text-slate-400 mt-1">Gerenciamento e liberação de arquivos de corte por equipamento e especificações de processo</p>
                </div>
                <button
                    onClick={() => {
                        setEditingProgId(null);
                        setEditingProgram(null);
                        setProgForm({
                            maquina_id: '',
                            nome_programa: '',
                            data_criacao: new Date().toISOString().substring(0, 10),
                            tempo_previsto: '00:00:00',
                            tipo_material: '',
                            quantidade_vezes: 1,
                            chapas_planejadas: [{ codigo: '', repeticoes: 1, tempo: '00:00:00', tipo: 'inteira' }],
                            criado_por: user?.NomeCompleto || user?.nome || '',
                            turno_previsao: 1,
                            recebedor_nome: '',
                            recebido_data: '',
                            recebido_hora: '',
                            notas_instrucoes: ''
                        });
                        setShowFormProg(true);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition-all shadow-md hover:scale-105 hover:-translate-y-0.5"
                >
                    <Plus size={16} /> Liberar Novo Programa
                </button>
            </div>

            {/* Barra de Filtros Unificada */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-center gap-4">
                {/* Busca Textual */}
                <div className="relative flex-1 w-full">
                    <input
                        type="text"
                        placeholder="Buscar por programa ou material..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full text-xs border border-slate-300 rounded-xl pl-9 pr-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-700"
                    />
                    <Search size={14} className="absolute left-3.5 top-3.5 text-slate-400" />
                </div>

                {/* Filtro de Máquina */}
                <div className="w-full md:w-64">
                    <select
                        value={filterMaquinaId}
                        onChange={(e) => setFilterMaquinaId(e.target.value)}
                        className="w-full text-xs border border-slate-300 rounded-xl p-3 bg-white font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all cursor-pointer"
                    >
                        <option value="all">Todas as Máquinas</option>
                        {maquinas.map(m => (
                            <option key={m.id} value={m.id}>
                                {m.nome} {m.tag_identificacao ? `[${m.tag_identificacao}]` : ''}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Filtro de Status */}
                <div className="w-full md:w-48">
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="w-full text-xs border border-slate-300 rounded-xl p-3 bg-white font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all cursor-pointer"
                    >
                        <option value="all">Todos os Status</option>
                        <option value="LIBERADO">LIBERADO</option>
                        <option value="EM_EXECUCAO">EM EXECUÇÃO</option>
                        <option value="EM_MONTAGEM">EM MONTAGEM</option>
                        <option value="CONCLUIDO">CONCLUÍDO</option>
                    </select>
                </div>

                {/* Botão Recarregar */}
                <button
                    onClick={loadProgramas}
                    className="flex items-center justify-center gap-1.5 bg-slate-100 text-slate-700 px-4 py-3 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors border border-slate-200 w-full md:w-auto shrink-0"
                >
                    <RefreshCw size={14} /> Atualizar
                </button>
            </div>

            {filterMaquinaId === 'all' && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-3 text-slate-500 text-xs">
                    <AlertCircle size={16} className="text-slate-400 shrink-0" />
                    <span>
                        <strong>Dica de Sequenciamento:</strong> Selecione uma máquina específica no filtro acima para poder reordenar a sequência de corte arrastando as linhas ou usando as setas.
                    </span>
                </div>
            )}

            {/* Tabela de Liberações */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {loadingProgramas ? (
                    <div className="p-16 flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                ) : filteredProgramas.length === 0 ? (
                    <div className="p-16 text-center text-slate-400 text-xs">
                        Nenhum programa cadastrado ou liberado com os filtros selecionados.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                                    <th className="px-5 py-4 w-12 text-center">ID</th>
                                    <th className="px-5 py-4 w-20 text-center">Seq.</th>
                                    <th className="px-5 py-4 w-28 text-center">Status</th>
                                    <th className="px-5 py-4">Programa CNC</th>
                                    <th className="px-5 py-4">Equipamento</th>
                                    <th className="px-5 py-4">Material</th>
                                    <th className="px-5 py-4 w-16 text-center">Turno</th>
                                    <th className="px-5 py-4 max-w-[280px]">Chapas do Lote</th>
                                    <th className="px-5 py-4">Tempo (Prev. / Exec.)</th>
                                    <th className="px-5 py-4">Assinatura / Controle</th>
                                    <th className="px-5 py-4 w-24 text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredProgramas.map((prog, idx) => (
                                    <tr 
                                        key={prog.id} 
                                        draggable={filterMaquinaId !== 'all'}
                                        onDragStart={(e) => handleDragStart(e, idx)}
                                        onDragOver={(e) => handleDragOver(e, idx)}
                                        onDrop={(e) => handleDrop(e, idx)}
                                        onDragEnd={() => setDraggedIndex(null)}
                                        className={`hover:bg-slate-50/50 transition-colors ${
                                            filterMaquinaId !== 'all' ? 'cursor-grab active:cursor-grabbing' : ''
                                        } ${draggedIndex === idx ? 'opacity-40 bg-slate-100 border-dashed border-indigo-300' : ''}`}
                                    >
                                        <td className="px-5 py-4 text-center font-bold text-slate-400 font-mono">
                                            <div className="flex items-center justify-center gap-1">
                                                {filterMaquinaId !== 'all' && (
                                                    <GripVertical size={12} className="text-slate-300 cursor-grab active:cursor-grabbing hover:text-slate-500 shrink-0" title="Arraste para reordenar" />
                                                )}
                                                <span>#{prog.id}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                                {filterMaquinaId !== 'all' && (
                                                    <div className="flex flex-col gap-0.5">
                                                        <button 
                                                            onClick={() => handleSubir(idx)} 
                                                            disabled={idx === 0}
                                                            className={`p-0.5 rounded hover:bg-slate-200 text-slate-500 transition-colors ${idx === 0 ? 'opacity-20 cursor-not-allowed' : ''}`}
                                                            title="Subir posição"
                                                        >
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7"></path>
                                                            </svg>
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDescer(idx)} 
                                                            disabled={idx === filteredProgramas.length - 1}
                                                            className={`p-0.5 rounded hover:bg-slate-200 text-slate-500 transition-colors ${idx === filteredProgramas.length - 1 ? 'opacity-20 cursor-not-allowed' : ''}`}
                                                            title="Descer posição"
                                                        >
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"></path>
                                                            </svg>
                                                        </button>
                                                    </div>
                                                )}
                                                <input 
                                                    type="number"
                                                    min="0"
                                                    key={prog.id + '-' + (prog.ordem_execucao || 0)}
                                                    defaultValue={prog.ordem_execucao || 0}
                                                    onBlur={(e) => handleUpdateOrdem(prog, e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            handleUpdateOrdem(prog, e.target.value);
                                                            e.target.blur();
                                                        }
                                                    }}
                                                    className="w-10 text-center border border-slate-200 rounded-lg p-1 text-[11px] font-bold focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 hover:bg-white transition-all outline-none font-mono"
                                                    title="Digite a ordem e clique fora ou aperte Enter"
                                                />
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-center">
                                            <div className="relative inline-block w-28">
                                                <select
                                                    value={prog.status}
                                                    onChange={(e) => handleStatusChange(prog, e.target.value)}
                                                    className={`w-full text-center appearance-none cursor-pointer font-black text-[9px] uppercase border tracking-wider rounded-full px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white ${
                                                        prog.status === 'CONCLUIDO' ? 'bg-green-50 text-green-700 border-green-200' :
                                                        prog.status === 'EM_EXECUCAO' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                        prog.status === 'EM_MONTAGEM' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                                        'bg-blue-50 text-blue-700 border-blue-200'
                                                    }`}
                                                >
                                                    <option value="LIBERADO">LIBERADO</option>
                                                    <option value="EM_EXECUCAO">EM EXECUÇÃO</option>
                                                    <option value="EM_MONTAGEM">EM MONTAGEM</option>
                                                    <option value="CONCLUIDO">CONCLUÍDO</option>
                                                </select>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 font-bold text-slate-800">
                                            <div>{prog.nome_programa}</div>
                                            <div className="text-[10px] font-normal text-slate-400 mt-0.5 font-sans">
                                                Criado por: {prog.criado_por} | Doc: {new Date(prog.data_criacao).toLocaleDateString('pt-BR')}
                                            </div>
                                            {prog.created_at && (
                                                <div className="text-[10px] font-semibold text-indigo-600 mt-1 flex items-center gap-1">
                                                    <Calendar size={10} />
                                                    <span>Liberado: {new Date(prog.created_at).toLocaleString('pt-BR')}</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="font-semibold text-slate-700">{prog.maquina_nome || `Máquina #${prog.maquina_id}`}</div>
                                            {prog.maquina_tag && <div className="text-[10px] text-slate-400 mt-0.5">TAG: {prog.maquina_tag}</div>}
                                        </td>
                                        <td className="px-5 py-4 text-slate-600 font-medium">{prog.tipo_material}</td>
                                        <td className="px-5 py-4 text-center font-bold text-slate-600 bg-slate-50/50">T{prog.turno_previsao}</td>
                                        <td className="px-5 py-4">
                                            <div className="flex flex-col gap-1.5">
                                                <span className="font-bold text-slate-700">{prog.quantidade_vezes} chapa(s)</span>
                                                <div className="flex flex-wrap gap-1 max-w-[280px]">
                                                    {prog._chapas.length > 0 ? (() => {
                                                        const limit = 2;
                                                        const visible = prog._chapas.slice(0, limit);
                                                        const restCount = prog._chapas.length - limit;
                                                        return (
                                                            <>
                                                                {visible.map((ch, i) => (
                                                                    <span key={i} className="bg-slate-50 text-slate-700 px-1.5 py-0.5 rounded-md font-mono text-[9px] border border-slate-200" title={typeof ch === 'string' ? ch : ch.codigo}>
                                                                        {typeof ch === 'string' ? ch : ch.codigo.substring(0, 15) + (ch.codigo.length > 15 ? '...' : '')}
                                                                    </span>
                                                                ))}
                                                                {restCount > 0 && (
                                                                    <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md text-[9px] font-bold border border-slate-200" title="Veja os detalhes na edição">
                                                                        +{restCount} mais
                                                                    </span>
                                                                )}
                                                            </>
                                                        );
                                                    })() : <span className="text-slate-400 text-[10px]">-</span>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            {(() => {
                                                const tempoPrevTotal = prog._chapas.length > 0
                                                    ? secondsToHhmmss(prog._chapas.reduce((sum, ch) => sum + hhmmssToSeconds(ch.tempo), 0))
                                                    : secondsToHhmmss(hhmmssToSeconds(prog.tempo_previsto) * prog.quantidade_vezes);
                                                const tempoRealTotal = secondsToHhmmss(prog.total_realizado_segundos || 0);
                                                return (
                                                    <div className="space-y-1 font-mono font-bold text-slate-700">
                                                        <div className="flex items-center gap-1.5 text-[11px]" title="Tempo Total Previsto para o Lote">
                                                            <Clock size={12} className="text-slate-400" />
                                                            <span>{tempoPrevTotal}</span>
                                                            <span className="text-[9px] text-slate-400 font-sans font-normal uppercase tracking-wider">(Prev)</span>
                                                        </div>
                                                        <div className={`flex items-center gap-1.5 text-[11px] ${prog.total_realizado_segundos > 0 ? 'text-green-600' : 'text-slate-400'}`} title="Tempo já Executado">
                                                            <RefreshCw size={12} className={prog.status === 'EM_EXECUCAO' ? 'animate-spin' : ''} />
                                                            <span>{tempoRealTotal}</span>
                                                            <span className="text-[9px] font-sans font-normal uppercase tracking-wider">(Exec)</span>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-5 py-4">
                                            {prog.recebedor_nome ? (
                                                <div className="space-y-0.5 text-slate-600">
                                                    <div className="font-semibold text-slate-800">{prog.recebedor_nome}</div>
                                                    <div className="text-[10px] text-slate-400">
                                                        {prog.recebido_data ? new Date(prog.recebido_data).toLocaleDateString('pt-BR') : ''} {prog.recebido_hora || ''}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-1 rounded inline-flex items-center gap-1">
                                                    <AlertCircle size={10} /> Pendente
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => handleEditProgram(prog)}
                                                    className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 p-2 rounded-xl transition-all"
                                                    title="Editar liberação"
                                                >
                                                    <Edit size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteProgram(prog.id)}
                                                    className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2 rounded-xl transition-all"
                                                    title="Excluir liberação"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal de Cadastro e Edição */}
            {showFormProg && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
                        {/* Modal Header */}
                        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50">
                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <FileText size={18} className="text-indigo-600" />
                                {editingProgId ? "Editar Liberação de Programa CNC" : "Nova Liberação de Arquivo CNC"}
                            </h4>
                            <button 
                                type="button" 
                                onClick={() => {
                                    setShowFormProg(false);
                                    setEditingProgId(null);
                                    setEditingProgram(null);
                                }}
                                className="text-slate-400 hover:text-red-500 hover:bg-slate-100 p-1.5 rounded-lg transition-all"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSubmitForm} className="flex-1 overflow-y-auto p-6 space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Seletor de Máquina de Destino */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Máquina de Destino *</label>
                                    <select
                                        required
                                        value={progForm.maquina_id}
                                        onChange={e => setProgForm({...progForm, maquina_id: e.target.value})}
                                        className={`w-full border rounded p-2 text-xs focus:ring-1 focus:ring-indigo-500 bg-white ${
                                            !canChangeMachine 
                                                ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed' 
                                                : 'border-slate-300 text-slate-800'
                                        }`}
                                        disabled={!canChangeMachine}
                                    >
                                        <option value="">Selecione uma máquina...</option>
                                        {maquinas.map(m => (
                                            <option key={m.id} value={m.id}>
                                                {m.nome} {m.tag_identificacao ? `[${m.tag_identificacao}]` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    {editingProgId && (
                                        <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-medium leading-normal">
                                            {canChangeMachine ? (
                                                <>
                                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0 animate-pulse" />
                                                    <span className="text-green-600">
                                                        Permitido alterar o equipamento pois nenhuma chapa deste lote foi iniciada.
                                                    </span>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                                                    <span className="text-amber-600">
                                                        Equipamento bloqueado pois já existem chapas em execução ou concluídas.
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Nome do Programa */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Nome do Programa CNC *</label>
                                    <input
                                        required
                                        type="text"
                                        value={progForm.nome_programa}
                                        onChange={e => setProgForm({...progForm, nome_programa: e.target.value})}
                                        className="w-full border border-slate-300 rounded p-2 text-xs focus:ring-1 focus:ring-indigo-500 font-bold"
                                        placeholder="Ex: PRG-1029-CNC"
                                    />
                                </div>

                                {/* Data de Criação */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Data de Criação *</label>
                                    <input
                                        required
                                        type="date"
                                        value={progForm.data_criacao}
                                        onChange={e => setProgForm({...progForm, data_criacao: e.target.value})}
                                        className="w-full border border-slate-300 rounded p-2 text-xs focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>

                                {/* Tipo de Material */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo de Material *</label>
                                    <input
                                        required
                                        type="text"
                                        value={progForm.tipo_material}
                                        onChange={e => setProgForm({...progForm, tipo_material: e.target.value})}
                                        className="w-full border border-slate-300 rounded p-2 text-xs focus:ring-1 focus:ring-indigo-500"
                                        placeholder="Ex: Chapa Fina Frio 1.5mm"
                                    />
                                </div>

                                {/* Turno Previsão */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Turno Previsão *</label>
                                    <select
                                        value={progForm.turno_previsao}
                                        onChange={e => setProgForm({...progForm, turno_previsao: parseInt(e.target.value) || 1})}
                                        className="w-full border border-slate-300 rounded p-2 text-xs bg-white focus:ring-1 focus:ring-indigo-500"
                                    >
                                        <option value="1">Turno 1</option>
                                        <option value="2">Turno 2</option>
                                        <option value="3">Turno 3</option>
                                        <option value="4">Turno 4</option>
                                    </select>
                                </div>

                                {/* Criado Por */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Criado Por *</label>
                                    <input
                                        required
                                        type="text"
                                        value={progForm.criado_por}
                                        onChange={e => setProgForm({...progForm, criado_por: e.target.value})}
                                        className="w-full border border-slate-300 rounded p-2 text-xs focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>

                                {/* Chapas Planejadas */}
                                <div className="col-span-1 md:col-span-2 border-t pt-3 mt-2">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-xs font-bold text-slate-700">Chapas Planejadas e Tempos Estimados *</label>
                                        <button
                                            type="button"
                                            onClick={handleAddChapaField}
                                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-0.5 border border-indigo-200 transition-colors"
                                        >
                                            <Plus size={10} /> Adicionar Chapa
                                        </button>
                                    </div>
                                    
                                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm max-h-56 overflow-y-auto">
                                        <table className="w-full text-left border-collapse text-xs">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                                                    <th className="px-4 py-2.5 w-10 text-center">#</th>
                                                    <th className="px-4 py-2.5">Código da Chapa *</th>
                                                    <th className="px-4 py-2.5 w-32 text-center">Tipo</th>
                                                    <th className="px-4 py-2.5 w-24 text-center">Repetições (x)</th>
                                                    <th className="px-4 py-2.5 w-32">Tempo / Chapa *</th>
                                                    <th className="px-4 py-2.5 w-32">Tempo Total</th>
                                                    <th className="px-4 py-2.5 w-12 text-center"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {progForm.chapas_planejadas.map((chapa, idx) => {
                                                    const totalSeconds = hhmmssToSeconds(chapa.tempo) * (parseInt(chapa.repeticoes) || 1);
                                                    const tempoTotal = secondsToHhmmss(totalSeconds);
                                                    return (
                                                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="px-4 py-2.5 text-slate-400 font-mono font-bold text-center">{idx + 1}</td>
                                                            <td className="px-4 py-2.5">
                                                                <input
                                                                    required
                                                                    type="text"
                                                                    value={chapa.codigo || ''}
                                                                    onChange={e => handleChapaFieldChange(idx, 'codigo', e.target.value)}
                                                                    placeholder="Ex: 4202 - Jabil-00005"
                                                                    className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-bold text-slate-700"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-2.5 text-center">
                                                                <div className="flex rounded-lg overflow-hidden border border-slate-200 text-[10px] font-bold w-fit mx-auto">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleChapaFieldChange(idx, 'tipo', 'inteira')}
                                                                        className={`px-2 py-1.5 transition-colors ${(chapa.tipo || 'inteira') === 'inteira' ? 'bg-emerald-500 text-white' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
                                                                    >
                                                                        Inteira
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleChapaFieldChange(idx, 'tipo', 'retalho')}
                                                                        className={`px-2 py-1.5 transition-colors ${(chapa.tipo || 'inteira') === 'retalho' ? 'bg-amber-500 text-white' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
                                                                    >
                                                                        Retalho
                                                                    </button>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-2.5">
                                                                <input
                                                                    required
                                                                    type="number"
                                                                    min="1"
                                                                    value={chapa.repeticoes || 1}
                                                                    onChange={e => handleChapaFieldChange(idx, 'repeticoes', parseInt(e.target.value) || 1)}
                                                                    className="w-full border border-slate-300 rounded-lg p-2 text-xs text-center focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-bold"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-2.5">
                                                                <input
                                                                    required
                                                                    type="text"
                                                                    pattern="[0-9]{2,}:[0-9]{2}:[0-9]{2}"
                                                                    value={chapa.tempo || '00:00:00'}
                                                                    onChange={e => handleChapaFieldChange(idx, 'tempo', e.target.value)}
                                                                    placeholder="00:00:00"
                                                                    className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-2.5 text-slate-600 font-mono font-bold">{tempoTotal}</td>
                                                            <td className="px-4 py-2.5 text-center">
                                                                {progForm.chapas_planejadas.length > 1 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemoveChapaField(idx)}
                                                                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-all"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                    
                                    {(() => {
                                        const totalChapasCalculadas = progForm.chapas_planejadas.reduce((sum, ch) => sum + (parseInt(ch.repeticoes) || 1), 0);
                                        const totalSecondsLote = progForm.chapas_planejadas.reduce((sum, ch) => sum + (hhmmssToSeconds(ch.tempo) * (parseInt(ch.repeticoes) || 1)), 0);
                                        return (
                                            <div className="text-[11px] text-slate-500 font-bold mt-2 flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                                                <div>
                                                    Total de Chapas Físicas: <span className="text-indigo-600 text-xs font-black ml-1">{totalChapasCalculadas}</span>
                                                </div>
                                                <div>
                                                    Tempo Total Estimado do Lote: <span className="text-slate-700 text-xs font-mono font-black ml-1">
                                                        {secondsToHhmmss(totalSecondsLote)}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* Controle de Recebimento Opcional */}
                            <div className="border-t pt-3 mt-3">
                                <h5 className="text-xs font-bold text-slate-700 mb-2">Campos de Controle de Recebimento (Pré-assinatura Opcional)</h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Nome do Recebedor</label>
                                        <input
                                            type="text"
                                            value={progForm.recebedor_nome || ''}
                                            onChange={e => setProgForm({...progForm, recebedor_nome: e.target.value})}
                                            className="w-full border border-slate-300 rounded p-2 text-xs focus:ring-1 focus:ring-indigo-500"
                                            placeholder="Operador / Supervisor"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Data / Hora de Recebimento</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="date"
                                                value={progForm.recebido_data || ''}
                                                onChange={e => setProgForm({...progForm, recebido_data: e.target.value})}
                                                className="w-full border border-slate-300 rounded p-2 text-xs focus:ring-1 focus:ring-indigo-500"
                                            />
                                            <input
                                                type="time"
                                                value={progForm.recebido_hora || ''}
                                                onChange={e => setProgForm({...progForm, recebido_hora: e.target.value})}
                                                className="w-full border border-slate-300 rounded p-2 text-xs focus:ring-1 focus:ring-indigo-500"
                                            />
                                        </div>
                                    </div>
                                    <div className="col-span-1 md:col-span-2">
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Notas de Instruções</label>
                                        <textarea
                                            rows="2"
                                            value={progForm.notas_instrucoes || ''}
                                            onChange={e => setProgForm({...progForm, notas_instrucoes: e.target.value})}
                                            className="w-full border border-slate-300 rounded p-2 text-xs resize-none focus:ring-1 focus:ring-indigo-500"
                                            placeholder="Instruções de bocal, velocidade, gás, etc..."
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer Controls */}
                            <div className="flex justify-end gap-2 border-t pt-3 mt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowFormProg(false);
                                        setEditingProgId(null);
                                        setEditingProgram(null);
                                    }}
                                    className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm"
                                >
                                    {editingProgId ? "Salvar Alterações" : "Liberar Programa"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
