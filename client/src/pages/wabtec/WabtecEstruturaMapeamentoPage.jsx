import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { toast } from 'react-toastify';
import { CheckCircle2, XCircle, AlertTriangle, Search, Loader2, RefreshCw, Download, Save, Unlink } from 'lucide-react';

export default function WabtecEstruturaMapeamentoPage({ selectedLote }) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [buscando, setBuscando] = useState(false);

    const fetchData = async () => {
        if (!selectedLote) {
            setData([]);
            return;
        }
        setLoading(true);
        try {
            const res = await api.get(`/wabtec/estruturas?lote_id=${selectedLote}`);
            setData(res.data.data || []);
        } catch (err) {
            toast.error("Erro ao carregar dados mapeados.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedLote]);

    const handleSugerirVinculos = async () => {
        if (!selectedLote) return;
        setBuscando(true);
        try {
            await api.post('/wabtec/mapeamento/sugerir', { lote_id: selectedLote });
            toast.success("Sugestões aplicadas com sucesso!");
            fetchData();
        } catch (err) {
            toast.error("Erro ao sugerir vínculos.");
        } finally {
            setBuscando(false);
        }
    };

    const handleExportarBOM = async () => {
        if (!selectedLote) return;
        try {
            toast.info("Gerando Excel da Estrutura. Aguarde...");
            const response = await api.get(`/wabtec/exportar-bom/${selectedLote}`, {
                responseType: 'blob', // Important to handle the file download
                timeout: 300000 // 5 minutes timeout for BOM extraction
            });

            // Create a blob and download link
            const blob = new Blob([response.data], { 
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.style.display = 'none';
            link.download = `BOM_Wabtec_${selectedLote}.xlsx`;
            document.body.appendChild(link);
            link.click();
            
            // Clean up using setTimeout to ensure the browser registers the click before removal
            setTimeout(() => {
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            }, 500);
            
            toast.success("Download concluído com sucesso!");
        } catch (error) {
            console.error('Export Error:', error);
            toast.error("Erro ao gerar BOM.");
        }
    };

    const handleSalvarTodos = () => {
        // As the sugerir function already saves to the DB immediately, 
        // this button is mostly for user reassurance to match VMI UX.
        toast.success("Todos os vínculos foram salvos com sucesso!");
    };

    const handleDesvincularTodos = async () => {
        if (!selectedLote) return;
        if (!window.confirm("Tem certeza que deseja remover todos os vínculos deste lote?")) return;
        
        setLoading(true);
        try {
            await api.post('/wabtec/mapeamento/desvincular-todos', { lote_id: selectedLote });
            toast.success("Todos os vínculos foram removidos.");
            fetchData();
        } catch (error) {
            console.error(error);
            toast.error("Erro ao desvincular.");
        } finally {
            setLoading(false);
        }
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'ENCONTRADO': return 'bg-green-100 text-green-700 border-green-200';
            case 'DIFERENCA_REVISAO': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            case 'NAO_ENCONTRADO': return 'bg-red-100 text-red-700 border-red-200';
            case 'PENDENTE': return 'bg-slate-100 text-slate-500 border-slate-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    return (
        <div className="space-y-2">
            {/* Header / Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-1">
                <div className="flex-1"></div>
                <div className="flex items-center gap-1.5 flex-wrap">
                    <button onClick={fetchData} className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md text-xs font-medium transition flex items-center gap-1.5">
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Recarregar
                    </button>
                    <button onClick={handleExportarBOM} disabled={!selectedLote} className="px-2.5 py-1 bg-green-50 border border-green-200 hover:bg-green-100 text-green-700 rounded-md text-xs font-medium transition flex items-center gap-1.5 disabled:opacity-50">
                        <Download className="w-3.5 h-3.5" /> Exportar Excel
                    </button>
                    <button onClick={handleSalvarTodos} disabled={data.length === 0} className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-medium transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
                        <Save className="w-3.5 h-3.5" /> Salvar Todos ({data.filter(d => d.protheus_cod).length})
                    </button>
                    <button onClick={handleDesvincularTodos} disabled={data.length === 0} className="px-2.5 py-1 bg-red-50 border border-red-200 hover:bg-red-100 text-red-600 rounded-md text-xs font-medium transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
                        <Unlink className="w-3.5 h-3.5" /> Desvincular Todos ({data.filter(d => d.protheus_cod).length})
                    </button>
                    <button onClick={handleSugerirVinculos} disabled={buscando || !selectedLote} className="px-3 py-1 bg-[#0e95a9] hover:bg-[#0c8294] text-white rounded-md text-xs font-medium transition flex items-center gap-1.5 disabled:opacity-50">
                        {buscando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                        Sugerir Vínculos Protheus
                    </button>
                </div>
            </div>

            {!selectedLote ? (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 flex flex-col items-center justify-center text-center min-h-[300px]">
                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mb-3 border border-slate-200">
                        <span className="text-slate-400 text-lg font-bold">!</span>
                    </div>
                    <p className="text-slate-700 font-bold mb-1 text-xs">Nenhum lote WabTec ativo encontrado.</p>
                    <p className="text-slate-500 text-xs">Importe uma planilha em "1. Importação e Base" primeiro.</p>
                </div>
            ) : loading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl shadow-sm border border-slate-200">
                    <Loader2 className="w-8 h-8 animate-spin text-[#0e95a9] mb-4" />
                    <p className="text-slate-500 font-medium text-xs">Carregando itens do lote...</p>
                </div>
            ) : data.length > 0 ? (
                <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden flex flex-col">
                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-700">Mapeamento Protheus ({data.length} itens)</span>
                    </div>
                    <div className="overflow-auto max-h-[calc(100vh-210px)] min-h-[440px]">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 sticky top-0 shadow-xs z-10 text-[11px] text-slate-500 uppercase border-b border-slate-200">
                                <tr>
                                    <th className="px-3 py-2 font-semibold w-64">Código Cliente / Descrição</th>
                                    <th className="px-3 py-2 font-semibold text-center w-32">Revisão Cliente</th>
                                    <th className="px-3 py-2 font-semibold">Sugestão Protheus</th>
                                    <th className="px-3 py-2 font-semibold text-center w-32">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {data.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                        {/* Código e Descrição Cliente */}
                                        <td className="px-4 py-3 align-top">
                                            <div className="font-bold text-indigo-700 text-sm mb-1">{item.desenho_cliente}</div>
                                            <div className="text-xs text-slate-500 truncate max-w-sm" title={item.titulo}>{item.titulo || 'Sem título'}</div>
                                        </td>

                                        {/* Revisões */}
                                        <td className="px-4 py-3 align-top text-center">
                                            <div className="inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200" title="Revisão lida no Excel (Convertida)">
                                                {item.rev_convertida || 'N/A'}
                                            </div>
                                            {item.rev_cliente_raw && item.rev_cliente_raw !== item.rev_convertida && (
                                                <div className="text-[10px] text-slate-400 mt-1">Orig: {item.rev_cliente_raw}</div>
                                            )}
                                        </td>

                                        {/* Protheus Vinculo */}
                                        <td className="px-4 py-3 align-top">
                                            {item.protheus_cod ? (
                                                <div className={`p-2 rounded-lg border ${item.status_mapeamento === 'ENCONTRADO' ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'} flex flex-col gap-1`}>
                                                    <div className="flex items-center gap-2">
                                                        <CheckCircle2 className={`w-4 h-4 ${item.status_mapeamento === 'ENCONTRADO' ? 'text-green-600' : 'text-yellow-600'}`} />
                                                        <span className="font-bold text-slate-800">{item.protheus_cod}</span>
                                                        {item.protheus_rev && (
                                                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${item.status_mapeamento === 'ENCONTRADO' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-yellow-100 text-yellow-700 border-yellow-300'}`}>
                                                                Rev. MetalFisa: {item.protheus_rev}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-slate-600 pl-6">{item.protheus_desc}</div>
                                                    {item.status_mapeamento === 'DIFERENCA_REVISAO' && (
                                                        <div className="text-[10px] text-yellow-600 font-semibold pl-6 mt-0.5">{item.status_detalhe}</div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-slate-400 italic text-xs py-2">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                                    {item.status_mapeamento === 'PENDENTE' ? 'Aguardando sugestão. Clique em "Sugerir Vínculos Protheus".' : item.status_detalhe || 'Nenhum vínculo encontrado no Protheus.'}
                                                </div>
                                            )}
                                        </td>

                                        {/* Ação */}
                                        <td className="px-4 py-3 text-center align-top">
                                            {item.protheus_cod ? (
                                                <button disabled className="px-3 py-1.5 bg-green-50 text-green-700 border border-green-300 rounded text-xs font-semibold flex items-center justify-center gap-1 w-full max-w-[110px] mx-auto opacity-70 cursor-not-allowed">
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    Vinculado
                                                </button>
                                            ) : (
                                                <span className="text-slate-300">-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
