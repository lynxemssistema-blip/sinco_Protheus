import React, { useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import FlatItemRow from './FlatItemRow';

/**
 * VirtualFlatList — Renders only visible rows using @tanstack/react-virtual.
 * The DOM only holds ~40-60 rows regardless of total dataset size.
 *
 * Props mirror the original orders.map() FlatItemRow usage.
 * Extra props:
 *   - scrollContainerRef: the ref attached to the scrollable div that wraps the table
 *   - hasNextPage: boolean from useOrders
 *   - onLoadMore: callback to fetch the next page
 *   - loadingMore: boolean — shows loading sentinel when fetching page N>1
 */
const VirtualFlatList = ({
    orders,
    scrollContainerRef,
    hasNextPage,
    onLoadMore,
    loadingMore,
    // FlatItemRow shared props
    colConfig,
    locationPathname,
    selectedItems,
    activeRowKey,
    setActiveRowKey,
    printingOrderId,
    openActionMenu,
    menuPosition,
    handleSelectItem,
    handleOpenDocs,
    setEngineeringTarget,
    setPcpForecastTarget,
    setNotesTarget,
    setSelectedInvoice,
    setInvoiceModalItem,
    setOpenActionMenu,
    formatProtheusDate,
    handlePrintOPMirror,
    handlePrintFichas,
    handlePrintOPByOperation,
    handlePrintOPByOperationWithDrawings,
    handlePrintOPByResourceWithDrawings,
    handlePrintOPWithOpsStampWithDrawings,
    handleExportOPByOperationExcel,
    setMenuPosition,
    handleUpdateFaturamentoDate,
}) => {
    const sentinelRef = useRef(null);

    const rowVirtualizer = useVirtualizer({
        count: orders.length,
        getScrollElement: () => scrollContainerRef.current,
        estimateSize: () => 44, // ~44px per row — adjust if row height changes
        overscan: 20,
    });

    const virtualItems = rowVirtualizer.getVirtualItems();
    const totalSize = rowVirtualizer.getTotalSize();

    // Use a ref for onLoadMore to avoid recreating the observer on every render
    const onLoadMoreRef = useRef(onLoadMore);
    useEffect(() => {
        onLoadMoreRef.current = onLoadMore;
    }, [onLoadMore]);

    // Local lock to prevent rapid firing before 'loadingMore' propagates back from Context
    const isFetchingRef = useRef(false);
    useEffect(() => {
        if (loadingMore) {
            isFetchingRef.current = true;
        } else {
            // Small delay to allow DOM to settle after rendering new items
            const timer = setTimeout(() => { isFetchingRef.current = false; }, 100);
            return () => clearTimeout(timer);
        }
    }, [loadingMore]);

    // IntersectionObserver — fires onLoadMore when sentinel enters viewport
    useEffect(() => {
        if (!sentinelRef.current || !hasNextPage) return;
        
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && !isFetchingRef.current && !loadingMore) {
                    isFetchingRef.current = true; // Lock immediately!
                    onLoadMoreRef.current();
                }
            },
            { root: scrollContainerRef.current, rootMargin: '200px', threshold: 0 }
        );
        
        observer.observe(sentinelRef.current);
        return () => observer.disconnect();
    }, [hasNextPage, loadingMore, scrollContainerRef]);

    const visibleColumns = colConfig.filter(c => c.visible);

    // Padding rows to maintain scrollbar position (virtualizer technique)
    const paddingTop = virtualItems.length > 0 ? (virtualItems[0].start ?? 0) : 0;
    const paddingBottom = virtualItems.length > 0
        ? totalSize - (virtualItems[virtualItems.length - 1]?.end ?? 0)
        : 0;

    return (
        <>
            {/* Top spacer — keeps scrollbar proportional */}
            {paddingTop > 0 && (
                <tr style={{ height: paddingTop }}>
                    <td colSpan={visibleColumns.length} />
                </tr>
            )}

            {virtualItems.map(vRow => {
                const item = orders[vRow.index];
                if (!item) return null;
                return (
                    <FlatItemRow
                        key={`${item.pedido}-${item.item}-${vRow.index}`}
                        item={item}
                        index={vRow.index}
                        visibleColumns={visibleColumns}
                        locationPathname={locationPathname}
                        isSelected={selectedItems.some(i => i.pedido === item.pedido && i.item === item.item)}
                        isActive={activeRowKey === `${item.pedido}-${item.item}`}
                        onSetActiveRow={setActiveRowKey}
                        printingOrderId={printingOrderId}
                        openActionMenu={openActionMenu}
                        menuPosition={menuPosition}
                        onSelectItem={handleSelectItem}
                        onOpenDocs={handleOpenDocs}
                        onSetEngineeringTarget={setEngineeringTarget}
                        onSetPcpForecastTarget={setPcpForecastTarget}
                        onSetNotesTarget={setNotesTarget}
                        onSetInvoiceModal={({ nf, item: it }) => { setSelectedInvoice(nf); setInvoiceModalItem(it); }}
                        onOpenActionMenu={setOpenActionMenu}
                        formatProtheusDate={formatProtheusDate}
                        onPrintOPMirror={handlePrintOPMirror}
                        onPrintFichas={handlePrintFichas}
                        onPrintOPByOperation={handlePrintOPByOperation}
                        onPrintOPByOperationWithDrawings={handlePrintOPByOperationWithDrawings}
                        onPrintOPByResourceWithDrawings={handlePrintOPByResourceWithDrawings}
                        onPrintOPWithOpsStampWithDrawings={handlePrintOPWithOpsStampWithDrawings}
                        onExportOPByOperationExcel={handleExportOPByOperationExcel}
                        onSetMenuPosition={setMenuPosition}
                        onUpdateFaturamentoDate={handleUpdateFaturamentoDate}
                    />
                );
            })}

            {/* Bottom spacer */}
            {paddingBottom > 0 && (
                <tr style={{ height: paddingBottom }}>
                    <td colSpan={visibleColumns.length} />
                </tr>
            )}

            {/* Infinite scroll sentinel — sits below the last row */}
            <tr ref={sentinelRef} style={{ height: 1 }}>
                <td colSpan={visibleColumns.length} />
            </tr>
        </>
    );
};

export default VirtualFlatList;
