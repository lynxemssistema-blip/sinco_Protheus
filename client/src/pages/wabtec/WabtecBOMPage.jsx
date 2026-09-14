import React, { useState, useEffect } from 'react';
import { Download, FileText, RefreshCcw, Loader2, ListTree, AlignEndHorizontal } from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-toastify';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function WabtecBOMPage({ selectedLote }) {
    const [loading, setLoading] = useState(false);
    const [extracting, setExtracting] = useState(false);
    const [bomData, setBomData] = useState([]);
    const [viewMode, setViewMode] = useState('detalhada'); // 'detalhada' | 'aglutinada'

    const fetchBOM = async () => {
        if (!selectedLote) return;
        setLoading(true);
        try {
            const { data } = await api.get(`/wabtec/bom/${selectedLote}`);
            setBomData(data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBOM();
    }, [selectedLote]);

    const handleExtract = async () => {
        if (!selectedLote) return toast.warning('Selecione um lote primeiro.');
        setExtracting(true);
        try {
            await toast.promise(
                api.post(`/wabtec/extrair-bom/${selectedLote}`, {}, { timeout: 300000 }), // 5 minutos de timeout
                {
                    pending: 'Conectando ao Protheus e extraindo estrutura BOM...',
                    success: 'BOM extraída e salva com sucesso!',
                    error: {
                        render({ data }) {
                            return data.response?.data?.error || 'Erro ao extrair BOM do Protheus.';
                        }
                    }
                }
            );
            fetchBOM();
        } finally {
            setExtracting(false);
        }
    };

    const handleExportExcel = async () => {
        if (!selectedLote) return;
        try {
            const response = await api.get(`/wabtec/exportar-bom/${selectedLote}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `BOM_Wabtec_${selectedLote}.xlsx`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            toast.error('Erro ao exportar Excel.');
        }
    };

    const handleExportPDF = () => {
        const doc = new jsPDF('landscape', 'pt', 'a4');
        doc.setFontSize(14);
        doc.text(`Lista de Materiais - Lote ${selectedLote} (${viewMode === 'detalhada' ? 'Detalhada' : 'Aglutinada'})`, 40, 40);
        
        let tableColumns = [];
        let tableRows = [];

        if (viewMode === 'detalhada') {
            tableColumns = ["Des. Cliente", "Prod. Base", "Nível", "Componente", "Descrição", "Unid", "Qtd. Total"];
            tableRows = displayedData.map(d => [
                d.desenho_cliente || '-',
                d.protheus_cod || '-',
                d.nivel?.toString() || '0',
                d.componente_cod || '-',
                d.descricao || '-',
                d.um || '-',
                Number(d.quantidade_total).toFixed(4)
            ]);
        } else {
            tableColumns = ["Componente", "Descrição", "Unid", "Qtd. Total Consol."];
            tableRows = displayedData.map(d => [
                d.componente_cod || '-',
                d.descricao || '-',
                d.um || '-',
                Number(d.quantidade_total).toFixed(4)
            ]);
        }

        autoTable(doc, {
            head: [tableColumns],
            body: tableRows,
            startY: 60,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [79, 70, 229] }
        });

        doc.save(`BOM_Wabtec_${selectedLote}_${viewMode}.pdf`);
    };

    // Calculate aggregated data
    const getAggregatedData = () => {
        const map = {};
        bomData.forEach(d => {
            const key = d.componente_cod;
            if (!map[key]) {
                map[key] = {
                    componente_cod: d.componente_cod,
                    descricao: d.descricao,
                    um: d.um,
                    quantidade_total: 0
                };
            }
            map[key].quantidade_total += parseFloat(d.quantidade_total) || 0;
        });
        return Object.values(map).sort((a, b) => a.componente_cod.localeCompare(b.componente_cod));
    };

    const displayedData = viewMode === 'detalhada' ? bomData : getAggregatedData();

    if (!selectedLote) {
        return <div className="text-slate-500 p-6 text-center border border-dashed rounded-lg">Selecione um lote na aba 1 para visualizar a Lista de Materiais.</div>;
    }

    return (
        <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg shadow-xs">
                <div className="flex items-center gap-2 flex-wrap">
                    <button 
                        onClick={handleExtract}
                        disabled={extracting}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-xs disabled:opacity-50 transition"
                    >
                        {extracting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
                        Extrair / Atualizar do Protheus
                    </button>
                    <div className="flex bg-slate-100 p-0.5 rounded-md border border-slate-200">
                        <button 
                            onClick={() => setViewMode('detalhada')}
                            className={`px-2.5 py-1 text-xs font-medium rounded flex items-center gap-1.5 transition ${viewMode === 'detalhada' ? 'bg-white shadow-xs text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <ListTree className="w-3.5 h-3.5" /> Detalhada
                        </button>
                        <button 
                            onClick={() => setViewMode('aglutinada')}
                            className={`px-2.5 py-1 text-xs font-medium rounded flex items-center gap-1.5 transition ${viewMode === 'aglutinada' ? 'bg-white shadow-xs text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <AlignEndHorizontal className="w-3.5 h-3.5" /> Aglutinada
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    <button onClick={handleExportExcel} className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-xs transition">
                        <Download className="w-3.5 h-3.5" /> Exportar Excel
                    </button>
                    <button onClick={handleExportPDF} className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-xs transition">
                        <FileText className="w-3.5 h-3.5" /> Exportar PDF
                    </button>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex flex-col">
                {extracting ? (
                    <div className="flex flex-col items-center justify-center p-16 text-slate-500 animate-in fade-in duration-300">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
                        <h3 className="text-sm font-semibold text-slate-700">Processando Árvore do Produto</h3>
                        <p className="text-xs text-slate-400 mt-1">Conectando ao Protheus e extraindo a Lista de Materiais (BOM)... Isso pode levar alguns segundos.</p>
                    </div>
                ) : loading ? (
                    <div className="flex flex-col items-center justify-center p-12 text-slate-500">
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mb-2" />
                        <p className="text-xs">Carregando estrutura...</p>
                    </div>
                ) : displayedData.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs">
                        Nenhuma lista de materiais extraída para este lote. Clique em "Extrair / Atualizar".
                    </div>
                ) : (
                    <div className="overflow-auto max-h-[calc(100vh-210px)] min-h-[440px]">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-600 uppercase bg-slate-50 sticky top-0 shadow-sm z-10">
                                <tr>
                                    {viewMode === 'detalhada' && (
                                        <>
                                            <th className="px-4 py-3 font-semibold">Des. Cliente</th>
                                            <th className="px-4 py-3 font-semibold">Produto (Raiz)</th>
                                            <th className="px-4 py-3 font-semibold text-center">Nível</th>
                                        </>
                                    )}
                                    <th className="px-4 py-3 font-semibold">Componente</th>
                                    <th className="px-4 py-3 font-semibold">Descrição</th>
                                    <th className="px-4 py-3 font-semibold text-center">UN</th>
                                    <th className="px-4 py-3 font-semibold text-right">Qtd. Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {displayedData.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                                        {viewMode === 'detalhada' && (
                                            <>
                                                <td className="px-4 py-2.5 font-medium text-slate-700">{row.desenho_cliente}</td>
                                                <td className="px-4 py-2.5 text-slate-600">{row.protheus_cod}</td>
                                                <td className="px-4 py-2.5 text-center text-slate-500">
                                                    <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-sm text-xs font-semibold ${row.nivel === 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                                                        {row.nivel}
                                                    </span>
                                                </td>
                                            </>
                                        )}
                                        <td className="px-4 py-2.5 font-medium text-slate-800">{row.componente_cod}</td>
                                        <td className="px-4 py-2.5 text-slate-600">{row.descricao}</td>
                                        <td className="px-4 py-2.5 text-center text-slate-500">{row.um}</td>
                                        <td className="px-4 py-2.5 text-right font-medium text-slate-700">
                                            {Number(row.quantidade_total).toFixed(4)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
