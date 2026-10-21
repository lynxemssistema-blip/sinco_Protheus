import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { 
    Target, 
    ShieldAlert, 
    CheckCircle2, 
    ExternalLink, 
    Sparkles, 
    TrendingUp, 
    Building2, 
    Users, 
    Calendar, 
    RefreshCw, 
    Activity,
    Mail,
    Phone,
    Copy,
    Check
} from 'lucide-react';

export default function GoogleAdsPainel() {
    const { isSuperAdmin, user } = useAuth();
    const [empresas, setEmpresas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const [testStatus, setTestStatus] = useState(null);

    const GOOGLE_TAG_ID = 'AW-18527829657';
    const CONVERSION_URL = 'https://lynxems.com.br/cadastro-concluido';

    const carregarConversoes = async () => {
        setLoading(true);
        try {
            const res = await api.get('/superadmin/empresas');
            setEmpresas(res.data?.empresas || []);
        } catch (err) {
            console.error('Erro ao carregar dados de conversão:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isSuperAdmin) {
            carregarConversoes();
        }
    }, [isSuperAdmin]);

    const handleCopyUrl = () => {
        navigator.clipboard.writeText(CONVERSION_URL);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    const handleTestEvent = () => {
        if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
            try {
                window.gtag('event', 'conversion', {
                    send_to: GOOGLE_TAG_ID
                });
                setTestStatus({
                    ok: true,
                    msg: `Evento enviado com sucesso para ${GOOGLE_TAG_ID}!`
                });
            } catch (err) {
                setTestStatus({
                    ok: false,
                    msg: `Erro no disparo do gtag: ${err.message}`
                });
            }
        } else {
            setTestStatus({
                ok: false,
                msg: 'Objeto window.gtag não detectado neste contexto local.'
            });
        }
        setTimeout(() => setTestStatus(null), 5000);
    };

    // Trava de segurança no frontend
    if (!isSuperAdmin) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 mb-4">
                    <ShieldAlert className="w-8 h-8" />
                </div>
                <h1 className="text-2xl font-black text-slate-800 dark:text-white mb-2">
                    Acesso Restrito ao Superadministrador
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
                    Este painel gerencial de tráfego, campanhas e conversões do Google Ads é reservado exclusivamente ao administrador global da plataforma Lynx EMS.
                </p>
            </div>
        );
    }

    const totalConversoes = empresas.length;
    const conversoesAtivas = empresas.filter(e => e.ativa === 1 || e.ativa === true).length;
    const conversoesTrial = empresas.filter(e => e.status_plano === 'trial').length;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
            {/* Cabeçalho */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            Superadmin Exclusivo
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            Marketing & Conversão
                        </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                        <Target className="w-7 h-7 text-emerald-500" />
                        Painel Google Ads & Conversões de Empresas
                    </h1>
                </div>

                <div className="flex items-center gap-2.5">
                    <button
                        onClick={carregarConversoes}
                        disabled={loading}
                        className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center gap-2 cursor-pointer"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        Atualizar
                    </button>

                    <a
                        href="https://ads.google.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-sm cursor-pointer"
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Abrir Google Ads
                    </a>
                </div>
            </div>

            {/* Cards de Métricas Principais */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Total de Conversões
                        </span>
                        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            <TrendingUp className="w-4 h-4" />
                        </div>
                    </div>
                    <p className="text-3xl font-black text-slate-900 dark:text-white">
                        {loading ? '...' : totalConversoes}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Empresas que concluíram cadastro</p>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Empresas em Trial
                        </span>
                        <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            <Sparkles className="w-4 h-4" />
                        </div>
                    </div>
                    <p className="text-3xl font-black text-blue-600 dark:text-blue-400">
                        {loading ? '...' : conversoesTrial}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Período de 14 dias ativo</p>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Empresas Ativas
                        </span>
                        <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                    </div>
                    <p className="text-3xl font-black text-teal-600 dark:text-teal-400">
                        {loading ? '...' : conversoesAtivas}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Com acesso liberado ao ERP</p>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Tag Global do Ads
                        </span>
                        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            <Activity className="w-4 h-4" />
                        </div>
                    </div>
                    <p className="text-xl font-mono font-black text-emerald-600 dark:text-emerald-400 truncate">
                        {GOOGLE_TAG_ID}
                    </p>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                        ● Ativa em produção
                    </span>
                </div>
            </div>

            {/* Painel de Configurações Técnicas da Conversão */}
            <div className="p-6 rounded-2xl bg-slate-900 text-white border border-slate-800 shadow-md space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-emerald-400" />
                            Configuração da Meta de Conversão no Google Ads
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Use a URL abaixo no painel do Google Ads como regra de conversão por carregamento de página:
                        </p>
                    </div>

                    <button
                        onClick={handleTestEvent}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition cursor-pointer self-start sm:self-auto"
                    >
                        Testar Disparo de Evento
                    </button>
                </div>

                {testStatus && (
                    <div className={`p-3 rounded-xl text-xs font-bold ${testStatus.ok ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'}`}>
                        {testStatus.msg}
                    </div>
                )}

                <div className="flex items-center gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-xs font-mono text-emerald-400 flex-1 truncate">
                        {CONVERSION_URL}
                    </span>
                    <button
                        onClick={handleCopyUrl}
                        className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-slate-200 transition flex items-center gap-1.5 cursor-pointer flex-shrink-0"
                    >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? 'Copiado!' : 'Copiar URL'}
                    </button>
                </div>
            </div>

            {/* Tabela de Empresas Convertidas */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div>
                        <h2 className="text-base font-bold text-slate-900 dark:text-white">
                            Histórico de Empresas Convertidas
                        </h2>
                        <p className="text-xs text-slate-500">
                            Registros automáticos gerados pelo fluxo de cadastro oficial
                        </p>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {empresas.length} registros
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-950/50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200 dark:border-slate-800">
                            <tr>
                                <th className="p-4">ID</th>
                                <th className="p-4">Empresa / Razão Social</th>
                                <th className="p-4">CNPJ</th>
                                <th className="p-4">Responsável Master</th>
                                <th className="p-4">Data do Cadastro</th>
                                <th className="p-4">Status Trial</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-200 font-medium">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-400">
                                        Carregando conversões de empresas...
                                    </td>
                                </tr>
                            ) : empresas.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-400">
                                        Nenhuma conversão registrada até o momento.
                                    </td>
                                </tr>
                            ) : (
                                empresas.map(emp => (
                                    <tr key={emp.IdEmpresa} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                                        <td className="p-4 font-mono font-bold text-slate-500">
                                            #{emp.IdEmpresa}
                                        </td>
                                        <td className="p-4">
                                            <div className="font-bold text-slate-900 dark:text-white">
                                                {emp.NomeFantasia || emp.RazaoSocial}
                                            </div>
                                            <div className="text-[11px] text-slate-400">
                                                {emp.Segmento || 'Indústria'}
                                            </div>
                                        </td>
                                        <td className="p-4 font-mono">
                                            {emp.Cnpj || 'Não informado'}
                                        </td>
                                        <td className="p-4">
                                            <div className="font-bold">{emp.responsavel_nome || 'Master'}</div>
                                            <div className="text-[11px] text-slate-400">{emp.responsavel_email || emp.Email || '-'}</div>
                                        </td>
                                        <td className="p-4 text-slate-500">
                                            {emp.CriadoEm ? new Date(emp.CriadoEm).toLocaleDateString('pt-BR') : '-'}
                                        </td>
                                        <td className="p-4">
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                {emp.status_plano || 'Trial'}
                                            </span>
                                        </td>
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
