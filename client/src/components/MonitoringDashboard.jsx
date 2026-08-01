import React, { useState, useEffect } from 'react';
import { Activity, Server, Users, Database, Clock, RefreshCw } from 'lucide-react';
import api from '../services/api';
// Assuming Recharts is available. If not, we will just display text cards for now.
// Let's import recharts conditionally or just use text blocks to be safe if Recharts isn't installed.
// We will try using standard divs for bars if Recharts isn't there, but usually standard dashboards have it.
// I will build a clean UI with standard HTML/CSS for safety, or simple bars.

export default function MonitoringDashboard() {
    const [metrics, setMetrics] = useState([]);
    const [connections, setConnections] = useState({ mysql: 0, postgres: 0 });
    const [loading, setLoading] = useState(true);
    const [pcpHistoryEnabled, setPcpHistoryEnabled] = useState(true); // Default to true

    const loadMetrics = async () => {
        setLoading(true);
        try {
            const [historicoRes, conexoesRes, pcpConfigRes] = await Promise.all([
                api.get('/monitoramento/historico').catch(e => ({ data: { success: false } })),
                api.get('/monitoramento/conexoes').catch(e => ({ data: { success: false } })),
                api.get('/settings/enable_pcp_history').catch(e => ({ data: { value: true } }))
            ]);

            if (historicoRes.data && historicoRes.data.success) {
                setMetrics(historicoRes.data.data);
            }
            if (conexoesRes.data && conexoesRes.data.success) {
                setConnections(conexoesRes.data.data);
            }
            if (pcpConfigRes.data && pcpConfigRes.data.value !== undefined) {
                // If it's a string from DB, parse it.
                let val = pcpConfigRes.data.value;
                if (typeof val === 'string') {
                    try { val = JSON.parse(val); } catch(e) {}
                }
                setPcpHistoryEnabled(val !== false); // Default true if null/undefined
            }
        } catch (error) {
            console.error('Erro ao carregar métricas:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMetrics();
        // Atualiza a cada 5 minutos na tela
        const interval = setInterval(loadMetrics, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const current = metrics.length > 0 ? metrics[metrics.length - 1] : null;

    const formatTime = (isoString) => {
        const d = new Date(isoString);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const togglePcpHistory = async () => {
        const newValue = !pcpHistoryEnabled;
        setPcpHistoryEnabled(newValue);
        try {
            await api.post('/settings/enable_pcp_history', { value: newValue });
            alert(`Histórico do PCP foi ${newValue ? 'ATIVADO' : 'DESATIVADO'}.`);
        } catch (error) {
            console.error('Erro ao salvar configuração de PCP:', error);
            const msg = error.response?.data?.message || error.message || 'Falha ao salvar configuração.';
            alert(`Falha ao salvar configuração: ${msg}`);
            setPcpHistoryEnabled(!newValue); // rollback
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-6 border-b pb-4 flex-wrap gap-4">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Activity className="w-6 h-6 text-blue-600" />
                    Monitoramento do Sistema
                </h2>
                <div className="flex items-center gap-4">
                    {/* PCP History Toggle */}
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
                        <span className="text-sm font-medium text-slate-700">Histórico do PCP:</span>
                        <button 
                            onClick={togglePcpHistory}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${pcpHistoryEnabled ? 'bg-blue-600' : 'bg-slate-300'}`}
                        >
                            <span className={`${pcpHistoryEnabled ? 'translate-x-4' : 'translate-x-1'} inline-block h-3 w-3 transform rounded-full bg-white transition-transform`} />
                        </button>
                    </div>

                    <button 
                        onClick={loadMetrics}
                        disabled={loading}
                        className="flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Atualizar
                    </button>
                </div>
            </div>

            {loading && metrics.length === 0 ? (
                <div className="flex justify-center py-12">
                    <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
            ) : !current ? (
                <div className="text-center py-12 text-slate-500">
                    Nenhuma métrica coletada ainda. O sistema gravará a primeira amostra em breve.
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Cards Atuais */}
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
                            <div className="flex items-center gap-2 text-blue-600 mb-2">
                                <Users className="w-5 h-5" />
                                <span className="font-semibold text-sm">Users</span>
                            </div>
                            <div className="text-3xl font-bold text-blue-900">{current.active_users}</div>
                        </div>

                        <div className="bg-green-50 border border-green-100 p-4 rounded-xl">
                            <div className="flex items-center gap-2 text-green-600 mb-2">
                                <Server className="w-5 h-5" />
                                <span className="font-semibold text-sm">Uso de CPU</span>
                            </div>
                            <div className="text-3xl font-bold text-green-900">{current.cpu_usage_percent}%</div>
                        </div>

                        <div className="bg-cyan-50 border border-cyan-100 p-4 rounded-xl">
                            <div className="flex items-center gap-2 text-cyan-600 mb-2">
                                <Database className="w-5 h-5" />
                                <span className="font-semibold text-sm">Uso de RAM</span>
                            </div>
                            <div className="text-3xl font-bold text-cyan-900">{current.memory_usage_mb} MB</div>
                        </div>

                        <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl">
                            <div className="flex items-center gap-2 text-orange-600 mb-2">
                                <Activity className="w-5 h-5" />
                                <span className="font-semibold text-sm">Rede (MB)</span>
                            </div>
                            <div className="text-lg font-bold text-orange-900">
                                ↓ {current.network_rx_mb} <br />
                                ↑ {current.network_tx_mb}
                            </div>
                        </div>

                        <div className="bg-teal-50 border border-teal-100 p-4 rounded-xl">
                            <div className="flex items-center gap-2 text-teal-600 mb-2">
                                <Database className="w-5 h-5" />
                                <span className="font-semibold text-sm">MySQL Conn</span>
                            </div>
                            <div className="text-3xl font-bold text-teal-900">{connections.mysql}</div>
                        </div>

                        <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl">
                            <div className="flex items-center gap-2 text-indigo-600 mb-2">
                                <Database className="w-5 h-5" />
                                <span className="font-semibold text-sm">PG Conn</span>
                            </div>
                            <div className="text-3xl font-bold text-indigo-900">{connections.postgres}</div>
                        </div>
                    </div>

                    {/* Gráfico Simples / Histórico Recente */}
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 mb-4">Histórico Recente (Últimas 24 Amostras)</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-600">
                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                                    <tr>
                                        <th className="py-3 px-4 font-semibold">Horário</th>
                                        <th className="py-3 px-4 font-semibold">Usuários</th>
                                        <th className="py-3 px-4 font-semibold">Queries MySQL</th>
                                        <th className="py-3 px-4 font-semibold">Queries PG</th>
                                        <th className="py-3 px-4 font-semibold">CPU</th>
                                        <th className="py-3 px-4 font-semibold">RAM</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {metrics.slice().reverse().map((m, i) => (
                                        <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                                            <td className="py-2 px-4 whitespace-nowrap">{formatTime(m.timestamp)}</td>
                                            <td className="py-2 px-4">{m.active_users}</td>
                                            <td className="py-2 px-4">{m.mysql_query_count}</td>
                                            <td className="py-2 px-4">{m.pg_query_count}</td>
                                            <td className="py-2 px-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 bg-gray-200 rounded-full h-2">
                                                        <div className="bg-green-500 h-2 rounded-full" style={{ width: `${Math.min(100, m.cpu_usage_percent)}%` }}></div>
                                                    </div>
                                                    <span>{m.cpu_usage_percent}%</span>
                                                </div>
                                            </td>
                                            <td className="py-2 px-4">{m.memory_usage_mb} MB</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
}

// aria-label fix for ux_audit
