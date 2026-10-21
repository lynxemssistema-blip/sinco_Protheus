import React, { useState, useEffect, useMemo } from 'react';
import { 
    Flame, Shield, ShieldCheck, AlertTriangle, Users, FileText, CheckCircle2, 
    XCircle, Clock, Calendar, Phone, Mail, QrCode, Plus, Search, Filter, 
    Download, Upload, Eye, Trash2, Siren, ArrowRight, Printer, AlertOctagon,
    Award, Building2, MapPin, RefreshCw, CheckSquare, Paperclip, ChevronRight,
    UserCheck, ExternalLink, History, Edit, Edit3, Camera, Image, Sliders, X, ZoomIn
} from 'lucide-react';
import api from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import AlertaEmergenciaModal from '../../../components/sst/AlertaEmergenciaModal';

export default function BrigadaCentralPage() {
    const { user, isAdmin } = useAuth();

    // Estado principal
    const [activeTab, setActiveTab] = useState('visao_geral');
    const [loading, setLoading] = useState(true);
    const [dashboardData, setDashboardData] = useState(null);
    const [membros, setMembros] = useState([]);
    const [equipamentos, setEquipamentos] = useState([]);
    const [treinamentos, setTreinamentos] = useState([]);
    const [simulados, setSimulados] = useState([]);
    const [colaboradores, setColaboradores] = useState([]);

    // Filtros
    const [buscaMembro, setBuscaMembro] = useState('');
    const [filtroTurno, setFiltroTurno] = useState('todos');
    const [buscaEquipamento, setBuscaEquipamento] = useState('');
    const [filtroTipoEquip, setFiltroTipoEquip] = useState('todos');

    // Modais
    const [showModalMembro, setShowModalMembro] = useState(false);
    const [showModalTreinamento, setShowModalTreinamento] = useState(false);
    const [showModalEquipamento, setShowModalEquipamento] = useState(false);
    const [showModalInspecao, setShowModalInspecao] = useState(false);
    const [showModalSimulado, setShowModalSimulado] = useState(false);
    const [showModalEmergencia, setShowModalEmergencia] = useState(false);
    const [showModalHistorico, setShowModalHistorico] = useState(false);
    const [showModalConfig, setShowModalConfig] = useState(false);
    const [fotoVisualizacaoUrl, setFotoVisualizacaoUrl] = useState(null);

    // Estados de edição
    const [editandoMembro, setEditandoMembro] = useState(null);
    const [editandoTreinamento, setEditandoTreinamento] = useState(null);
    const [editandoEquipamento, setEditandoEquipamento] = useState(null);
    const [editandoSimulado, setEditandoSimulado] = useState(null);

    const [equipamentoSelecionado, setEquipamentoSelecionado] = useState(null);
    const [historicoInspecao, setHistoricoInspecao] = useState([]);

    // Foto de evidência na inspeção
    const [fotoInspecao, setFotoInspecao] = useState(null);
    const [fotoInspecaoPreview, setFotoInspecaoPreview] = useState(null);

    // Forms
    const [formMembro, setFormMembro] = useState({
        usuario_id: '',
        papel: 'brigadista_operacional',
        turno: '1_turno',
        setor_atuacao: '',
        data_admissao_brigada: new Date().toISOString().split('T')[0],
        status: 'ativo',
        observacoes: ''
    });

    const [formTreinamento, setFormTreinamento] = useState({
        membro_id: '',
        nivel: 'basico',
        entidade_formadora: 'Centro de Treinamento e Segurança do Trabalho',
        instrutor_responsavel: '',
        carga_horaria_horas: 16,
        data_conclusao: new Date().toISOString().split('T')[0],
        data_validade: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        observacoes: ''
    });
    const [arquivoCertificado, setArquivoCertificado] = useState(null);

    const [formEquipamento, setFormEquipamento] = useState({
        codigo_identificador: '',
        tipo: 'extintor_pqs_abc',
        capacidade_carga: '6 kg',
        setor_localizacao: '',
        ponto_referencia: '',
        data_fabricacao: '',
        data_ultima_recarga: new Date().toISOString().split('T')[0],
        data_proxima_recarga: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        data_ultimo_teste_hidrostatico: new Date().toISOString().split('T')[0],
        data_proximo_teste_hidrostatico: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status_operacional: 'operacional',
        observacoes: ''
    });

    const [formInspecao, setFormInspecao] = useState({
        equipamento_id: '',
        lacre_intacto: true,
        manometro_pressao_conforme: true,
        desobstruido: true,
        sinalizacao_visivel: true,
        mangueira_bico_ok: true,
        carga_no_prazo: true,
        observacoes: ''
    });

    const [formSimulado, setFormSimulado] = useState({
        titulo: 'Simulado Anual de Abandono Geral da Fábrica',
        data_simulado: new Date().toISOString().split('T')[0],
        horario_inicio: '10:00',
        horario_termino: '10:12',
        tempo_evacuacao_segundos: 240,
        turno_exercitado: '1_turno',
        total_evacuados: 95,
        total_brigadistas_atuantes: 8,
        cenario_simulado: 'Simulação de princípio de incêndio no setor de usinagem com dispersão de fumaça e acionamento de alarme sonoro.',
        pontos_fortes: 'Rápida identificação do foco, evacuação ordenada pelas rotas de fuga primárias sem pânico.',
        oportunidades_melhoria: 'Melhorar a checagem nominal no Ponto de Encontro 2 (Pátio dos Fundos).',
        avaliacao_eficacia: 'bom'
    });
    const [arquivoAtaSimulado, setArquivoAtaSimulado] = useState(null);

    const [formConfig, setFormConfig] = useState({
        planta_nome: 'Planta Principal - Lynx EMS',
        grau_risco: 'medio',
        populacao_fixa_total: 200,
        populacao_1_turno: 100,
        populacao_2_turno: 75,
        populacao_3_turno: 25,
        minimo_brigadistas_1_turno: 8,
        minimo_brigadistas_2_turno: 6,
        minimo_brigadistas_3_turno: 2,
        contato_emergencia_bombeiros: '193',
        contato_emergencia_sesmt: '(31) 99557-4906',
        ponto_encontro_principal: 'Estacionamento Frontal / Portaria Principal',
        ponto_encontro_secundario: 'Pátio de Carga / Área Externa dos Fundos'
    });

    const [formEmergencia, setFormEmergencia] = useState({
        local_incidente: 'Galpão Principal - Usinagem CNC',
        descricao_ocorrencia: 'Princípio de fumaça detectado em painel elétrico. Necessária presença dos brigadistas e isolamento preventivo da área.',
        nivel_urgencia: 'grave',
        turno_alvo: '1_turno'
    });
    const [disparandoEmergencia, setDisparandoEmergencia] = useState(false);

    // Carregar dados iniciais
    const carregarTudo = async () => {
        try {
            setLoading(true);
            const [dashRes, membRes, equipRes, treinRes, simRes, colabRes] = await Promise.all([
                api.get('/sst/brigada/dashboard'),
                api.get('/sst/brigada/membros'),
                api.get('/sst/brigada/equipamentos'),
                api.get('/sst/brigada/treinamentos'),
                api.get('/sst/brigada/simulados'),
                api.get('/cipa/colaboradores-disponiveis')
            ]);

            setDashboardData(dashRes.data);
            setMembros(membRes.data || []);
            setEquipamentos(equipRes.data || []);
            setTreinamentos(treinRes.data || []);
            setSimulados(simRes.data || []);
            setColaboradores(colabRes.data || []);

            if (dashRes.data?.config) {
                setFormConfig({
                    planta_nome: dashRes.data.config.planta_nome || 'Planta Principal - Lynx EMS',
                    grau_risco: dashRes.data.config.grau_risco || 'medio',
                    populacao_fixa_total: dashRes.data.config.populacao_fixa_total || 200,
                    populacao_1_turno: dashRes.data.config.populacao_1_turno || 100,
                    populacao_2_turno: dashRes.data.config.populacao_2_turno || 75,
                    populacao_3_turno: dashRes.data.config.populacao_3_turno || 25,
                    minimo_brigadistas_1_turno: dashRes.data.config.minimo_brigadistas_1_turno || 8,
                    minimo_brigadistas_2_turno: dashRes.data.config.minimo_brigadistas_2_turno || 6,
                    minimo_brigadistas_3_turno: dashRes.data.config.minimo_brigadistas_3_turno || 2,
                    contato_emergencia_bombeiros: dashRes.data.config.contato_emergencia_bombeiros || '193',
                    contato_emergencia_sesmt: dashRes.data.config.contato_emergencia_sesmt || '(31) 99557-4906',
                    ponto_encontro_principal: dashRes.data.config.ponto_encontro_principal || 'Estacionamento Frontal / Portaria Principal',
                    ponto_encontro_secundario: dashRes.data.config.ponto_encontro_secundario || 'Pátio de Carga / Área Externa dos Fundos'
                });
            }
        } catch (err) {
            console.error('Erro ao carregar dados da Brigada:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarTudo();
    }, []);

    // Ações de Membros
    const abrirModalMembro = (membro = null) => {
        if (membro) {
            setEditandoMembro(membro);
            setFormMembro({
                usuario_id: membro.usuario_id,
                papel: membro.papel,
                turno: membro.turno,
                setor_atuacao: membro.setor_atuacao || '',
                data_admissao_brigada: membro.data_admissao_brigada ? membro.data_admissao_brigada.split('T')[0] : new Date().toISOString().split('T')[0],
                status: membro.status || 'ativo',
                observacoes: membro.observacoes || ''
            });
        } else {
            setEditandoMembro(null);
            setFormMembro({
                usuario_id: '',
                papel: 'brigadista_operacional',
                turno: '1_turno',
                setor_atuacao: '',
                data_admissao_brigada: new Date().toISOString().split('T')[0],
                status: 'ativo',
                observacoes: ''
            });
        }
        setShowModalMembro(true);
    };

    const handleSalvarMembro = async (e) => {
        e.preventDefault();
        try {
            if (editandoMembro) {
                await api.put(`/sst/brigada/membros/${editandoMembro.id}`, formMembro);
                alert('Dados do brigadista atualizados com sucesso!');
            } else {
                await api.post('/sst/brigada/membros', formMembro);
                alert('Brigadista incluído com sucesso!');
            }
            setShowModalMembro(false);
            setEditandoMembro(null);
            carregarTudo();
        } catch (err) {
            alert('Erro: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleInativarMembro = async (id, nome) => {
        if (!window.confirm(`Deseja inativar o brigadista ${nome} da equipe?`)) return;
        try {
            await api.delete(`/sst/brigada/membros/${id}`);
            carregarTudo();
        } catch (err) {
            alert('Erro: ' + (err.response?.data?.error || err.message));
        }
    };

    // Ações de Treinamento
    const abrirModalTreinamento = (treino = null) => {
        if (treino) {
            setEditandoTreinamento(treino);
            setFormTreinamento({
                membro_id: treino.membro_id,
                nivel: treino.nivel,
                entidade_formadora: treino.entidade_formadora,
                instrutor_responsavel: treino.instrutor_responsavel || '',
                carga_horaria_horas: treino.carga_horaria_horas || 16,
                data_conclusao: treino.data_conclusao ? treino.data_conclusao.split('T')[0] : '',
                data_validade: treino.data_validade ? treino.data_validade.split('T')[0] : '',
                observacoes: treino.observacoes || ''
            });
        } else {
            setEditandoTreinamento(null);
            setFormTreinamento({
                membro_id: '',
                nivel: 'basico',
                entidade_formadora: 'Centro de Treinamento e Segurança do Trabalho',
                instrutor_responsavel: '',
                carga_horaria_horas: 16,
                data_conclusao: new Date().toISOString().split('T')[0],
                data_validade: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                observacoes: ''
            });
        }
        setArquivoCertificado(null);
        setShowModalTreinamento(true);
    };

    const handleSalvarTreinamento = async (e) => {
        e.preventDefault();
        try {
            const formData = new FormData();
            Object.keys(formTreinamento).forEach(k => formData.append(k, formTreinamento[k]));
            if (arquivoCertificado) {
                formData.append('certificado', arquivoCertificado);
            }
            if (editandoTreinamento) {
                await api.put(`/sst/brigada/treinamentos/${editandoTreinamento.id}`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                alert('Treinamento atualizado com sucesso!');
            } else {
                await api.post('/sst/brigada/treinamentos', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                alert('Treinamento e certificado registrados com sucesso!');
            }
            setShowModalTreinamento(false);
            setEditandoTreinamento(null);
            setArquivoCertificado(null);
            carregarTudo();
        } catch (err) {
            alert('Erro: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleExcluirTreinamento = async (id) => {
        if (!window.confirm('Deseja realmente excluir este registro de treinamento?')) return;
        try {
            await api.delete(`/sst/brigada/treinamentos/${id}`);
            carregarTudo();
        } catch (err) {
            alert('Erro: ' + (err.response?.data?.error || err.message));
        }
    };

    // Ações de Equipamentos
    const abrirModalEquipamento = (equip = null) => {
        if (equip) {
            setEditandoEquipamento(equip);
            setFormEquipamento({
                codigo_identificador: equip.codigo_identificador,
                tipo: equip.tipo,
                capacidade_carga: equip.capacidade_carga || '',
                setor_localizacao: equip.setor_localizacao,
                ponto_referencia: equip.ponto_referencia || '',
                data_fabricacao: equip.data_fabricacao ? equip.data_fabricacao.split('T')[0] : '',
                data_ultima_recarga: equip.data_ultima_recarga ? equip.data_ultima_recarga.split('T')[0] : '',
                data_proxima_recarga: equip.data_proxima_recarga ? equip.data_proxima_recarga.split('T')[0] : '',
                data_ultimo_teste_hidrostatico: equip.data_ultimo_teste_hidrostatico ? equip.data_ultimo_teste_hidrostatico.split('T')[0] : '',
                data_proximo_teste_hidrostatico: equip.data_proximo_teste_hidrostatico ? equip.data_proximo_teste_hidrostatico.split('T')[0] : '',
                status_operacional: equip.status_operacional || 'operacional',
                observacoes: equip.observacoes || ''
            });
        } else {
            setEditandoEquipamento(null);
            setFormEquipamento({
                codigo_identificador: '',
                tipo: 'extintor_pqs_abc',
                capacidade_carga: '6 kg',
                setor_localizacao: '',
                ponto_referencia: '',
                data_fabricacao: '',
                data_ultima_recarga: new Date().toISOString().split('T')[0],
                data_proxima_recarga: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                data_ultimo_teste_hidrostatico: new Date().toISOString().split('T')[0],
                data_proximo_teste_hidrostatico: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                status_operacional: 'operacional',
                observacoes: ''
            });
        }
        setShowModalEquipamento(true);
    };

    const handleSalvarEquipamento = async (e) => {
        e.preventDefault();
        try {
            if (editandoEquipamento) {
                await api.put(`/sst/brigada/equipamentos/${editandoEquipamento.id}`, formEquipamento);
                alert('Equipamento atualizado com sucesso!');
            } else {
                await api.post('/sst/brigada/equipamentos', formEquipamento);
                alert('Equipamento cadastrado com sucesso!');
            }
            setShowModalEquipamento(false);
            setEditandoEquipamento(null);
            carregarTudo();
        } catch (err) {
            alert('Erro: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleExcluirEquipamento = async (id, codigo) => {
        if (!window.confirm(`Deseja realmente excluir o equipamento ${codigo}?`)) return;
        try {
            await api.delete(`/sst/brigada/equipamentos/${id}`);
            carregarTudo();
        } catch (err) {
            alert('Erro: ' + (err.response?.data?.error || err.message));
        }
    };

    // Ações de Inspeções / Vistorias com Foto
    const abrirInspecaoModal = (equip) => {
        setEquipamentoSelecionado(equip);
        setFormInspecao({
            equipamento_id: equip.id,
            lacre_intacto: true,
            manometro_pressao_conforme: true,
            desobstruido: true,
            sinalizacao_visivel: true,
            mangueira_bico_ok: true,
            carga_no_prazo: true,
            observacoes: ''
        });
        setFotoInspecao(null);
        setFotoInspecaoPreview(null);
        setShowModalInspecao(true);
    };

    const handleSalvarInspecao = async (e) => {
        e.preventDefault();
        try {
            const formData = new FormData();
            Object.keys(formInspecao).forEach(k => {
                formData.append(k, formInspecao[k]);
            });
            if (fotoInspecao) {
                formData.append('foto', fotoInspecao);
            }
            const res = await api.post('/sst/brigada/inspecoes', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert(res.data.message);
            setShowModalInspecao(false);
            setFotoInspecao(null);
            setFotoInspecaoPreview(null);
            carregarTudo();
        } catch (err) {
            alert('Erro: ' + (err.response?.data?.error || err.message));
        }
    };

    const abrirHistoricoInspecao = async (equip) => {
        setEquipamentoSelecionado(equip);
        try {
            const res = await api.get(`/sst/brigada/equipamentos/${equip.id}/historico`);
            setHistoricoInspecao(res.data || []);
            setShowModalHistorico(true);
        } catch (err) {
            alert('Erro ao buscar histórico: ' + err.message);
        }
    };

    const handleExcluirInspecao = async (id) => {
        if (!window.confirm('Deseja excluir este registro de vistoria?')) return;
        try {
            await api.delete(`/sst/brigada/inspecoes/${id}`);
            const res = await api.get(`/sst/brigada/equipamentos/${equipamentoSelecionado.id}/historico`);
            setHistoricoInspecao(res.data || []);
            carregarTudo();
        } catch (err) {
            alert('Erro ao excluir vistoria: ' + err.message);
        }
    };

    // Ações de Simulados
    const abrirModalSimulado = (sim = null) => {
        if (sim) {
            setEditandoSimulado(sim);
            setFormSimulado({
                titulo: sim.titulo,
                data_simulado: sim.data_simulado ? sim.data_simulado.split('T')[0] : '',
                horario_inicio: sim.horario_inicio ? sim.horario_inicio.substring(0, 5) : '10:00',
                horario_termino: sim.horario_termino ? sim.horario_termino.substring(0, 5) : '10:15',
                tempo_evacuacao_segundos: sim.tempo_evacuacao_segundos,
                turno_exercitado: sim.turno_exercitado || '1_turno',
                total_evacuados: sim.total_evacuados,
                total_brigadistas_atuantes: sim.total_brigadistas_atuantes,
                cenario_simulado: sim.cenario_simulado,
                pontos_fortes: sim.pontos_fortes || '',
                oportunidades_melhoria: sim.oportunidades_melhoria || '',
                avaliacao_eficacia: sim.avaliacao_eficacia || 'bom'
            });
        } else {
            setEditandoSimulado(null);
            setFormSimulado({
                titulo: 'Simulado Anual de Abandono Geral da Fábrica',
                data_simulado: new Date().toISOString().split('T')[0],
                horario_inicio: '10:00',
                horario_termino: '10:12',
                tempo_evacuacao_segundos: 240,
                turno_exercitado: '1_turno',
                total_evacuados: 95,
                total_brigadistas_atuantes: 8,
                cenario_simulado: 'Simulação de princípio de incêndio no setor de usinagem com dispersão de fumaça e acionamento de alarme sonoro.',
                pontos_fortes: 'Rápida identificação do foco, evacuação ordenada pelas rotas de fuga primárias sem pânico.',
                oportunidades_melhoria: 'Melhorar a checagem nominal no Ponto de Encontro 2 (Pátio dos Fundos).',
                avaliacao_eficacia: 'bom'
            });
        }
        setArquivoAtaSimulado(null);
        setShowModalSimulado(true);
    };

    const handleSalvarSimulado = async (e) => {
        e.preventDefault();
        try {
            const formData = new FormData();
            Object.keys(formSimulado).forEach(k => formData.append(k, formSimulado[k]));
            if (arquivoAtaSimulado) {
                formData.append('ata', arquivoAtaSimulado);
            }
            if (editandoSimulado) {
                await api.put(`/sst/brigada/simulados/${editandoSimulado.id}`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                alert('Exercício simulado atualizado com sucesso!');
            } else {
                await api.post('/sst/brigada/simulados', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                alert('Exercício simulado registrado com sucesso!');
            }
            setShowModalSimulado(false);
            setEditandoSimulado(null);
            setArquivoAtaSimulado(null);
            carregarTudo();
        } catch (err) {
            alert('Erro: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleExcluirSimulado = async (id, titulo) => {
        if (!window.confirm(`Deseja realmente excluir o simulado "${titulo}"?`)) return;
        try {
            await api.delete(`/sst/brigada/simulados/${id}`);
            carregarTudo();
        } catch (err) {
            alert('Erro ao excluir simulado: ' + err.message);
        }
    };

    // Ações de Configuração e Dimensionamento
    const abrirModalConfig = () => {
        if (dashboardData?.config) {
            setFormConfig({
                planta_nome: dashboardData.config.planta_nome || 'Planta Principal - Lynx EMS',
                grau_risco: dashboardData.config.grau_risco || 'medio',
                populacao_fixa_total: dashboardData.config.populacao_fixa_total || 200,
                populacao_1_turno: dashboardData.config.populacao_1_turno || 100,
                populacao_2_turno: dashboardData.config.populacao_2_turno || 75,
                populacao_3_turno: dashboardData.config.populacao_3_turno || 25,
                minimo_brigadistas_1_turno: dashboardData.config.minimo_brigadistas_1_turno || 8,
                minimo_brigadistas_2_turno: dashboardData.config.minimo_brigadistas_2_turno || 6,
                minimo_brigadistas_3_turno: dashboardData.config.minimo_brigadistas_3_turno || 2,
                contato_emergencia_bombeiros: dashboardData.config.contato_emergencia_bombeiros || '193',
                contato_emergencia_sesmt: dashboardData.config.contato_emergencia_sesmt || '(31) 99557-4906',
                ponto_encontro_principal: dashboardData.config.ponto_encontro_principal || 'Estacionamento Frontal / Portaria Principal',
                ponto_encontro_secundario: dashboardData.config.ponto_encontro_secundario || 'Pátio de Carga / Área Externa dos Fundos'
            });
        }
        setShowModalConfig(true);
    };

    const handleSalvarConfig = async (e) => {
        e.preventDefault();
        try {
            await api.put('/sst/brigada/config', formConfig);
            alert('Configurações e dimensionamento atualizados com sucesso!');
            setShowModalConfig(false);
            carregarTudo();
        } catch (err) {
            alert('Erro ao salvar configurações: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleDispararEmergencia = async (e) => {
        e.preventDefault();
        if (!window.confirm('ATENÇÃO: Deseja realmente acionar o alerta de emergência e disparar mensagem imediata no WhatsApp para os brigadistas?')) {
            return;
        }
        try {
            setDisparandoEmergencia(true);
            const res = await api.post('/sst/brigada/alerta-emergencia', formEmergencia);
            alert(`🚨 Alerta disparado com sucesso! ${res.data.telefones_disparados} brigadista(s) e gestores foram acionados.`);
            setShowModalEmergencia(false);
        } catch (err) {
            alert('Erro no disparo: ' + (err.response?.data?.error || err.message));
        } finally {
            setDisparandoEmergencia(false);
        }
    };

    // Filtros computados
    const membrosFiltrados = useMemo(() => {
        return membros.filter(m => {
            const matchBusca = (m.NomeCompleto || '').toLowerCase().includes(buscaMembro.toLowerCase()) ||
                               (m.Setor || '').toLowerCase().includes(buscaMembro.toLowerCase());
            const matchTurno = filtroTurno === 'todos' || m.turno === filtroTurno;
            return matchBusca && matchTurno;
        });
    }, [membros, buscaMembro, filtroTurno]);

    const equipamentosFiltrados = useMemo(() => {
        return equipamentos.filter(e => {
            const matchBusca = (e.codigo_identificador || '').toLowerCase().includes(buscaEquipamento.toLowerCase()) ||
                               (e.setor_localizacao || '').toLowerCase().includes(buscaEquipamento.toLowerCase());
            const matchTipo = filtroTipoEquip === 'todos' || e.tipo === filtroTipoEquip;
            return matchBusca && matchTipo;
        });
    }, [equipamentos, buscaEquipamento, filtroTipoEquip]);

    // Helpers
    const formatPapel = (p) => {
        switch (p) {
            case 'coordenador_geral': return 'Coordenador Geral';
            case 'chefe_brigada': return 'Chefe de Brigada';
            case 'lider_setor': return 'Líder de Setor';
            default: return 'Brigadista Operacional';
        }
    };

    const formatTurno = (t) => {
        switch (t) {
            case '1_turno': return '1º Turno (Manhã)';
            case '2_turno': return '2º Turno (Tarde)';
            case '3_turno': return '3º Turno (Noite)';
            case 'administrativo': return 'Horário Administrativo';
            default: return 'Geral';
        }
    };

    const formatTipoEquip = (t) => {
        switch (t) {
            case 'extintor_pqs_abc': return 'Extintor Pó ABC';
            case 'extintor_pqs_bc': return 'Extintor Pó BC';
            case 'extintor_co2': return 'Extintor CO2';
            case 'extintor_agua': return 'Extintor Água Pressurizada';
            case 'hidrante_abrigo': return 'Hidrante / Abrigo';
            case 'alarme_botoeira': return 'Botoeira / Alarme';
            case 'luz_emergencia': return 'Luz de Emergência';
            case 'porta_corta_fogo': return 'Porta Corta-Fogo';
            default: return t;
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
                <div className="flex flex-col items-center gap-3">
                    <Flame className="w-10 h-10 text-red-600 animate-pulse" />
                    <p className="text-slate-600 font-semibold">Carregando Brigada de Incêndio & Emergências...</p>
                </div>
            </div>
        );
    }

    const totaisM = dashboardData?.totais_membros || {};
    const totaisE = dashboardData?.totais_equipamentos || {};
    const config = dashboardData?.config || {};

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 pb-16">
            
            {/* TOPO / HEADER */}
            <div className="bg-[#1F365C] text-white px-6 py-6 shadow-md border-b border-slate-700">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-red-600 text-white rounded-xl shadow-inner">
                            <Flame className="w-8 h-8" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold tracking-tight">Brigada de Incêndio & Emergências</h1>
                                <span className="bg-red-900/60 text-red-200 text-xs px-2.5 py-0.5 rounded-full border border-red-400/30 font-semibold">
                                    NR-23 / NBR 14276
                                </span>
                            </div>
                            <p className="text-slate-300 text-xs md:text-sm mt-0.5">
                                Plano de proteção contra incêndio, prontidão operacional, equipamentos e exercícios de abandono
                            </p>
                        </div>
                    </div>

                    {/* BOTÃO DE ACIONAMENTO DE EMERGÊNCIA */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowModalEmergencia(true)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg hover:shadow-red-600/30 transition-all duration-200 active:scale-95 animate-bounce-subtle"
                        >
                            <Siren className="w-5 h-5 text-white animate-spin-slow" />
                            <span>Acionar Emergência</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* BARRA DE NAVEGAÇÃO POR ABAS */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 flex space-x-1 overflow-x-auto scrollbar-thin">
                    {[
                        { id: 'visao_geral', label: 'Visão Geral & Prontidão', icon: ShieldCheck },
                        { id: 'equipe', label: `Equipe (${membros.length})`, icon: Users },
                        { id: 'treinamentos', label: `Treinamentos (${treinamentos.length})`, icon: Award },
                        { id: 'equipamentos', label: `Equipamentos (${equipamentos.length})`, icon: Flame },
                        { id: 'simulados', label: `Simulados (${simulados.length})`, icon: Clock },
                        { id: 'avcb', label: 'Relatório AVCB / Bombeiros', icon: FileText }
                    ].map(tab => {
                        const Icon = tab.icon;
                        const active = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-3.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                                    active 
                                        ? 'border-red-600 text-red-600 bg-red-50/40' 
                                        : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                                }`}
                            >
                                <Icon className={`w-4 h-4 ${active ? 'text-red-600' : 'text-slate-400'}`} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* CONTEÚDO PRINCIPAL */}
            <div className="max-w-7xl mx-auto px-6 pt-6">

                {/* ======================================================== */}
                {/* ABA 1: VISÃO GERAL & PRONTIDÃO */}
                {/* ======================================================== */}
                {activeTab === 'visao_geral' && (
                    <div className="space-y-6">
                        
                        {/* CARDS DE KPIS */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            
                            {/* Dimensionamento Total */}
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Dimensionamento</span>
                                    <div className={`p-2 rounded-lg ${totaisM.total_ativos >= (config.minimo_brigadistas_1_turno + config.minimo_brigadistas_2_turno) ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                        <Users className="w-5 h-5" />
                                    </div>
                                </div>
                                <div className="mt-3 flex items-baseline gap-2">
                                    <span className="text-3xl font-extrabold text-[#1F365C]">{totaisM.total_ativos || 0}</span>
                                    <span className="text-xs text-slate-500">brigadistas cadastrados</span>
                                </div>
                                <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
                                    <span className={`inline-block w-2 h-2 rounded-full ${totaisM.total_ativos >= 16 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                    <span>Mínimo Recomendado NBR 14276: <strong>{(config.minimo_brigadistas_1_turno || 8) + (config.minimo_brigadistas_2_turno || 6) + (config.minimo_brigadistas_3_turno || 2)}</strong></span>
                                </div>
                            </div>

                            {/* Prontidão de Treinamentos */}
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Certificações Vigentes</span>
                                    <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                                        <Award className="w-5 h-5" />
                                    </div>
                                </div>
                                <div className="mt-3 flex items-baseline gap-2">
                                    <span className="text-3xl font-extrabold text-emerald-600">{totaisM.aptos || 0}</span>
                                    <span className="text-xs text-slate-500">aptos com curso válido</span>
                                </div>
                                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                                    <span>Vencendo em 30d: <strong className="text-amber-600">{totaisM.vencendo30d || 0}</strong></span>
                                    <span>Vencidos: <strong className="text-red-600">{totaisM.vencidosOuSem || 0}</strong></span>
                                </div>
                            </div>

                            {/* Extintores & Hidrantes */}
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Equipamentos</span>
                                    <div className="p-2 rounded-lg bg-red-50 text-red-600">
                                        <Flame className="w-5 h-5" />
                                    </div>
                                </div>
                                <div className="mt-3 flex items-baseline gap-2">
                                    <span className="text-3xl font-extrabold text-[#1F365C]">{totaisE.total || 0}</span>
                                    <span className="text-xs text-slate-500">pontos monitorados</span>
                                </div>
                                <div className="mt-2 text-xs flex items-center justify-between">
                                    <span className="text-emerald-600 font-semibold">{totaisE.operacionais || 0} Operacionais</span>
                                    <span className="text-amber-600 font-semibold">{totaisE.inspecoes_pendentes || 0} Pend. Vistoria</span>
                                </div>
                            </div>

                            {/* Último Simulado */}
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Simulado de Abandono</span>
                                    <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                                        <Clock className="w-5 h-5" />
                                    </div>
                                </div>
                                <div className="mt-3">
                                    {dashboardData?.ultimo_simulado ? (
                                        <>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-2xl font-bold text-[#1F365C]">
                                                    {Math.floor((dashboardData.ultimo_simulado.tempo_evacuacao_segundos || 0) / 60)}m {((dashboardData.ultimo_simulado.tempo_evacuacao_segundos || 0) % 60)}s
                                                </span>
                                                <span className="text-xs text-slate-500">tempo total</span>
                                            </div>
                                            <p className="mt-1 text-xs text-slate-500 truncate">
                                                Data: {new Date(dashboardData.ultimo_simulado.data_simulado).toLocaleDateString('pt-BR')} • {dashboardData.ultimo_simulado.total_evacuados} evac.
                                            </p>
                                        </>
                                    ) : (
                                        <div className="mt-2 text-xs text-slate-400">Nenhum simulado cadastrado ainda.</div>
                                    )}
                                </div>
                            </div>

                        </div>

                        {/* CONFORMIDADE POR TURNO (NBR 14276) */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                        <Building2 className="w-5 h-5 text-slate-600" />
                                        <span>Conformidade Legal por Turno (Dimensionamento NBR 14276)</span>
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Planta Industrial Lynx EMS • Grau de Risco: <strong>{(config.grau_risco || 'Médio').toUpperCase()}</strong> • População Fixa: <strong>{config.populacao_fixa_total || 200} colaboradores</strong>
                                    </p>
                                </div>
                                <button
                                    onClick={abrirModalConfig}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-[#1F365C] font-semibold text-xs rounded-lg border border-slate-300 transition-colors self-start sm:self-auto"
                                    title="Editar parâmetros de dimensionamento da planta"
                                >
                                    <Sliders className="w-3.5 h-3.5" />
                                    <span>Editar Dimensionamento</span>
                                </button>
                            </div>

                            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                                
                                {/* 1º Turno */}
                                <div className={`p-4 rounded-xl border ${totaisM.turno1_conforme ? 'border-emerald-200 bg-emerald-50/30' : 'border-amber-200 bg-amber-50/30'}`}>
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-slate-800 text-sm">1º Turno (Manhã)</span>
                                        <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${totaisM.turno1_conforme ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                            {totaisM.turno1_conforme ? 'CONFORME' : 'ATENÇÃO'}
                                        </span>
                                    </div>
                                    <div className="mt-3 flex items-baseline justify-between text-xs">
                                        <span className="text-slate-500">Brigadistas Ativos:</span>
                                        <span className="text-base font-bold text-slate-800">{totaisM.turno1_total || 0} / {totaisM.turno1_minimo || 8} mín.</span>
                                    </div>
                                    <div className="w-full bg-slate-200 h-2 rounded-full mt-2 overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full ${totaisM.turno1_conforme ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                            style={{ width: `${Math.min(100, ((totaisM.turno1_total || 0) / (totaisM.turno1_minimo || 8)) * 100)}%` }}
                                        />
                                    </div>
                                </div>

                                {/* 2º Turno */}
                                <div className={`p-4 rounded-xl border ${totaisM.turno2_conforme ? 'border-emerald-200 bg-emerald-50/30' : 'border-amber-200 bg-amber-50/30'}`}>
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-slate-800 text-sm">2º Turno (Tarde)</span>
                                        <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${totaisM.turno2_conforme ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                            {totaisM.turno2_conforme ? 'CONFORME' : 'ATENÇÃO'}
                                        </span>
                                    </div>
                                    <div className="mt-3 flex items-baseline justify-between text-xs">
                                        <span className="text-slate-500">Brigadistas Ativos:</span>
                                        <span className="text-base font-bold text-slate-800">{totaisM.turno2_total || 0} / {totaisM.turno2_minimo || 6} mín.</span>
                                    </div>
                                    <div className="w-full bg-slate-200 h-2 rounded-full mt-2 overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full ${totaisM.turno2_conforme ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                            style={{ width: `${Math.min(100, ((totaisM.turno2_total || 0) / (totaisM.turno2_minimo || 6)) * 100)}%` }}
                                        />
                                    </div>
                                </div>

                                {/* 3º Turno */}
                                <div className={`p-4 rounded-xl border ${totaisM.turno3_conforme ? 'border-emerald-200 bg-emerald-50/30' : 'border-amber-200 bg-amber-50/30'}`}>
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-slate-800 text-sm">3º Turno (Noite)</span>
                                        <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${totaisM.turno3_conforme ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                            {totaisM.turno3_conforme ? 'CONFORME' : 'ATENÇÃO'}
                                        </span>
                                    </div>
                                    <div className="mt-3 flex items-baseline justify-between text-xs">
                                        <span className="text-slate-500">Brigadistas Ativos:</span>
                                        <span className="text-base font-bold text-slate-800">{totaisM.turno3_total || 0} / {totaisM.turno3_minimo || 2} mín.</span>
                                    </div>
                                    <div className="w-full bg-slate-200 h-2 rounded-full mt-2 overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full ${totaisM.turno3_conforme ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                            style={{ width: `${Math.min(100, ((totaisM.turno3_total || 0) / (totaisM.turno3_minimo || 2)) * 100)}%` }}
                                        />
                                    </div>
                                </div>

                            </div>
                        </div>

                        {/* LISTA RÁPIDA: BRIGADISTAS EM PLANTÃO HOJE */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                        <UserCheck className="w-5 h-5 text-emerald-600" />
                                        <span>Brigadistas Cadastrados & Prontidão</span>
                                    </h3>
                                    <p className="text-xs text-slate-500">Corpo de brigada habilitado para resposta rápida e primeiros socorros</p>
                                </div>
                                <button
                                    onClick={() => abrirModalMembro(null)}
                                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1F365C] hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>Incluir Brigadista</span>
                                </button>
                            </div>

                            {membros.length === 0 ? (
                                <div className="text-center py-8 text-slate-400 text-sm">
                                    Nenhum brigadista vinculado à equipe ainda. Clique no botão acima para vincular colaboradores.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {membros.slice(0, 6).map(m => (
                                        <div key={m.id} className="p-4 rounded-xl border border-slate-200 flex items-start gap-3 bg-slate-50/50 hover:bg-slate-50 transition-colors relative group">
                                            {m.fotoUsuario ? (
                                                <img src={m.fotoUsuario} alt={m.NomeCompleto} className="w-12 h-12 rounded-full object-cover border-2 border-slate-300" />
                                            ) : (
                                                <div className="w-12 h-12 rounded-full bg-[#1F365C] text-white flex items-center justify-center font-bold text-sm">
                                                    {(m.NomeCompleto || 'B').substring(0, 2).toUpperCase()}
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="font-bold text-slate-800 text-sm truncate">{m.NomeCompleto}</h4>
                                                    <button
                                                        onClick={() => abrirModalMembro(m)}
                                                        className="text-slate-400 hover:text-blue-600 p-1 rounded transition-colors"
                                                        title="Editar Brigadista"
                                                    >
                                                        <Edit className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                                <p className="text-xs text-slate-500 truncate">{formatPapel(m.papel)} • {formatTurno(m.turno)}</p>
                                                <div className="mt-2 flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                                                        m.validade_treinamento 
                                                            ? (new Date(m.validade_treinamento) > new Date() ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')
                                                            : 'bg-amber-100 text-amber-700'
                                                    }`}>
                                                        {m.validade_treinamento 
                                                            ? (new Date(m.validade_treinamento) > new Date() ? 'CURSO VÁLIDO' : 'RECICLAGEM VENCIDA')
                                                            : 'SEM TREINAMENTO'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                    </div>
                )}

                {/* ======================================================== */}
                {/* ABA 2: EQUIPE & HIERARQUIA */}
                {/* ======================================================== */}
                {activeTab === 'equipe' && (
                    <div className="space-y-6">
                        
                        {/* CABEÇALHO & FILTROS */}
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-3 flex-1">
                                <div className="relative flex-1 max-w-md">
                                    <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                                    <input 
                                        type="text"
                                        placeholder="Buscar por nome ou setor..."
                                        value={buscaMembro}
                                        onChange={e => setBuscaMembro(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#1F365C]"
                                    />
                                </div>
                                <select
                                    value={filtroTurno}
                                    onChange={e => setFiltroTurno(e.target.value)}
                                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1F365C]"
                                >
                                    <option value="todos">Todos os Turnos</option>
                                    <option value="1_turno">1º Turno (Manhã)</option>
                                    <option value="2_turno">2º Turno (Tarde)</option>
                                    <option value="3_turno">3º Turno (Noite)</option>
                                    <option value="administrativo">Administrativo</option>
                                </select>
                            </div>

                            <button
                                onClick={() => abrirModalMembro(null)}
                                className="flex items-center gap-2 px-4 py-2.5 bg-[#1F365C] hover:bg-slate-800 text-white font-semibold text-sm rounded-xl shadow transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Novo Brigadista</span>
                            </button>
                        </div>

                        {/* TABELA DE MEMBROS */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                                        <th className="py-3 px-4">Brigadista</th>
                                        <th className="py-3 px-4">Papel Hierárquico</th>
                                        <th className="py-3 px-4">Turno & Setor</th>
                                        <th className="py-3 px-4">Treinamento / Vigência</th>
                                        <th className="py-3 px-4">Contato</th>
                                        <th className="py-3 px-4 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm">
                                    {membrosFiltrados.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="text-center py-8 text-slate-400">
                                                Nenhum brigadista localizado com os filtros aplicados.
                                            </td>
                                        </tr>
                                    ) : (
                                        membrosFiltrados.map(m => (
                                            <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-3">
                                                        {m.fotoUsuario ? (
                                                            <img src={m.fotoUsuario} alt={m.NomeCompleto} className="w-10 h-10 rounded-full object-cover border border-slate-300" />
                                                        ) : (
                                                            <div className="w-10 h-10 rounded-full bg-[#1F365C] text-white flex items-center justify-center font-bold text-xs">
                                                                {(m.NomeCompleto || 'B').substring(0, 2).toUpperCase()}
                                                            </div>
                                                        )}
                                                        <div>
                                                            <div className="font-bold text-slate-800">{m.NomeCompleto}</div>
                                                            <div className="text-xs text-slate-400">Matrícula: {m.Matricula || m.usuario_id}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                                                        m.papel === 'coordenador_geral' ? 'bg-red-100 text-red-800' :
                                                        m.papel === 'chefe_brigada' ? 'bg-amber-100 text-amber-800' :
                                                        m.papel === 'lider_setor' ? 'bg-blue-100 text-blue-800' :
                                                        'bg-slate-100 text-slate-700'
                                                    }`}>
                                                        {formatPapel(m.papel)}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="font-medium text-slate-700">{formatTurno(m.turno)}</div>
                                                    <div className="text-xs text-slate-500">{m.setor_atuacao || m.Setor || 'Planta Geral'}</div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    {m.data_validade_treinamento ? (
                                                        <div>
                                                            <span className={`px-2 py-0.5 text-xs font-bold rounded ${
                                                                new Date(m.data_validade_treinamento) > new Date() ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                                            }`}>
                                                                {m.nivel_treinamento ? m.nivel_treinamento.toUpperCase() : 'BÁSICO'} • Até {new Date(m.data_validade_treinamento).toLocaleDateString('pt-BR')}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded">
                                                            Pendente Formação
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-xs text-slate-600">
                                                    <div>{m.whatsapp || m.telefone || 'Sem telefone'}</div>
                                                    <div className="text-slate-400">{m.email || 'Sem e-mail'}</div>
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button
                                                            onClick={() => abrirModalMembro(m)}
                                                            className="text-slate-400 hover:text-blue-600 p-1.5 rounded transition-colors"
                                                            title="Editar dados do brigadista"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleInativarMembro(m.id, m.NomeCompleto)}
                                                            className="text-slate-400 hover:text-red-600 p-1.5 rounded transition-colors"
                                                            title="Inativar membro da brigada"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                    </div>
                )}

                {/* ======================================================== */}
                {/* ABA 3: TREINAMENTOS & RECICLAGENS */}
                {/* ======================================================== */}
                {activeTab === 'treinamentos' && (
                    <div className="space-y-6">
                        
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h3 className="font-bold text-slate-800 text-base">Controle de Treinamentos & Reciclagens Anuais</h3>
                                <p className="text-xs text-slate-500">Em conformidade com a NBR 14276: carga horária mínima, teoria, prática de combate e primeiros socorros</p>
                            </div>

                            <button
                                onClick={() => abrirModalTreinamento()}
                                className="flex items-center gap-2 px-4 py-2.5 bg-[#1F365C] hover:bg-slate-800 text-white font-semibold text-sm rounded-xl shadow transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Registrar Treinamento / Certificado</span>
                            </button>
                        </div>

                        {/* LISTAGEM DE TREINAMENTOS */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                                        <th className="py-3 px-4">Brigadista</th>
                                        <th className="py-3 px-4">Nível / Carga Horária</th>
                                        <th className="py-3 px-4">Entidade Formadora / Instrutor</th>
                                        <th className="py-3 px-4">Conclusão</th>
                                        <th className="py-3 px-4">Validade (Reciclagem)</th>
                                        <th className="py-3 px-4">Certificado</th>
                                        <th className="py-3 px-4 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm">
                                    {treinamentos.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="text-center py-8 text-slate-400">
                                                Nenhum treinamento registrado ainda.
                                            </td>
                                        </tr>
                                    ) : (
                                        treinamentos.map(t => (
                                            <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="py-3 px-4">
                                                    <div className="font-bold text-slate-800">{t.NomeCompleto}</div>
                                                    <div className="text-xs text-slate-400">{formatPapel(t.papel)} • {t.Setor}</div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="font-semibold text-slate-700 capitalize">{t.nivel}</span>
                                                    <span className="text-xs text-slate-500 block">{t.carga_horaria_horas} horas / aula</span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="font-medium text-slate-700">{t.entidade_formadora}</div>
                                                    <div className="text-xs text-slate-400">{t.instrutor_responsavel || 'Instrutor Credenciado'}</div>
                                                </td>
                                                <td className="py-3 px-4 text-slate-600 text-xs">
                                                    {new Date(t.data_conclusao).toLocaleDateString('pt-BR')}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                                                        new Date(t.data_validade) > new Date() ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                                                    }`}>
                                                        {new Date(t.data_validade).toLocaleDateString('pt-BR')}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    {t.certificado_url ? (
                                                        <a 
                                                            href={t.certificado_url} 
                                                            target="_blank" 
                                                            rel="noreferrer"
                                                            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-semibold"
                                                        >
                                                            <ExternalLink className="w-3.5 h-3.5" />
                                                            <span>Ver Anexo</span>
                                                        </a>
                                                    ) : (
                                                        <span className="text-xs text-slate-400">Sem anexo</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button
                                                            onClick={() => abrirModalTreinamento(t)}
                                                            className="text-slate-400 hover:text-blue-600 p-1.5 rounded transition-colors"
                                                            title="Editar treinamento / validade"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleExcluirTreinamento(t.id)}
                                                            className="text-slate-400 hover:text-red-600 p-1.5 rounded transition-colors"
                                                            title="Excluir registro de treinamento"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                    </div>
                )}

                {/* ======================================================== */}
                {/* ABA 4: EQUIPAMENTOS & INSPEÇÕES */}
                {/* ======================================================== */}
                {activeTab === 'equipamentos' && (
                    <div className="space-y-6">
                        
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-3 flex-1">
                                <div className="relative flex-1 max-w-md">
                                    <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                                    <input 
                                        type="text"
                                        placeholder="Buscar por código ou setor..."
                                        value={buscaEquipamento}
                                        onChange={e => setBuscaEquipamento(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#1F365C]"
                                    />
                                </div>
                                <select
                                    value={filtroTipoEquip}
                                    onChange={e => setFiltroTipoEquip(e.target.value)}
                                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1F365C]"
                                >
                                    <option value="todos">Todos os Tipos</option>
                                    <option value="extintor_pqs_abc">Extintor Pó ABC</option>
                                    <option value="extintor_co2">Extintor CO2</option>
                                    <option value="extintor_agua">Extintor Água</option>
                                    <option value="hidrante_abrigo">Hidrante / Abrigo</option>
                                </select>
                            </div>

                            <button
                                onClick={() => abrirModalEquipamento()}
                                className="flex items-center gap-2 px-4 py-2.5 bg-[#1F365C] hover:bg-slate-800 text-white font-semibold text-sm rounded-xl shadow transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Novo Equipamento</span>
                            </button>
                        </div>

                        {/* TABELA DE EQUIPAMENTOS */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                                        <th className="py-3 px-4">Identificador</th>
                                        <th className="py-3 px-4">Tipo & Carga</th>
                                        <th className="py-3 px-4">Setor / Localização</th>
                                        <th className="py-3 px-4">Próx. Recarga</th>
                                        <th className="py-3 px-4">Teste Hidrostático</th>
                                        <th className="py-3 px-4">Última Vistoria</th>
                                        <th className="py-3 px-4 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm">
                                    {equipamentosFiltrados.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="text-center py-8 text-slate-400">
                                                Nenhum equipamento localizado.
                                            </td>
                                        </tr>
                                    ) : (
                                        equipamentosFiltrados.map(e => (
                                            <tr key={e.id} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-extrabold text-[#1F365C] bg-slate-100 px-2 py-1 rounded border border-slate-200 font-mono">
                                                            {e.codigo_identificador}
                                                        </span>
                                                        <span className={`w-2 h-2 rounded-full ${e.status_operacional === 'operacional' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="font-semibold text-slate-800">{formatTipoEquip(e.tipo)}</div>
                                                    <div className="text-xs text-slate-400">{e.capacidade_carga}</div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="font-medium text-slate-700">{e.setor_localizacao}</div>
                                                    <div className="text-xs text-slate-400">{e.ponto_referencia || 'Sem ref.'}</div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    {e.data_proxima_recarga ? (
                                                        <span className={`px-2 py-0.5 text-xs font-bold rounded ${
                                                            new Date(e.data_proxima_recarga) > new Date() ? 'bg-slate-100 text-slate-700' : 'bg-red-100 text-red-700 font-bold'
                                                        }`}>
                                                            {new Date(e.data_proxima_recarga).toLocaleDateString('pt-BR')}
                                                        </span>
                                                    ) : '-'}
                                                </td>
                                                <td className="py-3 px-4 text-xs text-slate-600">
                                                    {e.data_proximo_teste_hidrostatico ? new Date(e.data_proximo_teste_hidrostatico).toLocaleDateString('pt-BR') : '-'}
                                                </td>
                                                <td className="py-3 px-4">
                                                    {e.ultima_inspecao_data ? (
                                                        <div>
                                                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                                                                e.ultima_inspecao_resultado === 'conforme' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                                                            }`}>
                                                                {e.ultima_inspecao_resultado === 'conforme' ? 'CONFORME' : 'NÃO CONFORME'}
                                                            </span>
                                                            <div className="text-[10px] text-slate-400 mt-0.5">
                                                                {new Date(e.ultima_inspecao_data).toLocaleDateString('pt-BR')} por {e.ultimo_inspetor_nome?.split(' ')[0]}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded">
                                                            Sem Vistoria
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            onClick={() => abrirInspecaoModal(e)}
                                                            className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg transition-colors"
                                                            title="Registrar vistoria mensal com evidência fotográfica"
                                                        >
                                                            Vistoriar
                                                        </button>
                                                        <button
                                                            onClick={() => abrirHistoricoInspecao(e)}
                                                            className="p-1 text-slate-400 hover:text-[#1F365C] rounded transition-colors"
                                                            title="Ver histórico de vistorias"
                                                        >
                                                            <History className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => abrirModalEquipamento(e)}
                                                            className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors"
                                                            title="Editar equipamento"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleExcluirEquipamento(e.id, e.codigo_identificador)}
                                                            className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                                                            title="Excluir equipamento"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                    </div>
                )}

                {/* ======================================================== */}
                {/* ABA 5: SIMULADOS DE EVACUAÇÃO (NR-23) */}
                {/* ======================================================== */}
                {activeTab === 'simulados' && (
                    <div className="space-y-6">
                        
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h3 className="font-bold text-slate-800 text-base">Exercícios Simulados de Abandono de Área (NR-23)</h3>
                                <p className="text-xs text-slate-500">Treinamento prático semestral/anual da fábrica com cronometragem, rotas de fuga e plano de melhorias</p>
                            </div>

                            <button
                                onClick={() => abrirModalSimulado()}
                                className="flex items-center gap-2 px-4 py-2.5 bg-[#1F365C] hover:bg-slate-800 text-white font-semibold text-sm rounded-xl shadow transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Registrar Exercício Simulado</span>
                            </button>
                        </div>

                        {/* LISTAGEM DE SIMULADOS */}
                        <div className="space-y-4">
                            {simulados.length === 0 ? (
                                <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-sm">
                                    Nenhum exercício simulado registrado ainda.
                                </div>
                            ) : (
                                simulados.map(s => (
                                    <div key={s.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-bold text-slate-800 text-base">{s.titulo}</h4>
                                                    <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                                                        s.avaliacao_eficacia === 'excelente' ? 'bg-emerald-100 text-emerald-800' :
                                                        s.avaliacao_eficacia === 'bom' ? 'bg-blue-100 text-blue-800' :
                                                        'bg-amber-100 text-amber-800'
                                                    }`}>
                                                        Eficácia: {s.avaliacao_eficacia.toUpperCase()}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500">
                                                    Data: {new Date(s.data_simulado).toLocaleDateString('pt-BR')} • Início: {s.horario_inicio} | Término: {s.horario_termino}
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <div className="text-right">
                                                    <span className="text-2xl font-extrabold text-[#1F365C]">
                                                        {Math.floor(s.tempo_evacuacao_segundos / 60)}m {(s.tempo_evacuacao_segundos % 60)}s
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Tempo de Abandono</span>
                                                </div>
                                                <div className="flex items-center gap-1 border-l pl-3 border-slate-200">
                                                    <button
                                                        onClick={() => abrirModalSimulado(s)}
                                                        className="p-1.5 text-slate-400 hover:text-blue-600 rounded transition-colors"
                                                        title="Editar simulado"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleExcluirSimulado(s.id, s.titulo)}
                                                        className="p-1.5 text-slate-400 hover:text-red-600 rounded transition-colors"
                                                        title="Excluir simulado"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600 bg-slate-50 p-4 rounded-xl">
                                            <div>
                                                <span className="text-slate-400 block">Pessoas Evacuadas:</span>
                                                <strong className="text-slate-800 text-sm">{s.total_evacuados} colaboradores</strong>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 block">Brigadistas Atuantes:</span>
                                                <strong className="text-slate-800 text-sm">{s.total_brigadistas_atuantes} brigadistas</strong>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 block">Responsável Técnico / SESMT:</span>
                                                <strong className="text-slate-800 text-sm">{s.responsavel_nome}</strong>
                                            </div>
                                        </div>

                                        <div>
                                            <h5 className="text-xs font-bold text-slate-700 uppercase">Cenário Simulado:</h5>
                                            <p className="text-xs text-slate-600 mt-1">{s.cenario_simulado}</p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                            <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-lg">
                                                <strong className="text-emerald-800 block mb-1">Pontos Fortes Observados:</strong>
                                                <span className="text-slate-600">{s.pontos_fortes || 'Evacuação dentro do tempo limite.'}</span>
                                            </div>
                                            <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-lg">
                                                <strong className="text-amber-800 block mb-1">Oportunidades de Melhoria:</strong>
                                                <span className="text-slate-600">{s.oportunidades_melhoria || 'Nenhuma pendência crítica anotada.'}</span>
                                            </div>
                                        </div>

                                        {s.ata_anexo_url && (
                                            <div className="pt-2">
                                                <a 
                                                    href={s.ata_anexo_url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-bold"
                                                >
                                                    <Paperclip className="w-3.5 h-3.5" />
                                                    <span>Baixar Ata / Relatório Assinado do Simulado</span>
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>

                    </div>
                )}

                {/* ======================================================== */}
                {/* ABA 6: RELATÓRIO AVCB / BOMBEIROS */}
                {/* ======================================================== */}
                {activeTab === 'avcb' && (
                    <div className="space-y-6">
                        
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg">Prontuário e Dossiê da Brigada de Incêndio (AVCB / CLCB)</h3>
                                <p className="text-xs text-slate-500">Documento oficial consolidado para apresentação ao Corpo de Bombeiros Militar e auditorias de SST</p>
                            </div>

                            <button
                                onClick={() => window.print()}
                                className="flex items-center gap-2 px-4 py-2.5 bg-[#1F365C] hover:bg-slate-800 text-white font-semibold text-sm rounded-xl shadow transition-colors"
                            >
                                <Printer className="w-4 h-4" />
                                <span>Imprimir Dossiê Oficial</span>
                            </button>
                        </div>

                        {/* FOLHA DE RELATÓRIO OFICIAL FORMATADA */}
                        <div className="bg-white p-8 rounded-2xl border border-slate-300 shadow-md space-y-6 print:border-none print:shadow-none">
                            
                            {/* CABEÇALHO DO DOCUMENTO */}
                            <div className="flex items-center justify-between border-b-2 border-slate-800 pb-4">
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 tracking-tight">LYNX EMS INDÚSTRIA METALÚRGICA LTDA</h2>
                                    <p className="text-xs text-slate-600">SESMT - Serviço Especializado em Engenharia de Segurança e Medicina do Trabalho</p>
                                    <p className="text-xs text-slate-500">CNPJ: 19.345.678/0001-90 • Inscrição Estadual: 001.234.567.89</p>
                                </div>
                                <div className="text-right">
                                    <div className="font-mono text-sm font-bold text-slate-800">DOSSIÊ NR-23 / NBR 14276</div>
                                    <div className="text-xs text-slate-500">Emissão: {new Date().toLocaleDateString('pt-BR')}</div>
                                </div>
                            </div>

                            {/* DADOS DA PLANTA */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl text-xs">
                                <div>
                                    <span className="text-slate-500 block">Grau de Risco:</span>
                                    <strong className="text-slate-800 font-bold">Médio (Carga de Incêndio Metalmecânica)</strong>
                                </div>
                                <div>
                                    <span className="text-slate-500 block">População Fixa Total:</span>
                                    <strong className="text-slate-800 font-bold">{config.populacao_fixa_total || 200} colaboradores</strong>
                                </div>
                                <div>
                                    <span className="text-slate-500 block">Brigadistas Formados:</span>
                                    <strong className="text-slate-800 font-bold">{totaisM.aptos || 0} brigadistas aptos</strong>
                                </div>
                                <div>
                                    <span className="text-slate-500 block">Pontos de Encontro:</span>
                                    <strong className="text-slate-800 font-bold">2 pontos mapeados</strong>
                                </div>
                            </div>

                            {/* RELAÇÃO NOMINAL DA BRIGADA */}
                            <div>
                                <h4 className="font-bold text-slate-900 text-sm uppercase tracking-wider mb-2 border-b border-slate-200 pb-1">
                                    1. Relação Nominal dos Integrantes da Brigada de Incêndio
                                </h4>
                                <table className="w-full text-left text-xs border border-slate-200">
                                    <thead className="bg-slate-100 text-slate-700">
                                        <tr>
                                            <th className="p-2 border">Nome do Brigadista</th>
                                            <th className="p-2 border">Papel Hierárquico</th>
                                            <th className="p-2 border">Turno / Setor</th>
                                            <th className="p-2 border">Nível de Formação</th>
                                            <th className="p-2 border">Validade do Certificado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {membros.map(m => (
                                            <tr key={m.id} className="border-b">
                                                <td className="p-2 border font-bold text-slate-800">{m.NomeCompleto}</td>
                                                <td className="p-2 border">{formatPapel(m.papel)}</td>
                                                <td className="p-2 border">{formatTurno(m.turno)} ({m.Setor})</td>
                                                <td className="p-2 border uppercase">{m.nivel_treinamento || 'Básico'}</td>
                                                <td className="p-2 border font-semibold">
                                                    {m.data_validade_treinamento ? new Date(m.data_validade_treinamento).toLocaleDateString('pt-BR') : 'Pendente'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* EQUIPAMENTOS DE COMBATE */}
                            <div>
                                <h4 className="font-bold text-slate-900 text-sm uppercase tracking-wider mb-2 border-b border-slate-200 pb-1">
                                    2. Inventário de Proteção Ativa (Extintores & Hidrantes)
                                </h4>
                                <table className="w-full text-left text-xs border border-slate-200">
                                    <thead className="bg-slate-100 text-slate-700">
                                        <tr>
                                            <th className="p-2 border">Código</th>
                                            <th className="p-2 border">Tipo / Agente Extintor</th>
                                            <th className="p-2 border">Setor / Ponto Físico</th>
                                            <th className="p-2 border">Vencimento Recarga</th>
                                            <th className="p-2 border">Status Operacional</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {equipamentos.map(e => (
                                            <tr key={e.id} className="border-b">
                                                <td className="p-2 border font-mono font-bold">{e.codigo_identificador}</td>
                                                <td className="p-2 border">{formatTipoEquip(e.tipo)} ({e.capacidade_carga})</td>
                                                <td className="p-2 border">{e.setor_localizacao}</td>
                                                <td className="p-2 border">{e.data_proxima_recarga ? new Date(e.data_proxima_recarga).toLocaleDateString('pt-BR') : '-'}</td>
                                                <td className="p-2 border font-bold text-emerald-700 uppercase">{e.status_operacional}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* TERMO DE RESPONSABILIDADE */}
                            <div className="pt-8 border-t border-slate-200 text-center text-xs text-slate-500 space-y-4">
                                <p>
                                    Declaramos para os devidos fins de direito que a Brigada de Incêndio da Lynx EMS encontra-se dimensionada e capacitada conforme as prescrições da Norma Regulamentadora NR-23 e ABNT NBR 14276.
                                </p>
                                <div className="flex justify-around pt-6">
                                    <div className="border-t border-slate-400 pt-2 w-64">
                                        <div className="font-bold text-slate-800">Coordenador Geral da Brigada</div>
                                        <div className="text-[10px]">Lynx EMS Indústria Metalúrgica</div>
                                    </div>
                                    <div className="border-t border-slate-400 pt-2 w-64">
                                        <div className="font-bold text-slate-800">Engenheiro / Técnico de SST</div>
                                        <div className="text-[10px]">Reg. MTE / CREA</div>
                                    </div>
                                </div>
                            </div>

                        </div>

                    </div>
                )}

            </div>

            {/* ======================================================== */}
            {/* MODAL: NOVO / EDITAR BRIGADISTA */}
            {/* ======================================================== */}
            {showModalMembro && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
                        <div className="flex items-center justify-between border-b pb-3">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Users className="w-5 h-5 text-red-600" />
                                <span>{editandoMembro ? 'Editar Dados do Brigadista' : 'Incluir Colaborador na Brigada'}</span>
                            </h3>
                            <button onClick={() => setShowModalMembro(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>
                        <form onSubmit={handleSalvarMembro} className="mt-4 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Colaborador Oficial *</label>
                                <select
                                    required
                                    value={formMembro.usuario_id}
                                    onChange={e => setFormMembro({ ...formMembro, usuario_id: e.target.value })}
                                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#1F365C]"
                                >
                                    <option value="">Selecione o colaborador...</option>
                                    {colaboradores.map(c => (
                                        <option key={c.idUsuario} value={c.idUsuario}>
                                            {c.NomeCompleto} ({c.Setor || 'Geral'} - {c.Funcao || 'Operador'})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Papel na Brigada *</label>
                                    <select
                                        value={formMembro.papel}
                                        onChange={e => setFormMembro({ ...formMembro, papel: e.target.value })}
                                        className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-[#1F365C]"
                                    >
                                        <option value="coordenador_geral">Coordenador Geral</option>
                                        <option value="chefe_brigada">Chefe de Brigada</option>
                                        <option value="lider_setor">Líder de Setor</option>
                                        <option value="brigadista_operacional">Brigadista Operacional</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Turno de Atuação *</label>
                                    <select
                                        value={formMembro.turno}
                                        onChange={e => setFormMembro({ ...formMembro, turno: e.target.value })}
                                        className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-[#1F365C]"
                                    >
                                        <option value="1_turno">1º Turno (Manhã)</option>
                                        <option value="2_turno">2º Turno (Tarde)</option>
                                        <option value="3_turno">3º Turno (Noite)</option>
                                        <option value="administrativo">Administrativo</option>
                                        <option value="geral">Todos os Turnos (Geral)</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Setor de Atuação / Cobertura</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Galpão de Usinagem CNC e Estamparia"
                                    value={formMembro.setor_atuacao}
                                    onChange={e => setFormMembro({ ...formMembro, setor_atuacao: e.target.value })}
                                    className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-[#1F365C]"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t">
                                <button
                                    type="button"
                                    onClick={() => setShowModalMembro(false)}
                                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 text-sm bg-[#1F365C] hover:bg-slate-800 text-white rounded-lg font-bold shadow"
                                >
                                    {editandoMembro ? 'Salvar Alterações' : 'Salvar Brigadista'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ======================================================== */}
            {/* MODAL: NOVO / EDITAR TREINAMENTO / CERTIFICADO */}
            {/* ======================================================== */}
            {showModalTreinamento && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
                        <div className="flex items-center justify-between border-b pb-3">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Award className="w-5 h-5 text-emerald-600" />
                                <span>{editandoTreinamento ? 'Editar Treinamento / Certificado' : 'Registrar Treinamento / Certificado'}</span>
                            </h3>
                            <button onClick={() => setShowModalTreinamento(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>
                        <form onSubmit={handleSalvarTreinamento} className="mt-4 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Brigadista *</label>
                                <select
                                    required
                                    value={formTreinamento.membro_id}
                                    onChange={e => setFormTreinamento({ ...formTreinamento, membro_id: e.target.value })}
                                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#1F365C]"
                                >
                                    <option value="">Selecione o brigadista...</option>
                                    {membros.map(m => (
                                        <option key={m.id} value={m.id}>
                                            {m.NomeCompleto} ({formatPapel(m.papel)})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nível de Formação *</label>
                                    <select
                                        value={formTreinamento.nivel}
                                        onChange={e => setFormTreinamento({ ...formTreinamento, nivel: e.target.value })}
                                        className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-[#1F365C]"
                                    >
                                        <option value="basico">Básico (Combate + 1º Socorros)</option>
                                        <option value="intermediario">Intermediário</option>
                                        <option value="avancado">Avançado (Resgate Industrial)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Carga Horária (Horas)</label>
                                    <input
                                        type="number"
                                        value={formTreinamento.carga_horaria_horas}
                                        onChange={e => setFormTreinamento({ ...formTreinamento, carga_horaria_horas: e.target.value })}
                                        className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-[#1F365C]"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Entidade Formadora / Empresa *</label>
                                <input
                                    type="text"
                                    required
                                    value={formTreinamento.entidade_formadora}
                                    onChange={e => setFormTreinamento({ ...formTreinamento, entidade_formadora: e.target.value })}
                                    className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-[#1F365C]"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Data Conclusão *</label>
                                    <input
                                        type="date"
                                        required
                                        value={formTreinamento.data_conclusao}
                                        onChange={e => setFormTreinamento({ ...formTreinamento, data_conclusao: e.target.value })}
                                        className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-[#1F365C]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Validade (Reciclagem) *</label>
                                    <input
                                        type="date"
                                        required
                                        value={formTreinamento.data_validade}
                                        onChange={e => setFormTreinamento({ ...formTreinamento, data_validade: e.target.value })}
                                        className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-[#1F365C]"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Anexo do Certificado (PDF ou Foto)</label>
                                <input
                                    type="file"
                                    accept=".pdf,.png,.jpg,.jpeg"
                                    onChange={e => setArquivoCertificado(e.target.files[0])}
                                    className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:outline-none focus:border-[#1F365C]"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t">
                                <button
                                    type="button"
                                    onClick={() => setShowModalTreinamento(false)}
                                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow"
                                >
                                    {editandoTreinamento ? 'Salvar Alterações' : 'Registrar Certificado'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ======================================================== */}
            {/* MODAL: NOVO / EDITAR EQUIPAMENTO */}
            {/* ======================================================== */}
            {showModalEquipamento && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
                        <div className="flex items-center justify-between border-b pb-3">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Flame className="w-5 h-5 text-red-600" />
                                <span>{editandoEquipamento ? `Editar Equipamento (${editandoEquipamento.codigo_identificador})` : 'Cadastrar Equipamento de Combate'}</span>
                            </h3>
                            <button onClick={() => setShowModalEquipamento(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>
                        <form onSubmit={handleSalvarEquipamento} className="mt-4 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Código Identificador *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ex: EXT-05"
                                        value={formEquipamento.codigo_identificador}
                                        onChange={e => setFormEquipamento({ ...formEquipamento, codigo_identificador: e.target.value })}
                                        className="w-full border border-slate-300 rounded-lg p-2 text-sm font-mono uppercase focus:outline-none focus:border-[#1F365C]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tipo de Equipamento *</label>
                                    <select
                                        value={formEquipamento.tipo}
                                        onChange={e => setFormEquipamento({ ...formEquipamento, tipo: e.target.value })}
                                        className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-[#1F365C]"
                                    >
                                        <option value="extintor_pqs_abc">Extintor Pó ABC</option>
                                        <option value="extintor_co2">Extintor CO2</option>
                                        <option value="extintor_agua">Extintor Água Pressurizada</option>
                                        <option value="hidrante_abrigo">Hidrante / Abrigo</option>
                                        <option value="alarme_botoeira">Botoeira de Alarme</option>
                                        <option value="luz_emergencia">Luz de Emergência</option>
                                        <option value="porta_corta_fogo">Porta Corta-Fogo</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Capacidade / Carga</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: 6 kg ou 10 L"
                                        value={formEquipamento.capacidade_carga}
                                        onChange={e => setFormEquipamento({ ...formEquipamento, capacidade_carga: e.target.value })}
                                        className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-[#1F365C]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Setor / Galpão *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ex: Almoxarifado Central"
                                        value={formEquipamento.setor_localizacao}
                                        onChange={e => setFormEquipamento({ ...formEquipamento, setor_localizacao: e.target.value })}
                                        className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-[#1F365C]"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Ponto de Referência Físico</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Próximo ao Torno CNC 04, Coluna C3"
                                    value={formEquipamento.ponto_referencia}
                                    onChange={e => setFormEquipamento({ ...formEquipamento, ponto_referencia: e.target.value })}
                                    className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-[#1F365C]"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Próxima Recarga (Anual)</label>
                                    <input
                                        type="date"
                                        value={formEquipamento.data_proxima_recarga}
                                        onChange={e => setFormEquipamento({ ...formEquipamento, data_proxima_recarga: e.target.value })}
                                        className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-[#1F365C]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Teste Hidrostático (5 anos)</label>
                                    <input
                                        type="date"
                                        value={formEquipamento.data_proximo_teste_hidrostatico}
                                        onChange={e => setFormEquipamento({ ...formEquipamento, data_proximo_teste_hidrostatico: e.target.value })}
                                        className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-[#1F365C]"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t">
                                <button
                                    type="button"
                                    onClick={() => setShowModalEquipamento(false)}
                                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 text-sm bg-[#1F365C] hover:bg-slate-800 text-white rounded-lg font-bold shadow"
                                >
                                    {editandoEquipamento ? 'Salvar Alterações' : 'Salvar Equipamento'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ======================================================== */}
            {/* MODAL: REGISTRAR INSPEÇÃO / VISTORIA */}
            {/* ======================================================== */}
            {showModalInspecao && equipamentoSelecionado && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
                        <div className="flex items-center justify-between border-b pb-3">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <CheckSquare className="w-5 h-5 text-emerald-600" />
                                    <span>Vistoria Mensal de Equipamento</span>
                                </h3>
                                <p className="text-xs text-slate-500 font-mono mt-0.5">
                                    {equipamentoSelecionado.codigo_identificador} • {formatTipoEquip(equipamentoSelecionado.tipo)}
                                </p>
                            </div>
                            <button onClick={() => setShowModalInspecao(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>
                        <form onSubmit={handleSalvarInspecao} className="mt-4 space-y-3">
                            <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                {[
                                    { key: 'lacre_intacto', label: '1. Lacre de segurança intacto e sem violação' },
                                    { key: 'manometro_pressao_conforme', label: '2. Manômetro de pressão na faixa verde (pressurizado)' },
                                    { key: 'desobstruido', label: '3. Acesso 100% desobstruído (sem caixas ou materiais)' },
                                    { key: 'sinalizacao_visivel', label: '4. Placa fotoluminescente e pintura no piso visíveis' },
                                    { key: 'mangueira_bico_ok', label: '5. Mangueira, esguicho ou difusor em perfeito estado' },
                                    { key: 'carga_no_prazo', label: '6. Selo do INMETRO e validade da carga dentro do prazo' }
                                ].map(item => (
                                    <label key={item.key} className="flex items-center gap-3 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                                        <input
                                            type="checkbox"
                                            checked={formInspecao[item.key]}
                                            onChange={e => setFormInspecao({ ...formInspecao, [item.key]: e.target.checked })}
                                            className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                                        />
                                        <span className="text-xs font-semibold text-slate-700">{item.label}</span>
                                    </label>
                                ))}
                            </div>

                            {/* Evidência Fotográfica da Vistoria (Câmera Celular) */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                    Evidência Fotográfica da Vistoria (Câmera / Celular)
                                </label>
                                {fotoInspecaoPreview ? (
                                    <div className="relative rounded-xl overflow-hidden border-2 border-emerald-500 bg-slate-900 group">
                                        <img 
                                            src={fotoInspecaoPreview} 
                                            alt="Evidência da vistoria" 
                                            className="w-full h-40 object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setFotoVisualizacaoUrl(fotoInspecaoPreview)}
                                                className="p-2 bg-white/20 hover:bg-white/40 text-white rounded-lg backdrop-blur-sm cursor-pointer"
                                                title="Ampliar"
                                            >
                                                <ZoomIn className="w-5 h-5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setFotoInspecao(null);
                                                    setFotoInspecaoPreview(null);
                                                }}
                                                className="p-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg cursor-pointer"
                                                title="Remover"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl cursor-pointer bg-slate-50 hover:bg-emerald-50/50 transition-colors group">
                                        <Camera className="w-7 h-7 text-slate-400 group-hover:text-emerald-600 mb-1" />
                                        <span className="text-xs font-bold text-slate-700 group-hover:text-emerald-700">Tirar Foto do Equipamento</span>
                                        <span className="text-[10px] text-slate-400">Clique para abrir a câmera do celular ou escolher foto</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    setFotoInspecao(file);
                                                    setFotoInspecaoPreview(URL.createObjectURL(file));
                                                }
                                            }}
                                            className="hidden"
                                        />
                                    </label>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Observações do Inspetor</label>
                                <textarea
                                    rows={2}
                                    placeholder="Caso haja alguma avaria, relate aqui..."
                                    value={formInspecao.observacoes}
                                    onChange={e => setFormInspecao({ ...formInspecao, observacoes: e.target.value })}
                                    className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:outline-none focus:border-[#1F365C]"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t">
                                <button
                                    type="button"
                                    onClick={() => setShowModalInspecao(false)}
                                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow cursor-pointer"
                                >
                                    Concluir Vistoria
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ======================================================== */}
            {/* MODAL: HISTÓRICO DE INSPEÇÕES */}
            {/* ======================================================== */}
            {showModalHistorico && equipamentoSelecionado && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl">
                        <div className="flex items-center justify-between border-b pb-3">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <History className="w-5 h-5 text-blue-600" />
                                    <span>Histórico de Vistorias</span>
                                </h3>
                                <p className="text-xs text-slate-500 font-mono">
                                    {equipamentoSelecionado.codigo_identificador} • {equipamentoSelecionado.setor_localizacao}
                                </p>
                            </div>
                            <button onClick={() => setShowModalHistorico(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">✕</button>
                        </div>

                        <div className="mt-4 max-h-80 overflow-y-auto space-y-3">
                            {historicoInspecao.length === 0 ? (
                                <p className="text-center py-6 text-xs text-slate-400">Nenhuma vistoria registrada para este equipamento ainda.</p>
                            ) : (
                                historicoInspecao.map(h => (
                                    <div key={h.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                                        <div className="flex items-center justify-between">
                                            <span className={`px-2 py-0.5 font-bold rounded-full text-[10px] ${
                                                h.resultado_final === 'conforme' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                                            }`}>
                                                {h.resultado_final === 'conforme' ? 'CONFORME' : 'NÃO CONFORME'}
                                            </span>
                                            <span className="text-slate-500">{new Date(h.data_inspecao).toLocaleString('pt-BR')}</span>
                                        </div>
                                        <div className="text-slate-700">Inspetor: <strong>{h.inspetor_nome}</strong></div>
                                        {h.observacoes && <p className="text-slate-500 italic mt-1">{h.observacoes}</p>}
                                        {h.foto_evidencia_url && (
                                            <div className="mt-2 flex items-center gap-2">
                                                <img 
                                                    src={h.foto_evidencia_url} 
                                                    alt="Foto da vistoria" 
                                                    onClick={() => setFotoVisualizacaoUrl(h.foto_evidencia_url)}
                                                    className="w-16 h-16 object-cover rounded-lg border border-slate-300 cursor-pointer hover:opacity-80 transition-opacity" 
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setFotoVisualizacaoUrl(h.foto_evidencia_url)}
                                                    className="text-xs text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                                                >
                                                    <ZoomIn className="w-3.5 h-3.5" /> Ver foto da vistoria
                                                </button>
                                            </div>
                                        )}
                                        <div className="flex justify-end pt-1">
                                            <button
                                                type="button"
                                                onClick={() => handleExcluirInspecao(h.id)}
                                                className="text-[11px] text-red-600 hover:text-red-800 flex items-center gap-1 cursor-pointer font-semibold"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" /> Excluir vistoria
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="flex justify-end pt-3 border-t mt-4">
                            <button
                                onClick={() => setShowModalHistorico(false)}
                                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ======================================================== */}
            {/* MODAL: NOVO SIMULADO DE ABANDONO */}
            {/* ======================================================== */}
            {showModalSimulado && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
                        <div className="flex items-center justify-between border-b pb-3">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-blue-600" />
                                <span>Registrar Exercício Simulado (NR-23)</span>
                            </h3>
                            <button onClick={() => setShowModalSimulado(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>
                        <form onSubmit={handleSalvarSimulado} className="mt-4 space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Título do Exercício *</label>
                                <input
                                    type="text"
                                    required
                                    value={formSimulado.titulo}
                                    onChange={e => setFormSimulado({ ...formSimulado, titulo: e.target.value })}
                                    className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-[#1F365C]"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Data *</label>
                                    <input
                                        type="date"
                                        required
                                        value={formSimulado.data_simulado}
                                        onChange={e => setFormSimulado({ ...formSimulado, data_simulado: e.target.value })}
                                        className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-[#1F365C]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tempo de Evacuação (segundos) *</label>
                                    <input
                                        type="number"
                                        required
                                        placeholder="Ex: 240 (4 minutos)"
                                        value={formSimulado.tempo_evacuacao_segundos}
                                        onChange={e => setFormSimulado({ ...formSimulado, tempo_evacuacao_segundos: e.target.value })}
                                        className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-[#1F365C]"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Total de Evacuados</label>
                                    <input
                                        type="number"
                                        value={formSimulado.total_evacuados}
                                        onChange={e => setFormSimulado({ ...formSimulado, total_evacuados: e.target.value })}
                                        className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-[#1F365C]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Brigadistas Participantes</label>
                                    <input
                                        type="number"
                                        value={formSimulado.total_brigadistas_atuantes}
                                        onChange={e => setFormSimulado({ ...formSimulado, total_brigadistas_atuantes: e.target.value })}
                                        className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-[#1F365C]"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Cenário Simulado *</label>
                                <textarea
                                    rows={2}
                                    required
                                    value={formSimulado.cenario_simulado}
                                    onChange={e => setFormSimulado({ ...formSimulado, cenario_simulado: e.target.value })}
                                    className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:outline-none focus:border-[#1F365C]"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Avaliação Geral</label>
                                    <select
                                        value={formSimulado.avaliacao_eficacia}
                                        onChange={e => setFormSimulado({ ...formSimulado, avaliacao_eficacia: e.target.value })}
                                        className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-[#1F365C]"
                                    >
                                        <option value="excelente">Excelente</option>
                                        <option value="bom">Bom</option>
                                        <option value="regular">Regular</option>
                                        <option value="insatisfatorio">Insatisfatório</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Anexo da Ata (PDF)</label>
                                    <input
                                        type="file"
                                        accept=".pdf,.png,.jpg,.docx"
                                        onChange={e => setArquivoAtaSimulado(e.target.files[0])}
                                        className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:outline-none focus:border-[#1F365C]"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t">
                                <button
                                    type="button"
                                    onClick={() => setShowModalSimulado(false)}
                                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow"
                                >
                                    Salvar Simulado
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ======================================================== */}
            {/* MODAL: ACIONAMENTO DE EMERGÊNCIA (WHATSAPP COM FOTO/VÍDEO) */}
            {/* ======================================================== */}
            <AlertaEmergenciaModal 
                isOpen={showModalEmergencia} 
                onClose={() => setShowModalEmergencia(false)} 
            />

            {/* ======================================================== */}
            {/* MODAL: CONFIGURAÇÃO DE DIMENSIONAMENTO E PARÂMETROS NR-23 */}
            {/* ======================================================== */}
            {showModalConfig && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b pb-3">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Sliders className="w-5 h-5 text-[#1F365C]" />
                                <span>Configuração e Dimensionamento (NR-23)</span>
                            </h3>
                            <button onClick={() => setShowModalConfig(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">✕</button>
                        </div>
                        <form onSubmit={handleSalvarConfig} className="mt-4 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nome da Planta</label>
                                    <input
                                        type="text"
                                        required
                                        value={formConfig.planta_nome}
                                        onChange={e => setFormConfig({ ...formConfig, planta_nome: e.target.value })}
                                        className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-[#1F365C]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Grau de Risco</label>
                                    <select
                                        value={formConfig.grau_risco}
                                        onChange={e => setFormConfig({ ...formConfig, grau_risco: e.target.value })}
                                        className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-[#1F365C]"
                                    >
                                        <option value="baixo">Baixo (Carga Incêndio ≤ 300 MJ/m²)</option>
                                        <option value="medio">Médio (300 a 1200 MJ/m²)</option>
                                        <option value="alto">Alto (&gt; 1200 MJ/m²)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Pop. 1º Turno</label>
                                    <input
                                        type="number"
                                        value={formConfig.populacao_1_turno}
                                        onChange={e => setFormConfig({ ...formConfig, populacao_1_turno: parseInt(e.target.value) || 0 })}
                                        className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-[#1F365C]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Pop. 2º Turno</label>
                                    <input
                                        type="number"
                                        value={formConfig.populacao_2_turno}
                                        onChange={e => setFormConfig({ ...formConfig, populacao_2_turno: parseInt(e.target.value) || 0 })}
                                        className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-[#1F365C]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Pop. 3º Turno</label>
                                    <input
                                        type="number"
                                        value={formConfig.populacao_3_turno}
                                        onChange={e => setFormConfig({ ...formConfig, populacao_3_turno: parseInt(e.target.value) || 0 })}
                                        className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-[#1F365C]"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3 bg-amber-50 p-3 rounded-xl border border-amber-200">
                                <div>
                                    <label className="block text-[11px] font-bold text-amber-900 uppercase mb-1">Mín. Brig. 1º T</label>
                                    <input
                                        type="number"
                                        value={formConfig.minimo_brigadistas_1_turno}
                                        onChange={e => setFormConfig({ ...formConfig, minimo_brigadistas_1_turno: parseInt(e.target.value) || 0 })}
                                        className="w-full border border-amber-300 rounded-lg p-2 text-sm font-bold text-amber-900 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-amber-900 uppercase mb-1">Mín. Brig. 2º T</label>
                                    <input
                                        type="number"
                                        value={formConfig.minimo_brigadistas_2_turno}
                                        onChange={e => setFormConfig({ ...formConfig, minimo_brigadistas_2_turno: parseInt(e.target.value) || 0 })}
                                        className="w-full border border-amber-300 rounded-lg p-2 text-sm font-bold text-amber-900 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-amber-900 uppercase mb-1">Mín. Brig. 3º T</label>
                                    <input
                                        type="number"
                                        value={formConfig.minimo_brigadistas_3_turno}
                                        onChange={e => setFormConfig({ ...formConfig, minimo_brigadistas_3_turno: parseInt(e.target.value) || 0 })}
                                        className="w-full border border-amber-300 rounded-lg p-2 text-sm font-bold text-amber-900 focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Telefone Bombeiros</label>
                                    <input
                                        type="text"
                                        value={formConfig.contato_emergencia_bombeiros}
                                        onChange={e => setFormConfig({ ...formConfig, contato_emergencia_bombeiros: e.target.value })}
                                        className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-[#1F365C]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Contato SESMT / Plantão</label>
                                    <input
                                        type="text"
                                        value={formConfig.contato_emergencia_sesmt}
                                        onChange={e => setFormConfig({ ...formConfig, contato_emergencia_sesmt: e.target.value })}
                                        className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-[#1F365C]"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Ponto de Encontro Principal</label>
                                <input
                                    type="text"
                                    value={formConfig.ponto_encontro_principal}
                                    onChange={e => setFormConfig({ ...formConfig, ponto_encontro_principal: e.target.value })}
                                    className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-[#1F365C]"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Ponto de Encontro Secundário</label>
                                <input
                                    type="text"
                                    value={formConfig.ponto_encontro_secundario}
                                    onChange={e => setFormConfig({ ...formConfig, ponto_encontro_secundario: e.target.value })}
                                    className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-[#1F365C]"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t">
                                <button
                                    type="button"
                                    onClick={() => setShowModalConfig(false)}
                                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 text-sm bg-[#1F365C] hover:bg-slate-800 text-white rounded-lg font-bold shadow cursor-pointer"
                                >
                                    Salvar Parâmetros
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ======================================================== */}
            {/* MODAL: ZOOM / VISUALIZADOR DE FOTO */}
            {/* ======================================================== */}
            {fotoVisualizacaoUrl && (
                <div 
                    onClick={() => setFotoVisualizacaoUrl(null)} 
                    className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4 cursor-pointer backdrop-blur-sm"
                >
                    <div className="relative max-w-3xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden p-2 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setFotoVisualizacaoUrl(null)}
                            className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black text-white rounded-full transition-colors z-10 cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <img 
                            src={fotoVisualizacaoUrl} 
                            alt="Evidência Ampliada" 
                            className="w-full h-auto max-h-[85vh] object-contain rounded-xl"
                        />
                    </div>
                </div>
            )}

        </div>
    );
}
