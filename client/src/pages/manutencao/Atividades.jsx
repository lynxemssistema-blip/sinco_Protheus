import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import {
    ClipboardList, PenTool, CheckCircle2, AlertTriangle, Clock,
    RefreshCw, X, ChevronRight, Car, Cog, Wrench, Camera
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Configurações de estilo ──────────────────────────────────────────────────

const PRIORIDADE = {
    CRITICA: { badge: 'bg-red-100 text-red-800 border border-red-200',    dot: 'bg-red-500'    },
    ALTA:    { badge: 'bg-orange-100 text-orange-800 border border-orange-200', dot: 'bg-orange-500' },
    MEDIA:   { badge: 'bg-blue-100 text-blue-800 border border-blue-200',  dot: 'bg-blue-500'   },
    BAIXA:   { badge: 'bg-slate-100 text-slate-600 border border-slate-200', dot: 'bg-slate-400' },
};

const STATUS_OM = {
    SOLICITADA:      { label: 'Aguardando',    cls: 'bg-amber-100 text-amber-800'    },
    EM_ANDAMENTO:    { label: 'Em Andamento',  cls: 'bg-blue-100 text-blue-800'      },
    AGUARDANDO_PECA: { label: 'Aguard. Peça',  cls: 'bg-purple-100 text-purple-800'  },
    CONCLUIDA:       { label: 'Concluída',     cls: 'bg-green-100 text-green-800'    },
    CANCELADA:       { label: 'Cancelada',     cls: 'bg-slate-100 text-slate-600'    },
};

const TIPO_ICONE = {
    MAQUINA:     <Cog     size={15} />,
    EQUIPAMENTO: <Wrench  size={15} />,
    VEICULO:     <Car     size={15} />,
};

const TIPO_LABEL = {
    MAQUINA: 'Máquina', EQUIPAMENTO: 'Equipamento', VEICULO: 'Veículo'
};

// ── Componente principal ─────────────────────────────────────────────────────

export default function ManutencaoAtividades() {
    const { user } = useAuth();
    const [dados, setDados]           = useState({ checklists: [], ordens: [] });
    const [loading, setLoading]       = useState(false);
    const [dataFiltro, setDataFiltro] = useState(() => new Date().toISOString().slice(0, 10));
    const [apenasMinhas, setApenasMinhas] = useState(true);
    const [activeTab, setActiveTab]   = useState('checklists');

    // Modal preenchimento checklist
    const [ckModal, setCkModal]   = useState(null);
    const [respostas, setRespostas] = useState({});
    const [saving, setSaving]     = useState(false);

    // Modal atualização OM
    const [omModal, setOmModal]     = useState(null);
    const [omUpd, setOmUpd]         = useState({ status: '', obs: '' });

    // ── Carga de dados ───────────────────────────────────────────────────────

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/manutencao/atividades', {
                params: { data: dataFiltro }
            });
            setDados(data);
        } catch (err) {
            console.error("Erro ao carregar atividades:", err);
        } finally {
            setLoading(false);
        }
    }, [dataFiltro]);

    useEffect(() => { load(); }, [load]);

    // ── Filtragem por usuário ────────────────────────────────────────────────

    const uid = user?.idUsuario;

    const checklists = apenasMinhas && uid
        ? dados.checklists.filter(c => {
            const ops = Array.isArray(c.operadores) ? c.operadores : [];
            return ops.some(op =>
                String(typeof op === 'object' ? op.id_usuario : op) === String(uid)
            );
          })
        : dados.checklists;

    const ordensRaw = apenasMinhas && uid
        ? dados.ordens.filter(o =>
            String(o.tecnico_id) === String(uid) ||
            String(o.solicitante_id) === String(uid)
          )
        : dados.ordens;

    // Coloca 'EM_ANDAMENTO' no topo
    const ordens = [...ordensRaw].sort((a, b) => {
        if (a.status === 'EM_ANDAMENTO' && b.status !== 'EM_ANDAMENTO') return -1;
        if (b.status === 'EM_ANDAMENTO' && a.status !== 'EM_ANDAMENTO') return 1;
        return 0;
    });

    const ckPendentes   = checklists.filter(c => c.status === 'PENDENTE').length;
    const omPendentes   = ordens.length;

    // ── Checklist: abrir modal ───────────────────────────────────────────────

    const abrirChecklist = (tarefa) => {
        const init = {};
        tarefa.itens.forEach(i => { init[i.id] = { conforme: null, resposta: '', foto: '' }; });
        setRespostas(init);
        setCkModal(tarefa);
    };

    const setResp = (idItem, campo, valor) =>
        setRespostas(prev => ({ ...prev, [idItem]: { ...prev[idItem], [campo]: valor } }));

    const salvarChecklist = async () => {
        const faltam = ckModal.itens.filter(i => {
            if (!i.obrigatorio) return false;
            const r = respostas[i.id];
            if (!r) return true;
            return i.tipo_resposta === 'BOOLEAN' ? r.conforme === null : (!r.resposta && !r.foto);
        });
        if (faltam.length > 0) {
            alert(`Preencha todos os itens obrigatórios (${faltam.length} faltando).`);
            return;
        }
        const temNC = ckModal.itens
            .filter(i => i.tipo_resposta === 'BOOLEAN')
            .some(i => respostas[i.id]?.conforme === false);

        const respostasArr = ckModal.itens.map(i => ({
            id_item: i.id, pergunta: i.pergunta, tipo_resposta: i.tipo_resposta,
            conforme: respostas[i.id]?.conforme ?? null,
            resposta: respostas[i.id]?.resposta || '',
            foto:     respostas[i.id]?.foto     || ''
        }));
        try {
            setSaving(true);
            await api.post('/manutencao/checklists/diarios', {
                id_maquina:          ckModal.id_maquina,
                id_modelo_checklist: ckModal.id_modelo,
                id_operador:         uid || null,
                data_verificacao:    dataFiltro,
                status_geral:        temNC ? 'NAO_CONFORME' : 'CONFORME',
                respostas:           respostasArr
            });
            setCkModal(null);
            load();
        } catch (err) {
            console.error(err);
            alert("Erro ao salvar checklist.");
        } finally {
            setSaving(false);
        }
    };

    // ── OM: abrir modal ──────────────────────────────────────────────────────

    const abrirOM = (o) => {
        setOmModal(o);
        setOmUpd({ status: o.status, obs: o.observacoes_tecnicas || '' });
    };

    const salvarOM = async () => {
        try {
            setSaving(true);
            await api.put(`/manutencao/ordens/${omModal.id}/status`, {
                status:               omUpd.status,
                tecnico_id:           uid,
                observacoes_tecnicas: omUpd.obs,
                usuario_id:           uid,
                usuario_nome:         user?.NomeCompleto || 'Sistema'
            });
            setOmModal(null);
            load();
        } catch (err) {
            console.error(err);
            alert("Erro ao atualizar ordem.");
        } finally {
            setSaving(false);
        }
    };

    // ── Data formatada ───────────────────────────────────────────────────────

    const dataLabel = (() => {
        try {
            return format(new Date(dataFiltro + 'T12:00:00'), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
        } catch { return dataFiltro; }
    })();

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="p-6 h-full flex flex-col bg-slate-50 min-h-0">

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <ClipboardList className="text-indigo-600" size={26} />
                        Atividades de Manutenção
                    </h1>
                    <p className="text-sm text-slate-500 capitalize mt-0.5">{dataLabel}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <input
                        type="date"
                        value={dataFiltro}
                        onChange={e => setDataFiltro(e.target.value)}
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer bg-white border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 select-none">
                        <input
                            type="checkbox"
                            checked={apenasMinhas}
                            onChange={e => setApenasMinhas(e.target.checked)}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        Apenas minhas
                    </label>
                    <button
                        onClick={load}
                        className="flex items-center gap-1.5 text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 px-3 py-2 rounded-lg text-sm transition-colors"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        Atualizar
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-5">
                <TabBtn
                    active={activeTab === 'checklists'}
                    onClick={() => setActiveTab('checklists')}
                    icon={<ClipboardList size={15} />}
                    label="Checklists"
                    badge={ckPendentes > 0 ? `${ckPendentes} pendente${ckPendentes > 1 ? 's' : ''}` : null}
                    badgeCls="bg-amber-100 text-amber-700"
                    badgeActiveCls="bg-white text-indigo-600"
                />
                <TabBtn
                    active={activeTab === 'ordens'}
                    onClick={() => setActiveTab('ordens')}
                    icon={<PenTool size={15} />}
                    label="Ordens de Manutenção"
                    badge={omPendentes > 0 ? String(omPendentes) : null}
                    badgeCls="bg-red-100 text-red-700"
                    badgeActiveCls="bg-white text-indigo-600"
                />
            </div>

            {/* Conteúdo */}
            {loading ? (
                <div className="flex justify-center items-center flex-1 p-12">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto space-y-3 pb-2">
                    {activeTab === 'checklists' && (
                        checklists.length === 0
                            ? <Empty icon={<ClipboardList className="w-14 h-14" />}
                                     title="Nenhum checklist para hoje"
                                     desc="Nenhuma máquina possui checklists configurados ou você não está vinculado a nenhuma." />
                            : checklists.map(t => (
                                <ChecklistCard key={t.key} tarefa={t} onRealizar={() => abrirChecklist(t)} />
                              ))
                    )}
                    {activeTab === 'ordens' && (
                        ordens.length === 0
                            ? <Empty icon={<PenTool className="w-14 h-14" />}
                                     title="Nenhuma ordem ativa"
                                     desc="Não há ordens de manutenção em aberto no momento." />
                            : ordens.map(o => (
                                <OrdemCard key={o.id} ordem={o} uid={uid} onAtualizar={() => abrirOM(o)} />
                              ))
                    )}
                </div>
            )}

            {/* Modal: Preencher Checklist */}
            {ckModal && (
                <ChecklistModal
                    tarefa={ckModal}
                    respostas={respostas}
                    setResp={setResp}
                    saving={saving}
                    onSave={salvarChecklist}
                    onClose={() => setCkModal(null)}
                />
            )}

            {/* Modal: Atualizar OM */}
            {omModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                        <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                            <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                <PenTool size={18} className="text-indigo-600" />
                                O.M. #{String(omModal.id).padStart(4, '0')} — {omModal.maquina_nome}
                            </h2>
                            <button onClick={() => setOmModal(null)} className="text-slate-400 hover:text-red-500"><X size={20} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Novo Status</label>
                                <select
                                    value={omUpd.status}
                                    onChange={e => setOmUpd(p => ({ ...p, status: e.target.value }))}
                                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                                >
                                    <option value="SOLICITADA">Aguardando Atribuição</option>
                                    <option value="EM_ANDAMENTO">Em Andamento</option>
                                    <option value="AGUARDANDO_PECA">Aguardando Peça / Material</option>
                                    <option value="CONCLUIDA">Concluída</option>
                                    <option value="CANCELADA">Cancelada</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Observações Técnicas</label>
                                <textarea
                                    value={omUpd.obs}
                                    onChange={e => setOmUpd(p => ({ ...p, obs: e.target.value }))}
                                    rows="3"
                                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 resize-none"
                                    placeholder="Peças trocadas, diagnóstico, causa raiz..."
                                />
                            </div>
                        </div>
                        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-xl">
                            <button onClick={() => setOmModal(null)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg text-sm">Cancelar</button>
                            <button onClick={salvarOM} disabled={saving} className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm">
                                {saving ? 'Salvando...' : 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Sub-componentes ──────────────────────────────────────────────────────────

function TabBtn({ active, onClick, icon, label, badge, badgeCls, badgeActiveCls }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                active ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
        >
            {icon} {label}
            {badge && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${active ? badgeActiveCls : badgeCls}`}>
                    {badge}
                </span>
            )}
        </button>
    );
}

function Empty({ icon, title, desc }) {
    return (
        <div className="text-center p-16 border-2 border-dashed border-slate-200 rounded-xl bg-white">
            <div className="text-slate-300 flex justify-center mb-3">{icon}</div>
            <h3 className="text-lg font-bold text-slate-700">{title}</h3>
            <p className="text-slate-500 mt-1 text-sm">{desc}</p>
        </div>
    );
}

function ChecklistCard({ tarefa, onRealizar }) {
    const pendente    = tarefa.status === 'PENDENTE';
    const conforme    = tarefa.status === 'CONFORME';
    const naoConforme = tarefa.status === 'NAO_CONFORME';

    const borderCls = pendente ? 'border-l-amber-400' : conforme ? 'border-l-green-400' : 'border-l-red-400';
    const iconBg    = pendente ? 'bg-amber-50 text-amber-500' : conforme ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600';
    const Icon      = pendente ? Clock : conforme ? CheckCircle2 : AlertTriangle;

    const tipoLabel = TIPO_LABEL[tarefa.maquina_tipo] || 'Máquina';
    const tipoIcon  = TIPO_ICONE[tarefa.maquina_tipo] || TIPO_ICONE.MAQUINA;

    return (
        <div className={`bg-white rounded-xl border-l-4 ${borderCls} shadow-sm px-4 py-3.5 flex items-center gap-4 hover:shadow-md transition-shadow`}>
            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${iconBg}`}>
                <Icon size={20} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-slate-400 flex items-center gap-1">{tipoIcon}<span className="text-[10px] uppercase font-bold text-slate-400">{tipoLabel}</span></span>
                    <span className="font-bold text-slate-800 truncate">{tarefa.maquina_nome}</span>
                    {tarefa.maquina_tag && (
                        <span className="font-mono text-[11px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded shrink-0">{tarefa.maquina_tag}</span>
                    )}
                </div>
                <p className="text-sm text-slate-600 mt-0.5">{tarefa.modelo_nome}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                    <FreqBadge tipo={tarefa.modelo_tipo} />
                    <span>{tarefa.num_itens} item{tarefa.num_itens !== 1 ? 's' : ''}</span>
                    {!pendente && tarefa.operador_nome && <span>Realizado por {tarefa.operador_nome}</span>}
                </div>
            </div>
            <div className="flex-shrink-0">
                {pendente ? (
                    <button
                        onClick={onRealizar}
                        className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-semibold shadow-sm transition-colors"
                    >
                        Realizar <ChevronRight size={15} />
                    </button>
                ) : (
                    <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${conforme ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {conforme ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                        {conforme ? 'Conforme' : 'Não Conforme'}
                    </span>
                )}
            </div>
        </div>
    );
}

function FreqBadge({ tipo }) {
    const cls = {
        DIARIO:    'bg-blue-100 text-blue-700',
        SEMANAL:   'bg-violet-100 text-violet-700',
        MENSAL:    'bg-teal-100 text-teal-700',
        PREVENTIVA:'bg-orange-100 text-orange-700',
    }[tipo] || 'bg-slate-100 text-slate-500';
    return <span className={`px-1.5 py-0.5 rounded uppercase font-bold text-[9px] ${cls}`}>{tipo}</span>;
}

function OrdemCard({ ordem, uid, onAtualizar }) {
    const pr   = PRIORIDADE[ordem.prioridade] || PRIORIDADE.MEDIA;
    const st   = STATUS_OM[ordem.status]       || {};
    const minha = String(ordem.tecnico_id) === String(uid);

    return (
        <div className={`bg-white rounded-xl border shadow-sm px-4 py-3.5 hover:shadow-md transition-shadow ${minha ? 'border-indigo-200' : 'border-slate-200'}`}>
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                    <div className="bg-indigo-50 text-indigo-600 p-2 rounded-lg mt-0.5 flex-shrink-0">
                        <PenTool size={17} />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-mono text-xs font-bold text-slate-400">#{String(ordem.id).padStart(4,'0')}</span>
                            <span className="font-bold text-slate-800 truncate">{ordem.maquina_nome}</span>
                            {ordem.tag_identificacao && (
                                <span className="font-mono text-[11px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{ordem.tag_identificacao}</span>
                            )}
                            {minha && <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">Atribuída a mim</span>}
                            {ordem.status === 'EM_ANDAMENTO' && (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded animate-pulse">
                                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span> Em Execução
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-slate-600 line-clamp-2 mb-2">{ordem.descricao_problema}</p>
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                            <span className={`px-2 py-0.5 rounded-full font-bold ${pr.badge}`}>{ordem.prioridade}</span>
                            <span className={`px-2 py-0.5 rounded-full font-bold ${st.cls}`}>{st.label || ordem.status}</span>
                            <span className="text-slate-400">{ordem.tipo_manutencao}</span>
                            {ordem.tecnico_nome && <span className="text-slate-400">Técnico: {ordem.tecnico_nome}</span>}
                        </div>
                    </div>
                </div>
                <button
                    onClick={onAtualizar}
                    className="flex-shrink-0 flex items-center gap-1.5 bg-slate-100 text-slate-700 hover:bg-indigo-600 hover:text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                    Atualizar
                </button>
            </div>
        </div>
    );
}

// ── Modal de preenchimento do Checklist (Poka-Yoke) ─────────────────────────

function ChecklistModal({ tarefa, respostas, setResp, saving, onSave, onClose }) {
    const preenchidos = tarefa.itens.filter(i => {
        const r = respostas[i.id];
        if (!r) return false;
        return i.tipo_resposta === 'BOOLEAN' ? r.conforme !== null : (r.resposta || r.foto);
    }).length;

    const progresso = tarefa.itens.length > 0 ? (preenchidos / tarefa.itens.length) * 100 : 0;
    const temNC     = tarefa.itens.some(i => respostas[i.id]?.conforme === false);

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh]">

                {/* Cabeçalho */}
                <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-slate-50 rounded-t-2xl flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 uppercase tracking-wide mb-0.5">
                            {TIPO_ICONE[tarefa.maquina_tipo] || TIPO_ICONE.MAQUINA}
                            {tarefa.maquina_nome} {tarefa.maquina_tag ? `· ${tarefa.maquina_tag}` : ''}
                        </div>
                        <h2 className="text-xl font-bold text-slate-800">{tarefa.modelo_nome}</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-red-500 ml-4 flex-shrink-0"><X size={24} /></button>
                </div>

                {/* Barra de progresso */}
                <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/60">
                    <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                        <span>{preenchidos} de {tarefa.itens.length} itens preenchidos</span>
                        {temNC && <span className="text-red-600 font-bold flex items-center gap-1"><AlertTriangle size={11} /> Não conformidade detectada</span>}
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-300 ${temNC ? 'bg-red-400' : progresso === 100 ? 'bg-green-500' : 'bg-indigo-500'}`}
                            style={{ width: `${progresso}%` }}
                        />
                    </div>
                </div>

                {/* Itens */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {tarefa.itens.map((item, idx) => (
                        <ItemChecklist
                            key={item.id}
                            item={item}
                            idx={idx}
                            resposta={respostas[item.id] || { conforme: null, resposta: '', foto: '' }}
                            setResp={(campo, valor) => setResp(item.id, campo, valor)}
                        />
                    ))}
                </div>

                {/* Rodapé */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center rounded-b-2xl">
                    <div className="text-sm">
                        {temNC && <span className="text-red-600 font-semibold">⚠ Será registrado como NÃO CONFORME</span>}
                        {!temNC && preenchidos === tarefa.itens.length && tarefa.itens.length > 0 && (
                            <span className="text-green-600 font-semibold">✓ Tudo conforme — pronto para salvar</span>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg text-sm">Cancelar</button>
                        <button
                            onClick={onSave}
                            disabled={saving}
                            className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm flex items-center gap-2"
                        >
                            {saving ? 'Salvando...' : <><CheckCircle2 size={15} /> Confirmar Checklist</>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ItemChecklist({ item, idx, resposta, setResp }) {
    const temPokayoke = item.foto_certo || item.foto_errado;
    const preenchido  = item.tipo_resposta === 'BOOLEAN'
        ? resposta.conforme !== null
        : (resposta.resposta || resposta.foto);

    return (
        <div className={`border rounded-xl overflow-hidden transition-colors ${preenchido ? 'border-slate-200' : 'border-slate-200'}`}>

            {/* Pergunta */}
            <div className="bg-slate-50 px-4 py-3 flex items-start gap-3 border-b border-slate-100">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center mt-0.5">{idx + 1}</span>
                <div>
                    <p className="font-semibold text-slate-800 text-sm leading-snug">{item.pergunta}</p>
                    {item.obrigatorio && <span className="text-xs text-red-500 font-medium">* Obrigatório</span>}
                </div>
                {preenchido && (
                    <CheckCircle2 size={16} className="text-green-500 flex-shrink-0 mt-0.5 ml-auto" />
                )}
            </div>

            {/* Referência visual Poka-Yoke */}
            {temPokayoke && (
                <div className="px-4 py-3 bg-white border-b border-slate-100 grid grid-cols-2 gap-3">
                    {item.foto_certo && (
                        <div className="rounded-lg overflow-hidden border border-green-200">
                            <div className="bg-green-100 px-2 py-1 text-[10px] font-bold text-green-700 uppercase">✅ Padrão Correto</div>
                            <img src={item.foto_certo} alt="Correto" className="w-full h-28 object-cover" />
                        </div>
                    )}
                    {item.foto_errado && (
                        <div className="rounded-lg overflow-hidden border border-red-200">
                            <div className="bg-red-100 px-2 py-1 text-[10px] font-bold text-red-700 uppercase">❌ Padrão Incorreto</div>
                            <img src={item.foto_errado} alt="Incorreto" className="w-full h-28 object-cover" />
                        </div>
                    )}
                </div>
            )}

            {/* Widget de resposta */}
            <div className="px-4 py-3 bg-white">
                {item.tipo_resposta === 'BOOLEAN' && (
                    <div className="flex gap-3">
                        <BoolBtn
                            ativo={resposta.conforme === true}
                            onClick={() => setResp('conforme', true)}
                            cls="border-green-300 text-green-700 bg-green-50 hover:bg-green-100"
                            ativoCls="bg-green-500 text-white border-green-500"
                            icon={<CheckCircle2 size={17} />}
                            label="CONFORME"
                        />
                        <BoolBtn
                            ativo={resposta.conforme === false}
                            onClick={() => setResp('conforme', false)}
                            cls="border-red-300 text-red-700 bg-red-50 hover:bg-red-100"
                            ativoCls="bg-red-500 text-white border-red-500"
                            icon={<AlertTriangle size={17} />}
                            label="NÃO CONFORME"
                        />
                    </div>
                )}
                {item.tipo_resposta === 'TEXT' && (
                    <textarea
                        value={resposta.resposta}
                        onChange={e => setResp('resposta', e.target.value)}
                        rows="2"
                        className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 resize-none"
                        placeholder="Descreva o que foi observado..."
                    />
                )}
                {item.tipo_resposta === 'NUMBER' && (
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            value={resposta.resposta}
                            onChange={e => setResp('resposta', e.target.value)}
                            step="0.01"
                            className="w-32 border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
                            placeholder="0,00"
                        />
                        <span className="text-sm text-slate-500">Informe a medida / valor</span>
                    </div>
                )}
                {item.tipo_resposta === 'PHOTO' && (
                    resposta.foto ? (
                        <div className="flex items-center gap-3">
                            <img src={resposta.foto} alt="Evidência" className="w-20 h-20 object-cover rounded-lg border border-slate-200 shadow-sm" />
                            <button type="button" onClick={() => setResp('foto', '')} className="text-red-500 text-sm font-medium hover:text-red-700">Remover foto</button>
                        </div>
                    ) : (
                        <label className="flex items-center gap-2 text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-4 py-2.5 rounded-lg cursor-pointer w-fit transition-colors">
                            <Camera size={17} /> Tirar / Selecionar Foto
                            <input
                                type="file" accept="image/*" capture="environment" className="hidden"
                                onChange={e => {
                                    const f = e.target.files[0];
                                    if (!f) return;
                                    const rd = new FileReader();
                                    rd.onloadend = () => setResp('foto', rd.result);
                                    rd.readAsDataURL(f);
                                }}
                            />
                        </label>
                    )
                )}
            </div>
        </div>
    );
}

function BoolBtn({ ativo, onClick, cls, ativoCls, icon, label }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-sm border-2 transition-all ${ativo ? ativoCls + ' shadow-md' : cls}`}
        >
            {icon} {label}
        </button>
    );
}
