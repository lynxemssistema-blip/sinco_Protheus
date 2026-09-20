import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Lock, User, LogIn, Mail, ArrowLeft, Send, UserPlus, HelpCircle, Smartphone, Zap, RefreshCw, Clock, ExternalLink } from 'lucide-react';
import { api } from '../services/api';
import { useHelp } from '../contexts/HelpContext';
import HelpDrawer from '../components/HelpDrawer';
import logo from '../assets/lynx-ems-logo.jpg';
import simLogo from '../assets/sim-consultoria-logo.png';

import LandingPage from './LandingPage';

const Login = () => {
    const [loginInput, setLoginInput] = useState('');
    const [passwordInput, setPasswordInput] = useState('');
    const [recoverEmail, setRecoverEmail] = useState('');
    
    // Register states
    const [regName, setRegName] = useState('');
    const [regEmail, setRegEmail] = useState('');
    const [regLogin, setRegLogin] = useState('');
    const [regPassword, setRegPassword] = useState('');

    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [loading, setLoading] = useState(false);
    const [showRecoveryHint, setShowRecoveryHint] = useState(false);
    
    // Watchdog / Slowness / Wake-up states (Exibição condicional sob lentidão/queda)
    const [isServerSlow, setIsServerSlow] = useState(false);
    const [wakeUpLoading, setWakeUpLoading] = useState(false);
    const [wakeUpCountdown, setWakeUpCountdown] = useState(15);
    const [wakeUpCooldown, setWakeUpCooldown] = useState(0); // em minutos
    const [wakeUpMessage, setWakeUpMessage] = useState('');
    
    const [view, setView] = useState('login'); // 'login', 'recover', 'register'

    const { login, signed } = useAuth();
    const { toggleHelp } = useHelp();
    const navigate = useNavigate();

    // Checa cooldown persistido e saúde do servidor
    const checkCooldownAndHealth = React.useCallback(async () => {
        const storedTime = localStorage.getItem('@MetalFisa:last_wake_up');
        if (storedTime) {
            const diff = Date.now() - parseInt(storedTime, 10);
            const thirtyMin = 30 * 60 * 1000;
            if (diff < thirtyMin) {
                setWakeUpCooldown(Math.ceil((thirtyMin - diff) / 60000));
            } else {
                setWakeUpCooldown(0);
            }
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500);
            const res = await fetch('/api/system/status', { signal: controller.signal });
            clearTimeout(timeoutId);
            if (res.ok) {
                const data = await res.json();
                if (data.slow || !data.online) {
                    setIsServerSlow(true);
                }
                if (data.cooldownRemainingMs > 0) {
                    setWakeUpCooldown(data.remainingMinutes);
                }
            } else {
                setIsServerSlow(true);
            }
        } catch (e) {
            setIsServerSlow(true);
        }
    }, []);

    React.useEffect(() => {
        checkCooldownAndHealth();
    }, [checkCooldownAndHealth]);

    // If user is already logged in, redirect to dashboard automatically
    React.useEffect(() => {
        if (signed) {
            navigate('/dashboard', { replace: true });
        }
    }, [signed, navigate]);

    const handleWakeUpServer = async () => {
        setError('');
        setWakeUpLoading(true);
        setWakeUpCountdown(15);
        setWakeUpMessage('Enviando sinal de reinício para o servidor...');

        try {
            const res = await fetch('/api/system/wake-up', { method: 'POST' });
            const data = await res.json();

            if (res.status === 429) {
                setWakeUpLoading(false);
                setWakeUpCooldown(data.remainingMinutes || 30);
                setWakeUpMessage(data.message);
                return;
            }

            localStorage.setItem('@MetalFisa:last_wake_up', Date.now().toString());
            setWakeUpCooldown(30);

            let count = 15;
            const timer = setInterval(async () => {
                count -= 1;
                setWakeUpCountdown(count);

                if (count % 3 === 0 || count <= 2) {
                    try {
                        const statusRes = await fetch('/api/system/status');
                        if (statusRes.ok) {
                            const statusData = await statusRes.json();
                            if (statusData.online) {
                                clearInterval(timer);
                                setWakeUpLoading(false);
                                setIsServerSlow(false);
                                setSuccessMsg('Servidor reiniciado com sucesso! Você já pode entrar.');
                                setWakeUpMessage('');
                                return;
                            }
                        }
                    } catch (err) {}
                }

                if (count <= 0) {
                    clearInterval(timer);
                    setWakeUpLoading(false);
                    setWakeUpMessage('O servidor foi reiniciado. Tente efetuar o login novamente.');
                }
            }, 1000);

        } catch (err) {
            setWakeUpLoading(false);
            setWakeUpMessage('Falha ao comunicar com o Watchdog. Verifique sua conexão.');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setWakeUpMessage('');
        setLoading(true);

        const startTime = Date.now();
        const slowTimer = setTimeout(() => {
            setIsServerSlow(true);
        }, 3500);

        const result = await login(loginInput, passwordInput);
        clearTimeout(slowTimer);

        if (result.success) {
            navigate('/ajuda');
        } else {
            setError(result.message);
            setLoading(false);

            const elapsed = Date.now() - startTime;
            if (elapsed > 3500 || result.status >= 500 || result.isNetworkError) {
                setIsServerSlow(true);
            }

            if (result.message && result.message.toLowerCase().includes('credenciais')) {
                setShowRecoveryHint(true);
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
            const res = await api.post('/auth/register', {
                nome: regName,
                email: regEmail,
                login: regLogin,
                senha: regPassword
            });
            setSuccessMsg(res.data.message);
            setRegName(''); setRegEmail(''); setRegLogin(''); setRegPassword('');
            setView('login'); // back to login
        } catch (err) {
            setError(err.response?.data?.error || err.message);
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
                    <div className="bg-[#1F365C] p-8 text-center text-white relative flex flex-col items-center">
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
                    <div className="bg-white p-2 rounded-2xl shadow-md mb-4 flex items-center justify-center border border-slate-100">
                        <img src={logo} alt="Lynx EMS Sistemas" className="h-12 w-12 rounded-xl object-cover" />
                    </div>
                    <h1 className="text-2xl font-black mb-1 tracking-tight">SINCO Industrial Suite</h1>
                    <p className="text-blue-200 font-semibold text-xs tracking-wider uppercase mb-1">Lynx EMS Sistemas</p>
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

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-[#FFB536] hover:bg-[#e6a230] text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-md hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <Send className="h-5 w-5" />
                                        Receber Nova Senha
                                    </>
                                )}
                            </button>
                        </form>
                    )}

                    {view === 'register' && (
                        <form onSubmit={handleRegister} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                    <input
                                        type="text"
                                        required
                                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                        placeholder="Seu nome completo"
                                        value={regName}
                                        onChange={(e) => setRegName(e.target.value)}
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail Corporativo</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                    <input
                                        type="email"
                                        required
                                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                        placeholder="usuario@metalfisa.com.br"
                                        value={regEmail}
                                        onChange={(e) => setRegEmail(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome de Login</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                        placeholder="ex: pcp01"
                                        value={regLogin}
                                        onChange={(e) => setRegLogin(e.target.value)}
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                                    <input
                                        type="password"
                                        required
                                        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                        placeholder="••••••••"
                                        value={regPassword}
                                        onChange={(e) => setRegPassword(e.target.value)}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-[#FFB536] hover:bg-[#e6a230] text-white font-bold py-3 mt-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-md hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <UserPlus className="h-5 w-5" />
                                        Solicitar Cadastro
                                    </>
                                )}
                            </button>
                        </form>
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

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-[#1F365C] hover:bg-[#15253f] text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-md hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <LogIn className="h-5 w-5" />
                                        Entrar no Sistema
                                    </>
                                )}
                            </button>

                            {/* Card Condicional: Acordar o Servidor (Aparece APENAS se houver lentidão ou falha de conexão) */}
                            {(isServerSlow || wakeUpLoading || wakeUpMessage) && (
                                <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-xl text-amber-900 text-xs shadow-sm transition-all duration-300">
                                    <div className="flex items-start gap-2.5">
                                        <Zap className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0 animate-pulse" />
                                        <div className="flex-1">
                                            <p className="font-bold text-amber-900 mb-0.5">
                                                Lentidão ou Instabilidade Detectada
                                            </p>
                                            <p className="text-amber-700 leading-relaxed mb-3 text-[11px]">
                                                O servidor demorou para responder ou está fora do ar. Você pode requisitar o reinício automático da aplicação.
                                            </p>

                                            {wakeUpLoading ? (
                                                <div className="flex items-center gap-2 text-amber-900 font-semibold py-1">
                                                    <RefreshCw className="w-4 h-4 animate-spin text-amber-600" />
                                                    <span>Reiniciando aplicação... Aguarde ({wakeUpCountdown}s)</span>
                                                </div>
                                            ) : wakeUpCooldown > 0 ? (
                                                <div className="text-amber-800 bg-amber-100/70 px-2.5 py-1.5 rounded-lg font-medium inline-flex items-center gap-1.5 text-[11px]">
                                                    <Clock className="w-3.5 h-3.5 text-amber-700" />
                                                    <span>Reinício permitido a cada 30 minutos. Restam: ~{wakeUpCooldown} min</span>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={handleWakeUpServer}
                                                    className="inline-flex items-center gap-1.5 bg-[#FFB536] hover:bg-[#e6a230] text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-all shadow-sm hover:shadow active:scale-95 cursor-pointer"
                                                >
                                                    <Zap className="w-3.5 h-3.5" />
                                                    Acordar o Servidor
                                                </button>
                                            )}

                                            {wakeUpMessage && !wakeUpLoading && (
                                                <p className="mt-2 text-[11px] text-amber-800 font-medium">
                                                    {wakeUpMessage}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                            
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
                                    SIM Consultoria • 17 Anos
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
