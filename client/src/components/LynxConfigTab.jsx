import React, { useState, useEffect, useRef } from 'react';
import { Bot, Save, Trash2, ShieldAlert, ToggleLeft, ToggleRight, Sparkles, Loader2, Database, HelpCircle, Code, ArrowRight, Send, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Calendar, User, Plus, Edit2, Play, Mail, Phone, Trash, X, Terminal } from 'lucide-react';
import api from '../services/api';
import DOMPurify from 'dompurify';
import PlanejamentoInteligenteModal from './PlanejamentoInteligenteModal';

const MODELOS = [
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Rápido, Estável)' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Raciocínio Avançado)' },
    { value: 'gemini-2.0-flash-001', label: 'Gemini 2.0 Flash' },
];

const CRON_TEMPLATES = [
    { label: 'A cada hora', value: '0 * * * *' },
    { label: 'Diário às 08:00', value: '0 8 * * *' },
    { label: 'Diário às 18:00', value: '0 18 * * *' },
    { label: 'Semanal (Seg às 07:00)', value: '0 7 * * 1' },
];

// ── Inline Markdown renderer for assistant messages ─────────────────────────
function renderInline(text) {
    if (!text) return '';
    return text
        .replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" class="lynx-chat-img max-w-full max-h-[350px] h-auto object-contain rounded-lg border border-slate-200 shadow-sm my-2 cursor-zoom-in hover:border-indigo-300 hover:shadow-md transition-all duration-200" />')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code class="bg-slate-100 px-1 py-0.5 rounded text-[11px] font-mono text-indigo-700">$1</code>');
}

function RenderMarkdown({ text }) {
    if (!text) return null;
    const lines = text.split('\n');
    return (
        <div className="prose prose-sm max-w-none text-slate-800 space-y-1">
            {lines.map((line, i) => {
                if (line.startsWith('### ')) return <h3 key={i} className="text-xs font-bold text-slate-900 mt-2.5 mb-1">{line.slice(4)}</h3>;
                if (line.startsWith('## ')) return <h2 key={i} className="text-sm font-bold text-indigo-900 mt-3 mb-1 border-b border-indigo-50 pb-0.5">{line.slice(3)}</h2>;
                if (line.startsWith('# ')) return <h1 key={i} className="text-base font-bold text-indigo-950 mt-3 mb-1.5">{line.slice(2)}</h1>;
                if (line.startsWith('- ') || line.startsWith('* '))
                    return <div key={i} className="flex gap-1.5 text-xs"><span className="text-indigo-500 mt-0.5">•</span><span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderInline(line.slice(2)), { ADD_ATTR: ['class'] }) }} /></div>;
                if (/^\d+\./.test(line))
                    return <div key={i} className="flex gap-1.5 text-xs"><span className="text-indigo-500 font-bold min-w-[14px]">{line.match(/^\d+/)[0]}.</span><span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderInline(line.replace(/^\d+\.\s*/, '')), { ADD_ATTR: ['class'] }) }} /></div>;
                if (line.startsWith('```')) return null;
                if (!line.trim()) return <div key={i} className="h-0.5" />;
                return <p key={i} className="text-xs leading-relaxed" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderInline(line), { ADD_ATTR: ['class'] }) }} />;
            })}
        </div>
    );
}

// ── Live Reasoning Steps Panel ───────────────────────────────────────────────
function ReasoningPanel({ steps }) {
    const [expanded, setExpanded] = useState(true);
    if (!steps || steps.length === 0) return null;

    const isDone = steps.some(s => s.type === 'done');
    const hasError = steps.some(s => s.type === 'error');

    return (
        <div className={`border rounded-xl overflow-hidden text-[10px] transition-all ${
            hasError ? 'border-red-200 bg-red-50/55' :
            isDone ? 'border-emerald-200 bg-emerald-50/40' :
            'border-indigo-150 bg-indigo-50/20'
        }`}>
            <button 
                type="button" 
                onClick={() => setExpanded(v => !v)}
                className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-left font-medium outline-none"
            >
                {isDone ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : hasError ? (
                    <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                ) : (
                    <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin shrink-0" />
                )}
                <span className={`flex-1 font-semibold ${isDone ? 'text-emerald-800' : hasError ? 'text-red-800' : 'text-indigo-800'}`}>
                    {isDone ? 'Processamento concluído' : hasError ? 'Erro no raciocínio' : 'Lynx Raciocinando...'}
                </span>
                <span className="text-slate-400 text-[9px]">{steps.length} etapa(s)</span>
                {expanded ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
            </button>

            {expanded && (
                <div className="border-t border-slate-100 divide-y divide-slate-100 max-h-40 overflow-y-auto">
                    {steps.map((step, i) => (
                        <div key={i} className="flex items-start gap-1.5 px-2.5 py-1">
                            <span className="shrink-0 mt-0.5 leading-none">{step.icon || '▶'}</span>
                            <span className="text-slate-600 flex-1 leading-normal"
                                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderInline(step.message || ''), { ADD_ATTR: ['class'] }) }} />
                        </div>
                    ))}
                    {!isDone && !hasError && (
                        <div className="px-2.5 py-1 flex items-center gap-1.5">
                            <span className="inline-block w-1.5 h-2.5 bg-indigo-500 animate-pulse rounded-sm" />
                            <span className="text-slate-400 italic">aguardando agente...</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function LynxConfigTab() {
    // Sub-tab Navigation: 'geral', 'perfis', 'tarefas'
    const [activeSubTab, setActiveSubTab] = useState('geral');

    // State 1: Global Config
    const [config, setConfig] = useState({
        system_prompt: '',
        modelo: 'gemini-2.5-flash',
        temperature: 0.3,
        autonomia: 0
    });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState('');

    // State 2: Interactive Chat
    const [messages, setMessages] = useState([]);
    const [lightboxImage, setLightboxImage] = useState(null);
    const [input, setInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [clearing, setClearing] = useState(false);
    const [expandedSql, setExpandedSql] = useState({});
    const [selectedChatProfile, setSelectedChatProfile] = useState('');

    // State 3: Agent Profiles
    const [profiles, setProfiles] = useState([]);
    const [pcpAgents, setPcpAgents] = useState([]);

    // State 4: Tasks Scheduling
    const [tasks, setTasks] = useState([]);
    const [showTaskForm, setShowTaskForm] = useState(false);
    const [editingTaskId, setEditingTaskId] = useState(null);
    const [taskExecuting, setTaskExecuting] = useState({});
    const [taskForm, setTaskForm] = useState({
        nome: '',
        descricao: '',
        perfil_id: '',
        cron_expression: '0 8 * * *',
        prompt_execucao: '',
        alerta_email: '',
        alerta_whatsapp: '',
        temperature: 0.3,
        autonomia: 0
    });

    // State 5: Unified Smart Planner modal
    const [smartPlannerOpen, setSmartPlannerOpen] = useState(false);
    const [hermesTaskId, setHermesTaskId] = useState(null);

    const messagesEndRef = useRef(null);

    useEffect(() => {
        loadConfig();
        loadHistory();
        loadProfiles();
        loadTasks();
        loadPcpAgents();
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ========= GET DATA =========
    async function loadConfig() {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get('/hermes/config');
            if (res.data) {
                setConfig({
                    system_prompt: res.data.system_prompt || '',
                    modelo: res.data.modelo || 'gemini-2.5-flash',
                    temperature: res.data.temperature !== undefined ? res.data.temperature : 0.3,
                    autonomia: res.data.autonomia || 0
                });
            }
        } catch (err) {
            console.error('Erro ao carregar configurações:', err);
            setError(err.response?.data?.error || 'Não foi possível carregar as configurações.');
        } finally {
            setLoading(false);
        }
    }

    async function loadHistory() {
        setHistoryLoading(true);
        try {
            const res = await api.get('/hermes/chat/history');
            const mapped = (res.data || []).map(m => ({
                id: m.id,
                role: m.role === 'model' ? 'agent' : m.role,
                text: m.text,
                sqlsExecuted: m.sqls_executed ? JSON.parse(m.sqls_executed) : [],
                criado_em: m.criado_em
            }));
            setMessages(mapped);
        } catch (err) {
            console.error('Erro ao carregar histórico do chat:', err);
        } finally {
            setHistoryLoading(false);
        }
    }

    async function loadProfiles() {
        try {
            const res = await api.get('/hermes/profiles');
            setProfiles(res.data || []);
        } catch (err) {
            console.error('Erro ao carregar perfis:', err);
        }
    }

    async function loadPcpAgents() {
        try {
            const res = await api.get('/pcpmetal/agentes');
            setPcpAgents(res.data || []);
        } catch (err) {
            console.error('Erro ao carregar agentes pcp:', err);
        }
    }

    async function loadTasks() {
        try {
            const res = await api.get('/hermes/tasks');
            setTasks(res.data || []);
        } catch (err) {
            console.error('Erro ao carregar tarefas:', err);
        }
    }

    // ========= HANDLERS GENERAL CONFIG =========
    async function handleSaveConfig() {
        setSaving(true);
        setError(null);
        setSuccessMsg('');
        try {
            await api.put('/hermes/config', config);
            setSuccessMsg('Configurações padrão do Lynx salvas com sucesso!');
            setTimeout(() => setSuccessMsg(''), 4000);
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.error || 'Erro ao salvar as configurações.');
        } finally {
            setSaving(false);
        }
    }

    // ========= HANDLERS CHAT MESSENGER =========
    async function handleSend(e) {
        if (e) e.preventDefault();
        if (!input.trim() || chatLoading || historyLoading) return;

        const question = input.trim();
        setInput('');
        setChatLoading(true);

        const userMsg = {
            id: `user-${Date.now()}`,
            role: 'user',
            text: question,
            criado_em: new Date().toISOString()
        };
        setMessages(prev => [...prev, userMsg]);

        const thinkMsgId = `think-${Date.now()}`;
        setMessages(prev => [...prev, { id: thinkMsgId, role: 'thinking', steps: [] }]);

        try {
            const token = localStorage.getItem('@MetalFisa:token') || '';
            const response = await fetch('/api/hermes/chat-stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    pergunta: question,
                    profileId: selectedChatProfile || null,
                    historico: messages.filter(m => m.role === 'user' || m.role === 'agent').slice(-6).map(h => ({
                        role: h.role === 'user' ? 'user' : 'model',
                        text: h.text
                    }))
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || 'Erro de rede ao falar com o agente.');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const data = JSON.parse(line.slice(6));

                        if (data.type === 'result') {
                            const agentMsg = {
                                id: `agent-${Date.now()}`,
                                role: 'agent',
                                text: data.answer,
                                sqlsExecuted: data.sqlsExecuted || [],
                                criado_em: new Date().toISOString()
                            };
                            setMessages(prev => [
                                ...prev.filter(m => m.id !== thinkMsgId),
                                agentMsg
                            ]);
                            setChatLoading(false);
                            loadHistory();
                            continue;
                        }

                        if (data.type === 'error') {
                            setMessages(prev => [
                                ...prev.filter(m => m.id !== thinkMsgId),
                                { id: `err-${Date.now()}`, role: 'error', text: `❌ ${data.message}`, criado_em: new Date().toISOString() }
                            ]);
                            setChatLoading(false);
                            continue;
                        }

                        setMessages(prev => prev.map(m =>
                            m.id === thinkMsgId
                                ? { ...m, steps: [...(m.steps || []), data] }
                                : m
                        ));
                    } catch (_) {}
                }
            }
        } catch (err) {
            console.error('Erro no stream do Lynx:', err);
            setMessages(prev => [
                ...prev.filter(m => m.id !== thinkMsgId),
                { id: `err-${Date.now()}`, role: 'error', text: `❌ Conexão perdida: ${err.message}`, criado_em: new Date().toISOString() }
            ]);
            setChatLoading(false);
        }
    }

    async function handleClearHistory() {
        if (!window.confirm('Deseja limpar todo o histórico de chat do Lynx do banco de dados?')) return;
        setClearing(true);
        try {
            await api.post('/hermes/chat/clear');
            setMessages([]);
        } catch (err) {
            console.error(err);
        } finally {
            setClearing(false);
        }
    }

       // ========= HANDLERS TASKS =========
    async function handleSaveTask(e) {
        e.preventDefault();
        setError(null);
        setSuccessMsg('');
        try {
            const payload = {
                ...taskForm,
                perfil_id: taskForm.perfil_id ? parseInt(taskForm.perfil_id) : null
            };
            if (editingTaskId) {
                await api.put(`/hermes/tasks/${editingTaskId}`, payload);
                setSuccessMsg('Tarefa de agendamento atualizada!');
            } else {
                await api.post('/hermes/tasks', payload);
                setSuccessMsg('Tarefa de agendamento criada e agendada!');
            }
            setTaskForm({ 
                nome: '', 
                descricao: '', 
                perfil_id: '', 
                cron_expression: '0 8 * * *', 
                prompt_execucao: '', 
                alerta_email: '', 
                alerta_whatsapp: '',
                temperature: 0.3,
                autonomia: 0
            });
            setShowTaskForm(false);
            setEditingTaskId(null);
            loadTasks();
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            setError(err.response?.data?.error || 'Erro ao salvar a tarefa.');
        }
    }

    async function handleSaveAndExecuteTask() {
        setError(null);
        setSuccessMsg('');
        if (!taskForm.nome || !taskForm.cron_expression || !taskForm.prompt_execucao) {
            setError('Nome, expressão cron e prompt de execução são obrigatórios.');
            return;
        }
        try {
            const payload = {
                ...taskForm,
                perfil_id: taskForm.perfil_id ? parseInt(taskForm.perfil_id) : null
            };
            let taskId = editingTaskId;
            if (editingTaskId) {
                await api.put(`/hermes/tasks/${editingTaskId}`, payload);
                setSuccessMsg('Tarefa de agendamento atualizada!');
            } else {
                const res = await api.post('/hermes/tasks', payload);
                taskId = res.data.id;
                setSuccessMsg('Tarefa de agendamento criada!');
            }
            
            // Execute task immediately (reuse handleExecuteTask to also open live log)
            if (taskId) {
                await loadTasks();
                await handleExecuteTask(taskId);
            }

            setTaskForm({ 
                nome: '', 
                descricao: '', 
                perfil_id: '', 
                cron_expression: '0 8 * * *', 
                prompt_execucao: '', 
                alerta_email: '', 
                alerta_whatsapp: '',
                temperature: 0.3,
                autonomia: 0
            });
            setShowTaskForm(false);
            setEditingTaskId(null);
            loadTasks();
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            setError(err.response?.data?.error || 'Erro ao salvar e executar a tarefa.');
        }
    }

    async function handleDeleteTask(id) {
        if (!window.confirm('Excluir esta tarefa agendada permanentemente?')) return;
        try {
            await api.delete(`/hermes/tasks/${id}`);
            loadTasks();
            setSuccessMsg('Tarefa de agendamento excluída.');
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao excluir a tarefa.');
        }
    }

    async function handleToggleTask(id, currentStatus) {
        try {
            await api.post(`/hermes/tasks/${id}/toggle`, { ativo: currentStatus ? 0 : 1 });
            loadTasks();
        } catch (err) {
            alert('Erro ao alterar status da tarefa.');
        }
    }

    async function handleExecuteTask(id) {
        if (taskExecuting[id]) return; // Atomic lock
        setTaskExecuting(prev => ({ ...prev, [id]: true }));
        setHermesTaskId(id);
        setSmartPlannerOpen(true);
    }

    function handlePlannerClose() {
        setSmartPlannerOpen(false);
        setHermesTaskId(null);
        setTaskExecuting({});
        loadTasks();
    }

    function startEditTask(task) {
        setTaskForm({
            nome: task.nome,
            descricao: task.descricao || '',
            perfil_id: task.perfil_id || '',
            cron_expression: task.cron_expression,
            prompt_execucao: task.prompt_execucao,
            alerta_email: task.alerta_email || '',
            alerta_whatsapp: task.alerta_whatsapp || '',
            temperature: task.temperature !== undefined ? task.temperature : 0.3,
            autonomia: task.autonomia || 0
        });
        setEditingTaskId(task.id);
        setShowTaskForm(true);
    }

    const toggleSqlCollapse = (id) => {
        setExpandedSql(prev => ({ ...prev, [id]: !prev[id] }));
    };

    return (
        <div className="space-y-8 animate-fadeIn max-w-5xl">

            {/* ── Planejamento Inteligente Modal ───────────────────────────────── */}
            <PlanejamentoInteligenteModal
                isOpen={smartPlannerOpen}
                onClose={handlePlannerClose}
                hermesTaskId={hermesTaskId}
                selectedOps={[]}
            />

            {/* Header banner */}
            <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-lg relative overflow-hidden border border-indigo-900/50">
                <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-500/20 border border-indigo-500/30 rounded-xl shadow-inner">
                            <Bot className="w-8 h-8 text-indigo-400" />
                        </div>
                        <div>
                            <h1 className="text-xl font-extrabold tracking-tight">Agente Lynx</h1>
                            <p className="text-slate-300 text-xs mt-1 max-w-xl leading-relaxed">
                                Painel de controle corporativo do agente de IA autônomo. Configure parâmetros, crie perfis
                                dedicados de agentes e gerencie tarefas agendadas em segundo plano.
                            </p>
                        </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-300">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                        Super Admin Access
                    </div>
                </div>
            </div>

            {/* Sub-tab Navigation */}
            <div className="flex border-b border-slate-200 gap-6">
                <button
                    onClick={() => setActiveSubTab('geral')}
                    className={`pb-3 font-semibold text-xs tracking-wider uppercase transition-colors outline-none ${
                        activeSubTab === 'geral'
                            ? 'border-b-2 border-indigo-600 text-indigo-750 font-bold'
                            : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                    Configuração Geral & Chat
                </button>
                <button
                    onClick={() => setActiveSubTab('tarefas')}
                    className={`pb-3 font-semibold text-xs tracking-wider uppercase transition-colors outline-none ${
                        activeSubTab === 'tarefas'
                            ? 'border-b-2 border-indigo-600 text-indigo-750 font-bold'
                            : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                    Agendamento de Tarefas
                </button>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-sm font-bold text-red-800">Falha ao processar</h4>
                        <p className="text-xs text-red-700 mt-0.5">{error}</p>
                    </div>
                </div>
            )}

            {successMsg && (
                <div className="p-4 bg-emerald-50 border-l-4 border-emerald-500 rounded-lg flex items-start gap-3 animate-slideIn">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping shrink-0 mt-2" />
                    <div>
                        <h4 className="text-sm font-bold text-emerald-800">Sucesso</h4>
                        <p className="text-xs text-emerald-700 mt-0.5">{successMsg}</p>
                    </div>
                </div>
            )}

            {/* TAB 1: Configuração Geral & Chat */}
            {activeSubTab === 'geral' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* General Settings */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                <span className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                    ⚙️ Parâmetros Fundamentais do Lynx
                                </span>
                            </div>
                            <div className="p-6 space-y-5">
                                {/* System Prompt */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                        System Prompt Padrão (Diretrizes de Raciocínio)
                                        <HelpCircle className="w-3.5 h-3.5 text-slate-400 cursor-help" title="Define a identidade, regras e conhecimentos que o Lynx usará na conversa padrão." />
                                    </label>
                                    <textarea
                                        className="w-full min-h-[220px] p-3 border border-slate-200 rounded-xl bg-slate-50/30 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono leading-relaxed resize-y"
                                        value={config.system_prompt}
                                        onChange={(e) => setConfig(prev => ({ ...prev, system_prompt: e.target.value }))}
                                        placeholder="Digite as instruções fundamentais do Lynx..."
                                    />
                                </div>

                                {/* Model and Temperature */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                                            Modelo de LLM Principal
                                        </label>
                                        <select
                                            className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                                            value={config.modelo}
                                            onChange={(e) => setConfig(prev => ({ ...prev, modelo: e.target.value }))}
                                        >
                                            {MODELOS.map(m => (
                                                <option key={m.value} value={m.value}>{m.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                                                Temperatura (Criatividade)
                                            </label>
                                            <span className="text-xs font-mono font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                                                {config.temperature}
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="1.5"
                                            step="0.1"
                                            className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                                            value={config.temperature}
                                            onChange={(e) => setConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                                        />
                                        <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-semibold">
                                            <span>Determinístico (0.0)</span>
                                            <span>Criativo (1.5)</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Autonomy */}
                                <div className="p-4 rounded-xl border border-amber-100 bg-amber-50/40 flex items-start gap-4">
                                    <div className="p-2 bg-amber-100 text-amber-800 rounded-lg shrink-0">
                                        <Database className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-bold text-slate-800">Autonomia de Escrita (MySQL)</h4>
                                            <button
                                                type="button"
                                                onClick={() => setConfig(prev => ({ ...prev, autonomia: prev.autonomia ? 0 : 1 }))}
                                                className="text-indigo-600 hover:text-indigo-800 transition-colors"
                                            >
                                                {config.autonomia ? (
                                                    <ToggleRight className="w-12 h-12 text-emerald-600" />
                                                ) : (
                                                    <ToggleLeft className="w-12 h-12 text-slate-400" />
                                                )}
                                            </button>
                                        </div>
                                        <p className="text-xs text-slate-600 leading-relaxed">
                                            Habilita o agente a realizar operações de modificação (`INSERT`/`UPDATE`) no MySQL interno. Sem essa flag, o agente funciona apenas em leitura (SELECT).
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
                                <button
                                    onClick={handleSaveConfig}
                                    disabled={saving}
                                    className="bg-indigo-600 text-white font-semibold text-xs px-6 py-2 rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-md disabled:opacity-50"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Salvar Alterações
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Messenger & Profiles context switcher */}
                    <div className="space-y-6 flex flex-col">
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[550px]">
                            {/* Chat Header */}
                            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-2 shrink-0">
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-slate-800 text-xs flex items-center gap-2">
                                        <Bot className="w-4 h-4 text-indigo-500" />
                                        Mensageiro de Teste
                                    </span>
                                    <button
                                        onClick={handleClearHistory}
                                        disabled={clearing || messages.length === 0}
                                        className="text-red-500 hover:text-red-700 disabled:opacity-40 p-1 rounded-lg hover:bg-red-50 transition-colors outline-none"
                                    >
                                        {clearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash className="w-3.5 h-3.5" />}
                                    </button>
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-1">Contexto do Agente</label>
                                    <select
                                        className="text-xs p-1.5 border border-slate-200 rounded-lg outline-none bg-white font-semibold text-slate-700"
                                        value={selectedChatProfile}
                                        onChange={(e) => setSelectedChatProfile(e.target.value)}
                                    >
                                        <option value="">Default / Geral (Configuração Geral)</option>
                                        {profiles.map(p => (
                                            <option key={p.id} value={p.id}>{p.nome}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Chat Messages */}
                            <div 
                                className="p-4 overflow-y-auto flex-1 space-y-4 bg-slate-50/30"
                                onClick={(e) => {
                                    if (e.target.tagName === 'IMG' && e.target.classList.contains('lynx-chat-img')) {
                                        setLightboxImage({ src: e.target.src, alt: e.target.alt });
                                    }
                                }}
                            >
                                {historyLoading ? (
                                    <div className="flex justify-center items-center h-full">
                                        <Loader2 className="w-6 h-6 animate-spin text-slate-350 text-slate-350" />
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="text-center py-16 text-slate-400 space-y-2 h-full flex flex-col justify-center">
                                        <Bot className="w-10 h-10 mx-auto opacity-35 text-indigo-400 animate-pulse" />
                                        <p className="text-xs font-semibold text-slate-500">Nenhum diálogo recente com o Lynx.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {messages.map((msg) => {
                                            if (msg.role === 'thinking') {
                                                return (
                                                    <div key={msg.id} className="mr-6">
                                                        <ReasoningPanel steps={msg.steps || []} />
                                                    </div>
                                                );
                                            }

                                            if (msg.role === 'error') {
                                                return (
                                                    <div key={msg.id} className="p-3 bg-red-50 border border-red-100 text-red-700 rounded-xl text-xs flex gap-2">
                                                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                                        <span>{msg.text}</span>
                                                    </div>
                                                );
                                            }

                                            const isUser = msg.role === 'user';
                                            return (
                                                <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end ml-10' : 'items-start mr-10'}`}>
                                                    <div className={`p-3 rounded-2xl text-xs space-y-1.5 shadow-sm leading-relaxed ${
                                                        isUser
                                                            ? 'bg-indigo-600 text-white font-medium rounded-tr-none'
                                                            : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                                                    }`}>
                                                        <div className={`flex justify-between items-center text-[9px] gap-4 font-bold uppercase tracking-wider mb-0.5 ${
                                                            isUser ? 'text-indigo-200' : 'text-slate-400'
                                                        }`}>
                                                            <span>{isUser ? 'Usuário' : 'Lynx'}</span>
                                                            {msg.criado_em && (
                                                                <span>
                                                                    {new Date(msg.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            )}
                                                        </div>
                                                        
                                                        {isUser ? (
                                                            <p className="whitespace-pre-wrap select-text">{msg.text}</p>
                                                        ) : (
                                                            <RenderMarkdown text={msg.text} />
                                                        )}
                                                        
                                                        {msg.sqlsExecuted && msg.sqlsExecuted.length > 0 && (
                                                            <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden bg-slate-50 text-slate-800">
                                                                <button 
                                                                    type="button"
                                                                    onClick={() => toggleSqlCollapse(msg.id)}
                                                                    className="w-full flex items-center justify-between p-2 hover:bg-slate-100 text-[10px] text-slate-500 font-semibold transition-colors outline-none"
                                                                >
                                                                    <span className="flex items-center gap-1.5">
                                                                        <Code className="w-3.5 h-3.5 text-slate-400" />
                                                                        Ver SQLs Executados ({msg.sqlsExecuted.length})
                                                                    </span>
                                                                    <ArrowRight className={`w-3 h-3 text-slate-400 transition-transform ${expandedSql[msg.id] ? 'rotate-90' : ''}`} />
                                                                </button>
                                                                {expandedSql[msg.id] && (
                                                                    <div className="p-2 border-t border-slate-200 space-y-2 max-h-48 overflow-y-auto bg-slate-900 text-slate-200 font-mono text-[10px] leading-relaxed">
                                                                        {msg.sqlsExecuted.map((s, idx) => (
                                                                            <div key={idx} className="space-y-1 pb-1.5 border-b border-slate-800 last:border-0 last:pb-0">
                                                                                <div className="flex justify-between text-[9px] text-slate-500">
                                                                                    <span className="font-bold">[{s.banco.toUpperCase()}]</span>
                                                                                    <span>Afetados: {s.rowCount || 0}</span>
                                                                                </div>
                                                                                <pre className="whitespace-pre-wrap select-all font-mono">{s.sql}</pre>
                                                                                {s.error && <p className="text-red-400 font-sans mt-1 text-[9px]">Erro: {s.error}</p>}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div ref={messagesEndRef} />
                                    </div>
                                )}
                            </div>

                            {/* Chat Footer */}
                            <form onSubmit={handleSend} className="p-3 border-t border-slate-100 bg-slate-50 flex gap-2 shrink-0">
                                <input
                                    type="text"
                                    disabled={chatLoading || historyLoading}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder={chatLoading ? 'Lynx está raciocinando...' : 'Digite sua pergunta de teste...'}
                                    className="flex-1 px-3 py-2 border border-slate-250 border-slate-200 rounded-xl bg-white text-xs text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-400 transition-all"
                                />
                                <button
                                    type="submit"
                                    disabled={!input.trim() || chatLoading || historyLoading}
                                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white p-2 rounded-xl transition-all shadow flex items-center justify-center shrink-0 w-8.5 h-8.5"
                                >
                                    {chatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}



            {/* TAB 3: Agendamento de Tarefas */}
            {activeSubTab === 'tarefas' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-indigo-500" />
                            Tarefas Agendadas
                        </h3>
                        {!showTaskForm && (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        const agentFcs = pcpAgents.find(a => a.papel === 'especialista' || a.id === 6);
                                        setEditingTaskId(null);
                                        setTaskForm({
                                            nome: 'Planejamento Inteligente - Sequenciamento FCS Diário',
                                            descricao: 'Executa o sequenciamento de capacidade finita (FCS) automaticamente no início do dia utilizando a data atual.',
                                            perfil_id: agentFcs ? String(agentFcs.id) : '6',
                                            cron_expression: '0 6 * * *',
                                            prompt_execucao: 'Por favor, execute o Motor de Sequenciamento FCS (Capacidade Finita) para todas as OPs de produção pendentes (todos os recursos). A data de início deve ser a data de hoje (hoje). Ao finalizar, apresente o relatório de operações planejadas.',
                                            alerta_email: '',
                                            alerta_whatsapp: '',
                                            temperature: 0.3,
                                            autonomia: 1
                                        });
                                        setShowTaskForm(true);
                                    }}
                                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-750 border border-indigo-150 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                                >
                                    <Sparkles className="w-3.5 h-3.5 text-indigo-650" />
                                    Preset FCS / Planejamento
                                </button>
                                <button
                                    onClick={() => {
                                        setEditingTaskId(null);
                                        setTaskForm({ nome: '', descricao: '', perfil_id: '', cron_expression: '0 8 * * *', prompt_execucao: '', alerta_email: '', alerta_whatsapp: '', temperature: 0.3, autonomia: 0 });
                                        setShowTaskForm(true);
                                    }}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Agendar Nova Tarefa
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Task Scheduler Form */}
                    {showTaskForm && (
                        <div className="bg-white border border-indigo-100 rounded-2xl shadow-sm overflow-hidden p-6 space-y-4 animate-slideIn">
                            <h4 className="text-sm font-bold text-slate-800 border-b pb-2 flex justify-between items-center">
                                <span>{editingTaskId ? '✏️ Editar Agendamento' : '📅 Agendar Nova Rotina Automática'}</span>
                                <button 
                                    onClick={() => setShowTaskForm(false)} 
                                    className="text-xs text-slate-400 hover:text-slate-600"
                                >
                                    Cancelar
                                </button>
                            </h4>

                            <form onSubmit={handleSaveTask} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Nome do Agendamento</label>
                                        <input
                                            type="text"
                                            required
                                            value={taskForm.nome}
                                            onChange={(e) => setTaskForm(t => ({ ...t, nome: e.target.value }))}
                                            className="w-full p-2 border border-slate-200 rounded-lg text-xs text-slate-700"
                                            placeholder="Ex: Auditoria Diária de Gargalos"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Perfil de Agente Executor</label>
                                        <select
                                            className="w-full p-2 border border-slate-200 rounded-lg text-xs text-slate-700 bg-white"
                                            value={taskForm.perfil_id}
                                            onChange={(e) => setTaskForm(t => ({ ...t, perfil_id: e.target.value }))}
                                        >
                                            <option value="">Default / Geral (Configuração Geral)</option>
                                            {profiles.map(p => (
                                                <option key={p.id} value={p.id}>{p.nome}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Descrição</label>
                                        <input
                                            type="text"
                                            value={taskForm.descricao}
                                            onChange={(e) => setTaskForm(t => ({ ...t, descricao: e.target.value }))}
                                            className="w-full p-2 border border-slate-200 rounded-lg text-xs text-slate-700"
                                            placeholder="Descreva brevemente o objetivo da tarefa..."
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <CronBuilder 
                                            value={taskForm.cron_expression} 
                                            onChange={(val) => setTaskForm(t => ({ ...t, cron_expression: val }))} 
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <ReferenceAgentHelper 
                                        pcpAgents={pcpAgents} 
                                        setTaskForm={setTaskForm} 
                                        taskForm={taskForm} 
                                    />
                                    <textarea
                                        required
                                        value={taskForm.prompt_execucao}
                                        onChange={(e) => setTaskForm(t => ({ ...t, prompt_execucao: e.target.value }))}
                                        className="w-full min-h-[140px] p-2.5 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="O prompt que o Lynx executará ao iniciar a rotina (Ex: Analise as OPs atrasadas no MySQL e liste-as...)"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Temperatura ({taskForm.temperature})</label>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="1.5"
                                            step="0.1"
                                            className="w-full accent-indigo-650 bg-slate-200 h-1 rounded-lg cursor-pointer"
                                            value={taskForm.temperature}
                                            onChange={(e) => setTaskForm(t => ({ ...t, temperature: parseFloat(e.target.value) }))}
                                        />
                                        <div className="flex justify-between text-[8px] text-slate-400 mt-1 font-semibold">
                                            <span>Determinístico (0.0)</span>
                                            <span>Criativo (1.5)</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between p-3 border rounded-xl bg-slate-50/50">
                                        <div className="space-y-0.5">
                                            <span className="block text-xs font-bold text-slate-700">Autonomia de Escrita</span>
                                            <span className="text-[9px] text-slate-500">Permitir escrita no MySQL para esta tarefa</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setTaskForm(t => ({ ...t, autonomia: t.autonomia ? 0 : 1 }))}
                                        >
                                            {taskForm.autonomia ? <ToggleRight className="w-10 h-10 text-emerald-600" /> : <ToggleLeft className="w-10 h-10 text-slate-400" />}
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                                            <Mail className="w-3.5 h-3.5" /> Enviar Relatório por E-mail
                                        </label>
                                        <input
                                            type="email"
                                            value={taskForm.alerta_email}
                                            onChange={(e) => setTaskForm(t => ({ ...t, alerta_email: e.target.value }))}
                                            className="w-full p-2 border border-slate-200 rounded-lg text-xs text-slate-700"
                                            placeholder="exemplo@metalfisa.com.br"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                                            <Phone className="w-3.5 h-3.5" /> Enviar Alerta por WhatsApp (DDD+Número)
                                        </label>
                                        <input
                                            type="text"
                                            value={taskForm.alerta_whatsapp}
                                            onChange={(e) => setTaskForm(t => ({ ...t, alerta_whatsapp: e.target.value }))}
                                            className="w-full p-2 border border-slate-200 rounded-lg text-xs text-slate-700"
                                            placeholder="5511999999999"
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 border-t pt-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowTaskForm(false)}
                                        className="px-4 py-1.5 border rounded-lg text-xs text-slate-500 font-semibold hover:bg-slate-50"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSaveAndExecuteTask}
                                        disabled={Object.values(taskExecuting).some(Boolean)}
                                        className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-150 px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                                        title="Salvar e disparar a execução agora"
                                    >
                                        {Object.values(taskExecuting).some(Boolean) ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                            <Play className="w-3.5 h-3.5 fill-indigo-700" />
                                        )}
                                        Executar Agora
                                    </button>
                                    <button
                                        type="submit"
                                        className="bg-indigo-600 text-white font-semibold text-xs px-5 py-1.5 rounded-lg hover:bg-indigo-700 transition-all flex items-center gap-1.5"
                                    >
                                        <Save className="w-3.5 h-3.5" />
                                        Salvar Agendamento
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Tasks List */}
                    <div className="space-y-4">
                        {tasks.map(task => (
                            <div key={task.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4 hover:border-indigo-150 transition-all">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center flex-wrap gap-2">
                                            <h4 className="font-bold text-slate-800 text-xs">{task.nome}</h4>
                                            <span className="text-[9px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                                                {task.perfil_nome || 'Default / Geral'}
                                            </span>
                                            <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border">
                                                ⏱️ {task.cron_expression}
                                            </span>
                                            <span className="text-[9px] font-medium bg-slate-50 text-slate-500 px-2 py-0.5 rounded-full border">
                                                🌡️ Temp: {task.temperature !== undefined ? task.temperature : 0.3}
                                            </span>
                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                                                task.autonomia 
                                                    ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
                                                    : 'text-slate-500 bg-slate-50 border-slate-100'
                                            }`}>
                                                {task.autonomia ? 'Autonomia ON' : 'Leitura'}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-slate-500">{task.descricao || 'Sem descrição cadastrada.'}</p>
                                    </div>

                                    {/* Action buttons and Status */}
                                    <div className="flex items-center gap-4">
                                        {/* Toggle activation */}
                                        <button
                                            onClick={() => handleToggleTask(task.id, task.ativo)}
                                            className="outline-none"
                                            title={task.ativo ? 'Desativar Tarefa' : 'Ativar Tarefa'}
                                        >
                                            {task.ativo ? (
                                                <ToggleRight className="w-8 h-8 text-emerald-600" />
                                            ) : (
                                                <ToggleLeft className="w-8 h-8 text-slate-400" />
                                            )}
                                        </button>

                                        <button
                                            onClick={() => handleExecuteTask(task.id)}
                                            disabled={taskExecuting[task.id]}
                                            className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                                            title="Disparar a execução agora"
                                        >
                                            {taskExecuting[task.id] ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                <Play className="w-3.5 h-3.5 fill-indigo-700" />
                                            )}
                                            Executar Agora
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-3 text-[10px]">
                                    <div className="space-y-1">
                                        <span className="block font-bold text-slate-500 uppercase tracking-wide text-[9px]">Instrução de Execução:</span>
                                        <p className="font-mono text-slate-700 line-clamp-2 bg-slate-50 p-2 rounded-lg leading-relaxed">
                                            {task.prompt_execucao}
                                        </p>
                                    </div>

                                    <div className="space-y-2 flex flex-col justify-between">
                                        <div className="flex flex-wrap gap-2.5">
                                            {task.alerta_email && (
                                                <span className="flex items-center gap-1 text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                                    <Mail className="w-3 h-3 text-indigo-500" />
                                                    {task.alerta_email}
                                                </span>
                                            )}
                                            {task.alerta_whatsapp && (
                                                <span className="flex items-center gap-1 text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                                    <Phone className="w-3 h-3 text-emerald-500" />
                                                    {task.alerta_whatsapp}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-slate-400">Última execução:</span>
                                                <span className="font-semibold text-slate-700">
                                                    {task.last_run ? new Date(task.last_run).toLocaleString('pt-BR') : 'Nunca executada'}
                                                </span>
                                                {task.status_last_run && (
                                                    <span className={`font-bold px-2 py-0.5 rounded-full text-[9px] uppercase border ${
                                                        task.status_last_run === 'success'
                                                            ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
                                                            : task.status_last_run === 'running'
                                                            ? 'text-indigo-750 bg-indigo-50 border-indigo-100 animate-pulse'
                                                            : 'text-red-700 bg-red-50 border-red-100'
                                                    }`}>
                                                        {task.status_last_run}
                                                    </span>
                                                )}
                                                {task.last_output && (
                                                    <button
                                                        onClick={() => setLiveLog({
                                                            taskId: task.id,
                                                            taskName: task.nome,
                                                            steps: [],
                                                            status: task.status_last_run === 'success' ? 'success' : 'error',
                                                            answer: task.last_output
                                                        })}
                                                        className="flex items-center gap-1 text-[9px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-full border border-indigo-100 transition-colors"
                                                        title="Ver resultado da última execução"
                                                    >
                                                        <Terminal className="w-2.5 h-2.5" />
                                                        Ver Resultado
                                                    </button>
                                                )}
                                            </div>

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => startEditTask(task)}
                                                    className="text-slate-500 hover:text-slate-800 p-1 hover:bg-slate-100 rounded"
                                                    title="Editar"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteTask(task.id)}
                                                    className="text-red-500 hover:text-red-750 p-1 hover:bg-red-50 rounded"
                                                    title="Excluir"
                                                >
                                                    <Trash className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Lightbox Modal */}
            {lightboxImage && (
                <div 
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/90 backdrop-blur-md transition-all duration-300 animate-fadeIn cursor-zoom-out"
                    onClick={() => setLightboxImage(null)}
                >
                    <button 
                        className="absolute top-4 right-4 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors outline-none cursor-pointer"
                        onClick={() => setLightboxImage(null)}
                    >
                        <X className="w-6 h-6" />
                    </button>
                    <div className="relative max-w-[90vw] max-h-[85vh] flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
                        <img 
                            src={lightboxImage.src} 
                            alt={lightboxImage.alt || 'Imagem ampliada'} 
                            className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl border border-white/15 animate-zoomIn cursor-zoom-out"
                            onClick={() => setLightboxImage(null)}
                        />
                        {lightboxImage.alt && (
                            <p className="text-white/80 text-xs font-semibold bg-slate-900/60 px-4 py-1.5 rounded-full backdrop-blur-sm border border-white/5">
                                {lightboxImage.alt}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function ReferenceAgentHelper({ pcpAgents, setTaskForm, taskForm }) {
    const [selectedAgent, setSelectedAgent] = useState(null);

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wide">
                    Prompt de Instrução do Agendamento
                </label>
                <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-slate-400 font-semibold">Basear no Agente Especialista:</span>
                    <select
                        type="button"
                        value={selectedAgent ? selectedAgent.id : ''}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (!val) {
                                setSelectedAgent(null);
                            } else {
                                const agent = pcpAgents.find(a => String(a.id) === String(val));
                                setSelectedAgent(agent || null);
                            }
                        }}
                        className="border border-slate-200 rounded-lg px-2 py-1 text-[10px] text-slate-600 bg-white cursor-pointer hover:border-indigo-400 focus:outline-none"
                    >
                        <option value="">-- Selecione para consultar diretrizes --</option>
                        {pcpAgents.map(a => (
                            <option key={a.id} value={a.id}>{a.nome} ({a.papel})</option>
                        ))}
                    </select>
                </div>
            </div>

            {selectedAgent && (
                <div className="p-3 bg-indigo-50/40 border border-indigo-100/70 rounded-xl space-y-2 text-xs animate-slideIn">
                    <div className="flex items-center justify-between">
                        <span className="font-bold text-indigo-900 text-[11px] flex items-center gap-1">
                            <span>📋</span> Diretrizes: {selectedAgent.nome} ({selectedAgent.papel})
                        </span>
                        <button
                            type="button"
                            onClick={() => {
                                const template = `### DIRETRIZES DO AGENTE: ${selectedAgent.nome}\n${selectedAgent.system_prompt || ''}\n\n### CONTEXTO DE NEGÓCIO:\n${selectedAgent.contexto_negocio || ''}\n\n### INSTRUÇÃO DA TAREFA:\n`;
                                if (taskForm.prompt_execucao && !window.confirm("Isso irá mesclar as diretrizes no início do seu prompt atual. Deseja prosseguir?")) {
                                    return;
                                }
                                setTaskForm(prev => ({ ...prev, prompt_execucao: template + prev.prompt_execucao }));
                            }}
                            className="text-[9px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-2 py-0.5 rounded transition-colors"
                        >
                            Mesclar no Prompt
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] text-slate-650">
                        <div>
                            <span className="font-bold block text-[8px] text-slate-400 uppercase tracking-wider mb-0.5">Prompt do Sistema (System Prompt):</span>
                            <div className="bg-white/80 border rounded-lg p-2 max-h-24 overflow-y-auto font-mono text-[9px] whitespace-pre-wrap leading-relaxed">
                                {selectedAgent.system_prompt}
                            </div>
                        </div>
                        <div>
                            <span className="font-bold block text-[8px] text-slate-400 uppercase tracking-wider mb-0.5">Contexto de Negócio:</span>
                            <div className="bg-white/80 border rounded-lg p-2 max-h-24 overflow-y-auto text-[9px] whitespace-pre-wrap leading-relaxed">
                                {selectedAgent.contexto_negocio || 'Nenhum contexto de negócio específico cadastrado.'}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function parseCron(cron) {
    if (!cron) return { type: 'daily', hour: '08', minute: '00', daysOfWeek: ['1'] };
    const parts = cron.trim().split(/\s+/);
    if (parts.length < 5) return { type: 'daily', hour: '08', minute: '00', daysOfWeek: ['1'] };
    
    const [minute, hour, dom, month, dow] = parts;
    
    if (hour === '*' && dom === '*' && month === '*' && dow === '*') {
        return { type: 'hourly', hour: '08', minute: minute === '*' ? '00' : minute.padStart(2, '0'), daysOfWeek: ['1'] };
    }
    
    let days = ['1'];
    if (dow !== '*') {
        if (dow.includes(',')) {
            days = dow.split(',');
        } else if (dow.includes('-')) {
            const [start, end] = dow.split('-').map(Number);
            if (!isNaN(start) && !isNaN(end) && start <= end) {
                days = [];
                for (let i = start; i <= end; i++) {
                    days.push(String(i));
                }
            }
        } else {
            days = [dow];
        }
    }
    
    const isWeekly = dow !== '*';
    
    return {
        type: isWeekly ? 'weekly' : 'daily',
        hour: hour.match(/\d+/) ? hour.match(/\d+/)[0].padStart(2, '0') : '08',
        minute: minute.match(/\d+/) ? minute.match(/\d+/)[0].padStart(2, '0') : '00',
        daysOfWeek: days
    };
}

function buildCron({ type, hour, minute, daysOfWeek }) {
    const minStr = String(parseInt(minute) || 0);
    const hrStr = String(parseInt(hour) || 0);
    
    if (type === 'hourly') {
        return `${minStr} * * * *`;
    }
    if (type === 'weekly') {
        const sortedDays = [...daysOfWeek].map(Number).sort((a, b) => a - b);
        const dowStr = sortedDays.length > 0 ? sortedDays.join(',') : '1';
        return `${minStr} ${hrStr} * * ${dowStr}`;
    }
    return `${minStr} ${hrStr} * * *`;
}

function CronBuilder({ value, onChange }) {
    const [isAdvanced, setIsAdvanced] = useState(false);
    
    const { type, hour, minute, daysOfWeek } = parseCron(value);
    
    const handleTypeChange = (newType) => {
        onChange(buildCron({ type: newType, hour, minute, daysOfWeek }));
    };
    
    const handleTimeChange = (timeStr) => {
        if (!timeStr) return;
        const [h, m] = timeStr.split(':');
        onChange(buildCron({ type, hour: h, minute: m, daysOfWeek }));
    };
    
    const handleDayOfWeekToggle = (dayVal) => {
        let updatedDays = [...daysOfWeek];
        if (updatedDays.includes(dayVal)) {
            if (updatedDays.length > 1) {
                updatedDays = updatedDays.filter(d => d !== dayVal);
            }
        } else {
            updatedDays.push(dayVal);
        }
        onChange(buildCron({ type, hour, minute, daysOfWeek: updatedDays }));
    };
    
    const handleMinuteChange = (newMin) => {
        onChange(buildCron({ type, hour, minute: newMin, daysOfWeek }));
    };

    const days = [
        { value: '1', label: 'Seg' },
        { value: '2', label: 'Ter' },
        { value: '3', label: 'Qua' },
        { value: '4', label: 'Qui' },
        { value: '5', label: 'Sex' },
        { value: '6', label: 'Sáb' },
        { value: '0', label: 'Dom' },
    ];

    return (
        <div className="space-y-2 border border-slate-200/80 rounded-xl p-3 bg-slate-50/50">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    Configuração do Agendamento
                </span>
                <button
                    type="button"
                    onClick={() => setIsAdvanced(!isAdvanced)}
                    className="text-[9px] text-indigo-650 hover:underline font-semibold"
                >
                    {isAdvanced ? 'Modo Simples' : 'Expressão Cron (Avançado)'}
                </button>
            </div>

            {isAdvanced ? (
                <div className="space-y-1">
                    <input
                        type="text"
                        required
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="w-full p-2 border border-slate-200 rounded-lg text-xs text-slate-700 font-mono focus:ring-1 focus:ring-indigo-500"
                        placeholder="Ex: 0 8 * * *"
                    />
                    <span className="text-[9px] text-slate-400 font-mono block">
                        Minutos | Hora | Dia | Mês | Dia da Semana
                    </span>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
                    <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Periodicidade</label>
                        <select
                            value={type}
                            onChange={(e) => handleTypeChange(e.target.value)}
                            className="w-full p-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 bg-white focus:ring-1 focus:ring-indigo-500"
                        >
                            <option value="hourly">A cada hora</option>
                            <option value="daily">Diário (Todos os dias)</option>
                            <option value="weekly">Semanal (Dias específicos)</option>
                        </select>
                    </div>

                    {type === 'hourly' && (
                        <div className="sm:col-span-2">
                            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Executar no Minuto</label>
                            <select
                                value={parseInt(minute)}
                                onChange={(e) => handleMinuteChange(e.target.value)}
                                className="w-full p-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 bg-white focus:ring-1 focus:ring-indigo-500"
                            >
                                {Array.from({ length: 60 }).map((_, i) => (
                                    <option key={i} value={i}>Minuto {i} (ex: *: {String(i).padStart(2, '0')})</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {type === 'daily' && (
                        <div className="sm:col-span-2">
                            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Horário de Execução</label>
                            <input
                                type="time"
                                value={`${hour}:${minute}`}
                                onChange={(e) => handleTimeChange(e.target.value)}
                                className="w-full p-1 border border-slate-200 rounded-lg text-xs text-slate-700 bg-white focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>
                    )}

                    {type === 'weekly' && (
                        <>
                            <div className="sm:col-span-2">
                                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1.5">Dias da Semana de Execução</label>
                                <div className="flex flex-wrap gap-1">
                                    {days.map(d => {
                                        const isSelected = daysOfWeek.includes(d.value);
                                        return (
                                            <button
                                                key={d.value}
                                                type="button"
                                                onClick={() => handleDayOfWeekToggle(d.value)}
                                                className={`px-2.5 py-1 text-[11px] rounded-lg border transition-all duration-150 ${
                                                    isSelected 
                                                        ? 'bg-indigo-600 border-indigo-650 text-white font-semibold shadow-sm' 
                                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 font-medium'
                                                }`}
                                            >
                                                {d.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div>
                                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1.5">Horário</label>
                                <input
                                    type="time"
                                    value={`${hour}:${minute}`}
                                    onChange={(e) => handleTimeChange(e.target.value)}
                                    className="w-full p-1 border border-slate-200 rounded-lg text-xs text-slate-700 bg-white focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>
                        </>
                    )}
                </div>
            )}

            <div className="text-[10px] text-slate-400 font-medium">
                Expressão ativa: <code className="bg-slate-100 text-indigo-700 px-1.5 py-0.5 rounded font-mono font-bold text-[9px]">{value}</code>
            </div>
        </div>
    );
}
