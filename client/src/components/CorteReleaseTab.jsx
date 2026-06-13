import React, { useState, useEffect } from 'react';
import { Scissors, Loader2, ChevronDown, ChevronRight, Package, Calendar, User, Search, Layers } from 'lucide-react';
import { api } from '../services/api';
import { toast } from 'react-toastify';

const CorteReleaseTab = () => {
    const [lotes, setLotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedLoteId, setExpandedLoteId] = useState(null);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetchLotes();
    }, []);

    const fetchLotes = async () => {
        setLoading(true);
        try {
            const res = await api.get('/corte/lotes-detalhados');
            setLotes(res.data || []);
        } catch (e) {
            console.error(e);
            toast.error('Erro ao carregar lotes de corte.');
        } finally {
            setLoading(false);
        }
    };

    const handleReexportExcel = async (loteId, loteNumero) => {
        try {
            toast.info('Regerando arquivo Excel...');
            const response = await api.post(`/corte/lotes/${loteId}/excel`, {}, { responseType: 'blob' });
            
            // Criar URL blob para o arquivo
            const blob = new Blob([response.data], { type: 'application/vnd.ms-excel' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${loteNumero || 'Lote'}.xls`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            toast.success('Planilha Excel baixada com sucesso!');
        } catch (e) {
            console.error(e);
            toast.error('Erro de conexão ao baixar planilha Excel.');
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const filteredLotes = lotes.filter(l => 
        l.numero_lote?.toLowerCase().includes(search.toLowerCase()) || 
        l.material_codigo?.toLowerCase().includes(search.toLowerCase()) ||
        l.material_descricao?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-5">
            {/* Header & Filter */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                    <Scissors className="w-4 h-4 text-indigo-600" />
                    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Filtros de Corte</h2>
                    <span className="ml-auto text-xs text-slate-400 font-medium">{filteredLotes.length} lotes</span>
                </div>
                <div className="flex gap-4">
                    <div className="flex-1 space-y-1">
                        <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">Buscar</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Nº do Lote, Material..." 
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                            />
                        </div>
                    </div>
                    <div className="flex items-end">
                        <button onClick={fetchLotes} className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center gap-2">
                            <Search className="w-4 h-4" /> Atualizar
                        </button>
                    </div>
                </div>
            </div>

            {/* List */}
            {loading ? (
                <div className="bg-white rounded-2xl p-10 border border-slate-200 shadow-sm flex flex-col items-center justify-center text-slate-400">
                    <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-500" />
                    <p className="font-medium">Carregando lotes de corte...</p>
                </div>
            ) : filteredLotes.length === 0 ? (
                <div className="bg-white rounded-2xl p-10 border border-slate-200 shadow-sm flex flex-col items-center justify-center text-slate-400">
                    <Package className="w-12 h-12 mb-3 text-slate-300" />
                    <p className="font-medium text-slate-600">Nenhum lote de corte encontrado.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredLotes.map(lote => {
                        const isExpanded = expandedLoteId === lote.id;
                        
                        // Agrupar itens por pedido
                        const itemsByPedido = {};
                        lote.items?.forEach(item => {
                            const key = `${item.pedido_pai} - Item ${item.item_pai}`;
                            if (!itemsByPedido[key]) itemsByPedido[key] = [];
                            itemsByPedido[key].push(item);
                        });

                        const totalPecas = lote.items?.reduce((acc, curr) => acc + parseFloat(curr.qtd_necessaria || 0), 0);

                                        const isLaser = lote.recurso === 'MO0013' || lote.recurso === 'Laser';
                                        const recursoNome = isLaser ? 'Laser' : 'Puncionadeira';
                                        return (
                                            <div key={lote.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-200">
                                                {/* Linha Principal */}
                                                <div 
                                                    className="px-6 py-4 flex items-center cursor-pointer hover:bg-slate-50 transition-colors"
                                                    onClick={() => setExpandedLoteId(isExpanded ? null : lote.id)}
                                                >
                                                    <div className="mr-4 text-slate-400">
                                                        {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                                                    </div>
                                                    
                                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4">
                                                        <div>
                                                            <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Lote</p>
                                                            <p className="font-bold text-slate-800">{lote.numero_lote}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Recurso</p>
                                                            <div className="flex items-center gap-1.5">
                                                                {isLaser ? <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> : <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />}
                                                                <p className="font-semibold text-slate-700 text-sm">{recursoNome}</p>
                                                            </div>
                                                        </div>
                                                        <div className="md:col-span-2">
                                                            <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Material (MTC)</p>
                                                            <p className="font-semibold text-slate-700 text-sm truncate" title={lote.material_descricao}>
                                                                {lote.material_codigo} - {lote.material_descricao}
                                                            </p>
                                                        </div>
                                                        <div className="text-right flex flex-col justify-center">
                                                            <p className="font-bold text-indigo-700 text-lg">{totalPecas?.toLocaleString('pt-BR')} <span className="text-xs font-normal text-slate-500 uppercase">un</span></p>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="ml-6 flex items-center gap-3 border-l border-slate-100 pl-6">
                                                        <div className="flex flex-col items-end space-y-1 text-right">
                                                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                                                                <Calendar className="w-3.5 h-3.5 text-slate-400" /> {formatDate(lote.data_criacao)}
                                                            </div>
                                                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                                                                <User className="w-3.5 h-3.5 text-slate-400" /> {lote.usuario}
                                                            </div>
                                                        </div>
                                                        
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleReexportExcel(lote.id, lote.numero_lote);
                                                            }}
                                                            className="p-2 bg-slate-100 hover:bg-slate-200 hover:text-slate-800 text-slate-600 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 border border-slate-200"
                                                            title="Re-exportar planilha Excel e abrir no servidor"
                                                        >
                                                            <Package className="w-3.5 h-3.5 text-indigo-600" />
                                                            <span>Excel</span>
                                                        </button>
                                                    </div>
                                                </div>

                                {/* Expansão: Agrupamento por Projeto */}
                                {isExpanded && (
                                    <div className="border-t border-slate-100 bg-slate-50 p-6">
                                        {lote.observacao && (
                                            <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded-lg text-sm">
                                                <span className="font-bold">Observação PCP:</span> {lote.observacao}
                                            </div>
                                        )}
                                        
                                        <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                                            <Layers className="w-4 h-4 text-slate-400" /> 
                                            Estrutura do Lote por Projeto
                                        </h3>

                                        <div className="space-y-4">
                                            {Object.keys(itemsByPedido).map(pedido => (
                                                <div key={pedido} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                                    <div className="bg-slate-100/50 border-b border-slate-200 px-4 py-2 font-bold text-slate-700 text-sm flex justify-between items-center">
                                                        <span>Pedido: {pedido}</span>
                                                        <span className="text-xs font-semibold text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200">
                                                            {itemsByPedido[pedido].length} OPs
                                                        </span>
                                                    </div>
                                                    <div className="divide-y divide-slate-100">
                                                        {itemsByPedido[pedido].map(item => (
                                                            <div key={item.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                                                                <div className="flex-1 grid grid-cols-12 gap-4 items-center">
                                                                    <div className="col-span-4">
                                                                        <div className="font-bold text-slate-800 text-sm">{item.componente}</div>
                                                                        <div className="text-xs text-slate-500 truncate" title={item.componente_descricao}>{item.componente_descricao}</div>
                                                                    </div>
                                                                    <div className="col-span-3">
                                                                        <div className="text-xs font-medium text-slate-400 uppercase tracking-wide">Ordem de Produção</div>
                                                                        <div className="font-mono text-sm font-semibold text-slate-700">{item.op_numero || 'N/A'}</div>
                                                                    </div>
                                                                    <div className="col-span-2">
                                                                        <div className="text-xs font-medium text-slate-400 uppercase tracking-wide">Qtd.</div>
                                                                        <div className="font-bold text-slate-800">{parseFloat(item.qtd_necessaria).toLocaleString('pt-BR')} un</div>
                                                                    </div>
                                                                    <div className="col-span-3 flex justify-end">
                                                                        {item.status === 'Concluído' ? (
                                                                            <div className="flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-lg text-xs font-bold">
                                                                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                                                                Concluído
                                                                            </div>
                                                                        ) : (
                                                                            <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-lg text-xs font-bold">
                                                                                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                                                                                Pendente
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default CorteReleaseTab;
