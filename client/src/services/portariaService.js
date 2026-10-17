import api from './api';

export const portariaService = {
    // 1. Dados Auxiliares (Setores, Colaboradores, Turnos, Porteiros)
    getAuxiliares: async () => {
        const response = await api.get('/portaria/auxiliares');
        return response.data;
    },

    // 2. Operações de Entrada e Saída
    getAcessosAtivos: async () => {
        const response = await api.get('/portaria/acessos/ativos');
        return response.data;
    },

    registrarCheckIn: async (data) => {
        const response = await api.post('/portaria/acessos/check-in', data);
        return response.data;
    },

    registrarCheckOut: async (id, data = {}) => {
        const response = await api.post(`/portaria/acessos/check-out/${id}`, data);
        return response.data;
    },

    // 3. Dashboard e Alertas
    getDashboard: async () => {
        const response = await api.get('/portaria/dashboard');
        return response.data;
    },

    // 4. Histórico e Relatórios
    getHistorico: async (params = {}) => {
        const response = await api.get('/portaria/acessos/historico', { params });
        return response.data;
    },

    // 5. Gestão de Porteiros
    getPorteiros: async () => {
        const response = await api.get('/portaria/porteiros');
        return response.data;
    },

    salvarPorteiro: async (data, id = null) => {
        if (id) {
            const response = await api.put(`/portaria/porteiros/${id}`, data);
            return response.data;
        } else {
            const response = await api.post('/portaria/porteiros', data);
            return response.data;
        }
    },

    // 6. Turnos
    getTurnos: async () => {
        const response = await api.get('/portaria/turnos');
        return response.data;
    },

    salvarTurno: async (data, id = null) => {
        if (id) {
            const response = await api.put(`/portaria/turnos/${id}`, data);
            return response.data;
        } else {
            const response = await api.post('/portaria/turnos', data);
            return response.data;
        }
    },

    excluirTurno: async (id) => {
        const response = await api.delete(`/portaria/turnos/${id}`);
        return response.data;
    },

    // 7. Livro de Ocorrências / Passagem de Turno
    getOcorrencias: async () => {
        const response = await api.get('/portaria/ocorrencias');
        return response.data;
    },

    registrarPassagemTurno: async (data) => {
        const response = await api.post('/portaria/ocorrencias/passagem-turno', data);
        return response.data;
    }
};

export default portariaService;
