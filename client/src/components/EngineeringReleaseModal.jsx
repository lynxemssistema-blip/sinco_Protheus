import React, { useState, useEffect } from 'react';
import { X, Send, Stamp, Download, Plus, Trash2, Mail, FileText, AlertCircle, CheckCircle, Loader2, Search, Layers, PackageCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { generateEstruturaReport } from '../services/estruturaReportPdf';
import api, { setProductStatusBatch } from '../services/api';

/**
 * EngineeringReleaseModal
 *
 * Modos de operação:
 *   - Individual: batchItems ausente ou vazio → comportamento original
 *   - Lote:       batchItems.length > 0 → libera N pedidos com um único código LEN,
 *                 gera 1 PDF, envia 1 e-mail por par (pedido/item)
 */
const EngineeringReleaseModal = ({
    isOpen,
    onClose,
    structure,
    routesMap,
    codigo,
    initialPedido = '',
    initialItem = '',
    batchItems = [],      // [{ pedido, item, nome_cliente }] para modo lote
    productStatuses = {},
    onReleaseSuccess
}) => {
    const { user } = useAuth();
    const isBatchMode = batchItems && batchItems.length > 1;

    // ── Estado individual (usado quando não é lote) ───────────────────────────
    const [pedido, setPedido] = useState('');
    const [item, setItem] = useState('');

    // ── Estado do lote ────────────────────────────────────────────────────────
    // Cópia local do array para permitir remoção de itens antes de liberar
    const [loteItens, setLoteItens] = useState([]);

    // ── Estado compartilhado ──────────────────────────────────────────────────
    const [observacao, setObservacao] = useState('');
    const [emails, setEmails] = useState(['']);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [result, setResult] = useState(null);
    const [mode, setMode] = useState('full'); // 'full' | 'n1'

    // ── Progresso de envio em lote ────────────────────────────────────────────
    const [batchProgress, setBatchProgress] = useState(null); // { current, total, label }

    // ── Modal de pesquisa de pedido (modo individual) ─────────────────────────
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchType, setSearchType] = useState('pedido');
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState('');

    const userName = user?.nome || user?.NomeCompleto || user?.username || 'Usuário';
    const today = new Date().toLocaleDateString('pt-BR');

    // ── Inicialização ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (isOpen) {
            setResult(null);
            setBatchProgress(null);
            setObservacao('');
            if (isBatchMode) {
                setLoteItens([...batchItems]);
            } else {
                setPedido(initialPedido !== undefined && initialPedido !== null ? String(initialPedido) : '');
                setItem(initialItem !== undefined && initialItem !== null ? String(initialItem) : '');
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && userName) {
            const saved = localStorage.getItem(`metalfisa_eng_emails_${userName}`);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setEmails(parsed);
                        return;
                    }
                } catch { /* ignore */ }
            }
            setEmails(['']);
        }
    }, [isOpen, userName]);

    // ── Helpers de e-mail ─────────────────────────────────────────────────────
    const addEmailField    = () => setEmails(prev => [...prev, '']);
    const removeEmailField = (idx) => setEmails(prev => prev.filter((_, i) => i !== idx));
    const updateEmail      = (idx, value) => setEmails(prev => prev.map((e, i) => i === idx ? value : e));
    const validEmails      = emails.filter(e => e.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()));

    // ── Helpers do lote ───────────────────────────────────────────────────────
    const removeLoteItem = (idx) => setLoteItens(prev => prev.filter((_, i) => i !== idx));

    // ── Busca de pedidos (modal individual) ───────────────────────────────────
    const handleSearchOrders = async (e) => {
        if (e) e.preventDefault();
        if (!searchQuery.trim()) return;
        setSearchLoading(true);
        setSearchError('');
        try {
            const params = { limit: 30, only_active: 'false' };
            if (searchType === 'pedido')   params.pedido   = searchQuery.trim();
            if (searchType === 'produto')  params.produto  = searchQuery.trim();
            if (searchType === 'cliente')  params.cliente  = searchQuery.trim();
            const response = await api.get('/pedidos/flat', { params });
            setSearchResults(Array.isArray(response.data?.data) ? response.data.data : (Array.isArray(response.data) ? response.data : []));
        } catch (err) {
            console.error('Erro ao buscar pedidos:', err);
            setSearchError('Falha ao buscar pedidos. Tente novamente.');
        } finally {
            setSearchLoading(false);
        }
    };

    if (!isOpen) return null;

    // ── Geração de PDF com carimbo ────────────────────────────────────────────
    const generatePdfWithStamp = async (codigoLiberacao, pedidoStamp = null, itemStamp = null) => {
        const isN1 = mode === 'n1';
        const filteredStructure = isN1 ? structure.filter(i => i.nivel === 0 || i.nivel === 1) : structure;

        // No modo lote o carimbo lista TODOS os pedidos/itens do lote
        const pedidoLabel = isBatchMode
            ? loteItens.map(i => `${i.pedido}/${i.item}`).join(' | ')
            : (pedidoStamp || pedido.trim() || null);

        const options = {
            carimbo: {
                ativo: true,
                data: today,
                usuario: userName,
                pedido: pedidoLabel,
                item: isBatchMode ? null : (itemStamp || item.trim() || null),
                codigo_liberacao: codigoLiberacao,
                observacao: observacao.trim() || null,
                is_batch: isBatchMode,
            },
            returnBytes: true,
        };

        if (isN1) {
            options.title = 'ESTRUTURA COMPACTA (NÍVEL 1)';
            options.footerTitle = 'Estrutura Compacta (Nível 1)';
            options.isNivel1 = true;
        }

        return await generateEstruturaReport(filteredStructure, routesMap, options);
    };

    // ── Salvar PDF na rede ────────────────────────────────────────────────────
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

    // ── Montar corpo HTML do e-mail ───────────────────────────────────────────
    const buildEmailHtml = (nextCode, pedidoVal, itemVal, rootDesc, clienteNome) => {
        const pedidoInfo = pedidoVal ? `Pedido: ${pedidoVal}${itemVal ? ' / Item: ' + itemVal : ''}` : '';
        
        let bomRows = '';
        if (structure && structure.length > 0) {
            bomRows = structure.map(item => {
                const status = productStatuses[item.codigo] || 'NORMAL';
                const statusColor = status === 'NOVO' ? '#166534' : status === 'REVISAO' ? '#854d0e' : '#475569';
                const statusBg = status === 'NOVO' ? '#dcfce7' : status === 'REVISAO' ? '#fef08a' : '#f1f5f9';
                const paddingLeft = item.nivel * 20 + 8; // Indent level
                
                return `
                    <tr>
                        <td style="padding: 6px 12px; border: 1px solid #e2e8f0; text-align: center;">${item.nivel}</td>
                        <td style="padding: 6px 12px; border: 1px solid #e2e8f0; font-family: monospace;">${item.codigo}</td>
                        <td style="padding: 6px 12px; border: 1px solid #e2e8f0; padding-left: ${paddingLeft}px;">
                            ${item.nivel > 0 ? '↳ ' : ''}${item.descricao || ''}
                        </td>
                        <td style="padding: 6px 12px; border: 1px solid #e2e8f0; text-align: center;">
                            <span style="background-color: ${statusBg}; color: ${statusColor}; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold;">
                                ${status}
                            </span>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        return `
            <h2 style="color: #1e3a78; margin-bottom: 5px;">🚀 Liberação de Engenharia para Fabricação</h2>
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
                ${clienteNome ? `
                <tr>
                    <td style="padding: 8px 12px; background-color: #f1f5f9; font-weight: bold; border: 1px solid #e2e8f0;">Cliente</td>
                    <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${clienteNome}</td>
                </tr>` : ''}
                ${pedidoVal ? `
                <tr>
                    <td style="padding: 8px 12px; background-color: #f1f5f9; font-weight: bold; border: 1px solid #e2e8f0;">Pedido de Venda</td>
                    <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-family: monospace;">${pedidoInfo}</td>
                </tr>` : ''}
                <tr>
                    <td style="padding: 8px 12px; background-color: #f1f5f9; font-weight: bold; border: 1px solid #e2e8f0;">Data da Liberação</td>
                    <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${today}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 12px; background-color: #f1f5f9; font-weight: bold; border: 1px solid #e2e8f0;">Responsável</td>
                    <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${userName}</td>
                </tr>
            </table>

            <h3 style="color: #334155; margin-bottom: 10px; font-size: 16px;">Estrutura do Produto (BOM)</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px;">
                <thead>
                    <tr>
                        <th style="padding: 8px; background-color: #f1f5f9; border: 1px solid #e2e8f0; width: 60px;">Nível</th>
                        <th style="padding: 8px; background-color: #f1f5f9; border: 1px solid #e2e8f0; width: 120px;">Código</th>
                        <th style="padding: 8px; background-color: #f1f5f9; border: 1px solid #e2e8f0; text-align: left;">Descrição</th>
                        <th style="padding: 8px; background-color: #f1f5f9; border: 1px solid #e2e8f0; width: 100px;">Status Eng.</th>
                    </tr>
                </thead>
                <tbody>
                    ${bomRows}
                </tbody>
            </table>

            ${observacao.trim() ? `
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 14px 18px; border-radius: 4px; margin-bottom: 20px;">
                <p style="margin: 0; color: #334155; font-weight: bold; font-size: 14px;">📝 Observações Adicionais</p>
                <p style="margin: 5px 0 0; color: #475569; font-size: 13px; white-space: pre-wrap;">${observacao.trim()}</p>
            </div>` : ''}
            <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #dc2626; padding: 14px 18px; border-radius: 4px; margin-bottom: 20px;">
                <p style="margin: 0; color: #991b1b; font-weight: bold; font-size: 14px;">✅ LIBERADO PARA FABRICAÇÃO</p>
                <p style="margin: 5px 0 0; color: #7f1d1d; font-size: 13px;">
                    O conjunto estrutural do produto acima foi liberado pela Engenharia para início do processo de fabricação.
                    O PDF com a estrutura completa e carimbo de liberação segue em anexo.
                </p>
            </div>
        `;
    };

    // ── Envio de um e-mail (reutilizado no modo lote e individual) ────────────
    const sendOneEmail = async (pdfResult, nextCode, pedidoVal, itemVal, clienteNome) => {
        const rootDesc = structure[0]?.descricao || codigo;
        const toList = validEmails.join(', ');
        const pedidoInfo = pedidoVal ? ` — Pedido: ${pedidoVal}${itemVal ? '/Item: ' + itemVal : ''}` : '';
        const subject = `[LIBERAÇÃO ENGENHARIA] ${codigo.trim()} — ${rootDesc}${pedidoInfo}`;
        const htmlBody = buildEmailHtml(nextCode, pedidoVal, itemVal, rootDesc, clienteNome);

        const formData = new FormData();
        formData.append('to', toList);
        formData.append('subject', subject);
        formData.append('html', htmlBody);
        formData.append('text', `Liberação de Engenharia — ${codigo.trim()} — ${rootDesc}. Código: ${nextCode}`);
        const pdfBlob = new Blob([pdfResult.bytes], { type: 'application/pdf' });
        formData.append('attachments', pdfBlob, pdfResult.fileName);

        await api.post('/email/send', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 90000,
            validateStatus: (s) => s === 200 || s === 202,
        });
    };

    // ════════════════════════════════════════════════════════════════════════
    // AÇÃO: Download individual (comportamento original)
    // ════════════════════════════════════════════════════════════════════════
    const handleDownloadOnly = async () => {
        setIsGenerating(true);
        setResult(null);
        try {
            const { data: { nextCode } } = await api.get('/engineering-releases/next-code');
            const pdfResult = await generatePdfWithStamp(nextCode);

            if (pdfResult?.bytes) {
                const networkResult = await saveToNetworkDrive(pdfResult, nextCode);

                await api.post('/engineering-releases/log', {
                    codigo_produto:    codigo,
                    descricao_produto: structure[0]?.descricao || codigo,
                    pedido:            pedido.trim() || null,
                    item:              item.trim() || null,
                    usuario:           userName,
                    tipo_acao:         'DOWNLOAD',
                    destinatarios:     null,
                    modo:              mode.toUpperCase(),
                    caminho_arquivo:   networkResult?.path || null,
                    codigo_liberacao:  nextCode,
                });

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

    // ════════════════════════════════════════════════════════════════════════
    // AÇÃO: Envio de e-mail INDIVIDUAL (comportamento original)
    // ════════════════════════════════════════════════════════════════════════
    const handleSendEmail = async () => {
        if (validEmails.length === 0) {
            setResult({ type: 'error', message: 'Informe ao menos um e-mail válido para envio.' });
            return;
        }
        setIsSending(true);
        setResult(null);
        try {
            const { data: { nextCode } } = await api.get('/engineering-releases/next-code');
            const pdfResult = await generatePdfWithStamp(nextCode);
            if (!pdfResult?.bytes) throw new Error('Falha ao gerar o PDF');

            const networkResult = await saveToNetworkDrive(pdfResult, nextCode);
            await sendOneEmail(pdfResult, nextCode, pedido.trim() || null, item.trim() || null, null);

            await api.post('/engineering-releases/log', {
                codigo_produto:    codigo,
                descricao_produto: structure[0]?.descricao || codigo,
                pedido:            pedido.trim() || null,
                item:              item.trim() || null,
                usuario:           userName,
                tipo_acao:         'EMAIL',
                destinatarios:     validEmails.join(', '),
                modo:              mode.toUpperCase(),
                caminho_arquivo:   networkResult?.path || null,
                codigo_liberacao:  nextCode,
            });

            localStorage.setItem(`metalfisa_eng_emails_${userName}`, JSON.stringify(validEmails));
            setResult({ type: 'success', message: `✅ Liberação ${nextCode}! E-mail enviado para: ${validEmails.join(', ')}` });

            // Reset status after successful release
            try {
                const codigos = structure.map(s => s.codigo);
                await setProductStatusBatch(codigos, 'NORMAL', userName, 'LIBERACAO_ENGENHARIA');
                if (onReleaseSuccess) onReleaseSuccess();
            } catch (resetErr) {
                console.error("Falha ao resetar status:", resetErr);
            }

        } catch (err) {
            console.error('Erro ao enviar e-mail de liberação:', err);
            setResult({ type: 'error', message: `Falha ao enviar e-mail: ${err.response?.data?.error || err.message}` });
        } finally {
            setIsSending(false);
        }
    };

    // ════════════════════════════════════════════════════════════════════════
    // AÇÃO: Liberação em LOTE — apenas download (PDF, sem e-mail)
    // ════════════════════════════════════════════════════════════════════════
    const handleBatchDownloadOnly = async () => {
        if (loteItens.length === 0) {
            setResult({ type: 'error', message: 'Nenhum item no lote para liberar.' });
            return;
        }
        setIsGenerating(true);
        setResult(null);
        setBatchProgress({ current: 0, total: loteItens.length, label: 'Gerando PDF...' });
        try {
            const { data: { nextCode } } = await api.get('/engineering-releases/next-code');
            const pdfResult = await generatePdfWithStamp(nextCode);
            if (!pdfResult?.bytes) throw new Error('Falha ao gerar o PDF');

            setBatchProgress({ current: 0, total: loteItens.length, label: 'Salvando na rede...' });
            const networkResult = await saveToNetworkDrive(pdfResult, nextCode);

            // Log em lote — 1 registro por item
            await api.post('/engineering-releases/log-batch', {
                codigo_produto:    codigo,
                descricao_produto: structure[0]?.descricao || codigo,
                usuario:           userName,
                tipo_acao:         'DOWNLOAD',
                modo:              mode.toUpperCase(),
                caminho_arquivo:   networkResult?.path || null,
                codigo_liberacao:  nextCode,
                destinatarios:     null,
                itens:             loteItens.map(i => ({ pedido: i.pedido, item: i.item })),
            });

            // Download para o usuário
            const blob = new Blob([pdfResult.bytes], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = pdfResult.fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            setResult({ type: 'success', message: `✅ Lote ${nextCode} registrado! ${loteItens.length} pedido(s) liberados.` });
        } catch (err) {
            console.error('Erro na liberação em lote (download):', err);
            setResult({ type: 'error', message: `Falha: ${err.response?.data?.error || err.message}` });
        } finally {
            setIsGenerating(false);
            setBatchProgress(null);
        }
    };

    // ════════════════════════════════════════════════════════════════════════
    // AÇÃO: Liberação em LOTE com e-mail — 1 e-mail por (pedido/item)
    // ════════════════════════════════════════════════════════════════════════
    const handleBatchSendEmail = async () => {
        if (validEmails.length === 0) {
            setResult({ type: 'error', message: 'Informe ao menos um e-mail válido para envio.' });
            return;
        }
        if (loteItens.length === 0) {
            setResult({ type: 'error', message: 'Nenhum item no lote para liberar.' });
            return;
        }
        setIsSending(true);
        setResult(null);
        setBatchProgress({ current: 0, total: loteItens.length, label: 'Iniciando...' });

        try {
            // 1. Código LEN único para o lote inteiro
            const { data: { nextCode } } = await api.get('/engineering-releases/next-code');

            // 2. 1 PDF para todo o lote (carimbo lista todos os pedidos)
            setBatchProgress({ current: 0, total: loteItens.length, label: 'Gerando PDF...' });
            const pdfResult = await generatePdfWithStamp(nextCode);
            if (!pdfResult?.bytes) throw new Error('Falha ao gerar o PDF');

            // 3. Salvar 1 arquivo na rede
            setBatchProgress({ current: 0, total: loteItens.length, label: 'Salvando na rede...' });
            const networkResult = await saveToNetworkDrive(pdfResult, nextCode);

            // 4. Enviar 1 e-mail por (pedido/item) — sequencialmente para não saturar o SMTP
            const emailErrors = [];
            for (let i = 0; i < loteItens.length; i++) {
                const loteItem = loteItens[i];
                setBatchProgress({
                    current: i + 1,
                    total: loteItens.length,
                    label: `Enviando e-mail ${i + 1}/${loteItens.length}: Pedido ${loteItem.pedido}/${loteItem.item}...`
                });
                try {
                    await sendOneEmail(
                        pdfResult,
                        nextCode,
                        loteItem.pedido,
                        loteItem.item,
                        loteItem.nome_cliente || null
                    );
                } catch (emailErr) {
                    console.error(`Erro ao enviar e-mail para pedido ${loteItem.pedido}/${loteItem.item}:`, emailErr);
                    emailErrors.push(`${loteItem.pedido}/${loteItem.item}`);
                }
            }

            // 5. Log em lote — 1 registro por (pedido/item) no banco
            setBatchProgress({ current: loteItens.length, total: loteItens.length, label: 'Registrando no banco...' });
            await api.post('/engineering-releases/log-batch', {
                codigo_produto:    codigo,
                descricao_produto: structure[0]?.descricao || codigo,
                usuario:           userName,
                tipo_acao:         'EMAIL',
                modo:              mode.toUpperCase(),
                caminho_arquivo:   networkResult?.path || null,
                codigo_liberacao:  nextCode,
                destinatarios:     validEmails.join(', '),
                itens:             loteItens.map(i => ({ pedido: i.pedido, item: i.item })),
            });

            // 6. Salvar e-mails para próxima vez
            localStorage.setItem(`metalfisa_eng_emails_${userName}`, JSON.stringify(validEmails));

            const errosMsg = emailErrors.length > 0
                ? ` ⚠️ Falha no envio dos pedidos: ${emailErrors.join(', ')}.`
                : '';
            setResult({
                type: emailErrors.length === 0 ? 'success' : 'error',
                message: `✅ Lote ${nextCode} registrado! ${loteItens.length - emailErrors.length}/${loteItens.length} e-mail(s) enviados para: ${validEmails.join(', ')}.${errosMsg}`,
            });

            // Reset status after successful batch release
            try {
                const codigos = structure.map(s => s.codigo);
                await setProductStatusBatch(codigos, 'NORMAL', userName, 'LIBERACAO_ENGENHARIA');
                if (onReleaseSuccess) onReleaseSuccess();
            } catch (resetErr) {
                console.error("Falha ao resetar status:", resetErr);
            }

        } catch (err) {
            console.error('Erro na liberação em lote:', err);
            setResult({ type: 'error', message: `Falha geral: ${err.response?.data?.error || err.message}` });
        } finally {
            setIsSending(false);
            setBatchProgress(null);
        }
    };

    // ════════════════════════════════════════════════════════════════════════
    const isProcessing = isGenerating || isSending;

    // ── Preview do carimbo no modal ───────────────────────────────────────────
    const carimboPreviewPedido = isBatchMode
        ? loteItens.length > 0
            ? loteItens.map(i => `${i.pedido}/${i.item}`).join(' | ')
            : '(nenhum item)'
        : `${pedido.trim() || '—'}${item.trim() ? ' / Item: ' + item.trim() : ''}`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">

                {/* ── Header ────────────────────────────────────────────── */}
                <div className={`px-6 py-5 flex justify-between items-center ${isBatchMode ? 'bg-gradient-to-r from-blue-700 to-blue-800' : 'bg-gradient-to-r from-red-600 to-red-700'}`}>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-white/15 rounded-xl">
                            {isBatchMode
                                ? <Layers className="w-6 h-6 text-white" />
                                : <Stamp className="w-6 h-6 text-white" />
                            }
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">
                                {isBatchMode
                                    ? `Liberação em Lote — ${loteItens.length} Pedido(s)`
                                    : 'Liberação de Engenharia'}
                            </h3>
                            <p className="text-white/80 text-sm">
                                {isBatchMode
                                    ? 'Um código LEN será gerado para todo o lote · 1 e-mail por pedido'
                                    : 'Carimbo de liberação para fabricação'}
                            </p>
                        </div>
                        {codigo && (
                            <div className="ml-4 bg-white/15 border border-white/25 rounded-xl px-3.5 py-1.5 flex flex-col justify-center">
                                <span className="text-[9px] text-white/70 font-bold uppercase tracking-wider">Produto</span>
                                <span className="font-mono text-xs font-black text-white leading-none mt-0.5 select-all">{codigo.trim()}</span>
                            </div>
                        )}
                    </div>
                    <button onClick={onClose} disabled={isProcessing} className="p-1.5 hover:bg-white/20 rounded-full transition-colors">
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                {/* ── Body ─────────────────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">

                    {/* Preview do carimbo */}
                    <div className="border-2 border-red-200 rounded-xl p-4 bg-red-50/50">
                        <div className="flex items-center gap-2 mb-3">
                            <Stamp className="w-4 h-4 text-red-600" />
                            <span className="text-xs font-bold text-red-700 uppercase tracking-wider">Pré-visualização do Carimbo</span>
                        </div>
                        <div className="bg-white border-2 border-red-500 rounded-lg p-4 max-w-sm mx-auto shadow-sm">
                            <div className="border border-red-400 rounded p-3">
                                <p className="text-red-600 font-bold text-center text-sm tracking-wide">LIBERADO PARA FABRICAÇÃO</p>
                                <hr className="border-red-300 my-2" />
                                <p className="text-red-600 text-xs">Data: {today}</p>
                                <p className="text-red-600 text-xs">Responsável: {userName.toUpperCase()}</p>
                                {(isBatchMode ? loteItens.length > 0 : pedido.trim()) && (
                                    <p className="text-red-600 text-xs break-words">
                                        {isBatchMode ? 'Pedidos: ' : 'Pedido: '}{carimboPreviewPedido}
                                    </p>
                                )}
                                <p className="text-red-600 text-[10px] italic mt-1">Cód. Lib: LEN-{new Date().getFullYear()}-XXXXX</p>
                                {observacao.trim() && (
                                    <p className="text-red-600 text-[10px] italic mt-1.5 border-t border-red-200 pt-1 break-words">
                                        Obs: {observacao.trim()}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── MODO LOTE: lista de pedidos ───────────────────── */}
                    {isBatchMode ? (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <PackageCheck className="w-4 h-4 text-blue-600" />
                                <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">
                                    Pedidos no Lote ({loteItens.length})
                                </span>
                            </div>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                {loteItens.map((loteItem, idx) => (
                                    <div key={idx} className="flex items-center justify-between bg-white border border-blue-100 rounded-lg px-3 py-2 gap-2">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className="font-mono text-xs font-bold text-blue-700 shrink-0">
                                                {loteItem.pedido} / {loteItem.item}
                                            </span>
                                            {loteItem.nome_cliente && (
                                                <span className="text-xs text-gray-500 truncate">{loteItem.nome_cliente}</span>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeLoteItem(idx)}
                                            disabled={loteItens.length <= 1 || isProcessing}
                                            className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
                                            title="Remover do lote"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            {loteItens.length === 0 && (
                                <p className="text-sm text-blue-400 italic text-center py-2">Nenhum item restante.</p>
                            )}
                        </div>
                    ) : (
                        /* ── MODO INDIVIDUAL: pedido + item ─────────────── */
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5 flex items-center justify-between">
                                    <span>Nº Pedido <span className="text-gray-400 font-normal">(opcional)</span></span>
                                    {initialPedido && String(pedido) === String(initialPedido) && (
                                        <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">Origem</span>
                                    )}
                                </label>
                                <div className="flex gap-1.5">
                                    <input type="text" placeholder="Ex: 123456" value={pedido} onChange={e => setPedido(e.target.value)}
                                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none min-w-0" />
                                    <button type="button" onClick={() => setShowSearchModal(true)}
                                        className="px-2.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg flex items-center justify-center text-gray-600 hover:text-gray-800 transition-colors shrink-0"
                                        title="Pesquisar Pedido de Venda">
                                        <Search className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5 block">
                                    Item <span className="text-gray-400 font-normal">(opcional)</span>
                                </label>
                                <input type="text" placeholder="Ex: 01" value={item} onChange={e => setItem(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none" />
                            </div>
                        </div>
                    )}

                    {/* Modo do relatório */}
                    <div>
                        <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2 block">Modo do Relatório</label>
                        <div className="flex gap-3">
                            <button type="button" onClick={() => setMode('full')}
                                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold border-2 transition-all ${mode === 'full' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`}>
                                Estrutura Completa
                            </button>
                            <button type="button" onClick={() => setMode('n1')}
                                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold border-2 transition-all ${mode === 'n1' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`}>
                                Nível 1 (Compacta)
                            </button>
                        </div>
                    </div>

                    {/* Observação */}
                    <div>
                        <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5 block">
                            Observação / Mensagem Adicional <span className="text-gray-400 font-normal">(opcional)</span>
                        </label>
                        <textarea placeholder="Adicione um comentário para o e-mail ou uma observação para aparecer no carimbo do PDF..."
                            value={observacao} onChange={e => setObservacao(e.target.value)} rows={2}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-y" />
                    </div>

                    {/* Destinatários de e-mail */}
                    <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Mail className="w-4 h-4 text-blue-600" />
                                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                                    Destinatários do E-mail
                                    {isBatchMode && (
                                        <span className="ml-2 text-blue-600 font-semibold normal-case text-[10px] bg-blue-100 px-1.5 py-0.5 rounded border border-blue-200">
                                            1 e-mail por pedido
                                        </span>
                                    )}
                                </label>
                            </div>
                            <button type="button" onClick={addEmailField}
                                className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-md transition-colors">
                                <Plus className="w-3.5 h-3.5" /> Adicionar
                            </button>
                        </div>
                        <div className="space-y-2">
                            {emails.map((email, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <input type="email" placeholder="endereco@email.com" value={email}
                                        onChange={e => updateEmail(idx, e.target.value)}
                                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white" />
                                    {emails.length > 1 && (
                                        <button type="button" onClick={() => removeEmailField(idx)}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        {validEmails.length > 0 && (
                            <p className="text-xs text-green-600 mt-2 font-medium">✓ {validEmails.length} e-mail(s) válido(s)</p>
                        )}
                    </div>

                    {/* Progresso do lote */}
                    {batchProgress && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                                <span className="text-sm font-medium text-blue-800">{batchProgress.label}</span>
                            </div>
                            <div className="w-full bg-blue-100 rounded-full h-2">
                                <div
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${Math.round((batchProgress.current / batchProgress.total) * 100)}%` }}
                                />
                            </div>
                            <p className="text-xs text-blue-600 mt-1 text-right">
                                {batchProgress.current}/{batchProgress.total}
                            </p>
                        </div>
                    )}

                    {/* Resultado */}
                    {result && (
                        <div className={`flex items-start gap-3 p-4 rounded-xl border ${result.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                            {result.type === 'success'
                                ? <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                                : <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                            }
                            <p className="text-sm font-medium">{result.message}</p>
                        </div>
                    )}
                </div>

                {/* ── Footer ───────────────────────────────────────────── */}
                <div className="border-t border-gray-100 bg-gray-50 px-6 py-4 flex items-center justify-between gap-3">
                    <button type="button" onClick={onClose} disabled={isProcessing}
                        className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50">
                        Fechar
                    </button>

                    <div className="flex items-center gap-3">
                        {/* Download Only */}
                        <button type="button"
                            onClick={isBatchMode ? handleBatchDownloadOnly : handleDownloadOnly}
                            disabled={isProcessing || (isBatchMode && loteItens.length === 0)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
                            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            {isGenerating ? 'Gerando...' : 'Apenas Baixar PDF'}
                        </button>

                        {/* Send Email */}
                        <button type="button"
                            onClick={isBatchMode ? handleBatchSendEmail : handleSendEmail}
                            disabled={isProcessing || validEmails.length === 0 || (isBatchMode && loteItens.length === 0)}
                            className={`flex items-center gap-2 px-5 py-2.5 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm
                                ${isBatchMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}`}>
                            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            {isSending
                                ? 'Enviando...'
                                : isBatchMode
                                    ? `Gerar PDF e Enviar (${loteItens.length}x)`
                                    : 'Gerar PDF e Enviar E-mail'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal de Pesquisa de Pedido — modo individual */}
            {!isBatchMode && showSearchModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="bg-slate-100 px-5 py-4 flex justify-between items-center border-b border-slate-200">
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <Search className="w-4 h-4 text-blue-600" /> Pesquisar Pedido de Venda
                            </h3>
                            <button type="button" onClick={() => { setShowSearchModal(false); setSearchResults([]); setSearchQuery(''); }}
                                className="p-1 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-5 flex flex-col flex-1 overflow-hidden space-y-4">
                            <form onSubmit={handleSearchOrders} className="flex gap-2">
                                <select value={searchType} onChange={e => setSearchType(e.target.value)}
                                    className="border border-slate-300 rounded-lg px-2 py-2 text-sm outline-none bg-slate-50 text-slate-700 focus:ring-2 focus:ring-blue-500 font-medium">
                                    <option value="pedido">Nº Pedido</option>
                                    <option value="produto">Cód. Produto</option>
                                    <option value="cliente">Cliente</option>
                                </select>
                                <input type="text"
                                    placeholder={searchType === 'pedido' ? 'Digite o número exato do pedido...' : searchType === 'produto' ? 'Digite o código do produto...' : 'Digite parte do nome do cliente...'}
                                    value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium" autoFocus />
                                <button type="submit" disabled={searchLoading}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors disabled:bg-blue-400">
                                    {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buscar'}
                                </button>
                            </form>
                            {searchError && (
                                <p className="text-xs text-red-600 flex items-center gap-1">
                                    <AlertCircle className="w-3.5 h-3.5" />{searchError}
                                </p>
                            )}
                            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg bg-slate-50/50">
                                {searchLoading ? (
                                    <div className="py-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
                                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                                        <span className="text-sm font-medium">Buscando itens na base...</span>
                                    </div>
                                ) : searchResults.length === 0 ? (
                                    <div className="py-12 text-center text-slate-400 text-sm">
                                        {searchQuery ? 'Nenhum resultado encontrado.' : 'Selecione o filtro e faça sua busca.'}
                                    </div>
                                ) : (
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead className="bg-slate-100 sticky top-0 border-b border-slate-200 shadow-sm z-10">
                                            <tr>
                                                <th className="p-3 font-bold text-slate-700 uppercase tracking-wider w-24">Pedido</th>
                                                <th className="p-3 font-bold text-slate-700 uppercase tracking-wider w-16">Item</th>
                                                <th className="p-3 font-bold text-slate-700 uppercase tracking-wider">Cliente</th>
                                                <th className="p-3 font-bold text-slate-700 uppercase tracking-wider">Produto</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {searchResults.map((row, idx) => (
                                                <tr key={idx}
                                                    onClick={() => { setPedido(String(row.pedido || '').trim()); setItem(String(row.item || '').trim()); setShowSearchModal(false); setSearchResults([]); setSearchQuery(''); }}
                                                    className="border-b border-slate-200 bg-white hover:bg-blue-50 cursor-pointer transition-colors">
                                                    <td className="p-3 font-mono text-blue-600 font-bold">{row.pedido}</td>
                                                    <td className="p-3 font-mono text-slate-500 font-semibold">{row.item}</td>
                                                    <td className="p-3 font-medium text-slate-800 truncate max-w-[140px]" title={row.nome_cliente}>{row.nome_cliente || '-'}</td>
                                                    <td className="p-3 font-mono text-slate-600">
                                                        <div className="font-bold text-slate-700">{row.codigo}</div>
                                                        <div className="text-[10px] text-slate-400 truncate max-w-[200px] font-sans" title={row.descricao}>{row.descricao}</div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EngineeringReleaseModal;
