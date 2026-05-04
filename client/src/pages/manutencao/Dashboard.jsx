import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Activity, Clock, AlertTriangle, DollarSign, PenTool, CheckCircle2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { format, differenceInHours, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];
const STATUS_COLORS = {
    'ABERTA': '#f59e0b',
    'EM ANDAMENTO': '#3b82f6',
    'AGUARDANDO PECA': '#8b5cf6',
    'CONCLUIDA': '#10b981',
    'CANCELADA': '#ef4444'
};

export default function ManutencaoDashboard() {
    const [ordens, setOrdens] = useState([]);
    const [maquinas, setMaquinas] = useState([]);
    const [tecnicos, setTecnicos] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [resOrdens, resMaq, resTec] = await Promise.all([
                api.get('/manutencao/ordens'),
                api.get('/manutencao/maquinas'),
                api.get('/manutencao/tecnicos')
            ]);
            setOrdens(resOrdens.data || []);
            setMaquinas(resMaq.data || []);
            setTecnicos(resTec.data || []);
        } catch (error) {
            console.error("Erro ao carregar dados do dashboard:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    // 1. KPI: MTTR (Mean Time to Repair)
    const ordensConcluidas = ordens.filter(o => o.status === 'CONCLUIDA' && o.data_abertura && o.data_fim);
    let totalHoursRepair = 0;
    ordensConcluidas.forEach(o => {
        const horas = differenceInHours(new Date(o.data_fim), new Date(o.data_abertura));
        if (horas > 0) totalHoursRepair += horas;
    });
    const mttr = ordensConcluidas.length > 0 ? (totalHoursRepair / ordensConcluidas.length).toFixed(1) : 0;

    // 2. KPI: OMs Pendentes / Críticas
    const pendentes = ordens.filter(o => o.status !== 'CONCLUIDA' && o.status !== 'CANCELADA');
    const criticas = pendentes.filter(o => o.prioridade === 'CRITICA').length;

    // 3. KPI: Custo Total
    const custoTotal = ordens.reduce((acc, o) => {
        return acc + (Number(o.custo_materiais) || 0) + (Number(o.custo_servico) || 0);
    }, 0);

    // 4. KPI: Máquinas Operando
    const maquinasOperando = maquinas.filter(m => m.status_operacional === 'OPERANDO').length;
    const dispMaquinas = maquinas.length > 0 ? ((maquinasOperando / maquinas.length) * 100).toFixed(1) : 0;

    // Chart 1: O.Ms por Status
    const statusCount = ordens.reduce((acc, o) => {
        acc[o.status] = (acc[o.status] || 0) + 1;
        return acc;
    }, {});
    const dataStatus = Object.keys(statusCount).map(key => ({
        name: key,
        value: statusCount[key]
    }));

    // Chart 2: O.Ms por Setor
    const setorCount = {};
    ordens.forEach(o => {
        const maq = maquinas.find(m => m.id === o.id_maquina);
        const setor = maq && maq.setor_nome ? maq.setor_nome : 'Sem Setor';
        setorCount[setor] = (setorCount[setor] || 0) + 1;
    });
    const dataSetores = Object.keys(setorCount).map(key => ({
        name: key,
        Ordens: setorCount[key]
    })).sort((a, b) => b.Ordens - a.Ordens).slice(0, 8); // top 8

    // Chart 3: Desempenho / Horas de Técnicos (Aproximação por OMs concluídas)
    const tecCount = {};
    tecnicos.forEach(t => { tecCount[t.id] = { name: t.NomeCompleto.split(' ')[0], concluídas: 0 } });
    
    ordensConcluidas.forEach(o => {
        let tecs = o.tecnicos_execucao;
        if (typeof tecs === 'string') {
            try { tecs = JSON.parse(tecs); } catch(e) { tecs = []; }
        }
        if (Array.isArray(tecs)) {
            tecs.forEach(tid => {
                if (tecCount[tid]) tecCount[tid].concluídas += 1;
            });
        }
    });
    const dataTecnicos = Object.values(tecCount).filter(t => t.concluídas > 0).sort((a, b) => b.concluídas - a.concluídas);

    // Chart 4: Evolução Mensal (Últimos 6 meses)
    const mesesMap = {};
    const hoje = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        const label = format(d, 'MMM/yy', { locale: ptBR });
        mesesMap[label] = { name: label, Abertas: 0, Concluídas: 0 };
    }

    ordens.forEach(o => {
        if (o.data_abertura) {
            const label = format(new Date(o.data_abertura), 'MMM/yy', { locale: ptBR });
            if (mesesMap[label]) mesesMap[label].Abertas += 1;
        }
        if (o.data_fim && o.status === 'CONCLUIDA') {
            const label = format(new Date(o.data_fim), 'MMM/yy', { locale: ptBR });
            if (mesesMap[label]) mesesMap[label].Concluídas += 1;
        }
    });
    const dataEvolucao = Object.values(mesesMap);

    return (
        <div className="p-6 bg-slate-50 min-h-screen">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800">Painel Geral de Manutenção</h1>
                <p className="text-sm text-slate-500">Indicadores de desempenho, custos e status do parque fabril</p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">MTTR Global</p>
                            <h3 className="text-2xl font-bold text-slate-800 mt-1">{mttr} <span className="text-sm font-normal text-slate-500">horas</span></h3>
                        </div>
                        <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600">
                            <Clock size={24} />
                        </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">Tempo Médio de Reparo (O.Ms concluídas)</p>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">O.Ms Críticas Pendentes</p>
                            <h3 className="text-2xl font-bold text-red-600 mt-1">{criticas}</h3>
                        </div>
                        <div className="p-3 bg-red-50 rounded-lg text-red-600">
                            <AlertTriangle size={24} />
                        </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">De um total de {pendentes.length} pendentes</p>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Custo Total de O.Ms</p>
                            <h3 className="text-2xl font-bold text-slate-800 mt-1">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(custoTotal)}
                            </h3>
                        </div>
                        <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
                            <DollarSign size={24} />
                        </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">Soma de materiais e serviços (Global)</p>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Saúde do Parque Fabril</p>
                            <h3 className="text-2xl font-bold text-slate-800 mt-1">{dispMaquinas}%</h3>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
                            <Activity size={24} />
                        </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">{maquinasOperando} de {maquinas.length} máquinas operando</p>
                </div>
            </div>

            {/* Gráficos Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <PenTool size={18} className="text-indigo-600" />
                        O.Ms por Setor
                    </h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                            <BarChart data={dataSetores} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                <XAxis type="number" />
                                <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
                                <RechartsTooltip 
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="Ordens" fill="#4f46e5" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Activity size={18} className="text-emerald-600" />
                        Evolução Mensal (Abertas vs Concluídas)
                    </h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                            <LineChart data={dataEvolucao} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" tick={{fontSize: 12}} />
                                <YAxis tick={{fontSize: 12}} />
                                <RechartsTooltip 
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend wrapperStyle={{ fontSize: '12px' }} />
                                <Line type="monotone" dataKey="Abertas" stroke="#f59e0b" strokeWidth={3} dot={{r:4}} />
                                <Line type="monotone" dataKey="Concluídas" stroke="#10b981" strokeWidth={3} dot={{r:4}} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Gráficos Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <CheckCircle2 size={18} className="text-blue-600" />
                        Desempenho dos Técnicos (O.Ms Concluídas)
                    </h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                            <BarChart data={dataTecnicos} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" tick={{fontSize: 12}} />
                                <YAxis tick={{fontSize: 12}} />
                                <RechartsTooltip 
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="concluídas" name="O.Ms Concluídas" fill="#0ea5e9" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <AlertTriangle size={18} className="text-orange-600" />
                        Status Geral das O.Ms
                    </h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                            <PieChart>
                                <Pie
                                    data={dataStatus}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={100}
                                    paddingAngle={3}
                                    dataKey="value"
                                    label={({name, percent}) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                    labelLine={false}
                                >
                                    {dataStatus.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip 
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

        </div>
    );
}
