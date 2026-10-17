import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Loader2, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * PromptCopilot — AI chat panel for improving system prompts and business context.
 *
 * Props:
 *  - fieldType:   'system_prompt' | 'contexto_negocio'
 *  - agentRole:   e.g. 'analista_sql'
 *  - agentNome:   e.g. 'Analista SQL Lynx'
 *  - currentText: current value of the textarea being helped
 *  - onApply:     callback(text) → called when the user clicks "Aplicar"
 */
export default function PromptCopilot({ fieldType, agentRole, agentNome, currentText, onApply }) {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [historico, setHistorico] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(null);
    const bottomRef = useRef(null);
    const abortRef = useRef(null);

    const fieldLabel = fieldType === 'system_prompt' ? 'System Prompt' : 'Contexto de Negócio';

    // Greeting when first opened
    useEffect(() => {
        if (open && messages.length === 0) {
            const greeting = currentText?.trim()
                ? `Olá! Vou ajudar a aprimorar o **${fieldLabel}** do agente **${agentNome || agentRole}**.\n\nLi o texto atual do campo. O que você quer melhorar? Posso:\n- Revisar e reescrever com mais precisão\n- Adicionar regras específicas de banco de dados\n- Tornar as instruções mais detalhadas\n- Criar uma versão do zero`
                : `Olá! Vou ajudar a criar o **${fieldLabel}** do agente **${agentNome || agentRole}** do zero.\n\nMe conta: qual é o foco principal deste agente? O que ele deve fazer e o que nunca deve fazer?`;
            setMessages([{ role: 'assistant', text: greeting }]);
        }
    }, [open]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (!open && abortRef.current) abortRef.current.abort();
    }, [open]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;
        const question = input.trim();
        setInput('');

        const newMsg = { role: 'user', text: question };
        setMessages(prev => [...prev, newMsg]);
        const newHist = [...historico, { role: 'user', text: question }];
        setHistorico(newHist);
        setLoading(true);

        const thinkId = `think-${Date.now()}`;
        setMessages(prev => [...prev, { role: 'thinking', id: thinkId }]);

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            const res = await fetch('/api/pcpmetal/prompt-copilot', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
                },
                body: JSON.stringify({
                    userMessage: question,
                    currentText,   // always send the LIVE value of the textarea
                    fieldType,
                    agentRole,
                    agentNome,
                    historico: newHist.slice(-8).map(h => ({ role: h.role, text: h.text.slice(0, 1000) })),
                }),
                signal: controller.signal,
            });

            const reader = res.body.getReader();
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
                            const aMsg = { role: 'assistant', text: data.answer };
                            setMessages(prev => [...prev.filter(m => m.id !== thinkId), aMsg]);
                            setHistorico(prev => [...prev, { role: 'assistant', text: data.answer }]);
                            setLoading(false);
                        } else if (data.type === 'error') {
                            setMessages(prev => [...prev.filter(m => m.id !== thinkId), { role: 'error', text: data.message }]);
                            setLoading(false);
                        }
                    } catch (_) { }
                }
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                setMessages(prev => [...prev.filter(m => m.id !== thinkId && m.id !== thinkId), { role: 'error', text: err.message }]);
            }
            setLoading(false);
        }
    };

    // Parse assistant message: extract [PROMPT_SUGERIDO] blocks
    const parseSuggestion = (text) => {
        const match = text.match(/\[PROMPT_SUGERIDO\]([\s\S]*?)\[\/PROMPT_SUGERIDO\]/);
        if (!match) return { prose: text, suggestion: null };
        const before = text.slice(0, text.indexOf('[PROMPT_SUGERIDO]')).trim();
        const after = text.slice(text.indexOf('[/PROMPT_SUGERIDO]') + '[/PROMPT_SUGERIDO]'.length).trim();
        const prose = [before, after].filter(Boolean).join('\n\n');
        return { prose, suggestion: match[1].trim() };
    };

    const handleCopy = (text, idx) => {
        navigator.clipboard.writeText(text);
        setCopied(idx);
        setTimeout(() => setCopied(null), 2000);
    };

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors border border-blue-200"
                title={`Copiloto de IA para ${fieldLabel}`}
            >
                <Sparkles className="w-3.5 h-3.5" />
                Copiloto IA
            </button>
        );
    }

    return (
        <div className="border border-blue-200 rounded-2xl overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50 shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-blue-700 to-indigo-700 text-white">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    <span className="font-bold text-sm">Copiloto de Prompt — {fieldLabel}</span>
                </div>
                <button onClick={() => setOpen(false)} className="p-1 hover:bg-white/10 rounded-lg">
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Context pill */}
            {currentText?.trim() && (
                <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-start gap-2">
                    <span className="text-[10px] font-bold text-blue-600 uppercase shrink-0 mt-0.5">Contexto atual</span>
                    <p className="text-[10px] text-slate-600 font-mono line-clamp-2 flex-1">{currentText}</p>
                </div>
            )}

            {/* Messages */}
            <div className="h-72 overflow-y-auto p-3 space-y-3">
                {messages.map((msg, idx) => {
                    if (msg.role === 'thinking') {
                        return (
                            <div key={msg.id} className="flex items-center gap-2 text-slate-400 text-xs">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                                <span className="animate-pulse">Gerando sugestão...</span>
                            </div>
                        );
                    }
                    if (msg.role === 'error') {
                        return <div key={idx} className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-2 text-xs">{msg.text}</div>;
                    }
                    if (msg.role === 'user') {
                        return (
                            <div key={idx} className="flex justify-end">
                                <div className="max-w-[80%] bg-blue-600 text-white rounded-2xl rounded-tr-sm px-3 py-2 text-xs">{msg.text}</div>
                            </div>
                        );
                    }
                    // Assistant message — parse suggestion blocks
                    const { prose, suggestion } = parseSuggestion(msg.text);
                    return (
                        <div key={idx} className="space-y-2">
                            {prose && (
                                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-3 py-2 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                                    {prose}
                                </div>
                            )}
                            {suggestion && (
                                <div className="bg-white border-2 border-blue-300 rounded-xl overflow-hidden">
                                    <div className="flex items-center justify-between bg-blue-50 px-3 py-1.5 border-b border-blue-200">
                                        <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wide">✨ Texto sugerido</span>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleCopy(suggestion, idx)}
                                                className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700"
                                            >
                                                {copied === idx ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                                {copied === idx ? 'Copiado!' : 'Copiar'}
                                            </button>
                                            <button
                                                onClick={() => onApply(suggestion)}
                                                className="flex items-center gap-1 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 px-2 py-0.5 rounded-lg"
                                            >
                                                ✓ Aplicar
                                            </button>
                                        </div>
                                    </div>
                                    <pre className="px-3 py-2 text-[10px] text-slate-700 whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">
                                        {suggestion}
                                    </pre>
                                </div>
                            )}
                        </div>
                    );
                })}
                <div ref={bottomRef} />
            </div>

            {/* Quick actions */}
            <div className="px-3 py-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                {[
                    'Reescreva com mais precisão',
                    'Adicione regras de segurança SQL',
                    'Torne mais detalhado',
                    'Crie do zero para este papel',
                ].map(q => (
                    <button key={q} onClick={() => setInput(q)}
                        className="text-[10px] bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700 px-2 py-1 rounded-full transition-colors border border-slate-200">
                        {q}
                    </button>
                ))}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-slate-200 flex gap-2">
                <textarea
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none resize-none focus:ring-2 focus:ring-blue-400 min-h-[44px] max-h-24"
                    placeholder="Peça uma melhoria, faça uma pergunta ou descreva o que o agente deve fazer..."
                    rows={2}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                />
                <button
                    onClick={handleSend}
                    disabled={loading || !input.trim()}
                    className="w-9 h-9 self-end rounded-xl bg-blue-700 flex items-center justify-center text-white hover:bg-blue-800 disabled:opacity-40 active:scale-95"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
            </div>
        </div>
    );
}
