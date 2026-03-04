import React, { useMemo, useState, useEffect } from 'react';
import { ArrowLeft, FileDown, Layers, Search, File, FileText, Truck } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';
import { getSincoOsMaterials } from '../../services/api';

const toNumber = (value) => {
    if (value === null || value === undefined || value === '') return 0;
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

const isMaterialTipo = (tipo) => String(tipo || '').trim().toUpperCase() === 'MATERIAL';

const resolvePdfPath = (filePath) => {
    if (!filePath) return null;
    const replaced = filePath.replace(/\.[^./\\]+$/, '.pdf');
    return replaced === filePath ? `${filePath}.pdf` : replaced;
};

const openDoc = (filePath) => {
    if (!filePath) return;
    window.open(`/api/docs/view?path=${encodeURIComponent(filePath)}`, '_blank', 'noopener,noreferrer');
};

const DeliveryBadge = ({ status }) => {
    const s = String(status || 'NAO_SOLICITADO').trim().toUpperCase();
    const style =
        s === 'ENTREGUE' ? 'bg-green-100 text-green-800 border-green-200' :
            s === 'CHEGOU' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                s === 'SOLICITADO' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                    'bg-gray-100 text-gray-700 border-gray-200';

    const label =
        s === 'ENTREGUE' ? 'Entregue' :
            s === 'CHEGOU' ? 'Chegou' :
                s === 'SOLICITADO' ? 'Solicitado' :
                    'Não solicitado';

    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${style}`}>
            {label}
        </span>
    );
};

const formatDateTime = (value) => {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString();
};

export default function ServiceOrderMaterialsPage() {
    const navigate = useNavigate();

    const [osId, setOsId] = useState('');
    const [q, setQ] = useState('');
    const [projeto, setProjeto] = useState('');
    const [tag, setTag] = useState('');
    const [multiplier, setMultiplier] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [items, setItems] = useState([]);

    // Estados para debounce (atraso na filtragem)
    const [debouncedQ, setDebouncedQ] = useState(q);
    const [debouncedProjeto, setDebouncedProjeto] = useState(projeto);
    const [debouncedTag, setDebouncedTag] = useState(tag);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQ(q);
            setDebouncedProjeto(projeto);
            setDebouncedTag(tag);
        }, 400);
        return () => clearTimeout(timer);
    }, [q, projeto, tag]);

    const filteredItems = useMemo(() => {
        let res = items;
        const term = String(debouncedQ || '').trim().toLowerCase();
        const termProjeto = String(debouncedProjeto || '').trim().toLowerCase();
        const termTag = String(debouncedTag || '').trim().toLowerCase();

        if (term) {
            res = res.filter(i =>
                String(i.CodMatFabricante || '').toLowerCase().includes(term) ||
                String(i.DescResumo || '').toLowerCase().includes(term)
            );
        }
        if (termProjeto) {
            res = res.filter(i => String(i.Projeto || '').toLowerCase().includes(termProjeto));
        }
        if (termTag) {
            res = res.filter(i => String(i.Tag || '').toLowerCase().includes(termTag));
        }
        return res;
    }, [items, debouncedQ, debouncedProjeto, debouncedTag]);

    const fetchMaterials = async () => {
        if (!osId) return;
        try {
            setError('');
            setLoading(true);
            const data = await getSincoOsMaterials(osId, { q: q || undefined, projeto: projeto || undefined, tag: tag || undefined });
            setItems(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error(e);
            setItems([]);
            setError(e?.response?.data?.error || e?.message || 'Falha ao buscar materiais da OS.');
        } finally {
            setLoading(false);
        }
    };

    const exportToExcel = () => {
        if (!osId) return;
        if (filteredItems.length === 0) return alert('A lista está vazia.');

        const mult = Math.max(1, Number(multiplier) || 1);

        const map = new Map();
        filteredItems.forEach(i => {
            const key = String(i.CodMatFabricante || '').trim();
            if (!key) return;
            const existing = map.get(key);
            const baseQtdTotal = toNumber(i.QtdeTotal);
            const baseQtdUnit = toNumber(i.qtde);
            const nivel = i.Nivel ?? 0;
            const entregaStatus = String(i.EntregaStatus || 'NAO_SOLICITADO').trim().toUpperCase();
            const desenho = i.EnderecoArquivoMaterial || i.EnderecoArquivoOS || '';

            if (existing) {
                existing._qtd_total_base += baseQtdTotal;
                existing._qtd_unit_base += baseQtdUnit;
                if (!existing._items) existing._items = [];
                existing._items.push(i.IdOrdemServicoItem);
                if (!existing._niveis) existing._niveis = new Set();
                existing._niveis.add(nivel);
                if (!existing._descrs) existing._descrs = new Set();
                if (i.DescResumo) existing._descrs.add(String(i.DescResumo).trim());
                if (!existing._tipos) existing._tipos = new Set();
                if (i.txtTipoDesenho) existing._tipos.add(String(i.txtTipoDesenho).trim());
                if (!existing._entregaStatuses) existing._entregaStatuses = new Set();
                existing._entregaStatuses.add(entregaStatus);
                if (!existing._obs) existing._obs = new Set();
                if (i.C2_OBS) existing._obs.add(String(i.C2_OBS).trim());
                if (!existing._desenhos) existing._desenhos = new Set();
                if (desenho) existing._desenhos.add(desenho);
                if (!existing._solicitantes) existing._solicitantes = new Set();
                if (i.Solicitante) existing._solicitantes.add(String(i.Solicitante).trim());
            } else {
                map.set(key, {
                    _key: key,
                    _qtd_total_base: baseQtdTotal,
                    _qtd_unit_base: baseQtdUnit,
                    _items: [i.IdOrdemServicoItem],
                    _first: i,
                    _niveis: new Set([nivel]),
                    _descrs: new Set(i.DescResumo ? [String(i.DescResumo).trim()] : []),
                    _tipos: new Set(i.txtTipoDesenho ? [String(i.txtTipoDesenho).trim()] : []),
                    _entregaStatuses: new Set([entregaStatus]),
                    _obs: new Set(i.C2_OBS ? [String(i.C2_OBS).trim()] : []),
                    _desenhos: new Set(desenho ? [desenho] : []),
                    _solicitantes: new Set(i.Solicitante ? [String(i.Solicitante).trim()] : [])
                });
            }
        });

        const joinLimited = (values, limit = 12) => {
            const arr = Array.from(values || []);
            if (arr.length <= limit) return arr.join(' | ');
            return `${arr.slice(0, limit).join(' | ')} | (+${arr.length - limit})`;
        };

        const statusPriority = (s) => {
            const v = String(s || '').trim().toUpperCase();
            if (v === 'ENTREGUE') return 4;
            if (v === 'CHEGOU') return 3;
            if (v === 'SOLICITADO') return 2;
            return 1;
        };

        const data = Array.from(map.values()).map(row => {
            const i = row._first;
            const desenhosAll = row._desenhos || new Set();
            const desenho = (Array.from(desenhosAll).find(Boolean)) || (i.EnderecoArquivoMaterial || i.EnderecoArquivoOS || '');
            const desenhoPdf = resolvePdfPath(desenho) || '';

            const entregaStatuses = row._entregaStatuses || new Set();
            const entregaStatusResumo = Array.from(entregaStatuses).sort((a, b) => statusPriority(a) - statusPriority(b))[0] || 'NAO_SOLICITADO';

            return {
                'OS': i.IdOrdemServico,
                'CodMatFabricante': row._key,
                'Projeto': i.Projeto || '',
                'Tag': i.Tag || '',
                'Ocorrências': row._items?.length || 0,
                'Itens OS': row._items.join(','),
                'Níveis': joinLimited(row._niveis, 24),
                'TipoDesenho': row._tipos?.size ? joinLimited(row._tipos, 24) : (i.txtTipoDesenho || ''),
                'Descrição': row._descrs?.size ? joinLimited(row._descrs, 8) : (i.DescResumo || ''),
                'Solicitante': joinLimited(row._solicitantes, 5),
                'Observação': joinLimited(row._obs, 5),
                'Qtde Unit. (base)': row._qtd_unit_base,
                'Qtde Total (base)': row._qtd_total_base,
                [`Qtde Unit. (x${mult})`]: row._qtd_unit_base * mult,
                [`Qtde Total (x${mult})`]: row._qtd_total_base * mult,
                'Unidade': i.Unidade || '',
                'Status Entrega (resumo)': entregaStatusResumo,
                'Status Entrega (todos)': joinLimited(entregaStatuses, 12),
                'Solicitado Em': i.EntregaSolicitadoEm ? formatDateTime(i.EntregaSolicitadoEm) : '',
                'Solicitado Por': i.EntregaSolicitadoPor || '',
                'Chegada Prevista': i.EntregaChegadaPrevistaEm ? String(i.EntregaChegadaPrevistaEm).slice(0, 10) : '',
                'Chegada Em': i.EntregaChegadaEm ? formatDateTime(i.EntregaChegadaEm) : '',
                'Recebido Por': i.EntregaRecebidoPor || '',
                'Entregue Em': i.EntregaEntregueEm ? formatDateTime(i.EntregaEntregueEm) : '',
                'Entregue Por': i.EntregaEntreguePor || '',
                'Entregue Para': i.EntregaEntreguePara || '',
                'Observação Entrega': i.EntregaObservacao || '',
                'Desenho': desenho,
                'Desenho PDF': desenhoPdf,
                'Desenhos (todos)': joinLimited(desenhosAll, 10)
            };
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Materiais');
        XLSX.writeFile(wb, `OS_${osId}_Materiais_x${mult}.xlsx`);
    };

    const getNivelColor = (nivel) => {
        if (nivel === 0) return 'bg-blue-100 text-blue-700';
        if (nivel === 1) return 'bg-green-100 text-green-700';
        if (nivel === 2) return 'bg-yellow-100 text-yellow-700';
        return 'bg-gray-100 text-gray-700';
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            <button
                onClick={() => navigate(-1)}
                className="flex items-center text-gray-500 hover:text-blue-600 transition-colors"
            >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
            </button>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <Layers className="h-6 w-6 text-blue-600" />
                            <h1 className="text-2xl font-bold text-gray-900">Materiais por OS (SINCO)</h1>
                        </div>
                        <p className="text-sm text-gray-500">
                            Lista de itens do tipo <span className="font-semibold">MATERIAL</span> com desenho (PSM/PDF) e controle de entrega.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={exportToExcel}
                            className="flex items-center gap-2 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                            title="Exportar lista para Excel"
                        >
                            <FileDown className="h-4 w-4" />
                            Exportar Excel
                        </button>
                    </div>
                </div>

                <div className="p-4 border-b border-gray-100 bg-gray-50">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        <div className="md:col-span-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Nº OS</label>
                            <input
                                type="text"
                                value={osId}
                                onChange={(e) => setOsId(e.target.value)}
                                placeholder="Ex: 8"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Multiplicador (Excel)</label>
                            <input
                                type="number"
                                min={1}
                                step="1"
                                value={multiplier}
                                onChange={(e) => setMultiplier(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                                title="Aplica multiplicador apenas na exportação do Excel"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Projeto</label>
                            <input
                                type="text"
                                value={projeto}
                                onChange={(e) => setProjeto(e.target.value)}
                                placeholder="Ex: P-123"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Tag</label>
                            <input
                                type="text"
                                value={tag}
                                onChange={(e) => setTag(e.target.value)}
                                placeholder="Ex: T-456"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <div className="md:col-span-3">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Filtro (CodMatFabricante / Descrição)</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    placeholder="Ex: MT5-29146"
                                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            <button
                                type="button"
                                onClick={fetchMaterials}
                                disabled={!osId || loading}
                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                <Truck className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                Buscar
                            </button>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-600">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-4 py-3 font-semibold">Item</th>
                                <th className="px-4 py-3 font-semibold text-center">Nível</th>
                                <th className="px-4 py-3 font-semibold">Material</th>
                                <th className="px-4 py-3 font-semibold">Descrição</th>
                                <th className="px-4 py-3 font-semibold">Solicitante</th>
                                <th className="px-4 py-3 font-semibold">Observação</th>
                                <th className="px-4 py-3 font-semibold text-right">Qtde</th>
                                <th className="px-4 py-3 font-semibold text-right">Qtde Total</th>
                                <th className="px-4 py-3 font-semibold">UM</th>
                                <th className="px-4 py-3 font-semibold text-right">Fator</th>
                                <th className="px-4 py-3 font-semibold text-center w-20">PDF</th>
                                <th className="px-4 py-3 font-semibold text-center">Entrega</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="10" className="px-6 py-10 text-center text-gray-500">
                                        Carregando...
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan="10" className="px-6 py-10 text-center text-red-600 font-medium">
                                        {error}
                                    </td>
                                </tr>
                            ) : filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan="10" className="px-6 py-10 text-center text-gray-400">
                                        Nenhum material encontrado.
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map((item, idx) => {
                                    const nivel = Number(item.Nivel || 0);
                                    const indentPx = nivel * 20;
                                    const desenhoPath = item.EnderecoArquivoMaterial || item.EnderecoArquivoOS || null;
                                    const pdfPath = resolvePdfPath(desenhoPath);

                                    return (
                                        <tr key={`${item.IdOrdemServicoItem}-${idx}`} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3 text-xs font-mono text-gray-600 whitespace-nowrap">
                                                {item.IdOrdemServicoItem}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${getNivelColor(nivel)}`}>
                                                    {nivel}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div style={{ paddingLeft: `${indentPx}px` }} className="flex items-center gap-2">
                                                    {nivel > 0 && <span className="text-gray-400">└─</span>}
                                                    <div className="min-w-0">
                                                        <div className="font-semibold text-gray-900 truncate" title={item.CodMatFabricante}>
                                                            {item.CodMatFabricante || '-'}
                                                        </div>
                                                        <div className="text-[11px] text-gray-400">
                                                            {isMaterialTipo(item.txtTipoDesenho) ? 'MATERIAL' : (item.txtTipoDesenho || '-')}
                                                        </div>
                                                        {(item.Projeto || item.Tag) && (
                                                            <div className="flex items-center gap-1.5 mt-1">
                                                                {item.Projeto && (
                                                                    <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold border border-blue-100 uppercase tracking-tighter">
                                                                        P: {item.Projeto}
                                                                    </span>
                                                                )}
                                                                {item.Tag && (
                                                                    <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded text-[10px] font-bold border border-amber-100 uppercase tracking-tighter">
                                                                        T: {item.Tag}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-gray-600 max-w-[420px]" title={item.DescResumo}>
                                                {item.DescResumo || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap" title="Usuário que criou a SC">
                                                {item.Solicitante || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-gray-600 max-w-[200px] truncate" title={item.C2_OBS}>
                                                {item.C2_OBS || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right text-xs font-mono text-gray-700 whitespace-nowrap">
                                                {Number(item.qtde || 0).toLocaleString('pt-BR')}
                                            </td>
                                            <td className="px-4 py-3 text-right text-xs font-mono font-semibold text-gray-900 whitespace-nowrap">
                                                {Number(item.QtdeTotal || 0).toLocaleString('pt-BR')}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                                                {item.Unidade || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right text-xs font-mono text-gray-700 whitespace-nowrap">
                                                {item.Fator != null && item.Fator !== '' ? Number(item.Fator).toLocaleString('pt-BR') : '-'}
                                            </td>

                                            {/* Coluna PDF — ícone vermelho se existe, cinza se não */}
                                            <td className="px-4 py-3 text-center">
                                                {pdfPath ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => openDoc(pdfPath)}
                                                        className="p-1 rounded hover:bg-red-50 transition-colors mx-auto block"
                                                        title={`Abrir PDF: ${pdfPath}`}
                                                    >
                                                        <FileText className="h-4 w-4 text-red-500" />
                                                    </button>
                                                ) : (
                                                    <FileText className="h-4 w-4 text-gray-300 mx-auto" title="Sem PDF" />
                                                )}
                                            </td>

                                            <td className="px-4 py-3 text-center">
                                                <DeliveryBadge status={item.EntregaStatus} />
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {!loading && !error && items.length > 0 && (
                    <div className="px-4 py-2 text-xs text-gray-500 bg-gray-50 border-t border-gray-100 text-right">
                        OS {osId} • Materiais: {items.length} (Exibindo {filteredItems.length})
                    </div>
                )}
            </div>
        </div>
    );
}
