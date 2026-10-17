import React, { useState, useEffect } from 'react';
import { X, Mail, Send, Plus, Trash2, Loader2, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';

const RomaneioEmailModal = ({ isOpen, onClose, romaneio, initialStatus }) => {
    const { user } = useAuth();
    const [emails, setEmails] = useState(['']);
    const [clientEmails, setClientEmails] = useState([]);
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState(null);

    useEffect(() => {
        const fetchDetails = async () => {
            if (!isOpen || !romaneio) return;
            
            setIsLoading(true);
            try {
                // Buscar detalhes completos (incluindo o e-mail do cliente vindo do Protheus)
                const { data } = await api.get(`/romaneios/${romaneio.id}`);
                
                const userEmail = user?.email || '';
                const detectedEmails = [];
                if (userEmail) detectedEmails.push(userEmail);
                
                // Tratar e-mail do cliente (pode vir múltiplos separados por ; ou ,)
                if (data.cliente_email) {
                    const rawEmails = data.cliente_email.split(/[;,]/).map(e => e.trim()).filter(e => e);
                    setClientEmails(rawEmails);
                    // Adicionar todos como padrão por solicitação do usuário
                    rawEmails.forEach(e => {
                        if (!detectedEmails.includes(e)) detectedEmails.push(e);
                    });
                }
                
                setEmails(detectedEmails.length > 0 ? detectedEmails : ['']);
                setSubject(`[METAFISA] Romaneio #${romaneio.id} - Status: ${romaneio.status?.toUpperCase() || 'ATUALIZADO'}`);
                setMessage(`Olá,\n\nO status do Romaneio #${romaneio.id} foi alterado para ${romaneio.status?.toUpperCase()}.\nSegue em anexo o PDF atualizado para conferência.\n\nAtenciosamente,\n${user?.nome || 'Equipe Lynx'}`);
                setResult(null);
            } catch (err) {
                console.error('Erro ao carregar detalhes do e-mail:', err);
                toast.error('Erro ao buscar dados do cliente.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchDetails();
    }, [isOpen, romaneio, user]);

    if (!isOpen || !romaneio) return null;

    const addEmailField = () => setEmails([...emails, '']);
    const removeEmailField = (idx) => setEmails(emails.filter((_, i) => i !== idx));
    const updateEmail = (idx, val) => setEmails(emails.map((e, i) => i === idx ? val : e));
    const toggleClientEmail = (email) => {
        if (emails.includes(email)) {
            setEmails(emails.filter(e => e !== email));
        } else {
            setEmails([...emails, email]);
        }
    };

    const validEmails = emails.filter(e => e.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()));

    const handleSend = async () => {
        if (validEmails.length === 0) {
            toast.error('Informe pelo menos um e-mail válido.');
            return;
        }

        setIsSending(true);
        setResult(null);

        try {
            const payload = {
                to: validEmails,
                subject: subject,
                htmlBody: `
                    <p style="white-space: pre-wrap;">${message}</p>
                    <div style="margin-top: 20px; padding: 15px; background-color: #f8fafc; border-left: 4px solid #0ea5e9; border-radius: 4px;">
                        <p style="margin: 0; font-weight: bold; color: #0f172a;">Detalhes do Romaneio:</p>
                        <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #475569; font-size: 14px;">
                            <li><strong>ID:</strong> #${romaneio.id}</li>
                            <li><strong>Cliente:</strong> ${romaneio.cliente_nome}</li>
                            <li><strong>Status Atual:</strong> <span style="color: #ef4444; font-weight: bold;">${romaneio.status?.toUpperCase()}</span></li>
                        </ul>
                    </div>
                `
            };

            await api.post(`/romaneios/${romaneio.id}/send-email`, payload);
            
            setResult({ type: 'success', message: 'E-mail enviado com sucesso com o PDF em anexo!' });
            toast.success('E-mail enviado!');
            
            // Auto close after 2 seconds on success
            setTimeout(() => {
                onClose();
            }, 2000);

        } catch (err) {
            console.error('Erro ao enviar e-mail:', err);
            setResult({ type: 'error', message: 'Falha ao enviar e-mail. Verifique a conexão com o servidor.' });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                
                {/* Header */}
                <div className="bg-slate-900 px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                            <Mail className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-white font-bold">Enviar Romaneio por E-mail</h3>
                            <p className="text-slate-400 text-xs">Padrão Alfatec / Lynx</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
                    
                     {/* Info Card */}
                     <div className="flex items-start gap-4 p-4 bg-blue-50 border border-blue-100 rounded-xl text-blue-800">
                        <div className="p-2 bg-blue-100 rounded-lg shrink-0">
                            <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Dados do Destinatário</p>
                            <h4 className="text-sm font-bold text-blue-900 leading-tight">{romaneio.cliente_nome}</h4>
                            <p className="text-[11px] font-medium opacity-80">{romaneio.cliente_cnpj ? `CNPJ: ${romaneio.cliente_cnpj}` : 'CNPJ não informado'}</p>
                            <div className="flex items-center gap-2 mt-2 py-1 px-2 bg-blue-600/10 rounded-md w-fit text-[10px] font-bold uppercase">
                                <AlertCircle className="w-3 h-3" />
                                <span>Caderno PDF e desenhos anexados</span>
                            </div>
                        </div>
                    </div>

                    {/* Recipients */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                <Plus className="w-3 h-3" /> Destinatários
                            </label>
                            <button 
                                onClick={addEmailField}
                                className="text-[10px] font-bold text-blue-600 hover:underline"
                            >
                                + Adicionar outro
                            </button>
                        </div>

                        {/* Client Emails Suggestions */}
                        {clientEmails.length > 0 && (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Sugestões do Cadastro (Cliente/Fornecedor):</p>
                                <div className="flex flex-wrap gap-2">
                                    {clientEmails.map((email, i) => (
                                        <button 
                                            key={i}
                                            onClick={() => toggleClientEmail(email)}
                                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all flex items-center gap-2 ${
                                                emails.includes(email) 
                                                    ? 'bg-blue-100 border-blue-200 text-blue-700 shadow-sm' 
                                                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                            }`}
                                        >
                                            <div className={`w-2 h-2 rounded-full ${emails.includes(email) ? 'bg-blue-500' : 'bg-slate-300'}`} />
                                            {email}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {isLoading ? (
                            <div className="flex items-center gap-3 py-4 text-slate-400 text-sm">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Buscando dados do cliente...</span>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {emails.map((email, idx) => (
                                    <div key={idx} className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                            <input 
                                                type="email"
                                                value={email}
                                                onChange={(e) => updateEmail(idx, e.target.value)}
                                                placeholder="email@exemplo.com"
                                                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                            />
                                        </div>
                                        <button 
                                            onClick={() => removeEmailField(idx)}
                                            className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Subject */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Assunto</label>
                        <input 
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    {/* Message Body */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Mensagem Personalizada</label>
                        <textarea 
                            rows={5}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                            placeholder="Escreva algo para acompanhar o romaneio..."
                        />
                    </div>

                    {/* Result */}
                    {result && (
                        <div className={`p-4 rounded-xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${
                            result.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
                        }`}>
                            {result.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                            <p className="text-sm font-medium">{result.message}</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                    <button 
                        onClick={onClose}
                        disabled={isSending}
                        className="px-5 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-200 rounded-xl transition-all disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSend}
                        disabled={isSending || validEmails.length === 0}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        {isSending ? 'Enviando...' : 'Gerar e Enviar E-mail'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RomaneioEmailModal;
