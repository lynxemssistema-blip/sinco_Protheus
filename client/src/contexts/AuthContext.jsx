import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import api from '../services/api';
import { applyCompanyBranding } from '../services/companyBranding';

const defaultAuthContext = {
    signed: false,
    user: null,
    login: async () => ({ success: false, message: 'AuthProvider not mounted' }),
    logout: () => {},
    loading: true,
    permissions: {},
    hasPermission: () => false,
    reloadPermissions: async () => {},
    isAdmin: false,
    isSuperAdmin: false,
    customProfiles: [],
};

const AuthContext = createContext(defaultAuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [permissions, setPermissions] = useState({});
    const [customProfiles, setCustomProfiles] = useState([]);

    const loadCompanyConfig = useCallback(async () => {
        try {
            const data = await api.get('/company').then(r => r.data);
            if (data && typeof data === 'object') {
                applyCompanyBranding(data);
                if (data.general_config) {
                    const gc = typeof data.general_config === 'string' ? JSON.parse(data.general_config) : data.general_config;
                    if (gc && gc.custom_profiles) {
                        setCustomProfiles(gc.custom_profiles);
                    }
                }
            }
        } catch (e) {
            console.error('Error loading company config', e);
        }
    }, []);

    const loadPermissions = useCallback(async () => {
        try {
            const res = await api.get('/users/my-permissions');
            const data = res?.data;
            if (!Array.isArray(data)) {
                console.warn('⚠️ /users/my-permissions retornou formato inesperado (não é lista):', data);
                setPermissions({});
                return;
            }
            const map = {};
            data.forEach(p => {
                if (p && p.page_id) {
                    map[p.page_id] = {
                        can_view: !!p.can_view,
                        can_create: !!p.can_create,
                        can_edit: !!p.can_edit,
                        can_delete: !!p.can_delete
                    };
                }
            });
            setPermissions(map);
        } catch (err) {
            console.error('Erro ao carregar permissões:', err);
            setPermissions({});
        }
    }, []);

    useEffect(() => {
        const storedToken = localStorage.getItem('@Lynx:token');
        const storedUser = localStorage.getItem('@Lynx:user');

        if (storedToken && storedUser && storedToken !== 'undefined' && storedUser !== 'undefined') {
            try {
                const parsed = JSON.parse(storedUser);
                api.defaults.headers.Authorization = `Bearer ${storedToken}`;
                setUser(parsed);
                loadPermissions();
                loadCompanyConfig();
            } catch (err) {
                console.warn('Sessão armazenada corrompida, limpando...');
                localStorage.removeItem('@Lynx:token');
                localStorage.removeItem('@Lynx:user');
            }
        }

        setLoading(false);
    }, [loadPermissions, loadCompanyConfig]);

    const login = async (login, senha) => {
        try {
            // Limpa qualquer override de tenant de sessões anteriores para garantir que caia na sua empresa
            localStorage.removeItem('@Lynx:tenant_override');
            if (api.defaults.headers['x-tenant-override']) {
                delete api.defaults.headers['x-tenant-override'];
            }

            const response = await api.post('/auth/login', { login, senha });
            const data = response?.data;

            if (!data || typeof data !== 'object' || typeof data === 'string' || !data.token || !data.user) {
                console.error('❌ Resposta de login inválida (servidor retornou HTML ou dados incompletos):', data);
                return {
                    success: false,
                    message: 'O servidor retornou uma resposta inesperada. Verifique se o backend Node.js está em execução e respondendo pelas rotas /api na Hostinger.'
                };
            }

            const { token, user } = data;

            localStorage.setItem('@Lynx:token', token);
            localStorage.setItem('@Lynx:user', JSON.stringify(user));

            api.defaults.headers.Authorization = `Bearer ${token}`;
            setUser(user);

            loadPermissions();
            loadCompanyConfig();

            return { success: true };
        } catch (error) {
            console.error(error);
            return {
                success: false,
                message: error.response?.data?.error || (error.code === 'ERR_NETWORK' ? 'Servidor indisponível ou fora do ar.' : 'Falha no login.'),
                status: error.response?.status,
                isNetworkError: !error.response || error.code === 'ERR_NETWORK' || error.message?.includes('Network Error') || error.code === 'ECONNABORTED'
            };
        }
    };

    const logout = () => {
        localStorage.removeItem('@Lynx:token');
        localStorage.removeItem('@Lynx:user');
        localStorage.removeItem('@Lynx:tenant_override');
        delete api.defaults.headers.Authorization;
        if (api.defaults.headers['x-tenant-override']) {
            delete api.defaults.headers['x-tenant-override'];
        }
        setUser(null);
        setPermissions({});
        setCustomProfiles([]);
    };

    // Acessos sensíveis (financeiro) nunca são liberados automaticamente por ser Admin —
    // precisam ser aprovados explicitamente por usuário em Configurações/Permissões,
    // mesmo para quem tem TipoUsuario 'A'/'SA'.
    const NEVER_ADMIN_BYPASS = ['valores_financeiros', 'aba_financeiro_faturar'];

    // hasPermission(pageId, action) — action: 'view' | 'create' | 'edit' | 'delete'
    const hasPermission = useCallback((pageId, action = 'view') => {
        if (!user) return false;

        const userTipo = user.TipoUsuario || user.tipo;
        const userLogin = (user.Login || user.login || '').toLowerCase().trim();
        const userEmail = (user.email || '').toLowerCase().trim();
        const isMasterUser = user.is_master === 1 || user.is_master === true || (userTipo || '').toLowerCase().trim() === 'master';
        const isSAUser = (userEmail === 'edsonmanoel2012@gmail.com') || (user.id === 37) || (userLogin === 'sinco' && user.id === 37);

        // Super Admin Global e Master da Empresa têm acesso irrestrito a TUDO na sua empresa
        if (isSAUser || isMasterUser) {
            return true;
        }

        if (!NEVER_ADMIN_BYPASS.includes(pageId)) {
            // Tipo 'A' e perfis administradores têm acesso total
            if (userTipo === 'A' || userTipo === 'Administrador' || userTipo === 'SA') return true;

            // Perfil customizado com isAdmin também tem acesso total
            if (customProfiles.find(p => p.code === userTipo)?.isAdmin === true) return true;
            
            // Clientes sempre têm acesso à própria página do portal
            if ((userTipo === 'E' || user?.tipoExterno === 'cliente' || !!user?.idCliente) && pageId === 'canal_cliente') {
                return true;
            }
        }

        const perm = permissions[pageId];
        if (!perm) return false;

        const key = `can_${action}`;
        return !!perm[key];
    }, [user, permissions, customProfiles]);

    // SuperAdmin Global da Plataforma (apenas edsonmanoel2012@gmail.com / ID 37)
    const isSuperAdmin = !!user && (() => {
        const e = (user.email || '').toLowerCase().trim();
        const l = (user.Login || user.login || '').toLowerCase().trim();
        return e === 'edsonmanoel2012@gmail.com' || user.id === 37 || user.is_superadmin === true || (l === 'sinco' && user.id === 37);
    })();

    // Master da Empresa (Dono/Criador do Tenant) ou SuperAdmin Global
    const isMaster = !!user && (() => {
        const t = (user.TipoUsuario || user.tipo || '').toLowerCase().trim();
        return user.is_master === 1 || user.is_master === true || t === 'master' || isSuperAdmin;
    })();

    const isAdmin = !!user && (() => {
        const t = (user.TipoUsuario || user.tipo || '').trim();
        return isMaster || t === 'A' || t === 'SA' || t === 'Administrador' || customProfiles.find(p => p.code === t)?.isAdmin === true;
    })();

    return (
        <AuthContext.Provider value={{ signed: !!user, user, login, logout, loading, permissions, hasPermission, reloadPermissions: loadPermissions, isAdmin: !!isAdmin, isSuperAdmin: !!isSuperAdmin, isMaster: !!isMaster, customProfiles }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    // Durante HMR/reloads, context pode ser o default — sem throw para não crashar
    if (import.meta.env.DEV && context === defaultAuthContext) {
        console.warn('[useAuth] Running outside AuthProvider — using safe default context. This is expected during HMR reloads.');
    }
    return context;
};

export default AuthContext;

