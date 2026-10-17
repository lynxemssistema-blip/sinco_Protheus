import React, { useState } from 'react';
import { Mail, ShieldAlert, Send } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

export default function EmailBlockerModal() {
    const { user, logout } = useAuth();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // If no user, or user already has email, don't show blocker
    if (!user || user.email) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await api.post('/auth/update-email', { email });
            // Since we need to update the User payload across all Contexts correctly,
            // we do it directly over localStorage and reload it
            const storedUser = JSON.parse(localStorage.getItem('@Lynx:user'));
            storedUser.email = email;
            localStorage.setItem('@Lynx:user', JSON.stringify(storedUser));
            window.location.reload();
        } catch (err) {
            setError(err.response?.data?.error || err.message);
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[99999] bg-slate-900/90 backdrop-blur flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                <div className="bg-slate-800 p-6 flex flex-col items-center text-center text-white">
                    <div className="w-16 h-16 bg-white/10 rounded-full flex flex-col items-center justify-center mb-4 text-blue-400">
                        <ShieldAlert className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold mb-1">Ação Necessária</h2>
                    <p className="text-slate-300 text-sm">Atualização de Segurança da Lynx</p>
                </div>
                <div className="p-6">
                    <p className="text-slate-600 mb-6 text-sm leading-relaxed text-center">
                        Verificamos que sua conta ainda não possui um e-mail vinculado.<br/>
                        Por medida de segurança, nós precisamos que você informe o seu endereço para recuperar acessos futuramente.
                    </p>
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100 text-center font-medium">
                                {error}
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1 font-semibold">Seu E-mail Corporativo / Válido</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="usuario@lynxems.com.br"
                                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800"
                                />
                            </div>
                        </div>
                        <div className="pt-2 flex gap-3">
                            <button type="button" onClick={logout} className="px-4 py-3 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition text-sm">
                                Sair
                            </button>
                            <button disabled={loading} type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition shadow-md">
                                {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent animate-spin rounded-full"></div> : <><Send className="w-4 h-4"/> Salvar e Acessar Banco</>}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
