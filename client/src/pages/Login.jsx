import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Lock, User, LogIn, Mail, ArrowLeft, Send, UserPlus, HelpCircle } from 'lucide-react';
import { api } from '../services/api';
import { useHelp } from '../contexts/HelpContext';
import HelpDrawer from '../components/HelpDrawer';
import logo from '../assets/metalfisa-logo.png';

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
    
    const [view, setView] = useState('login'); // 'login', 'recover', 'register'

    const { login } = useAuth();
    const { toggleHelp } = useHelp();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setLoading(true);

        const result = await login(loginInput, passwordInput);

        if (result.success) {
            navigate('/');
        } else {
            setError(result.message);
            setLoading(false);
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
        <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
                <div className="bg-blue-600 p-8 text-center text-white relative flex flex-col items-center">
                    {view !== 'login' && (
                        <button 
                            onClick={() => { setView('login'); setError(''); setSuccessMsg(''); }}
                            className="absolute left-4 top-4 text-white/80 hover:text-white transition"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    )}
                    <div className="bg-white p-3 rounded-2xl shadow-md mb-4 flex items-center justify-center">
                        <img src={logo} alt="Logo MetalFisa" className="h-10 w-auto object-contain" />
                    </div>
                    <h1 className="text-2xl font-bold mb-1 tracking-tight">Portal Metalfisa</h1>
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
                        </div>
                    )}

                    {view === 'recover' && (
                        <form onSubmit={handleRecover} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Seu E-mail de Cadastro</label>
                                <p className="text-xs text-gray-500 mb-3">Sua senha atual será enviada para o seu e-mail corporativo.</p>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                    <input
                                        type="email"
                                        required
                                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                        placeholder="usuario@metalfisa.com.br"
                                        value={recoverEmail}
                                        onChange={(e) => setRecoverEmail(e.target.value)}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <Send className="h-5 w-5" />
                                        Receber Senha por E-mail
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
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 mt-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
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
                                        onClick={() => { setView('recover'); setError(''); setSuccessMsg(''); }}
                                        className="text-xs text-blue-600 hover:text-blue-800 font-medium transition"
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
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
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
        </div>
    );
};

export default Login;
