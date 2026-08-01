import React, { useState, useEffect } from 'react';
import { X, Loader2, Layers, AlertCircle, FileSpreadsheet, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDFLib from 'jspdf';
const jsPDF = jsPDFLib.jsPDF || jsPDFLib;
import autoTable from 'jspdf-autotable';
import { getEstruturaProduto, getProductStatusesBatch } from '../services/api';

const ReportStructureModal = ({ isOpen, onClose, codigo }) => {
    const [structure, setStructure] = useState([]);
    const [statuses, setStatuses] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const handleExportExcel = () => {
        const data = structure.map(item => ({
            'Nível': item.nivel,
            'Código': item.codigo,
            'Descrição': item.descricao,
            'UM': item.unidade || '-',
            'Qtd': item.qtd_necessaria || '-',
            'Status Eng.': statuses[item.codigo] || 'NORMAL'
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Estrutura");
        XLSX.writeFile(wb, `Estrutura_${codigo}.xlsx`);
    };

    const handleExportPdf = () => {
        const doc = new jsPDF('portrait', 'mm', 'a4');
        
        const drawHeader = () => {
            const pageWidth = doc.internal.pageSize.getWidth();
            const ML = 10;
            const MR = 10;
            const usableW = pageWidth - ML - MR;
            const hY = 8;
            const hH = 16;
            
            doc.setDrawColor(0);
            doc.setLineWidth(0.3);
            doc.rect(ML, hY, usableW, hH);

            const col1 = ML + 45;
            const col2 = ML + 130;
            doc.setLineWidth(0.2);
            [col1, col2].forEach(x => doc.line(x, hY, x, hY + hH));

            // Logo Block
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.text('METALFISA', ML + 4, hY + 6);
            doc.setFontSize(5.5);
            doc.setFont('helvetica', 'normal');
            doc.text('Transformando metais em excelência', ML + 4, hY + 10);

            // Company Block
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'bold');
            doc.text('METALFISA METALURGICA LTDA', col1 + 3, hY + 5.5);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.text('CNPJ: 23.881.592/0001-01', col1 + 3, hY + 9.5);
            doc.text('PCP - Planejamento e Controle de Produção', col1 + 3, hY + 13.5);

            // Emission & Title Block
            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'bold');
            doc.text('EMISSÃO:', col2 + 3, hY + 5.5);
            doc.setFont('helvetica', 'normal');
            
            const now = new Date();
            const emissionDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
            doc.text(emissionDate, col2 + 15, hY + 5.5);

            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('ESTRUTURA DO PRODUTO', col2 + (usableW - (col2 - ML)) / 2, hY + 10.5, { align: 'center' });
            
            doc.setFontSize(8);
            doc.text(codigo, col2 + (usableW - (col2 - ML)) / 2, hY + 14.5, { align: 'center' });
            
            return hY + hH + 4;
        };

        const startY = drawHeader();
        
        const tableData = structure.map(item => [
            item.nivel.toString(),
            item.codigo,
            item.descricao,
            item.unidade || '-',
            item.qtd_necessaria != null ? Number(item.qtd_necessaria).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '-',
            statuses[item.codigo] || 'NORMAL'
        ]);

        autoTable(doc, {
            startY,
            head: [['Nível', 'Código', 'Descrição', 'UM', 'Qtd', 'Status Eng.']],
            body: tableData,
            styles: { fontSize: 7, font: 'helvetica' },
            headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [245, 247, 250] },
            margin: { left: 10, right: 10 },
            didDrawPage: (data) => {
                if (data.pageNumber > 1) {
                    drawHeader();
                }
                const str = 'Página ' + doc.internal.getNumberOfPages();
                doc.setFontSize(6);
                doc.text(str, data.settings.margin.left, doc.internal.pageSize.height - 5);
            }
        });

        doc.save(`Estrutura_${codigo}.pdf`);
    };

    useEffect(() => {
        if (!isOpen || !codigo) return;
        
        let isMounted = true;
        setLoading(true);
        setError(null);

        const fetchBOM = async () => {
            try {
                // Fetch BOM
                const est = await getEstruturaProduto(codigo);
                if (!isMounted) return;
                setStructure(est);

                // Fetch Statuses — inclui o produto raiz + todos os filhos
                if (est && est.length > 0) {
                    const codes = [codigo, ...est.map(i => i.codigo)];
                    const st = await getProductStatusesBatch(codes);
                    if (isMounted) setStatuses(st);
                }
            } catch (err) {
                console.error("Erro ao carregar estrutura:", err);
                if (isMounted) setError("Falha ao carregar a estrutura do produto.");
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchBOM();

        return () => { isMounted = false; };
    }, [isOpen, codigo]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh] overflow-hidden">
                <div className="bg-slate-100 px-5 py-4 flex justify-between items-center border-b border-slate-200 shrink-0">
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <Layers className="w-5 h-5 text-blue-600" /> 
                            Estrutura do Produto: <span className="font-mono text-red-600 tracking-wider ml-1">{codigo}</span>
                        </h3>
                    </div>
                    <div className="flex items-center gap-3">
                        {structure.length > 0 && (
                            <>
                                <button type="button" onClick={handleExportExcel} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition-colors shadow-sm">
                                    <FileSpreadsheet className="w-4 h-4" /> Excel
                                </button>
                                <button type="button" onClick={handleExportPdf} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors shadow-sm">
                                    <FileText className="w-4 h-4" /> PDF
                                </button>
                            </>
                        )}
                        <button type="button" onClick={onClose}
                            className="p-1 hover:bg-slate-200 rounded-full transition-colors text-slate-500 ml-2">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>
                
                <div className="p-5 overflow-y-auto flex-1 bg-slate-50">
                    {loading ? (
                        <div className="py-16 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                            <span className="text-sm font-medium">Carregando estrutura e status...</span>
                        </div>
                    ) : error ? (
                        <div className="py-16 text-center text-red-500 flex flex-col items-center justify-center gap-3">
                            <AlertCircle className="w-8 h-8 opacity-75" />
                            <span className="text-sm font-medium">{error}</span>
                        </div>
                    ) : structure.length === 0 ? (
                        <div className="py-16 text-center text-slate-400">
                            Nenhuma estrutura encontrada para este código.
                        </div>
                    ) : (
                        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider w-16 text-center">Nível</th>
                                        <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider w-36">Código</th>
                                        <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider">Descrição</th>
                                        <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider w-16 text-center">UM</th>
                                        <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider w-24 text-right">Qtd</th>
                                        <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider w-28 text-center">Status Eng.</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {structure.map((item, idx) => {
                                        const status = statuses[item.codigo] || 'NORMAL';
                                        let statusClasses = "bg-slate-100 text-slate-600 border-slate-200"; // NORMAL
                                        if (status === 'NOVO') {
                                            statusClasses = "bg-green-100 text-green-700 border-green-200";
                                        } else if (status === 'REVISAO') {
                                            statusClasses = "bg-yellow-100 text-yellow-700 border-yellow-200";
                                        }

                                        const indent = item.nivel * 16;
                                        const isParent = item.nivel === 0;

                                        return (
                                            <tr key={idx} className={`hover:bg-blue-50/50 transition-colors ${isParent ? 'bg-slate-50' : ''}`}>
                                                <td className="px-4 py-3 text-center font-bold text-slate-400">
                                                    {item.nivel}
                                                </td>
                                                <td className={`px-4 py-3 font-mono ${isParent ? 'font-bold text-slate-800' : 'text-slate-600'}`}>
                                                    {item.codigo}
                                                </td>
                                                <td className="px-4 py-3 font-medium text-slate-700" style={{ paddingLeft: `${indent + 16}px` }}>
                                                    <div className="flex items-center gap-1.5">
                                                        {item.nivel > 0 && <span className="text-slate-300">↳</span>}
                                                        <span className={isParent ? 'font-bold' : ''}>{item.descricao || '-'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center text-slate-500">
                                                    {item.unidade || '-'}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono font-medium text-slate-600">
                                                    {item.qtd_necessaria != null ? Number(item.qtd_necessaria).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-bold border tracking-wide uppercase ${statusClasses}`}>
                                                        {status}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReportStructureModal;
