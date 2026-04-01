import React, { useState, useEffect, useRef } from 'react';
import { Database, Search, Send, FileCode, Bot, User, Code2, AlertTriangle, Cpu } from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-toastify';

export default function ProtheusStudyChat() {
    const [catalog, setCatalog] = useState([]);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const chatEndRef = useRef(null);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const loadData = async () => {
        try {
            const [catRes, chatRes] = await Promise.all([
                api.get('/protheus-study/catalog'),
                api.get('/protheus-study/chat')
            ]);
            setCatalog(catRes.data);
            setMessages(chatRes.data);
        } catch (err) {
            console.error(err);
            toast.error('Erro ao carregar dados do Protheus Study.');
        }
    };

    const handleSend = async (e) => {
        e?.preventDefault();
        if (!input.trim() || loading) return;

        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', message: userMsg }]);
        setLoading(true);

        try {
            const { data } = await api.post('/protheus-study/chat', { message: userMsg });
            setMessages(prev => [...prev, { role: 'assistant', message: data.response }]);
        } catch (err) {
            toast.error('Falha ao processar pergunta. Verifique o console.');
        } finally {
            setLoading(false);
        }
    };

    const injectQueryToChat = (sql) => {
        setInput(`Por favor, explique esta consulta SQL:\\n\\n${sql}`);
    };

    const filteredCatalog = catalog.filter(item => 
        item.file_source.toLowerCase().includes(searchTerm.toLowerCase()) || 
        item.sql_content.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="h-[calc(100vh-6rem)] flex flex-col md:flex-row gap-4 bg-gray-50 p-2 md:p-4 font-sans">
            {/* Catalyst Sidebar */}
            <div className="w-full md:w-1/3 max-w-sm bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-slate-900 text-white flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/10 rounded-lg">
                            <Database className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="font-bold text-sm leading-tight">Mapeamento SQL</h2>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Metalfisa Protheus</p>
                        </div>
                    </div>
                    <span className="text-xs bg-slate-800 text-slate-300 font-bold px-2 py-1 rounded font-mono">{catalog.length} DBs</span>
                </div>
                
                <div className="p-3 border-b border-gray-100 bg-white">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar no código ou origem..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50/50">
                    {filteredCatalog.map(item => (
                        <div key={item.id} className="border border-slate-200 rounded-xl bg-white p-3 hover:border-emerald-300 transition-colors shadow-sm group">
                            <h3 className="text-xs font-bold text-slate-700 flex items-center gap-2 mb-2 truncate">
                                <FileCode className="h-4 w-4 text-emerald-600" /> 
                                {item.file_source}
                            </h3>
                            <pre className="text-[10px] bg-slate-900 text-emerald-400 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap max-h-32 mb-3 font-mono shadow-inner">
                                {item.sql_content}
                            </pre>
                            <button 
                                onClick={() => injectQueryToChat(item.sql_content)}
                                className="w-full py-2 text-xs font-bold bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2"
                            >
                                <Cpu className="h-3 w-3" /> Analisar no Chat
                            </button>
                        </div>
                    ))}
                    {filteredCatalog.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2">
                            <Database className="h-8 w-8 opacity-20" />
                            <p className="text-sm font-medium">Nenhuma query encontrada.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* AI Chat Window */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden relative">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
                            <Bot className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-800 leading-tight">Protheus Agent AI</h2>
                            <p className="text-[10px] text-yellow-600 flex items-center gap-1 font-bold uppercase tracking-wider mt-0.5">
                                <AlertTriangle className="h-3 w-3" /> Tolerância Zero a Alucinações
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-50/40 via-white to-slate-50/50">
                    {/* Welcome message */}
                    <div className="flex gap-4 max-w-[85%]">
                        <div className="w-8 h-8 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center flex-shrink-0 shadow-sm mt-1">
                            <Bot className="h-4 w-4 text-indigo-600" />
                        </div>
                        <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm p-4 text-sm text-slate-700 shadow-sm">
                            Olá! Sou o assistente de dados **especialista focado INTEIRAMENTE no banco de dados Protheus** da MetalFisa. 
                            Respiro estrutura padrão TOTVS e ADVPL. Fui instruído estritamente com as tabelas, lógicas e dicionários de dados do seu sistema. Como posso ajudar com a sua engenharia reversa hoje?
                        </div>
                    </div>

                    {messages.map((m, i) => (
                        <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'flex-row-reverse self-end ml-auto' : ''} max-w-[85%]`}>
                            <div className={`w-8 h-8 rounded-xl border flex items-center justify-center flex-shrink-0 shadow-sm mt-1 ${m.role === 'user' ? 'bg-emerald-600 border-emerald-700 text-white' : 'bg-indigo-100 border-indigo-200 text-indigo-600'}`}>
                                {m.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                            </div>
                            <div className={`border rounded-2xl p-4 text-[13px] md:text-sm shadow-sm ${m.role === 'user' ? 'bg-emerald-600 border-emerald-700 text-white rounded-tr-sm' : 'bg-white border-slate-200 text-slate-700 rounded-tl-sm'}`}>
                                {m.role === 'user' ? (
                                    <p className="whitespace-pre-wrap font-medium">{m.message}</p>
                                ) : (
                                    <div className="whitespace-pre-wrap leading-relaxed font-sans [&>blockquote]:border-l-4 [&>blockquote]:border-indigo-500 [&>blockquote]:pl-4 [&>blockquote]:my-2 [&>blockquote]:text-slate-500 [&>pre]:bg-slate-900 [&>pre]:text-emerald-400 [&>pre]:p-4 [&>pre]:rounded-xl [&>pre]:shadow-inner [&>pre]:my-3 [&>code]:bg-slate-100 [&>code]:text-pink-600 [&>code]:px-1.5 [&>code]:py-0.5 [&>code]:rounded-md [&>code]:font-bold">
                                        {/* Basic Markdown parsing for code blocks without heavy react-markdown packages */}
                                        {m.message.split('\`\`\`').map((part, index) => 
                                            index % 2 === 1 
                                                ? <pre key={index} className="overflow-x-auto text-xs font-mono">{part.replace(/^(sql|javascript|json|html)\\n?/, '')}</pre>
                                                : <p key={index} className="mb-2" dangerouslySetInnerHTML={{__html: part.replace(/\\*\\*(.*?)\\*\\*/g, '<b>$1</b>').replace(/\\*(.*?)\\*/g, '<i>$1</i>').replace(/\\n/g, '<br/>')}} />
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    
                    {loading && (
                        <div className="flex gap-4 max-w-[85%]">
                            <div className="w-8 h-8 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center flex-shrink-0 shadow-sm mt-1">
                                <Bot className="h-4 w-4 text-indigo-600" />
                            </div>
                            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm p-4 text-sm text-slate-500 shadow-sm flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-400 mr-2">Analisando</span>
                                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div>
                                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                <div className="p-4 bg-white border-t border-gray-100 flex-shrink-0">
                    <form onSubmit={handleSend} className="relative flex items-center">
                        <Code2 className="absolute left-4 h-5 w-5 text-gray-400" />
                        <textarea
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder="Faça perguntas sobre regras de negócio, tabelas ou peças..."
                            className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-2xl pl-12 pr-14 py-3.5 text-sm min-h-[220px] resize-y focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:border-transparent outline-none transition-all shadow-sm"
                            rows="10"
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || loading}
                            className="absolute right-2 p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed shadow-sm transition-all"
                        >
                            <Send className="h-4 w-4" />
                        </button>
                    </form>
                    <p className="text-[10px] text-center text-slate-400 mt-3 font-medium">
                        O Agente pode ser impreciso em tabelas muito legadas. Verifique a referência gerada antes de executar comandos estruturais no DB.
                    </p>
                </div>
            </div>
        </div>
    );
}
