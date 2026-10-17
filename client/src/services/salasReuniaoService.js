import api from './api';

const asArray = (data, key) => (Array.isArray(data) ? data : (Array.isArray(data?.[key]) ? data[key] : []));

export async function getSalas() {
    const res = await api.get('/salas-reuniao');
    return asArray(res.data, 'salas');
}

export async function cadastrarSala(dados) {
    const res = await api.post('/salas-reuniao', dados);
    return res.data;
}

export async function atualizarSala(id, dados) {
    const res = await api.put(`/salas-reuniao/${id}`, dados);
    return res.data;
}

export async function desativarSala(id) {
    const res = await api.delete(`/salas-reuniao/${id}`);
    return res.data;
}

export async function getReservas(params = {}) {
    const res = await api.get('/salas-reuniao/reservas', { params });
    return asArray(res.data, 'reservas');
}

export async function criarReserva(dados) {
    const res = await api.post('/salas-reuniao/reservas', dados);
    return res.data;
}

export async function atualizarReserva(id, dados) {
    const res = await api.put(`/salas-reuniao/reservas/${id}`, dados);
    return res.data;
}

export async function cancelarReserva(id, motivo = '') {
    const res = await api.post(`/salas-reuniao/reservas/${id}/cancelar`, { motivo });
    return res.data;
}

export async function liberarSalaAntecipadamente(id) {
    const res = await api.post(`/salas-reuniao/reservas/${id}/liberar`);
    return res.data;
}

export async function reservaRapida(dados) {
    const res = await api.post('/salas-reuniao/reservas/rapida', dados);
    return res.data;
}

export async function getParticipantesDisponiveis() {
    const res = await api.get('/salas-reuniao/participantes-disponiveis');
    return res.data;
}

export async function enviarConviteEmail(reservaId) {
    const res = await api.post(`/salas-reuniao/reservas/${reservaId}/enviar-convite-email`);
    return res.data;
}

export const salasReuniaoService = {
    getSalas,
    listarSalas: getSalas,
    cadastrarSala,
    atualizarSala,
    desativarSala,
    getReservas,
    listarReservas: getReservas,
    criarReserva,
    reservaRapida,
    atualizarReserva,
    cancelarReserva,
    liberarSalaAntecipadamente,
    liberarSala: liberarSalaAntecipadamente,
    getParticipantesDisponiveis,
    listarParticipantes: getParticipantesDisponiveis,
    enviarConviteEmail
};

export default salasReuniaoService;
