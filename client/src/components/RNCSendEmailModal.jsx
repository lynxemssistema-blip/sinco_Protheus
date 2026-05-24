import React, { useState, useEffect } from 'react';
import { X, Send, Mail, Plus, Trash2, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { generateSingleRNCPdf } from '../services/rncPdfGenerator';
import api from '../services/api';

const RNCSendEmailModal = ({ isOpen, onClose, rnc, emailType = 'rnc', onSuccess }) => {
    const { user } = useAuth();
    const [observacao, setObservacao] = useState('');
    const [emails, setEmails] = useState(['']);
    const [isSending, setIsSending] = useState(false);
    const [result, setResult] = useState(null); // { type: 'success' | 'error', message }
    const [attachDrawing, setAttachDrawing] = useState(true);

    const userName = user?.nome || user?.NomeCompleto || user?.username || 'Usuário';
    const today = new Date().toLocaleDateString('pt-BR');

    useEffect(() => {
        if (isOpen && userName) {
            const savedEmails = localStorage.getItem(`metalfisa_rnc_emails_${userName}`);
            if (savedEmails) {
                try {
                    const parsed = JSON.parse(savedEmails);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setEmails(parsed);
                    } else {
                        setEmails(['']);
                    }
                } catch(e) {
                    setEmails(['']);
                }
            } else {
                setEmails(['']);
            }
            setResult(null);
            setObservacao('');
            setAttachDrawing(true);
        }
    }, [isOpen, userName]);

    if (!isOpen || !rnc) return null;

    const addEmailField = () => {
        setEmails(prev => [...prev, '']);
    };

    const removeEmailField = (idx) => {
        setEmails(prev => prev.filter((_, i) => i !== idx));
    };

    const updateEmail = (idx, value) => {
        setEmails(prev => prev.map((e, i) => i === idx ? value : e));
    };

    const validEmails = emails.filter(e => e.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()));

    const handleSendEmail = async () => {
        if (validEmails.length === 0) {
            setResult({ type: 'error', message: 'Informe ao menos um e-mail válido para envio.' });
            return;
        }

        setIsSending(true);
        setResult(null);
        try {
            // 1. Generate PDF Bytes
            const pdfResult = await generateSingleRNCPdf(rnc, { returnBytes: true });
            if (!pdfResult || !pdfResult.bytes) {
                throw new Error('Falha ao gerar o PDF F 097-22');
            }

            // 2. Prepare email body
            const toList = validEmails.join(', ');
            
            // Parse f097_dados safely for email info
            let parsedF = rnc.f097_dados;
            if (typeof parsedF === 'string') {
                try {
                    parsedF = JSON.parse(parsedF);
                    if (typeof parsedF === 'string') {
                        parsedF = JSON.parse(parsedF);
                    }
                } catch(e) {
                    parsedF = {};
                }
            }
            const fData = parsedF && typeof parsedF === 'object' ? parsedF : {};
            const reg = fData.registro || {};

            const subject = emailType === 'reposicao' 
                ? `[SOLICITAÇÃO DE REPOSIÇÃO RNC] ID #${rnc.id} — Produto: ${rnc.produto || ''} — Qtd: ${reg.qtd_nao_conforme || 1}`
                : `[RNC SGQ] ID #${rnc.id} — Produto: ${rnc.produto || ''} — Status: ${rnc.status}`;

            const htmlBody = emailType === 'reposicao'
                ? `
                <h2 style="color: #b91c1c; margin-bottom: 5px;">⚠️ SOLICITAÇÃO DE FABRICAÇÃO DE NOVA PEÇA (REPOSIÇÃO)</h2>
                <p>Uma nova peça de reposição foi solicitada devido a não conformidade identificada no SGQ.</p>
                <hr style="border: none; border-top: 2px solid #b91c1c; margin: 10px 0 20px;" />
                
                <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #d97706; padding: 14px 18px; border-radius: 4px; margin-bottom: 20px;">
                    <p style="margin: 0; color: #b45309; font-weight: bold; font-size: 15px;">
                        🛠️ Detalhes da Reposição
                    </p>
                    <p style="margin: 5px 0 0; color: #78350f; font-size: 13px;">
                        <strong>Quantidade a Fabricar:</strong> ${reg.qtd_nao_conforme || 1} unidade(s)<br/>
                        <strong>Produto:</strong> ${rnc.produto || ''} - ${rnc.desc_produto || ''}<br/>
                        <strong>RNC Associada:</strong> ID #${rnc.id}
                    </p>
                </div>

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                    <tr>
                        <td style="padding: 8px 12px; background-color: #f1f5f9; font-weight: bold; width: 160px; border: 1px solid #e2e8f0;">RNC ID</td>
                        <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: bold; color: #b91c1c;">#${rnc.id}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 12px; background-color: #f1f5f9; font-weight: bold; border: 1px solid #e2e8f0;">Status RNC</td>
                        <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: bold;">${rnc.status}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 12px; background-color: #f1f5f9; font-weight: bold; border: 1px solid #e2e8f0;">Produto</td>
                        <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-family: monospace;">${rnc.produto || '-'} - ${rnc.desc_produto || ''}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 12px; background-color: #f1f5f9; font-weight: bold; border: 1px solid #e2e8f0;">OP / PV</td>
                        <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">OP: ${rnc.op}-${rnc.item_op} (Seq: ${rnc.sequen_op}) | PV: ${rnc.pedido || 'N/A'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 12px; background-color: #f1f5f9; font-weight: bold; border: 1px solid #e2e8f0;">Cliente</td>
                        <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${rnc.cliente || '-'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 12px; background-color: #f1f5f9; font-weight: bold; border: 1px solid #e2e8f0;">Problema</td>
                        <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${rnc.nc_descricao || 'Outro'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 12px; background-color: #f1f5f9; font-weight: bold; border: 1px solid #e2e8f0;">Setor Envolvido</td>
                        <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${reg.setor_envolvido || rnc.recurso_inconformidade || '-'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 12px; background-color: #f1f5f9; font-weight: bold; border: 1px solid #e2e8f0;">Data Abertura RNC</td>
                        <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${new Date(rnc.data_criacao).toLocaleString('pt-BR')}</td>
                    </tr>
                </table>

                ${observacao.trim() ? `
                <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 14px 18px; border-radius: 4px; margin-bottom: 20px;">
                    <p style="margin: 0; color: #166534; font-weight: bold; font-size: 14px;">
                        💬 Mensagem Adicional do Solicitante
                    </p>
                    <p style="margin: 5px 0 0; color: #1e3a1e; font-size: 13px; white-space: pre-wrap;">${observacao.trim()}</p>
                </div>
                ` : ''}

                <div style="background-color: #f0f9ff; border: 1px solid #bae6fd; border-left: 4px solid #0284c7; padding: 14px 18px; border-radius: 4px; margin-bottom: 20px;">
                    <p style="margin: 0; color: #075985; font-weight: bold; font-size: 14px;">
                        📎 Documento PDF e Desenhos Anexados
                    </p>
                    <p style="margin: 5px 0 0; color: #0369a1; font-size: 13px;">
                        O relatório RNC oficial F 097-22 e o desenho técnico do produto seguem anexados para providências de fabricação.
                    </p>
                </div>
                `
                : `
                <h2 style="color: #1e3a78; margin-bottom: 5px;">⚠️ Registro de Não Conformidade (RNC)</h2>
                <p>Relatório de Não Conformidade de Qualidade emitido via SGQ.</p>
                <hr style="border: none; border-top: 2px solid #dc2626; margin: 10px 0 20px;" />
                
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                    <tr>
                        <td style="padding: 8px 12px; background-color: #f1f5f9; font-weight: bold; width: 160px; border: 1px solid #e2e8f0;">RNC ID</td>
                        <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: bold; color: #dc2626;">#${rnc.id}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 12px; background-color: #f1f5f9; font-weight: bold; border: 1px solid #e2e8f0;">Status</td>
                        <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: bold;">${rnc.status}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 12px; background-color: #f1f5f9; font-weight: bold; border: 1px solid #e2e8f0;">Produto</td>
                        <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-family: monospace;">${rnc.produto || '-'} - ${rnc.desc_produto || ''}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 12px; background-color: #f1f5f9; font-weight: bold; border: 1px solid #e2e8f0;">OP / PV</td>
                        <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">OP: ${rnc.op}-${rnc.item_op} (Seq: ${rnc.sequen_op}) | PV: ${rnc.pedido || 'N/A'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 12px; background-color: #f1f5f9; font-weight: bold; border: 1px solid #e2e8f0;">Cliente</td>
                        <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${rnc.cliente || '-'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 12px; background-color: #f1f5f9; font-weight: bold; border: 1px solid #e2e8f0;">Problema</td>
                        <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${rnc.nc_descricao || 'Outro'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 12px; background-color: #f1f5f9; font-weight: bold; border: 1px solid #e2e8f0;">Local de Detecção</td>
                        <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${reg.local_deteccao || '-'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 12px; background-color: #f1f5f9; font-weight: bold; border: 1px solid #e2e8f0;">Data Abertura</td>
                        <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${new Date(rnc.data_criacao).toLocaleString('pt-BR')}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 12px; background-color: #f1f5f9; font-weight: bold; border: 1px solid #e2e8f0;">Prazo Limite (Resolução)</td>
                        <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: bold; color: #4338ca;">${rnc.data_limite ? new Date(rnc.data_limite).toLocaleDateString('pt-BR') : 'Não Definido'}</td>
                    </tr>
                </table>

                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 14px 18px; border-radius: 4px; margin-bottom: 20px;">
                    <p style="margin: 0; color: #334155; font-weight: bold; font-size: 14px;">
                        📝 Relato da Qualidade (Observação original)
                    </p>
                    <p style="margin: 5px 0 0; color: #475569; font-size: 13px; white-space: pre-wrap;">${rnc.observacao || '-'}</p>
                </div>

                ${observacao.trim() ? `
                <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 14px 18px; border-radius: 4px; margin-bottom: 20px;">
                    <p style="margin: 0; color: #166534; font-weight: bold; font-size: 14px;">
                        💬 Mensagem de Envio
                    </p>
                    <p style="margin: 5px 0 0; color: #1e3a1e; font-size: 13px; white-space: pre-wrap;">${observacao.trim()}</p>
                </div>
                ` : ''}

                <div style="background-color: #f0f9ff; border: 1px solid #bae6fd; border-left: 4px solid #0284c7; padding: 14px 18px; border-radius: 4px; margin-bottom: 20px;">
                    <p style="margin: 0; color: #075985; font-weight: bold; font-size: 14px;">
                        📎 Relatório Oficial F 097-22 Anexo
                    </p>
                    <p style="margin: 5px 0 0; color: #0369a1; font-size: 13px;">
                        O documento oficial da não conformidade segue anexado a esta mensagem em formato PDF.
                    </p>
                </div>
            `;

            const formData = new FormData();
            formData.append('to', toList);
            formData.append('subject', subject);
            formData.append('html', htmlBody);
            formData.append('text', emailType === 'reposicao'
                ? `Solicitação de reposição para RNC ID #${rnc.id} - Produto: ${rnc.produto}. Por favor consulte o anexo.`
                : `RNC ID #${rnc.id} - Produto: ${rnc.produto}. Por favor consulte o relatório F 097-22 em PDF no anexo.`);

            const pdfBlob = new Blob([pdfResult.bytes], { type: 'application/pdf' });
            formData.append('attachments', pdfBlob, pdfResult.fileName);

            if (attachDrawing && rnc.tem_arquivos && rnc.primeiro_arquivo) {
                formData.append('localAttachments', JSON.stringify([rnc.primeiro_arquivo]));
            }

            // 3. Send
            await api.post('/email/send', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            // 4. Save emails for next time
            localStorage.setItem(`metalfisa_rnc_emails_${userName}`, JSON.stringify(validEmails));

            // 5. Update DB if it is reposicao request
            if (emailType === 'reposicao') {
                const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
                await api.put(`/sgq/rncs/${rnc.id}`, {
                    reposicao_solicitada: 1,
                    reposicao_data_solicitacao: nowStr
                });
                if (onSuccess) onSuccess();
            }

            setResult({
                type: 'success',
                message: emailType === 'reposicao'
                    ? `Solicitação de fabricação de nova peça enviada com sucesso para: ${toList}`
                    : `Relatório RNC F 097-22 enviado com sucesso para: ${toList}`
            });
        } catch (err) {
            console.error('Erro ao enviar RNC por e-mail:', err);
            const msg = err.response?.data?.error || err.message || 'Erro desconhecido';
            setResult({ type: 'error', message: `Falha ao enviar e-mail: ${msg}` });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className={`bg-gradient-to-r ${emailType === 'reposicao' ? 'from-rose-700 to-red-800' : 'from-blue-700 to-indigo-800'} px-6 py-5 flex justify-between items-center`}>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-white/15 rounded-xl">
                            <Mail className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">
                                {emailType === 'reposicao' ? 'Solicitar Fabricação de Nova Peça' : 'Enviar RNC por E-mail'}
                            </h3>
                            <p className="text-blue-100 text-sm">
                                {emailType === 'reposicao' ? 'Disparar e-mail de solicitação de reposição' : 'Disparar Relatório F 097-22 como anexo PDF'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSending}
                        className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Info Card */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-semibold text-slate-700">RNC ID: #{rnc.id}</span>
                            <span className="text-xs px-2.5 py-1 font-bold rounded-full bg-blue-100 text-blue-800 uppercase">{rnc.status}</span>
                        </div>
                        <p className="text-xs text-slate-600 font-mono">Produto: {rnc.produto} - {rnc.desc_produto}</p>
                        <p className="text-xs text-slate-600">OP: {rnc.op}-{rnc.item_op} (Seq: {rnc.sequen_op}) | PV: {rnc.pedido || 'N/A'}</p>
                        <p className="text-xs text-slate-600">Não Conformidade: <strong className="text-slate-800">{rnc.nc_descricao || 'Outro'}</strong></p>
                        {emailType === 'reposicao' && (
                            <p className="text-xs text-rose-700 font-bold bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-100 w-max mt-1">
                                Quantidade Solicitada: {(() => {
                                    let parsedF = rnc.f097_dados;
                                    if (typeof parsedF === 'string') {
                                        try {
                                            parsedF = JSON.parse(parsedF);
                                            if (typeof parsedF === 'string') {
                                                parsedF = JSON.parse(parsedF);
                                            }
                                        } catch(e) {
                                            parsedF = {};
                                        }
                                    }
                                    const fData = parsedF && typeof parsedF === 'object' ? parsedF : {};
                                    return fData.registro?.qtd_nao_conforme || 1;
                                })()} unidade(s)
                            </p>
                        )}
                        
                        {rnc.tem_arquivos && rnc.primeiro_arquivo && (
                            <div className="mt-2 flex items-center gap-2 p-2.5 bg-red-50/50 border border-red-200 rounded-lg">
                                <input
                                    type="checkbox"
                                    id="attachDrawing"
                                    checked={attachDrawing}
                                    onChange={(e) => setAttachDrawing(e.target.checked)}
                                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                                />
                                <label htmlFor="attachDrawing" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                                    Anexar desenho técnico do produto: <span className="font-mono text-red-700">{rnc.primeiro_arquivo.split(/[\/\\]/).pop()}</span>
                                </label>
                            </div>
                        )}
                    </div>

                    {/* Email Recipients */}
                    <div className="bg-indigo-50/50 rounded-xl border border-indigo-100 p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Mail className="w-4 h-4 text-indigo-600" />
                                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                                    Destinatários do E-mail
                                </label>
                            </div>
                            <button
                                type="button"
                                onClick={addEmailField}
                                className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-md transition-colors"
                            >
                                <Plus className="w-3.5 h-3.5" /> Adicionar
                            </button>
                        </div>

                        <div className="space-y-2">
                            {emails.map((email, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <input
                                        type="email"
                                        placeholder="destinatario@metalfisa.com.br"
                                        value={email}
                                        onChange={e => updateEmail(idx, e.target.value)}
                                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                                    />
                                    {emails.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeEmailField(idx)}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        {validEmails.length > 0 && (
                            <p className="text-xs text-green-600 mt-2 font-medium">
                                ✓ {validEmails.length} e-mail(s) válido(s)
                            </p>
                        )}
                    </div>

                    {/* Observação / Mensagem Adicional */}
                    <div>
                        <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5 block">
                            Mensagem / Observação Adicional <span className="text-gray-400 font-normal">(opcional)</span>
                        </label>
                        <textarea
                            placeholder="Escreva uma observação ou mensagem que será inserida em destaque no corpo do e-mail..."
                            value={observacao}
                            onChange={e => setObservacao(e.target.value)}
                            rows={3}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y"
                        />
                    </div>

                    {/* Result Message */}
                    {result && (
                        <div className={`flex items-start gap-3 p-4 rounded-xl border animate-fadeIn ${result.type === 'success'
                                ? 'bg-green-50 border-green-200 text-green-800'
                                : 'bg-red-50 border-red-200 text-red-800'
                            }`}>
                            {result.type === 'success'
                                ? <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                                : <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                            }
                            <p className="text-sm font-medium">{result.message}</p>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="border-t border-gray-100 bg-gray-50 px-6 py-4 flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSending}
                        className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                    >
                        Fechar
                    </button>

                    <button
                        type="button"
                        onClick={handleSendEmail}
                        disabled={isSending || validEmails.length === 0}
                        className={`flex items-center gap-2 px-5 py-2.5 ${emailType === 'reposicao' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm`}
                    >
                        {isSending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                        {isSending ? 'Enviando...' : emailType === 'reposicao' ? 'Enviar Solicitação de Reposição' : 'Enviar Relatório F 097-22'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RNCSendEmailModal;
