import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import api from '../services/api';

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
            if (data?.general_config) {
                const gc = typeof data.general_config === 'string' ? JSON.parse(data.general_config) : data.general_config;
                if (gc.custom_profiles) {
                    setCustomProfiles(gc.custom_profiles);
                }
            }
        } catch (e) {
            console.error('Error loading company config', e);
        }
    }, []);

    const loadPermissions = useCallback(async () => {
        try {
            const data = await api.get('/users/my-permissions').then(r => r.data);
            const map = {};
            (data || []).forEach(p => {
                map[p.page_id] = {
                    can_view: !!p.can_view,
                    can_create: !!p.can_create,
                    can_edit: !!p.can_edit,
                    can_delete: !!p.can_delete
                };
            });
            setPermissions(map);
        } catch (err) {
            console.error('Erro ao carregar permissões:', err);
        }
    }, []);

    useEffect(() => {
        const storedToken = localStorage.getItem('@MetalFisa:token');
        const storedUser = localStorage.getItem('@MetalFisa:user');

        if (storedToken && storedUser) {
            api.defaults.headers.Authorization = `Bearer ${storedToken}`;
            const parsed = JSON.parse(storedUser);
            setUser(parsed);
            loadPermissions();
            loadCompanyConfig();
        }

        setLoading(false);
    }, [loadPermissions, loadCompanyConfig]);

    const login = async (login, senha) => {
        try {
            const response = await api.post('/auth/login', { login, senha });
            const { token, user } = response.data;

            localStorage.setItem('@MetalFisa:token', token);
            localStorage.setItem('@MetalFisa:user', JSON.stringify(user));

            api.defaults.headers.Authorization = `Bearer ${token}`;
            setUser(user);

            loadPermissions();
            loadCompanyConfig();

            return { success: true };
        } catch (error) {
            console.error(error);
            return {
                success: false,
                message: error.response?.data?.error || 'Falha no login.'
            };
        }
    };

    const logout = () => {
        localStorage.removeItem('@MetalFisa:token');
        localStorage.removeItem('@MetalFisa:user');
        delete api.defaults.headers.Authorization;
        setUser(null);
        setPermissions({});
        setCustomProfiles([]);
    };

    // hasPermission(pageId, action) — action: 'view' | 'create' | 'edit' | 'delete'
    const hasPermission = useCallback((pageId, action = 'view') => {
        if (!user) return false;

        const userTipo = (user.tipo || '').trim();

        // Tipo 'A' e 'SA' têm acesso total, sempre
        if (userTipo === 'A' || userTipo === 'SA') return true;

        // Perfil customizado com isAdmin também tem acesso total
        if (customProfiles.find(p => p.code === userTipo)?.isAdmin === true) return true;

        const perm = permissions[pageId];
        if (!perm) return false;

        const key = `can_${action}`;
        return !!perm[key];
    }, [user, permissions, customProfiles]);

    const isAdmin = !!user && (() => {
        const t = (user.tipo || '').trim();
        return t === 'A' || t === 'SA' || customProfiles.find(p => p.code === t)?.isAdmin === true;
    })();

    return (
        <AuthContext.Provider value={{ signed: !!user, user, login, logout, loading, permissions, hasPermission, reloadPermissions: loadPermissions, isAdmin: !!isAdmin, customProfiles }}>
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

