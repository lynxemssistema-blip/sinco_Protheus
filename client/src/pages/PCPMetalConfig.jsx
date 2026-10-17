import React, { useState, useEffect } from 'react';
import { Bot, Plus, Edit2, Trash2, Save, X, ChevronDown, ChevronUp, Database, MessageSquare, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
import api from '../services/api';
import PromptCopilot from '../components/PromptCopilot';


const PAPEL_OPTIONS = [
    { value: 'orquestrador', label: 'Orquestrador', color: 'bg-cyan-100 text-cyan-700' },
    { value: 'analista_sql', label: 'Analista SQL', color: 'bg-blue-100 text-blue-700' },
    { value: 'estrategista', label: 'Estrategista', color: 'bg-emerald-100 text-emerald-700' },
    { value: 'especialista', label: 'Especialista', color: 'bg-amber-100 text-amber-700' },
];

const MODELOS = [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash-001',
    'gemini-2.0-flash-lite',
];

const emptyAgent = {
    nome: '',
    papel: 'especialista',
    system_prompt: '',
    contexto_negocio: '',
    modelo: 'gemini-2.5-flash',
    ativo: 1
};

function PapelBadge({ papel }) {
    const opt = PAPEL_OPTIONS.find(o => o.value === papel) || { label: papel, color: 'bg-slate-100 text-slate-700' };
    return <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${opt.color}`}>{opt.label}</span>;
}

// ── Visual explanation of how agents work together ──────────────────────────
function AgentFlowPanel() {
    const [open, setOpen] = React.useState(false);

    const steps = [
        {
            icon: '💬',
            role: 'Usuário',
            color: 'bg-slate-100 border-slate-300 text-slate-700',
            dot: 'bg-slate-400',
            title: 'Faz uma pergunta',
            desc: 'O usuário pergunta algo no chat do PCPMetal, com contexto de pedido e cliente injetado automaticamente.'
        },
        {
            icon: '🦖',
            role: 'Orquestrador',
            color: 'bg-blue-50 border-blue-300 text-blue-800',
            dot: 'bg-blue-500',
            title: 'Coordena os agentes',
            desc: 'Recebe a pergunta, carrega o esquema dos bancos e decide quais agentes acionar e em que ordem.'
        },
        {
            icon: '🔍',
            role: 'Analista SQL',
            color: 'bg-indigo-50 border-indigo-300 text-indigo-800',
            dot: 'bg-indigo-500',
            title: 'Gera as consultas SQL',
            desc: 'Analisa a pergunta e o esquema das tabelas (Protheus + Lynx) e gera as consultas SELECT necessárias para coletar os dados.'
        },
        {
            icon: '⚙️',
            role: 'Sistema',
            color: 'bg-amber-50 border-amber-300 text-amber-800',
            dot: 'bg-amber-500',
            title: 'Executa as consultas',
            desc: 'O sistema executa as queries geradas (somente SELECT) no PostgreSQL (Protheus) e/ou MySQL (App Lynx) de forma segura.'
        },
        {
            icon: '🧠',
            role: 'Estrategista',
            color: 'bg-emerald-50 border-emerald-300 text-emerald-800',
            dot: 'bg-emerald-500',
            title: 'Analisa e gera o relatório',
            desc: 'Recebe os dados coletados e elabora um relatório técnico em Markdown com status, riscos, quantidade faltante e estratégia de ação para o PCP.'
        },
        {
            icon: '📄',
            role: 'Resposta',
            color: 'bg-slate-100 border-slate-300 text-slate-700',
            dot: 'bg-slate-400',
            title: 'Relatório entregue',
            desc: 'O relatório final é exibido no chat com histtórico salvo. O usuário pode continuar a conversa com perguntas de acompanhamento.'
        },
    ];

    return (
        <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-slate-50 overflow-hidden">
            {/* Header toggle */}
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-blue-100/50 transition-colors"
            >
                <div className="flex items-center gap-2.5">
                    <span className="text-lg">🔄</span>
                    <div>
                        <span className="font-bold text-blue-900 text-sm">Como os Agentes Trabalham Juntos</span>
                        <span className="text-[11px] text-blue-600 ml-2">{open ? 'clique para fechar' : 'clique para entender o fluxo'}</span>
                    </div>
                </div>
                <span className="text-blue-400 text-lg">{open ? '▲' : '▼'}</span>
            </button>

            {open && (
                <div className="px-5 pb-5">
                    {/* Flow steps */}
                    <div className="relative">
                        {/* Vertical connector line */}
                        <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-slate-300 to-emerald-300" />

                        <div className="space-y-3">
                            {steps.map((step, i) => (
                                <div key={i} className="flex gap-3 relative">
                                    {/* Dot */}
                                    <div className={`shrink-0 w-10 h-10 rounded-full ${step.dot} flex items-center justify-center text-white text-base shadow-sm z-10`}>
                                        {step.icon}
                                    </div>
                                    {/* Card */}
                                    <div className={`flex-1 border rounded-xl px-4 py-2.5 ${step.color}`}>
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">{step.role}</span>
                                            <span className="font-bold text-sm">{step.title}</span>
                                        </div>
                                        <p className="text-[11px] leading-relaxed opacity-80">{step.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Tips */}
                    <div className="mt-4 bg-white/70 border border-blue-100 rounded-xl px-4 py-3 space-y-1.5">
                        <p className="text-[11px] font-bold text-blue-800 uppercase tracking-wide">💡 Dicas de configuração</p>
                        <ul className="space-y-1">
                            {[
                                'O System Prompt define a personalidade e as regras do agente — seja específico e detalhado.',
                                'O Contexto de Negócio é injetado junto com o prompt — use para descrever prazos, prioridades e regras da Lynx.',
                                'O Contexto de Tabelas ensina ao Analista SQL quais tabelas existem e quando usá-las — quanto mais rico, melhor as queries.',
                                'Desative agentes com o toggle para tirá-los do fluxo sem precisar deletá-los.',
                                'O histórico de conversas fica na aba Histórico para auditoria e acompanhamento.',
                            ].map((tip, i) => (
                                <li key={i} className="flex gap-2 text-[11px] text-slate-600">
                                    <span className="text-blue-400 shrink-0 mt-0.5">•</span>
                                    {tip}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function PCPMetalConfig() {
    const [tab, setTab] = useState('agentes'); // 'agentes' | 'schema' | 'historico'
    const [agents, setAgents] = useState([]);
    const [schema, setSchema] = useState([]);
    const [historico, setHistorico] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editAgent, setEditAgent] = useState(null); // null = list, object = editing
    const [editSchema, setEditSchema] = useState(null);
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [expandedHistory, setExpandedHistory] = useState({});

    useEffect(() => {
        if (tab === 'agentes') loadAgents();
        if (tab === 'schema') loadSchema();
        if (tab === 'historico') loadHistorico();
    }, [tab]);

    async function loadAgents() {
        setLoading(true);
        try {
            const res = await api.get('/pcpmetal/agentes');
            setAgents(res.data || []);
        } finally { setLoading(false); }
    }

    async function loadSchema() {
        setLoading(true);
        try {
            const res = await api.get('/pcpmetal/schema');
            setSchema(res.data || []);
        } finally { setLoading(false); }
    }

    async function loadHistorico() {
        setLoading(true);
        try {
            const res = await api.get('/pcpmetal/conversas?limit=50');
            setHistorico(res.data || []);
        } finally { setLoading(false); }
    }

    async function handleSyncSchema() {
        setSyncing(true);
        try {
            const res = await api.post('/pcpmetal/schema/sync');
            alert(res.data.message || 'Estruturas sincronizadas com sucesso.');
            loadSchema();
        } catch (err) {
            console.error('Erro ao sincronizar estruturas:', err);
            alert('Falha ao sincronizar estruturas: ' + (err.response?.data?.error || err.message));
        } finally {
            setSyncing(false);
        }
    }

    async function saveAgent() {
        setSaving(true);
        try {
            if (editAgent.id) {
                await api.put(`/pcpmetal/agentes/${editAgent.id}`, editAgent);
            } else {
                await api.post('/pcpmetal/agentes', editAgent);
            }
            setEditAgent(null);
            loadAgents();
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao salvar agente.');
        } finally { setSaving(false); }
    }

    async function deleteAgent(id) {
        if (!window.confirm('Remover este agente?')) return;
        await api.delete(`/pcpmetal/agentes/${id}`);
        loadAgents();
    }

    async function toggleAgent(agent) {
        await api.put(`/pcpmetal/agentes/${agent.id}`, { ...agent, ativo: agent.ativo ? 0 : 1 });
        loadAgents();
    }

    async function saveSchema(row) {
        setSaving(true);
        try {
            if (row.id) {
                await api.put(`/pcpmetal/schema/${row.id}`, row);
            } else {
                await api.post('/pcpmetal/schema', row);
            }
            setEditSchema(null);
            loadSchema();
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao salvar schema.');
        } finally { setSaving(false); }
    }

    async function deleteSchema(id) {
        if (!window.confirm('Remover esta entrada de schema? Isso afetará o contexto dos agentes.')) return;
        try {
            await api.delete(`/pcpmetal/schema/${id}`);
            loadSchema();
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao remover.');
        }
    }

    async function toggleSchema(row) {
        try {
            await api.put(`/pcpmetal/schema/${row.id}`, { ...row, ativo: row.ativo ? 0 : 1 });
            loadSchema();
        } catch (err) { /* silent */ }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-md">
                    <Bot className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-900">PCPMetal — Inteligência Artificial</h2>
                    <p className="text-sm text-slate-500">Configure, treine e gerencie os agentes de IA do sistema</p>
                </div>
            </div>

            {/* How agents work together */}
            <AgentFlowPanel />

            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-200">
                {[
                    { key: 'agentes', label: 'Agentes', icon: Bot },
                    { key: 'schema', label: 'Contexto de Tabelas', icon: Database },
                    { key: 'historico', label: 'Histórico', icon: MessageSquare }
                ].map(({ key, label, icon: Icon }) => (
                    <button
                        key={key}
                        onClick={() => setTab(key)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        <Icon className="w-4 h-4" />
                        {label}
                    </button>
                ))}
            </div>

            {/* TAB: AGENTES */}
            {tab === 'agentes' && (
                <div>
                    {editAgent ? (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-bold text-slate-800">{editAgent.id ? `Editando: ${editAgent.nome}` : 'Novo Agente'}</h3>
                                <button onClick={() => setEditAgent(null)} className="p-1.5 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nome do Agente</label>
                                    <input className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                        value={editAgent.nome} onChange={e => setEditAgent(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Analista SQL PCPMetal" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Papel</label>
                                    <select className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                        value={editAgent.papel} onChange={e => setEditAgent(p => ({ ...p, papel: e.target.value }))}>
                                        {PAPEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Modelo Gemini</label>
                                <select className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    value={editAgent.modelo} onChange={e => setEditAgent(p => ({ ...p, modelo: e.target.value }))}>
                                    {MODELOS.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-xs font-bold text-slate-400 uppercase">System Prompt <span className="text-red-500">*</span></label>
                                    <PromptCopilot
                                        fieldType="system_prompt"
                                        agentRole={editAgent.papel}
                                        agentNome={editAgent.nome}
                                        currentText={editAgent.system_prompt}
                                        onApply={(text) => setEditAgent(p => ({ ...p, system_prompt: text }))}
                                    />
                                </div>
                                <textarea
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500 min-h-[200px] resize-y"
                                    value={editAgent.system_prompt}
                                    onChange={e => setEditAgent(p => ({ ...p, system_prompt: e.target.value }))}
                                    placeholder="Instrução fundamental que define a personalidade e as capacidades deste agente..."
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-xs font-bold text-slate-400 uppercase">Contexto de Negócio</label>
                                    <PromptCopilot
                                        fieldType="contexto_negocio"
                                        agentRole={editAgent.papel}
                                        agentNome={editAgent.nome}
                                        currentText={editAgent.contexto_negocio}
                                        onApply={(text) => setEditAgent(p => ({ ...p, contexto_negocio: text }))}
                                    />
                                </div>
                                <textarea
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px] resize-y"
                                    value={editAgent.contexto_negocio || ''}
                                    onChange={e => setEditAgent(p => ({ ...p, contexto_negocio: e.target.value }))}
                                    placeholder="Regras de negócio da empresa: lead times, sazonalidade, prioridades, etc..."
                                />
                            </div>

                            <div className="flex gap-3 justify-end">
                                <button onClick={() => setEditAgent(null)} className="px-5 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50">
                                    Cancelar
                                </button>
                                <button
                                    onClick={saveAgent}
                                    disabled={saving || !editAgent.nome || !editAgent.system_prompt}
                                    className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-700 rounded-xl hover:bg-blue-800 disabled:opacity-40"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Salvar Agente
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <button
                                onClick={() => setEditAgent({ ...emptyAgent })}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white text-sm font-semibold rounded-xl hover:bg-blue-800"
                            >
                                <Plus className="w-4 h-4" /> Novo Agente
                            </button>

                            {loading ? (
                                <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
                            ) : (
                                <div className="space-y-3">
                                    {(agents || []).map(agent => (
                                        <div key={agent.id} className={`bg-white border rounded-2xl p-4 flex items-start gap-4 shadow-sm ${agent.ativo ? '' : 'opacity-50'}`}>
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-900 flex items-center justify-center shrink-0">
                                                <Bot className="w-5 h-5 text-white" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-bold text-slate-800 text-sm">{agent.nome}</span>
                                                    <PapelBadge papel={agent.papel} />
                                                    <span className="text-[10px] text-slate-400 font-mono">{agent.modelo}</span>
                                                </div>
                                                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{agent.system_prompt}</p>
                                                {agent.contexto_negocio && (
                                                    <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">📋 Contexto: {agent.contexto_negocio}</p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <button onClick={() => toggleAgent(agent)} title={agent.ativo ? 'Desativar' : 'Ativar'}>
                                                    {agent.ativo
                                                        ? <ToggleRight className="w-6 h-6 text-emerald-500 hover:text-emerald-700" />
                                                        : <ToggleLeft className="w-6 h-6 text-slate-400 hover:text-slate-600" />}
                                                </button>
                                                <button onClick={() => setEditAgent({ ...agent })} className="p-1.5 text-slate-400 hover:text-blue-600">
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => deleteAgent(agent.id)} className="p-1.5 text-slate-400 hover:text-red-500">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* TAB: SCHEMA */}
            {tab === 'schema' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-slate-500">Descreva as tabelas para que os agentes entendam a estrutura dos dados. Injetadas automaticamente no contexto de cada agente.</p>
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={handleSyncSchema}
                                disabled={syncing}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-50"
                            >
                                {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>🔄</span>}
                                {syncing ? 'Sincronizando...' : 'Atualizar Estruturas'}
                            </button>
                            <button
                                onClick={() => setEditSchema({ banco: 'postgresql', tabela: '', descricao: '', colunas_chave: '', ativo: 1 })}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white text-sm font-semibold rounded-xl hover:bg-blue-800"
                            >
                                <Plus className="w-4 h-4" /> Nova Tabela
                            </button>
                        </div>
                    </div>

                    {/* New / Edit form (shown as a card above the list) */}
                    {editSchema && (
                        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-blue-900">
                                    {editSchema.id ? `Editando: ${editSchema.tabela}` : 'Nova entrada de contexto'}
                                </h3>
                                <button onClick={() => setEditSchema(null)} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Banco</label>
                                    <select
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                        value={editSchema.banco}
                                        onChange={e => setEditSchema(p => ({ ...p, banco: e.target.value }))}
                                    >
                                        <option value="postgresql">PostgreSQL (Protheus)</option>
                                        <option value="mysql">MySQL (App Lynx)</option>
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nome da Tabela <span className="text-red-500">*</span></label>
                                    <input
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                        placeholder="Ex: SC5010"
                                        value={editSchema.tabela}
                                        onChange={e => setEditSchema(p => ({ ...p, tabela: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Descrição para o Agente <span className="text-red-500">*</span></label>
                                <textarea
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] resize-y bg-white"
                                    placeholder="Descreva o propósito desta tabela, quais dados contém e quando o agente deve usá-la..."
                                    value={editSchema.descricao}
                                    onChange={e => setEditSchema(p => ({ ...p, descricao: e.target.value }))}
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Colunas-Chave (opcional)</label>
                                <input
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                    placeholder="Ex: C5_NUM, C5_CLIENTE, C5_EMISSAO, d_e_l_e_t_"
                                    value={editSchema.colunas_chave || ''}
                                    onChange={e => setEditSchema(p => ({ ...p, colunas_chave: e.target.value }))}
                                />
                            </div>

                            <div className="flex gap-3 justify-end">
                                <button onClick={() => setEditSchema(null)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50">Cancelar</button>
                                <button
                                    onClick={() => saveSchema(editSchema)}
                                    disabled={saving || !editSchema.tabela || !editSchema.descricao}
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-xl hover:bg-blue-800 disabled:opacity-40"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    {editSchema.id ? 'Atualizar' : 'Adicionar'}
                                </button>
                            </div>
                        </div>
                    )}

                    {loading ? (
                        <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
                    ) : (schema || []).length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-10">Nenhuma tabela cadastrada ainda.</p>
                    ) : (
                        <div className="space-y-2">
                            {/* Group by banco */}
                            {['postgresql', 'mysql'].map(banco => {
                                const rows = (schema || []).filter(r => r.banco === banco);
                                if (rows.length === 0) return null;
                                return (
                                    <div key={banco}>
                                        <div className={`flex items-center gap-2 mb-2 mt-3 px-1`}>
                                            <Database className="w-3.5 h-3.5 text-slate-400" />
                                            <span className={`text-[10px] font-bold uppercase tracking-wider ${banco === 'postgresql' ? 'text-blue-600' : 'text-orange-600'}`}>
                                                {banco === 'postgresql' ? 'PostgreSQL — Protheus' : 'MySQL — App Lynx'}
                                            </span>
                                            <span className="text-[10px] text-slate-400">({rows.length} tabela{rows.length !== 1 ? 's' : ''})</span>
                                        </div>
                                        {rows.map(row => (
                                            <div key={row.id} className={`bg-white border rounded-xl p-4 flex items-start gap-3 mb-2 transition-opacity ${row.ativo ? '' : 'opacity-40'}`}>
                                                {/* Badge */}
                                                <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${banco === 'postgresql' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                                    {row.tabela.slice(0, 2).toUpperCase()}
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <span className="font-mono text-sm font-bold text-slate-700">{row.tabela}</span>
                                                        {!row.ativo && <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full">inativo</span>}
                                                    </div>
                                                    <p className="text-xs text-slate-600 line-clamp-2">{row.descricao}</p>
                                                    {row.colunas_chave && (
                                                        <p className="text-[10px] text-slate-400 mt-1 font-mono line-clamp-1">📋 {row.colunas_chave}</p>
                                                    )}
                                                </div>

                                                {/* Actions */}
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button
                                                        onClick={() => toggleSchema(row)}
                                                        title={row.ativo ? 'Desativar' : 'Ativar'}
                                                        className="p-1.5 text-slate-400 hover:text-emerald-600"
                                                    >
                                                        {row.ativo
                                                            ? <ToggleRight className="w-5 h-5 text-emerald-500" />
                                                            : <ToggleLeft className="w-5 h-5 text-slate-400" />}
                                                    </button>
                                                    <button
                                                        onClick={() => setEditSchema({ ...row })}
                                                        title="Editar"
                                                        className="p-1.5 text-slate-400 hover:text-blue-600"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => deleteSchema(row.id)}
                                                        title="Remover"
                                                        className="p-1.5 text-slate-400 hover:text-red-500"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB: HISTÓRICO */}
            {tab === 'historico' && (
                <div className="space-y-3">
                    {loading ? (
                        <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
                    ) : (historico || []).length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-12">Nenhuma conversa registrada ainda.</p>
                    ) : (
                        (historico || []).map(c => (
                            <div key={c.id} className="bg-white border rounded-xl p-4">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1">
                                        <div className="flex gap-2 items-center flex-wrap mb-1">
                                            <span className="text-xs font-bold text-slate-700">{c.nome_usuario || 'Usuário'}</span>
                                            {c.pedido && <span className="text-[10px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">Pedido {c.pedido}</span>}
                                            {c.cliente && <span className="text-[10px] text-slate-500">{c.cliente}</span>}
                                            <span className="text-[10px] text-slate-400 ml-auto">{new Date(c.criado_em).toLocaleString('pt-BR')}</span>
                                        </div>
                                        <p className="text-sm font-medium text-slate-800 line-clamp-1">❓ {c.mensagem_usuario}</p>
                                    </div>
                                    <button onClick={() => setExpandedHistory(p => ({ ...p, [c.id]: !p[c.id] }))} className="text-slate-400 hover:text-slate-600">
                                        {expandedHistory[c.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </button>
                                </div>
                                {expandedHistory[c.id] && (
                                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
                                        <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-700 whitespace-pre-wrap max-h-48 overflow-y-auto">
                                            {c.resposta_agente}
                                        </div>
                                        {c.sql_executado && (
                                            <details className="text-[10px]">
                                                <summary className="cursor-pointer text-slate-400 font-mono">SQLs executados</summary>
                                                <pre className="bg-slate-900 text-emerald-400 p-2 rounded-lg mt-1 overflow-x-auto text-[10px]">
                                                    {JSON.stringify(JSON.parse(c.sql_executado || '[]'), null, 2)}
                                                </pre>
                                            </details>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
