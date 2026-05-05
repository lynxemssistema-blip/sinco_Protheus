import { useState, useRef, useCallback } from 'react';
import { getPedidos, getPedidosFlat, getItensPedido } from '../services/api';

const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 2000;

// Exponential backoff: 2s, 4s, 8s
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Custom hook that encapsulates fetch logic, AbortController management,
 * exponential backoff on 500 errors, and individual-row polling after PCP save.
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
    const [retryInfo, setRetryInfo] = useState(null); // { attempt, maxRetries }

    const [orderItems, setOrderItems] = useState({});
    const [itemsLoading, setItemsLoading] = useState(false);

    const abortRef = useRef(null);

    const fetchData = useCallback(async (overrides = {}) => {
        // Cancel any in-flight request
        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        setError(null);
        setRetryInfo(null);

        const searchFilters = {
            cliente: overrides.cliente !== undefined ? overrides.cliente : filters.cliente,
            pedido: overrides.pedido !== undefined ? overrides.pedido : filters.pedido,
            produto: overrides.produto !== undefined ? overrides.produto : filters.produto,
            dataInicial: overrides.dataInicial !== undefined ? overrides.dataInicial : filters.dataInicial,
            dataFinal: overrides.dataFinal !== undefined ? overrides.dataFinal : filters.dataFinal,
            dateType: overrides.dateType !== undefined ? overrides.dateType : filters.dateType,
            tipo_item: overrides.tipo_item !== undefined ? overrides.tipo_item : filters.tipo_item,
            op_status: overrides.op_status !== undefined ? overrides.op_status : filters.op_status,
            only_active: overrides.only_active !== undefined ? overrides.only_active : filters.only_active,
        };
        const searchPage = overrides.page || page;
        const searchViewMode = overrides.viewMode || viewMode;
        const searchLimit = searchFilters.pedido ? 5000 : limit;
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
                    setOrders(data);
                    setTotalPages(Math.ceil(meta.total / searchLimit));
                    setRetryInfo(null);
                    setLoading(false); // ✅ success
                }
                return;
            } catch (err) {
                if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
                    setLoading(false); // ✅ cancelled
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
                    if (controller.signal.aborted) {
                        setLoading(false); // ✅ aborted during retry wait
                        return;
                    }
                    continue;
                }

                // Non-retryable or max retries reached
                if (!controller.signal.aborted) {
                    const serverError = err.response?.data;
                    const errorMsg = serverError
                        ? (typeof serverError === 'object' ? JSON.stringify(serverError, null, 2) : serverError)
                        : err.message;
                    setError(`Erro ao carregar dados: ${errorMsg}`);
                }
                setLoading(false); // ✅ error path
                return;
            }
        }

        // Exhausted retries
        if (!abortRef.current?.signal.aborted && lastError) {
            setError(`Servidor indisponível após ${MAX_RETRIES} tentativas. Por favor, tente novamente em alguns instantes.`);
        }
        setLoading(false); // ✅ exhausted retries
    }, [filters, page, viewMode, limit]);

    // After a PCP modal save, poll the order's items until the data reflects the change.
    // Replaces the hardcoded setTimeout(1000) pattern.
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
                    // Update tree view items cache
                    if (expandedOrderId === target.pedido) {
                        setOrderItems((prev) => ({ ...prev, [target.pedido]: updatedItems }));
                    }
                    // Update flat view
                    if (onFlatUpdate) {
                        onFlatUpdate(target.pedido, updatedItems);
                    }
                    break;
                }
            } catch (err) {
                console.error('Polling error for order items:', err);
                break;
            }
        }
    }, []);

    const handleExpandRow = useCallback(async (pedidoId, currentExpandedRow, setExpandedRow) => {
        if (currentExpandedRow === pedidoId) {
            setExpandedRow(null);
            return;
        }
        setExpandedRow(pedidoId);

        // Skip fetch if already cached
        if (orderItems[pedidoId]) return;

        setItemsLoading(true);
        try {
            const itens = await getItensPedido(pedidoId);
            setOrderItems((prev) => ({
                ...prev,
                [pedidoId]: Array.isArray(itens) ? itens : [],
            }));
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
        error,
        totalPages,
        retryInfo,
        orderItems,
        itemsLoading,
        fetchData,
        pollOrderItems,
        handleExpandRow,
        updateOrderItemsForPedido,
        updateFlatOrdersFromItems,
    };
};
