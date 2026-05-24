import React, { useState, useEffect } from 'react';
import { X, Lock, CheckCircle, AlertTriangle } from 'lucide-react';
import { changePassword } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function ChangePasswordModal({ isOpen, onClose }) {
    const { logout } = useAuth();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    // Close on ESC key press
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEsc);
            // Reset state
            setNewPassword('');
            setConfirmPassword('');
            setError('');
            setSuccess(false);
        }
        return () => document.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Frontend validation
        if (newPassword.length < 6) {
            setError('A senha deve conter pelo menos 6 caracteres/dígitos.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('As senhas digitadas não coincidem.');
            return;
        }

        setLoading(true);

        try {
            const res = await changePassword(newPassword, confirmPassword);
            if (res.success) {
                setSuccess(true);
                // Wait 2.5 seconds to show success and then logout
                setTimeout(() => {
                    logout();
                }, 2500);
            } else {
                setError(res.message || 'Erro ao alterar a senha.');
            }
        } catch (err) {
            console.error('Change password error:', err);
            setError(err.response?.data?.error || 'Erro de conexão com o servidor.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-slate-900 border border-slate-800 rounded-none shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
                    <div className="flex items-center gap-2">
                        <Lock className="h-5 w-5 text-blue-500" />
                        <h3 className="text-md font-mono font-bold text-slate-50 uppercase tracking-widest">Alterar Senha</h3>
                    </div>
                    {!success && (
                        <button
                            onClick={onClose}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="p-6 flex-1 bg-slate-900">
                    {success ? (
                        <div className="flex flex-col items-center justify-center text-center py-6 animate-in zoom-in-95 duration-200">
                            <CheckCircle className="h-16 w-16 text-green-500 mb-4 animate-bounce" />
                            <h4 className="text-lg font-bold text-white mb-2">Senha Alterada com Sucesso!</h4>
                            <p className="text-sm text-slate-400 max-w-xs">
                                Sua nova senha foi salva e enviada via WhatsApp (se cadastrado). Você será desconectado em instantes para fazer login com as novas credenciais...
                            </p>
                            <div className="mt-4 flex gap-1 items-center justify-center">
                                <span className="h-2 w-2 rounded-full bg-blue-500 animate-ping"></span>
                                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Desconectando...</span>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <div className="p-3 bg-red-950/40 border border-red-900 text-red-200 text-xs flex gap-2 items-start rounded-none">
                                    <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-mono text-slate-400 uppercase tracking-widest mb-1.5">
                                    Nova Senha (mín. 6 caracteres)
                                </label>
                                <input
                                    type="password"
                                    required
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Digite a nova senha"
                                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 text-white font-mono text-sm px-3.5 py-2.5 outline-none transition-all placeholder:text-slate-700"
                                    disabled={loading}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-mono text-slate-400 uppercase tracking-widest mb-1.5">
                                    Confirmar Nova Senha
                                </label>
                                <input
                                    type="password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Repita a nova senha"
                                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 text-white font-mono text-sm px-3.5 py-2.5 outline-none transition-all placeholder:text-slate-700"
                                    disabled={loading}
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors text-xs font-mono uppercase tracking-wider"
                                    disabled={loading}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white transition-colors text-xs font-mono uppercase tracking-wider disabled:opacity-50"
                                    disabled={loading}
                                >
                                    {loading ? 'Salvando...' : 'Confirmar'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
