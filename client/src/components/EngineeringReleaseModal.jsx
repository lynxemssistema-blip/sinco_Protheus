import React, { useState } from 'react';
import { X, Send, Stamp, Download, Plus, Trash2, Mail, FileText, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { generateEstruturaReport } from '../services/estruturaReportPdf';
import api from '../services/api';

const EngineeringReleaseModal = ({ isOpen, onClose, structure, routesMap, codigo }) => {
    const { user } = useAuth();
    const [pedido, setPedido] = useState('');
    const [item, setItem] = useState('');
    const [emails, setEmails] = useState(['']);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [result, setResult] = useState(null); // { type: 'success' | 'error', message }
    const [mode, setMode] = useState('full'); // 'full' or 'n1'

    if (!isOpen) return null;

    const userName = user?.nome || user?.NomeCompleto || user?.username || 'Usuário';
    const today = new Date().toLocaleDateString('pt-BR');

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

    const generatePdfWithStamp = async (codigoLiberacao) => {
        const isN1 = mode === 'n1';
        const filteredStructure = isN1
            ? structure.filter(i => i.nivel === 0 || i.nivel === 1)
            : structure;

        const options = {
            carimbo: {
                ativo: true,
                data: today,
                usuario: userName,
                pedido: pedido.trim() || null,
                item: item.trim() || null,
                codigo_liberacao: codigoLiberacao
            },
            returnBytes: true,
        };

        if (isN1) {
            options.title = 'ESTRUTURA COMPACTA (NÍVEL 1) — MATR225Cus';
            options.footerTitle = 'Estrutura Compacta (Nível 1)';
            options.isNivel1 = true;
        }

        return await generateEstruturaReport(filteredStructure, routesMap, options);
    };

    const saveToNetworkDrive = async (pdfResult, nextCode) => {
        try {
            const formData = new FormData();
            formData.append('codigo_produto', codigo);
            formData.append('codigo_liberacao', nextCode);
            const pdfBlob = new Blob([pdfResult.bytes], { type: 'application/pdf' });
            formData.append('pdf', pdfBlob, pdfResult.fileName);

            const { data } = await api.post('/engineering-releases/save-network', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            return data;
        } catch (err) {
            console.error('Falha ao salvar no diretório de rede:', err);
            return null;
        }
    };

    const logReleaseAction = async (tipoAcao, extraData = {}) => {
        try {
            const rootDesc = structure[0]?.descricao || codigo;
            await api.post('/engineering-releases/log', {
                codigo_produto: codigo,
                descricao_produto: rootDesc,
                pedido: pedido.trim() || null,
                item: item.trim() || null,
                usuario: userName,
                tipo_acao: tipoAcao,
                destinatarios: extraData.destinatarios || null,
                modo: mode.toUpperCase(),
                caminho_arquivo: extraData.caminho_arquivo || null,
                codigo_liberacao: extraData.codigo_liberacao || null
            });
        } catch (err) {
            console.error('Erro ao logar liberação:', err);
        }
    };

    const handleDownloadOnly = async () => {
        setIsGenerating(true);
        setResult(null);
        try {
            // 1. Get code
            const { data: { nextCode } } = await api.get('/engineering-releases/next-code');
            
            // 2. Generate PDF
            const pdfResult = await generatePdfWithStamp(nextCode);
            
            if (pdfResult && pdfResult.bytes) {
                // 3. Save to network
                const networkResult = await saveToNetworkDrive(pdfResult, nextCode);
                
                // 4. Log
                await logReleaseAction('DOWNLOAD', { 
                    caminho_arquivo: networkResult?.path, 
                    codigo_liberacao: nextCode 
                });

                // 5. Download for user
                const blob = new Blob([pdfResult.bytes], { type: 'application/pdf' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = pdfResult.fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                setResult({ type: 'success', message: `PDF gerado e liberado com código ${nextCode}!` });
            }
        } catch (err) {
            console.error('Erro ao gerar PDF:', err);
            setResult({ type: 'error', message: 'Falha ao realizar a liberação. Verifique o console.' });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSendEmail = async () => {
        if (validEmails.length === 0) {
            setResult({ type: 'error', message: 'Informe ao menos um e-mail válido para envio.' });
            return;
        }

        setIsSending(true);
        setResult(null);
        try {
            // 1. Get code
            const { data: { nextCode } } = await api.get('/engineering-releases/next-code');

            // 2. Generate PDF
            const pdfResult = await generatePdfWithStamp(nextCode);
            if (!pdfResult || !pdfResult.bytes) {
                throw new Error('Falha ao gerar o PDF');
            }

            // 3. Save to network
            const networkResult = await saveToNetworkDrive(pdfResult, nextCode);

            // 4. Prepare email
            const toList = validEmails.join(', ');
            const rootDesc = structure[0]?.descricao || codigo;
            const pedidoInfo = pedido.trim()
                ? `Pedido: ${pedido.trim()}${item.trim() ? ' / Item: ' + item.trim() : ''}`
                : '';

            const subject = `[LIBERAÇÃO ENGENHARIA] ${codigo.trim()} — ${rootDesc}${pedidoInfo ? ' — ' + pedidoInfo : ''}`;

            const htmlBody = `
                <h2 style="color: #1e3a78; margin-bottom: 5px;">🔧 Liberação de Engenharia para Fabricação</h2>
                <p>Código de Liberação: <strong style="color: #dc2626; font-size: 1.2em;">${nextCode}</strong></p>
                <hr style="border: none; border-top: 2px solid #dc2626; margin: 10px 0 20px;" />
                
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                    <tr>
                        <td style="padding: 8px 12px; background-color: #f1f5f9; font-weight: bold; width: 160px; border: 1px solid #e2e8f0;">Produto</td>
                        <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-family: monospace;">${codigo.trim()}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 12px; background-color: #f1f5f9; font-weight: bold; border: 1px solid #e2e8f0;">Descrição</td>
                        <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${rootDesc}</td>
                    </tr>
                    ${pedido.trim() ? `
                    <tr>
                        <td style="padding: 8px 12px; background-color: #f1f5f9; font-weight: bold; border: 1px solid #e2e8f0;">Pedido de Venda</td>
                        <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-family: monospace;">${pedido.trim()}${item.trim() ? ' / Item: ' + item.trim() : ''}</td>
                    </tr>
                    ` : ''}
                    <tr>
                        <td style="padding: 8px 12px; background-color: #f1f5f9; font-weight: bold; border: 1px solid #e2e8f0;">Data da Liberação</td>
                        <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${today}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 12px; background-color: #f1f5f9; font-weight: bold; border: 1px solid #e2e8f0;">Responsável</td>
                        <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${userName}</td>
                    </tr>
                </table>

                <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #dc2626; padding: 14px 18px; border-radius: 4px; margin-bottom: 20px;">
                    <p style="margin: 0; color: #991b1b; font-weight: bold; font-size: 14px;">
                        ✅ LIBERADO PARA FABRICAÇÃO
                    </p>
                    <p style="margin: 5px 0 0; color: #7f1d1d; font-size: 13px;">
                        O conjunto estrutural do produto acima foi liberado pela Engenharia para início do processo de fabricação.
                        O PDF com a estrutura completa e carimbo de liberação segue em anexo.
                    </p>
                </div>
            `;

            const formData = new FormData();
            formData.append('to', toList);
            formData.append('subject', subject);
            formData.append('html', htmlBody);
            formData.append('text', `Liberação de Engenharia para Fabricação - Produto: ${codigo.trim()} - ${rootDesc}. Código: ${nextCode}`);

            const pdfBlob = new Blob([pdfResult.bytes], { type: 'application/pdf' });
            formData.append('attachments', pdfBlob, pdfResult.fileName);

            // 5. Send via existing email route
            await api.post('/email/send', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            // 6. Log the action
            await logReleaseAction('EMAIL', { 
                destinatarios: toList, 
                caminho_arquivo: networkResult?.path,
                codigo_liberacao: nextCode 
            });

            setResult({
                type: 'success',
                message: `E-mail de liberação enviado com sucesso para: ${toList}`
            });
        } catch (err) {
            console.error('Erro ao enviar e-mail de liberação:', err);
            const msg = err.response?.data?.error || err.message || 'Erro desconhecido';
            setResult({ type: 'error', message: `Falha ao enviar e-mail: ${msg}` });
        } finally {
            setIsSending(false);
        }
    };

    const isProcessing = isGenerating || isSending;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-5 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-white/15 rounded-xl">
                            <Stamp className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Liberação de Engenharia</h3>
                            <p className="text-red-100 text-sm">Carimbo de liberação para fabricação</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isProcessing}
                        className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Preview Stamp */}
                    <div className="border-2 border-red-200 rounded-xl p-5 bg-red-50/50">
                        <div className="flex items-center gap-2 mb-3">
                            <Stamp className="w-4 h-4 text-red-600" />
                            <span className="text-xs font-bold text-red-700 uppercase tracking-wider">Pré-visualização do Carimbo</span>
                        </div>
                        <div className="bg-white border-2 border-red-500 rounded-lg p-4 max-w-xs mx-auto shadow-sm">
                            <div className="border border-red-400 rounded p-3">
                                <p className="text-red-600 font-bold text-center text-sm tracking-wide">LIBERADO PARA FABRICAÇÃO</p>
                                <hr className="border-red-300 my-2" />
                                <p className="text-red-600 text-xs">Data: {today}</p>
                                <p className="text-red-600 text-xs">Responsável: {userName.toUpperCase()}</p>
                                {pedido.trim() && (
                                    <p className="text-red-600 text-xs">
                                        Pedido: {pedido.trim()}{item.trim() ? ` / Item: ${item.trim()}` : ''}
                                    </p>
                                )}
                                <p className="text-red-600 text-[10px] italic mt-1">Cód. Lib: LEN-2026-XXXXX</p>
                            </div>
                        </div>
                    </div>

                    {/* Mode selector */}
                    <div>
                        <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2 block">Modo do Relatório</label>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setMode('full')}
                                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold border-2 transition-all ${mode === 'full'
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                                    }`}
                            >
                                Estrutura Completa
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('n1')}
                                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold border-2 transition-all ${mode === 'n1'
                                    ? 'border-amber-500 bg-amber-50 text-amber-700'
                                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                                    }`}
                            >
                                Nível 1 (Compacta)
                            </button>
                        </div>
                    </div>

                    {/* Pedido / Item */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5 block">
                                Nº Pedido <span className="text-gray-400 font-normal">(opcional)</span>
                            </label>
                            <input
                                type="text"
                                placeholder="Ex: 123456"
                                value={pedido}
                                onChange={e => setPedido(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5 block">
                                Item <span className="text-gray-400 font-normal">(opcional)</span>
                            </label>
                            <input
                                type="text"
                                placeholder="Ex: 01"
                                value={item}
                                onChange={e => setItem(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                            />
                        </div>
                    </div>

                    {/* Email Recipients */}
                    <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Mail className="w-4 h-4 text-blue-600" />
                                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                                    Destinatários do E-mail
                                </label>
                            </div>
                            <button
                                type="button"
                                onClick={addEmailField}
                                className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-md transition-colors"
                            >
                                <Plus className="w-3.5 h-3.5" /> Adicionar
                            </button>
                        </div>

                        <div className="space-y-2">
                            {emails.map((email, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <input
                                        type="email"
                                        placeholder="endereco@email.com"
                                        value={email}
                                        onChange={e => updateEmail(idx, e.target.value)}
                                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
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
                        disabled={isProcessing}
                        className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                    >
                        Fechar
                    </button>

                    <div className="flex items-center gap-3">
                        {/* Download Only */}
                        <button
                            type="button"
                            onClick={handleDownloadOnly}
                            disabled={isProcessing}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                            {isGenerating ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Download className="w-4 h-4" />
                            )}
                            {isGenerating ? 'Gerando...' : 'Apenas Baixar PDF'}
                        </button>

                        {/* Send Email */}
                        <button
                            type="button"
                            onClick={handleSendEmail}
                            disabled={isProcessing || validEmails.length === 0}
                            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                            {isSending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                            {isSending ? 'Enviando...' : 'Gerar PDF e Enviar E-mail'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EngineeringReleaseModal;
