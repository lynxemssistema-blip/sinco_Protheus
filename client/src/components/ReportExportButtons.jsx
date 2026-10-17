/**
 * // FEAT (IA): Motor Relatorios Lynxems
 * client/src/components/ReportExportButtons.jsx
 * 
 * Componente visual de botões de exportação padronizados Lynxems.
 * Permite acionar facilmente a exportação para Excel e PDF com estados de carregamento
 * e layout industrial moderno.
 */

import React, { useState } from 'react';
import { FileSpreadsheet, FileText, Download, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';

export default function ReportExportButtons({
    onExportExcel,
    onExportPdf,
    disabled = false,
    className = ''
}) {
    const [loadingExcel, setLoadingExcel] = useState(false);
    const [loadingPdf, setLoadingPdf] = useState(false);

    const handleExcel = async () => {
        if (!onExportExcel || loadingExcel || disabled) return;
        try {
            setLoadingExcel(true);
            await onExportExcel();
            toast.success('Relatório Excel gerado com sucesso!');
        } catch (err) {
            console.error('[ExportButtons] Erro ao exportar Excel:', err);
            toast.error('Erro ao gerar relatório Excel.');
        } finally {
            setLoadingExcel(false);
        }
    };

    const handlePdf = async () => {
        if (!onExportPdf || loadingPdf || disabled) return;
        try {
            setLoadingPdf(true);
            await onExportPdf();
            toast.success('Relatório PDF gerado com sucesso!');
        } catch (err) {
            console.error('[ExportButtons] Erro ao exportar PDF:', err);
            toast.error('Erro ao gerar relatório PDF.');
        } finally {
            setLoadingPdf(false);
        }
    };

    return (
        <div className={`inline-flex items-center gap-1.5 ${className}`}>
            {onExportExcel && (
                <button
                    type="button"
                    onClick={handleExcel}
                    disabled={disabled || loadingExcel}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-emerald-300/80 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-400 transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
                    title="Exportar para planilha Excel (.xlsx)"
                >
                    {loadingExcel ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                    ) : (
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    )}
                    <span>Excel</span>
                </button>
            )}

            {onExportPdf && (
                <button
                    type="button"
                    onClick={handlePdf}
                    disabled={disabled || loadingPdf}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
                    title="Exportar para documento PDF (.pdf)"
                >
                    {loadingPdf ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600" />
                    ) : (
                        <FileText className="w-3.5 h-3.5 text-rose-600" />
                    )}
                    <span>PDF</span>
                </button>
            )}
        </div>
    );
}
