import React, { useState, useEffect } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    AreaChart, Area
} from 'recharts';
import { Calendar, Users, Filter, TrendingUp, Search } from 'lucide-react';
import api from '../services/api';

export default function ProductionEvolution() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [sectors, setSectors] = useState([]);
    const [users, setUsers] = useState([]);

    // Filters
    const [filters, setFilters] = useState({
        startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0], // Last 30 days
        endDate: new Date().toISOString().split('T')[0],
        sector: '',
        user: ''
    });

    const loadData = async () => {
        setLoading(true);
        try {
            // Fetch chart data
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
                            {sectors.map(s => <option key={s} value={s}>{s}</option>)}
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

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Detalhamento por Dia</h3>
                <div className="overflow-auto max-h-[400px]">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 sticky top-0">
                            <tr>
                                <th className="p-3 font-semibold">Data</th>
                                <th className="p-3 font-semibold">Usuário</th>
                                <th className="p-3 font-semibold">Setor</th>
                                <th className="p-3 font-semibold text-right">Qtd. Apontada</th>
                                <th className="p-3 font-semibold text-right">Registros</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {data.flatMap(day =>
                                (day.details || []).map((detail, idx) => (
                                    <tr key={`${day.date}-${idx}`} className="hover:bg-slate-50">
                                        <td className="p-3">{new Date(day.date).toLocaleDateString()}</td>
                                        <td className="p-3">{detail.usuario}</td>
                                        <td className="p-3">{detail.setor || '-'}</td>
                                        <td className="p-3 text-right font-bold text-slate-800">{detail.qtd}</td>
                                        <td className="p-3 text-right">{detail.count}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
