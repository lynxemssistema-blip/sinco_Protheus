import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Calendar, ChevronLeft, ChevronRight, AlertCircle, ShoppingCart, Maximize2, Minimize2, FileSpreadsheet } from 'lucide-react';
import { getPedidosFlat, api } from '../../services/api';
import { useFilters } from '../../contexts/FilterContext';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
import DocsModal from '../DocsModal';
import * as XLSX from 'xlsx';

export default function DeliveryScheduleTab() {
    const { orderFilters } = useFilters();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState([]);
    const [error, setError] = useState(null);
    const [progress, setProgress] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);

    // Guard to prevent concurrent/looping fetch calls
    const isFetchingRef = useRef(false);
    const fetchIdRef = useRef(0);
    
    // Background saving indicator (to avoid blocking UI on drop)
    const [savingBackground, setSavingBackground] = useState(false);

    // Docs Modal State
    const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState({ code: '', name: '' });

    // Date navigation state: start date of our window
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setHours(0,0,0,0);
        return d;
    });

    const [periodType, setPeriodType] = useState('14');

    // Helper to format Date object into YYYY-MM-DD
    const formatDateKey = (dateObj) => {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    // Helper to parse Protheus YYYYMMDD or ISO string into YYYY-MM-DD
    const normalizeDate = (rawStr) => {
        if (!rawStr) return null;
        const s = String(rawStr).trim();
        if (!s) return null;
        if (/^\d{8}$/.test(s)) {
            return `${s.substring(0, 4)}-${s.substring(4, 6)}-${s.substring(6, 8)}`;
        }
        if (s.includes('T')) {
            return s.split('T')[0];
        }
        return s; // Already YYYY-MM-DD or other format
    };

    const handlePeriodTypeChange = (newType) => {
        setPeriodType(newType);
        const today = new Date();
        today.setHours(0,0,0,0);

        if (newType === '7') {
            // Get Monday of current week
            const day = today.getDay();
            const diff = today.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(today.setDate(diff));
            setStartDate(monday);
        } else if (newType === 'next7') {
            // Get Monday of next week
            const day = today.getDay();
            const diff = today.getDate() - day + (day === 0 ? -6 : 1) + 7;
            const nextMonday = new Date(today.setDate(diff));
            setStartDate(nextMonday);
        } else {
            // Today for 14 or 30 days
            setStartDate(today);
        }
    };

    // Generate days dynamically starting from startDate based on periodType
    const getPeriodDaysCount = () => {
        if (periodType === '7' || periodType === 'next7') return 7;
        if (periodType === '30') return 30;
        return 14; // Default: '14'
    };

    const daysCount = getPeriodDaysCount();
    const days = [];
    for (let i = 0; i < daysCount; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        days.push({
            date: d,
            key: formatDateKey(d),
            label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
            weekday: d.toLocaleDateString('pt-BR', { weekday: 'short' })
        });
    }

    const todayKey = formatDateKey(new Date());

    // Stable filters key to avoid object reference re-triggers
    const filtersKey = JSON.stringify({
        cliente: orderFilters.cliente || '',
        pedido: orderFilters.pedido || '',
        produto: orderFilters.produto || '',
        pedcli: orderFilters.pedcli || '',
        dataInicial: orderFilters.dataInicial || '',
        dataFinal: orderFilters.dataFinal || '',
        dateType: orderFilters.dateType || 'pedido',
        tipo_item: orderFilters.tipo_item || '',
        op_status: orderFilters.op_status || '',
        only_active: orderFilters.only_active !== undefined ? String(orderFilters.only_active) : 'true'
    });

    // Fetch matching data in paginated batches
    const fetchScheduleData = useCallback(async (silent = false) => {
        // Prevent concurrent fetches
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;

        // Track this specific fetch so stale calls can be discarded
        const myFetchId = ++fetchIdRef.current;

        if (!silent) {
            setLoading(true);
            setItems([]);
        }
        setError(null);
        setProgress('Buscando itens de pedidos...');

        try {
            const filters = JSON.parse(filtersKey);
            let allItems = [];
            let currentPage = 1;
            let hasMore = true;
            const batchLimit = 100;

            while (hasMore) {
                // Abort if a newer fetch was requested
                if (myFetchId !== fetchIdRef.current) return;

                setProgress(`Carregando lote ${currentPage}... (${allItems.length} itens encontrados)`);

                const response = await getPedidosFlat({ ...filters, limit: batchLimit, page: currentPage });
                const batch = response.data || response || [];
                const list = Array.isArray(batch) ? batch : (batch.data || []);
                allItems = [...allItems, ...list];

                const metaTotal = response.meta?.total || 0;

                if (list.length === 0 || (metaTotal && allItems.length >= metaTotal) || list.length < batchLimit) {
                    hasMore = false;
                } else {
                    currentPage++;
                }

                if (currentPage > 50) hasMore = false;
            }

            // Discard stale results
            if (myFetchId !== fetchIdRef.current) return;

            setProgress(`Processando ${allItems.length} itens...`);

            if (allItems.length === 0) {
                setError('Nenhum item com saldo a faturar encontrado.');
            } else {
                setItems(allItems);
            }
        } catch (err) {
            console.error('Erro ao buscar cronograma de entregas:', err);
            setError('Falha ao carregar os itens de pedido (Erro 500 ou Conexão).');
        } finally {
            isFetchingRef.current = false;
            setLoading(false);
            setProgress('');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filtersKey]);

    useEffect(() => {
        fetchScheduleData();
    }, [fetchScheduleData]);

    // Group items by Pedido + Produto (codigo)
    const groupedRows = React.useMemo(() => {
        const map = {};
        items.forEach(item => {
            const ped = item.pedido || '';
            const prod = item.codigo || '';
            const desc = item.descricao || '';
            const key = `${ped}-${prod}`;

            if (!map[key]) {
                map[key] = {
                    pedido: ped,
                    codigo: prod,
                    descricao: desc,
                    cliente: item.nome_cliente || '',
                    totalOpQtd: 0,
                    totalSaldoProd: 0,
                    opNumbers: new Set(),
                    deliveries: {} // dateKey -> array of items
                };
            }

            // Sum OP metrics
            if (item.op_num || item.op_protheus) {
                const opNum = (item.op_num || item.op_protheus).trim();
                if (opNum && opNum !== '-') {
                    map[key].opNumbers.add(opNum);
                    map[key].totalOpQtd += parseFloat(item.op_qtd || 0);
                    map[key].totalSaldoProd += parseFloat(item.saldo_produzido || 0);
                }
            }

            // Pivot date choice: Data PCP or Entrega
            const targetDate = normalizeDate(item.data_pcp || item.pcp_delivery_forecast_date || item.entrega);
            if (targetDate) {
                const qtd = parseFloat(item.saldo_fat || item.qtd_faturar || item.qtd || 0);
                if (qtd > 0) {
                    if (!map[key].deliveries[targetDate]) {
                        map[key].deliveries[targetDate] = [];
                    }
                    map[key].deliveries[targetDate].push(item);
                }
            }
        });

        return Object.values(map);
    }, [items]);

    // Drag & Drop Handlers
    const handleDragStart = (e, item, fromDate) => {
        e.dataTransfer.setData('application/json', JSON.stringify({
            pedido: item.pedido,
            item: item.item,
            codigo: item.codigo,
            qtd: item.saldo_fat || item.qtd_faturar || item.qtd,
            fromDate: fromDate
        }));
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDrop = async (e, toDate) => {
        e.preventDefault();
        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            const { pedido, item, fromDate, qtd } = data;
            
            if (fromDate === toDate) return;

            setSavingBackground(true);

            // Optimistic Local State Update (moves the item immediately)
            setItems(prev => prev.map(itemObj => {
                if (itemObj.pedido === pedido && itemObj.item === item) {
                    return { ...itemObj, data_pcp: toDate };
                }
                return itemObj;
            }));

            // Sync with backend asynchronously
            api.get(`/pedidos/items/${pedido}/${item}/pcp-forecasts/history`)
                .then(async (historyRes) => {
                    const history = historyRes.data || [];
                    const existing = history.find(h => normalizeDate(h.data_entrega_pcp) === fromDate);

                    if (existing) {
                        await api.put(`/pedidos/pcp-forecasts/${existing.id}`, {
                            ...existing,
                            data_entrega_pcp: toDate,
                            quantidade_pcp: existing.quantidade_pcp || qtd,
                            usuario: user?.nome || user?.name || user?.login || 'Usuário'
                        });
                    } else {
                        await api.post('/pedidos/pcp-forecasts', {
                            pedido,
                            item,
                            data_entrega_pcp: toDate,
                            quantidade_pcp: qtd,
                            usuario: user?.nome || user?.name || user?.login || 'Usuário'
                        });
                    }
                    toast.success(`Data de entrega do item ${item} atualizada!`);
                    // Silent background fetch to ensure state integrity
                    fetchScheduleData(true);
                })
                .catch(err => {
                    console.error('Erro ao sincronizar drag & drop com servidor:', err);
                    const errMsg = err.response?.data?.error || err.message || 'Erro.';
                    toast.error('Erro ao salvar no servidor: ' + errMsg);
                    // Rollback local change on error
                    fetchScheduleData(true);
                })
                .finally(() => {
                    setSavingBackground(false);
                });

        } catch (err) {
            console.error('Erro ao mover entrega localmente:', err);
            setSavingBackground(false);
        }
    };

    // Navigation handlers
    const handlePrevPeriod = () => {
        const newD = new Date(startDate);
        newD.setDate(startDate.getDate() - daysCount);
        setStartDate(newD);
    };

    const handleNextPeriod = () => {
        const newD = new Date(startDate);
        newD.setDate(startDate.getDate() + daysCount);
        setStartDate(newD);
    };

    const handleToday = () => {
        const d = new Date();
        d.setHours(0,0,0,0);
        setStartDate(d);
    };

    const exportToExcel = () => {
        try {
            // Prepare headers
            const headers = [
                'Pedido',
                'Cliente',
                'Código Produto',
                'Descrição Produto',
                'OPs',
                'Qtd Total OP',
                'Total Saldo Prod'
            ];
            
            // Add the 14 days to the header
            days.forEach(day => {
                const dayName = day.weekday.replace('.', '');
                headers.push(`${dayName} - ${day.label}`);
            });

            // Prepare rows data
            const sheetRows = groupedRows.map(row => {
                const rowData = {
                    'Pedido': row.pedido,
                    'Cliente': row.cliente,
                    'Código Produto': row.codigo,
                    'Descrição Produto': row.descricao,
                    'OPs': Array.from(row.opNumbers).join(', ') || '-',
                    'Qtd Total OP': row.totalOpQtd || 0,
                    'Total Saldo Prod': row.totalSaldoProd || 0
                };

                days.forEach(day => {
                    const dayItems = row.deliveries[day.key] || [];
                    const qty = dayItems.reduce((acc, item) => {
                        return acc + parseFloat(item.saldo_fat || item.qtd_faturar || item.qtd || 0);
                    }, 0);
                    const dayName = day.weekday.replace('.', '');
                    rowData[`${dayName} - ${day.label}`] = qty || '';
                });

                return rowData;
            });

            // Convert to worksheet
            const ws = XLSX.utils.json_to_sheet(sheetRows, { header: headers });

            // Setup column widths
            const colWidths = [
                { wch: 12 }, // Pedido
                { wch: 30 }, // Cliente
                { wch: 18 }, // Código Produto
                { wch: 35 }, // Descrição Produto
                { wch: 20 }, // OPs
                { wch: 14 }, // Qtd Total OP
                { wch: 16 }  // Total Saldo Prod
            ];
            // 14 days columns widths
            days.forEach(() => {
                colWidths.push({ wch: 15 });
            });
            ws['!cols'] = colWidths;

            // Formatação/Estilos no padrão MetalFisa
            const headerRange = XLSX.utils.decode_range(ws['!ref'] || 'A1');
            
            // 1. Format Headers
            for (let c = headerRange.s.c; c <= headerRange.e.c; c++) {
                const cell = XLSX.utils.encode_cell({ r: 0, c });
                if (!ws[cell]) continue;

                // Corporate Navy/Steel Blue fill for general headers
                let bgColor = '1E3A8A'; // Navy Blue default
                let textColor = 'FFFFFF';

                // Check if it is a day column
                if (c >= 7) {
                    const dayIndex = c - 7;
                    const day = days[dayIndex];
                    const dayOfWeek = day.date.getDay();
                    if (dayOfWeek === 0 || dayOfWeek === 6) {
                        // Saturday / Sunday: Grayed out
                        bgColor = 'E2E8F0'; // light gray
                        textColor = '475569'; // dark gray/slate
                    } else if (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5) {
                        // Monday / Wednesday / Friday: Highlighted
                        bgColor = 'FDE68A'; // Amber-200
                        textColor = '92400E'; // Amber-800
                    }
                }

                ws[cell].s = {
                    font: { bold: true, color: { rgb: textColor }, size: 10, name: 'Calibri' },
                    fill: { fgColor: { rgb: bgColor } },
                    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
                    border: {
                        top: { style: 'thin', color: { rgb: '94A3B8' } },
                        bottom: { style: 'medium', color: { rgb: '1E3A8A' } },
                        left: { style: 'thin', color: { rgb: '94A3B8' } },
                        right: { style: 'thin', color: { rgb: '94A3B8' } }
                    }
                };
            }

            // 2. Format Body cells
            for (let r = 1; r <= sheetRows.length; r++) {
                for (let c = headerRange.s.c; c <= headerRange.e.c; c++) {
                    const cell = XLSX.utils.encode_cell({ r, c });
                    if (!ws[cell]) ws[cell] = { t: 's', v: '' };

                    // Default body styles
                    let bgColor = 'FFFFFF';
                    let textColor = '000000';
                    let hAlign = 'left';

                    // Alignments
                    if (c === 0 || c === 2 || c === 4) {
                        hAlign = 'center'; // Pedido, Codigo, OPs
                    } else if (c === 5 || c === 6 || c >= 7) {
                        hAlign = 'right'; // Numbers
                    }

                    // Background color for weekend columns & highlight columns
                    if (c >= 7) {
                        const dayIndex = c - 7;
                        const day = days[dayIndex];
                        const dayOfWeek = day.date.getDay();
                        if (dayOfWeek === 0 || dayOfWeek === 6) {
                            bgColor = 'F1F5F9'; // slate-100 grayed out
                            textColor = '94A3B8';
                        } else if (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5) {
                            bgColor = 'FEF3C7'; // Amber-100 highlight
                        }
                    }

                    ws[cell].s = {
                        font: { size: 10, name: 'Calibri', color: { rgb: textColor } },
                        fill: { fgColor: { rgb: bgColor } },
                        alignment: { horizontal: hAlign, vertical: 'center' },
                        border: {
                            bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
                            right: { style: 'thin', color: { rgb: 'E2E8F0' } },
                            left: { style: 'thin', color: { rgb: 'E2E8F0' } },
                            top: { style: 'thin', color: { rgb: 'E2E8F0' } }
                        }
                    };

                    // Apply number formatting to numeric fields
                    if (c === 5 || c === 6 || (c >= 7 && typeof ws[cell].v === 'number')) {
                        ws[cell].t = 'n';
                        ws[cell].z = '#,##0';
                    }
                }
            }

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Programação');

            const dateStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
            XLSX.writeFile(wb, `Programacao_Entregas_${dateStr}.xlsx`, { cellStyles: true });
            toast.success('Planilha exportada com sucesso!');
        } catch (error) {
            console.error('Erro ao exportar planilha:', error);
            toast.error('Erro ao exportar planilha.');
        }
    };

    return (
        <div className={`
            ${isExpanded 
                ? 'fixed inset-0 z-[999] bg-gray-50 p-6 flex flex-col' 
                : 'flex-1 flex flex-col bg-white border border-gray-200 p-6 rounded-xl shadow-sm min-h-0'
            } transition-all duration-200
        `}>
            {/* Header controls */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-gray-100 pb-4 mb-4">
                <div>
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-blue-600" />
                        Matriz de Programação de Entregas
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Exibindo saldos a faturar. Arraste as quantidades entre as colunas para atualizar as datas PCP de entrega!
                    </p>
                </div>
                
                <div className="flex items-center gap-3">
                    {savingBackground && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md border border-gray-200">
                            <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                            <span>Salvando...</span>
                        </div>
                    )}
                    {/* Period selector */}
                    <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-lg border border-gray-200">
                        <span className="text-[10px] uppercase font-bold text-gray-500 px-1.5">Visualizar:</span>
                        <select
                            value={periodType}
                            onChange={(e) => handlePeriodTypeChange(e.target.value)}
                            className="px-2 py-1 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-md border border-gray-200 outline-none cursor-pointer transition-colors shadow-sm"
                        >
                            <option value="7">Esta Semana (7 dias)</option>
                            <option value="next7">Próxima Semana (7 dias)</option>
                            <option value="14">Quinzena (14 dias)</option>
                            <option value="30">Mês (30 dias)</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg border border-gray-200">
                        <button
                            onClick={handleToday}
                            className="px-3 py-1 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-md transition-colors shadow-sm"
                        >
                            Hoje
                        </button>
                        <button
                            onClick={handlePrevPeriod}
                            className="p-1 hover:bg-white text-gray-600 rounded-md transition-colors"
                            title="Período Anterior"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-semibold text-gray-700 px-2 min-w-[120px] text-center">
                            {days[0].date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} - {days[days.length - 1].date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                        </span>
                        <button
                            onClick={handleNextPeriod}
                            className="p-1 hover:bg-white text-gray-600 rounded-md transition-colors"
                            title="Próximo Período"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Export to Excel Button */}
                    <button
                        onClick={exportToExcel}
                        className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors border border-green-700 flex items-center gap-1.5 text-xs font-semibold shadow-sm"
                        title="Exportar Programação para Excel"
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>Exportar Excel</span>
                    </button>

                    {/* Expand/Restore Button */}
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors border border-gray-200 flex items-center gap-1.5 text-xs font-semibold"
                        title={isExpanded ? 'Retornar ao Layout Normal' : 'Expandir Exibição'}
                    >
                        {isExpanded ? (
                            <>
                                <Minimize2 className="w-4 h-4 text-blue-600" />
                                <span>Retornar</span>
                            </>
                        ) : (
                            <>
                                <Maximize2 className="w-4 h-4 text-blue-600" />
                                <span>Expandir</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Content area */}
            {loading && items.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    <span className="text-sm font-medium">{progress || 'Carregando entregas...'}</span>
                </div>
            ) : error ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 gap-2 text-red-500">
                    <AlertCircle className="w-8 h-8" />
                    <span className="text-sm font-semibold">{error}</span>
                </div>
            ) : groupedRows.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
                    <ShoppingCart className="w-8 h-8 opacity-40" />
                    <span className="text-sm">Nenhum registro com saldo a faturar encontrado.</span>
                </div>
            ) : (
                <div className={`flex-1 overflow-auto scrollbar-hide border border-gray-200 rounded-lg bg-white shadow-sm relative transition-all duration-200 ${isExpanded ? 'max-h-[calc(100vh-140px)]' : 'max-h-[calc(100vh-320px)]'}`}>
                    <table className="w-full text-left border-collapse text-xs">
                        <thead className="sticky top-0 bg-gray-50 z-10 border-b border-gray-200">
                            <tr>
                                <th className="px-4 py-3 font-bold text-gray-700 w-28 uppercase tracking-wider sticky left-0 bg-gray-50 shadow-[2px_0_5px_0_rgba(0,0,0,0.04)]">
                                    Pedido
                                </th>
                                <th className="px-4 py-3 font-bold text-gray-700 w-64 uppercase tracking-wider sticky left-[112px] bg-gray-50 shadow-[2px_0_5px_0_rgba(0,0,0,0.04)] border-r border-gray-200">
                                    Produto
                                </th>
                                {days.map(day => {
                                    const isToday = day.key === todayKey;
                                    return (
                                        <th 
                                            key={day.key} 
                                            className={`px-2 py-3 text-center min-w-[70px] border-r border-gray-200 last:border-0 relative ${
                                                isToday 
                                                    ? 'bg-blue-50/80 text-blue-700 border-x border-blue-200 shadow-sm' 
                                                    : (day.date.getDay() === 0 || day.date.getDay() === 6)
                                                        ? 'bg-gray-100/70 text-gray-400'
                                                        : (day.date.getDay() === 1 || day.date.getDay() === 3 || day.date.getDay() === 5)
                                                            ? 'bg-amber-50/70 text-amber-900 border-x border-amber-100/50 shadow-sm'
                                                            : ''
                                            }`}
                                        >
                                            {isToday && (
                                                <span className="absolute top-0.5 left-1/2 -translate-x-1/2 px-1 py-0.2 bg-blue-600 text-white rounded text-[8px] font-extrabold uppercase scale-90">
                                                    Hoje
                                                </span>
                                            )}
                                            <div className={`text-[10px] uppercase font-semibold ${
                                                isToday 
                                                    ? 'text-blue-600 mt-1' 
                                                    : (day.date.getDay() === 0 || day.date.getDay() === 6)
                                                        ? 'text-gray-400/80'
                                                        : (day.date.getDay() === 1 || day.date.getDay() === 3 || day.date.getDay() === 5)
                                                            ? 'text-amber-800/90'
                                                            : 'text-gray-400'
                                            }`}>
                                                {day.weekday}
                                            </div>
                                            <div className={`text-xs font-bold mt-0.5 ${
                                                isToday 
                                                    ? 'text-blue-700' 
                                                    : (day.date.getDay() === 0 || day.date.getDay() === 6)
                                                        ? 'text-gray-400/80'
                                                        : (day.date.getDay() === 1 || day.date.getDay() === 3 || day.date.getDay() === 5)
                                                            ? 'text-amber-950 font-extrabold'
                                                            : 'text-gray-800'
                                            }`}>
                                                {day.label}
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-150 bg-white">
                            {groupedRows.map((row, rIdx) => (
                                <tr key={rIdx} className="hover:bg-gray-50/50 transition-colors">
                                    {/* Pedido */}
                                    <td className="px-4 py-3 font-mono font-bold text-blue-600 sticky left-0 bg-white shadow-[2px_0_5px_0_rgba(0,0,0,0.02)]">
                                        {row.pedido}
                                    </td>
                                    {/* Produto */}
                                    <td className="px-4 py-3 sticky left-[112px] bg-white shadow-[2px_0_5px_0_rgba(0,0,0,0.02)] border-r border-gray-200">
                                        <div className="flex flex-col">
                                            <span 
                                                className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                                onClick={() => {
                                                    setSelectedProduct({ code: row.codigo, name: row.descricao });
                                                    setIsDocsModalOpen(true);
                                                }}
                                                title="Clique para ver desenhos técnicos e PDFs do produto"
                                            >
                                                {row.codigo}
                                            </span>
                                            <span className="text-[10px] text-gray-400 truncate max-w-[220px]" title={row.descricao}>
                                                {row.descricao}
                                            </span>
                                            {/* OP and Evolution Progress Bar */}
                                            {row.totalOpQtd > 0 && (
                                                <div className="mt-1.5 flex items-center gap-1.5 min-w-[120px] max-w-[240px]">
                                                    <span className="text-[9px] font-bold text-slate-400" title={`OPs: ${Array.from(row.opNumbers).join(', ')}`}>
                                                        OP: {Array.from(row.opNumbers).map(o => String(o).trim().substring(0, 6)).join(', ')}
                                                    </span>
                                                    <div className="flex-1 bg-gray-200 rounded-full h-1.5 max-w-[50px] overflow-hidden">
                                                        <div 
                                                            className={`h-1.5 rounded-full ${row.totalSaldoProd >= row.totalOpQtd ? 'bg-green-500' : row.totalSaldoProd > 0 ? 'bg-blue-500' : 'bg-gray-300'}`} 
                                                            style={{ width: `${Math.min(100, (row.totalSaldoProd / row.totalOpQtd) * 100)}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className="text-[9px] font-bold text-gray-500">
                                                        {((row.totalSaldoProd / row.totalOpQtd) * 100).toFixed(0)}%
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    {/* Days matrix */}
                                    {days.map(day => {
                                        const dayItems = row.deliveries[day.key] || [];
                                        const isToday = day.key === todayKey;
                                        return (
                                            <td 
                                                key={day.key} 
                                                className={`px-2 py-3 text-center border-r border-gray-200 last:border-0 min-h-[40px] transition-colors ${
                                                    isToday 
                                                        ? 'bg-blue-50/15 border-x border-blue-100/50 hover:bg-blue-50/25' 
                                                        : (day.date.getDay() === 0 || day.date.getDay() === 6)
                                                            ? 'bg-gray-100/40 text-gray-400/80 hover:bg-gray-100/60'
                                                            : (day.date.getDay() === 1 || day.date.getDay() === 3 || day.date.getDay() === 5)
                                                                ? 'bg-amber-50/30 border-x border-amber-100/25 hover:bg-amber-50/50'
                                                                : 'hover:bg-gray-50/30'
                                                }`}
                                                onDragOver={handleDragOver}
                                                onDrop={(e) => handleDrop(e, day.key)}
                                            >
                                                {dayItems.length > 0 ? (
                                                    <div className="flex flex-col gap-1 items-center">
                                                        {dayItems.map((item, idx) => (
                                                            <span 
                                                                key={idx}
                                                                draggable="true"
                                                                onDragStart={(e) => handleDragStart(e, item, day.key)}
                                                                className="inline-block px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-md font-bold text-xs shadow-sm cursor-move hover:bg-blue-100 transition-colors select-none"
                                                                title={`Item ${item.item} - Clique e arraste para outro dia para atualizar a Data PCP`}
                                                            >
                                                                {parseFloat(item.saldo_fat || item.qtd_faturar || item.qtd || 0).toLocaleString('pt-BR')}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-300">-</span>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Docs Modal */}
            <DocsModal
                isOpen={isDocsModalOpen}
                onClose={() => setIsDocsModalOpen(false)}
                productCode={selectedProduct.code}
                productName={selectedProduct.name}
                canEdit={true}
            />
        </div>
    );
}
