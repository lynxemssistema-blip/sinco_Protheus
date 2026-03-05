import React, { useState, useEffect } from 'react';
import { X, Printer, Users, Calendar, CheckCircle, MessageSquare, Plus, Send, Pencil, Trash2, Image as ImageIcon, Save, XCircle, Filter, ChevronDown, Bell } from 'lucide-react';
import { getSalesNotes, resolveSalesNote, createSalesNote, updateSalesNote, deleteSalesNote, getProdutos } from '../services/api';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import ProductImageModal from './ProductImageModal';

export default function MeetingReportModal({ isOpen, onClose, orders, filteredData, globalMode = false }) {
    const [attendees, setAttendees] = useState('');
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(false);

    // Reply / Add Note State
    const [replyingTo, setReplyingTo] = useState(null); // { order, item, product }
    const [replyText, setReplyText] = useState('');

    // Edit State
    const [editingNoteId, setEditingNoteId] = useState(null);
    const [editText, setEditText] = useState('');

    // Image Modal State
    const [showImageModal, setShowImageModal] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);

    const [currentUser, setCurrentUser] = useState('Usuário');
    const [sortOption, setSortOption] = useState('created_desc');
    const [showResolved, setShowResolved] = useState(true);
    const [sendAviso, setSendAviso] = useState(true);
    const { user } = useAuth();

    useEffect(() => {
        if (user && user.NomeCompleto) {
            setCurrentUser(user.NomeCompleto);
        }
    }, [user]);

    const sortedReportData = React.useMemo(() => {
        let sorted = [...reportData];

        const getLatestNoteDate = (group) => {
            let maxDate = 0;
            Object.values(group.items).flat().forEach(note => {
                const d = new Date(note.created_at).getTime();
                if (d > maxDate) maxDate = d;
            });
            return maxDate;
        };

        const getEarliestNoteDate = (group) => {
            let minDate = Infinity;
            Object.values(group.items).flat().forEach(note => {
                const d = new Date(note.created_at).getTime();
                if (d < minDate) minDate = d;
            });
            return minDate === Infinity ? 0 : minDate;
        }

        const parseDeliveryDate = (dStr) => {
            if (!dStr || dStr === '-') return 9999999999999;
            if (dStr.includes('/')) {
                const parts = dStr.split('/');
                if (parts.length === 3) {
                    const year = parts[2].length === 2 ? 2000 + parseInt(parts[2]) : parseInt(parts[2]);
                    return new Date(year, parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
                }
            }
            return new Date(dStr).getTime();
        }

        switch (sortOption) {
            case 'created_desc':
                sorted.sort((a, b) => getLatestNoteDate(b) - getLatestNoteDate(a));
                break;
            case 'created_asc':
                sorted.sort((a, b) => getEarliestNoteDate(a) - getEarliestNoteDate(b));
                break;
            case 'order_asc':
                sorted.sort((a, b) => String(a.info.pedido).localeCompare(String(b.info.pedido)));
                break;
            case 'client_asc':
                sorted.sort((a, b) => String(a.info.cliente).localeCompare(String(b.info.cliente)));
                break;
            case 'delivery_asc':
                sorted.sort((a, b) => parseDeliveryDate(a.info.proxima_entrega) - parseDeliveryDate(b.info.proxima_entrega));
                break;
            default:
                break;
        }
        return sorted;
    }, [reportData, sortOption]);

    useEffect(() => {
        if (isOpen) {
            if (globalMode || (orders && orders.length > 0)) {
                fetchReportData();
            }
        }
    }, [isOpen, orders, globalMode]);

    const fetchReportData = async () => {
        setLoading(true);
        try {
            const notes = await getSalesNotes(globalMode ? null : orders, null, globalMode);
            const grouped = {};

            if (globalMode) {
                notes.forEach(note => {
                    const orderNum = note.order_number;
                    if (!grouped[orderNum]) {
                        grouped[orderNum] = {
                            info: {
                                pedido: orderNum,
                                cliente: note.client_name || 'Cliente Desconhecido',
                                proxima_entrega: note.order_emission || '-'
                            },
                            items: {}
                        };
                    }
                    const key = note.item_number || 'GERAL';
                    if (!grouped[orderNum].items[key]) grouped[orderNum].items[key] = [];
                    grouped[orderNum].items[key].push(note);
                });
            } else {
                orders.forEach(orderNum => {
                    const orderInfo = filteredData?.find(d => d.pedido === orderNum);
                    if (orderInfo) {
                        const orderNotes = notes.filter(n => n.order_number === orderNum);
                        if (orderNotes.length > 0) {
                            grouped[orderNum] = {
                                info: orderInfo,
                                items: {}
                            };
                            orderNotes.forEach(note => {
                                const key = note.item_number || 'GERAL';
                                if (!grouped[orderNum].items[key]) grouped[orderNum].items[key] = [];
                                grouped[orderNum].items[key].push(note);
                            });
                        }
                    }
                });
            }
            setReportData(Object.values(grouped));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleResolve = async (id) => {
        if (!confirm('Marcar como resolvido?')) return;
        try {
            await resolveSalesNote(id, currentUser);
            fetchReportData();
        } catch (err) { alert('Erro ao resolver'); }
    };

    const handleSendReply = async (order, item, product) => {
        if (!replyText.trim()) return;
        try {
            await createSalesNote({
                order_number: order,
                item_number: item === 'GERAL' ? null : item,
                product_code: product,
                note_text: replyText,
                category: 'Reunião',
                created_by: currentUser
            });

            if (sendAviso && user?.id) {
                try {
                    const token = localStorage.getItem('@metalfisa:token');
                    // Find the order info to enrich the aviso message
                    const orderData = Object.values(reportData).find(g => g.info.pedido === order);
                    const clientName = orderData?.info?.cliente || '';

                    const itemMsg = item === 'GERAL' ? 'Geral' : `Item ${item}`;
                    const customMsg = `🚨 *Nova Pendência na Ata*\nPedido: ${order} ${clientName ? `(${clientName})` : ''}\nRef: ${itemMsg} ${product ? `[${product}]` : ''}\n\nMensagem: ${replyText}`;

                    // We send to ID 1 (Admin/PCP) as default fallback, but real systems would select dest
                    await api.post('/avisos', {
                        idRemetente: user.id,
                        idDestinatario: 1, // Change if needed to specific group
                        mensagem: customMsg
                    }, { headers: { Authorization: `Bearer ${token}` } });
                } catch (avisoErr) {
                    console.error('Erro ao enviar aviso automático', avisoErr);
                }
            }

            setReplyingTo(null);
            setReplyText('');
            fetchReportData();
        } catch (err) { alert('Erro ao salvar nota'); }
    };

    const handleDelete = async (id) => {
        if (!confirm('Tem certeza que deseja excluir esta anotação?')) return;
        try {
            await deleteSalesNote(id);
            fetchReportData();
        } catch (err) { alert('Erro ao excluir'); }
    };

    const startEditing = (note) => {
        setEditingNoteId(note.id);
        setEditText(note.note_text);
    };

    const handleSaveEdit = async (id) => {
        if (!editText.trim()) return;
        try {
            await updateSalesNote(id, { note_text: editText });
            setEditingNoteId(null);
            fetchReportData();
        } catch (err) { alert('Erro ao atualizar nota'); }
    };

    const handleViewImage = async (productCode) => {
        if (!productCode) return;
        try {
            // Fetch product details to get image URL
            const result = await getProdutos({ code: productCode });
            if (result && result.data && result.data.length > 0) {
                setSelectedProduct(result.data[0]);
                setShowImageModal(true);
            } else {
                // Fallback if product not found but we have code, let modal handle it (upload mode)
                setSelectedProduct({ codigo: productCode, imagem_url: null });
                setShowImageModal(true);
            }
        } catch (err) {
            console.error('Error fetching product image:', err);
            setSelectedProduct({ codigo: productCode, imagem_url: null });
            setShowImageModal(true);
        }
    };

    const handlePrint = () => {
        const printContent = document.getElementById('meeting-report-content').innerHTML;
        const win = window.open('', '', 'height=700,width=900');
        win.document.write('<html><head><title>Ata de Reunião</title>');
        // Improved Print Styles
        win.document.write(`
            <style>
                @media print {
                    @page { margin: 15mm; size: A4; }
                    body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-print-color-adjust: exact; background: #fff; }
                    .no-print, .print\\:hidden { display: none !important; }
                    .report-container { width: 100%; max-width: 100%; margin: 0; padding: 0; box-shadow: none; border: none; }
                    .header { border-bottom: 2px solid #334155; padding-bottom: 20px; margin-bottom: 30px; }
                    h1 { font-size: 24px; color: #0f172a; margin: 0; text-transform: uppercase; letter-spacing: 0.05em; }
                    h2 { font-size: 14px; color: #64748b; font-weight: 500; margin: 5px 0 0 0; }
                    .order-block { break-inside: avoid; margin-bottom: 25px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
                    .order-header { background: #f1f5f9 !important; padding: 10px 15px; border-bottom: 1px solid #cbd5e1; display: flex; justify-content: space-between; align-items: center; }
                    .order-body { padding: 15px; background: #fff; }
                    .note-group { margin-bottom: 15px; }
                    .note-group:last-child { margin-bottom: 0; }
                    .item-badge { display: inline-block; font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 4px; background: #e2e8f0; color: #475569; margin-bottom: 8px; }
                    .note-item { margin-left: 10px; padding-left: 12px; border-left: 3px solid #cbd5e1; margin-bottom: 8px; font-size: 13px; line-height: 1.5; }
                    .note-pending { border-left-color: #ef4444; }
                    .note-resolved { border-left-color: #22c55e; color: #94a3b8; }
                    .note-meta { font-size: 10px; color: #94a3b8; margin-top: 2px; }
                    .signatures { margin-top: 60px; display: flex; justify-content: space-between; page-break-inside: avoid; }
                    .sig-line { border-top: 1px solid #334155; width: 40%; text-align: center; font-size: 11px; padding-top: 8px; text-transform: uppercase; letter-spacing: 0.05em; }
                }
            </style>
        `);
        win.document.write('</head><body>');
        win.document.write(printContent);
        win.document.write('</body></html>');
        win.document.close();
        // Give browser time to load styles/images
        setTimeout(() => {
            win.print();
        }, 500);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 print:hidden">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Printer className="w-5 h-5 text-blue-600" />
                        Gerar Ata de Reunião
                    </h3>
                    <div className="flex gap-2">
                        <button onClick={onClose}><X className="w-5 h-5 text-slate-500 hover:text-red-500" /></button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-100">

                    {/* Input Config & Sorting */}
                    <div className="bg-white p-4 rounded-lg shadow-sm mb-6 w-full max-w-4xl mx-auto flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                            <label className="block text-sm font-bold text-slate-700 mb-2">Participantes da Reunião</label>
                            <div className="relative">
                                <Users className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                <input
                                    className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                                    placeholder="Ex: Edson, João (PCP), Maria (Vendas), Pedro (Diretoria)..."
                                    value={attendees}
                                    onChange={e => setAttendees(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="w-full md:w-64">
                            <label className="block text-sm font-bold text-slate-700 mb-2">Ordenação</label>
                            <div className="relative">
                                <Filter className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                <select
                                    className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none appearance-none bg-white"
                                    value={sortOption}
                                    onChange={(e) => setSortOption(e.target.value)}
                                >
                                    <option value="created_desc">Mais Recentes (Criação)</option>
                                    <option value="created_asc">Mais Antigas (Criação)</option>
                                    <option value="order_asc">Pedido (Crescente)</option>
                                    <option value="client_asc">Cliente (A-Z)</option>
                                    <option value="delivery_asc">Data de Entrega</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>

                        <div className="flex items-end mb-0.5">
                            <label className="flex items-center gap-2 cursor-pointer bg-slate-50 hover:bg-slate-100 border border-slate-200 text-sm text-slate-700 px-4 py-2 rounded-lg h-[38px] transition-colors">
                                <input
                                    type="checkbox"
                                    checked={showResolved}
                                    onChange={(e) => setShowResolved(e.target.checked)}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                Mostrar Notas Resolvidas
                            </label>
                        </div>

                        <div className="flex items-end mb-0.5">
                            <div className="flex items-center text-sm text-slate-400 bg-slate-50 px-3 py-2 rounded-lg border h-[38px]">
                                <Calendar className="w-4 h-4 mr-2" />
                                {new Date().toLocaleDateString()}
                            </div>
                        </div>
                    </div>

                    {/* Preview Area (This is what gets printed) */}
                    <div id="meeting-report-content" className="bg-white p-8 shadow-lg min-h-[600px] report-container max-w-[210mm] mx-auto">
                        {/* Print Header */}
                        <div className="header border-b-2 border-slate-800 pb-6 mb-8">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h1 className="text-3xl font-bold text-slate-900 uppercase tracking-wide">Ata de Reunião</h1>
                                    <h2 className="text-lg text-slate-600 font-medium mt-1">
                                        {globalMode ? 'Pendências Gerais (Global)' : 'Planejamento de Vendas'}
                                    </h2>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm text-slate-500">Data de Emissão</div>
                                    <div className="font-mono text-lg font-bold">{new Date().toLocaleDateString()}</div>
                                    <div className="text-xs text-slate-400">{new Date().toLocaleTimeString()}</div>
                                </div>
                            </div>

                            <div className="mt-6 bg-slate-50 p-4 rounded-lg border border-slate-100 print:bg-transparent print:border-none print:p-0">
                                <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
                                    <span className="font-bold text-slate-700">Participantes:</span>
                                    <span className="text-slate-600">{attendees || '___________________________________________________________________'}</span>

                                    <span className="font-bold text-slate-700">Pauta:</span>
                                    <span className="text-slate-600">Acompanhamento de Pedidos e Pendências de Produção/Vendas</span>
                                </div>
                            </div>
                        </div>

                        {loading ? (
                            <div className="text-center py-10 text-slate-400">Carregando anotações...</div>
                        ) : reportData.length === 0 ? (
                            <div className="text-center py-10 text-slate-400 bg-slate-50 rounded border border-dashed">
                                Nenhuma anotação encontrada nos pedidos filtrados.
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {sortedReportData.map((group, idx) => {
                                    // Fix Date Parsing
                                    let deliveryDateDisplay = '-';
                                    if (group.info.proxima_entrega) {
                                        const parts = group.info.proxima_entrega.split('/');
                                        if (parts.length === 3) {
                                            const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
                                            deliveryDateDisplay = `${parts[0]}/${parts[1]}/${year}`;
                                        } else {
                                            deliveryDateDisplay = group.info.proxima_entrega;
                                        }
                                    }

                                    return (
                                        <div key={idx} className="order-block break-inside-avoid mb-6 border border-slate-200 rounded-lg overflow-hidden">
                                            {/* Order Header Box */}
                                            <div className="order-header bg-slate-100 print:bg-gray-100 p-3 flex justify-between items-center border-b border-slate-200">
                                                <div className="flex items-center gap-3">
                                                    <span className="bg-slate-800 text-white text-sm font-bold px-2 py-1 rounded">
                                                        {group.info.pedido}
                                                    </span>
                                                    <span className="font-bold text-slate-800 text-base uppercase truncate max-w-[400px]">
                                                        {group.info.cliente}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="text-right">
                                                        <div className="text-[10px] text-slate-500 uppercase font-bold">Previsão Entrega</div>
                                                        <div className="font-mono text-sm font-bold text-slate-700">
                                                            {deliveryDateDisplay}
                                                        </div>
                                                    </div>

                                                    {/* Interactive Add Button */}
                                                    <button
                                                        onClick={() => setReplyingTo({ order: group.info.pedido, item: 'GERAL', product: null })}
                                                        className="p-1 hover:bg-blue-100 text-blue-600 rounded print:hidden no-print"
                                                        title="Adicionar nota geral"
                                                    >
                                                        <Plus className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Order Body */}
                                            <div className="order-body p-4 bg-white">
                                                {Object.keys(group.items).length === 0 && (
                                                    <div className="text-sm text-slate-400 italic">Sem anotações registradas.</div>
                                                )}

                                                {Object.entries(group.items).sort().map(([itemKey, notes]) => {
                                                    const visibleNotes = showResolved ? notes : notes.filter(n => !n.is_resolved);
                                                    if (visibleNotes.length === 0) return null;

                                                    const productCode = notes[0]?.product_code;

                                                    return (
                                                        <div key={itemKey} className="note-group mb-4 last:mb-0">
                                                            <div className="flex items-center gap-2 mb-2 border-b border-slate-50 pb-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`item-badge text-xs font-bold px-2 py-0.5 rounded ${itemKey === 'GERAL' ? 'bg-slate-200 text-slate-700' : 'bg-blue-50 text-blue-700'}`}>
                                                                        {itemKey === 'GERAL' ? 'GERAL' : `ITEM ${itemKey}`}
                                                                    </span>
                                                                    {productCode && (
                                                                        <span className="font-mono text-sm font-bold text-slate-800">
                                                                            {productCode}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <button
                                                                    onClick={() => setReplyingTo({ order: group.info.pedido, item: itemKey, product: productCode })}
                                                                    className="text-slate-400 hover:text-blue-600 print:hidden no-print ml-1"
                                                                    title="Adicionar nota"
                                                                >
                                                                    <Plus className="w-3 h-3" />
                                                                </button>
                                                            </div>

                                                            <div className="space-y-2 pl-2">
                                                                {visibleNotes.map(note => (
                                                                    <div key={note.id} className={`note-item relative pl-3 border-l-2 ${note.is_resolved ? 'border-green-200 note-resolved' : 'border-red-400 note-pending'}`}>
                                                                        {editingNoteId === note.id ? (
                                                                            /* Editing Mode */
                                                                            <div className="flex flex-col gap-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200 print:hidden no-print mt-1 mb-2">
                                                                                <textarea
                                                                                    className="w-full text-sm p-3 border rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-amber-400 outline-none"
                                                                                    rows={3}
                                                                                    value={editText}
                                                                                    onChange={e => setEditText(e.target.value)}
                                                                                />
                                                                                <div className="flex justify-end gap-2">
                                                                                    <button onClick={() => setEditingNoteId(null)} className="flex items-center gap-1 px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
                                                                                        <XCircle className="w-4 h-4" /> Cancelar
                                                                                    </button>
                                                                                    <button onClick={() => handleSaveEdit(note.id)} className="flex items-center gap-1 px-4 py-1.5 text-sm font-bold bg-amber-500 text-white hover:bg-amber-600 rounded-lg shadow-sm transition-colors">
                                                                                        <Save className="w-4 h-4" /> Salvar Edição
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            /* View Mode */
                                                                            <div className="flex justify-between items-start group">
                                                                                <div className="text-sm text-slate-800 pr-4 flex-1">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className={`whitespace-pre-wrap font-medium ${note.is_resolved ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                                                                                            {note.note_text}
                                                                                        </span>
                                                                                        {/* Product Image Icon */}
                                                                                        {note.product_code && (
                                                                                            <button
                                                                                                onClick={() => handleViewImage(note.product_code)}
                                                                                                className="text-slate-400 hover:text-blue-600 print:hidden no-print transition-colors"
                                                                                                title="Ver Imagem do Produto"
                                                                                            >
                                                                                                <ImageIcon className="w-4 h-4" />
                                                                                            </button>
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="note-meta text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                                                                        {note.is_resolved ? (
                                                                                            <span className="flex items-center text-green-600 font-bold bg-green-50 px-1 rounded">
                                                                                                <CheckCircle className="w-3 h-3 mr-1" /> Resolvido
                                                                                            </span>
                                                                                        ) : (
                                                                                            <span className="text-red-500 font-bold">• Pendente</span>
                                                                                        )}
                                                                                        <span className="mx-1">|</span>
                                                                                        {note.created_by} em {new Date(note.created_at).toLocaleString()}
                                                                                    </div>
                                                                                </div>

                                                                                {/* Actions */}
                                                                                <div className="flex items-center gap-1 opacity-10 group-hover:opacity-100 transition-opacity print:hidden no-print">
                                                                                    {!note.is_resolved && (
                                                                                        <button
                                                                                            onClick={() => handleResolve(note.id)}
                                                                                            className="text-xs text-green-600 hover:bg-green-50 p-1.5 rounded"
                                                                                            title="Marcar como Resolvido"
                                                                                        >
                                                                                            <CheckCircle className="w-4 h-4" />
                                                                                        </button>
                                                                                    )}
                                                                                    <button
                                                                                        onClick={() => startEditing(note)}
                                                                                        className="text-xs text-amber-500 hover:bg-amber-50 p-1.5 rounded"
                                                                                        title="Editar"
                                                                                    >
                                                                                        <Pencil className="w-4 h-4" />
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => handleDelete(note.id)}
                                                                                        className="text-xs text-red-500 hover:bg-red-50 p-1.5 rounded"
                                                                                        title="Excluir"
                                                                                    >
                                                                                        <Trash2 className="w-4 h-4" />
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })}

                                                {/* Reply Input Area */}
                                                {replyingTo && replyingTo.order === group.info.pedido && (
                                                    <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100 shadow-sm animate-fadeIn print:hidden no-print">
                                                        <div className="flex justify-between items-center mb-2">
                                                            <div className="text-sm font-bold text-blue-800">
                                                                Nova nota para: {replyingTo.item === 'GERAL' ? 'Pedido Geral' : `Item ${replyingTo.item} ${replyingTo.product ? `[${replyingTo.product}]` : ''}`}
                                                            </div>
                                                            <label className="flex items-center gap-1.5 text-xs text-slate-600 font-medium cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={sendAviso}
                                                                    onChange={e => setSendAviso(e.target.checked)}
                                                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                                />
                                                                <Bell className="w-3 h-3" /> Gerar Aviso Notificação
                                                            </label>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <textarea
                                                                autoFocus
                                                                className="flex-1 text-sm border border-blue-200 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                                                placeholder="Digite os detalhes da pendência/nota..."
                                                                rows={2}
                                                                value={replyText}
                                                                onChange={e => setReplyText(e.target.value)}
                                                                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendReply(replyingTo.order, replyingTo.item, replyingTo.product))}
                                                                disabled={loading}
                                                            />
                                                            <div className="flex flex-col justify-end gap-1">
                                                                <button
                                                                    onClick={() => handleSendReply(replyingTo.order, replyingTo.item, replyingTo.product)}
                                                                    className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 flex items-center justify-center h-[52px]"
                                                                    title="Salvar e Enviar"
                                                                >
                                                                    <Send className="w-5 h-5" />
                                                                </button>
                                                                <button onClick={() => { setReplyingTo(null); setReplyText(''); }} className="py-1 text-xs font-medium text-slate-500 hover:bg-slate-200 hover:text-slate-800 rounded-lg">
                                                                    Cancelar
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <div className="signatures mt-16 pt-8 grid grid-cols-2 gap-20 invisible print:visible">
                            <div className="sig-line">Responsável Comercial</div>
                            <div className="sig-line">Responsável PCP/Fábrica</div>
                        </div>
                    </div>

                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t bg-slate-50 rounded-b-xl flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg">Cancelar</button>
                    <button
                        onClick={handlePrint}
                        className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 flex items-center gap-2"
                        disabled={loading || reportData.length === 0}
                    >
                        <Printer className="w-4 h-4" /> Imprimir Ata
                    </button>
                </div>

                {/* Image Modal */}
                {showImageModal && (
                    <ProductImageModal
                        product={selectedProduct}
                        onClose={() => setShowImageModal(false)}
                        onSuccess={() => {
                            // If user updated image, maybe we reload report to refresh data (unlikely needed for report view, but nice)
                            setShowImageModal(false);
                            fetchReportData(); // Refresh just in case
                        }}
                    />
                )}
            </div>
        </div>
    );
}
