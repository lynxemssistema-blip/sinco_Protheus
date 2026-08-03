import React, { useState, useEffect } from 'react';
import { X, Send, Plus, Trash2, Mail } from 'lucide-react';
import api from '../services/api';
import { toast } from 'react-toastify';

export default function PortalClienteEmailModal({ isOpen, onClose, selectedItems = [], user }) {
    const [emails, setEmails] = useState(['']);
    const [subject, setSubject] = useState('');
    const [observacao, setObservacao] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Inicializa com o e-mail do usuário se ele tiver
            const defaultEmails = user?.email ? [user.email] : [''];
            
            const savedEmails = localStorage.getItem('metalfisa_portal_emails');
            if (savedEmails) {
                try {
                    const parsed = JSON.parse(savedEmails);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        if (user?.email && !parsed.includes(user.email)) {
                            parsed.unshift(user.email);
                        }
                        setEmails(parsed);
                    } else {
                        setEmails(defaultEmails);
                    }
                } catch {
                    setEmails(defaultEmails);
                }
            } else {
                setEmails(defaultEmails);
            }
            
            if (selectedItems && selectedItems.length > 0) {
                const uniquePeds = [...new Set(selectedItems.map(i => i.pedido))].join(', ');
                setSubject(`[PORTAL CLIENTE] Solicitação de Status - Pedido(s) MF: ${uniquePeds}`);
                setObservacao(`Prezada equipe MetalFisa,

Solicitamos a gentileza de nos enviar uma atualização referente ao andamento físico e previsão de faturamento do(s) item(ns) listado(s) abaixo.

Atenciosamente,
${user?.nome || 'Portal do Cliente'}`);
            } else {
                setSubject('[PORTAL CLIENTE] Solicitação de Status');
                setObservacao('');
            }
        }
    }, [isOpen, selectedItems, user]);

    if (!isOpen) return null;

    const addEmailField = () => setEmails(prev => [...prev, '']);
    
    const removeEmailField = (index) => {
        setEmails(prev => prev.filter((_, i) => i !== index));
    };

    const handleEmailChange = (index, value) => {
        const newEmails = [...emails];
        newEmails[index] = value;
        setEmails(newEmails);
    };

    const handleSend = async () => {
        const validEmails = emails.filter(e => e.trim().length > 3 && e.includes('@'));
        if (validEmails.length === 0) {
            return toast.error('Adicione pelo menos um e-mail válido.');
        }

        setIsProcessing(true);
        try {
            const toList = validEmails.join(',');
            
            let itemsRows = '';
            selectedItems.forEach((item, idx) => {
                const oc = item.ordem_compra || item.ped_cliente || item.pc || '-';
                const qSal = Number(item.saldo_item !== undefined ? item.saldo_item : (item.saldo_faturar || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
                const unit = item.unidade || 'pç';
                const bg = idx % 2 === 0 ? '#f8fafc' : '#ffffff';

                itemsRows += `
                    <tr style="background-color: ${bg}; font-size: 12px;">
                        <td style="padding: 8px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold;">${item.pedido}</td>
                        <td style="padding: 8px; border: 1px solid #cbd5e1; font-family: monospace;">${oc}</td>
                        <td style="padding: 8px; border: 1px solid #cbd5e1; font-family: monospace; color: #1e3a8a; font-weight: bold;">${item.produto}</td>
                        <td style="padding: 8px; border: 1px solid #cbd5e1;">${item.descricao || item.desc_produto || '-'}</td>
                        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold; color: #b45309;">${qSal} ${unit}</td>
                        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">${item.data_pcp || '-'}</td>
                        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold;">${item.status || '-'}</td>
                    </tr>
                `;
            });

            const tableHtml = `
                <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-family: Arial, sans-serif; border: 1px solid #cbd5e1;">
                    <thead>
                        <tr style="background-color: #1e3a5f; color: #ffffff; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;">
                            <th style="padding: 10px 8px; border: 1px solid #cbd5e1; text-align: left;">Pedido MF</th>
                            <th style="padding: 10px 8px; border: 1px solid #cbd5e1; text-align: left;">Ordem Compra</th>
                            <th style="padding: 10px 8px; border: 1px solid #cbd5e1; text-align: left;">Produto</th>
                            <th style="padding: 10px 8px; border: 1px solid #cbd5e1; text-align: left;">Descrição</th>
                            <th style="padding: 10px 8px; border: 1px solid #cbd5e1; text-align: right;">Saldo</th>
                            <th style="padding: 10px 8px; border: 1px solid #cbd5e1; text-align: center;">Previsão PCP</th>
                            <th style="padding: 10px 8px; border: 1px solid #cbd5e1; text-align: center;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsRows}
                    </tbody>
                </table>
            `;

            let htmlBody = `
                <div style="font-family: Arial, sans-serif; max-width: 750px; margin: 0 auto; color: #333;">
                    <h2 style="color: #1e3a8a; border-bottom: 2px solid #cbd5e1; padding-bottom: 10px; font-size: 18px; margin-bottom: 15px;">
                        ${subject}
                    </h2>
                    <p>Olá,</p>
                    <p>O cliente <strong>${user?.nome || 'Portal do Cliente'}</strong> enviou uma nova solicitação de acompanhamento para os seguintes itens:</p>
                    ${tableHtml}
            `;

            if (observacao.trim()) {
                const plainObs = observacao.trim();
                htmlBody += `
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 14px 18px; border-radius: 6px; margin: 20px 0;">
                        <p style="margin: 0; color: #334155; font-weight: bold; font-size: 13px;">
                            📝 Mensagem do Solicitante:
                        </p>
                        <p style="margin: 5px 0 0; color: #475569; font-size: 13px; white-space: pre-wrap;">${plainObs}</p>
                    </div>
                `;
            }

            htmlBody += `
                    <p style="color: #64748b; font-size: 11px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 10px;">
                        E-mail gerado automaticamente pelo Portal do Cliente - MetalFisa Anty.
                    </p>
                </div>
            `;

            const formData = new FormData();
            formData.append('to', toList);
            formData.append('subject', subject);
            formData.append('html', htmlBody);
            formData.append('text', `Nova solicitação do cliente ${user?.nome}. ${observacao.trim()}`);

            await api.post('/email/send', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 30000,
                validateStatus: (s) => s === 200 || s === 202,
            });

            // Salva os e-mails para a próxima vez
            const emailsToSave = validEmails.filter(e => e !== user?.email);
            localStorage.setItem('metalfisa_portal_emails', JSON.stringify(emailsToSave));

            toast.success('E-mail enviado com sucesso!');
            onClose();
        } catch (err) {
            console.error('Erro ao enviar e-mail:', err);
            toast.error('Erro ao enviar o e-mail. Tente novamente mais tarde.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[90vh]">
                <div className="bg-blue-600 px-6 py-4 flex items-center justify-between animate-fade-in-down">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-lg">
                            <Mail className="w-5 h-5 text-white" />
                        </div>
                        <h2 className="text-white font-bold text-lg">
                            Enviar E-mail {selectedItems.length > 1 ? `(${selectedItems.length} itens)` : ''}
                        </h2>
                    </div>
                    <button onClick={onClose} disabled={isProcessing} className="text-white/70 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-5">
                    
                    {selectedItems.length > 0 && (
                        <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs max-h-[120px] overflow-y-auto space-y-1">
                            <span className="text-slate-500 font-semibold block uppercase mb-1">Itens Incluídos no E-mail:</span>
                            {selectedItems.map((item, idx) => (
                                <div key={idx} className="font-mono text-slate-700">
                                    - Pedido <strong>{item.pedido}</strong>: {item.produto} (Saldo: {Number(item.saldo_item !== undefined ? item.saldo_item : (item.saldo_faturar || 0))} {item.unidade || 'pç'})
                                </div>
                            ))}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Destinatários</label>
                        <div className="space-y-2">
                            {emails.map((email, idx) => (
                                <div key={idx} className="flex gap-2">
                                    <input
                                        type="email"
                                        placeholder="exemplo@metalfisa.com.br"
                                        value={email}
                                        onChange={(e) => handleEmailChange(idx, e.target.value)}
                                        className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    {emails.length > 1 && (
                                        <button
                                            onClick={() => removeEmailField(idx)}
                                            className="px-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={addEmailField}
                            className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                        >
                            <Plus className="w-3 h-3" /> Adicionar e-mail
                        </button>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Assunto</label>
                        <input
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Conteúdo do E-mail</label>
                        <textarea
                            rows={5}
                            value={observacao}
                            onChange={(e) => setObservacao(e.target.value)}
                            placeholder="Descreva aqui sua solicitação completa, necessidades de prazo, etc..."
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isProcessing}
                        className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={isProcessing}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {isProcessing ? 'Enviando...' : (
                            <>
                                <Send className="w-4 h-4" /> Enviar E-mail
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
