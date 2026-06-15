import { useState, useRef, useCallback, useEffect } from 'react';
import { getPedidos, getPedidosFlat, getItensPedido } from '../services/api';

const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 2000;
const DEBOUNCE_MS = 500; // text filter debounce

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Custom hook with:
 * - Exponential backoff on 500 errors
 * - Debounce (500ms) for text filters to avoid hammering the API on every keystroke
 * - Infinite scroll: page>1 appends instead of replacing
 * - hasNextPage instead of COUNT(*) total — backend fetches limit+1 to check
 *
 * @param {object} options
 * @param {number} options.limit - page size
 * @param {string} options.viewMode - 'tree' | 'flat'
 * @param {object} options.filters - filter values from FilterContext
 * @param {number} options.page - current page number
 */
export const useOrders = ({ limit, viewMode, filters, page }) => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [totalPages, setTotalPages] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [retryInfo, setRetryInfo] = useState(null);
    const [loadingMore, setLoadingMore] = useState(false);

    const [orderItems, setOrderItems] = useState({});
    const [itemsLoading, setItemsLoading] = useState(false);

    const abortRef = useRef(null);
    // Debounce timer refs per text filter
    const debounceRef = useRef(null);
    // Tracks the "settled" filters (after debounce fires)
    const [debouncedFilters, setDebouncedFilters] = useState(filters);

    // Text-based filter keys that should be debounced
    const TEXT_FILTER_KEYS = ['cliente', 'produto', 'pedcli'];

    useEffect(() => {
        const hasTextChange = TEXT_FILTER_KEYS.some(
            (k) => filters[k] !== debouncedFilters[k]
        );

        if (hasTextChange) {
            clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
                setDebouncedFilters({ ...filters });
            }, DEBOUNCE_MS);
        } else {
            // Non-text filter change (dates, selects) — apply immediately
            setDebouncedFilters({ ...filters });
        }

        return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters]);

    const fetchData = useCallback(async (overrides = {}) => {
        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        const searchPage = overrides.page || page;
        
        if (searchPage === 1) {
            setLoading(true);
            setOrders([]); // Clear immediately to trigger skeleton loading
        } else {
            setLoadingMore(true);
        }
        
        setError(null);
        setRetryInfo(null);

        // Use debouncedFilters for the actual request
        const activeFilters = overrides._useRawFilters ? filters : debouncedFilters;

        const searchFilters = {
            cliente: overrides.cliente !== undefined ? overrides.cliente : activeFilters.cliente,
            pedido: overrides.pedido !== undefined ? overrides.pedido : activeFilters.pedido,
            produto: overrides.produto !== undefined ? overrides.produto : activeFilters.produto,
            pedcli: overrides.pedcli !== undefined ? overrides.pedcli : activeFilters.pedcli,
            dataInicial: overrides.dataInicial !== undefined ? overrides.dataInicial : activeFilters.dataInicial,
            dataFinal: overrides.dataFinal !== undefined ? overrides.dataFinal : activeFilters.dataFinal,
            dateType: overrides.dateType !== undefined ? overrides.dateType : activeFilters.dateType,
            tipo_item: overrides.tipo_item !== undefined ? overrides.tipo_item : activeFilters.tipo_item,
            op_status: overrides.op_status !== undefined ? overrides.op_status : activeFilters.op_status,
            only_active: overrides.only_active !== undefined ? overrides.only_active : activeFilters.only_active,
            sortBy: overrides.sortBy !== undefined ? overrides.sortBy : activeFilters.sortBy,
            sortOrder: overrides.sortOrder !== undefined ? overrides.sortOrder : activeFilters.sortOrder,
        };
        const searchViewMode = overrides.viewMode || viewMode;
        // Never use a massive limit — keep pagination for all cases
        const searchLimit = limit;
        const reqOptions = { signal: controller.signal };

        let attempt = 0;
        let lastError = null;

        while (attempt <= MAX_RETRIES) {
            try {
                let result;
                if (searchViewMode === 'flat') {
                    result = await getPedidosFlat({ ...searchFilters, page: searchPage, limit: searchLimit }, reqOptions);
                } else {
                    result = await getPedidos({ ...searchFilters, page: searchPage, limit: searchLimit }, reqOptions);
                }

                if (!controller.signal.aborted) {
                    const { data, meta } = result;

                    if (searchPage === 1) {
                        setOrders(data);
                    } else {
                        // Infinite scroll: append new page, deduplicate by composite key
                        setOrders(prev => {
                            const idKey = searchViewMode === 'flat'
                                ? d => `${d.pedido}-${d.item}`
                                : d => d.pedido;
                            const existingIds = new Set(prev.map(idKey));
                            const newRows = data.filter(d => !existingIds.has(idKey(d)));
                            return [...prev, ...newRows];
                        });
                    }

                    // Backend returns hasNextPage (limit+1 trick) or total for tree view
                    const hnp = meta.hasNextPage ?? (data.length === searchLimit);
                    setHasNextPage(hnp);
                    setTotalPages(meta.total ? Math.ceil(meta.total / searchLimit) : (hnp ? searchPage + 1 : searchPage));
                    setRetryInfo(null);
                    setLoading(false);
                    setLoadingMore(false);
                }
                return;
            } catch (err) {
                if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
                    return;
                }
                lastError = err;

                const is5xx = err.response?.status >= 500;
                const isNetworkError = !err.response;

                if ((is5xx || isNetworkError) && attempt < MAX_RETRIES && !controller.signal.aborted) {
                    attempt++;
                    const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
                    setRetryInfo({ attempt, maxRetries: MAX_RETRIES, delayMs: delay });
                    await wait(delay);
                    if (controller.signal.aborted) { setLoading(false); return; }
                    continue;
                }

                if (!controller.signal.aborted) {
                    const serverError = err.response?.data;
                    const errorMsg = serverError
                        ? (typeof serverError === 'object' ? JSON.stringify(serverError, null, 2) : serverError)
                        : err.message;
                    setError(`Erro ao carregar dados: ${errorMsg}`);
                    setHasNextPage(false);
                    setTotalPages(0);
                }
                setLoading(false);
                setLoadingMore(false);
                return;
            }
        }

        if (!abortRef.current?.signal.aborted && lastError) {
            setError(`Servidor indisponível após ${MAX_RETRIES} tentativas. Por favor, tente novamente em alguns instantes.`);
            setHasNextPage(false);
            setTotalPages(0);
        }
        setLoading(false);
    }, [debouncedFilters, filters, page, viewMode, limit]);

    const pollOrderItems = useCallback(async (target, expandedOrderId, onFlatUpdate) => {
        if (!target || Array.isArray(target)) return;

        const MAX_POLL_ATTEMPTS = 4;
        const POLL_INTERVAL_MS = 600;

        for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
            await wait(POLL_INTERVAL_MS);
            try {
                const updatedItems = await getItensPedido(target.pedido);
                const targetUpdated = updatedItems.find((u) => u.item === target.item);
                const hasChanged = targetUpdated && (
                    targetUpdated.pcp_delivery_forecast_date !== target.pcp_delivery_forecast_date ||
                    targetUpdated.pcp_delivery_forecast_qtd !== target.pcp_delivery_forecast_qtd
                );

                if (hasChanged || i === MAX_POLL_ATTEMPTS - 1) {
                    if (expandedOrderId === target.pedido) {
                        setOrderItems((prev) => ({ ...prev, [target.pedido]: updatedItems }));
                    }
                    if (onFlatUpdate) onFlatUpdate(target.pedido, updatedItems);
                    break;
                }
            } catch (err) {
                console.error('Polling error for order items:', err);
                break;
            }
        }
    }, []);

    const handleExpandRow = useCallback(async (pedidoId, currentExpandedRow, setExpandedRow) => {
        if (currentExpandedRow === pedidoId) { setExpandedRow(null); return; }
        setExpandedRow(pedidoId);
        if (orderItems[pedidoId]) return;

        setItemsLoading(true);
        try {
            const itens = await getItensPedido(pedidoId);
            setOrderItems((prev) => ({ ...prev, [pedidoId]: Array.isArray(itens) ? itens : [] }));
        } catch (err) {
            console.error(`Erro ao buscar itens do pedido ${pedidoId}:`, err);
        } finally {
            setItemsLoading(false);
        }
    }, [orderItems]);

    const updateOrderItemsForPedido = useCallback((pedidoId, updatedItems) => {
        setOrderItems((prev) => ({ ...prev, [pedidoId]: updatedItems }));
    }, []);

    const updateFlatOrdersFromItems = useCallback((pedidoId, updatedItems) => {
        setOrders((prev) =>
            prev.map((o) => {
                if (o.pedido === pedidoId) {
                    const updated = updatedItems.find((u) => u.item === o.item);
                    return updated ? { ...o, ...updated } : o;
                }
                return o;
            })
        );
    }, []);

    return {
        orders,
        setOrders,
        loading,
        loadingMore,
        error,
        totalPages,
        hasNextPage,
        retryInfo,
        orderItems,
        itemsLoading,
        fetchData,
        pollOrderItems,
        handleExpandRow,
        updateOrderItemsForPedido,
        updateFlatOrdersFromItems,
        debouncedFilters,
    };
};
