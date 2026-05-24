import React, { useState, useEffect } from 'react';
import { Database, Server, RefreshCw, Cpu, HardDrive, Clock, Activity, Zap } from 'lucide-react';
import api from '../services/api';

export default function DBAMonitoringTab() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState(null);

    const loadSnapshot = async () => {
        try {
            const res = await api.get('/monitoramento/dba/snapshot');
            if (res.data.success) {
                setData(res.data.data);
                setLastUpdate(new Date());
            }
        } catch (error) {
            console.error('Erro ao carregar snapshot DBA:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSnapshot();
        const interval = setInterval(loadSnapshot, 10000); // 10 seconds polling
        return () => clearInterval(interval);
    }, []);

    const formatBytes = (bytes) => {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatUptime = (seconds) => {
        const d = Math.floor(seconds / (3600 * 24));
        const h = Math.floor((seconds % (3600 * 24)) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return `${d}d ${h}h ${m}m`;
    };

    if (loading && !data) {
        return (
            <div className="flex justify-center items-center h-64 text-blue-500">
                <RefreshCw className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    if (!data) {
        return <div className="text-red-500 p-4">Erro ao carregar métricas do servidor.</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3">
                    <Database className="w-6 h-6 text-slate-800" />
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Monitoramento DBA e Infraestrutura</h2>
                        <p className="text-sm text-slate-500">
                            Atualizado em: {lastUpdate ? lastUpdate.toLocaleTimeString() : '--:--:--'} (Polling: 10s)
                        </p>
                    </div>
                </div>
                <button 
                    onClick={loadSnapshot}
                    className="flex items-center gap-2 bg-blue-50 text-blue-600 hover:bg-blue-100 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Forçar Atualização
                </button>
            </div>

            {/* Hardware / Node Info */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
                    <div className="p-3 bg-cyan-50 text-cyan-600 rounded-lg">
                        <Server className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">Uptime Servidor</p>
                        <p className="text-lg font-bold text-slate-800">{formatUptime(data.hardware.uptime)}</p>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                        <Cpu className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">Carga CPU (Avg)</p>
                        <p className="text-lg font-bold text-slate-800">{data.hardware.cpuLoad.toFixed(2)}</p>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
                    <div className="p-3 bg-green-50 text-green-600 rounded-lg">
                        <HardDrive className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">RAM Livre (OS)</p>
                        <p className="text-lg font-bold text-slate-800">{formatBytes(data.hardware.freeMem)}</p>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
                    <div className="p-3 bg-orange-50 text-orange-600 rounded-lg">
                        <Activity className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">Uso RAM (Node.js)</p>
                        <p className="text-lg font-bold text-slate-800">{formatBytes(data.hardware.nodeMem)}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* PostgreSQL (Protheus) */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-indigo-50 px-6 py-4 border-b border-indigo-100 flex justify-between items-center">
                        <div className="flex items-center gap-2 text-indigo-700">
                            <Database className="w-5 h-5" />
                            <h3 className="font-bold">PostgreSQL (Protheus)</h3>
                        </div>
                        <span className="text-xs bg-indigo-200 text-indigo-800 px-2 py-1 rounded-full font-medium">
                            {data.postgres.dbSize}
                        </span>
                    </div>
                    <div className="p-6 space-y-6">
                        <div className="flex gap-8">
                            <div>
                                <p className="text-sm text-slate-500 mb-1">Conexões Ativas</p>
                                <p className="text-3xl font-bold text-indigo-600">{data.postgres.active}</p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 mb-1">Conexões Totais</p>
                                <p className="text-3xl font-bold text-slate-700">{data.postgres.total}</p>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3 border-b pb-2">
                                <Zap className="w-4 h-4 text-amber-500" /> Slow Queries Ativas
                            </h4>
                            {data.postgres.slowQueries.length === 0 ? (
                                <p className="text-sm text-green-600 font-medium">Nenhuma query lenta ou travada detectada.</p>
                            ) : (
                                <div className="space-y-3">
                                    {data.postgres.slowQueries.map((q) => (
                                        <div key={q.pid} className="bg-slate-50 p-3 rounded-lg text-xs border border-slate-200">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="font-mono font-bold text-slate-700">PID: {q.pid}</span>
                                                <span className={`font-bold ${q.duration > 5 ? 'text-red-500' : 'text-amber-500'}`}>
                                                    <Clock className="w-3 h-3 inline mr-1" /> {parseFloat(q.duration).toFixed(2)}s
                                                </span>
                                            </div>
                                            <div className="text-slate-500 mb-1">User: {q.usename} | IP: {q.client_addr}</div>
                                            <pre className="text-[10px] text-slate-600 whitespace-pre-wrap break-all bg-white p-2 border rounded font-mono">
                                                {q.query}
                                            </pre>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* MySQL (Alfatec) */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-teal-50 px-6 py-4 border-b border-teal-100 flex justify-between items-center">
                        <div className="flex items-center gap-2 text-teal-700">
                            <Database className="w-5 h-5" />
                            <h3 className="font-bold">MySQL (MetalFisa)</h3>
                        </div>
                    </div>
                    <div className="p-6 space-y-6">
                        <div>
                            <p className="text-sm text-slate-500 mb-1">Threads Conectadas</p>
                            <p className="text-3xl font-bold text-teal-600">{data.mysql.active}</p>
                        </div>

                        <div>
                            <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3 border-b pb-2">
                                <Zap className="w-4 h-4 text-amber-500" /> Processos Ativos (Full Processlist)
                            </h4>
                            {data.mysql.processList.length === 0 ? (
                                <p className="text-sm text-green-600 font-medium">Nenhum processo ativo no momento.</p>
                            ) : (
                                <div className="space-y-3">
                                    {data.mysql.processList.map((p) => (
                                        <div key={p.id} className="bg-slate-50 p-3 rounded-lg text-xs border border-slate-200">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="font-mono font-bold text-slate-700">ID: {p.id}</span>
                                                <span className={`font-bold ${p.time > 5 ? 'text-red-500' : 'text-amber-500'}`}>
                                                    <Clock className="w-3 h-3 inline mr-1" /> {p.time}s
                                                </span>
                                            </div>
                                            <div className="text-slate-500 mb-1">User: {p.user} | DB: {p.db || 'N/A'} | State: {p.state}</div>
                                            {p.info && (
                                                <pre className="text-[10px] text-slate-600 whitespace-pre-wrap break-all bg-white p-2 border rounded font-mono">
                                                    {p.info}
                                                </pre>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
