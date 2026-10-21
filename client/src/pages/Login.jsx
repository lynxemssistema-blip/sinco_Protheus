import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Lock, User, LogIn, Mail, ArrowLeft, Send, UserPlus, HelpCircle, Smartphone, ExternalLink, Key, Building2, CheckCircle2, Clock, ShieldAlert, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import { useHelp } from '../contexts/HelpContext';
import HelpDrawer from '../components/HelpDrawer';
import { AppLogo, Button } from '../components/ui';
import simLogo from '../assets/sim-consultoria-logo.png';

import LandingPage from './LandingPage';

const Login = () => {
    const [searchParams] = useSearchParams();
    const location = useLocation();

    // Checa se veio com intenção de cadastrar empresa
    const isRegisterEmpresaInitial = 
        searchParams.get('mode') === 'register' || 
        searchParams.get('tab') === 'empresa' || 
        searchParams.get('cadastrar') === 'empresa' ||
        location.state?.mode === 'register' ||
        location.state?.tab === 'empresa';

    const [loginInput, setLoginInput] = useState('');
    const [passwordInput, setPasswordInput] = useState('');
    const [recoverEmail, setRecoverEmail] = useState('');
    
    // Register states (Multi-Tenant Onboarding)
    const [regName, setRegName] = useState('');
    const [regEmail, setRegEmail] = useState('');
    const [regPassword, setRegPassword] = useState('');
    const [regEmpresa, setRegEmpresa] = useState('');
    const [regCnpj, setRegCnpj] = useState('');
    const [regTelefone, setRegTelefone] = useState('');
    const [regSegmento, setRegSegmento] = useState('Indústria & Caldeiraria');
    const [regTab, setRegTab] = useState(
        searchParams.get('tab') === 'empresa' || 
        searchParams.get('cadastrar') === 'empresa' || 
        location.state?.tab === 'empresa' 
            ? 'empresa' 
            : (isRegisterEmpresaInitial ? 'empresa' : 'convite')
    );
    const [regCodigoConvite, setRegCodigoConvite] = useState('');

    const [error, setError] = useState('');
    const [deactivatedInfo, setDeactivatedInfo] = useState(null);
    const [successMsg, setSuccessMsg] = useState('');
    const [loading, setLoading] = useState(false);
    const [showRecoveryHint, setShowRecoveryHint] = useState(false);
    
    const [view, setView] = useState(isRegisterEmpresaInitial ? 'register' : 'login'); // 'login', 'recover', 'register'

    const { login, signed } = useAuth();
    const { toggleHelp } = useHelp();
    const navigate = useNavigate();

    // Sincroniza parâmetros de rota caso mude após a montagem
    React.useEffect(() => {
        const mode = searchParams.get('mode') || location.state?.mode;
        const tab = searchParams.get('tab') || location.state?.tab;
        const cadastrar = searchParams.get('cadastrar') || location.state?.cadastrar;

        if (mode === 'register' || tab === 'empresa' || cadastrar === 'empresa') {
            setView('register');
            if (tab === 'empresa' || cadastrar === 'empresa') {
                setRegTab('empresa');
            }
        }
    }, [searchParams, location.state]);

    // If user is already logged in, redirect to visao-geral automatically
    React.useEffect(() => {
        if (signed) {
            navigate('/visao-geral', { replace: true });
        }
    }, [signed, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setLoading(true);

        const result = await login(loginInput.trim(), passwordInput);
        setLoading(false);

        if (result.success) {
            navigate('/ajuda');
        } else {
            if (result.code === 'EMPRESA_DESATIVADA') {
                setDeactivatedInfo({
                    message: result.message,
                    empresa: result.empresa
                });
                setError('');
            } else {
                setDeactivatedInfo(null);
                setError(result.message);
                if (result.message && result.message.toLowerCase().includes('credenciais')) {
                    setShowRecoveryHint(true);
                }
            }
        }
    };

    const handleRecover = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setLoading(true);

        try {
            const res = await api.post('/auth/recuperar-senha', { email: recoverEmail });
            setSuccessMsg(res.data.message);
            setRecoverEmail('');
        } catch (err) {
            setError(err.response?.data?.error || err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setLoading(true);

        try {
            const res = await api.post('/auth/register-company', {
                nome: regName,
                email: regEmail,
                senha: regPassword,
                telefone: regTelefone,
                nomeEmpresa: regEmpresa || `Empresa de ${regName}`,
                cnpj: regCnpj,
                segmento: regSegmento
            });

            if (res.data?.token && res.data?.user) {
                localStorage.setItem('@Lynx:token', res.data.token);
                localStorage.setItem('@Lynx:user', JSON.stringify(res.data.user));
                api.defaults.headers.Authorization = `Bearer ${res.data.token}`;
                window.location.href = '/cadastro-concluido';
                return;
            }

            window.location.href = '/cadastro-concluido';
        } catch (err) {
            setError(err.response?.data?.message || err.response?.data?.error || err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRegisterColaborador = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setLoading(true);

        try {
            const res = await api.post('/auth/register-with-code', {
                nome: regName,
                email: regEmail,
                senha: regPassword,
                telefone: regTelefone,
                codigo_seguranca: regCodigoConvite
            });

            if (res.data?.token && res.data?.user) {
                localStorage.setItem('@Lynx:token', res.data.token);
                localStorage.setItem('@Lynx:user', JSON.stringify(res.data.user));
                api.defaults.headers.Authorization = `Bearer ${res.data.token}`;
                alert(res.data.message || 'Cadastro realizado com sucesso! Bem-vindo.');
                window.location.href = '/visao-geral';
                return;
            }

            setSuccessMsg(res.data.message || 'Cadastro realizado com sucesso!');
            setView('login');
        } catch (err) {
            setError(err.response?.data?.message || err.response?.data?.error || err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Contextual Landing Page Background */}
            <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
                <LandingPage />
            </div>

            {/* Dark Overlay with Blur */}
            <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-md" />

            {/* Login Form Container */}
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 overflow-y-auto">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100 relative transform transition-all my-auto">
                    <div className="bg-[#32423D] p-8 text-center text-white relative flex flex-col items-center">
                    {view !== 'login' ? (
                        <button 
                            onClick={() => { setView('login'); setError(''); setSuccessMsg(''); }}
                            className="absolute left-4 top-4 text-white/80 hover:text-white transition"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    ) : (
                        <button 
                            onClick={() => navigate('/')}
                            className="absolute left-4 top-4 text-white/80 hover:text-white transition flex items-center gap-1 text-xs font-bold uppercase tracking-wider bg-white/10 px-2 py-1 rounded"
                            title="Voltar para o site"
                        >
                            <ArrowLeft className="w-4 h-4" /> Site
                        </button>
                    )}
                    <div className="bg-white/10 backdrop-blur-sm p-3 rounded-2xl shadow-md mb-4 flex items-center justify-center border border-white/20">
                        <AppLogo variant="sublogo-snow" size="lg" />
                    </div>
                    <h1 className="text-2xl font-black mb-1 tracking-tight">SINCO Industrial Suite</h1>
                    <p className="text-[#E0E800] font-bold text-xs tracking-wider uppercase mb-1">Lynx EMS Sistemas ✕ SIM Consultoria</p>
                    <p className="opacity-90 font-medium text-sm">
                        {view === 'recover' ? 'Recuperação de Acesso' : view === 'register' ? 'Criar Nova Conta' : 'Acesso Restrito ao Sistema'}
                    </p>
                </div>

                <div className="p-8">
                    {successMsg && (
                        <div className="bg-green-50 text-green-700 p-4 rounded-lg text-sm border border-green-200 text-center font-medium mb-6">
                            {successMsg}
                        </div>
                    )}
                    {deactivatedInfo && (
                        <div className="bg-amber-50/90 border-2 border-amber-400 rounded-2xl p-5 mb-6 text-left shadow-md animate-fadeIn">
                            <div className="flex items-start gap-3.5">
                                <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-xs shrink-0">
                                    <ShieldAlert className="w-6 h-6" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h4 className="font-bold text-amber-950 text-sm">
                                            Acesso Suspenso / Empresa Desativada
                                        </h4>
                                        {deactivatedInfo.empresa?.nome && (
                                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 font-bold border border-amber-300">
                                                {deactivatedInfo.empresa.nome}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-amber-900/90 mt-2 leading-relaxed font-medium">
                                        {deactivatedInfo.message}
                                    </p>
                                    <div className="mt-3 pt-2.5 border-t border-amber-200 text-[11px] text-amber-800 flex items-center justify-between">
                                        <span className="font-semibold">Vencimento da Mensalidade:</span>
                                        <span className="font-bold text-amber-950">
                                            {deactivatedInfo.empresa?.vencimento 
                                                ? new Date(deactivatedInfo.empresa.vencimento).toLocaleDateString('pt-BR') 
                                                : 'Aguardando regularização'}
                                        </span>
                                    </div>
                                    <div className="mt-2 text-[11px] text-amber-700/80 font-medium">
                                        ℹ️ Solicite a revalidação ou reativação junto ao administrador ou financeiro da plataforma.
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm border border-red-100 text-center mb-6">
                            {error}
                            {showRecoveryHint && view === 'login' && (
                                <div className="mt-3 pt-3 border-t border-red-200 text-orange-700 bg-orange-50/50 p-2 rounded text-xs font-medium text-left leading-relaxed">
                                    💡 <b>Dica:</b> Se sua senha foi redefinida recentemente pelo administrador, clique no botão <b className="text-orange-800">"Esqueceu a senha?"</b> logo abaixo para receber seu novo acesso via WhatsApp ou E-mail.
                                </div>
                            )}
                        </div>
                    )}

                    {view === 'recover' && (
                        <form onSubmit={handleRecover} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Seu WhatsApp ou E-mail</label>
                                <p className="text-xs text-gray-500 mb-3">Uma nova senha temporária será gerada e enviada para você.</p>
                                <div className="relative">
                                    <div className="absolute left-3 top-3 text-gray-400 flex gap-1">
                                        <Smartphone className="h-5 w-5" />
                                    </div>
                                    <input
                                        type="text"
                                        required
                                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                        placeholder="(99) 99999-9999 ou usuario@email.com"
                                        value={recoverEmail}
                                        onChange={(e) => setRecoverEmail(e.target.value)}
                                    />
                                </div>
                            </div>

                            <Button
                                type="submit"
                                variant="cta"
                                size="lg"
                                loading={loading}
                                icon={Send}
                                className="w-full shadow-md"
                            >
                                Receber Nova Senha
                            </Button>
                        </form>
                    )}

                    {view === 'register' && (
                        <div>
                            {/* Abas: Colaborador com Código vs Criar Empresa */}
                            <div className="flex rounded-xl bg-slate-100 p-1 mb-4 border border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => { setRegTab('convite'); setError(''); }}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                                        regTab === 'convite' 
                                            ? 'bg-emerald-600 text-white shadow-xs' 
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    <Key className="w-3.5 h-3.5" />
                                    <span>Sou Colaborador</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setRegTab('empresa'); setError(''); }}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                                        regTab === 'empresa' 
                                            ? 'bg-blue-600 text-white shadow-xs' 
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    <Building2 className="w-3.5 h-3.5" />
                                    <span>Criar Empresa (Master)</span>
                                </button>
                            </div>

                            {/* Formulário: Sou Colaborador com Código de 30min */}
                            {regTab === 'convite' ? (
                                <form onSubmit={handleRegisterColaborador} className="space-y-3.5">
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-left">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                                                <Key className="w-4 h-4 text-emerald-700" />
                                                Código de Segurança da Empresa
                                            </label>
                                            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                                                <Clock className="w-3 h-3" /> 30 min
                                            </span>
                                        </div>
                                        <input
                                            type="text"
                                            required
                                            maxLength={10}
                                            className="w-full px-3.5 py-2.5 rounded-lg border-2 border-emerald-400 focus:border-emerald-600 outline-none text-center font-mono font-black text-xl tracking-widest uppercase bg-white text-slate-900 shadow-inner"
                                            placeholder="Ex: 839201"
                                            value={regCodigoConvite}
                                            onChange={(e) => setRegCodigoConvite(e.target.value.trim())}
                                        />
                                        <p className="text-[11px] text-emerald-800 font-medium mt-1.5 text-center leading-tight">
                                            ⚠️ Digite o código de 6 dígitos enviado pelo <strong>Master da empresa pelo WhatsApp</strong>.
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Seu Nome Completo</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full px-3.5 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-xs transition-all"
                                            placeholder="Seu nome"
                                            value={regName}
                                            onChange={(e) => setRegName(e.target.value)}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">WhatsApp / Celular</label>
                                            <input
                                                type="text"
                                                className="w-full px-3.5 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-xs transition-all"
                                                placeholder="(11) 99999-9999"
                                                value={regTelefone}
                                                onChange={(e) => setRegTelefone(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">E-mail (Login)</label>
                                            <input
                                                type="email"
                                                required
                                                className="w-full px-3.5 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-xs transition-all"
                                                placeholder="seuemail@empresa.com"
                                                value={regEmail}
                                                onChange={(e) => setRegEmail(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Criar Senha de Acesso</label>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                            <input
                                                type="password"
                                                required
                                                className="w-full pl-9 pr-3.5 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-xs transition-all"
                                                placeholder="••••••••"
                                                value={regPassword}
                                                onChange={(e) => setRegPassword(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <Button
                                        type="submit"
                                        variant="cta"
                                        size="lg"
                                        loading={loading}
                                        icon={CheckCircle2}
                                        className="w-full mt-2 shadow-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                    >
                                        Validar Código e Conectar à Empresa
                                    </Button>
                                </form>
                            ) : (
                                /* Formulário: Criar Nova Empresa (Master) */
                                <form onSubmit={handleRegister} className="space-y-4">
                                    {/* Banner 14 Dias Grátis */}
                                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-3 rounded-xl shadow-sm text-center">
                                        <span className="text-xs font-black uppercase tracking-wider block">🚀 14 DIAS DE TESTE GRÁTIS</span>
                                        <span className="text-[11px] text-blue-100 block mt-0.5">
                                            Acesso completo ao Plano Pro • Você será o Master da Empresa
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">Nome da Empresa</label>
                                            <input
                                                type="text"
                                                required
                                                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs transition-all font-semibold"
                                                placeholder="Ex: Metalúrgica Juca"
                                                value={regEmpresa}
                                                onChange={(e) => setRegEmpresa(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">CNPJ <span className="text-gray-400 font-normal">(opcional)</span></label>
                                            <input
                                                type="text"
                                                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs transition-all"
                                                placeholder="00.000.000/0000-00"
                                                value={regCnpj}
                                                onChange={(e) => setRegCnpj(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">Seu Nome (Responsável)</label>
                                            <input
                                                type="text"
                                                required
                                                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs transition-all"
                                                placeholder="Seu nome"
                                                value={regName}
                                                onChange={(e) => setRegName(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">WhatsApp / Celular</label>
                                            <input
                                                type="text"
                                                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs transition-all"
                                                placeholder="(11) 99999-9999"
                                                value={regTelefone}
                                                onChange={(e) => setRegTelefone(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">E-mail de Acesso (Login)</label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                            <input
                                                type="email"
                                                required
                                                className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs transition-all"
                                                placeholder="seuemail@empresa.com"
                                                value={regEmail}
                                                onChange={(e) => setRegEmail(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Senha de Acesso</label>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                            <input
                                                type="password"
                                                required
                                                className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs transition-all"
                                                placeholder="••••••••"
                                                value={regPassword}
                                                onChange={(e) => setRegPassword(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <Button
                                        type="submit"
                                        variant="cta"
                                        size="lg"
                                        loading={loading}
                                        icon={UserPlus}
                                        className="w-full mt-2 shadow-md bg-blue-600 hover:bg-blue-700 text-white font-bold"
                                    >
                                        Criar Conta e Iniciar Teste Grátis
                                    </Button>
                                </form>
                            )}
                        </div>
                    )}

                    {view === 'login' && (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Usuário / Login</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                    <input
                                        type="text"
                                        required
                                        autoCapitalize="none"
                                        autoCorrect="off"
                                        spellCheck={false}
                                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                        placeholder="Digite seu login..."
                                        value={loginInput}
                                        onChange={(e) => setLoginInput(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-sm font-medium text-gray-700">Senha</label>
                                    <button 
                                        type="button" 
                                        onClick={() => { setView('recover'); setError(''); setSuccessMsg(''); setShowRecoveryHint(false); }}
                                        className={`text-xs font-medium transition-all ${showRecoveryHint ? 'text-orange-600 animate-pulse font-bold bg-orange-50 px-2 py-0.5 rounded border border-orange-200 shadow-sm' : 'text-blue-600 hover:text-blue-800'}`}
                                    >
                                        Esqueceu a senha?
                                    </button>
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                    <input
                                        type="password"
                                        required
                                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                        placeholder="••••••••"
                                        value={passwordInput}
                                        onChange={(e) => setPasswordInput(e.target.value)}
                                    />
                                </div>
                            </div>

                            <Button
                                type="submit"
                                variant="primary"
                                size="lg"
                                loading={loading}
                                icon={LogIn}
                                className="w-full shadow-md"
                            >
                                Entrar no Sistema
                            </Button>


                            
                            <div className="mt-4 text-center">
                                <p className="text-sm text-gray-600">
                                    Ainda não tem acesso?{' '}
                                    <button 
                                        type="button"
                                        onClick={() => { setView('register'); setError(''); setSuccessMsg(''); }}
                                        className="font-bold text-blue-600 hover:text-blue-800 transition"
                                    >
                                        Criar Conta
                                    </button>
                                </p>
                            </div>
                        </form>
                    )}

                    {/* SGQ Partner Co-Branding */}
                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <div className="flex items-center gap-2.5">
                            <img 
                                src={simLogo} 
                                alt="SIM Consultoria" 
                                className="h-7 w-7 rounded-lg object-contain bg-white border border-slate-200 p-0.5 shadow-2xs" 
                            />
                            <div className="text-left">
                                <span className="block font-bold text-slate-700 leading-none text-[11px]">
                                    Gestão da Qualidade (SGQ)
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium">
                                    SIM Consultoria • 18 Anos
                                </span>
                            </div>
                        </div>
                        <a 
                            href="https://www.instagram.com/sim.consultoria/" 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 transition-colors"
                        >
                            <span>@sim.consultoria</span>
                            <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>

                </div>
            </div>
            </div>

            {/* Floating Help Button */}
            <button
                onClick={toggleHelp}
                title="Ajuda desta tela"
                aria-label="Abrir ajuda contextual"
                className="fixed bottom-6 right-6 z-[990] w-12 h-12 rounded-full bg-slate-900 text-white shadow-2xl hover:bg-blue-600 flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
            >
                <HelpCircle className="h-5 w-5" />
            </button>

            <HelpDrawer />
        </>
    );
};

export default Login;
