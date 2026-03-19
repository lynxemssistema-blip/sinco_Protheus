import React, { useState, useEffect } from 'react';
import { Search, FileText, CheckCircle2, X } from 'lucide-react';
import { getRomaneioNfsFromProtheus } from '../../services/api';

export default function NfSearchModal({ isOpen, onClose, onSelectNf, fornecedorCod, fornecedorLoja, tipoNf, title = "Buscar Nota Fiscal" }) {
    const [loading, setLoading] = useState(false);
    const [nfs, setNfs] = useState([]);
    const [globalSearch, setGlobalSearch] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchNfs();
        } else {
            setSearchTerm('');
            setGlobalSearch(false);
            setNfs([]);
        }
    }, [isOpen]);

    const fetchNfs = async (overrideSearch = searchTerm, overrideGlobal = globalSearch) => {
        setLoading(true);
        try {
            const data = await getRomaneioNfsFromProtheus({ 
                fornecedor: fornecedorCod, 
                loja: fornecedorLoja,
                search: overrideSearch,
                globalSearch: overrideGlobal
            });
            setNfs(data || []);
        } catch (err) {
            console.error('Erro ao buscar NFs', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        fetchNfs(searchTerm, globalSearch);
    };

    const handleGlobalToggle = (checked) => {
        setGlobalSearch(checked);
        fetchNfs(searchTerm, checked);
    };


    const formatDate = (dateString) => {
        if (!dateString) return '-';
        // Protheus F1_EMISSAO is usually YYYYMMDD string or Date
        if (typeof dateString === 'string' && dateString.length === 8) {
            return `${dateString.slice(6, 8)}/${dateString.slice(4, 6)}/${dateString.slice(0, 4)}`;
        }
        return new Date(dateString).toLocaleDateString('pt-BR');
    };



    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <FileText className="w-6 h-6 text-indigo-600" />
                            {title}
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">Selecione uma NF para vincular ao Romaneio como <strong className="uppercase">{tipoNf}</strong></p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 flex-1 flex flex-col min-h-0">
                    <div className="mb-4">
                        <div className="flex flex-col md:flex-row gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Número da NF ou nome do fornecedor..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-sm"
                                />
                            </div>
                            <button 
                                onClick={handleSearch}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap"
                            >
                                Buscar
                            </button>
                        </div>
                        <div className="mt-3 flex items-center">
                            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-slate-800">
                                <input 
                                    type="checkbox" 
                                    checked={globalSearch}
                                    onChange={(e) => handleGlobalToggle(e.target.checked)}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                Buscar em todos os fornecedores do sistema (Ignorar Fornecedor atual)
                            </label>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto border border-slate-200 rounded-xl">
                        {loading ? (
                            <div className="flex justify-center items-center h-40 text-slate-400">
                                <span className="animate-spin w-6 h-6 border-b-2 border-indigo-600 rounded-full mr-3"></span>
                                Buscando Notas Fiscais no Protheus...
                            </div>
                        ) : nfs.length === 0 ? (
                            <div className="p-8 text-center text-slate-500">
                                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                <p>{globalSearch
                                    ? 'Nenhuma Nota Fiscal encontrada para o termo pesquisado.'
                                    : <>Nenhuma Nota Fiscal encontrada para o fornecedor <strong className="text-slate-700">{fornecedorCod}</strong>.</>
                                }</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm text-left whitespace-nowrap">
                                <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-bold sticky top-0 border-b border-slate-200 shadow-sm z-10">
                                    <tr>
                                        <th className="px-4 py-3">Nº NF</th>
                                        <th className="px-4 py-3">Série</th>
                                        <th className="px-4 py-3">Direção</th>
                                        <th className="px-4 py-3">Emissão</th>
                                        <th className="px-4 py-3">Parceiro</th>
                                        <th className="px-4 py-3">Razão Social</th>
                                        <th className="px-4 py-3 text-right">Ação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {nfs.map((nf, i) => (
                                        <tr key={i} className="hover:bg-indigo-50/50 transition-colors group cursor-pointer" onClick={() => onSelectNf(nf, tipoNf)}>
                                            <td className="px-4 py-3 font-mono font-bold text-slate-800">{nf.Num_NF}</td>
                                            <td className="px-4 py-3 font-mono text-slate-600">{nf.Serie || '-'}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${nf.Direcao === 'Saída' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                    {nf.Direcao}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">{formatDate(nf.Data_Emissao)}</td>
                                            <td className="px-4 py-3 font-mono text-slate-500">{nf.Cod_Fornecedor}-{nf.Loja || fornecedorLoja}</td>
                                            <td className="px-4 py-3 text-slate-700 truncate max-w-xs">{nf.Razao_Social_Fornecedor}</td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onSelectNf(nf, tipoNf); }}
                                                    className="px-3 py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-600 hover:text-white transition-colors"
                                                >
                                                    Selecionar
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {nfs.length === 0 && !loading && (
                                        <tr>
                                            <td colSpan="6" className="p-8 text-center text-slate-400">Nenhum resultado filtrado.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
