import { useState, useEffect } from 'react';
import { FileText, Package, X, RefreshCw, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { getRomaneioNfItemsFromProtheus } from '../../services/api';

const fmtQtd = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 });

const fmtDate = (d) => {
    if (!d) return '-';
    if (typeof d === 'string' && d.length === 8)
        return `${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)}`;
    return new Date(d).toLocaleDateString('pt-BR');
};

const fmtCNPJ = (cnpj) => {
    if (!cnpj) return '-';
    const c = cnpj.replace(/\D/g, '');
    if (c.length === 14) return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    return cnpj;
};

export default function NfMirrorModal({ isOpen, onClose, nf }) {
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState([]);
    const [nfHeader, setNfHeader] = useState(null);

    useEffect(() => {
        if (isOpen && nf) {
            fetchItems();
        } else if (!isOpen) {
            setItems([]);
            setNfHeader(null);
        }
    }, [isOpen, nf]);

    const fetchItems = async () => {
        setLoading(true);
        try {
            const data = await getRomaneioNfItemsFromProtheus({
                nf: nf.nf_numero,
                serie: nf.nf_serie,
                fornecedor: nf.fornecedor_cod,   // usa o parceiro real da NF, não o do romaneio
                tipo_nf: nf.tipo_nf
            });
            setNfHeader(data.header || null);
            setItems(data.items || []);
        } catch (err) {
            console.error('Erro ao buscar itens da NF no Protheus', err);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !nf) return null;

    const isSaida = nf.tipo_nf?.toLowerCase() === 'saida';
    const totalQtd = items.reduce((acc, i) => acc + (Number(i.Qtd) || 0), 0);
    const nfNumDisplay = (nf.nf_numero || '').replace(/^0+/, '') || nf.nf_numero;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200">

                {/* ── Topo: barra cinza escura ── */}
                <div className="flex items-center justify-between px-6 py-4 bg-slate-800 text-white rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-700 rounded-lg">
                            <FileText className="w-5 h-5 text-indigo-300" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Espelho da Nota Fiscal</p>
                            <h2 className="text-lg font-bold leading-tight">
                                NF-e Nº <span className="text-indigo-300 font-mono">{nfNumDisplay}</span>
                                {nf.nf_serie && <span className="text-slate-300 text-base font-normal ml-2">Série {nf.nf_serie}</span>}
                            </h2>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase ${isSaida ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}>
                            {isSaida ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
                            {isSaida ? 'Saída' : 'Retorno / Entrada'}
                        </span>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* ── Cabeçalho da NF ── */}
                <div className="flex flex-wrap gap-6 px-6 py-4 border-b border-slate-200 bg-slate-50 text-sm">
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                            {isSaida ? 'Destinatário / Cliente' : 'Remetente / Fornecedor'}
                        </p>
                        <p className="font-bold text-slate-800">{nfHeader?.Parceiro_Nome || `${nf.fornecedor_cod}-${nf.fornecedor_loja}`}</p>
                        {nfHeader?.Parceiro_CNPJ && <p className="text-slate-500 text-xs">CNPJ: {fmtCNPJ(nfHeader.Parceiro_CNPJ)}</p>}
                    </div>
                    <div className="w-px bg-slate-200 self-stretch"></div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Emissão</p>
                        <p className="font-semibold text-slate-800">{nfHeader ? fmtDate(nfHeader.Data_Emissao) : '-'}</p>
                    </div>
                    <div className="w-px bg-slate-200 self-stretch"></div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Série</p>
                        <p className="font-semibold text-slate-800 font-mono">{nf.nf_serie?.trim() || '-'}</p>
                    </div>
                    <div className="w-px bg-slate-200 self-stretch"></div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Linhas</p>
                        <p className="font-semibold text-slate-800">{loading ? '…' : items.length}</p>
                    </div>
                    <div className="w-px bg-slate-200 self-stretch"></div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Qtd. Total</p>
                        <p className="font-semibold text-slate-800 font-mono">{loading ? '…' : fmtQtd(totalQtd)}</p>
                    </div>
                </div>

                {/* ── Tabela de Itens ── */}
                <div className="flex-1 overflow-auto bg-slate-50">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-3">
                            <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
                            <p className="font-medium text-slate-600">Lendo itens no Protheus…</p>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
                            <Package className="w-12 h-12 text-slate-300" />
                            <p>Nenhum item encontrado para esta nota.</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-700 text-slate-100 text-xs uppercase font-bold sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3 text-center w-12">#</th>
                                    <th className="px-4 py-3">Cód. Produto</th>
                                    <th className="px-4 py-3 w-full">Descrição</th>
                                    <th className="px-4 py-3 text-center">CFOP</th>
                                    <th className="px-4 py-3 text-center">UM</th>
                                    <th className="px-4 py-3 text-right">Quantidade</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {items.map((item, i) => (
                                    <tr key={i} className={`transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-indigo-50/60`}>
                                        <td className="px-4 py-2.5 text-center font-mono text-slate-400 text-xs">{String(i + 1).padStart(2, '0')}</td>
                                        <td className="px-4 py-2.5 font-mono text-indigo-700 font-semibold text-xs">{item.Cod_Produto}</td>
                                        <td className="px-4 py-2.5 text-slate-700 max-w-xs truncate" title={item.Descricao_Produto}>{item.Descricao_Produto}</td>
                                        <td className="px-4 py-2.5 text-center font-mono text-slate-600 text-xs">{item.CFOP || '-'}</td>
                                        <td className="px-4 py-2.5 text-center text-slate-500 text-xs font-bold">{item.UM || 'PC'}</td>
                                        <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-800">{fmtQtd(item.Qtd)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* ── Rodapé ── */}
                {!loading && items.length > 0 && (
                    <div className="border-t border-slate-200 bg-white px-6 py-3 flex items-center gap-6 text-sm text-slate-500">
                        <span><strong className="text-slate-700">{items.length}</strong> linha(s)</span>
                        <span>Qtd. total: <strong className="text-slate-700 font-mono">{fmtQtd(totalQtd)}</strong></span>
                    </div>
                )}
            </div>
        </div>
    );
}
