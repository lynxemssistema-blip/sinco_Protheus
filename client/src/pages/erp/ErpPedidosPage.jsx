import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useDebounce } from '../../hooks/useDebounce';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
import { 
    ShoppingCart, Plus, Search, RefreshCw, Layers, CheckCircle2, AlertCircle, 
    Trash2, Calendar, User, DollarSign, Eye, X, Building2, Package, Edit2, 
    Lock, Save, Check, Filter, Tag, SlidersHorizontal, ArrowUpDown, ChevronLeft, 
    ChevronRight, ChevronDown, RotateCcw, Sparkles, Clock, Truck, Copy, FileText, MessageSquare,
    Folder, FolderOpen, FileSpreadsheet, Download, Settings, Printer, BookOpen
} from 'lucide-react';
import { Button, IconButton } from '../../components/ui';
import {
    generateSingleOrderPdf,
    generateSingleOrderExcel,
    generateAllOrdersPdf,
    generateAllOrdersExcel
} from '../../services/erpOrderReportService';

const STATUS_META = {
    orcamento: { label: 'Orçamento', cls: 'bg-amber-50 text-amber-800 border border-amber-200' },
    pedido: { label: 'Pedido', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
    cancelado: { label: 'Cancelado', cls: 'bg-red-50 text-red-700 border border-red-200' }
};
const statusMeta = (s) => STATUS_META[s] || STATUS_META.orcamento;

function StatusBadge({ status, size = 'text-[11px]' }) {
    const meta = statusMeta(status);
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-semibold ${size} ${meta.cls}`}>
            {meta.label}
        </span>
    );
}

const formatBytes = (n) => {
    const v = Number(n) || 0;
    if (v < 1024) return `${v} B`;
    if (v < 1024 * 1024) return `${(v / 1024).toFixed(0)} KB`;
    return `${(v / 1024 / 1024).toFixed(1)} MB`;
};

function ClientAvatar({ logo, name, size = 'w-8 h-8' }) {
    if (logo) {
        return <img src={logo} alt={name || 'Cliente'} className={`${size} rounded-lg object-contain bg-white border border-gray-200 p-0.5 shrink-0`} />;
    }
    const initials = String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    return (
        <div className={`${size} rounded-lg bg-slate-100 border border-slate-200 text-slate-500 text-[10px] font-bold flex items-center justify-center shrink-0`}>
            {initials}
        </div>
    );
}

// Accepts Brazilian decimal input ("2,3" / "1.234,56") as well as "2.3"
const parseDecimalBR = (v) => {
    const s = String(v ?? '').trim();
    if (!s) return NaN;
    return parseFloat(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
};
const sanitizeDecimal = (v) => String(v ?? '').replace(/[^\d.,]/g, '');
const toInputBR = (v) => (v === '' || v === null || v === undefined || isNaN(parseFloat(v)) ? '' : String(parseFloat(v)).replace('.', ','));

export default function ErpPedidosPage() {
    const [pedidos, setPedidos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearch = useDebounce(searchTerm, 350);
    const [statusFilter, setStatusFilter] = useState('');
    const [groupBy, setGroupBy] = useState('none'); // 'none' | 'cliente' | 'data_emissao' | 'mes_emissao' | 'data_entrega' | 'status'
    const [collapsedGroups, setCollapsedGroups] = useState({});

    const toggleGroupCollapse = (key) => {
        setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const groupedPedidos = React.useMemo(() => {
        if (groupBy === 'none') return null;

        const groups = {};
        pedidos.forEach(p => {
            let key = '';
            let label = '';
            let sublabel = '';
            let type = groupBy;

            if (groupBy === 'cliente') {
                key = p.cliente_codigo || 'SEM_CLIENTE';
                label = p.cliente_nome || 'Cliente não identificado';
                sublabel = p.cliente_codigo ? `Cód: ${p.cliente_codigo}` : 'Sem código';
            } else if (groupBy === 'data_emissao') {
                const dateStr = p.data_emissao ? String(p.data_emissao).split('T')[0] : 'Sem Data';
                key = dateStr;
                if (dateStr !== 'Sem Data') {
                    const [y, m, d] = dateStr.split('-');
                    label = `${d}/${m}/${y}`;
                    sublabel = new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' });
                } else {
                    label = 'Emissão Não Informada';
                    sublabel = 'Sem data registrada';
                }
            } else if (groupBy === 'mes_emissao') {
                const dateStr = p.data_emissao ? String(p.data_emissao).split('T')[0] : '';
                if (dateStr && dateStr.length >= 7) {
                    key = dateStr.substring(0, 7); // 'YYYY-MM'
                    const [y, m] = key.split('-');
                    const monthName = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1).toLocaleDateString('pt-BR', { month: 'long' });
                    label = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} / ${y}`;
                    sublabel = `Competência ${m}/${y}`;
                } else {
                    key = 'Sem_Mes';
                    label = 'Mês Não Informado';
                    sublabel = 'Sem emissão registrada';
                }
            } else if (groupBy === 'data_entrega') {
                const dateStr = p.data_entrega_prevista ? String(p.data_entrega_prevista).split('T')[0] : 'Sem Data';
                key = dateStr;
                if (dateStr !== 'Sem Data') {
                    const [y, m, d] = dateStr.split('-');
                    label = `Entrega: ${d}/${m}/${y}`;
                    sublabel = new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' });
                } else {
                    label = 'Sem Prazo Definido';
                    sublabel = 'Itens sem data prevista de entrega';
                }
            } else if (groupBy === 'status') {
                key = p.status || 'orcamento';
                label = statusMeta(key).label.toUpperCase();
                sublabel = 'Situação no ERP';
            }

            if (!groups[key]) {
                groups[key] = {
                    key,
                    label,
                    sublabel,
                    type,
                    itens: [],
                    totalValor: 0,
                    totalItens: 0
                };
            }

            groups[key].itens.push(p);
            groups[key].totalValor += (parseFloat(p.valor_total) || parseFloat(p.valor_calculado) || 0);
            groups[key].totalItens += (parseInt(p.total_itens, 10) || 0);
        });

        return Object.values(groups).sort((a, b) => {
            if (groupBy === 'data_emissao' || groupBy === 'mes_emissao' || groupBy === 'data_entrega') {
                if (a.key === 'Sem Data' || a.key === 'Sem_Mes') return 1;
                if (b.key === 'Sem Data' || b.key === 'Sem_Mes') return -1;
                return b.key.localeCompare(a.key);
            }
            return a.label.localeCompare(b.label);
        });
    }, [pedidos, groupBy]);

    // Modal Novo Pedido
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [createErrors, setCreateErrors] = useState([]);
    const [saveLoading, setSaveLoading] = useState(false);
    const [proximoNumeroPedido, setProximoNumeroPedido] = useState('');

    // Autocomplete & Modal de Clientes (F3 SA1)
    const [clientSearch, setClientSearch] = useState('');
    const [clientOptions, setClientOptions] = useState([]);
    const [selectedClient, setSelectedClient] = useState(null);
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [clientModalSearch, setClientModalSearch] = useState('');
    const [clientModalList, setClientModalList] = useState([]);
    const [clientModalLoading, setClientModalLoading] = useState(false);

    // Form Header
    const [cabecalho, setCabecalho] = useState({
        numero_pedido: '',
        cliente_codigo: '',
        data_emissao: new Date().toISOString().split('T')[0],
        condicao_pagamento: '30 DDL',
        tipo_frete: 'FOB',
        transportadora: '',
        observacoes: ''
    });

    // Form Items Grid
    const [itens, setItens] = useState([
        { produto_codigo: '', produto_descricao: '', quantidade: 1, preco_unitario: 0, data_entrega_prevista: '' }
    ]);

    // Autocomplete & Modal de Produtos com Múltiplos Filtros (F3 SB1)
    const [activeProductRow, setActiveProductRow] = useState(null);
    const [productOptions, setProductOptions] = useState([]);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [productTargetRow, setProductTargetRow] = useState(null);
    const [productFilterText, setProductFilterText] = useState('');
    const [productFilterTipo, setProductFilterTipo] = useState('');
    const [productFilterGrupo, setProductFilterGrupo] = useState('');
    const [productFilterUnidade, setProductFilterUnidade] = useState('');
    const [productFilterArmazem, setProductFilterArmazem] = useState('');
    const [productFilterComPreco, setProductFilterComPreco] = useState(false);
    const [productFilterModoBusca, setProductFilterModoBusca] = useState('contem');
    const [productFilterOrdenar, setProductFilterOrdenar] = useState('codigo_asc');
    const [productModalPage, setProductModalPage] = useState(1);
    const [productModalLimit, setProductModalLimit] = useState(50);
    const [productModalTotal, setProductModalTotal] = useState(0);
    const [productModalPages, setProductModalPages] = useState(1);
    const [availableGrupos, setAvailableGrupos] = useState([]);
    const [productModalList, setProductModalList] = useState([]);
    const [productModalLoading, setProductModalLoading] = useState(false);

    // Modal Detalhes e Edição de Itens
    const [viewOrderModal, setViewOrderModal] = useState(null);
    const [editingItemId, setEditingItemId] = useState(null);
    const [editFormData, setEditFormData] = useState({ quantidade: '', preco_unitario: '', data_entrega_prevista: '', observacao: '' });
    const [savingItem, setSavingItem] = useState(false);
    const [itemActionMsg, setItemActionMsg] = useState(null);
    const [clientLogos, setClientLogos] = useState({});
    const [editingHeader, setEditingHeader] = useState(false);
    const [headerForm, setHeaderForm] = useState({});
    const [savingHeader, setSavingHeader] = useState(false);
    const [obsEditItemId, setObsEditItemId] = useState(null);
    const [obsDraft, setObsDraft] = useState('');
    const [statusDialog, setStatusDialog] = useState(null);
    const [pedidoClienteDraft, setPedidoClienteDraft] = useState('');
    const [uploadingAnexos, setUploadingAnexos] = useState(false);
    const [changingStatus, setChangingStatus] = useState(false);

    const { isAdmin, isSuperAdmin } = useAuth();
    const canManageConfig = isAdmin || isSuperAdmin;

    // Relatórios e Exportação Geral
    const [isReportMenuOpen, setIsReportMenuOpen] = useState(false);
    const [exportingReport, setExportingReport] = useState(false);

    // Configurações de Pastas no Servidor (Multi-Tenant)
    const [configPasta, setConfigPasta] = useState({
        diretorio_raiz_pedidos: '',
        padrao_subpasta: '{NUMERO_PEDIDO}',
        criar_pasta_automatica: false
    });
    const [configPastaDraft, setConfigPastaDraft] = useState({
        diretorio_raiz_pedidos: '',
        padrao_subpasta: '{NUMERO_PEDIDO}',
        criar_pasta_automatica: false
    });
    const [isConfigPastaModalOpen, setIsConfigPastaModalOpen] = useState(false);
    const [savingConfigPasta, setSavingConfigPasta] = useState(false);

    // Edição rápida de pasta de pedido no modal de detalhes
    const [editingPastaServidor, setEditingPastaServidor] = useState(false);
    const [pastaServidorDraft, setPastaServidorDraft] = useState('');

    const syncPedidoInList = (numero, patch) =>
        setPedidos(prev => prev.map(p => (p.numero_pedido === numero ? { ...p, ...patch } : p)));

    const handleUploadAnexos = async (fileList) => {
        const numero = viewOrderModal?.pedido?.numero_pedido;
        const files = Array.from(fileList || []);
        if (!numero || !files.length) return;
        const form = new FormData();
        files.forEach(f => form.append('arquivos', f));
        setUploadingAnexos(true);
        try {
            const res = await api.post(`/erp/pedidos/${numero}/anexos`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
            setViewOrderModal(prev => ({ ...prev, anexos: res.data.anexos || [] }));
            setItemActionMsg({ type: 'success', text: res.data.message });
        } catch (err) {
            setItemActionMsg({ type: 'error', text: err.response?.data?.error || err.message || 'Falha ao anexar.' });
        } finally {
            setUploadingAnexos(false);
        }
    };

    const handleOpenAnexo = async (anexo) => {
        try {
            const res = await api.get(`/erp/pedidos-anexos/${anexo.id}/download?inline=1`, { responseType: 'blob' });
            const url = URL.createObjectURL(res.data);
            const win = window.open(url, '_blank', 'noopener');
            if (!win) {
                const a = document.createElement('a');
                a.href = url;
                a.download = anexo.nome_original;
                a.click();
            }
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (err) {
            setItemActionMsg({ type: 'error', text: 'Não foi possível abrir o anexo.' });
        }
    };

    const handleDeleteAnexo = async (anexo) => {
        if (!window.confirm(`Remover o anexo "${anexo.nome_original}"?`)) return;
        try {
            await api.delete(`/erp/pedidos-anexos/${anexo.id}`);
            setViewOrderModal(prev => ({ ...prev, anexos: (prev.anexos || []).filter(a => a.id !== anexo.id) }));
        } catch (err) {
            setItemActionMsg({ type: 'error', text: err.response?.data?.error || 'Falha ao remover anexo.' });
        }
    };

    const handleChangeStatus = async (status) => {
        const numero = viewOrderModal?.pedido?.numero_pedido;
        if (!numero) return;
        if (status === 'cancelado' && !window.confirm(`Cancelar o pedido ${numero}?`)) return;
        setChangingStatus(true);
        setItemActionMsg(null);
        try {
            const res = await api.put(`/erp/pedidos/${numero}/status`, {
                status,
                pedido_cliente: status === 'pedido' ? pedidoClienteDraft : undefined
            });
            const patch = { status: res.data.status, pedido_cliente: res.data.pedido_cliente };
            setViewOrderModal(prev => ({ ...prev, pedido: { ...prev.pedido, ...patch } }));
            syncPedidoInList(numero, patch);
            setItemActionMsg({ type: 'success', text: res.data.message });
            setStatusDialog(null);
        } catch (err) {
            setItemActionMsg({ type: 'error', text: err.response?.data?.error || err.message || 'Falha ao alterar status.' });
        } finally {
            setChangingStatus(false);
        }
    };

    const handleStartEditHeader = () => {
        const p = viewOrderModal?.pedido || {};
        setHeaderForm({
            data_emissao: p.data_emissao ? String(p.data_emissao).split('T')[0] : '',
            condicao_pagamento: p.condicao_pagamento || '',
            tipo_frete: p.tipo_frete || 'FOB',
            transportadora: p.transportadora || '',
            observacoes: p.observacoes || ''
        });
        setEditingHeader(true);
    };

    const handleSaveHeader = async () => {
        const numero = viewOrderModal?.pedido?.numero_pedido;
        if (!numero) return;
        setSavingHeader(true);
        setItemActionMsg(null);
        try {
            const res = await api.put(`/erp/pedidos/${numero}`, headerForm);
            const updated = res.data.pedido || headerForm;
            setViewOrderModal(prev => ({ ...prev, pedido: { ...prev.pedido, ...updated } }));
            setPedidos(prev => prev.map(p => (p.numero_pedido === numero ? { ...p, ...updated } : p)));
            setItemActionMsg({ type: 'success', text: res.data.message || 'Pedido atualizado!' });
            setEditingHeader(false);
        } catch (err) {
            setItemActionMsg({ type: 'error', text: err.response?.data?.error || err.message || 'Erro ao salvar o pedido.' });
        } finally {
            setSavingHeader(false);
        }
    };

    const handleSaveItemObs = async (itemId) => {
        const numero = viewOrderModal?.pedido?.numero_pedido;
        if (!numero) return;
        setSavingItem(true);
        try {
            const res = await api.put(`/erp/pedidos/${numero}/itens/${itemId}`, { observacao: obsDraft });
            setViewOrderModal(prev => ({
                ...prev,
                itens: prev.itens.map(it => (it.id === itemId ? { ...it, observacao: res.data.item.observacao } : it))
            }));
            setItemActionMsg({ type: 'success', text: res.data.message || 'Observação salva!' });
            setObsEditItemId(null);
        } catch (err) {
            setItemActionMsg({ type: 'error', text: err.response?.data?.error || err.message || 'Erro ao salvar observação.' });
        } finally {
            setSavingItem(false);
        }
    };

    const handleStartEditItem = (item) => {
        setItemActionMsg(null);
        setEditingItemId(item.id);
        setEditFormData({
            quantidade: toInputBR(item.quantidade),
            preco_unitario: toInputBR(item.preco_unitario),
            data_entrega_prevista: item.data_entrega_prevista ? String(item.data_entrega_prevista).split('T')[0] : '',
            observacao: item.observacao || ''
        });
    };

    const handleCancelEditItem = () => {
        setEditingItemId(null);
        setItemActionMsg(null);
    };

    const handleSaveEditItem = async (itemId) => {
        if (!viewOrderModal?.pedido?.numero_pedido) return;
        setSavingItem(true);
        setItemActionMsg(null);
        try {
            const res = await api.put(`/erp/pedidos/${viewOrderModal.pedido.numero_pedido}/itens/${itemId}`, {
                ...editFormData,
                quantidade: parseDecimalBR(editFormData.quantidade),
                preco_unitario: parseDecimalBR(editFormData.preco_unitario) || 0
            });

            // Atualizar lista de itens do modal
            const updatedItens = viewOrderModal.itens.map(it => {
                if (it.id === itemId) {
                    return {
                        ...it,
                        quantidade: res.data.item.quantidade,
                        preco_unitario: res.data.item.preco_unitario,
                        valor_total: res.data.item.valor_total,
                        subtotal: res.data.item.valor_total,
                        data_entrega_prevista: res.data.item.data_entrega_prevista,
                        observacao: res.data.item.observacao
                    };
                }
                return it;
            });

            setViewOrderModal(prev => ({
                ...prev,
                pedido: {
                    ...prev.pedido,
                    valor_total: res.data.total_pedido
                },
                itens: updatedItens
            }));

            // Atualizar também na listagem principal de pedidos
            setPedidos(prev => prev.map(p => {
                if (p.numero_pedido === viewOrderModal.pedido.numero_pedido) {
                    return { ...p, valor_total: res.data.total_pedido };
                }
                return p;
            }));

            setItemActionMsg({ type: 'success', text: 'Item atualizado com sucesso!' });
            setEditingItemId(null);
        } catch (err) {
            setItemActionMsg({ 
                type: 'error', 
                text: err.response?.data?.error || err.message || 'Erro ao salvar alterações no item.' 
            });
        } finally {
            setSavingItem(false);
        }
    };

    // Adição de produtos ao pedido existente no viewOrderModal
    const [isAddingItemOpen, setIsAddingItemOpen] = useState(false);
    const [newItemData, setNewItemData] = useState({
        produto_codigo: '',
        produto_descricao: '',
        unidade_medida: '',
        quantidade: 1,
        preco_unitario: 0,
        data_entrega_prevista: '',
        observacao: ''
    });
    const [addingItemLoading, setAddingItemLoading] = useState(false);
    const [addingItemError, setAddingItemError] = useState(null);
    const [deletingItemId, setDeletingItemId] = useState(null);

    // Sugestões de produtos para o formulário de adição rápida
    const [addItemProdSearch, setAddItemProdSearch] = useState('');
    const [addItemProdOptions, setAddItemProdOptions] = useState([]);
    const [addItemProdLoading, setAddItemProdLoading] = useState(false);

    const searchAddItemProducts = async (term) => {
        setAddItemProdSearch(term);
        if (!term || term.trim().length < 2) {
            setAddItemProdOptions([]);
            return;
        }
        setAddItemProdLoading(true);
        try {
            const res = await api.get(`/erp/produtos/lookup?q=${encodeURIComponent(term.trim())}&limit=10`);
            const list = res.data?.itens || (Array.isArray(res.data) ? res.data : []);
            setAddItemProdOptions(list);
        } catch (_) {
            setAddItemProdOptions([]);
        } finally {
            setAddItemProdLoading(false);
        }
    };

    const handleSelectAddItemProduct = (prod) => {
        setNewItemData(prev => ({
            ...prev,
            produto_codigo: prod.codigo,
            produto_descricao: prod.descricao,
            unidade_medida: prod.unidade_medida || '',
            preco_unitario: parseFloat(prod.preco_venda) || 0
        }));
        setAddItemProdSearch(`${prod.codigo} - ${prod.descricao}`);
        setAddItemProdOptions([]);
        setAddingItemError(null);
    };

    const handleOpenCatalogForAdding = () => {
        setProductTargetRow('adding');
        setIsProductModalOpen(true);
        setProductFilterText(newItemData.produto_codigo || '');
        setProductFilterTipo('');
        setProductFilterGrupo('');
        setProductFilterUnidade('');
        setProductFilterArmazem('');
        setProductFilterComPreco(false);
        setProductFilterModoBusca('contem');
        setProductFilterOrdenar('codigo_asc');
        setProductModalPage(1);
        carregarGruposProdutos();
        searchProductsModal(newItemData.produto_codigo || '', '', '', '', '', false, 'contem', 'codigo_asc', 1, productModalLimit);
    };

    const handleAddItemToOrder = async (e) => {
        e?.preventDefault?.();
        if (!viewOrderModal?.pedido?.numero_pedido) return;
        if (!newItemData.produto_codigo) {
            setAddingItemError('Selecione ou informe um código de produto.');
            return;
        }
        const qtd = parseDecimalBR(newItemData.quantidade);
        if (isNaN(qtd) || qtd <= 0) {
            setAddingItemError('Quantidade deve ser maior que zero.');
            return;
        }
        setAddingItemLoading(true);
        setAddingItemError(null);
        try {
            const res = await api.post(`/erp/pedidos/${viewOrderModal.pedido.numero_pedido}/itens`, {
                produto_codigo: newItemData.produto_codigo,
                quantidade: qtd,
                preco_unitario: parseDecimalBR(newItemData.preco_unitario) || 0,
                data_entrega_prevista: newItemData.data_entrega_prevista || (viewOrderModal.pedido.data_emissao ? String(viewOrderModal.pedido.data_emissao).split('T')[0] : ''),
                observacao: newItemData.observacao || ''
            });

            const novoItem = res.data.item;
            const updatedItens = [...(viewOrderModal.itens || []), novoItem];
            const novoTotal = res.data.total_pedido || updatedItens.reduce((acc, it) => acc + (parseFloat(it.valor_total || it.subtotal) || 0), 0);

            setViewOrderModal(prev => ({
                ...prev,
                pedido: { ...prev.pedido, valor_total: novoTotal },
                itens: updatedItens
            }));

            setPedidos(prev => prev.map(p => {
                if (p.numero_pedido === viewOrderModal.pedido.numero_pedido) {
                    return { ...p, valor_total: novoTotal, itens_count: updatedItens.length };
                }
                return p;
            }));

            setItemActionMsg({ type: 'success', text: res.data.message || 'Produto adicionado com sucesso ao pedido!' });
            setIsAddingItemOpen(false);
            setAddItemProdSearch('');
            setNewItemData({
                produto_codigo: '',
                produto_descricao: '',
                unidade_medida: '',
                quantidade: 1,
                preco_unitario: 0,
                data_entrega_prevista: '',
                observacao: ''
            });
        } catch (err) {
            setAddingItemError(err.response?.data?.error || err.message || 'Erro ao adicionar item.');
        } finally {
            setAddingItemLoading(false);
        }
    };

    const handleDeleteItemFromOrder = async (itemId) => {
        if (!viewOrderModal?.pedido?.numero_pedido) return;
        if (!window.confirm('Tem certeza que deseja remover este produto do pedido?')) return;
        setDeletingItemId(itemId);
        try {
            const res = await api.delete(`/erp/pedidos/${viewOrderModal.pedido.numero_pedido}/itens/${itemId}`);
            const updatedItens = viewOrderModal.itens.filter(i => i.id !== itemId);
            const novoTotal = res.data.total_pedido ?? updatedItens.reduce((acc, it) => acc + (parseFloat(it.valor_total || it.subtotal) || 0), 0);

            setViewOrderModal(prev => ({
                ...prev,
                pedido: { ...prev.pedido, valor_total: novoTotal },
                itens: updatedItens
            }));

            setPedidos(prev => prev.map(p => {
                if (p.numero_pedido === viewOrderModal.pedido.numero_pedido) {
                    return { ...p, valor_total: novoTotal, itens_count: updatedItens.length };
                }
                return p;
            }));

            setItemActionMsg({ type: 'success', text: res.data.message || 'Produto removido com sucesso!' });
        } catch (err) {
            setItemActionMsg({ type: 'error', text: err.response?.data?.error || err.message || 'Falha ao remover item.' });
        } finally {
            setDeletingItemId(null);
        }
    };

    // Estado e handlers para Exclusão / Cancelamento de Pedido (Soft Delete)
    const [orderToDelete, setOrderToDelete] = useState(null);
    const [deletingOrderLoading, setDeletingOrderLoading] = useState(false);

    const handleDeleteOrder = (order) => {
        setOrderToDelete(order);
    };

    const confirmDeleteOrder = async () => {
        if (!orderToDelete) return;
        setDeletingOrderLoading(true);
        try {
            const res = await api.delete(`/erp/pedidos/${orderToDelete.numero_pedido}`);
            toast.success(res.data?.message || `Pedido ${orderToDelete.numero_pedido} excluído com sucesso!`);
            setOrderToDelete(null);
            if (viewOrderModal?.pedido?.numero_pedido === orderToDelete.numero_pedido) {
                setViewOrderModal(null);
            }
            loadPedidos();
        } catch (err) {
            console.error('Erro ao excluir pedido:', err);
            toast.error(err.response?.data?.error || err.message || 'Falha ao excluir pedido.');
        } finally {
            setDeletingOrderLoading(false);
        }
    };

    const loadPedidos = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/erp/pedidos?search=${encodeURIComponent(debouncedSearch)}&status=${encodeURIComponent(statusFilter)}&limit=150`);
            const lista = res.data || [];
            setPedidos(lista);
            const codigos = [...new Set(lista.map(p => p.cliente_codigo).filter(Boolean))];
            if (codigos.length) {
                api.get(`/erp/clientes-logos?codigos=${encodeURIComponent(codigos.join(','))}`)
                    .then(r => setClientLogos(r.data || {}))
                    .catch(() => {});
            }
        } catch (err) {
            console.error('Erro ao carregar pedidos:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPedidos();
    }, [debouncedSearch, statusFilter]);

    // Próximo Número Sequencial (Protheus SC5 GetSXENum)
    const carregarProximoNumero = async () => {
        try {
            const res = await api.get('/erp/pedidos/proximo-numero');
            if (res.data?.proximoNumero) {
                setProximoNumeroPedido(res.data.proximoNumero);
                setCabecalho(prev => ({ ...prev, numero_pedido: res.data.proximoNumero }));
            }
        } catch (err) {
            console.error('Erro ao carregar próximo número sequencial:', err);
        }
    };

    // Carregar Grupos de Produtos para filtros
    const carregarGruposProdutos = async () => {
        if (availableGrupos.length > 0) return;
        try {
            const res = await api.get('/erp/produtos/grupos');
            setAvailableGrupos(res.data || []);
        } catch (err) {
            console.error('Erro ao carregar grupos de produtos:', err);
        }
    };

    const handleOpenCreateModal = () => {
        setCreateErrors([]);
        setIsCreateModalOpen(true);
        carregarProximoNumero();
        carregarGruposProdutos();
    };

    // Busca de Clientes para Autocomplete no formulário
    useEffect(() => {
        if (!clientSearch || clientSearch.length < 2) {
            setClientOptions([]);
            return;
        }
        const delay = setTimeout(async () => {
            try {
                const res = await api.get(`/erp/clientes/lookup?q=${encodeURIComponent(clientSearch)}`);
                setClientOptions(res.data || []);
            } catch (err) {}
        }, 300);
        return () => clearTimeout(delay);
    }, [clientSearch]);

    // Modal de Clientes (Consulta F3 SA1)
    const searchClientsModal = async (term = '') => {
        setClientModalLoading(true);
        try {
            const res = await api.get(`/erp/clientes/lookup?q=${encodeURIComponent(term)}`);
            setClientModalList(res.data || []);
        } catch (err) {
            console.error('Erro ao buscar clientes no catálogo:', err);
        } finally {
            setClientModalLoading(false);
        }
    };

    const handleOpenClientModal = () => {
        setIsClientModalOpen(true);
        setClientModalSearch('');
        searchClientsModal('');
    };

    const handleSelectClientFromModal = (cli) => {
        setSelectedClient(cli);
        setCabecalho(prev => ({
            ...prev,
            cliente_codigo: cli.codigo,
            condicao_pagamento: cli.condicao_pagamento_padrao || prev.condicao_pagamento || '30 DDL'
        }));
        setClientSearch(`${cli.codigo} - ${cli.razao_social}`);
        setIsClientModalOpen(false);
    };

    // Busca rápida de Produtos por Linha (Autocomplete)
    const searchProducts = async (term, rowIndex) => {
        setActiveProductRow(rowIndex);
        if (!term || term.length < 1) {
            setProductOptions([]);
            return;
        }
        try {
            const res = await api.get(`/erp/produtos/lookup?q=${encodeURIComponent(term)}`);
            setProductOptions(res.data || []);
        } catch (err) {}
    };

    // Modal de Busca Avançada de Produtos (Consulta F3 SB1) com Múltiplos Filtros
    const searchProductsModal = async (
        text = productFilterText, 
        tipo = productFilterTipo, 
        grupo = productFilterGrupo,
        unidade = productFilterUnidade,
        armazem = productFilterArmazem,
        comPreco = productFilterComPreco,
        modoBusca = productFilterModoBusca,
        ordenar = productFilterOrdenar,
        page = productModalPage,
        limit = productModalLimit
    ) => {
        setProductModalLoading(true);
        try {
            const params = new URLSearchParams();
            if (text && text.trim()) params.append('q', text.trim());
            if (tipo && tipo.trim()) params.append('tipo', tipo.trim());
            if (grupo && grupo.trim()) params.append('grupo', grupo.trim());
            if (unidade && unidade.trim()) params.append('unidade', unidade.trim());
            if (armazem && armazem.trim()) params.append('armazem', armazem.trim());
            if (comPreco) params.append('com_preco', 'true');
            if (modoBusca) params.append('modo_busca', modoBusca);
            if (ordenar) params.append('ordenar', ordenar);
            params.append('format', 'paged');
            params.append('limit', String(limit));
            params.append('offset', String((page - 1) * limit));

            const res = await api.get(`/erp/produtos/lookup?${params.toString()}`);
            if (res.data?.itens) {
                setProductModalList(res.data.itens);
                setProductModalTotal(res.data.total || 0);
                setProductModalPages(res.data.pages || 1);
            } else if (Array.isArray(res.data)) {
                setProductModalList(res.data);
                setProductModalTotal(res.data.length);
                setProductModalPages(1);
            }
        } catch (err) {
            console.error('Erro ao pesquisar produtos no catálogo:', err);
        } finally {
            setProductModalLoading(false);
        }
    };

    const handleOpenProductModal = (rowIndex) => {
        setProductTargetRow(rowIndex);
        setIsProductModalOpen(true);
        const currentItem = itens[rowIndex];
        const initialTerm = currentItem?.produto_codigo || '';
        setProductFilterText(initialTerm);
        setProductFilterTipo('');
        setProductFilterGrupo('');
        setProductFilterUnidade('');
        setProductFilterArmazem('');
        setProductFilterComPreco(false);
        setProductFilterModoBusca('contem');
        setProductFilterOrdenar('codigo_asc');
        setProductModalPage(1);
        carregarGruposProdutos();
        searchProductsModal(initialTerm, '', '', '', '', false, 'contem', 'codigo_asc', 1, productModalLimit);
    };

    const handleResetProductFilters = () => {
        setProductFilterText('');
        setProductFilterTipo('');
        setProductFilterGrupo('');
        setProductFilterUnidade('');
        setProductFilterArmazem('');
        setProductFilterComPreco(false);
        setProductFilterModoBusca('contem');
        setProductFilterOrdenar('codigo_asc');
        setProductModalPage(1);
        searchProductsModal('', '', '', '', '', false, 'contem', 'codigo_asc', 1, productModalLimit);
    };

    const handlePageChange = (newPage) => {
        if (newPage < 1 || newPage > productModalPages) return;
        setProductModalPage(newPage);
        searchProductsModal(
            productFilterText,
            productFilterTipo,
            productFilterGrupo,
            productFilterUnidade,
            productFilterArmazem,
            productFilterComPreco,
            productFilterModoBusca,
            productFilterOrdenar,
            newPage,
            productModalLimit
        );
    };

    const applyProductToItem = (item, prod) => ({
        ...item,
        produto_codigo: prod.codigo,
        produto_descricao: prod.descricao,
        preco_unitario: parseFloat(prod.preco_venda) || 0,
        desenho_url: prod.desenho_url || null,
        desenho_nome: prod.desenho_nome || null
    });

    const handleSelectProductFromModal = (prod) => {
        if (productTargetRow === 'adding') {
            setNewItemData(prev => ({
                ...prev,
                produto_codigo: prod.codigo,
                produto_descricao: prod.descricao,
                unidade_medida: prod.unidade_medida || '',
                preco_unitario: parseFloat(prod.preco_venda) || 0
            }));
            setAddItemProdSearch(`${prod.codigo} - ${prod.descricao}`);
            setIsProductModalOpen(false);
            setProductTargetRow(null);
            setAddingItemError(null);
            return;
        }
        if (productTargetRow === null) return;
        const newItens = [...itens];
        newItens[productTargetRow] = applyProductToItem(newItens[productTargetRow], prod);
        setItens(newItens);
        setIsProductModalOpen(false);
        setProductTargetRow(null);
    };

    const handleSelectClient = (cli) => {
        setSelectedClient(cli);
        setCabecalho(prev => ({
            ...prev,
            cliente_codigo: cli.codigo,
            condicao_pagamento: cli.condicao_pagamento_padrao || prev.condicao_pagamento || '30 DDL'
        }));
        setClientSearch(`${cli.codigo} - ${cli.razao_social}`);
        setClientOptions([]);
    };

    const handleSelectProduct = (prod, rowIndex) => {
        const newItens = [...itens];
        newItens[rowIndex] = applyProductToItem(newItens[rowIndex], prod);
        setItens(newItens);
        setActiveProductRow(null);
        setProductOptions([]);
    };

    const addItemRow = () => {
        setItens([
            ...itens,
            { produto_codigo: '', produto_descricao: '', quantidade: 1, preco_unitario: 0, data_entrega_prevista: cabecalho.data_emissao, observacao: '' }
        ]);
    };

    // Copies the line right below the original (same product, qty, price, date, notes)
    const duplicateItemRow = (index) => {
        const copy = { ...itens[index] };
        setItens([...itens.slice(0, index + 1), copy, ...itens.slice(index + 1)]);
    };

    const toggleItemObs = (index) => {
        const newItens = [...itens];
        newItens[index] = { ...newItens[index], showObs: !newItens[index].showObs };
        setItens(newItens);
    };

    const removeItemRow = (index) => {
        if (itens.length === 1) return;
        setItens(itens.filter((_, idx) => idx !== index));
    };

    const updateItemField = (index, field, value) => {
        const newItens = [...itens];
        newItens[index] = { ...newItens[index], [field]: value };
        setItens(newItens);
    };

    const totalPedido = itens.reduce((acc, it) => acc + ((parseDecimalBR(it.quantidade) || 0) * (parseDecimalBR(it.preco_unitario) || 0)), 0);

    const handleSalvarPedido = async (e) => {
        e.preventDefault();
        setSaveLoading(true);
        setCreateErrors([]);

        try {
            const res = await api.post('/erp/pedidos', {
                cabecalho,
                itens: itens.map(({ showObs, ...it }) => ({
                    ...it,
                    quantidade: parseDecimalBR(it.quantidade),
                    preco_unitario: parseDecimalBR(it.preco_unitario) || 0
                }))
            });

            setIsCreateModalOpen(false);
            setCabecalho({
                cliente_codigo: '',
                data_emissao: new Date().toISOString().split('T')[0],
                condicao_pagamento: '30 DDL',
                tipo_frete: 'FOB',
                transportadora: '',
                observacoes: ''
            });
            setItens([{ produto_codigo: '', produto_descricao: '', quantidade: 1, preco_unitario: 0, data_entrega_prevista: '' }]);
            setSelectedClient(null);
            setClientSearch('');
            loadPedidos();
        } catch (err) {
            const responseErrors = err.response?.data?.erros;
            if (responseErrors && Array.isArray(responseErrors)) {
                setCreateErrors(responseErrors);
            } else {
                setCreateErrors([err.response?.data?.error || err.message]);
            }
        } finally {
            setSaveLoading(false);
        }
    };

    const loadConfigPasta = async () => {
        try {
            const res = await api.get('/erp/pedidos/config-pasta');
            if (res.data) {
                setConfigPasta(res.data);
                setConfigPastaDraft(res.data);
            }
        } catch (err) {
            console.error('Erro ao carregar configuração de pasta:', err);
        }
    };

    useEffect(() => {
        loadConfigPasta();
    }, []);

    const handleSaveConfigPasta = async () => {
        setSavingConfigPasta(true);
        try {
            const res = await api.put('/erp/pedidos/config-pasta', configPastaDraft);
            setConfigPasta(res.data.config || configPastaDraft);
            setIsConfigPastaModalOpen(false);
            toast.success(res.data.message || 'Configurações de pasta salvas com sucesso!');
        } catch (err) {
            toast.error('Erro ao salvar configuração de pasta: ' + (err.response?.data?.error || err.message));
        } finally {
            setSavingConfigPasta(false);
        }
    };

    const handleAbrirPasta = async (numeroPedido, pasta) => {
        let caminho = (pasta || '').trim();
        if (!caminho && configPasta?.diretorio_raiz_pedidos) {
            const sep = configPasta.diretorio_raiz_pedidos.includes('/') ? '/' : '\\';
            const base = configPasta.diretorio_raiz_pedidos.replace(/[/\\]+$/, '');
            caminho = `${base}${sep}${numeroPedido}`;
        }
        if (!caminho) {
            toast.warning(`Pasta do pedido ${numeroPedido} não configurada. Defina o diretório no ícone ⚙️.`);
            return;
        }

        try {
            await navigator.clipboard.writeText(caminho);
        } catch (_) {}

        // Dispara protocolo registrado no Windows para abertura direta no Explorer
        window.location.href = `sinco-folder://${encodeURIComponent(caminho)}`;

        // Aciona backend se o servidor estiver na mesma máquina/rede
        try {
            await api.post('/erp/pedidos/abrir-pasta', { caminho, criarSeNaoExistir: true });
            toast.success(`Abrindo pasta no Explorer: ${caminho}`);
        } catch (e) {
            toast.info(`Caminho copiado para o Explorer: ${caminho}`);
        }
    };

    const handleSavePastaPedido = async () => {
        const numero = viewOrderModal?.pedido?.numero_pedido;
        if (!numero) return;
        try {
            await api.put(`/erp/pedidos/${numero}`, { pasta_servidor: pastaServidorDraft });
            setViewOrderModal(prev => ({
                ...prev,
                pedido: { ...prev.pedido, pasta_servidor: pastaServidorDraft }
            }));
            syncPedidoInList(numero, { pasta_servidor: pastaServidorDraft });
            setEditingPastaServidor(false);
            toast.success('Pasta do pedido atualizada com sucesso!');
        } catch (err) {
            toast.error('Erro ao salvar pasta do pedido: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleExportSingle = async (pedido, formato, options = {}) => {
        if (!pedido?.numero_pedido) return;
        setExportingReport(true);
        toast.info(`Gerando ${formato.toUpperCase()} do pedido ${pedido.numero_pedido}...`);
        try {
            let pedidoCompleto = pedido;
            let itensPedido = [];
            let anexosPedido = [];

            if (viewOrderModal && viewOrderModal.pedido?.numero_pedido === pedido.numero_pedido) {
                pedidoCompleto = viewOrderModal.pedido;
                itensPedido = viewOrderModal.itens || [];
                anexosPedido = viewOrderModal.anexos || [];
            } else {
                const res = await api.get(`/erp/pedidos/${pedido.numero_pedido}`);
                pedidoCompleto = res.data.pedido || pedido;
                itensPedido = res.data.itens || [];
                anexosPedido = res.data.anexos || [];
            }

            if (formato === 'pdf') {
                await generateSingleOrderPdf(pedidoCompleto, itensPedido, {
                    ...options,
                    anexos: anexosPedido
                });
                toast.success(`PDF do pedido ${pedido.numero_pedido} gerado com sucesso!`);
            } else if (formato === 'excel') {
                await generateSingleOrderExcel(pedidoCompleto, itensPedido, options);
                toast.success(`Excel do pedido ${pedido.numero_pedido} gerado com sucesso!`);
            }
        } catch (err) {
            console.error('Erro ao gerar relatório individual:', err);
            toast.error('Erro ao gerar relatório: ' + (err.message || 'Falha no processamento'));
        } finally {
            setExportingReport(false);
        }
    };

    const handleExportAll = async (formato, tipo = 'detalhado') => {
        setExportingReport(true);
        setIsReportMenuOpen(false);
        const lista = pedidos || [];
        if (lista.length === 0) {
            toast.warning('Nenhum pedido listado para exportação.');
            setExportingReport(false);
            return;
        }

        toast.info(`Gerando relatório geral em ${formato.toUpperCase()} (${tipo})...`);
        try {
            if (formato === 'pdf') {
                await generateAllOrdersPdf(lista, { tipo });
                toast.success('Relatório geral em PDF gerado com sucesso!');
            } else if (formato === 'excel') {
                let itensRelatorio = [];
                if (tipo === 'detalhado') {
                    const numeros = lista.map(p => p.numero_pedido).join(',');
                    const res = await api.get(`/erp/pedidos-itens-relatorio?numeros=${encodeURIComponent(numeros)}`);
                    itensRelatorio = res.data || [];
                }
                await generateAllOrdersExcel(lista, { tipo }, itensRelatorio);
                toast.success(`Relatório geral em Excel (${tipo}) gerado com sucesso!`);
            }
        } catch (err) {
            console.error('Erro ao gerar relatório geral:', err);
            toast.error('Erro ao gerar relatório: ' + (err.message || 'Falha'));
        } finally {
            setExportingReport(false);
        }
    };

    const handleViewOrder = async (numeroPedido) => {
        setEditingItemId(null);
        setItemActionMsg(null);
        setEditingHeader(false);
        setObsEditItemId(null);
        setEditingPastaServidor(false);
        try {
            const res = await api.get(`/erp/pedidos/${numeroPedido}`);
            setViewOrderModal(res.data);
            setPastaServidorDraft(res.data?.pedido?.pasta_servidor || '');
        } catch (err) {
            alert('Erro ao carregar detalhes do pedido: ' + (err.response?.data?.error || err.message));
        }
    };

    return (
        <div className="space-y-4 p-2 md:p-4 font-sans text-gray-900">
            {/* Header Container */}
            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-600">
                        <ShoppingCart className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">Pedidos de Venda (MATA410)</h1>
                            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                ERP Nativo
                            </span>
                        </div>
                        <p className="text-xs md:text-sm text-gray-500 mt-0.5">
                            Emissão de pedidos com validação de linha (LineOk), cabeçalho e transações ACID.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Botão Dropdown Relatórios Gerais */}
                    <div className="relative">
                        <Button
                            onClick={() => setIsReportMenuOpen(prev => !prev)}
                            variant="light"
                            size="md"
                            icon={Download}
                            disabled={exportingReport}
                            className="border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center gap-1.5"
                        >
                            <span>Relatórios</span>
                            <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                        </Button>

                        {isReportMenuOpen && (
                            <>
                                <div 
                                    className="fixed inset-0 z-30" 
                                    onClick={() => setIsReportMenuOpen(false)} 
                                />
                                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 z-40 text-xs animate-fadeIn">
                                    <div className="px-3 py-1.5 font-bold text-gray-500 uppercase tracking-wider text-[10px] border-b border-gray-100">
                                        Exportar Todos ({pedidos.length} pedidos)
                                    </div>
                                    <button
                                        onClick={() => handleExportAll('pdf', 'resumido')}
                                        className="w-full text-left px-3 py-2 hover:bg-blue-50 text-gray-700 hover:text-blue-700 flex items-center gap-2.5 transition cursor-pointer"
                                    >
                                        <FileText className="w-4 h-4 text-red-600 shrink-0" />
                                        <div>
                                            <div className="font-semibold">PDF Geral (Resumido)</div>
                                            <div className="text-[11px] text-gray-400">Lista sintética dos pedidos</div>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => handleExportAll('pdf', 'detalhado')}
                                        className="w-full text-left px-3 py-2 hover:bg-blue-50 text-gray-700 hover:text-blue-700 flex items-center gap-2.5 transition cursor-pointer"
                                    >
                                        <Printer className="w-4 h-4 text-red-700 shrink-0" />
                                        <div>
                                            <div className="font-semibold">PDF Geral (Detalhado)</div>
                                            <div className="text-[11px] text-gray-400">Cabeçalho com totais e resumo</div>
                                        </div>
                                    </button>
                                    <div className="my-1 border-t border-gray-100" />
                                    <button
                                        onClick={() => handleExportAll('excel', 'resumido')}
                                        className="w-full text-left px-3 py-2 hover:bg-emerald-50 text-gray-700 hover:text-emerald-700 flex items-center gap-2.5 transition cursor-pointer"
                                    >
                                        <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                                        <div>
                                            <div className="font-semibold">Excel Geral (Resumido)</div>
                                            <div className="text-[11px] text-gray-400">1 linha por pedido com soma</div>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => handleExportAll('excel', 'detalhado')}
                                        className="w-full text-left px-3 py-2 hover:bg-emerald-50 text-gray-700 hover:text-emerald-700 flex items-center gap-2.5 transition cursor-pointer"
                                    >
                                        <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0" />
                                        <div>
                                            <div className="font-semibold">Excel Analítico Flat</div>
                                            <div className="text-[11px] text-gray-400">1 linha por item (ideal p/ BI)</div>
                                        </div>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Botão de Configuração de Pastas (Admin) */}
                    {canManageConfig && (
                        <IconButton
                            onClick={() => {
                                setConfigPastaDraft(configPasta);
                                setIsConfigPastaModalOpen(true);
                            }}
                            icon={Settings}
                            title="Configurar pasta de pedidos no servidor (Admin)"
                            variant="light"
                            size="md"
                            className="border border-gray-300 text-gray-600 hover:text-gray-900"
                        />
                    )}

                    <Button
                        onClick={handleOpenCreateModal}
                        variant="primary"
                        size="md"
                        icon={Plus}
                    >
                        Digitar Novo Pedido
                    </Button>
                    <IconButton
                        onClick={loadPedidos}
                        disabled={loading}
                        icon={RefreshCw}
                        title="Atualizar lista de pedidos"
                        variant="light"
                        size="md"
                        loading={loading}
                    />
                </div>
            </div>

            {/* Quick Stats Cards — reflect search/status filters and expanded groups */}
            {(() => {
                const visiveis = groupBy === 'none'
                    ? pedidos
                    : groupedPedidos.filter(g => !collapsedGroups[g.key]).flatMap(g => g.itens);
                const valorDe = (p) => parseFloat(p.valor_total) || parseFloat(p.valor_calculado) || 0;
                const resumo = (lista) => ({ qtd: lista.length, valor: lista.reduce((acc, p) => acc + valorDe(p), 0) });
                const cards = [
                    { key: '', label: 'Total', icon: ShoppingCart, tone: 'blue', ...resumo(visiveis) },
                    { key: 'orcamento', label: 'Orçamentos', icon: Clock, tone: 'amber', ...resumo(visiveis.filter(p => (p.status || 'orcamento') === 'orcamento')) },
                    { key: 'pedido', label: 'Pedidos', icon: CheckCircle2, tone: 'emerald', ...resumo(visiveis.filter(p => p.status === 'pedido')) },
                    { key: 'cancelado', label: 'Cancelados', icon: X, tone: 'red', ...resumo(visiveis.filter(p => p.status === 'cancelado')) }
                ];
                const tones = {
                    blue: 'bg-blue-50 text-blue-600 ring-blue-400',
                    amber: 'bg-amber-50 text-amber-600 ring-amber-400',
                    emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-400',
                    red: 'bg-red-50 text-red-600 ring-red-400'
                };
                const hidden = pedidos.length - visiveis.length;
                return (
                    <div className="space-y-1">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {cards.map(c => {
                                const Icon = c.icon;
                                const active = statusFilter === c.key;
                                const [bg, text, ring] = tones[c.tone].split(' ');
                                return (
                                    <button
                                        key={c.label}
                                        type="button"
                                        onClick={() => setStatusFilter(active && c.key ? '' : c.key)}
                                        className={`text-left bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center gap-3 transition hover:shadow-md cursor-pointer ${active ? `ring-2 ${ring}` : ''}`}
                                        title={c.key ? `Filtrar por ${c.label}` : 'Mostrar todos os status'}
                                    >
                                        <div className={`p-2.5 rounded-lg ${bg} ${text}`}>
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{c.label}</span>
                                            <div className="flex items-baseline gap-2 mt-0.5">
                                                <span className={`text-xl font-bold ${c.key ? text : 'text-gray-900'}`}>{c.qtd.toLocaleString('pt-BR')}</span>
                                                <span className="text-sm font-mono font-semibold text-gray-700 truncate">
                                                    R$ {c.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        {hidden > 0 && (
                            <p className="text-[11px] text-gray-500 px-1">
                                Totais consideram apenas os grupos expandidos ({hidden} pedido(s) em grupos recolhidos não somados).
                            </p>
                        )}
                    </div>
                );
            })()}

            {/* Search, Filter & Quick Grouping Toolbar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-3">
                {/* Linha 1: Campo de Busca e Filtro de Status */}
                <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                    <div className="relative flex-1 w-full">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Buscar por número de pedido, razão social ou nome fantasia..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white border border-gray-300 rounded-lg pl-10 pr-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div className="flex items-center gap-2.5 w-full sm:w-auto">
                        {/* Filtro por Status */}
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shrink-0 shadow-2xs cursor-pointer"
                        >
                            <option value="">Todos os Status</option>
                            <option value="orcamento">Orçamentos</option>
                            <option value="pedido">Pedidos</option>
                            <option value="cancelado">Cancelados</option>
                        </select>
                    </div>
                </div>

                {/* Linha 2: Barra de Chips Rápidos de Agrupamento */}
                <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mr-1">
                            <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                            Agrupar por:
                        </span>

                        <button
                            type="button"
                            onClick={() => setGroupBy('none')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                groupBy === 'none'
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
                            }`}
                        >
                            <span>📋</span> Sem Agrupamento
                        </button>

                        <button
                            type="button"
                            onClick={() => setGroupBy('cliente')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                groupBy === 'cliente'
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
                            }`}
                        >
                            <Building2 className="w-3.5 h-3.5" />
                            Por Cliente
                        </button>

                        <button
                            type="button"
                            onClick={() => setGroupBy('data_emissao')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                groupBy === 'data_emissao'
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
                            }`}
                        >
                            <Calendar className="w-3.5 h-3.5" />
                            Por Emissão (Dia)
                        </button>

                        <button
                            type="button"
                            onClick={() => setGroupBy('mes_emissao')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                groupBy === 'mes_emissao'
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
                            }`}
                        >
                            <Calendar className="w-3.5 h-3.5" />
                            Por Mês de Emissão
                        </button>

                        <button
                            type="button"
                            onClick={() => setGroupBy('data_entrega')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                groupBy === 'data_entrega'
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
                            }`}
                        >
                            <Truck className="w-3.5 h-3.5" />
                            Por Prazo de Entrega
                        </button>

                        <button
                            type="button"
                            onClick={() => setGroupBy('status')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                groupBy === 'status'
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
                            }`}
                        >
                            <Tag className="w-3.5 h-3.5" />
                            Por Status
                        </button>
                    </div>

                    {groupBy !== 'none' && groupedPedidos && (
                        <div className="flex items-center gap-2 text-xs font-semibold">
                            <button
                                type="button"
                                onClick={() => setCollapsedGroups({})}
                                className="text-blue-600 hover:text-blue-800 transition cursor-pointer"
                            >
                                Expandir Todos
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                                type="button"
                                onClick={() => {
                                    const all = {};
                                    groupedPedidos.forEach(g => { all[g.key] = true; });
                                    setCollapsedGroups(all);
                                }}
                                className="text-blue-600 hover:text-blue-800 transition cursor-pointer"
                            >
                                Recolher Todos
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Orders Container: Agrupado ou Tabela Padrão */}
            {loading ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">
                    <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-2 text-blue-600" />
                    Carregando pedidos de venda do ERP...
                </div>
            ) : pedidos.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">
                    Nenhum pedido de venda encontrado com os filtros atuais.
                </div>
            ) : groupBy !== 'none' && groupedPedidos ? (
                /* VISÃO AGRUPADA POR CLIENTE / DATA / STATUS / PRAZO */
                <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs text-gray-500 px-1">
                        <span>
                            Exibindo <strong className="text-gray-900 font-bold">{groupedPedidos.length}</strong> grupos de pedidos
                        </span>
                        <span className="font-mono text-gray-500">
                            Total Geral: <strong>{pedidos.length}</strong> pedidos
                        </span>
                    </div>

                    {groupedPedidos.map((group) => {
                        const isCollapsed = !!collapsedGroups[group.key];
                        return (
                            <div key={group.key} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                {/* Cabeçalho do Grupo */}
                                <div 
                                    onClick={() => toggleGroupCollapse(group.key)}
                                    className="p-3.5 bg-slate-50 hover:bg-slate-100/80 border-b border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer transition select-none"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-1 text-gray-500 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}>
                                            <ChevronDown className="w-5 h-5" />
                                        </div>
                                        {group.type === 'cliente' ? (
                                            <ClientAvatar logo={clientLogos[group.key]} name={group.label} size="w-9 h-9" />
                                        ) : (
                                        <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                                            {group.type === 'data_emissao' ? <Calendar className="w-4 h-4" /> :
                                             group.type === 'mes_emissao' ? <Calendar className="w-4 h-4" /> :
                                             group.type === 'data_entrega' ? <Truck className="w-4 h-4" /> :
                                             <Tag className="w-4 h-4" />}
                                        </div>
                                        )}
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-gray-900 text-sm">{group.label}</h3>
                                                {group.sublabel && (
                                                    <span className="text-xs text-gray-500 font-mono bg-white px-2 py-0.5 rounded border border-gray-200">
                                                        {group.sublabel}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Métricas do Grupo */}
                                    <div className="flex items-center gap-4 text-xs ml-10 sm:ml-0">
                                        <span className="px-2.5 py-1 rounded-full font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                            {group.itens.length} {group.itens.length === 1 ? 'pedido' : 'pedidos'}
                                        </span>
                                        <span className="text-gray-500 font-mono">
                                            {group.totalItens} itens
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-gray-500 uppercase text-[10px] font-bold">Total Grupo:</span>
                                            <span className="font-mono font-bold text-blue-700 text-sm">
                                                R$ {group.totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Tabela de Pedidos do Grupo */}
                                {!isCollapsed && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-gray-50/70 border-b border-gray-200 text-xs font-semibold uppercase tracking-wider text-gray-500">
                                                <tr>
                                                    <th className="py-2.5 px-4">Nº Pedido</th>
                                                    {group.type !== 'cliente' && <th className="py-2.5 px-4">Cliente</th>}
                                                    {group.type !== 'data_emissao' && group.type !== 'mes_emissao' && <th className="py-2.5 px-4">Emissão</th>}
                                                    {group.type !== 'data_entrega' && <th className="py-2.5 px-4">Prazo de Entrega</th>}
                                                    <th className="py-2.5 px-4 text-center">Itens</th>
                                                    <th className="py-2.5 px-4 text-right">Valor Total</th>
                                                    <th className="py-2.5 px-4">Cond. Pagto</th>
                                                    <th className="py-2.5 px-4">Status</th>
                                                    <th className="py-2.5 px-4 text-right min-w-[140px]">Ações</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {group.itens.map((p) => (
                                                    <tr 
                                                        key={p.id} 
                                                        onClick={() => handleViewOrder(p.numero_pedido)}
                                                        className="hover:bg-blue-50/40 transition cursor-pointer group"
                                                    >
                                                        <td className="py-3 px-4 font-mono font-bold text-blue-700 group-hover:underline">
                                                            {p.numero_pedido}
                                                        </td>
                                                        {group.type !== 'cliente' && (
                                                            <td className="py-3 px-4">
                                                                <div className="flex items-center gap-2.5">
                                                                    <ClientAvatar logo={clientLogos[p.cliente_codigo]} name={p.cliente_nome} />
                                                                    <div>
                                                                        <div className="font-semibold text-gray-900 text-xs">{p.cliente_nome || 'Cliente não identificado'}</div>
                                                                        <div className="text-[11px] text-gray-500 font-mono">Cód: {p.cliente_codigo}</div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        )}
                                                        {group.type !== 'data_emissao' && group.type !== 'mes_emissao' && (
                                                            <td className="py-3 px-4 text-gray-600 text-xs font-mono">
                                                                {p.data_emissao ? String(p.data_emissao).split('T')[0] : '-'}
                                                            </td>
                                                        )}
                                                        {group.type !== 'data_entrega' && (
                                                            <td className="py-3 px-4 text-gray-600 text-xs font-mono">
                                                                {p.data_entrega_prevista ? (
                                                                    <span className="inline-flex items-center gap-1 text-slate-700">
                                                                        <Truck className="w-3 h-3 text-slate-400" />
                                                                        {String(p.data_entrega_prevista).split('T')[0]}
                                                                    </span>
                                                                ) : '-'}
                                                            </td>
                                                        )}
                                                        <td className="py-3 px-4 text-center font-mono text-gray-700 text-xs">
                                                            {p.total_itens || 0}
                                                        </td>
                                                        <td className="py-3 px-4 text-right font-mono font-bold text-gray-900">
                                                            R$ {(parseFloat(p.valor_total) || parseFloat(p.valor_calculado) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="py-3 px-4 font-mono text-xs text-gray-500">
                                                            {p.condicao_pagamento || '-'}
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <StatusBadge status={p.status} />
                                                        </td>
                                                        <td className="py-3 px-4 text-right">
                                                            <div className="flex items-center justify-end gap-1">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleAbrirPasta(p.numero_pedido, p.pasta_servidor);
                                                                    }}
                                                                    className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                                                                    title={p.pasta_servidor ? `Abrir pasta no Explorer: ${p.pasta_servidor}` : `Abrir pasta do pedido ${p.numero_pedido}`}
                                                                >
                                                                    <Folder className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleExportSingle(p, 'pdf');
                                                                    }}
                                                                    className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                                                    title="Exportar Pedido em PDF"
                                                                >
                                                                    <FileText className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleExportSingle(p, 'excel');
                                                                    }}
                                                                    className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                                                                    title="Exportar Pedido em Excel (.xlsx)"
                                                                >
                                                                    <FileSpreadsheet className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleViewOrder(p.numero_pedido);
                                                                    }}
                                                                    className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                                                    title="Ver e Editar Itens do Pedido"
                                                                >
                                                                    <Eye className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDeleteOrder(p);
                                                                    }}
                                                                    className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                                                    title="Excluir / Cancelar Pedido"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* TABELA PADRÃO LINEAR */
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold uppercase tracking-wider text-gray-600">
                                <tr>
                                    <th className="py-3 px-4">Nº Pedido</th>
                                    <th className="py-3 px-4">Cliente / Razão Social</th>
                                    <th className="py-3 px-4">Emissão</th>
                                    <th className="py-3 px-4">Prazo de Entrega</th>
                                    <th className="py-3 px-4 text-center">Itens</th>
                                    <th className="py-3 px-4 text-right">Valor Total</th>
                                    <th className="py-3 px-4">Cond. Pagto</th>
                                    <th className="py-3 px-4">Status</th>
                                    <th className="py-3 px-4 text-right min-w-[140px]">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {pedidos.map((p) => (
                                    <tr 
                                        key={p.id} 
                                        onClick={() => handleViewOrder(p.numero_pedido)}
                                        className="hover:bg-blue-50/40 transition cursor-pointer group"
                                    >
                                        <td className="py-3.5 px-4 font-mono font-bold text-blue-700 group-hover:underline">
                                            {p.numero_pedido}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <div className="flex items-center gap-3">
                                                <ClientAvatar logo={clientLogos[p.cliente_codigo]} name={p.cliente_nome} size="w-9 h-9" />
                                                <div>
                                                    <div className="font-semibold text-gray-900">{p.cliente_nome || 'Cliente não identificado'}</div>
                                                    <div className="text-xs text-gray-500 font-mono">Cód: {p.cliente_codigo}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-4 text-gray-600 text-xs font-mono">
                                            {p.data_emissao ? String(p.data_emissao).split('T')[0] : '-'}
                                        </td>
                                        <td className="py-3.5 px-4 text-gray-600 text-xs font-mono">
                                            {p.data_entrega_prevista ? (
                                                <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                                                    <Truck className="w-3.5 h-3.5 text-slate-400" />
                                                    {String(p.data_entrega_prevista).split('T')[0]}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-4 text-center font-mono text-gray-700">
                                            {p.total_itens || 0}
                                        </td>
                                        <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-900">
                                            R$ {(parseFloat(p.valor_total) || parseFloat(p.valor_calculado) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-3.5 px-4 font-mono text-xs text-gray-500">
                                            {p.condicao_pagamento || '-'}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <StatusBadge status={p.status} size="text-xs" />
                                            {p.pedido_cliente && (
                                                <div className="text-[10px] text-gray-500 font-mono mt-0.5">PC: {p.pedido_cliente}</div>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-4 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleAbrirPasta(p.numero_pedido, p.pasta_servidor);
                                                    }}
                                                    className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                                                    title={p.pasta_servidor ? `Abrir pasta no Explorer: ${p.pasta_servidor}` : `Abrir pasta do pedido ${p.numero_pedido}`}
                                                >
                                                    <Folder className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleExportSingle(p, 'pdf');
                                                    }}
                                                    className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                                    title="Exportar Pedido em PDF"
                                                >
                                                    <FileText className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleExportSingle(p, 'excel');
                                                    }}
                                                    className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                                                    title="Exportar Pedido em Excel (.xlsx)"
                                                >
                                                    <FileSpreadsheet className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleViewOrder(p.numero_pedido);
                                                    }}
                                                    className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                                    title="Ver e Editar Itens do Pedido"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteOrder(p);
                                                    }}
                                                    className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                                    title="Excluir / Cancelar Pedido"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* MODAL DE CRIAÇÃO DE PEDIDO (MATA410 - LineOk & AllOk) */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-3 overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-[98vw] overflow-hidden my-2 animate-fadeIn">
                        {/* Header do Modal */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
                                    <ShoppingCart className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-base font-bold text-gray-900">Digitação de Pedido de Venda (MATA410)</h2>
                                        {(cabecalho.numero_pedido || proximoNumeroPedido) && (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                                Nº Pedido: {cabecalho.numero_pedido || proximoNumeroPedido}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500">Mecanismo sequencial Protheus SC5 (GetSXENum) e validação LineOk / AllOk</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Corpo do Formulário */}
                        <form onSubmit={handleSalvarPedido} className="p-5 sm:p-6 space-y-5">
                            {/* Banner de Erros de Validação Protheus */}
                            {createErrors.length > 0 && (
                                <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-1">
                                    <div className="flex items-center gap-2 text-xs font-bold text-red-700 uppercase tracking-wider">
                                        <AlertCircle className="w-4 h-4" />
                                        O pedido não passou nas validações de integridade:
                                    </div>
                                    <ul className="list-disc list-inside text-xs text-red-600 space-y-0.5">
                                        {createErrors.map((err, idx) => (
                                            <li key={idx}>{err}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* SEÇÃO 1: CABEÇALHO DO PEDIDO */}
                            <div className="bg-gray-50/80 p-4 rounded-xl border border-gray-200 space-y-3">
                                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5 text-blue-600" />
                                    Dados do Cabeçalho (Cliente & Faturamento)
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {/* Seleção de Cliente da Tabela de Clientes */}
                                    <div className="md:col-span-2">
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="block text-xs font-semibold text-gray-600">
                                                Cliente da Tabela de Clientes *
                                            </label>
                                            <button
                                                type="button"
                                                onClick={handleOpenClientModal}
                                                className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                                            >
                                                <Search className="w-3 h-3" />
                                                Consulta Padrão de Clientes (F3)
                                            </button>
                                        </div>

                                        {selectedClient ? (
                                            <div className="p-2.5 bg-blue-50/90 border border-blue-200 rounded-lg flex items-center justify-between">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className="p-1.5 bg-blue-600 text-white rounded-md shrink-0">
                                                        <Building2 className="w-4 h-4" />
                                                    </div>
                                                    <div className="truncate">
                                                        <div className="font-bold text-gray-900 text-sm truncate">
                                                            {selectedClient.razao_social}
                                                        </div>
                                                        <div className="text-xs text-gray-600 font-mono flex items-center gap-2 truncate">
                                                            <span>Cód: <strong className="text-blue-700">{selectedClient.codigo}</strong></span>
                                                            {selectedClient.cnpj_cpf && <span>• CNPJ: {selectedClient.cnpj_cpf}</span>}
                                                            {selectedClient.cidade && <span>• {selectedClient.cidade}/{selectedClient.uf}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedClient(null);
                                                        setCabecalho({ ...cabecalho, cliente_codigo: '' });
                                                        setClientSearch('');
                                                    }}
                                                    className="px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-md border border-red-200 transition shrink-0 ml-2 cursor-pointer"
                                                >
                                                    Trocar Cliente
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="relative flex gap-2">
                                                <div className="relative flex-1">
                                                    <input
                                                        type="text"
                                                        required
                                                        placeholder="Digite código, razão social ou CNPJ..."
                                                        value={clientSearch}
                                                        onChange={(e) => {
                                                            setClientSearch(e.target.value);
                                                            setSelectedClient(null);
                                                        }}
                                                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    />

                                                    {/* Dropdown rápido de Clientes */}
                                                    {clientOptions.length > 0 && (
                                                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl z-40 max-h-52 overflow-y-auto">
                                                            {clientOptions.map((cli, cliIdx) => (
                                                                <div
                                                                    key={`${cli.codigo}-${cliIdx}`}
                                                                    onClick={() => handleSelectClient(cli)}
                                                                    className="p-2.5 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-none"
                                                                >
                                                                    <div className="font-semibold text-gray-900 text-sm">{cli.razao_social}</div>
                                                                    <div className="text-xs text-gray-500 font-mono">
                                                                        Cód: {cli.codigo} | CNPJ/CPF: {cli.cnpj_cpf || '-'} | {cli.cidade}/{cli.uf}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={handleOpenClientModal}
                                                    className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shrink-0 shadow-2xs cursor-pointer"
                                                    title="Abrir tabela completa de clientes"
                                                >
                                                    <Search className="w-4 h-4" />
                                                    Tabela F3
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 mb-1">
                                            Data de Emissão *
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            value={cabecalho.data_emissao}
                                            onChange={(e) => setCabecalho({ ...cabecalho, data_emissao: e.target.value })}
                                            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 mb-1">
                                            Condição de Pagamento
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Ex: 30 DDL, A VISTA"
                                            value={cabecalho.condicao_pagamento}
                                            onChange={(e) => setCabecalho({ ...cabecalho, condicao_pagamento: e.target.value })}
                                            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 mb-1">
                                            Tipo de Frete
                                        </label>
                                        <select
                                            value={cabecalho.tipo_frete}
                                            onChange={(e) => setCabecalho({ ...cabecalho, tipo_frete: e.target.value })}
                                            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="FOB">FOB - Por conta do Destinatário</option>
                                            <option value="CIF">CIF - Por conta do Emitente</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 mb-1">
                                            Transportadora
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Nome da transportadora"
                                            value={cabecalho.transportadora}
                                            onChange={(e) => setCabecalho({ ...cabecalho, transportadora: e.target.value })}
                                            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="pedido-observacoes" className="flex items-center gap-1 text-xs font-semibold text-gray-600 mb-1">
                                        <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                                        Observações do Pedido
                                    </label>
                                    <textarea
                                        id="pedido-observacoes"
                                        rows={2}
                                        placeholder="Informações gerais do pedido: instruções de entrega, embalagem, nº do pedido do cliente, contato..."
                                        value={cabecalho.observacoes || ''}
                                        onChange={(e) => setCabecalho({ ...cabecalho, observacoes: e.target.value })}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                                    />
                                </div>
                            </div>

                            {/* SEÇÃO 2: GRID DE ITENS (LineOk) */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                                        <Package className="w-3.5 h-3.5 text-blue-600" />
                                        Grid de Itens (Validação LineOk)
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={addItemRow}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        Adicionar Linha
                                    </button>
                                </div>

                                <div className="border border-gray-200 rounded-xl shadow-xs">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-gray-50 border-b border-gray-200 font-semibold uppercase text-gray-600">
                                            <tr>
                                                <th className="py-2.5 px-3 w-12 text-center">#</th>
                                                <th className="py-2.5 px-3 w-72">Produto *</th>
                                                <th className="py-2.5 px-3">Descrição</th>
                                                <th className="py-2.5 px-3 w-28 text-right">Qtd *</th>
                                                <th className="py-2.5 px-3 w-32 text-right">Preço Un. (R$) *</th>
                                                <th className="py-2.5 px-3 w-40">Entrega Prev.</th>
                                                <th className="py-2.5 px-3 w-32 text-right">Subtotal</th>
                                                <th className="py-2.5 px-3 w-40 text-center">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 bg-white">
                                            {itens.map((item, idx) => {
                                                const subtotal = (parseDecimalBR(item.quantidade) || 0) * (parseDecimalBR(item.preco_unitario) || 0);
                                                const obsAberta = item.showObs || !!item.observacao;
                                                return (
                                                    <React.Fragment key={idx}>
                                                    <tr className={`hover:bg-gray-50/60 ${obsAberta ? '[&>td]:border-b-0' : ''}`}>
                                                        <td className="py-2 px-3 text-center font-mono text-gray-500 font-bold">
                                                            {idx + 1}
                                                        </td>
                                                        <td className="py-2 px-3 relative">
                                                            <div className="flex items-center gap-1">
                                                                <input
                                                                    type="text"
                                                                    required
                                                                    placeholder="Cód. Produto"
                                                                    value={item.produto_codigo}
                                                                    onChange={(e) => {
                                                                        updateItemField(idx, 'produto_codigo', e.target.value);
                                                                        searchProducts(e.target.value, idx);
                                                                    }}
                                                                    onBlur={async () => {
                                                                        if (item.produto_codigo && !item.produto_descricao) {
                                                                            try {
                                                                                const res = await api.get(`/erp/produtos/lookup?q=${encodeURIComponent(item.produto_codigo.trim())}&limit=5`);
                                                                                const exact = res.data?.find(p => p.codigo.toUpperCase() === item.produto_codigo.trim().toUpperCase()) || res.data?.[0];
                                                                                if (exact) {
                                                                                    handleSelectProduct(exact, idx);
                                                                                }
                                                                            } catch (e) {}
                                                                        }
                                                                    }}
                                                                    className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs font-mono text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 uppercase font-semibold"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenProductModal(idx)}
                                                                    className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-xs font-bold flex items-center gap-1 transition shrink-0 cursor-pointer shadow-2xs"
                                                                    title="Pesquisar Produto na Tabela (F3) com Múltiplos Filtros"
                                                                >
                                                                    <Search className="w-3.5 h-3.5" />
                                                                    F3
                                                                </button>
                                                            </div>

                                                            {/* Autocomplete Dropdown */}
                                                            {activeProductRow === idx && productOptions.length > 0 && (
                                                                <div className="absolute left-3 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 max-h-52 overflow-y-auto">
                                                                    {productOptions.map((prod, prodIdx) => (
                                                                        <div
                                                                            key={`${prod.codigo}-${prodIdx}`}
                                                                            onClick={() => handleSelectProduct(prod, idx)}
                                                                            className="p-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-none"
                                                                        >
                                                                            <div className="flex items-center justify-between">
                                                                                <span className="font-bold text-gray-900 font-mono text-xs">{prod.codigo}</span>
                                                                                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">{prod.tipo}</span>
                                                                            </div>
                                                                            <div className="text-[11px] text-gray-600 truncate">{prod.descricao}</div>
                                                                            <div className="text-[10px] text-emerald-600 font-mono font-bold">
                                                                                R$ {parseFloat(prod.preco_venda || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </td>

                                                        <td className="py-2 px-3">
                                                            <input
                                                                type="text"
                                                                readOnly
                                                                value={item.produto_descricao}
                                                                placeholder="Descrição do produto"
                                                                className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs text-gray-600"
                                                            />
                                                        </td>

                                                        <td className="py-2 px-3">
                                                            <input
                                                                type="text" inputMode="decimal"
                                                                required
                                                                min="0.001"
                                                                step="any"
                                                                value={item.quantidade}
                                                                onChange={(e) => updateItemField(idx, 'quantidade', sanitizeDecimal(e.target.value))}
                                                                className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs font-mono text-right text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                                                            />
                                                        </td>

                                                        <td className="py-2 px-3">
                                                            <input
                                                                type="text" inputMode="decimal"
                                                                required
                                                                min="0"
                                                                step="0.01"
                                                                value={item.preco_unitario}
                                                                onChange={(e) => updateItemField(idx, 'preco_unitario', sanitizeDecimal(e.target.value))}
                                                                className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs font-mono text-right text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                            />
                                                        </td>

                                                        <td className="py-2 px-3">
                                                            <input
                                                                type="date"
                                                                value={item.data_entrega_prevista}
                                                                onChange={(e) => updateItemField(idx, 'data_entrega_prevista', e.target.value)}
                                                                className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                            />
                                                        </td>

                                                        <td className="py-2 px-3 text-right font-mono font-bold text-gray-900">
                                                            R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </td>

                                                        <td className="py-2 px-3">
                                                            <div className="flex items-center justify-center gap-0.5">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => item.desenho_url && window.open(item.desenho_url, '_blank', 'noopener')}
                                                                    disabled={!item.desenho_url}
                                                                    className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-25 disabled:hover:bg-transparent disabled:cursor-not-allowed transition cursor-pointer"
                                                                    title={item.desenho_url ? `Abrir desenho/PDF do produto${item.desenho_nome ? `: ${item.desenho_nome}` : ''}` : 'Produto sem PDF/desenho cadastrado'}
                                                                >
                                                                    <FileText className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleItemObs(idx)}
                                                                    className={`p-1.5 rounded transition cursor-pointer ${item.observacao ? 'text-amber-600 bg-amber-50' : 'text-gray-400 hover:text-amber-600 hover:bg-amber-50'}`}
                                                                    title="Observação da linha"
                                                                >
                                                                    <MessageSquare className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => duplicateItemRow(idx)}
                                                                    className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                                                                    title="Duplicar linha"
                                                                >
                                                                    <Copy className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeItemRow(idx)}
                                                                    disabled={itens.length === 1}
                                                                    className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 transition cursor-pointer"
                                                                    title="Remover linha"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    {obsAberta && (
                                                        <tr className="bg-amber-50/30">
                                                            <td></td>
                                                            <td colSpan={7} className="pb-2 px-3">
                                                                <div className="flex items-center gap-2">
                                                                    <MessageSquare className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                                                    <input
                                                                        type="text"
                                                                        autoFocus={item.showObs && !item.observacao}
                                                                        placeholder={`Observação da linha ${idx + 1} (ex.: revisão do desenho, embalagem especial, tratamento...)`}
                                                                        value={item.observacao || ''}
                                                                        onChange={(e) => updateItemField(idx, 'observacao', e.target.value)}
                                                                        className="w-full bg-white border border-amber-200 rounded px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-400"
                                                                    />
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Total Geral Card */}
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex items-center justify-between">
                                <div className="text-xs text-gray-500">
                                    Total de Linhas no Grid: <span className="font-bold text-gray-900">{itens.length}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs uppercase font-bold text-gray-600">Valor Total do Pedido:</span>
                                    <span className="text-2xl font-black font-mono text-blue-700">
                                        R$ {totalPedido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                                <Button
                                    type="button"
                                    variant="light"
                                    size="md"
                                    onClick={() => setIsCreateModalOpen(false)}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="md"
                                    loading={saveLoading}
                                >
                                    Gravar Pedido no ERP
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL DE DETALHES E EDIÇÃO DE ITENS DO PEDIDO (MATA410) */}
            {viewOrderModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs overflow-hidden animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-[96vw] max-h-[94vh] flex flex-col overflow-hidden">
                        {/* Header Fixo */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-slate-50 shrink-0">
                            <div className="flex items-center gap-3">
                                {viewOrderModal.pedido?.cliente_logo ? (
                                    <ClientAvatar logo={viewOrderModal.pedido.cliente_logo} name={viewOrderModal.pedido.cliente_nome} size="w-12 h-12" />
                                ) : (
                                <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
                                    <ShoppingCart className="w-6 h-6" />
                                </div>
                                )}
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-lg font-bold text-gray-900">
                                            Pedido de Venda: <span className="font-mono text-blue-700 font-black">{viewOrderModal.pedido?.numero_pedido}</span>
                                        </h2>
                                        <StatusBadge status={viewOrderModal.pedido?.status} size="text-xs uppercase" />
                                        {viewOrderModal.pedido?.pedido_cliente && (
                                            <span className="text-xs font-mono text-gray-600 bg-white border border-gray-200 px-2 py-0.5 rounded">
                                                Pedido do Cliente: <b>{viewOrderModal.pedido.pedido_cliente}</b>
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-600 mt-0.5">
                                        Cliente: <span className="font-semibold text-gray-800">{viewOrderModal.pedido?.cliente_nome}</span> 
                                        {viewOrderModal.pedido?.cliente_codigo && <span className="font-mono text-gray-500 ml-1">({viewOrderModal.pedido.cliente_codigo})</span>}
                                        {viewOrderModal.pedido?.cnpj_cpf && <span className="font-mono text-gray-400 ml-2">CNPJ: {viewOrderModal.pedido.cnpj_cpf}</span>}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setViewOrderModal(null);
                                    setEditingItemId(null);
                                    setItemActionMsg(null);
                                }}
                                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition"
                                title="Fechar modal"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Cabeçalho do Pedido (visualização / edição) */}
                        {editingHeader ? (
                            <div className="px-6 py-3 bg-amber-50/60 border-b border-amber-200 shrink-0 text-xs space-y-2">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <label className="block">
                                        <span className="text-gray-600 font-semibold block mb-1">Emissão</span>
                                        <input type="date" value={headerForm.data_emissao || ''}
                                            onChange={(e) => setHeaderForm(f => ({ ...f, data_emissao: e.target.value }))}
                                            className="w-full px-2 py-1.5 border border-amber-300 rounded-lg bg-white" />
                                    </label>
                                    <label className="block">
                                        <span className="text-gray-600 font-semibold block mb-1">Condição de Pagto</span>
                                        <input type="text" value={headerForm.condicao_pagamento || ''}
                                            onChange={(e) => setHeaderForm(f => ({ ...f, condicao_pagamento: e.target.value }))}
                                            className="w-full px-2 py-1.5 border border-amber-300 rounded-lg bg-white font-mono" />
                                    </label>
                                    <label className="block">
                                        <span className="text-gray-600 font-semibold block mb-1">Tipo de Frete</span>
                                        <select value={headerForm.tipo_frete || 'FOB'}
                                            onChange={(e) => setHeaderForm(f => ({ ...f, tipo_frete: e.target.value }))}
                                            className="w-full px-2 py-1.5 border border-amber-300 rounded-lg bg-white">
                                            <option value="FOB">FOB - Destinatário</option>
                                            <option value="CIF">CIF - Emitente</option>
                                        </select>
                                    </label>
                                    <label className="block">
                                        <span className="text-gray-600 font-semibold block mb-1">Transportadora</span>
                                        <input type="text" value={headerForm.transportadora || ''}
                                            onChange={(e) => setHeaderForm(f => ({ ...f, transportadora: e.target.value }))}
                                            className="w-full px-2 py-1.5 border border-amber-300 rounded-lg bg-white" />
                                    </label>
                                </div>
                                <label className="block">
                                    <span className="text-gray-600 font-semibold block mb-1">Observações do Pedido</span>
                                    <textarea rows={2} value={headerForm.observacoes || ''}
                                        onChange={(e) => setHeaderForm(f => ({ ...f, observacoes: e.target.value }))}
                                        className="w-full px-2 py-1.5 border border-amber-300 rounded-lg bg-white resize-y" />
                                </label>
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => setEditingHeader(false)} disabled={savingHeader}
                                        className="px-3 py-1.5 rounded-lg font-semibold text-gray-600 hover:bg-gray-100">Cancelar</button>
                                    <button onClick={handleSaveHeader} disabled={savingHeader}
                                        className="px-3 py-1.5 rounded-lg font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 disabled:opacity-50">
                                        <Save className="w-3.5 h-3.5" /> {savingHeader ? 'Salvando...' : 'Salvar Pedido'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                        <div className="px-6 py-3 bg-gray-50/70 border-b border-gray-200 shrink-0 text-xs space-y-2">
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-start">
                            <div>
                                <span className="text-gray-500 block">Emissão:</span>
                                <span className="font-bold text-gray-900">
                                    {viewOrderModal.pedido?.data_emissao ? String(viewOrderModal.pedido.data_emissao).split('T')[0] : '-'}
                                </span>
                            </div>
                            <div>
                                <span className="text-gray-500 block">Condição de Pagto / Frete:</span>
                                <span className="font-bold text-gray-900">{viewOrderModal.pedido?.condicao_pagamento || '-'}</span>
                                <span className="text-gray-500 ml-1">· {viewOrderModal.pedido?.tipo_frete || 'FOB'}{viewOrderModal.pedido?.transportadora ? ` · ${viewOrderModal.pedido.transportadora}` : ''}</span>
                            </div>
                            <div>
                                <span className="text-gray-500 block">Total de Itens:</span>
                                <span className="font-bold text-gray-900">
                                    {viewOrderModal.itens?.length || 0} itens 
                                    <span className="font-normal text-gray-500 ml-1">
                                        ({viewOrderModal.itens?.filter(i => !i.pode_editar).length || 0} com OP, {viewOrderModal.itens?.filter(i => i.pode_editar).length || 0} livres)
                                    </span>
                                </span>
                            </div>
                            <div>
                                <span className="text-gray-500 block">Valor Total do Pedido:</span>
                                <span className="font-black text-blue-700 text-sm font-mono">
                                    R$ {(parseFloat(viewOrderModal.pedido?.valor_total) || viewOrderModal.itens?.reduce((acc, it) => acc + (parseFloat(it.valor_total || it.subtotal) || 0), 0) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                            <div className="sm:text-right">
                                {viewOrderModal.pedido?.status !== 'cancelado' && viewOrderModal.pedido?.status !== 'faturado' && (
                                    <button onClick={handleStartEditHeader}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg font-bold transition cursor-pointer">
                                        <Edit2 className="w-3.5 h-3.5" /> Editar Pedido
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="flex items-start gap-1.5 text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2">
                            <MessageSquare className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0" />
                            <span className="font-semibold text-gray-500 shrink-0">Observações:</span>
                            <span className="whitespace-pre-wrap">{viewOrderModal.pedido?.observacoes || <em className="text-gray-400">Nenhuma observação</em>}</span>
                        </div>
                        </div>
                        )}
                        {/* Barra de Exportação e Pasta no Servidor */}
                        <div className="px-6 py-2.5 bg-slate-50 border-b border-gray-200 shrink-0 flex flex-wrap items-center justify-between gap-3 text-xs">
                            {/* Pasta no Servidor */}
                            <div className="flex items-center gap-2 flex-1 min-w-[280px]">
                                <Folder className="w-4 h-4 text-amber-600 shrink-0" />
                                <span className="font-bold text-gray-700">Pasta no Servidor:</span>
                                {editingPastaServidor ? (
                                    <div className="flex items-center gap-1.5 flex-1 max-w-md">
                                        <input
                                            type="text"
                                            value={pastaServidorDraft}
                                            onChange={(e) => setPastaServidorDraft(e.target.value)}
                                            placeholder="Ex: \\servidor\pedidos\000003"
                                            className="w-full px-2 py-1 border border-blue-400 rounded bg-white font-mono text-[11px]"
                                        />
                                        <button
                                            onClick={handleSavePastaPedido}
                                            className="px-2 py-1 bg-emerald-600 text-white rounded font-bold hover:bg-emerald-700 cursor-pointer"
                                            title="Salvar Pasta"
                                        >
                                            <Save className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => setEditingPastaServidor(false)}
                                            className="px-2 py-1 text-gray-500 hover:bg-gray-200 rounded cursor-pointer"
                                            title="Cancelar"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5 truncate">
                                        <span className="font-mono text-[11px] text-gray-600 bg-white border border-gray-200 px-2 py-0.5 rounded truncate max-w-xs" title={viewOrderModal.pedido?.pasta_servidor || 'Usando padrão configurado'}>
                                            {viewOrderModal.pedido?.pasta_servidor || (configPasta.diretorio_raiz_pedidos ? `${configPasta.diretorio_raiz_pedidos.replace(/[/\\]+$/, '')}\\${viewOrderModal.pedido?.numero_pedido}` : 'Não configurada')}
                                        </span>
                                        <button
                                            onClick={() => handleAbrirPasta(viewOrderModal.pedido?.numero_pedido, viewOrderModal.pedido?.pasta_servidor)}
                                            className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded font-bold transition shadow-2xs cursor-pointer"
                                            title="Abrir no Windows Explorer"
                                        >
                                            <FolderOpen className="w-3.5 h-3.5" />
                                            <span>Abrir no Explorer</span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                setPastaServidorDraft(viewOrderModal.pedido?.pasta_servidor || '');
                                                setEditingPastaServidor(true);
                                            }}
                                            className="p-1 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-200 transition cursor-pointer"
                                            title="Editar caminho da pasta"
                                        >
                                            <Edit2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Botões de Ação de Relatório do Pedido */}
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => handleExportSingle(viewOrderModal.pedido, 'pdf')}
                                    disabled={exportingReport}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-red-50 text-red-700 border border-red-200 rounded-lg font-bold transition shadow-2xs cursor-pointer disabled:opacity-50"
                                    title="Exportar Pedido em PDF"
                                >
                                    <FileText className="w-3.5 h-3.5 text-red-600" />
                                    <span>PDF Pedido</span>
                                </button>

                                <button
                                    onClick={() => handleExportSingle(viewOrderModal.pedido, 'pdf', { includeAttachments: true })}
                                    disabled={exportingReport}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition shadow-2xs cursor-pointer disabled:opacity-50"
                                    title="Caderno Completo: Pedido + Todos os Anexos Técnicos mesclados em um único PDF"
                                >
                                    <BookOpen className="w-3.5 h-3.5" />
                                    <span>Caderno Completo</span>
                                </button>

                                <button
                                    onClick={() => handleExportSingle(viewOrderModal.pedido, 'excel')}
                                    disabled={exportingReport}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-bold transition shadow-2xs cursor-pointer disabled:opacity-50"
                                    title="Exportar Pedido para Planilha Excel (.xlsx)"
                                >
                                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Excel (.xlsx)</span>
                                </button>
                            </div>
                        </div>

                        {/* Status do Pedido + Anexos */}
                        <div className="px-6 py-2.5 border-b border-gray-200 shrink-0 text-xs space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-gray-700 uppercase tracking-wider mr-1">Status:</span>
                                <StatusBadge status={viewOrderModal.pedido?.status} size="text-xs" />
                                <div className="flex-1" />
                                {viewOrderModal.pedido?.status === 'orcamento' && (
                                    <button
                                        onClick={() => { setStatusDialog('pedido'); setPedidoClienteDraft(viewOrderModal.pedido?.pedido_cliente || ''); }}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold cursor-pointer"
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Converter em Pedido
                                    </button>
                                )}
                                {viewOrderModal.pedido?.status === 'cancelado' && (
                                    <button onClick={() => handleChangeStatus('orcamento')} disabled={changingStatus}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg font-bold cursor-pointer disabled:opacity-50">
                                        <RotateCcw className="w-3.5 h-3.5" /> Reativar como Orçamento
                                    </button>
                                )}
                                {viewOrderModal.pedido?.status !== 'cancelado' && (
                                    <button onClick={() => handleChangeStatus('cancelado')} disabled={changingStatus}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg font-bold cursor-pointer disabled:opacity-50">
                                        <X className="w-3.5 h-3.5" /> Cancelar
                                    </button>
                                )}
                            </div>

                            {statusDialog === 'pedido' && (
                                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                                    <div className="font-bold text-emerald-900 uppercase tracking-wider">Converter Orçamento em Pedido</div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                                        <label className="block">
                                            <span className="text-gray-700 font-semibold block mb-1">Nº do Pedido do Cliente *</span>
                                            <input type="text" value={pedidoClienteDraft} autoFocus
                                                onChange={(e) => setPedidoClienteDraft(e.target.value)}
                                                placeholder="Ex: PC-45871"
                                                className="w-full px-2 py-1.5 border border-emerald-300 rounded-lg bg-white font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
                                        </label>
                                        <div className="md:col-span-2 text-gray-600">
                                            Anexos do cliente: <b className={(viewOrderModal.anexos || []).length ? 'text-emerald-700' : 'text-red-600'}>
                                                {(viewOrderModal.anexos || []).length} arquivo(s)
                                            </b> {!(viewOrderModal.anexos || []).length && '— anexe pelo menos 1 arquivo abaixo.'}
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => setStatusDialog(null)} className="px-3 py-1.5 rounded-lg font-semibold text-gray-600 hover:bg-gray-100">Voltar</button>
                                        <button
                                            onClick={() => handleChangeStatus('pedido')}
                                            disabled={changingStatus || !pedidoClienteDraft.trim() || !(viewOrderModal.anexos || []).length}
                                            className="px-3 py-1.5 rounded-lg font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 disabled:opacity-50"
                                        >
                                            <Check className="w-3.5 h-3.5" /> {changingStatus ? 'Confirmando...' : 'Confirmar Pedido'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-gray-700 uppercase tracking-wider mr-1">Anexos:</span>
                                {(viewOrderModal.anexos || []).length === 0 && <em className="text-gray-400">Nenhum arquivo anexado</em>}
                                {(viewOrderModal.anexos || []).map(a => (
                                    <span key={a.id} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 bg-slate-50 border border-slate-200 rounded-lg">
                                        <button onClick={() => handleOpenAnexo(a)} className="flex items-center gap-1 text-blue-700 hover:underline cursor-pointer" title="Abrir / baixar">
                                            <FileText className="w-3.5 h-3.5" />
                                            <span className="max-w-[220px] truncate">{a.nome_original}</span>
                                            <span className="text-gray-400">({formatBytes(a.tamanho)})</span>
                                        </button>
                                        <button onClick={() => handleDeleteAnexo(a)} className="p-0.5 text-gray-400 hover:text-red-600 cursor-pointer" title="Remover anexo">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                                <label className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border font-bold cursor-pointer transition ${uploadingAnexos ? 'opacity-50 pointer-events-none' : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'}`}>
                                    <Plus className="w-3.5 h-3.5" /> {uploadingAnexos ? 'Enviando...' : 'Anexar arquivos'}
                                    <input type="file" multiple className="hidden"
                                        onChange={(e) => { handleUploadAnexos(e.target.files); e.target.value = ''; }} />
                                </label>
                            </div>
                        </div>

                        {/* Notificação / Feedback de Ações no Item */}
                        {itemActionMsg && (
                            <div className={`mx-6 mt-3 px-4 py-2.5 rounded-lg text-xs font-medium flex items-center justify-between gap-2 border shadow-xs ${
                                itemActionMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
                            }`}>
                                <div className="flex items-center gap-2">
                                    {itemActionMsg.type === 'success' ? <Check className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
                                    <span>{itemActionMsg.text}</span>
                                </div>
                                <button onClick={() => setItemActionMsg(null)} className="text-gray-400 hover:text-gray-600 p-0.5">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}

                        {/* Barra de Ações: Botão + Adicionar Produto */}
                        <div className="px-6 pt-3 pb-1 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Itens do Pedido</span>
                                <span className="text-xs font-mono bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">
                                    {viewOrderModal.itens?.length || 0}
                                </span>
                            </div>
                            {viewOrderModal.pedido?.status !== 'cancelado' && viewOrderModal.pedido?.status !== 'faturado' && (
                                <button
                                    onClick={() => {
                                        setIsAddingItemOpen(prev => !prev);
                                        setAddingItemError(null);
                                        if (!isAddingItemOpen) {
                                            setNewItemData({
                                                produto_codigo: '',
                                                produto_descricao: '',
                                                unidade_medida: '',
                                                quantidade: 1,
                                                preco_unitario: 0,
                                                data_entrega_prevista: viewOrderModal.pedido?.data_emissao ? String(viewOrderModal.pedido.data_emissao).split('T')[0] : ''
                                            });
                                            setAddItemProdSearch('');
                                        }
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    {isAddingItemOpen ? 'Cancelar Adição' : '+ Adicionar Produto ao Pedido'}
                                </button>
                            )}
                        </div>

                        {/* Formulário Retrátil de Adição de Produto */}
                        {isAddingItemOpen && (
                            <div className="mx-6 my-2 p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl shadow-xs transition-all">
                                <div className="flex items-center justify-between mb-3 border-b border-emerald-200/60 pb-2">
                                    <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs uppercase tracking-wider">
                                        <Plus className="w-4 h-4 text-emerald-600" />
                                        Novo Produto para o Pedido {viewOrderModal.pedido?.numero_pedido}
                                    </div>
                                    <button 
                                        onClick={() => setIsAddingItemOpen(false)}
                                        className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                {addingItemError && (
                                    <div className="mb-3 p-2.5 bg-red-100 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4 shrink-0" />
                                        <span>{addingItemError}</span>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                                    {/* Busca do Produto com Auto-complete e F3 */}
                                    <div className="md:col-span-5 relative">
                                        <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                                            Produto (Código / Descrição) *
                                        </label>
                                        <div className="flex gap-1.5">
                                            <div className="relative flex-1">
                                                <input
                                                    type="text"
                                                    value={addItemProdSearch}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setAddItemProdSearch(val);
                                                        setNewItemData(prev => ({ ...prev, produto_codigo: val }));
                                                        searchAddItemProducts(val);
                                                    }}
                                                    placeholder="Digite o código ou nome..."
                                                    className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                                                />
                                                {addItemProdLoading && (
                                                    <span className="absolute right-2.5 top-2 text-[10px] text-gray-400 animate-pulse">
                                                        Buscando...
                                                    </span>
                                                )}

                                                {/* Dropdown de sugestões */}
                                                {addItemProdOptions.length > 0 && (
                                                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                                                        {addItemProdOptions.map((p, pIdx) => (
                                                            <button
                                                                key={`${p.codigo}-${pIdx}`}
                                                                type="button"
                                                                onClick={() => handleSelectAddItemProduct(p)}
                                                                className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 border-b border-gray-100 last:border-b-0 cursor-pointer"
                                                            >
                                                                <span className="font-bold text-blue-700 font-mono">{p.codigo}</span>
                                                                <span className="text-gray-700 ml-2">{p.descricao}</span>
                                                                {p.preco_venda && (
                                                                    <span className="float-right text-emerald-700 font-semibold font-mono">
                                                                        R$ {parseFloat(p.preco_venda).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                                                    </span>
                                                                )}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleOpenCatalogForAdding}
                                                className="px-2.5 py-1.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition"
                                                title="Abrir catálogo completo de produtos (F3)"
                                            >
                                                <Search className="w-3.5 h-3.5" />
                                                F3
                                            </button>
                                        </div>
                                        {newItemData.produto_descricao && (
                                            <p className="text-[11px] text-gray-600 mt-1 truncate">
                                                {newItemData.produto_descricao} {newItemData.unidade_medida && `(${newItemData.unidade_medida})`}
                                            </p>
                                        )}
                                    </div>

                                    {/* Quantidade */}
                                    <div className="md:col-span-2">
                                        <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                                            Quantidade *
                                        </label>
                                        <input
                                            type="text" inputMode="decimal"
                                            min="0.0001"
                                            step="any"
                                            value={newItemData.quantidade}
                                            onChange={(e) => setNewItemData(prev => ({ ...prev, quantidade: sanitizeDecimal(e.target.value) }))}
                                            className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-right font-mono"
                                        />
                                    </div>

                                    {/* Preço Unitário */}
                                    <div className="md:col-span-2">
                                        <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                                            Preço Un. (R$) *
                                        </label>
                                        <input
                                            type="text" inputMode="decimal"
                                            min="0"
                                            step="0.01"
                                            value={newItemData.preco_unitario}
                                            onChange={(e) => setNewItemData(prev => ({ ...prev, preco_unitario: sanitizeDecimal(e.target.value) }))}
                                            className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-right font-mono"
                                        />
                                    </div>

                                    {/* Previsão de Entrega */}
                                    <div className="md:col-span-3">
                                        <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                                            Data de Entrega
                                        </label>
                                        <input
                                            type="date"
                                            value={newItemData.data_entrega_prevista}
                                            onChange={(e) => setNewItemData(prev => ({ ...prev, data_entrega_prevista: e.target.value }))}
                                            className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                        />
                                    </div>

                                    <div className="md:col-span-12">
                                        <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                                            Observação do Item
                                        </label>
                                        <input
                                            type="text"
                                            value={newItemData.observacao || ''}
                                            onChange={(e) => setNewItemData(prev => ({ ...prev, observacao: e.target.value }))}
                                            placeholder="Ex: acabamento zincado, embalar separado..."
                                            className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="mt-3 pt-3 border-t border-emerald-200/60 flex items-center justify-between">
                                    <div className="text-xs">
                                        <span className="text-gray-500 mr-2">Subtotal previsto:</span>
                                        <span className="font-bold text-emerald-800 font-mono text-sm">
                                            R$ {(((parseDecimalBR(newItemData.quantidade) || 0) * (parseDecimalBR(newItemData.preco_unitario) || 0))).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsAddingItemOpen(false)}
                                            className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition cursor-pointer"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleAddItemToOrder}
                                            disabled={addingItemLoading || !newItemData.produto_codigo}
                                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            {addingItemLoading ? 'Adicionando...' : 'Confirmar Adição'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tabela com Scroll Suave e Cabeçalho Fixo */}
                        <div className="flex-1 overflow-y-auto px-6 py-4">
                            <div className="border border-gray-200 rounded-xl overflow-hidden shadow-xs">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-gray-100/90 sticky top-0 z-10 border-b border-gray-200 font-semibold uppercase text-gray-600 shadow-xs">
                                        <tr>
                                            <th className="py-3 px-3 w-12 text-center">Seq</th>
                                            <th className="py-3 px-3 w-32">Código</th>
                                            <th className="py-3 px-3">Descrição do Produto</th>
                                            <th className="py-3 px-3 text-right w-24">Qtd</th>
                                            <th className="py-3 px-3 text-right w-28">Preço Un.</th>
                                            <th className="py-3 px-3 text-right w-28">Subtotal</th>
                                            <th className="py-3 px-3 w-28 text-center">Entrega</th>
                                            <th className="py-3 px-3 w-36 text-center">Status OP</th>
                                            <th className="py-3 px-3 w-20 text-center">Docs</th>
                                            <th className="py-3 px-3 w-28 text-center">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 bg-white">
                                        {viewOrderModal.itens?.map((it) => {
                                            const isEditing = editingItemId === it.id;
                                            const hasOp = !it.pode_editar;
                                            const subtotalCalculado = isEditing 
                                                ? ((parseDecimalBR(editFormData.quantidade) || 0) * (parseDecimalBR(editFormData.preco_unitario) || 0))
                                                : (parseFloat(it.valor_total || it.subtotal || 0));

                                            return (
                                                <React.Fragment key={it.id}>
                                                <tr className={`${isEditing ? 'bg-amber-50/50' : hasOp ? 'hover:bg-gray-50/60' : 'hover:bg-blue-50/30'} transition`}>
                                                    {/* Seq */}
                                                    <td className="py-2.5 px-3 font-mono text-center text-gray-500 font-semibold">
                                                        {it.item_seq}
                                                    </td>

                                                    {/* Código */}
                                                    <td className="py-2.5 px-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                                                        {it.produto_codigo}
                                                    </td>

                                                    {/* Descrição */}
                                                    <td className="py-2.5 px-3 text-gray-800 font-medium">
                                                        <div>{it.produto_descricao || '-'}</div>
                                                        {it.unidade_medida && (
                                                            <span className="text-[10px] text-gray-400 font-mono">UM: {it.unidade_medida}</span>
                                                        )}
                                                    </td>

                                                    {/* Quantidade */}
                                                    <td className="py-2.5 px-3 text-right font-mono font-bold">
                                                        {isEditing ? (
                                                            <input
                                                                type="text" inputMode="decimal"
                                                                step="0.0001"
                                                                min="0.0001"
                                                                value={editFormData.quantidade}
                                                                onChange={(e) => setEditFormData({ ...editFormData, quantidade: sanitizeDecimal(e.target.value) })}
                                                                className="w-20 px-2 py-1 border border-amber-300 rounded font-mono text-right text-xs focus:ring-2 focus:ring-amber-500 bg-white"
                                                                autoFocus
                                                            />
                                                        ) : (
                                                            parseFloat(it.quantidade || 0).toLocaleString('pt-BR')
                                                        )}
                                                    </td>

                                                    {/* Preço Unitário */}
                                                    <td className="py-2.5 px-3 text-right font-mono">
                                                        {isEditing ? (
                                                            <input
                                                                type="text" inputMode="decimal"
                                                                step="0.01"
                                                                min="0"
                                                                value={editFormData.preco_unitario}
                                                                onChange={(e) => setEditFormData({ ...editFormData, preco_unitario: sanitizeDecimal(e.target.value) })}
                                                                className="w-24 px-2 py-1 border border-amber-300 rounded font-mono text-right text-xs focus:ring-2 focus:ring-amber-500 bg-white"
                                                            />
                                                        ) : (
                                                            `R$ ${parseFloat(it.preco_unitario || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
                                                        )}
                                                    </td>

                                                    {/* Subtotal */}
                                                    <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-900 whitespace-nowrap">
                                                        R$ {subtotalCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>

                                                    {/* Data de Entrega */}
                                                    <td className="py-2.5 px-3 text-center font-mono text-gray-600 whitespace-nowrap">
                                                        {isEditing ? (
                                                            <input
                                                                type="date"
                                                                value={editFormData.data_entrega_prevista}
                                                                onChange={(e) => setEditFormData({ ...editFormData, data_entrega_prevista: e.target.value })}
                                                                className="px-1.5 py-1 border border-amber-300 rounded font-mono text-xs focus:ring-2 focus:ring-amber-500 bg-white"
                                                            />
                                                        ) : (
                                                            it.data_entrega_prevista ? String(it.data_entrega_prevista).split('T')[0] : '-'
                                                        )}
                                                    </td>

                                                    {/* Status da OP */}
                                                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                        {hasOp ? (
                                                            <span 
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200"
                                                                title={`Ordem de Produção ${it.numero_op_efetiva || 'vinculada'}. Bloqueado para edição.`}
                                                            >
                                                                <Lock className="w-3 h-3 text-amber-700" />
                                                                OP: {it.numero_op_efetiva || 'Emitida'}
                                                            </span>
                                                        ) : (
                                                            <span 
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200"
                                                                title="Sem OP emitida. Permitido editar quantidade, preço e entrega."
                                                            >
                                                                <Check className="w-3 h-3 text-emerald-600" />
                                                                Sem OP (Livre)
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Ações */}
                                                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                        <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => it.desenho_url && window.open(it.desenho_url, '_blank', 'noopener')}
                                                            disabled={!it.desenho_url}
                                                            className={`p-1 rounded border transition ${it.desenho_url ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 cursor-pointer' : 'text-gray-300 border-gray-200 cursor-not-allowed'}`}
                                                            title={it.desenho_url ? 'Abrir desenho/PDF do produto' : 'Produto sem desenho anexado'}
                                                        >
                                                            <FileText className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (obsEditItemId === it.id) { setObsEditItemId(null); return; }
                                                                setObsEditItemId(it.id);
                                                                setObsDraft(it.observacao || '');
                                                            }}
                                                            className={`p-1 rounded border transition cursor-pointer ${it.observacao ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-gray-50 hover:bg-amber-50 text-gray-500 border-gray-200'}`}
                                                            title={it.observacao ? `Observação: ${it.observacao}` : 'Adicionar observação ao item'}
                                                        >
                                                            <MessageSquare className="w-3.5 h-3.5" />
                                                        </button>
                                                        </div>
                                                    </td>
                                                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                        {isEditing ? (
                                                            <div className="flex items-center justify-center gap-1">
                                                                <button
                                                                    onClick={() => handleSaveEditItem(it.id)}
                                                                    disabled={savingItem}
                                                                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold flex items-center gap-1 shadow-xs disabled:opacity-50 transition"
                                                                    title="Salvar alterações"
                                                                >
                                                                    <Save className="w-3 h-3" />
                                                                    {savingItem ? '...' : 'Salvar'}
                                                                </button>
                                                                <button
                                                                    onClick={handleCancelEditItem}
                                                                    disabled={savingItem}
                                                                    className="px-1.5 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs font-medium transition"
                                                                    title="Cancelar edição"
                                                                >
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        ) : hasOp ? (
                                                            <button
                                                                disabled
                                                                className="px-2 py-1 text-gray-400 bg-gray-100 rounded text-xs font-medium cursor-not-allowed flex items-center gap-1 mx-auto"
                                                                title={`Item bloqueado: já possui OP emitida (${it.numero_op_efetiva || ''})`}
                                                            >
                                                                <Lock className="w-3 h-3" />
                                                                Bloqueado
                                                            </button>
                                                        ) : (
                                                            <div className="flex items-center justify-center gap-1">
                                                                <button
                                                                    onClick={() => handleStartEditItem(it)}
                                                                    className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                                                                    title="Editar este item"
                                                                >
                                                                    <Edit2 className="w-3 h-3" />
                                                                    Editar
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteItemFromOrder(it.id)}
                                                                    disabled={deletingItemId === it.id}
                                                                    className="p-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded text-xs font-semibold flex items-center transition cursor-pointer disabled:opacity-50"
                                                                    title="Remover este produto do pedido"
                                                                >
                                                                    <Trash2 className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                                {obsEditItemId === it.id ? (
                                                    <tr className="bg-amber-50/70">
                                                        <td colSpan={10} className="px-3 py-2">
                                                            <div className="flex items-center gap-2">
                                                                <MessageSquare className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                                                <input
                                                                    type="text"
                                                                    value={obsDraft}
                                                                    onChange={(e) => setObsDraft(e.target.value)}
                                                                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveItemObs(it.id); if (e.key === 'Escape') setObsEditItemId(null); }}
                                                                    placeholder="Observação do item (Enter para salvar)"
                                                                    className="flex-1 px-2 py-1 border border-amber-300 rounded text-xs bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                                                                    autoFocus
                                                                />
                                                                <button onClick={() => handleSaveItemObs(it.id)} disabled={savingItem}
                                                                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold flex items-center gap-1 disabled:opacity-50">
                                                                    <Save className="w-3 h-3" /> {savingItem ? '...' : 'Salvar'}
                                                                </button>
                                                                <button onClick={() => setObsEditItemId(null)}
                                                                    className="px-1.5 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs">
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ) : it.observacao ? (
                                                    <tr className="bg-amber-50/30">
                                                        <td colSpan={10} className="px-3 py-1.5 text-[11px] text-amber-900">
                                                            <span className="inline-flex items-start gap-1.5">
                                                                <MessageSquare className="w-3 h-3 text-amber-600 mt-0.5 shrink-0" />
                                                                <span><b>Obs:</b> {it.observacao}</span>
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ) : null}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Footer Fixo */}
                        <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between shrink-0">
                            <div className="text-xs text-gray-500">
                                💡 Itens com OP emitida não podem ter quantidade ou valor alterados para preservar a rastreabilidade da produção.
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleDeleteOrder(viewOrderModal.pedido)}
                                    className="px-4 py-2 rounded-xl text-sm font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition flex items-center gap-1.5 cursor-pointer"
                                    title="Excluir / Cancelar este pedido (soft delete)"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Excluir Pedido
                                </button>
                                <button
                                    onClick={() => {
                                        setViewOrderModal(null);
                                        setEditingItemId(null);
                                        setItemActionMsg(null);
                                    }}
                                    className="px-5 py-2 rounded-xl text-sm font-semibold bg-gray-200 hover:bg-gray-300 text-gray-800 transition cursor-pointer"
                                >
                                    Fechar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE CONSULTA PADRÃO DE CLIENTES (F3 SA1) */}
            {isClientModalOpen && (
                <div style={{ zIndex: 70 }} className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-slate-50 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                                    <Building2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-gray-900">Consulta Padrão de Clientes (F3: SA1)</h3>
                                    <p className="text-xs text-gray-500">Selecione o cliente oficial a partir do cadastro do ERP</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsClientModalOpen(false)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Barra de Pesquisa */}
                        <div className="p-4 border-b border-gray-100 bg-white shrink-0">
                            <div className="relative">
                                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Buscar por código, razão social, nome fantasia, CNPJ ou cidade..."
                                    value={clientModalSearch}
                                    onChange={(e) => {
                                        setClientModalSearch(e.target.value);
                                        searchClientsModal(e.target.value);
                                    }}
                                    className="w-full bg-slate-50 border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                                />
                            </div>
                        </div>

                        {/* Lista de Clientes */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {clientModalLoading ? (
                                <div className="py-12 text-center text-gray-500">
                                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                                    Consultando catálogo de clientes...
                                </div>
                            ) : clientModalList.length === 0 ? (
                                <div className="py-12 text-center text-gray-400">
                                    Nenhum cliente encontrado para "{clientModalSearch}".
                                </div>
                            ) : (
                                <div className="border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-100 border-b border-gray-200 text-gray-600 uppercase font-semibold">
                                            <tr>
                                                <th className="py-2.5 px-3 w-28">Código</th>
                                                <th className="py-2.5 px-3">Razão Social / Nome Fantasia</th>
                                                <th className="py-2.5 px-3 w-36">CNPJ / CPF</th>
                                                <th className="py-2.5 px-3 w-32">Cidade / UF</th>
                                                <th className="py-2.5 px-3 w-28 text-center">Cond. Padrão</th>
                                                <th className="py-2.5 px-3 w-24 text-center">Ação</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 bg-white">
                                            {clientModalList.map((cli, cIdx) => (
                                                <tr 
                                                    key={`${cli.codigo}-${cIdx}`}
                                                    onClick={() => handleSelectClientFromModal(cli)}
                                                    className="hover:bg-blue-50/50 cursor-pointer transition"
                                                >
                                                    <td className="py-2.5 px-3 font-mono font-bold text-blue-700">
                                                        {cli.codigo}
                                                    </td>
                                                    <td className="py-2.5 px-3">
                                                        <div className="font-semibold text-gray-900 text-xs">{cli.razao_social}</div>
                                                        {cli.nome_fantasia && (
                                                            <div className="text-[11px] text-gray-500">{cli.nome_fantasia}</div>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-3 font-mono text-gray-600">
                                                        {cli.cnpj_cpf || '-'}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-gray-600">
                                                        {cli.cidade ? `${cli.cidade}/${cli.uf}` : '-'}
                                                    </td>
                                                    <td className="py-2.5 px-3 font-mono text-center text-gray-600">
                                                        {cli.condicao_pagamento_padrao || '-'}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleSelectClientFromModal(cli);
                                                            }}
                                                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold text-xs transition shadow-2xs cursor-pointer"
                                                        >
                                                            Selecionar
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-3 bg-slate-50 border-t border-gray-200 flex items-center justify-between shrink-0">
                            <span className="text-xs text-gray-500">
                                {clientModalList.length} clientes encontrados
                            </span>
                            <button
                                type="button"
                                onClick={() => setIsClientModalOpen(false)}
                                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 transition cursor-pointer"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE CONSULTA PADRÃO DE PRODUTOS (F3 SB1) COM MÚLTIPLOS FILTROS */}
            {isProductModalOpen && (
                <div style={{ zIndex: 70 }} className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-[95vw] max-h-[94vh] flex flex-col overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-slate-50 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
                                    <Package className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-base font-bold text-gray-900">Consulta Padrão de Produtos (F3: SB1)</h3>
                                        {productTargetRow !== null && (
                                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                                Item Linha #{productTargetRow + 1}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500">Filtre por tipo, grupo/prefixo ou digite o código/descrição para buscar no catálogo oficial</p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setIsProductModalOpen(false);
                                    setProductTargetRow(null);
                                }}
                                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Barra de Filtros Múltiplos */}
                        <div className="p-4 bg-slate-50 border-b border-gray-200 space-y-3 shrink-0">
                            {/* Linha 1: Busca Geral + Modo de Busca + Tipo + Grupo */}
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                                {/* Filtro 1: Termo de Busca Geral */}
                                <div className="sm:col-span-5">
                                    <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                                        Palavras-Chave / Código / NCM
                                    </label>
                                    <div className="relative">
                                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="text"
                                            autoFocus
                                            placeholder="Ex: GABINETE 12, CANTONEIRA, MT2, 8517..."
                                            value={productFilterText}
                                            onChange={(e) => {
                                                setProductFilterText(e.target.value);
                                                setProductModalPage(1);
                                                searchProductsModal(
                                                    e.target.value, 
                                                    productFilterTipo, 
                                                    productFilterGrupo, 
                                                    productFilterUnidade, 
                                                    productFilterArmazem, 
                                                    productFilterComPreco, 
                                                    productFilterModoBusca, 
                                                    productFilterOrdenar, 
                                                    1, 
                                                    productModalLimit
                                                );
                                            }}
                                            className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-8 py-2 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        {productFilterText && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setProductFilterText('');
                                                    setProductModalPage(1);
                                                    searchProductsModal('', productFilterTipo, productFilterGrupo, productFilterUnidade, productFilterArmazem, productFilterComPreco, productFilterModoBusca, productFilterOrdenar, 1, productModalLimit);
                                                }}
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs cursor-pointer p-0.5"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Filtro 2: Modo de Busca */}
                                <div className="sm:col-span-3">
                                    <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                                        Modo de Busca
                                    </label>
                                    <select
                                        value={productFilterModoBusca}
                                        onChange={(e) => {
                                            setProductFilterModoBusca(e.target.value);
                                            setProductModalPage(1);
                                            searchProductsModal(
                                                productFilterText, 
                                                productFilterTipo, 
                                                productFilterGrupo, 
                                                productFilterUnidade, 
                                                productFilterArmazem, 
                                                productFilterComPreco, 
                                                e.target.value, 
                                                productFilterOrdenar, 
                                                1, 
                                                productModalLimit
                                            );
                                        }}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="contem">🔍 Contém palavras (AND)</option>
                                        <option value="comeca">⚡ Começa com o código</option>
                                        <option value="exato">🎯 Código / NCM exato</option>
                                    </select>
                                </div>

                                {/* Filtro 3: Tipo de Produto (B1_TIPO) */}
                                <div className="sm:col-span-2">
                                    <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                                        Tipo (B1_TIPO)
                                    </label>
                                    <select
                                        value={productFilterTipo}
                                        onChange={(e) => {
                                            setProductFilterTipo(e.target.value);
                                            setProductModalPage(1);
                                            searchProductsModal(
                                                productFilterText, 
                                                e.target.value, 
                                                productFilterGrupo, 
                                                productFilterUnidade, 
                                                productFilterArmazem, 
                                                productFilterComPreco, 
                                                productFilterModoBusca, 
                                                productFilterOrdenar, 
                                                1, 
                                                productModalLimit
                                            );
                                        }}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-2 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Todos</option>
                                        <option value="PA">PA - Acabado</option>
                                        <option value="PI">PI - Intermediário</option>
                                        <option value="MP">MP - Matéria-Prima</option>
                                        <option value="MC">MC - Consumo</option>
                                        <option value="SV">SV - Serviço</option>
                                        <option value="EM">EM - Embalagem</option>
                                        <option value="ME">ME - Revenda</option>
                                        <option value="AI">AI - Ativo</option>
                                    </select>
                                </div>

                                {/* Filtro 4: Grupo / Prefixo */}
                                <div className="sm:col-span-2">
                                    <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                                        Grupo / Prefixo
                                    </label>
                                    <select
                                        value={productFilterGrupo}
                                        onChange={(e) => {
                                            setProductFilterGrupo(e.target.value);
                                            setProductModalPage(1);
                                            searchProductsModal(
                                                productFilterText, 
                                                productFilterTipo, 
                                                e.target.value, 
                                                productFilterUnidade, 
                                                productFilterArmazem, 
                                                productFilterComPreco, 
                                                productFilterModoBusca, 
                                                productFilterOrdenar, 
                                                1, 
                                                productModalLimit
                                            );
                                        }}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-2 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                                    >
                                        <option value="">Todos</option>
                                        {availableGrupos.map((g) => (
                                            <option key={g.sigla} value={g.sigla}>
                                                {g.sigla} ({g.total})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Linha 2: Unidade de Medida + Armazém + Ordenação + Filtro Comercial + Reset */}
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end pt-1 border-t border-gray-200/80">
                                {/* Unidade de Medida */}
                                <div className="sm:col-span-2">
                                    <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                                        Unidade (UM)
                                    </label>
                                    <select
                                        value={productFilterUnidade}
                                        onChange={(e) => {
                                            setProductFilterUnidade(e.target.value);
                                            setProductModalPage(1);
                                            searchProductsModal(
                                                productFilterText, 
                                                productFilterTipo, 
                                                productFilterGrupo, 
                                                e.target.value, 
                                                productFilterArmazem, 
                                                productFilterComPreco, 
                                                productFilterModoBusca, 
                                                productFilterOrdenar, 
                                                1, 
                                                productModalLimit
                                            );
                                        }}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Todas UMs</option>
                                        <option value="PC">PC - Peça</option>
                                        <option value="UN">UN - Unidade</option>
                                        <option value="CJ">CJ - Conjunto</option>
                                        <option value="KG">KG - Quilo</option>
                                        <option value="MT">MT - Metro</option>
                                        <option value="LT">LT - Litro</option>
                                    </select>
                                </div>

                                {/* Armazém Padrão */}
                                <div className="sm:col-span-3">
                                    <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                                        Armazém Padrão
                                    </label>
                                    <select
                                        value={productFilterArmazem}
                                        onChange={(e) => {
                                            setProductFilterArmazem(e.target.value);
                                            setProductModalPage(1);
                                            searchProductsModal(
                                                productFilterText, 
                                                productFilterTipo, 
                                                productFilterGrupo, 
                                                productFilterUnidade, 
                                                e.target.value, 
                                                productFilterComPreco, 
                                                productFilterModoBusca, 
                                                productFilterOrdenar, 
                                                1, 
                                                productModalLimit
                                            );
                                        }}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Todos os Armazéns</option>
                                        <option value="01">01 - Almoxarifado Principal</option>
                                        <option value="03">03 - Produção / Fábrica</option>
                                    </select>
                                </div>

                                {/* Ordenação */}
                                <div className="sm:col-span-3">
                                    <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                                        Ordenar Resultados
                                    </label>
                                    <select
                                        value={productFilterOrdenar}
                                        onChange={(e) => {
                                            setProductFilterOrdenar(e.target.value);
                                            setProductModalPage(1);
                                            searchProductsModal(
                                                productFilterText, 
                                                productFilterTipo, 
                                                productFilterGrupo, 
                                                productFilterUnidade, 
                                                productFilterArmazem, 
                                                productFilterComPreco, 
                                                productFilterModoBusca, 
                                                e.target.value, 
                                                1, 
                                                productModalLimit
                                            );
                                        }}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="codigo_asc">Código (A → Z)</option>
                                        <option value="codigo_desc">Código (Z → A)</option>
                                        <option value="descricao_asc">Descrição (A → Z)</option>
                                        <option value="preco_desc">Maior Preço de Venda</option>
                                        <option value="preco_asc">Menor Preço de Venda</option>
                                    </select>
                                </div>

                                {/* Checkbox Apenas com Preço */}
                                <div className="sm:col-span-2 flex items-center h-8">
                                    <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={productFilterComPreco}
                                            onChange={(e) => {
                                                setProductFilterComPreco(e.target.checked);
                                                setProductModalPage(1);
                                                searchProductsModal(
                                                    productFilterText, 
                                                    productFilterTipo, 
                                                    productFilterGrupo, 
                                                    productFilterUnidade, 
                                                    productFilterArmazem, 
                                                    e.target.checked, 
                                                    productFilterModoBusca, 
                                                    productFilterOrdenar, 
                                                    1, 
                                                    productModalLimit
                                                );
                                            }}
                                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                                        />
                                        <span>Com Preço &gt; 0</span>
                                    </label>
                                </div>

                                {/* Botão Resetar */}
                                <div className="sm:col-span-2 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={handleResetProductFilters}
                                        className="w-full flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 transition shadow-2xs cursor-pointer"
                                        title="Limpar todos os filtros e restaurar padrão"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        Limpar
                                    </button>
                                </div>
                            </div>

                            {/* Chips de Acesso Rápido aos Principais Tipos e Prefixos */}
                            <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-gray-200/60 text-xs">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase mr-0.5">Tipos:</span>
                                    {[
                                        { label: 'Todos', val: '' },
                                        { label: 'PA (Acabado)', val: 'PA' },
                                        { label: 'PI (Intermed.)', val: 'PI' },
                                        { label: 'MP (Matéria-P.)', val: 'MP' },
                                        { label: 'MC (Consumo)', val: 'MC' }
                                    ].map((t) => (
                                        <button
                                            key={t.label}
                                            type="button"
                                            onClick={() => {
                                                setProductFilterTipo(t.val);
                                                setProductModalPage(1);
                                                searchProductsModal(productFilterText, t.val, productFilterGrupo, productFilterUnidade, productFilterArmazem, productFilterComPreco, productFilterModoBusca, productFilterOrdenar, 1, productModalLimit);
                                            }}
                                            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer border ${
                                                productFilterTipo === t.val
                                                    ? 'bg-blue-600 text-white border-blue-600'
                                                    : 'bg-white text-gray-600 border-gray-200 hover:bg-blue-50 hover:text-blue-700'
                                            }`}
                                        >
                                            {t.label}
                                        </button>
                                    ))}
                                </div>

                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase mr-0.5">Prefixos:</span>
                                    {['SCL', 'MT2', 'MT3', 'MT4', 'MT5', 'MT6', 'MTA', 'MPT', 'MTF'].map((sigla) => (
                                        <button
                                            key={sigla}
                                            type="button"
                                            onClick={() => {
                                                const novoGrupo = productFilterGrupo === sigla ? '' : sigla;
                                                setProductFilterGrupo(novoGrupo);
                                                setProductModalPage(1);
                                                searchProductsModal(productFilterText, productFilterTipo, novoGrupo, productFilterUnidade, productFilterArmazem, productFilterComPreco, productFilterModoBusca, productFilterOrdenar, 1, productModalLimit);
                                            }}
                                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition cursor-pointer border ${
                                                productFilterGrupo === sigla
                                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                                    : 'bg-white text-gray-700 border-gray-200 hover:bg-indigo-50 hover:text-indigo-700'
                                            }`}
                                        >
                                            {sigla}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Tabela de Resultados */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {productModalLoading ? (
                                <div className="py-14 text-center text-gray-500">
                                    <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-2 text-blue-600" />
                                    <div className="font-semibold text-gray-700">Pesquisando no catálogo de produtos do ERP...</div>
                                    <div className="text-xs text-gray-400 mt-1">Consultando os produtos cadastrados da empresa</div>
                                </div>
                            ) : productModalList.length === 0 ? (
                                <div className="py-14 text-center text-gray-400">
                                    <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                    <div className="font-bold text-gray-600">Nenhum produto encontrado com os filtros atuais.</div>
                                    <p className="text-xs text-gray-400 mt-1">Tente remover alguns filtros ou buscar por outro termo.</p>
                                    <button
                                        type="button"
                                        onClick={handleResetProductFilters}
                                        className="mt-3 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold hover:bg-blue-100 transition cursor-pointer"
                                    >
                                        Limpar Todos os Filtros
                                    </button>
                                </div>
                            ) : (
                                <div className="border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-100 border-b border-gray-200 text-gray-600 uppercase font-semibold">
                                            <tr>
                                                <th className="py-2.5 px-3 w-36">Código</th>
                                                <th className="py-2.5 px-3">Descrição do Produto</th>
                                                <th className="py-2.5 px-3 w-20 text-center">Tipo</th>
                                                <th className="py-2.5 px-3 w-16 text-center">UM</th>
                                                <th className="py-2.5 px-3 w-16 text-center">Arm.</th>
                                                <th className="py-2.5 px-3 w-28 text-right">Preço Sug.</th>
                                                <th className="py-2.5 px-3 w-16 text-center">PDF</th>
                                                <th className="py-2.5 px-3 w-24 text-center">Ação</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 bg-white">
                                            {productModalList.map((prod, prIdx) => (
                                                <tr 
                                                    key={`${prod.codigo}-${prIdx}`}
                                                    onDoubleClick={() => handleSelectProductFromModal(prod)}
                                                    className="hover:bg-blue-50/60 cursor-pointer transition group"
                                                >
                                                    <td className="py-2.5 px-3 font-mono font-bold text-blue-700 group-hover:text-blue-900">
                                                        {prod.codigo}
                                                    </td>
                                                    <td className="py-2.5 px-3">
                                                        <div className="font-semibold text-gray-900 text-xs">{prod.descricao}</div>
                                                        {prod.ncm && (
                                                            <div className="text-[10px] text-gray-400 font-mono">NCM: {prod.ncm}</div>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-center">
                                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                                            prod.tipo === 'PA' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                            prod.tipo === 'PI' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                            prod.tipo === 'MP' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                            prod.tipo === 'MC' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                            'bg-gray-50 text-gray-700 border-gray-200'
                                                        }`}>
                                                            {prod.tipo}
                                                        </span>
                                                    </td>
                                                    <td className="py-2.5 px-3 text-center font-mono text-gray-600 font-bold">
                                                        {prod.unidade_medida || 'UN'}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-center font-mono text-gray-500">
                                                        {prod.armazem_padrao || '-'}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-900">
                                                        {parseFloat(prod.preco_venda || 0) > 0 ? (
                                                            <span className="text-emerald-700">
                                                                R$ {parseFloat(prod.preco_venda).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-400 font-normal text-[11px]">-</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-center">
                                                        {prod.desenho_url ? (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    window.open(prod.desenho_url, '_blank', 'noopener');
                                                                }}
                                                                className="p-1.5 rounded text-red-600 hover:bg-red-50 transition cursor-pointer"
                                                                title={`Abrir desenho/PDF${prod.desenho_nome ? `: ${prod.desenho_nome}` : ''}`}
                                                            >
                                                                <FileText className="w-4 h-4" />
                                                            </button>
                                                        ) : (
                                                            <span className="text-gray-300 text-[11px]" title="Produto sem PDF/desenho cadastrado">-</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleSelectProductFromModal(prod);
                                                            }}
                                                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold text-xs transition shadow-2xs cursor-pointer active:scale-95"
                                                        >
                                                            Inserir
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Footer com Paginação e Totais */}
                        <div className="px-6 py-3 bg-slate-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                            <div className="text-xs text-gray-600 flex items-center gap-2">
                                <span>
                                    Encontrados <strong className="font-bold text-gray-900">{productModalTotal.toLocaleString('pt-BR')}</strong> produtos correspondentes
                                </span>
                                {productModalPages > 1 && (
                                    <span className="text-gray-400">
                                        • Página <strong className="text-gray-900">{productModalPage}</strong> de <strong className="text-gray-900">{productModalPages}</strong>
                                    </span>
                                )}
                            </div>

                            {/* Controles de Paginação */}
                            <div className="flex items-center gap-3">
                                {/* Seletor de Limite por Página */}
                                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                    <span>Por pág:</span>
                                    <select
                                        value={productModalLimit}
                                        onChange={(e) => {
                                            const newLimit = parseInt(e.target.value) || 50;
                                            setProductModalLimit(newLimit);
                                            setProductModalPage(1);
                                            searchProductsModal(
                                                productFilterText, 
                                                productFilterTipo, 
                                                productFilterGrupo, 
                                                productFilterUnidade, 
                                                productFilterArmazem, 
                                                productFilterComPreco, 
                                                productFilterModoBusca, 
                                                productFilterOrdenar, 
                                                1, 
                                                newLimit
                                            );
                                        }}
                                        className="bg-white border border-gray-300 rounded px-1.5 py-1 text-xs text-gray-700"
                                    >
                                        <option value="25">25</option>
                                        <option value="50">50</option>
                                        <option value="100">100</option>
                                    </select>
                                </div>

                                {/* Botões Anterior / Próxima */}
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        disabled={productModalPage <= 1}
                                        onClick={() => handlePageChange(productModalPage - 1)}
                                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 transition cursor-pointer"
                                    >
                                        <ChevronLeft className="w-3.5 h-3.5" />
                                        Anterior
                                    </button>
                                    <button
                                        type="button"
                                        disabled={productModalPage >= productModalPages}
                                        onClick={() => handlePageChange(productModalPage + 1)}
                                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 transition cursor-pointer"
                                    >
                                        Próxima
                                        <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsProductModalOpen(false);
                                        setProductTargetRow(null);
                                    }}
                                    className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-gray-200 hover:bg-gray-300 text-gray-800 transition cursor-pointer"
                                >
                                    Fechar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* MODAL CONFIGURAÇÃO DE PASTA NO SERVIDOR (ADMIN) */}
            {isConfigPastaModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs overflow-hidden animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-slate-50">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                                    <FolderOpen className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 text-base">Diretório de Pedidos no Servidor</h3>
                                    <p className="text-xs text-gray-500">Configuração de rede e abertura direta no Windows Explorer</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsConfigPastaModalOpen(false)}
                                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 text-xs">
                            <label className="block">
                                <span className="font-bold text-gray-700 block mb-1">
                                    Diretório Raiz dos Pedidos (Caminho UNC da Rede ou Unidade Mapeada)
                                </span>
                                <input
                                    type="text"
                                    value={configPastaDraft.diretorio_raiz_pedidos || ''}
                                    onChange={(e) => setConfigPastaDraft(c => ({ ...c, diretorio_raiz_pedidos: e.target.value }))}
                                    placeholder="Ex: \\servidor\pedidos ou Z:\pedidos"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                                <span className="text-[11px] text-gray-500 mt-1 block">
                                    Ao criar ou consultar um pedido, o sistema usará este caminho como base.
                                </span>
                            </label>

                            <label className="block">
                                <span className="font-bold text-gray-700 block mb-1">
                                    Padrão de Nome da Subpasta
                                </span>
                                <input
                                    type="text"
                                    value={configPastaDraft.padrao_subpasta || '{NUMERO_PEDIDO}'}
                                    onChange={(e) => setConfigPastaDraft(c => ({ ...c, padrao_subpasta: e.target.value }))}
                                    placeholder="{NUMERO_PEDIDO}"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                                <span className="text-[11px] text-gray-500 mt-1 block">
                                    Use a tag <code className="bg-gray-100 px-1 py-0.5 rounded text-blue-700 font-bold">&#123;NUMERO_PEDIDO&#125;</code> para preenchimento dinâmico.
                                </span>
                            </label>

                            <label className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={!!configPastaDraft.criar_pasta_automatica}
                                    onChange={(e) => setConfigPastaDraft(c => ({ ...c, criar_pasta_automatica: e.target.checked }))}
                                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                />
                                <div>
                                    <div className="font-bold text-gray-800">Criar pasta física automaticamente no disco</div>
                                    <div className="text-[11px] text-gray-500">Gera a pasta do pedido assim que for cadastrado ou acessado</div>
                                </div>
                            </label>

                            {/* Dica do Protocolo sinco-folder:// */}
                            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                                <div className="flex items-center gap-2 text-blue-900 font-bold">
                                    <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                                    <span>Integração Windows Explorer (Protocolo sinco-folder://)</span>
                                </div>
                                <p className="text-blue-800 text-[11px] leading-relaxed">
                                    Para abrir as pastas diretamente no Windows Explorer através de qualquer navegador, instale o protocolo do SINCO no seu computador (basta executar uma única vez por máquina).
                                </p>
                                <a
                                    href="/registrar-protocolo-sinco.reg"
                                    download="registrar-protocolo-sinco.reg"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition shadow-xs cursor-pointer"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    Baixar Registro do Windows (.REG)
                                </a>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 px-6 py-4 bg-gray-50 border-t border-gray-200">
                            <Button
                                onClick={() => setIsConfigPastaModalOpen(false)}
                                variant="light"
                                size="sm"
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleSaveConfigPasta}
                                variant="primary"
                                size="sm"
                                icon={Save}
                                disabled={savingConfigPasta}
                            >
                                {savingConfigPasta ? 'Salvando...' : 'Salvar Configurações'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Confirmação de Exclusão (Soft Delete) */}
            {orderToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-xl shadow-2xl border border-red-100 max-w-md w-full p-6 space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-red-100 text-red-600 rounded-full shrink-0">
                                <AlertCircle size={28} />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-lg font-bold text-gray-900">
                                    Excluir Pedido {orderToDelete.numero}?
                                </h3>
                                <p className="text-sm text-gray-600">
                                    Esta ação cancelará o pedido e seus itens do sistema. Os dados permanecerão no histórico para auditoria, mas não aparecerão nas listagens ativas.
                                </p>
                                {orderToDelete.cliente_nome && (
                                    <div className="text-xs bg-gray-50 p-2.5 rounded-lg border border-gray-100 mt-2 text-gray-700">
                                        <span className="font-semibold">Cliente:</span> {orderToDelete.cliente_nome}<br />
                                        <span className="font-semibold">Valor Total:</span> R$ {Number(orderToDelete.total_liquido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                            <Button
                                variant="light"
                                size="sm"
                                onClick={() => setOrderToDelete(null)}
                                disabled={deletingOrderLoading}
                            >
                                Cancelar
                            </Button>
                            <Button
                                variant="danger"
                                size="sm"
                                icon={Trash2}
                                onClick={confirmDeleteOrder}
                                disabled={deletingOrderLoading}
                            >
                                {deletingOrderLoading ? 'Excluindo...' : 'Confirmar Exclusão'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
