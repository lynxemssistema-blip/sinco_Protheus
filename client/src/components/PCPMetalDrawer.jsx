import React, { useState, useRef, useEffect } from 'react';
import { X, Bot, Send, Loader2, ChevronDown, ChevronUp, Database, CheckCircle2, AlertCircle, Cpu, Pin, PinOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import DOMPurify from 'dompurify';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function PCPMetalChart({ config }) {
    if (!config || !config.data || !config.type) return null;
    return (
        <div className="my-4 border border-slate-200 rounded-xl bg-white p-4 shadow-sm">
            {config.title && <h4 className="font-bold text-sm mb-4 text-slate-700 text-center">{config.title}</h4>}
            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    {config.type === 'bar' ? (
                        <BarChart data={config.data}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey={config.xKey} tick={{fontSize: 10}} stroke="#94a3b8" />
                            <YAxis tick={{fontSize: 10}} stroke="#94a3b8" />
                            <Tooltip contentStyle={{fontSize: '12px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                            <Legend wrapperStyle={{fontSize: '11px'}} />
                            {config.series.map((s, i) => <Bar key={i} dataKey={s.key} name={s.name || s.key} fill={s.color || '#3b82f6'} radius={[4,4,0,0]} />)}
                        </BarChart>
                    ) : config.type === 'line' ? (
                        <LineChart data={config.data}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey={config.xKey} tick={{fontSize: 10}} stroke="#94a3b8" />
                            <YAxis tick={{fontSize: 10}} stroke="#94a3b8" />
                            <Tooltip contentStyle={{fontSize: '12px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                            <Legend wrapperStyle={{fontSize: '11px'}} />
                            {config.series.map((s, i) => <Line key={i} type="monotone" dataKey={s.key} name={s.name || s.key} stroke={s.color || '#3b82f6'} strokeWidth={3} activeDot={{r: 6}} />)}
                        </LineChart>
                    ) : (
                        <div className="flex h-full items-center justify-center text-xs text-slate-400">Tipo de gráfico '{config.type}' não suportado.</div>
                    )}
                </ResponsiveContainer>
            </div>
        </div>
    );
}

// ── Inline Markdown renderer ──────────────────────────────────────────────────
function renderInline(text) {
    if (!text) return '';
    return text
        .replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" class="lynx-chat-img max-w-full max-h-[350px] h-auto object-contain rounded-lg border border-slate-200 shadow-sm my-2 cursor-zoom-in hover:border-slate-350 hover:shadow-md transition-all duration-200" />')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code class="bg-slate-100 px-1 py-0.5 rounded text-xs font-mono text-blue-700">$1</code>');
}

function RenderMarkdown({ text }) {
    if (!text) return null;
    
    // Parse JSON chart blocks
    const blocks = [];
    const lines = text.split('\n');
    let inChartBlock = false;
    let chartJsonStr = '';
    let currText = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim().startsWith('```json-chart')) {
            if (currText) {
                blocks.push({ type: 'markdown', content: currText });
                currText = '';
            }
            inChartBlock = true;
            chartJsonStr = '';
        } else if (inChartBlock && line.trim() === '```') {
            inChartBlock = false;
            try {
                const config = JSON.parse(chartJsonStr);
                blocks.push({ type: 'chart', config });
            } catch (e) {
                blocks.push({ type: 'markdown', content: `❌ Erro ao renderizar gráfico: JSON inválido.\n\n\`\`\`json\n${chartJsonStr}\n\`\`\`` });
            }
            chartJsonStr = '';
        } else if (inChartBlock) {
            chartJsonStr += line + '\n';
        } else {
            currText += line + '\n';
        }
    }
    if (currText) blocks.push({ type: 'markdown', content: currText });

    return (
        <div className="space-y-4">
            {blocks.map((block, bIdx) => {
                if (block.type === 'chart') {
                    return <PCPMetalChart key={bIdx} config={block.config} />;
                }
                
                const mdLines = block.content.split('\n');
                return (
                    <div key={bIdx} className="prose prose-sm max-w-none text-slate-800 space-y-1">
                        {mdLines.map((line, i) => {
                            if (line.startsWith('### ')) return <h3 key={i} className="text-sm font-bold text-slate-900 mt-3 mb-1">{line.slice(4)}</h3>;
                            if (line.startsWith('## ')) return <h2 key={i} className="text-base font-bold text-blue-800 mt-4 mb-1 border-b border-blue-100 pb-1">{line.slice(3)}</h2>;
                            if (line.startsWith('# ')) return <h1 key={i} className="text-lg font-bold text-blue-900 mt-4 mb-2">{line.slice(2)}</h1>;
                            if (line.startsWith('- ') || line.startsWith('* '))
                                return <div key={i} className="flex gap-2 text-sm"><span className="text-blue-500 mt-0.5">•</span><span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderInline(line.slice(2)), { ADD_ATTR: ['class'] }) }} /></div>;
                            if (/^\d+\./.test(line))
                                return <div key={i} className="flex gap-2 text-sm"><span className="text-blue-500 font-bold min-w-[16px]">{line.match(/^\d+/)[0]}.</span><span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderInline(line.replace(/^\d+\.\s*/, '')), { ADD_ATTR: ['class'] }) }} /></div>;
                            if (line.startsWith('```')) return null;
                            if (!line.trim()) return <div key={i} className="h-1" />;
                            return <p key={i} className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderInline(line), { ADD_ATTR: ['class'] }) }} />;
                        })}
                    </div>
                );
            })}
        </div>
    );
}

// ── Live Reasoning Panel ──────────────────────────────────────────────────────
function ReasoningPanel({ steps }) {
    const [expanded, setExpanded] = useState(true);
    if (!steps || steps.length === 0) return null;

    const isDone = steps.some(s => s.type === 'done');
    const hasError = steps.some(s => s.type === 'error');

    return (
        <div className={`border rounded-xl overflow-hidden text-xs transition-all ${hasError ? 'border-red-200 bg-red-50' :
            isDone ? 'border-emerald-200 bg-emerald-50' :
                'border-blue-200 bg-blue-50'
            }`}>
            <button onClick={() => setExpanded(v => !v)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left">
                {isDone
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    : hasError
                        ? <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        : <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin shrink-0" />
                }
                <span className={`font-semibold flex-1 ${isDone ? 'text-emerald-700' : hasError ? 'text-red-700' : 'text-blue-700'}`}>
                    {isDone ? 'Raciocínio concluído' : hasError ? 'Erro no processo' : 'Raciocinando...'}
                </span>
                <span className="text-slate-400">{steps.length} etapa(s)</span>
                {expanded ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
            </button>

            {expanded && (
                <div className="border-t border-slate-200 divide-y divide-slate-100">
                    {steps.map((step, i) => (
                        <div key={i} className="flex items-start gap-2 px-3 py-1.5">
                            <span className="shrink-0 mt-0.5 text-base leading-none">{step.icon || '▶'}</span>
                            <span className="text-slate-700 flex-1"
                                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderInline(step.message || ''), { ADD_ATTR: ['class'] }) }} />
                        </div>
                    ))}
                    {!isDone && !hasError && (
                        <div className="px-3 py-1.5 flex items-center gap-2">
                            <span className="inline-block w-2 h-3 bg-blue-500 animate-pulse rounded-sm" />
                            <span className="text-slate-400">aguardando resposta...</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Persistent history helpers (localStorage per user+context) ────────────────
const HISTORY_KEY = (userId, pedido) => `pcpmetal_hist_${userId}_${pedido || 'global'}`;
const MAX_STORED_TURNS = 20;

function loadHistory(userId, pedido) {
    try {
        const raw = localStorage.getItem(HISTORY_KEY(userId, pedido));
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

function saveHistory(userId, pedido, turns) {
    try {
        localStorage.setItem(HISTORY_KEY(userId, pedido), JSON.stringify(turns.slice(-MAX_STORED_TURNS)));
    } catch { /* localStorage full */ }
}

const QUICK_PROMPTS = [
    'Qual o status de fabricação?',
    'Há risco de atraso na entrega?',
    'Quantas peças faltam para entrega?',
    'Qual a estratégia para cumprir o prazo?',
];

// ── Main Drawer ───────────────────────────────────────────────────────────────
// pageData = { ops: [...], selectedOps: [...], filters: {...}, total } — dados da página controle-producao
const PCPMetalDrawer = ({ isOpen, onClose, context = {}, pageData = null }) => {
    const { user } = useAuth();
    const userId = user?.idUsuario || user?.id;

    const [isPinned, setIsPinned] = useState(window.innerWidth >= 1024);
    const [messages, setMessages] = useState([]);
    // historico = lightweight [{role:'user'|'agent', text}] for Gemini context
    const [historico, setHistorico] = useState([]);
    const [input, setInput] = useState('');
    const [lightboxImage, setLightboxImage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showSQL, setShowSQL] = useState({});
    const bottomRef = useRef(null);
    const abortRef = useRef(null);

    // Load persistent history when drawer opens / context changes
    useEffect(() => {
        if (!isOpen) return;

        const stored = loadHistory(userId, context.pedido);

        if (stored.length > 0) {
            // Rebuild UI messages from stored turns
            const rebuilt = [];
            if (context.pedido || context.cliente) {
                const parts = [];
                if (context.pedido) parts.push(`Pedido **${context.pedido.trim()}**`);
                if (context.cliente) parts.push(`Cliente **${context.cliente.trim()}**`);
                rebuilt.push({ role: 'system', text: `📋 Contexto: ${parts.join(' | ')}\n\n_Continuando conversa anterior — ${stored.length} mensagem(s) no histórico._` });
            }
            for (const t of stored) {
                rebuilt.push({ role: t.role === 'user' ? 'user' : 'agent', text: t.text, sqlsExecuted: t.sqlsExecuted });
            }
            setMessages(rebuilt);
            setHistorico(stored.map(t => ({ role: t.role, text: t.text })));
        } else {
            // Fresh conversation
            const parts = [];
            if (context.pedido) parts.push(`Pedido **${context.pedido.trim()}**`);
            if (context.item) parts.push(`Item **${context.item}**`);
            if (context.cliente) parts.push(`Cliente **${context.cliente.trim()}**`);
            if (context.produto) parts.push(`Produto **${context.produto}**`);

            // Indica quantas OPs estão disponíveis no contexto da página
            const opsCount = pageData?.ops?.length || 0;
            const selCount = pageData?.selectedOps?.length || 0;
            const dataInfo = opsCount > 0
                ? `\n\n📊 **${opsCount} OPs carregadas** na tela${selCount > 0 ? ` | **${selCount} selecionadas**` : ''} — minha análise usa esses dados direto.\nPara consultar o banco de dados, mencione palavras como _"consultar"_, _"histórico de apontamentos"_, _"buscar no banco"_.`
                : '';

            const greeting = context.page === 'apontamento-vertical'
                ? `👋 Olá! Sou o **PCPMetal AI**.\n\nEstou pronto para ajudar você na análise da **Fila de Produção por Setor (Vertical)**.${context.recurso ? ` O recurso selecionado atualmente é **${context.recurso}**.` : ''}${dataInfo}\n\nPosso sequenciar OPs, calcular tempos acumulados, verificar gargalos ou responder perguntas sobre o andamento dos processos deste setor. Como posso ajudar?`
                : parts.length > 0
                ? `📋 Contexto: ${parts.join(' | ')}${dataInfo}\n\nFaça sua pergunta sobre este pedido ou qualquer análise de produção.`
                : `👋 Olá! Sou o **PCPMetal**, seu assistente de PCP.${dataInfo}\n\nPosso analisar as OPs da tela, calcular saldos e sugerir estratégias. Como posso ajudar?`;

            setMessages([{ role: 'system', text: greeting }]);
            setHistorico([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, context.pedido, userId]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Cancel any ongoing stream on unmount / close
    useEffect(() => {
        if (!isOpen && abortRef.current) abortRef.current.abort();
    }, [isOpen]);

    // Push layout content when pinned
    useEffect(() => {
        const mainEl = document.querySelector('main');
        if (!mainEl) return;
        
        // 576px is max-w-xl (36rem)
        if (isOpen && isPinned) {
            mainEl.style.paddingRight = '576px';
            mainEl.style.transition = 'padding-right 300ms ease-in-out';
        } else {
            mainEl.style.paddingRight = '';
        }

        return () => {
            mainEl.style.paddingRight = '';
        };
    }, [isOpen, isPinned]);

    const handleSend = async (forcedText = null) => {
        const textToSend = typeof forcedText === 'string' ? forcedText : input.trim();
        if (!textToSend || loading) return;
        const question = textToSend;
        if (typeof forcedText !== 'string') setInput('');

        // Append user message to UI and history
        setMessages(prev => [...prev, { role: 'user', text: question }]);
        const newHistorico = [...historico, { role: 'user', text: question }];
        setHistorico(newHistorico);
        setLoading(true);

        const thinkMsgId = `think-${Date.now()}`;
        setMessages(prev => [...prev, { role: 'thinking', id: thinkMsgId, steps: [] }]);

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            const response = await fetch('/api/pcpmetal/ask-stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('@Lynx:token') || ''}`,
                },
                body: JSON.stringify({
                    pergunta: question,
                    pedido: context.pedido || null,
                    item: context.item || null,
                    cliente: context.cliente || null,
                    produto: context.produto || null,
                    userId,
                    // send last 6 turns as context (text only to save tokens)
                    historico: newHistorico.slice(-6).map(h => ({ role: h.role, text: h.text.slice(0, 800) })),
                    // Envia dados da página (OPs visíveis + selecionadas + filtros) como contexto primário
                    pageData: pageData ? {
                        ops: (pageData.ops || []).slice(0, 200),           // limita a 200 OPs para não explodir o payload
                        selectedOps: (pageData.selectedOps || []).slice(0, 50),
                        filters: pageData.filters || null,
                        total: pageData.total || 0
                    } : null,
                }),
                signal: controller.signal,
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // keep incomplete line

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const data = JSON.parse(line.slice(6));

                        if (data.type === 'result') {
                            const agentMsg = {
                                role: 'agent',
                                text: data.answer,
                                sqlsExecuted: data.sqlsExecuted || []
                            };
                            setMessages(prev => [
                                ...prev.filter(m => m.id !== thinkMsgId),
                                agentMsg
                            ]);

                            // Persist full history including this answer
                            const fullHistory = [
                                ...newHistorico,
                                { role: 'agent', text: data.answer, sqlsExecuted: data.sqlsExecuted }
                            ];
                            setHistorico(fullHistory);
                            saveHistory(userId, context.pedido, fullHistory);
                            setLoading(false);
                            continue;
                        }

                        if (data.type === 'error') {
                            setMessages(prev => [
                                ...prev.filter(m => m.id !== thinkMsgId),
                                { role: 'error', text: `❌ ${data.message}` }
                            ]);
                            setLoading(false);
                            continue;
                        }

                        // Step events — append to thinking bubble
                        setMessages(prev => prev.map(m =>
                            m.id === thinkMsgId
                                ? { ...m, steps: [...(m.steps || []), data] }
                                : m
                        ));
                    } catch (_) { /* malformed JSON line */ }
                }
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                setMessages(prev => [
                    ...prev.filter(m => m.id !== thinkMsgId),
                    { role: 'error', text: `❌ Erro de conexão: ${err.message}` }
                ]);
            }
            setLoading(false);
        }
    };

    const handleClearHistory = () => {
        if (!window.confirm('Limpar todo o histórico desta conversa?')) return;
        saveHistory(userId, context.pedido, []);
        setHistorico([]);
        const parts = [];
        if (context.pedido) parts.push(`Pedido **${context.pedido.trim()}**`);
        if (context.cliente) parts.push(`Cliente **${context.cliente.trim()}**`);
        setMessages([{ role: 'system', text: parts.length > 0 ? `📋 Contexto: ${parts.join(' | ')}\n\nHistórico limpo. Nova conversa iniciada.` : '👋 Nova conversa iniciada.' }]);
    };

    if (!isOpen) return null;

    const histCount = historico.filter(h => h.role === 'user').length;

    return (
        <div className={`fixed inset-0 z-[200] flex items-stretch justify-end pointer-events-none`}>
            {/* Backdrop */}
            {!isPinned && (
                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm pointer-events-auto" onClick={onClose} />
            )}

            {/* Drawer */}
            <div className={`relative w-full max-w-xl h-full bg-white shadow-2xl flex flex-col pointer-events-auto animate-in slide-in-from-right duration-300 ${isPinned ? 'border-l border-slate-200' : ''}`}>

                {/* Header */}
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-700 to-blue-900 text-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                            <Bot className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="font-bold text-base flex items-center gap-2">
                                PCPMetal AI
                                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-normal">gemini-2.5</span>
                            </h2>
                            <p className="text-xs opacity-70">
                                {histCount > 0 ? `${histCount} pergunta(s) no histórico` : 'Nova conversa'}
                                {context.pedido && ` · Pedido ${context.pedido.trim()}`}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        {histCount > 0 && (
                            <button
                                onClick={handleClearHistory}
                                title="Limpar histórico"
                                className="text-[10px] px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                            >
                                Limpar
                            </button>
                        )}
                        <button 
                            onClick={() => setIsPinned(!isPinned)} 
                            title={isPinned ? "Desafixar" : "Fixar janela"}
                            className={`p-2 hover:bg-white/10 rounded-lg transition-colors ml-1 ${isPinned ? 'bg-white/20' : ''}`}
                        >
                            {isPinned ? <PinOff className="w-5 h-5" /> : <Pin className="w-5 h-5" />}
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors ml-1">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div 
                    className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50"
                    onClick={(e) => {
                        if (e.target.tagName === 'IMG' && e.target.classList.contains('lynx-chat-img')) {
                            setLightboxImage({ src: e.target.src, alt: e.target.alt });
                        }
                    }}
                >
                    {messages.map((msg, idx) => (
                        <div key={msg.id || idx}>

                            {msg.role === 'system' && (
                                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                                    <RenderMarkdown text={msg.text} />
                                </div>
                            )}

                            {msg.role === 'user' && (
                                <div className="flex justify-end">
                                    <div className="max-w-[85%] bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-3">
                                        <p className="text-sm">{msg.text}</p>
                                    </div>
                                </div>
                            )}

                            {msg.role === 'thinking' && (
                                <div className="flex gap-2">
                                    <div className="w-7 h-7 rounded-full bg-blue-700 flex items-center justify-center shrink-0 mt-1">
                                        <Cpu className="w-4 h-4 text-white animate-pulse" />
                                    </div>
                                    <div className="flex-1">
                                        <ReasoningPanel steps={msg.steps} />
                                    </div>
                                </div>
                            )}

                            {msg.role === 'agent' && (
                                <div className="flex gap-2">
                                    <div className="w-7 h-7 rounded-full bg-blue-700 flex items-center justify-center shrink-0 mt-1">
                                        <Bot className="w-4 h-4 text-white" />
                                    </div>
                                    <div className="flex-1 bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                                        <RenderMarkdown text={msg.text} />
                                        {msg.sqlsExecuted?.length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-slate-100">
                                                <button
                                                    className="flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-slate-600"
                                                    onClick={() => setShowSQL(p => ({ ...p, [idx]: !p[idx] }))}
                                                >
                                                    <Database className="w-3 h-3" />
                                                    {msg.sqlsExecuted.length} consulta(s) executada(s)
                                                    {showSQL[idx] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                                </button>
                                                {showSQL[idx] && (
                                                    <div className="mt-2 space-y-1">
                                                        {msg.sqlsExecuted.map((s, si) => (
                                                            <div key={si} className="bg-slate-900 text-emerald-400 text-[10px] font-mono p-2 rounded-lg overflow-x-auto">
                                                                <span className="text-slate-400 uppercase text-[8px] tracking-wider">[{s.banco}] </span>
                                                                {s.sql}
                                                                {s.error && <span className="text-red-400 block mt-1">Erro: {s.error}</span>}
                                                                {s.rowCount !== undefined && !s.error && <span className="text-slate-500 block mt-1">{s.rowCount} linha(s)</span>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {msg.role === 'error' && (
                                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
                                    {msg.text}
                                </div>
                            )}
                        </div>
                    ))}
                    <div ref={bottomRef} />
                </div>

                {/* Quick Prompts */}
                {historico.length === 0 && (
                    <div className="px-4 py-2 bg-white border-t border-slate-100 shrink-0">
                        <p className="text-[10px] text-slate-400 uppercase font-bold mb-2">Sugestões:</p>
                        <div className="flex flex-wrap gap-1.5">
                            {QUICK_PROMPTS.map(q => (
                                <button key={q} onClick={() => setInput(q)}
                                    className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1 rounded-full transition-colors">
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Input */}
                <div className="p-4 bg-white border-t border-slate-200 shrink-0">
                    <div className="flex gap-2">
                        <textarea
                            className="flex-1 bg-slate-100 rounded-xl px-4 py-3 text-sm outline-none resize-none focus:ring-2 focus:ring-blue-500 min-h-[160px] max-h-64"
                            placeholder="Pergunte ao PCPMetal... (Enter para enviar)"
                            rows={10}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        />
                        <button
                            onClick={handleSend}
                            disabled={loading || !input.trim()}
                            className="w-12 h-12 rounded-xl bg-blue-700 flex items-center justify-center text-white hover:bg-blue-800 transition-all disabled:opacity-40 active:scale-95"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 text-center">
                        Histórico salvo automaticamente · Shift+Enter para nova linha
                    </p>
                </div>
            </div>

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
};

export default PCPMetalDrawer;
