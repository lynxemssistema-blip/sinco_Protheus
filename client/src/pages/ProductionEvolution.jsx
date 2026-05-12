import React, { useState, useEffect, useMemo } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    AreaChart, Area, BarChart, Bar, Cell
} from 'recharts';
import { TrendingUp, Search, ChevronUp, ChevronDown, Trophy, Medal, Award } from 'lucide-react';
import api from '../services/api';

const RANK_COLORS = [
    '#f59e0b', // 1st - Gold
    '#94a3b8', // 2nd - Silver
    '#d97706', // 3rd - Bronze
    '#3b82f6', '#6366f1', '#14b8a6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4',
];

const RANK_ICONS = [
    <Trophy className="w-4 h-4" />,
    <Medal className="w-4 h-4" />,
    <Award className="w-4 h-4" />,
];

export default function ProductionEvolution() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [sectors, setSectors] = useState([]);
    const [users, setUsers] = useState([]);

    // Sorting
    const [sortKey, setSortKey] = useState('date');
    const [sortDir, setSortDir] = useState('desc');

    // Filters
    const [filters, setFilters] = useState({
        startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        sector: '',
        user: ''
    });

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await api.get('/production/analytics/evolution', { params: filters });
            setData(res.data.chartData);
            setSectors(res.data.sectors || []);
            setUsers(res.data.users || []);
        } catch (error) {
            console.error("Erro ao carregar dados de evolução:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleFilterChange = (e) => {
        setFilters({ ...filters, [e.target.name]: e.target.value });
    };

    // Flatten data for the table
    const flatRows = useMemo(() => {
        return data.flatMap(day =>
            (day.details || []).map(detail => ({
                date: day.date,
                usuario: detail.usuario,
                setor: detail.setor || '-',
                qtd: parseFloat(detail.qtd) || 0,
                count: parseInt(detail.count) || 0
            }))
        );
    }, [data]);

    // Sorted rows
    const sortedRows = useMemo(() => {
        const sorted = [...flatRows];
        sorted.sort((a, b) => {
            let cmp = 0;
            switch (sortKey) {
                case 'date':
                    cmp = a.date.localeCompare(b.date);
                    break;
                case 'usuario':
                    cmp = (a.usuario || '').localeCompare(b.usuario || '');
                    break;
                case 'setor':
                    cmp = (a.setor || '').localeCompare(b.setor || '');
                    break;
                case 'qtd':
                    cmp = a.qtd - b.qtd;
                    break;
                case 'count':
                    cmp = a.count - b.count;
                    break;
                default:
                    cmp = 0;
            }
            return sortDir === 'asc' ? cmp : -cmp;
        });
        return sorted;
    }, [flatRows, sortKey, sortDir]);

    // Ranking by user (aggregated by count of records)
    const userRanking = useMemo(() => {
        const map = {};
        flatRows.forEach(row => {
            if (!map[row.usuario]) {
                map[row.usuario] = { usuario: row.usuario, totalRegistros: 0, totalQtd: 0 };
            }
            map[row.usuario].totalRegistros += row.count;
            map[row.usuario].totalQtd += row.qtd;
        });
        return Object.values(map).sort((a, b) => b.totalRegistros - a.totalRegistros);
    }, [flatRows]);

    const handleSort = (key) => {
        if (sortKey === key) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('desc');
        }
    };

    const SortIcon = ({ colKey }) => {
        if (sortKey !== colKey) return <ChevronDown className="w-3 h-3 text-slate-300" />;
        return sortDir === 'asc'
            ? <ChevronUp className="w-3.5 h-3.5 text-blue-600" />
            : <ChevronDown className="w-3.5 h-3.5 text-blue-600" />;
    };

    const SortableHeader = ({ colKey, label, align = 'left' }) => (
        <th
            onClick={() => handleSort(colKey)}
            className={`p-3 font-semibold cursor-pointer hover:bg-slate-100 transition-colors select-none ${align === 'right' ? 'text-right' : ''}`}
        >
            <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
                {label}
                <SortIcon colKey={colKey} />
            </div>
        </th>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                        <TrendingUp className="w-8 h-8 text-blue-600" />
                        Evolução de Apontamentos
                    </h1>
                    <p className="text-slate-500">Acompanhamento diário da produção por Usuário e Setor.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={loadData} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
                        <Search className="w-4 h-4" />
                        Atualizar
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Data Início</label>
                        <input
                            type="date"
                            name="startDate"
                            value={filters.startDate}
                            onChange={handleFilterChange}
                            className="w-full px-3 py-2 border rounded-lg"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Data Fim</label>
                        <input
                            type="date"
                            name="endDate"
                            value={filters.endDate}
                            onChange={handleFilterChange}
                            className="w-full px-3 py-2 border rounded-lg"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Setor</label>
                        <select
                            name="sector"
                            value={filters.sector}
                            onChange={handleFilterChange}
                            className="w-full px-3 py-2 border rounded-lg bg-white"
                        >
                            <option value="">Todos os Setores</option>
                            {sectors.map((s, idx) => <option key={s.id || idx} value={s.id || s}>{s.nome || s}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Usuário</label>
                        <select
                            name="user"
                            value={filters.user}
                            onChange={handleFilterChange}
                            className="w-full px-3 py-2 border rounded-lg bg-white"
                        >
                            <option value="">Todos os Usuários</option>
                            {users.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Main Evolution Chart */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 lg:col-span-2">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Volume de Produção (Peças Apontadas)</h3>
                    <div className="h-[400px]">
                        {loading ? (
                            <div className="h-full flex items-center justify-center text-slate-400">Carregando dados...</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data}>
                                    <defs>
                                        <linearGradient id="colorQtd" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                    <YAxis />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend />
                                    <Area
                                        type="monotone"
                                        dataKey="total"
                                        name="Total Produzido"
                                        stroke="#2563eb"
                                        fillOpacity={1}
                                        fill="url(#colorQtd)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>

            {/* Ranking + Detail Grid side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* User Ranking */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-4">
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                            <Trophy className="w-5 h-5" />
                            Ranking por Registros
                        </h3>
                        <p className="text-amber-100 text-xs mt-0.5">Classificação por nº de apontamentos no período</p>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-[450px] overflow-y-auto">
                        {userRanking.length === 0 && (
                            <div className="p-6 text-center text-slate-400 text-sm italic">Nenhum dado no período</div>
                        )}
                        {userRanking.map((item, idx) => {
                            const isTop3 = idx < 3;
                            const maxReg = userRanking[0]?.totalRegistros || 1;
                            const pct = Math.round((item.totalRegistros / maxReg) * 100);
                            return (
                                <div key={item.usuario} className={`px-4 py-3 flex items-center gap-3 transition-colors ${isTop3 ? 'bg-amber-50/50' : 'hover:bg-slate-50'}`}>
                                    {/* Position */}
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                                        idx === 0 ? 'bg-amber-400 text-white shadow-md' :
                                        idx === 1 ? 'bg-slate-300 text-white shadow-sm' :
                                        idx === 2 ? 'bg-amber-600 text-white shadow-sm' :
                                        'bg-slate-100 text-slate-500'
                                    }`}>
                                        {idx + 1}º
                                    </div>

                                    {/* User info */}
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-semibold truncate ${isTop3 ? 'text-slate-900' : 'text-slate-700'}`}>
                                            {item.usuario}
                                        </p>
                                        {/* Progress bar */}
                                        <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-500"
                                                style={{
                                                    width: `${pct}%`,
                                                    backgroundColor: RANK_COLORS[idx] || '#94a3b8'
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* Stats */}
                                    <div className="text-right shrink-0">
                                        <p className={`text-sm font-black ${isTop3 ? 'text-slate-900' : 'text-slate-700'}`}>
                                            {item.totalRegistros.toLocaleString('pt-BR')}
                                        </p>
                                        <p className="text-[10px] text-slate-400 font-medium">
                                            {item.totalQtd.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} pçs
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Detail Table (sortable) */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 lg:col-span-2 overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-base font-bold text-slate-800">Detalhamento por Dia</h3>
                        <span className="text-xs bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full font-semibold">
                            {sortedRows.length} registros
                        </span>
                    </div>
                    <div className="overflow-auto max-h-[450px]">
                        <table className="w-full text-left text-sm text-slate-600">
                            <thead className="bg-slate-50 sticky top-0 z-10">
                                <tr>
                                    <SortableHeader colKey="date" label="Data" />
                                    <SortableHeader colKey="usuario" label="Usuário" />
                                    <SortableHeader colKey="setor" label="Setor" />
                                    <SortableHeader colKey="qtd" label="Qtd. Apontada" align="right" />
                                    <SortableHeader colKey="count" label="Registros" align="right" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {sortedRows.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-slate-400 italic">
                                            Nenhum dado encontrado para os filtros selecionados.
                                        </td>
                                    </tr>
                                )}
                                {sortedRows.map((row, idx) => (
                                    <tr key={`${row.date}-${row.usuario}-${idx}`} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-3 font-mono text-xs">{new Date(row.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                                        <td className="p-3">{row.usuario}</td>
                                        <td className="p-3 text-slate-400">{row.setor}</td>
                                        <td className="p-3 text-right font-bold text-slate-800">
                                            {row.qtd.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-3 text-right">
                                            <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                                {row.count}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
