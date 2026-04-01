import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [permissions, setPermissions] = useState({}); // { page_id: { can_view, can_create, can_edit, can_delete } }

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
            // Load permissions for all users to check for specific overrides
            loadPermissions();
        }

        setLoading(false);
    }, [loadPermissions]);

    const login = async (login, senha) => {
        try {
            const response = await api.post('/auth/login', { login, senha });
            const { token, user } = response.data;

            localStorage.setItem('@MetalFisa:token', token);
            localStorage.setItem('@MetalFisa:user', JSON.stringify(user));

            api.defaults.headers.Authorization = `Bearer ${token}`;
            setUser(user);

            // Load permissions for all users to check for specific overrides
            loadPermissions();

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
    };

    // hasPermission(pageId, action) — action: 'view' | 'create' | 'edit' | 'delete'
    // Admin users ALWAYS return true UNLESS they have specific permissions configured
    const hasPermission = useCallback((pageId, action = 'view') => {
        if (!user) return false;
        
        // Admin bypass logic: grant full access if no custom permissions differ from the default
        if (user.tipo === 'A' && Object.keys(permissions).length === 0) {
            return true;
        }

        const perm = permissions[pageId];
        if (!perm) return false; // No entry = no access

        const key = `can_${action}`;
        return !!perm[key];
    }, [user, permissions]);

    return (
        <AuthContext.Provider value={{ signed: !!user, user, login, logout, loading, permissions, hasPermission, reloadPermissions: loadPermissions }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export default AuthContext;

