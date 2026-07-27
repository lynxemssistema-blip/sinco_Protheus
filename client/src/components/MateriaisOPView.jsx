import React, { useState, useEffect } from 'react';
import { Package, Search, AlertCircle } from 'lucide-react';
import { getOpMaterials } from '../services/api';

export default function MateriaisOPView({ ops }) {
    const [materials, setMaterials] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState({ codigo: '', descricao: '', ops: '', status: '', armazem: '' });
    const [error, setError] = useState(null);
    const [isGrouped, setIsGrouped] = useState(true);

    useEffect(() => {
        const fetchMaterials = async () => {
            if (!ops || ops.length === 0) {
                setMaterials([]);
                return;
            }
            
            setLoading(true);
            setError(null);
            try {
                // Remove duplicates by OP (so we don't query the same OP multiple times if it has multiple operations)
                const uniqueOpsMap = new Map();
                ops.forEach(o => {
                    const key = `${o.op}|${o.item_op}|${o.sequen}`;
                    if (!uniqueOpsMap.has(key)) {
                        uniqueOpsMap.set(key, { op: o.op, item_op: o.item_op, sequen: o.sequen });
                    }
                });
                
                const lighterOps = Array.from(uniqueOpsMap.values());
                const res = await getOpMaterials(lighterOps);
                if (res && res.success) {
                    setMaterials(res.materials || []);
                } else {
                    setError('Falha ao buscar materiais.');
                }
            } catch (err) {
                console.error(err);
                setError('Erro de conexão ao buscar materiais.');
            } finally {
                setLoading(false);
            }
        };

        fetchMaterials();
    }, [ops]);

    const formatDate = (dateStr) => {
        if (!dateStr || dateStr.trim() === '') return '-';
        // YYYYMMDD to DD/MM/YYYY
        if (dateStr.length === 8) {
            return `${dateStr.substring(6,8)}/${dateStr.substring(4,6)}/${dateStr.substring(0,4)}`;
        }
        return dateStr;
    };

    const displayData = React.useMemo(() => {
        const getStatus = (m) => {
            const estLivre = Number(m.estoque_atual || 0) - Number(m.estoque_empenhado || 0);
            const qtdPend = Number(m.qtd_pendente || 0);
            
            if (estLivre >= qtdPend) {
                return { status: 'ESTOQUE OK', cor: 'text-emerald-700', bgCor: 'bg-emerald-100', dot: 'bg-emerald-500' };
            } else if (m.num_pc) {
                if (m.data_pc <= m.data_necessidade_op) {
                    return { status: 'NO PRAZO', cor: 'text-amber-700', bgCor: 'bg-amber-100', dot: 'bg-amber-500' };
                } else {
                    return { status: 'ATRASADO', cor: 'text-rose-700', bgCor: 'bg-rose-100', dot: 'bg-rose-500' };
                }
            } else if (m.num_sc) {
                return { status: 'SC ABERTA', cor: 'text-orange-700', bgCor: 'bg-orange-100', dot: 'bg-orange-500' };
            }
            return { status: 'FALTA COMPRAR', cor: 'text-slate-600', bgCor: 'bg-slate-100', dot: 'bg-slate-400' };
        };

        const buildScPcInfo = (m) => {
            const sc = m.num_sc ? `SC:${m.num_sc}(${m.data_sc})` : '';
            const pc = m.num_pc ? `PC:${m.num_pc}(${m.data_pc})` : '';
            return `${sc}|${pc}`;
        };

        if (!isGrouped) {
            return materials.map(m => {
                const s = getStatus(m);
                return {
                    codigo: m.material_codigo,
                    descricao: m.material_descricao,
                    um: m.um,
                    qtd_pendente: Number(m.qtd_pendente || 0),
                    armazem: m.armazem,
                    ops: m.op_formatada,
                    est_livre: Number(m.estoque_atual || 0) - Number(m.estoque_empenhado || 0),
                    sc_pc_info: buildScPcInfo(m),
                    necessidade: formatDate(m.data_necessidade_op),
                    num_sc: m.num_sc,
                    data_sc: m.data_sc,
                    data_emissao_sc: m.data_emissao_sc,
                    num_pc: m.num_pc,
                    data_pc: m.data_pc,
                    data_emissao_pc: m.data_emissao_pc,
                    ...s
                };
            });
        }
        
        const consolidated = materials.reduce((acc, curr) => {
            if (!acc[curr.material_codigo]) {
                const s = getStatus(curr);
                acc[curr.material_codigo] = {
                    codigo: curr.material_codigo,
                    descricao: curr.material_descricao,
                    um: curr.um,
                    qtd_pendente: 0,
                    armazem: curr.armazem,
                    ops: new Set(),
                    est_livre: Number(curr.estoque_atual || 0) - Number(curr.estoque_empenhado || 0),
                    sc_pc_info: buildScPcInfo(curr),
                    necessidade: formatDate(curr.data_necessidade_op),
                    num_sc: curr.num_sc,
                    data_sc: curr.data_sc,
                    data_emissao_sc: curr.data_emissao_sc,
                    num_pc: curr.num_pc,
                    data_pc: curr.data_pc,
                    data_emissao_pc: curr.data_emissao_pc,
                    ...s,
                    isMixed: false
                };
            }
            acc[curr.material_codigo].qtd_pendente += Number(curr.qtd_pendente || 0);
            acc[curr.material_codigo].ops.add(curr.op_formatada);
            
            // If grouped and dates or PCs differ, flag it
            const currentScPcInfo = buildScPcInfo(curr);
            if (acc[curr.material_codigo].sc_pc_info !== currentScPcInfo || acc[curr.material_codigo].necessidade !== formatDate(curr.data_necessidade_op)) {
                acc[curr.material_codigo].isMixed = true;
            }
            
            return acc;
        }, {});

        return Object.values(consolidated).map(m => {
            if (m.isMixed) {
                m.status = 'MÚLTIPLOS (Desaglutine)';
                m.cor = 'text-slate-500';
                m.bgCor = 'bg-slate-100';
                m.dot = 'bg-slate-300';
                m.sc_pc_info = 'Vários';
                m.necessidade = 'Várias';
            } else {
                // Re-evaluate status based on grouped qty
                const reEval = getStatus({ ...m, qtd_pendente: m.qtd_pendente, num_pc: m.sc_pc_info.includes('PC:') ? '1' : null, num_sc: m.sc_pc_info.includes('SC:') ? '1' : null, data_pc: m.sc_pc_info.includes('PC:') ? '20990101' : null, data_necessidade_op: '20990101' }); 
                // Wait, re-evaluating dates is hard from the strings, let's just keep the original status since it's not mixed.
                // Except for 'ESTOQUE OK' which depends on total qty.
                if (m.est_livre < m.qtd_pendente && m.status === 'ESTOQUE OK') {
                     m.status = 'FALTA COMPRAR (Parcial)';
                     m.cor = 'text-orange-600';
                     m.bgCor = 'bg-orange-50';
                     m.dot = 'bg-orange-400';
                }
            }
            return {
                ...m,
                ops: Array.from(m.ops).join(', ')
            };
        });
    }, [materials, isGrouped]);

    const uniqueArmazens = React.useMemo(() => {
        return Array.from(new Set(displayData.map(m => m.armazem))).filter(Boolean).sort();
    }, [displayData]);

    const filtered = displayData.filter(m => {
        const mCodigo = filters.codigo ? m.codigo.toLowerCase().includes(filters.codigo.toLowerCase()) : true;
        const mDesc = filters.descricao ? m.descricao.toLowerCase().includes(filters.descricao.toLowerCase()) : true;
        const mOps = filters.ops ? m.ops.toLowerCase().includes(filters.ops.toLowerCase()) : true;
        const mStatus = filters.status ? m.status === filters.status : true;
        const mArmazem = filters.armazem ? m.armazem === filters.armazem : true;
        
        return mCodigo && mDesc && mOps && mStatus && mArmazem;
    });

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                <div className="flex items-center gap-2 text-slate-800">
                    <Package className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-bold">Materiais (MP) das OPs Listadas</h3>
                    <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2 py-0.5 rounded-full ml-2">
                        {filtered.length} iten{filtered.length !== 1 ? 's' : ''}
                    </span>
                </div>
                <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-slate-800 transition-colors bg-white px-3 py-1.5 border border-slate-200 rounded-lg shadow-sm">
                        <input 
                            type="checkbox" 
                            checked={isGrouped}
                            onChange={(e) => setIsGrouped(e.target.checked)}
                            className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        Aglutinar Materiais
                    </label>
                </div>
            </div>

            {/* Filter Card */}
            <div className="bg-white border-b border-slate-100 p-4 shrink-0">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Código</label>
                        <input
                            type="text"
                            value={filters.codigo}
                            onChange={(e) => setFilters(f => ({...f, codigo: e.target.value}))}
                            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                            placeholder="Buscar código..."
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Descrição</label>
                        <input
                            type="text"
                            value={filters.descricao}
                            onChange={(e) => setFilters(f => ({...f, descricao: e.target.value}))}
                            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                            placeholder="Buscar descrição..."
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Origem (OPs)</label>
                        <input
                            type="text"
                            value={filters.ops}
                            onChange={(e) => setFilters(f => ({...f, ops: e.target.value}))}
                            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                            placeholder="Buscar OPs..."
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                        <select
                            value={filters.status}
                            onChange={(e) => setFilters(f => ({...f, status: e.target.value}))}
                            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500 text-slate-600"
                        >
                            <option value="">Todos os Status</option>
                            <option value="ESTOQUE OK">ESTOQUE OK</option>
                            <option value="NO PRAZO">NO PRAZO</option>
                            <option value="ATRASADO">ATRASADO</option>
                            <option value="SC ABERTA">SC ABERTA</option>
                            <option value="FALTA COMPRAR">FALTA COMPRAR</option>
                            <option value="MÚLTIPLOS (Desaglutine)">MÚLTIPLOS</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Armazém</label>
                        <select
                            value={filters.armazem}
                            onChange={(e) => setFilters(f => ({...f, armazem: e.target.value}))}
                            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500 text-slate-600"
                        >
                            <option value="">Todos os Armazéns</option>
                            {uniqueArmazens.map(arm => (
                                <option key={arm} value={arm}>Armazém {arm}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-0">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-500">
                        <div className="animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-indigo-600"></div>
                        <span>Carregando materiais...</span>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-2 text-red-500">
                        <AlertCircle className="w-8 h-8" />
                        <span>{error}</span>
                    </div>
                ) : displayData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
                        <Package className="w-10 h-10 opacity-20" />
                        <p>Nenhum material (MP) encontrado para as OPs atuais.</p>
                    </div>
                ) : (
                    <table className="w-full text-sm text-left text-slate-600">
                        <thead className="text-xs text-slate-500 bg-slate-50 sticky top-0 uppercase font-semibold">
                            <tr>
                                <th className="px-4 py-3 border-b">Origem (OPs)</th>
                                <th className="px-4 py-3 border-b">Código / Descrição</th>
                                <th className="px-4 py-3 border-b text-center">Data OP</th>
                                <th className="px-4 py-3 border-b text-right">Qtd. Pendente</th>
                                <th className="px-4 py-3 border-b text-center">UM / Arm</th>
                                <th className="px-4 py-3 border-b text-right">Est. Livre</th>
                                <th className="px-4 py-3 border-b text-center">Status</th>
                                <th className="px-4 py-3 border-b">Suprimento</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((mat, idx) => (
                                <tr key={idx} className="border-b border-slate-100 hover:bg-indigo-50/50 transition-colors group">
                                    <td className="px-4 py-2 text-xs font-mono text-slate-500 max-w-[150px] truncate" title={mat.ops}>
                                        {mat.ops}
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className="font-bold text-slate-800">{mat.codigo}</div>
                                        <div className="text-xs text-slate-500 truncate max-w-xs">{mat.descricao}</div>
                                    </td>
                                    <td className="px-4 py-2 text-center text-xs font-medium text-slate-700">
                                        {mat.necessidade}
                                    </td>
                                    <td className="px-4 py-2 text-right font-bold text-indigo-700">
                                        {mat.qtd_pendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                        <div className="font-medium text-slate-700">{mat.um}</div>
                                        <div className="text-xs text-slate-400">{mat.armazem}</div>
                                    </td>
                                    <td className="px-4 py-2 text-right font-medium text-slate-600">
                                        <div className="relative group cursor-default inline-block">
                                            <span className="border-b border-dashed border-slate-300">
                                                {mat.est_livre.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </span>
                                            
                                            {mat.estoques_detalhe && mat.estoques_detalhe.length > 0 && (
                                                <div className="hidden group-hover:block absolute z-50 right-0 top-full mt-1 min-w-[200px] bg-white border border-slate-200 shadow-xl rounded-lg p-2 text-xs">
                                                    <div className="font-bold text-slate-700 mb-2 border-b pb-1 text-left">Saldos por Armazém</div>
                                                    <table className="w-full text-left">
                                                        <thead className="bg-slate-50 text-slate-500 font-semibold">
                                                            <tr>
                                                                <th className="p-1">Armazém</th>
                                                                <th className="p-1 text-right">Qtd Livre</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y">
                                                            {mat.estoques_detalhe.map(s => (
                                                                <tr key={s.armazem} className="hover:bg-slate-50">
                                                                    <td className="p-1 font-mono text-slate-600 text-center">{s.armazem}</td>
                                                                    <td className="p-1 text-right font-medium text-slate-800">
                                                                        {s.livre.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${mat.bgCor} ${mat.cor}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${mat.dot}`}></span>
                                            {mat.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2 text-xs font-medium text-slate-600 align-middle">
                                        {mat.isMixed ? (
                                            <span className="text-slate-400">Vários</span>
                                        ) : (!mat.num_sc && !mat.num_pc) ? (
                                            <span className="text-slate-300">-</span>
                                        ) : (
                                            <div className="flex flex-col gap-1.5">
                                                {mat.num_sc && (
                                                    <div className="text-[10px] bg-orange-50 text-orange-700 px-2 py-1 rounded border border-orange-200 w-max leading-tight">
                                                        <div className="font-bold text-orange-800">SC: <span className="font-mono">{mat.num_sc}</span></div>
                                                        <div className="text-orange-600/80">Gerada: {formatDate(mat.data_emissao_sc)}</div>
                                                        <div className="text-orange-600/80">Prev: {formatDate(mat.data_sc)}</div>
                                                    </div>
                                                )}
                                                {mat.num_pc && (
                                                    <div className="text-[10px] bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-200 w-max leading-tight">
                                                        <div className="font-bold text-blue-800">PC: <span className="font-mono">{mat.num_pc}</span></div>
                                                        <div className="text-blue-600/80">Gerado: {formatDate(mat.data_emissao_pc)}</div>
                                                        <div className="text-blue-600/80">Prev: {formatDate(mat.data_pc)}</div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
