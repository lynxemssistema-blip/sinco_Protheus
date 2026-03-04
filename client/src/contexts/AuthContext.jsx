import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check for saved token on startup
        const storedToken = localStorage.getItem('@MetalFisa:token');
        const storedUser = localStorage.getItem('@MetalFisa:user');

        if (storedToken && storedUser) {
            api.defaults.headers.Authorization = `Bearer ${storedToken}`;
            setUser(JSON.parse(storedUser));
        }

        setLoading(false);
    }, []);

    const login = async (login, senha) => {
        try {
            const response = await api.post('/auth/login', { login, senha });

            const { token, user } = response.data;

            localStorage.setItem('@MetalFisa:token', token);
            localStorage.setItem('@MetalFisa:user', JSON.stringify(user));

            api.defaults.headers.Authorization = `Bearer ${token}`;
            setUser(user);

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
    };

    return (
        <AuthContext.Provider value={{ signed: !!user, user, login, logout, loading }}>
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
