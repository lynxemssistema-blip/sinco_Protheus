import React, { useState, useEffect } from 'react';
import { X, Send, Stamp, Download, Plus, Trash2, Mail, FileText, AlertCircle, CheckCircle, Loader2, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { generateSincoStructurePdf } from '../services/sincoStructurePdfGenerator';
import api from '../services/api';

const SincoEmailModal = ({ isOpen, onClose, arvore, arquivo }) => {
    const { user } = useAuth();
    const [pedido, setPedido] = useState('');
    const [item, setItem] = useState('');
    const [observacao, setObservacao] = useState('');
    const [emails, setEmails] = useState(['']);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [result, setResult] = useState(null); // { type: 'success' | 'error', message }
    const [mode, setMode] = useState('full'); // 'full' or 'n1'

    const [showSearchModal, setShowSearchModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchType, setSearchType] = useState('pedido');
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState('');

    const userName = user?.nome || user?.NomeCompleto || user?.username || 'Usuário';
    const today = new Date().toLocaleDateString('pt-BR');

    useEffect(() => {
        if (isOpen) {
            setPedido('');
            setItem('');
            setObservacao('');
            setResult(null);
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && userName) {
            const savedEmails = localStorage.getItem(`metalfisa_eng_emails_${userName}`);
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
        }
    }, [isOpen, userName]);

    const handleSearchOrders = async (e, overrideQuery = null, overrideType = null) => {
        if (e) e.preventDefault();
        const q = overrideQuery !== null ? overrideQuery : searchQuery;
        const type = overrideType !== null ? overrideType : searchType;
        setSearchLoading(true);
        setSearchError('');
        try {
            const params = {
                limit: 50,
                only_active: 'false'
            };
            if (q && q.trim()) {
                if (type === 'pedido') {
                    params.pedido = q.trim();
                } else if (type === 'produto') {
                    params.produto = q.trim();
                } else if (type === 'cliente') {
                    params.cliente = q.trim();
                }
            }
            const response = await api.get('/pedidos/flat', { params });
            if (response.data && Array.isArray(response.data.data)) {
                setSearchResults(response.data.data);
            } else if (Array.isArray(response.data)) {
                setSearchResults(response.data);
            } else {
                setSearchResults([]);
            }
        } catch (err) {
            console.error('Erro ao buscar pedidos:', err);
            setSearchError('Falha ao buscar pedidos. Tente novamente.');
        } finally {
            setSearchLoading(false);
        }
    };

    // Auto-carregar pedidos ao abrir a modal de pesquisa
    useEffect(() => {
        if (showSearchModal) {
            const prodCode = arvore?.codigo || arquivo?.codigo || '';
            const initialQuery = pedido?.trim() || prodCode?.trim() || '';
            const initialType = pedido?.trim() ? 'pedido' : (prodCode?.trim() ? 'produto' : 'pedido');
            setSearchType(initialType);
            setSearchQuery(initialQuery);
            handleSearchOrders(null, initialQuery, initialType);
        }
    }, [showSearchModal]);

    if (!isOpen) return null;

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

    const generatePdf = async () => {
        const structureObj = {
            rootCode: arquivo,
            tree: arvore.map(item => ({
                nivel: item.nivel || 0,
                CodMatFabricante: item.componente || item.codigo || 'S/COD',
                DescResumo: item.descricao || '',
                QtdeTotal: item.quantidade || 0,
                Unidade: item.um || 'UN',
                materiais: [],
                processos: []
            })),
            protheusData: {}
        };

        return await generateSincoStructurePdf(structureObj, user, true);
    };

    // Lógicas de salvar na rede e baixar apenas PDF removidas.

    const handleSendEmail = async () => {
        if (validEmails.length === 0) {
            setResult({ type: 'error', message: 'Informe ao menos um e-mail válido para envio.' });
            return;
        }

        setIsSending(true);
        setResult(null);
        try {
            // 2. Generate PDF
            const pdfResult = await generatePdf();
            if (!pdfResult || !pdfResult.bytes) {
                throw new Error('Falha ao gerar o PDF');
            }

            // 4. Prepare email
            const toList = validEmails.join(', ');
            const rootDesc = arvore[0]?.descricao || arquivo;
            const pedidoInfo = pedido.trim()
                ? `Pedido: ${pedido.trim()}${item.trim() ? ' / Item: ' + item.trim() : ''}`
                : '';

            const subject = `[ESTRUTURA DE PRODUTO] ${arquivo.trim()} — ${rootDesc}${pedidoInfo ? ' — ' + pedidoInfo : ''}`;

            const htmlBody = `
                <h2 style="color: #1e3a78; margin-bottom: 5px;">Relatório de Estrutura de Produto</h2>
                <hr style="border: none; border-top: 2px solid #1e3a78; margin: 10px 0 20px;" />
                
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                    <tr>
                        <td style="padding: 8px 12px; background-color: #f1f5f9; font-weight: bold; width: 160px; border: 1px solid #e2e8f0;">Produto</td>
                        <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-family: monospace;">${arquivo.trim()}</td>
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
                        <td style="padding: 8px 12px; background-color: #f1f5f9; font-weight: bold; border: 1px solid #e2e8f0;">Data de Envio</td>
                        <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${today}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 12px; background-color: #f1f5f9; font-weight: bold; border: 1px solid #e2e8f0;">Remetente</td>
                        <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${userName}</td>
                    </tr>
                </table>

                ${observacao.trim() ? `
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 14px 18px; border-radius: 4px; margin-bottom: 20px;">
                    <p style="margin: 0; color: #334155; font-weight: bold; font-size: 14px;">
                        📝 Observações Adicionais
                    </p>
                    <p style="margin: 5px 0 0; color: #475569; font-size: 13px; white-space: pre-wrap;">${observacao.trim()}</p>
                </div>
                ` : ''}

                <div style="background-color: #e0f2fe; border: 1px solid #bae6fd; border-left: 4px solid #0ea5e9; padding: 14px 18px; border-radius: 4px; margin-bottom: 20px;">
                    <p style="margin: 0; color: #0369a1; font-weight: bold; font-size: 14px;">
                        📄 PDF EM ANEXO
                    </p>
                    <p style="margin: 5px 0 0; color: #0c4a6e; font-size: 13px;">
                        O relatório em PDF contendo a estrutura completa deste produto segue em anexo a este e-mail.
                    </p>
                </div>
            `;

            const formData = new FormData();
            formData.append('to', toList);
            formData.append('subject', subject);
            formData.append('html', htmlBody);
            formData.append('text', `Relatório de Estrutura do Produto: ${arquivo.trim()} - ${rootDesc}`);

            const pdfBlob = new Blob([pdfResult.bytes], { type: 'application/pdf' });
            formData.append('attachments', pdfBlob, pdfResult.fileName);

            // 5. Send via existing email route (async backend — 202 = accepted)
            await api.post('/email/send', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 90000, // 90s — PDF grande + SMTP lento
                validateStatus: (s) => s === 200 || s === 202, // aceita 202 Accepted
            });

            // 7. Save valid emails for next time
            const emailsToSave = validEmails.length > 0 ? validEmails : [''];
            localStorage.setItem(`metalfisa_eng_emails_${userName}`, JSON.stringify(emailsToSave));

            setResult({
                type: 'success',
                message: `✅ E-mail sendo enviado para: ${toList}`
            });
        } catch (err) {
            console.error('Erro ao enviar e-mail:', err);
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
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-white/15 rounded-xl">
                            <Mail className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Enviar Estrutura por E-mail</h3>
                            <p className="text-blue-100 text-sm">O PDF da estrutura será enviado como anexo</p>
                        </div>
                        {arquivo && (
                            <div className="ml-4 bg-white/15 border border-white/25 rounded-xl px-3.5 py-1.5 flex flex-col justify-center shadow-inner">
                                <span className="text-[9px] text-blue-100 font-bold uppercase tracking-wider">Produto</span>
                                <span className="font-mono text-xs font-black text-white leading-none mt-0.5 select-all">{arquivo.trim()}</span>
                            </div>
                        )}
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

                    {/* Mode selector (Removido, usamos apenas estrutura completa) */}

                    {/* Pedido / Item */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5 block flex items-center justify-between">
                                <span>Nº Pedido <span className="text-gray-400 font-normal">(opcional)</span></span>
                            </label>
                            <div className="flex gap-1.5">
                                <input
                                    type="text"
                                    placeholder="Ex: 123456"
                                    value={pedido}
                                    onChange={e => setPedido(e.target.value)}
                                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none min-w-0"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowSearchModal(true)}
                                    className="px-2.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg flex items-center justify-center text-gray-600 hover:text-gray-800 transition-colors shrink-0"
                                    title="Pesquisar Pedido de Venda"
                                >
                                    <Search className="w-4 h-4" />
                                </button>
                            </div>
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

                    {/* Observação / Mensagem Adicional */}
                    <div>
                        <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5 block">
                            Observação / Mensagem Adicional <span className="text-gray-400 font-normal">(opcional)</span>
                        </label>
                        <textarea
                            placeholder="Adicione um comentário para o e-mail ou uma observação para aparecer no carimbo do PDF..."
                            value={observacao}
                            onChange={e => setObservacao(e.target.value)}
                            rows={2}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-y"
                        />
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

                        {/* Send Email */}
                        <button
                            type="button"
                            onClick={handleSendEmail}
                            disabled={isProcessing || validEmails.length === 0}
                            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
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

            {/* Modal de Pesquisa de Pedido */}
            {showSearchModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[80vh]">
                        {/* Header */}
                        <div className="bg-slate-100 px-5 py-4 flex justify-between items-center border-b border-slate-200">
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <Search className="w-4 h-4 text-blue-600" />
                                Pesquisar Pedido de Venda
                            </h3>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowSearchModal(false);
                                    setSearchResults([]);
                                    setSearchQuery('');
                                }}
                                className="p-1 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Search Input Box */}
                        <div className="p-5 flex flex-col flex-1 overflow-hidden space-y-4">
                            <form onSubmit={handleSearchOrders} className="flex gap-2">
                                <select
                                    value={searchType}
                                    onChange={e => setSearchType(e.target.value)}
                                    className="border border-slate-300 rounded-lg px-2 py-2 text-sm outline-none bg-slate-50 text-slate-700 focus:ring-2 focus:ring-blue-500 font-medium"
                                >
                                    <option value="pedido">Nº Pedido</option>
                                    <option value="produto">Cód. Produto</option>
                                    <option value="cliente">Cliente</option>
                                </select>
                                <input
                                    type="text"
                                    placeholder={
                                        searchType === 'pedido' ? "Digite o número exato do pedido..." :
                                        searchType === 'produto' ? "Digite o código do produto..." :
                                        "Digite parte do nome do cliente..."
                                    }
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                                    autoFocus
                                />
                                <button
                                    type="submit"
                                    disabled={searchLoading}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors disabled:bg-blue-400"
                                >
                                    {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buscar'}
                                </button>
                            </form>

                            {searchError && (
                                <p className="text-xs text-red-600 flex items-center gap-1">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    {searchError}
                                </p>
                            )}

                            {/* Results Table */}
                            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg bg-slate-50/50">
                                {searchLoading ? (
                                    <div className="py-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
                                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                                        <span className="text-sm font-medium">Buscando itens na base...</span>
                                    </div>
                                ) : searchResults.length === 0 ? (
                                    <div className="py-12 text-center text-slate-400 text-sm flex flex-col items-center justify-center gap-2">
                                        <span>{searchQuery ? 'Nenhum resultado encontrado para esta pesquisa.' : 'Nenhum pedido encontrado.'}</span>
                                        {searchQuery && (
                                            <button
                                                type="button"
                                                onClick={() => { setSearchQuery(''); handleSearchOrders(null, '', 'pedido'); }}
                                                className="text-xs text-blue-600 hover:underline font-semibold"
                                            >
                                                Listar todos os pedidos recentes
                                            </button>
                                        )}
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
                                                <tr
                                                    key={idx}
                                                    onClick={() => {
                                                        setPedido(String(row.pedido || '').trim());
                                                        setItem(String(row.item || '').trim());
                                                        setShowSearchModal(false);
                                                        setSearchResults([]);
                                                        setSearchQuery('');
                                                    }}
                                                    className="border-b border-slate-200 bg-white hover:bg-blue-50 cursor-pointer transition-colors"
                                                >
                                                    <td className="p-3 font-mono text-blue-600 font-bold">{row.pedido}</td>
                                                    <td className="p-3 font-mono text-slate-500 font-semibold">{row.item}</td>
                                                    <td className="p-3 font-medium text-slate-800 truncate max-w-[140px]" title={row.nome_cliente}>
                                                        {row.nome_cliente || '-'}
                                                    </td>
                                                    <td className="p-3 font-mono text-slate-600">
                                                        <div className="font-bold text-slate-700">{row.codigo}</div>
                                                        <div className="text-[10px] text-slate-400 truncate max-w-[200px] font-sans" title={row.descricao}>
                                                            {row.descricao}
                                                        </div>
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

export default SincoEmailModal;
