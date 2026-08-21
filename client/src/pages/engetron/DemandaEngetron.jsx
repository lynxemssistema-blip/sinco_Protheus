import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle2, AlertTriangle, Play, FileUp, Zap, Info, Package, Search, Calendar, Table, Check, Layers, FileSpreadsheet, RefreshCw, Download, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import api, { getProductDocuments, getFileUrl } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { generateEngetronPdf } from '../../services/engetronPdfGenerator';

const DemandaEngetron = () => {
    const { user } = useAuth();
    const [file, setFile] = useState(null);
    const [previewData, setPreviewData] = useState([]);
    const [detailedResults, setDetailedResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [openingPdf, setOpeningPdf] = useState(null);
    const [message, setMessage] = useState(null);
    
    // Drag/drop refs
    const fileInputRef = useRef(null);

    const handleFileDrop = (e) => {
        e.preventDefault();
        const uploadedFile = e.dataTransfer ? e.dataTransfer.files[0] : e.target.files[0];
        if (uploadedFile) {
            setFile(uploadedFile);
            processExcel(uploadedFile);
        }
    };

    const processExcel = (uploadedFile) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            
            // Assume the first sheet is the one we want
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // Convert to JSON (array of arrays to get by index)
            const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            const parsed = [];
            
            // Skip header row (index 0)
            for (let i = 1; i < rawRows.length; i++) {
                const row = rawRows[i];
                if (!row || row.length === 0) continue;
                
                const item = row[1];
                const pedido = row[2];
                const produto = row[4];
                let dataPcp = row[7];
                
                // If the entire row is empty, skip
                if (!pedido && !item && !produto && !dataPcp) continue;
                
                parsed.push({
                    item: item || '',
                    pedido: pedido || '',
                    produto: produto || '',
                    data_pcp: dataPcp || ''
                });
            }
            
            setPreviewData(parsed);
            setDetailedResults([]); // Limpa resultados anteriores
        };
        reader.readAsArrayBuffer(uploadedFile);
    };

    const handleImport = async () => {
        if (previewData.length === 0) {
            setMessage({ type: 'error', text: 'Nenhum dado para importar.' });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            const response = await api.post('/engetron/importar-pcp', {
                rows: previewData,
                usuario: user?.nome || user?.NomeCompleto || 'Usuário'
            });

            setMessage({ type: 'success', text: response.data.message || 'Importação realizada com sucesso!' });
            if (response.data.detailedResults) {
                // Filtra nulls para os casos de linhas vazias puladas
                setDetailedResults(response.data.detailedResults.filter(Boolean));
            }
        } catch (error) {
            console.error('Erro na importação:', error);
            setMessage({ 
                type: 'error', 
                text: error.response?.data?.error || 'Ocorreu um erro ao comunicar com o servidor.' 
            });
        } finally {
            setLoading(false);
        }
    };

    // Helper para exibir datas de forma legível no preview
    const formatDate = (val) => {
        if (!val) return '-';
        if (val instanceof Date) {
            return val.toLocaleDateString('pt-BR');
        }
        return String(val);
    };

    const handleExportExcel = () => {
        if (previewData.length === 0) return;

        const exportRows = previewData.map((item, idx) => {
            const res = detailedResults[idx];
            return {
                'Nº do Pedido': item.pedido || '-',
                'Item do Pedido': item.item || '-',
                'Código Produto': item.produto || '-',
                'Data Prevista (PCP)': formatDate(item.data_pcp),
                'Status do Processamento': res ? res.reason : '-'
            };
        });

        const ws = XLSX.utils.json_to_sheet(exportRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Importacao_Engetron');
        XLSX.writeFile(wb, `Relatorio_Importacao_Engetron_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const handleExportPdf = () => {
        if (previewData.length === 0) return;
        try {
            generateEngetronPdf({
                items: previewData,
                results: detailedResults,
                fileName: 'Relatorio_Importacao_Engetron'
            });
        } catch (err) {
            alert('Erro ao gerar relatório PDF: ' + err.message);
        }
    };

    const handleOpenDrawing = async (codigoProduto) => {
        if (!codigoProduto || codigoProduto === '-') return;
        try {
            setOpeningPdf(codigoProduto);
            const docs = await getProductDocuments(codigoProduto);
            if (docs && docs.length > 0) {
                const desenho = docs.find(d => 
                    d.tipo === 'Desenho' || 
                    d.titulo_desenho || 
                    (d.url_arquivo && d.url_arquivo.toLowerCase().endsWith('.pdf')) ||
                    (d.nome_arquivo && d.nome_arquivo.toLowerCase().endsWith('.pdf'))
                ) || docs[0];

                if (desenho && (desenho.url_arquivo || desenho.id)) {
                    const targetUrl = desenho.url_arquivo 
                        ? getFileUrl(`/api/docs/view?path=${encodeURIComponent(desenho.url_arquivo)}`)
                        : getFileUrl(`/api/docs/${desenho.id}/view`);
                    window.open(targetUrl, '_blank');
                } else {
                    alert(`Nenhum arquivo PDF/Desenho encontrado para ${codigoProduto}.`);
                }
            } else {
                alert(`Nenhum documento/desenho cadastrado para o produto ${codigoProduto}.`);
            }
        } catch (err) {
            console.error('Erro ao abrir desenho:', err);
            alert(`Erro ao buscar o desenho do produto ${codigoProduto}.`);
        } finally {
            setOpeningPdf(null);
        }
    };

    return (
        <div className="w-full px-4 sm:px-6 py-4 space-y-4 text-slate-800 animate-in fade-in duration-500">
            {/* Top Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                        <FileSpreadsheet className="w-8 h-8" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                                Demanda Engetron (Leitura Planilha e PCP)
                            </h1>
                        </div>
                        <p className="text-sm text-slate-500">
                            Upload da planilha da Engetron para atualizar as Datas de Entrega PCP no sistema (apenas pedidos ENGETRON ENG com saldo).
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    {previewData.length > 0 && detailedResults.length > 0 && (
                        <>
                            <button
                                onClick={handleExportPdf}
                                className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold shadow-sm transition active:scale-95 cursor-pointer"
                                title="Exportar Relatório PDF Oficial"
                            >
                                <FileText className="w-4 h-4" />
                                <span>PDF</span>
                            </button>
                            <button
                                onClick={handleExportExcel}
                                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-sm transition active:scale-95 cursor-pointer"
                                title="Exportar para Excel"
                            >
                                <Download className="w-4 h-4" />
                                <span>Excel</span>
                            </button>
                        </>
                    )}
                    <button
                        onClick={handleImport}
                        disabled={previewData.length === 0 || loading}
                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-sm hover:shadow-md transition active:scale-95 cursor-pointer"
                    >
                        {loading ? (
                            <>
                                <RefreshCw className="w-4 h-4 text-amber-300 animate-spin" />
                                <span>Processando...</span>
                            </>
                        ) : (
                            <>
                                <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                                <span>⚡ Atualizar Carga PCP</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Mensagem de Feedback */}
            {message && (
                <div className={`p-4 rounded-xl flex items-start gap-3 animate-in slide-in-from-top-4 duration-300 ${
                    message.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200 shadow-sm shadow-red-100' : 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-sm shadow-emerald-100'
                }`}>
                    {message.type === 'error' ? <AlertTriangle className="w-5 h-5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 shrink-0" />}
                    <span className="font-semibold text-sm">{message.text}</span>
                </div>
            )}

            <div className="flex flex-col gap-6">
                
                {/* Painel Superior: Upload e Dicas */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Área de Upload */}
                    <div className="md:col-span-1 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden group">
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                            <UploadCloud className="w-5 h-5 text-indigo-600" />
                            <h3 className="font-bold text-slate-800">Upload de Arquivo</h3>
                        </div>
                        <div 
                            className="p-6 cursor-pointer hover:bg-indigo-50/30 transition-colors h-[200px] flex flex-col justify-center"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleFileDrop}
                            onClick={() => fileInputRef.current.click()}
                        >
                            <div className="border-2 border-dashed border-slate-200 group-hover:border-indigo-300 rounded-xl p-4 flex flex-col items-center justify-center text-center transition-colors h-full">
                                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-full mb-2 group-hover:scale-110 transition-transform">
                                    <FileUp className="w-6 h-6" />
                                </div>
                                <h3 className="text-sm font-bold text-slate-700 mb-1">Selecionar Planilha</h3>
                                <p className="text-[11px] text-slate-500 mb-2">
                                    Arraste o Excel (.xlsx) aqui
                                </p>
                                <input 
                                    type="file" 
                                    ref={fileInputRef}
                                    className="hidden" 
                                    accept=".xlsx, .xls"
                                    onChange={handleFileDrop}
                                />
                                <span className="px-4 py-1 bg-white border border-slate-200 shadow-sm rounded-lg text-xs font-bold text-slate-600 group-hover:text-indigo-600 group-hover:border-indigo-200 transition-colors">
                                    Procurar
                                </span>
                            </div>

                            {file && (
                                <div className="mt-3 p-2 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-between">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                                        <span className="text-xs font-semibold text-emerald-800 truncate" title={file.name}>
                                            {file.name}
                                        </span>
                                    </div>
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Dicas e Regras */}
                    <div className="md:col-span-2 bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200/60 rounded-2xl p-5 shadow-sm flex flex-col justify-center">
                        <h4 className="font-bold text-amber-900 flex items-center gap-2 mb-4 text-sm">
                            <Info className="w-4 h-4 text-amber-600" />
                            Regras de Mapeamento (Colunas Obrigatórias)
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex items-start gap-2 text-xs">
                                <div className="w-6 h-6 rounded bg-amber-100 text-amber-700 flex items-center justify-center font-bold shrink-0">C</div>
                                <p className="text-amber-800 leading-tight pt-0.5"><strong className="font-bold">Nº do Pedido:</strong> O sistema adicionará zeros à esquerda até formar 6 dígitos.</p>
                            </div>
                            <div className="flex items-start gap-2 text-xs">
                                <div className="w-6 h-6 rounded bg-amber-100 text-amber-700 flex items-center justify-center font-bold shrink-0">B</div>
                                <p className="text-amber-800 leading-tight pt-0.5"><strong className="font-bold">Item:</strong> O sistema adicionará zeros à esquerda até formar 2 dígitos.</p>
                            </div>
                            <div className="flex items-start gap-2 text-xs">
                                <div className="w-6 h-6 rounded bg-amber-100 text-amber-700 flex items-center justify-center font-bold shrink-0">E</div>
                                <p className="text-amber-800 leading-tight pt-0.5"><strong className="font-bold">Produto:</strong> Código do produto na Metalfisa.</p>
                            </div>
                            <div className="flex items-start gap-2 text-xs">
                                <div className="w-6 h-6 rounded bg-amber-100 text-amber-700 flex items-center justify-center font-bold shrink-0">H</div>
                                <p className="text-amber-800 leading-tight pt-0.5"><strong className="font-bold">Data PCP:</strong> Previsão de entrega do PCP.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabela de Dados (Full Width) */}
                <div className="w-full">
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[650px]">
                        <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <Table className="w-5 h-5 text-slate-500" />
                                <h3 className="font-bold text-slate-800">
                                    Pré-visualização de Dados
                                </h3>
                                {previewData.length > 0 && (
                                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">
                                        {previewData.length} linhas
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto bg-slate-50/30 relative">
                            {previewData.length === 0 ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 p-8 text-center animate-in fade-in">
                                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                        <Table className="w-10 h-10 text-slate-300" />
                                    </div>
                                    <h4 className="text-lg font-bold text-slate-700 mb-1">Nenhum dado carregado</h4>
                                    <p className="text-sm max-w-sm">
                                        Faça o upload de uma planilha da Engetron no quadro ao lado para visualizar e validar os dados antes da importação.
                                    </p>
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-white text-slate-600 sticky top-0 z-10 shadow-sm border-b border-slate-200">
                                        <tr>
                                            <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider border-b border-slate-200 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5"/> Pedido (Col C)</div>
                                            </th>
                                            <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider border-b border-slate-200 whitespace-nowrap">
                                                Item (Col B)
                                            </th>
                                            <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                                                <div className="flex items-center gap-1.5"><Package className="w-3.5 h-3.5"/> Produto (Col E)</div>
                                            </th>
                                            {detailedResults.length > 0 && (
                                                <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider border-b border-slate-200 whitespace-nowrap">
                                                    OP (Protheus)
                                                </th>
                                            )}
                                            <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider border-b border-slate-200 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5 text-indigo-600"><Calendar className="w-3.5 h-3.5"/> Data PCP (Col H)</div>
                                            </th>
                                            {detailedResults.length > 0 && (
                                                <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider border-b border-slate-200 whitespace-nowrap text-right">
                                                    Status do Processamento
                                                </th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-sm">
                                        {previewData.map((row, idx) => {
                                            const resLine = detailedResults[idx];
                                            let statusColor = "bg-slate-100 text-slate-500";
                                            let statusIcon = null;
                                            
                                            if (resLine) {
                                                if (resLine.status === 'success') {
                                                    statusColor = "bg-emerald-50 text-emerald-700 border border-emerald-200";
                                                    statusIcon = <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />;
                                                } else if (resLine.status === 'error') {
                                                    statusColor = "bg-red-50 text-red-700 border border-red-200";
                                                    statusIcon = <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />;
                                                } else if (resLine.status === 'warning') {
                                                    statusColor = "bg-amber-50 text-amber-800 border border-amber-200";
                                                    statusIcon = <Info className="w-4 h-4 shrink-0 text-amber-500" />;
                                                }
                                            }

                                            return (
                                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                <td className="py-2.5 px-4 font-mono font-medium text-slate-800">
                                                    {row.pedido ? String(row.pedido).padStart(6, '0') : '-'}
                                                </td>
                                                <td className="py-2.5 px-4 font-mono text-slate-600">
                                                    {row.item ? String(row.item).padStart(2, '0') : '-'}
                                                </td>
                                                <td className="py-2.5 px-4">
                                                    {row.produto && row.produto !== '-' ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-800 font-mono text-[11px] font-bold">
                                                                {row.produto}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenDrawing(row.produto)}
                                                                disabled={openingPdf === row.produto}
                                                                className="p-1 rounded-md bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition shadow-2xs cursor-pointer group flex items-center gap-1"
                                                                title={`Abrir Desenho / PDF de ${row.produto}`}
                                                            >
                                                                {openingPdf === row.produto ? (
                                                                    <RefreshCw className="w-3 h-3 animate-spin text-red-600" />
                                                                ) : (
                                                                    <FileText className="w-3 h-3 text-red-600 group-hover:scale-110 transition" />
                                                                )}
                                                                <span className="text-[10px] font-bold text-red-700">PDF</span>
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 text-[11px]">-</span>
                                                    )}
                                                </td>
                                                {detailedResults.length > 0 && (
                                                    <td className="py-2.5 px-4 font-mono font-medium">
                                                        {resLine && resLine.op !== '-' ? (
                                                            <span className="text-slate-700">{resLine.op}</span>
                                                        ) : (
                                                            <span className="text-slate-400">-</span>
                                                        )}
                                                    </td>
                                                )}
                                                <td className="py-2.5 px-4">
                                                    <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded">
                                                        {formatDate(row.data_pcp)}
                                                    </span>
                                                </td>
                                                {detailedResults.length > 0 && (
                                                    <td className="py-2.5 px-4 text-right">
                                                        {resLine ? (
                                                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold ${statusColor}`}>
                                                                {statusIcon}
                                                                {resLine.reason}
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-400 text-xs">-</span>
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                        )})}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DemandaEngetron;
