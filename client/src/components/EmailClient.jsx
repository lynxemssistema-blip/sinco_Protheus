import React, { useState, useEffect } from 'react';
import { Mail, Send, Inbox, RefreshCw, PenTool, Paperclip, Trash2, ArrowLeft, Loader2, X, Search } from 'lucide-react';
import { api, getUsers } from '../services/api'; // using internal axios instance for fetching

export default function EmailClient() {
    const [view, setView] = useState('inbox'); // 'inbox', 'compose'
    const [currentFolder, setCurrentFolder] = useState('INBOX'); // 'INBOX', 'SENT'
    const [emails, setEmails] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedEmail, setSelectedEmail] = useState(null);

    // Compose Form State
    const [composeForm, setComposeForm] = useState({ to: [], subject: '', text: '', attachments: [] });
    const [sending, setSending] = useState(false);
    
    const [users, setUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);

    useEffect(() => {
        if (view === 'inbox') fetchInbox();
        if (view === 'compose' && users.length === 0) fetchUsers();
    }, [view]);

    const fetchUsers = async () => {
        try {
            const data = await getUsers();
            setUsers(data.filter(u => u.aprovado === 1 && u.email));
        } catch(e) { console.error('Erro ao buscar usuários', e); }
    };

    const fetchInbox = async () => {
        setLoading(true);
        try {
            const res = await api.get('/email/inbox');
            if (res.data && res.data.data) {
                setEmails(res.data.data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (composeForm.to.length === 0) {
            alert('Selecione pelo menos um destinatário!');
            return;
        }

        setSending(true);
        try {
            const formData = new FormData();
            formData.append('to', composeForm.to.map(u => u.email).join(', '));
            formData.append('subject', composeForm.subject);
            formData.append('text', composeForm.text);
            
            composeForm.attachments.forEach(file => {
                formData.append('attachments', file);
            });

            await api.post('/email/send', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert('E-mail enviado com sucesso!');
            setComposeForm({ to: [], subject: '', text: '', attachments: [] });
            setView('inbox');
        } catch (err) {
            alert('Erro ao enviar: ' + (err.response?.data?.error || err.message));
        } finally {
            setSending(false);
        }
    };

    const handleAttachment = (e) => {
        const files = Array.from(e.target.files);
        setComposeForm(prev => ({ ...prev, attachments: [...prev.attachments, ...files] }));
    };

    const removeAttachment = (index) => {
        setComposeForm(prev => {
            const newAtt = [...prev.attachments];
            newAtt.splice(index, 1);
            return { ...prev, attachments: newAtt };
        });
    };

    const addRecipient = (u) => {
        setComposeForm(prev => ({ ...prev, to: [...prev.to, u] }));
        setSearchTerm('');
        setShowDropdown(false);
    };

    const removeRecipient = (id) => {
        setComposeForm(prev => ({ ...prev, to: prev.to.filter(t => t.idUsuario !== id) }));
    };

    const handleRead = async (emailProxy) => {
        setView('inbox'); // Mantém o painel do meio amostra!
        setLoading(true);
        try {
            const res = await api.get(`/email/message/${emailProxy.id}`);
            setSelectedEmail(res.data);
            
            // Mark as read in local list if needed
            setEmails(prev => prev.map(m => m.id === emailProxy.id ? { ...m, read_status: 1 } : m));
        } catch (err) {
            console.error(err);
            setSelectedEmail(emailProxy); // fallback to list metadata
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-full w-full bg-white text-slate-800">
            {/* SIDEBAR (PAINEL ESQUERDO) */}
            <div className="w-56 border-r border-slate-200 bg-slate-50 flex flex-col shrink-0">
                <div className="p-3 border-b border-slate-200">
                    <button
                        onClick={() => { setView('compose'); setSelectedEmail(null); }}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg flex items-center justify-center gap-2 transition shadow-sm"
                    >
                        <PenTool className="w-4 h-4" /> Nova Mensagem
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto py-2">
                    <ul className="space-y-1">
                        <li>
                            <button
                                onClick={() => { setView('inbox'); setCurrentFolder('INBOX'); setSelectedEmail(null); }}
                                className={`w-full text-left px-4 py-2 flex items-center gap-3 text-sm font-medium ${view === 'inbox' && currentFolder === 'INBOX' ? 'bg-blue-100 text-blue-700 border-r-4 border-blue-600' : 'text-slate-600 hover:bg-slate-100'}`}
                            >
                                <Inbox className="w-4 h-4" />
                                Caixa de Entrada
                                {emails.filter(e => e.folder === 'INBOX' && !e.read_status).length > 0 && (
                                    <span className="ml-auto bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                                        {emails.filter(e => e.folder === 'INBOX' && !e.read_status).length}
                                    </span>
                                )}
                            </button>
                        </li>
                        <li>
                            <button
                                onClick={() => { setView('inbox'); setCurrentFolder('SENT'); setSelectedEmail(null); }}
                                className={`w-full text-left px-4 py-2 flex items-center gap-3 text-sm font-medium ${view === 'inbox' && currentFolder === 'SENT' ? 'bg-blue-100 text-blue-700 border-r-4 border-blue-600' : 'text-slate-600 hover:bg-slate-100'}`}
                            >
                                <Send className="w-4 h-4" />
                                Enviados
                            </button>
                        </li>
                    </ul>
                </div>
            </div>

            {/* MESSAGE LIST (PAINEL CENTRAL) */}
            {view !== 'compose' && (
                <div className="w-[320px] 2xl:w-[400px] border-r border-slate-200 bg-white flex flex-col shrink-0">
                    {/* List Toolbar */}
                    <div className="h-14 border-b border-slate-200 flex items-center px-3 justify-between bg-slate-50 shrink-0">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Pesquisar..." 
                                className="w-full bg-white border border-slate-200 rounded-md pl-8 pr-2 py-1.5 text-sm outline-none focus:border-blue-500 transition-colors shadow-sm"
                            />
                        </div>
                        <button onClick={fetchInbox} disabled={loading} className="p-2 ml-2 text-slate-500 hover:bg-slate-200 hover:text-slate-700 rounded-md transition" title="Atualizar">
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                    {/* Infinite Scroll List */}
                    <div className="flex-1 overflow-y-auto">
                        {loading && emails.length === 0 ? (
                            <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
                        ) : emails.filter(e => e.folder === currentFolder).length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-8 text-slate-400 text-center mt-10">
                                {currentFolder === 'INBOX' ? <Inbox className="w-10 h-10 mb-3 opacity-20" /> : <Send className="w-10 h-10 mb-3 opacity-20" />}
                                <p className="text-sm">Sua lista está vazia.</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {emails.filter(e => e.folder === currentFolder).map(email => (
                                    <li 
                                        key={email.id} 
                                        onClick={() => handleRead(email)}
                                        className={`p-3 hover:bg-blue-50/50 cursor-pointer flex items-center gap-3 transition border-l-2 ${selectedEmail?.id === email.id ? 'bg-blue-50 border-blue-500' : 'border-transparent'} ${!email.read_status && email.folder === 'INBOX' ? 'bg-slate-50/50' : ''}`}
                                    >
                                        {!email.read_status && email.folder === 'INBOX' && (
                                            <div className="w-2 h-2 rounded-full bg-blue-600 shrink-0"></div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-0.5">
                                                <span className={`font-medium ${!email.read_status && email.folder === 'INBOX' ? 'text-slate-900' : 'text-slate-700'} truncate text-sm mr-2 flex-1`}>
                                                    {currentFolder === 'SENT' ? 
                                                        `Para: ${email.recipient_email || 'Desconhecido'}` : 
                                                        (email.sender_name || email.sender_email || 'Desconhecido')
                                                    }
                                                </span>
                                                <span className="text-[10px] text-slate-500 shrink-0">
                                                    {new Date(email.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center gap-2">
                                                <span className={`text-xs truncate ${!email.read_status && email.folder === 'INBOX' ? 'font-semibold text-slate-800' : 'text-slate-500'}`}>
                                                    {email.subject || '(Sem Assunto)'}
                                                </span>
                                                {email.has_attachments === 1 && <Paperclip className="w-3 h-3 text-slate-400 shrink-0" />}
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}

            {/* CONTENT PANE (PAINEL DIREITO DE LEITURA OU NOVA MENSAGEM) */}
            <div className="flex-1 flex flex-col bg-white overflow-hidden relative">
                
                {view === 'compose' ? (
                    // COMPOSE VIEW
                    <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-6 lg:p-8">
                        <form onSubmit={handleSend} className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full min-h-[600px]">
                            {/* Toolbar Compose */}
                            <div className="h-14 border-b border-slate-100 flex items-center px-4 justify-between bg-white shrink-0">
                                <div className="flex items-center gap-2">
                                    <button type="button" onClick={() => setView('inbox')} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition">
                                        <ArrowLeft className="w-5 h-5" />
                                    </button>
                                    <h2 className="font-bold text-slate-800 text-lg">Nova Mensagem</h2>
                                </div>
                            </div>
                            
                            <div className="p-4 border-b border-slate-100 flex flex-col gap-3">
                                <div className="relative border-b border-slate-200 pb-2">
                                    <div className="flex flex-wrap gap-2 items-center px-1">
                                        <span className="text-sm font-medium text-slate-500">Para:</span>
                                        {composeForm.to.map(u => (
                                            <span key={u.idUsuario} className="bg-blue-100 text-blue-700 px-2 py-1 rounded-md text-xs font-semibold flex items-center gap-1">
                                                {u.nome || u.NomeCompleto || u.email} 
                                                <button type="button" onClick={() => removeRecipient(u.idUsuario)} className="hover:text-red-500 transition-colors">
                                                    <X className="w-3 h-3"/>
                                                </button>
                                            </span>
                                        ))}
                                        <input 
                                            className="flex-1 outline-none text-sm min-w-[150px] bg-transparent py-1" 
                                            placeholder={composeForm.to.length === 0 ? "Buscar contato corporativo..." : "Adicionar mais..."} 
                                            value={searchTerm}
                                            onChange={e => { setSearchTerm(e.target.value); setShowDropdown(true); }}
                                            onFocus={() => setShowDropdown(true)}
                                            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                                        />
                                    </div>
                                    
                                    {showDropdown && (
                                        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 shadow-xl rounded-lg max-h-60 overflow-y-auto z-50">
                                            {users.filter(u => 
                                                !composeForm.to.find(t => t.idUsuario === u.idUsuario) &&
                                                ((u.nome || u.NomeCompleto || '').toLowerCase().includes(searchTerm.toLowerCase()) || (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()))
                                            ).map(u => (
                                                <div 
                                                    key={u.idUsuario} 
                                                    className="p-3 hover:bg-slate-50 cursor-pointer flex justify-between items-center border-b border-slate-50 last:border-0"
                                                    onClick={() => addRecipient(u)}
                                                >
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-semibold text-slate-800">{u.nome || u.NomeCompleto || 'Desconhecido'}</span>
                                                        <span className="text-xs text-slate-500">{u.email}</span>
                                                    </div>
                                                </div>
                                            ))}
                                            {users.filter(u => 
                                                !composeForm.to.find(t => t.idUsuario === u.idUsuario) &&
                                                ((u.nome || u.NomeCompleto || '').toLowerCase().includes(searchTerm.toLowerCase()) || (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()))
                                            ).length === 0 && (
                                                <div className="p-3 text-sm text-slate-500 text-center">Nenhum contato encontrado.</div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <input 
                                    className="w-full outline-none text-lg font-bold px-1" 
                                    placeholder="Assunto" 
                                    required
                                    value={composeForm.subject}
                                    onChange={e => setComposeForm({...composeForm, subject: e.target.value})}
                                />
                            </div>
                            <div className="flex-1 px-4 py-2">
                                <textarea 
                                    className="w-full h-full min-h-[300px] outline-none resize-none text-slate-700"
                                    placeholder="Escreva sua mensagem aqui..."
                                    required
                                    value={composeForm.text}
                                    onChange={e => setComposeForm({...composeForm, text: e.target.value})}
                                ></textarea>
                            </div>
                            
                            {composeForm.attachments.length > 0 && (
                                <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-2 shrink-0">
                                    {composeForm.attachments.map((file, idx) => (
                                        <div key={idx} className="flex items-center gap-2 bg-white border border-slate-200 shadow-sm px-3 py-1.5 rounded-lg text-sm group">
                                            <Paperclip className="w-3 h-3 text-slate-400" />
                                            <span className="truncate max-w-[150px] font-medium text-slate-700">{file.name}</span>
                                            <span className="text-xs text-slate-400">({Math.round(file.size/1024)} KB)</span>
                                            <button type="button" onClick={() => removeAttachment(idx)} className="text-slate-400 hover:text-red-500 transition ml-1">
                                                <X className="w-4 h-4"/>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                                <div>
                                    <input type="file" multiple id="email-attachments" className="hidden" onChange={handleAttachment} />
                                    <label htmlFor="email-attachments" className="cursor-pointer text-slate-600 hover:text-blue-600 px-3 py-2 flex items-center gap-2 text-sm font-medium transition-colors hover:bg-blue-50 rounded-lg">
                                        <Paperclip className="w-5 h-5"/> Anexar Arquivos
                                    </label>
                                </div>
                                <button 
                                    type="submit" 
                                    disabled={sending}
                                    className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2"
                                >
                                    {sending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}
                                    {sending ? 'Enviando...' : 'Enviar Email'}
                                </button>
                            </div>
                        </form>
                    </div>
                ) : selectedEmail ? (
                    // READ VIEW
                    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
                        {/* Toolbar Read */}
                        <div className="h-14 border-b border-slate-200 flex items-center px-4 justify-between bg-slate-50 shrink-0">
                            <div className="flex items-center gap-3">
                                <button className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-md transition border border-transparent hover:border-slate-300" title="Responder">
                                    <ArrowLeft className="w-4 h-4 transform rotate-180" />
                                </button>
                                <button className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-md transition border border-transparent hover:border-slate-300" title="Apagar">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 lg:p-10">
                            <div className="max-w-4xl mx-auto">
                                <h1 className="text-2xl font-bold text-slate-900 mb-6">{selectedEmail.subject}</h1>
                                
                                <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-200">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-lg">
                                            {(selectedEmail.folder === 'SENT' ? 
                                                (selectedEmail.recipient_email || 'D') : 
                                                (selectedEmail.sender_name || selectedEmail.sender_email || 'R')
                                            )[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-800">
                                                {selectedEmail.folder === 'SENT' ? 
                                                    `Para: ${selectedEmail.recipient_email || 'Desconhecido'}` : 
                                                    (selectedEmail.sender_name || 'Desconhecido')
                                                }
                                            </p>
                                            <p className="text-sm text-slate-500">&lt;{selectedEmail.folder === 'SENT' ? selectedEmail.recipient_email : (selectedEmail.sender_email || selectedEmail.recipient_email)}&gt;</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-medium text-slate-600">{new Date(selectedEmail.date).toLocaleString('pt-BR')}</p>
                                    </div>
                                </div>

                                <div className="prose max-w-none prose-slate" dangerouslySetInnerHTML={{ __html: selectedEmail.body_html || selectedEmail.body_text?.replace(/\n/g, '<br/>') || '<i>Sem conteúdo visual.</i>' }}>
                                </div>
                                
                                {selectedEmail.has_attachments === 1 && (
                                    <div className="mt-8 pt-4 border-t border-slate-100">
                                        <p className="text-sm font-medium text-slate-500 flex items-center gap-2 mb-3">
                                            <Paperclip className="w-4 h-4" /> Anexos da mensagem
                                        </p>
                                        <div className="flex gap-2">
                                            <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg flex items-center gap-3 w-64 hover:bg-slate-100 cursor-pointer transition">
                                                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded flex items-center justify-center shrink-0">
                                                    <Paperclip className="w-5 h-5" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-slate-700 truncate">anexos_ocultos</p>
                                                    <p className="text-xs text-slate-500">Download indisponível na V1</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    // EMPTY STATE (NO EMAIL SELECTED)
                    <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 text-slate-400">
                        <Mail className="w-16 h-16 mb-4 opacity-10" strokeWidth={1} />
                        <p className="text-lg font-medium opacity-50">Nenhuma mensagem selecionada</p>
                        <p className="text-sm opacity-40 mt-1">Clique em uma mensagem na lista para lê-la</p>
                    </div>
                )}
            </div>
        </div>
    );
}
