import React, { useState, useEffect } from 'react';
import axios from 'axios';
import api from '../../services/api';
import { useDebounce } from '../../hooks/useDebounce';
// FEAT (IA): Motor Relatorios Lynxems
import { ReportGeneratorService } from '../../services/ReportGeneratorService';
import ReportExportButtons from '../../components/ReportExportButtons';
import {
    Users, Plus, Search, RefreshCw, CheckCircle2, AlertCircle,
    Building2, Phone, Mail, MapPin, CreditCard, ShieldAlert,
    Edit3, ExternalLink, Filter, X, Upload, Image as ImageIcon,
    Trash2, MapPinned, FileText, Check, AlertTriangle, Globe,
    Briefcase, DollarSign, Calendar, UserCheck, ChevronRight,
    User, Linkedin, Instagram, MessageCircle, Star, PhoneCall
} from 'lucide-react';

// =============================================================================
// HELPERS DE FORMATAÇÃO E VALIDAÇÃO (MÁSCARAS & ALGORITMOS)
// =============================================================================

// Validação CPF Módulo 11
function validarCPF(cpf) {
    cpf = String(cpf).replace(/\D/g, '');
    if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false;
    let soma = 0, resto;
    for (let i = 1; i <= 9; i++) soma += parseInt(cpf.substring(i - 1, i)) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.substring(9, 10))) return false;
    soma = 0;
    for (let i = 1; i <= 10; i++) soma += parseInt(cpf.substring(i - 1, i)) * (12 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    return resto === parseInt(cpf.substring(10, 11));
}

// Validação CNPJ Módulo 11
function validarCNPJ(cnpj) {
    cnpj = String(cnpj).replace(/\D/g, '');
    if (cnpj.length !== 14 || !!cnpj.match(/(\d)\1{13}/)) return false;
    let tamanho = cnpj.length - 2;
    let numeros = cnpj.substring(0, tamanho);
    let digitos = cnpj.substring(tamanho);
    let soma = 0, pos = tamanho - 7;
    for (let i = tamanho; i >= 1; i--) {
        soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
        if (pos < 2) pos = 9;
    }
    let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado !== parseInt(digitos.charAt(0))) return false;
    tamanho = tamanho + 1;
    numeros = cnpj.substring(0, tamanho);
    soma = 0;
    pos = tamanho - 7;
    for (let i = tamanho; i >= 1; i--) {
        soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
        if (pos < 2) pos = 9;
    }
    resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    return resultado === parseInt(digitos.charAt(1));
}

// Validação de formato de E-mail
function validarEmail(email) {
    if (!email || email.trim() === '') return true; // campo opcional
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
}

// Máscara dinâmica CPF (000.000.000-00)
function formatarCPF(cpf) {
    const digits = String(cpf || '').replace(/\D/g, '').slice(0, 11);
    return digits
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

// Máscara dinâmica CNPJ (00.000.000/0000-00)
function formatarCNPJ(cnpj) {
    const digits = String(cnpj || '').replace(/\D/g, '').slice(0, 14);
    return digits
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

// Máscara de Documento (CPF ou CNPJ)
function formatarDocumento(doc, tipo = 'J') {
    if (!doc) return '';
    const limpo = String(doc).replace(/\D/g, '');
    if (tipo === 'F' || limpo.length <= 11) {
        return formatarCPF(limpo);
    }
    return formatarCNPJ(limpo);
}

// Máscara de Telefone: (00) 0000-0000 ou (00) 00000-0000
function formatarTelefone(tel) {
    if (!tel) return '';
    const digits = String(tel).replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 10) {
        return digits
            .replace(/(\d{2})(\d)/, '($1) $2')
            .replace(/(\d{4})(\d{1,4})$/, '$1-$2');
    }
    return digits
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d{1,4})$/, '$1-$2');
}

// Máscara de CEP: 00000-000
function formatarCEP(cep) {
    if (!cep) return '';
    const digits = String(cep).replace(/\D/g, '').slice(0, 8);
    return digits.replace(/(\d{5})(\d{1,3})$/, '$1-$2');
}

// Formatação monetária BRL
function formatarMoeda(val) {
    if (val === null || val === undefined || isNaN(val)) return '-';
    return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Formatação de data AAAA-MM-DD para DD/MM/AAAA
function formatarData(dataStr) {
    if (!dataStr) return '-';
    const partes = String(dataStr).split('-');
    if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
    return dataStr;
}

export default function ErpClientesPage() {
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearch = useDebounce(searchTerm, 350);
    const [statusFilter, setStatusFilter] = useState('');

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState(null);
    const [modalError, setModalError] = useState(null);
    const [modalSuccess, setModalSuccess] = useState(null);
    const [saving, setSaving] = useState(false);
    const [searchingCnpj, setSearchingCnpj] = useState(false);
    const [activeTab, setActiveTab] = useState('dados'); // 'dados' | 'contatos' | 'receita' | 'enderecos'

    // Form state
    const initialForm = {
        codigo: '',
        loja: '01',
        tipo_pessoa: 'J',
        cnpj_cpf: '',
        razao_social: '',
        nome_fantasia: '',
        inscricao_estadual: '',
        endereco: '',
        bairro: '',
        cidade: '',
        uf: 'SP',
        cep: '',
        telefone: '',
        email: '',
        contato: '',
        condicao_pagamento_padrao: '30 DDL',
        status: 'ativo',
        logo_url: '',
        enderecos_adicionais: [],
        dados_receita: null,
        contatos: []
    };
    const [formData, setFormData] = useState(initialForm);

    const loadClientes = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/erp/clientes?search=${encodeURIComponent(debouncedSearch)}&limit=100`);
            setClientes(res.data || []);
        } catch (err) {
            console.error('Erro ao carregar clientes:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadClientes();
    }, [debouncedSearch]);

    // Validação em tempo real do documento
    const getDocValidation = () => {
        const limpo = (formData.cnpj_cpf || '').replace(/\D/g, '');
        if (!limpo) return null;
        if (formData.tipo_pessoa === 'F') {
            if (limpo.length === 11) {
                return validarCPF(limpo) ? { valid: true, text: 'CPF Válido' } : { valid: false, text: 'CPF Inválido' };
            }
            return { valid: false, text: `${limpo.length}/11 dígitos` };
        } else {
            if (limpo.length === 14) {
                return validarCNPJ(limpo) ? { valid: true, text: 'CNPJ Válido' } : { valid: false, text: 'CNPJ Inválido' };
            }
            return { valid: false, text: `${limpo.length}/14 dígitos` };
        }
    };

    const docValidation = getDocValidation();

    // Validação em tempo real do e-mail
    const emailValidation = (() => {
        if (!formData.email || formData.email.trim() === '') return null;
        const valido = validarEmail(formData.email);
        return {
            valid: valido,
            text: valido ? 'E-mail Válido' : 'E-mail Inválido'
        };
    })();

    // Consulta de CNPJ na BrasilAPI (com fallback direto ou proxy do backend)
    const handleConsultarCnpj = async (cnpjParam = null) => {
        const docAlvo = cnpjParam || formData.cnpj_cpf;
        const limpo = String(docAlvo || '').replace(/\D/g, '');
        if (limpo.length !== 14) {
            setModalError('Informe um CNPJ completo com 14 dígitos para consultar na Receita Federal.');
            return;
        }

        setSearchingCnpj(true);
        setModalError(null);

        try {
            let data = null;
            try {
                const res = await api.get(`/erp/cnpj/${limpo}`);
                data = res.data;
            } catch (backendErr) {
                const resDirect = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${limpo}`);
                data = resDirect.data;
            }

            if (!data) throw new Error('Não foi possível obter os dados da empresa');

            const tipoLogr = data.descricao_tipo_de_logradouro ? `${data.descricao_tipo_de_logradouro} ` : '';
            const logr = `${tipoLogr}${data.logradouro || ''}`;
            const num = data.numero ? `, ${data.numero}` : '';
            const compl = data.complemento ? ` - ${data.complemento}` : '';
            const enderecoCompleto = `${logr}${num}${compl}`.trim();

            let telEncontrado = '';
            if (data.ddd_telefone_1) {
                telEncontrado = formatarTelefone(data.ddd_telefone_1);
            } else if (data.ddd_telefone_2) {
                telEncontrado = formatarTelefone(data.ddd_telefone_2);
            }

            const statusCadastral = data.descricao_situacao_cadastral === 'ATIVA' ? 'ativo' : 'bloqueado';

            // Importar sócios da Receita para a lista de contatos caso ainda não haja contatos
            const contatosImportados = [...(formData.contatos || [])];
            if (Array.isArray(data.qsa) && contatosImportados.length === 0) {
                data.qsa.forEach((socio, idx) => {
                    contatosImportados.push({
                        id: Date.now() + idx,
                        nome: socio.nome_socio || '',
                        cargo: socio.qualificacao_socio || 'Sócio / Administrador',
                        departamento: 'Diretoria / Sócios',
                        email: data.email ? data.email.toLowerCase() : '',
                        telefone_1: telEncontrado,
                        telefone_2: '',
                        linkedin: '',
                        instagram: '',
                        foto_url: '',
                        principal: idx === 0,
                        observacoes: `Importado do Quadro Societário (QSA) - Faixa etária: ${socio.faixa_etaria || 'N/I'}`
                    });
                });
            }

            setFormData(prev => ({
                ...prev,
                tipo_pessoa: 'J',
                cnpj_cpf: formatarCNPJ(limpo),
                razao_social: data.razao_social || prev.razao_social,
                nome_fantasia: data.nome_fantasia || data.razao_social || prev.nome_fantasia,
                cep: formatarCEP(data.cep) || prev.cep,
                endereco: enderecoCompleto || prev.endereco,
                bairro: data.bairro || prev.bairro,
                cidade: data.municipio || prev.cidade,
                uf: data.uf || prev.uf,
                telefone: telEncontrado || prev.telefone,
                email: data.email ? data.email.toLowerCase() : prev.email,
                status: statusCadastral,
                dados_receita: data,
                contatos: contatosImportados
            }));

            setModalSuccess(`Dados de "${data.razao_social}" importados com sucesso da Receita Federal (BrasilAPI)!`);
        } catch (err) {
            console.error('Erro ao consultar CNPJ:', err);
            const msg = err.response?.data?.message || err.response?.data?.error || 'Não foi possível localizar os dados deste CNPJ na Receita Federal.';
            setModalError(`Consulta CNPJ: ${msg}`);
        } finally {
            setSearchingCnpj(false);
        }
    };

    // Autopreenchimento por CEP principal (ViaCEP)
    const handleCepBlur = async () => {
        const cepLimpo = (formData.cep || '').replace(/\D/g, '');
        if (cepLimpo.length === 8) {
            try {
                const res = await axios.get(`https://viacep.com.br/ws/${cepLimpo}/json/`);
                if (!res.data.erro) {
                    setFormData(prev => ({
                        ...prev,
                        endereco: res.data.logradouro || prev.endereco,
                        bairro: res.data.bairro || prev.bairro,
                        cidade: res.data.localidade || prev.cidade,
                        uf: res.data.uf || prev.uf
                    }));
                }
            } catch (err) {
                console.warn('Falha ao consultar CEP:', err);
            }
        }
    };

    // Autopreenchimento por CEP de endereço adicional (ViaCEP)
    const handleCepBlurAdicional = async (index) => {
        const item = formData.enderecos_adicionais[index];
        if (!item || !item.cep) return;
        const cepLimpo = item.cep.replace(/\D/g, '');
        if (cepLimpo.length === 8) {
            try {
                const res = await axios.get(`https://viacep.com.br/ws/${cepLimpo}/json/`);
                if (!res.data.erro) {
                    updateEnderecoAdicional(index, {
                        endereco: res.data.logradouro || item.endereco,
                        bairro: res.data.bairro || item.bairro,
                        cidade: res.data.localidade || item.cidade,
                        uf: res.data.uf || item.uf
                    });
                }
            } catch (err) {
                console.warn('Falha ao consultar CEP adicional:', err);
            }
        }
    };

    // Upload de Imagem de Logo da Empresa
    const handleLogoUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            setModalError('O arquivo de imagem deve ter no máximo 2MB.');
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            setFormData(prev => ({ ...prev, logo_url: event.target.result }));
        };
        reader.readAsDataURL(file);
    };

    // Upload de Foto de um Contato Específico
    const handleContatoFotoUpload = (index, e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            setModalError('A foto do contato deve ter no máximo 2MB.');
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            updateContato(index, { foto_url: event.target.result });
        };
        reader.readAsDataURL(file);
    };

    // Gerenciamento de Contatos da Empresa
    const addContato = () => {
        const novoContato = {
            id: Date.now(),
            nome: '',
            cargo: '',
            departamento: 'Comercial / Compras',
            email: '',
            telefone_1: '',
            telefone_2: '',
            linkedin: '',
            instagram: '',
            foto_url: '',
            principal: (formData.contatos || []).length === 0,
            observacoes: ''
        };
        setFormData(prev => ({
            ...prev,
            contatos: [...(prev.contatos || []), novoContato]
        }));
    };

    const removeContato = (index) => {
        setFormData(prev => ({
            ...prev,
            contatos: (prev.contatos || []).filter((_, i) => i !== index)
        }));
    };

    const updateContato = (index, updates) => {
        setFormData(prev => {
            const list = [...(prev.contatos || [])];
            list[index] = { ...list[index], ...updates };
            return { ...prev, contatos: list };
        });
    };

    const setContatoPrincipal = (index) => {
        setFormData(prev => {
            const list = (prev.contatos || []).map((c, i) => ({
                ...c,
                principal: i === index
            }));
            return { ...prev, contatos: list };
        });
    };

    // Gerenciamento de Endereços Adicionais
    const addEnderecoAdicional = () => {
        const novo = {
            id: Date.now(),
            tipo: 'Entrega',
            descricao: `Endereço de Entrega ${(formData.enderecos_adicionais || []).length + 1}`,
            cep: '',
            endereco: '',
            bairro: '',
            cidade: '',
            uf: 'SP',
            contato: ''
        };
        setFormData(prev => ({
            ...prev,
            enderecos_adicionais: [...(prev.enderecos_adicionais || []), novo]
        }));
    };

    const removeEnderecoAdicional = (index) => {
        setFormData(prev => ({
            ...prev,
            enderecos_adicionais: (prev.enderecos_adicionais || []).filter((_, i) => i !== index)
        }));
    };

    const updateEnderecoAdicional = (index, updates) => {
        setFormData(prev => {
            const list = [...(prev.enderecos_adicionais || [])];
            list[index] = { ...list[index], ...updates };
            return { ...prev, enderecos_adicionais: list };
        });
    };

    const handleOpenModal = async (cliente = null) => {
        setModalError(null);
        setModalSuccess(null);
        setActiveTab('dados');

        if (cliente) {
            setEditingClient(cliente);
            let ends = [];
            if (Array.isArray(cliente.enderecos_adicionais)) {
                ends = cliente.enderecos_adicionais;
            } else if (typeof cliente.enderecos_adicionais === 'string') {
                try {
                    ends = JSON.parse(cliente.enderecos_adicionais) || [];
                } catch {
                    ends = [];
                }
            }

            let receita = cliente.dados_receita;
            if (typeof receita === 'string') {
                try {
                    receita = JSON.parse(receita);
                } catch {
                    receita = null;
                }
            }

            let contatosList = [];
            if (Array.isArray(cliente.contatos)) {
                contatosList = cliente.contatos;
            } else if (typeof cliente.contatos === 'string') {
                try {
                    contatosList = JSON.parse(cliente.contatos) || [];
                } catch {
                    contatosList = [];
                }
            }

            setFormData({
                codigo: cliente.codigo || '',
                loja: cliente.loja || '01',
                tipo_pessoa: cliente.tipo_pessoa || (cliente.cnpj_cpf?.length === 11 ? 'F' : 'J'),
                cnpj_cpf: formatarDocumento(cliente.cnpj_cpf, cliente.tipo_pessoa),
                razao_social: cliente.razao_social || '',
                nome_fantasia: cliente.nome_fantasia || '',
                inscricao_estadual: cliente.inscricao_estadual || '',
                endereco: cliente.endereco || '',
                bairro: cliente.bairro || '',
                cidade: cliente.cidade || '',
                uf: cliente.uf || 'SP',
                cep: formatarCEP(cliente.cep),
                telefone: formatarTelefone(cliente.telefone),
                email: cliente.email || '',
                contato: cliente.contato || '',
                condicao_pagamento_padrao: cliente.condicao_pagamento_padrao || '30 DDL',
                status: cliente.status || 'ativo',
                logo_url: cliente.logo_url || '',
                enderecos_adicionais: ends,
                dados_receita: receita,
                contatos: contatosList
            });
            setIsModalOpen(true);
        } else {
            setEditingClient(null);
            let proximoCodigoAuto = '000001';
            try {
                const res = await api.get('/erp/clientes/proximo-codigo');
                if (res.data?.proximo_codigo) {
                    proximoCodigoAuto = res.data.proximo_codigo;
                }
            } catch (e) {
                console.warn('Falha ao obter próximo código:', e);
            }

            setFormData({
                ...initialForm,
                codigo: proximoCodigoAuto
            });
            setIsModalOpen(true);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setModalError(null);
        setModalSuccess(null);

        // Validação adicional de E-mail da empresa
        if (formData.email && !validarEmail(formData.email)) {
            setModalError('O formato do e-mail principal é inválido. Por favor informe um e-mail válido (ex: contato@empresa.com.br).');
            setSaving(false);
            return;
        }

        // Validação de E-mail nos contatos
        for (const [idx, c] of (formData.contatos || []).entries()) {
            if (c.email && !validarEmail(c.email)) {
                setModalError(`O e-mail do contato ${c.nome || '#' + (idx + 1)} possui formato inválido.`);
                setSaving(false);
                return;
            }
        }

        try {
            if (editingClient) {
                await api.put(`/erp/clientes/${editingClient.codigo}`, formData);
                setModalSuccess('Cliente atualizado com sucesso!');
            } else {
                const res = await api.post('/erp/clientes', formData);
                setModalSuccess(res.data.message || 'Cliente cadastrado com sucesso!');
            }
            setTimeout(() => {
                setIsModalOpen(false);
                loadClientes();
            }, 900);
        } catch (err) {
            const msg = err.response?.data?.error || err.response?.data?.erros?.join(', ') || err.message;
            setModalError(msg);
        } finally {
            setSaving(false);
        }
    };

    const filteredClientes = clientes.filter(c => {
        if (!statusFilter) return true;
        return c.status === statusFilter;
    });

    // FEAT (IA): Motor Relatorios Lynxems
    const handleExportExcel = async () => {
        const columns = [
            { header: 'Código', key: 'codigo', width: 12, align: 'center' },
            { header: 'Loja', key: 'loja', width: 8, align: 'center' },
            { header: 'Razão Social', key: 'razao_social', width: 35, align: 'left' },
            { header: 'Nome Fantasia', key: 'nome_fantasia', width: 25, align: 'left' },
            { header: 'CNPJ / CPF', key: 'cnpj_cpf', width: 20, align: 'center' },
            { header: 'Cidade / UF', key: 'cidade_uf', width: 22, align: 'left' },
            { header: 'Telefone', key: 'telefone', width: 18, align: 'center' },
            { header: 'E-mail', key: 'email', width: 28, align: 'left' },
            { header: 'Status', key: 'status', width: 12, align: 'center' }
        ];

        const data = filteredClientes.map(c => ({
            codigo: c.codigo || '-',
            loja: c.loja || '01',
            razao_social: c.razao_social || '-',
            nome_fantasia: c.nome_fantasia || '-',
            cnpj_cpf: formatarDocumento(c.cnpj_cpf, c.tipo_pessoa) || c.cnpj_cpf || '-',
            cidade_uf: `${c.cidade || '-'}/${c.uf || '-'}`,
            telefone: formatarTelefone(c.telefone) || c.telefone || '-',
            email: c.email || '-',
            status: (c.status || 'ativo').toUpperCase()
        }));

        await ReportGeneratorService.exportExcel({
            title: 'Relatório Cadastral de Clientes',
            subtitle: `Base de Clientes ERP - Total: ${data.length} registro(s)`,
            columns,
            data,
            fileName: `relatorio_clientes_${new Date().toISOString().slice(0, 10)}.xlsx`
        });
    };

    const handleExportPdf = async () => {
        const columns = [
            { header: 'Código', key: 'codigo', width: 15, align: 'center' },
            { header: 'Razão Social', key: 'razao_social', width: 45, align: 'left' },
            { header: 'CNPJ / CPF', key: 'cnpj_cpf', width: 25, align: 'center' },
            { header: 'Cidade/UF', key: 'cidade_uf', width: 25, align: 'left' },
            { header: 'Telefone', key: 'telefone', width: 22, align: 'center' },
            { header: 'Status', key: 'status', width: 15, align: 'center' }
        ];

        const data = filteredClientes.map(c => ({
            codigo: c.codigo || '-',
            razao_social: c.razao_social || '-',
            cnpj_cpf: formatarDocumento(c.cnpj_cpf, c.tipo_pessoa) || c.cnpj_cpf || '-',
            cidade_uf: `${c.cidade || '-'}/${c.uf || '-'}`,
            telefone: formatarTelefone(c.telefone) || c.telefone || '-',
            status: (c.status || 'ativo').toUpperCase()
        }));

        await ReportGeneratorService.exportPdf({
            title: 'Relatório Cadastral de Clientes',
            subtitle: `Base de Clientes ERP - Total: ${data.length} cliente(s)`,
            columns,
            data,
            orientation: 'landscape',
            fileName: `relatorio_clientes_${new Date().toISOString().slice(0, 10)}.pdf`
        });
    };

    return (
        <div className="space-y-4 p-2 md:p-4 font-sans text-gray-900">
            {/* Top Bar Header Container */}
            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-600">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">Cadastro de Clientes</h1>
                            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                ERP Nativo
                            </span>
                        </div>
                        <p className="text-xs md:text-sm text-gray-500 mt-0.5">
                            Gestão cadastral com integração BrasilAPI (Receita Federal), múltiplos contatos com fotos e redes sociais, código sequencial de 6 dígitos e múltiplos endereços.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {/* FEAT (IA): Motor Relatorios Lynxems */}
                    <ReportExportButtons
                        onExportExcel={handleExportExcel}
                        onExportPdf={handleExportPdf}
                        disabled={loading || filteredClientes.length === 0}
                    />
                    <button
                        onClick={() => handleOpenModal()}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Novo Cliente
                    </button>
                    <button
                        onClick={loadClientes}
                        disabled={loading}
                        className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900 transition shadow-sm"
                        title="Atualizar lista"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Quick Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                        <Users className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total de Clientes</span>
                        <p className="text-xl font-bold text-gray-900 mt-0.5">{clientes.length.toLocaleString('pt-BR')}</p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
                        <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Clientes Ativos</span>
                        <p className="text-xl font-bold text-emerald-600 mt-0.5">
                            {clientes.filter(c => c.status === 'ativo' || !c.status).length.toLocaleString('pt-BR')}
                        </p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center gap-3">
                    <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
                        <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Bloqueados</span>
                        <p className="text-xl font-bold text-amber-600 mt-0.5">
                            {clientes.filter(c => c.status === 'bloqueado').length.toLocaleString('pt-BR')}
                        </p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center gap-3">
                    <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg">
                        <X className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Inativos</span>
                        <p className="text-xl font-bold text-rose-600 mt-0.5">
                            {clientes.filter(c => c.status === 'inativo').length.toLocaleString('pt-BR')}
                        </p>
                    </div>
                </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Buscar por Razão Social, Nome Fantasia, CNPJ/CPF, Código ou Cidade..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-lg pl-10 pr-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">Todos os Status</option>
                    <option value="ativo">Ativos</option>
                    <option value="bloqueado">Bloqueados</option>
                    <option value="inativo">Inativos</option>
                </select>
            </div>

            {/* Clientes Table Container */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold uppercase tracking-wider text-gray-600">
                            <tr>
                                <th className="py-3 px-4">Código / Loja</th>
                                <th className="py-3 px-4">Cliente / Razão Social</th>
                                <th className="py-3 px-4">CNPJ / CPF</th>
                                <th className="py-3 px-4">Endereços</th>
                                <th className="py-3 px-4">Contatos / Comunicação</th>
                                <th className="py-3 px-4">Cond. Pagto</th>
                                <th className="py-3 px-4">Status</th>
                                <th className="py-3 px-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="8" className="py-12 text-center text-gray-500">
                                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                                        Carregando base de clientes do ERP...
                                    </td>
                                </tr>
                            ) : filteredClientes.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="py-12 text-center text-gray-500">
                                        Nenhum cliente encontrado com os filtros informados.
                                    </td>
                                </tr>
                            ) : (
                                filteredClientes.map((c) => {
                                    let qtdEndsAdicionais = 0;
                                    if (Array.isArray(c.enderecos_adicionais)) {
                                        qtdEndsAdicionais = c.enderecos_adicionais.length;
                                    } else if (typeof c.enderecos_adicionais === 'string') {
                                        try {
                                            qtdEndsAdicionais = JSON.parse(c.enderecos_adicionais).length;
                                        } catch { }
                                    }

                                    let listaContatos = [];
                                    if (Array.isArray(c.contatos)) {
                                        listaContatos = c.contatos;
                                    } else if (typeof c.contatos === 'string') {
                                        try {
                                            listaContatos = JSON.parse(c.contatos) || [];
                                        } catch { }
                                    }
                                    const contatoPrincipal = listaContatos.find(ct => ct.principal) || listaContatos[0];

                                    return (
                                        <tr key={c.id || c.codigo} className="hover:bg-gray-50/80 transition">
                                            <td className="py-3.5 px-4 font-mono font-bold text-blue-700">
                                                {c.codigo} <span className="text-xs text-gray-400 font-normal">/{c.loja || '01'}</span>
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <div className="flex items-center gap-3">
                                                    {c.logo_url ? (
                                                        <img
                                                            src={c.logo_url}
                                                            alt={c.razao_social}
                                                            className="w-9 h-9 rounded-lg object-contain bg-white border border-gray-200 p-0.5 shrink-0 shadow-xs"
                                                        />
                                                    ) : (
                                                        <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                                                            {(c.razao_social || 'C').charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div className="font-semibold text-gray-900 leading-tight flex items-center gap-1.5">
                                                            {c.razao_social}
                                                            {c.dados_receita && (
                                                                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200" title="Dados da Receita Federal vinculados">
                                                                    RF
                                                                </span>
                                                            )}
                                                        </div>
                                                        {c.nome_fantasia && (
                                                            <div className="text-xs text-gray-500">{c.nome_fantasia}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-4 font-mono text-xs text-gray-600">
                                                {formatarDocumento(c.cnpj_cpf, c.tipo_pessoa) || '-'}
                                            </td>
                                            <td className="py-3.5 px-4 text-xs text-gray-600">
                                                <div>{c.cidade ? `${c.cidade} - ${c.uf}` : '-'}</div>
                                                {qtdEndsAdicionais > 0 && (
                                                    <span className="inline-flex items-center gap-1 mt-0.5 text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded">
                                                        <MapPinned className="w-3 h-3" />
                                                        +{qtdEndsAdicionais} {qtdEndsAdicionais === 1 ? 'entrega' : 'entregas'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3.5 px-4 text-xs text-gray-600">
                                                {contatoPrincipal ? (
                                                    <div className="space-y-0.5">
                                                        <div className="font-semibold text-gray-800 flex items-center gap-1">
                                                            <User className="w-3 h-3 text-blue-600 shrink-0" />
                                                            <span>{contatoPrincipal.nome}</span>
                                                            {listaContatos.length > 1 && (
                                                                <span className="text-[10px] bg-gray-100 text-gray-600 px-1 rounded">
                                                                    +{listaContatos.length - 1}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {contatoPrincipal.telefone_1 && (
                                                            <div>{formatarTelefone(contatoPrincipal.telefone_1)}</div>
                                                        )}
                                                        {contatoPrincipal.email && (
                                                            <div className="text-gray-400 truncate max-w-[170px]">{contatoPrincipal.email}</div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div>
                                                        {c.telefone && <div>{formatarTelefone(c.telefone)}</div>}
                                                        {c.email && <div className="text-gray-400 truncate max-w-[170px]">{c.email}</div>}
                                                        {!c.telefone && !c.email && '-'}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-3.5 px-4 text-xs font-mono text-gray-600">
                                                {c.condicao_pagamento_padrao || '30 DDL'}
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                                    c.status === 'inativo' ? 'bg-red-50 text-red-700 border border-red-200' :
                                                    c.status === 'bloqueado' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                                    'bg-green-50 text-green-700 border border-green-200'
                                                }`}>
                                                    {c.status || 'ativo'}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4 text-right">
                                                <button
                                                    onClick={() => handleOpenModal(c)}
                                                    className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-lg transition"
                                                    title="Editar Cliente"
                                                >
                                                    <Edit3 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Cadastro / Edição */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-4xl overflow-hidden my-8">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                    <Building2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-base font-bold text-gray-900">
                                            {editingClient ? `Editar Cliente: ${editingClient.codigo}` : 'Novo Cliente'}
                                        </h2>
                                        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-100 text-blue-700 border border-blue-200">
                                            Código: {formData.codigo || '000001'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        Código de 6 dígitos automático com integração à Receita Federal e múltiplos contatos
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Tabs */}
                        <div className="flex border-b border-gray-200 bg-white px-6 pt-2">
                            <button
                                type="button"
                                onClick={() => setActiveTab('dados')}
                                className={`pb-3 px-4 text-sm font-semibold border-b-2 transition ${
                                    activeTab === 'dados'
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                Dados Cadastrais
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('contatos')}
                                className={`pb-3 px-4 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
                                    activeTab === 'contatos'
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                Contatos da Empresa
                                {(formData.contatos || []).length > 0 && (
                                    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.2 rounded-full font-bold">
                                        {(formData.contatos || []).length}
                                    </span>
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('receita')}
                                className={`pb-3 px-4 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
                                    activeTab === 'receita'
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                Dossiê BrasilAPI / Receita Federal
                                {formData.dados_receita && (
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('enderecos')}
                                className={`pb-3 px-4 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
                                    activeTab === 'enderecos'
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                Endereços de Entrega
                                {(formData.enderecos_adicionais || []).length > 0 && (
                                    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.2 rounded-full font-bold">
                                        {(formData.enderecos_adicionais || []).length}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Modal Form */}
                        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                            {modalError && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>{modalError}</span>
                                </div>
                            )}

                            {modalSuccess && (
                                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700 flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                                    <span>{modalSuccess}</span>
                                </div>
                            )}

                            {activeTab === 'dados' && (
                                <div className="space-y-4">
                                    {/* Logo do Cliente Upload / URL */}
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col md:flex-row items-center gap-4">
                                        <div className="relative group shrink-0">
                                            {formData.logo_url ? (
                                                <div className="relative">
                                                    <img
                                                        src={formData.logo_url}
                                                        alt="Logo Preview"
                                                        className="w-20 h-20 rounded-xl object-contain bg-white border border-gray-300 p-1 shadow-sm"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, logo_url: '' })}
                                                        className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition shadow"
                                                        title="Remover logotipo"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 bg-white flex flex-col items-center justify-center text-gray-400">
                                                    <ImageIcon className="w-6 h-6 mb-1 text-gray-400" />
                                                    <span className="text-[10px] font-semibold">Sem Logo</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 w-full space-y-2">
                                            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                Logotipo da Empresa (URL ou Upload de Imagem)
                                            </label>
                                            <div className="flex flex-col sm:flex-row items-center gap-2">
                                                <input
                                                    type="url"
                                                    placeholder="Cole a URL da imagem (https://.../logo.png)"
                                                    value={formData.logo_url}
                                                    onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                                                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                                <label className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-lg cursor-pointer transition shadow-sm">
                                                    <Upload className="w-4 h-4 text-blue-600" />
                                                    Upload Imagem
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={handleLogoUpload}
                                                        className="hidden"
                                                    />
                                                </label>
                                            </div>
                                            <p className="text-[11px] text-gray-500">
                                                Formatos suportados: PNG, JPG, SVG, WebP (até 2MB). O logotipo será exibido nas listagens e propostas.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Linha 1: Código Sequencial 6 dígitos, Tipo de Pessoa, CNPJ/CPF com Consulta BrasilAPI */}
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                                        <div className="md:col-span-3">
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                                    Código (6 Dígitos)
                                                </label>
                                                <span className="text-[10px] text-blue-600 font-semibold">Automático</span>
                                            </div>
                                            <input
                                                type="text"
                                                readOnly
                                                disabled
                                                value={formData.codigo || '000001'}
                                                className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 font-mono font-bold cursor-not-allowed select-all"
                                            />
                                        </div>

                                        <div className="md:col-span-3">
                                            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                                Tipo de Pessoa
                                            </label>
                                            <select
                                                value={formData.tipo_pessoa}
                                                onChange={(e) => {
                                                    const novoTipo = e.target.value;
                                                    setFormData({
                                                        ...formData,
                                                        tipo_pessoa: novoTipo,
                                                        cnpj_cpf: formatarDocumento(formData.cnpj_cpf, novoTipo)
                                                    });
                                                }}
                                                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="J">Jurídica (CNPJ)</option>
                                                <option value="F">Física (CPF)</option>
                                            </select>
                                        </div>

                                        <div className="md:col-span-6">
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                                    {formData.tipo_pessoa === 'J' ? 'CNPJ' : 'CPF'}
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    {docValidation && (
                                                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                                                            docValidation.valid ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                                                        }`}>
                                                            {docValidation.text}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    placeholder={formData.tipo_pessoa === 'J' ? '00.000.000/0000-00' : '000.000.000-00'}
                                                    value={formData.cnpj_cpf}
                                                    onChange={(e) => {
                                                        const formatado = formatarDocumento(e.target.value, formData.tipo_pessoa);
                                                        setFormData({ ...formData, cnpj_cpf: formatado });
                                                    }}
                                                    className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                                {formData.tipo_pessoa === 'J' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleConsultarCnpj()}
                                                        disabled={searchingCnpj}
                                                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-sm shrink-0 disabled:opacity-50"
                                                        title="Buscar Razão Social, Nome Fantasia, Endereço e Dados Cadastrais na BrasilAPI"
                                                    >
                                                        {searchingCnpj ? (
                                                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                        ) : (
                                                            <Globe className="w-3.5 h-3.5" />
                                                        )}
                                                        {searchingCnpj ? 'Buscando...' : 'BrasilAPI'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Linha 2: Razão Social, Nome Fantasia */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                                Razão Social *
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="Nome empresarial completo"
                                                value={formData.razao_social}
                                                onChange={(e) => setFormData({ ...formData, razao_social: e.target.value })}
                                                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                                Nome Fantasia
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Nome comercial do cliente"
                                                value={formData.nome_fantasia}
                                                onChange={(e) => setFormData({ ...formData, nome_fantasia: e.target.value })}
                                                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>

                                    {/* Linha 3: Inscrição Estadual, Telefone Geral, E-mail Geral */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                                Inscrição Estadual (IE)
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Ex: 123456789 ou ISENTO"
                                                value={formData.inscricao_estadual}
                                                onChange={(e) => setFormData({ ...formData, inscricao_estadual: e.target.value })}
                                                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                                Telefone Geral / Empresa
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="(00) 00000-0000"
                                                value={formData.telefone}
                                                onChange={(e) => {
                                                    const formatado = formatarTelefone(e.target.value);
                                                    setFormData({ ...formData, telefone: formatado });
                                                }}
                                                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                                            />
                                        </div>

                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                                    E-mail Geral / Faturamento
                                                </label>
                                                {emailValidation && (
                                                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                                                        emailValidation.valid ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                                                    }`}>
                                                        {emailValidation.text}
                                                    </span>
                                                )}
                                            </div>
                                            <input
                                                type="email"
                                                placeholder="financeiro@cliente.com.br"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>

                                    {/* Linha 4: Endereço Principal / Faturamento */}
                                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                                        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-gray-700">
                                            <span className="flex items-center gap-2">
                                                <MapPin className="w-4 h-4 text-blue-600" />
                                                Endereço Principal / Faturamento
                                            </span>
                                            <span className="text-[11px] text-gray-400 font-normal lowercase">
                                                preenchimento automático via CEP ou BrasilAPI
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                                    CEP (Autocompleta)
                                                </label>
                                                <input
                                                    type="text"
                                                    placeholder="00000-000"
                                                    value={formData.cep}
                                                    onBlur={handleCepBlur}
                                                    onChange={(e) => {
                                                        const formatado = formatarCEP(e.target.value);
                                                        setFormData({ ...formData, cep: formatado });
                                                    }}
                                                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>

                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                                    Logradouro / Número
                                                </label>
                                                <input
                                                    type="text"
                                                    placeholder="Rua, Avenida, Número..."
                                                    value={formData.endereco}
                                                    onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                                                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                                    Bairro
                                                </label>
                                                <input
                                                    type="text"
                                                    placeholder="Bairro"
                                                    value={formData.bairro}
                                                    onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                                                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                                    Cidade
                                                </label>
                                                <input
                                                    type="text"
                                                    placeholder="Cidade"
                                                    value={formData.cidade}
                                                    onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                                                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                                    UF
                                                </label>
                                                <input
                                                    type="text"
                                                    maxLength="2"
                                                    placeholder="SP"
                                                    value={formData.uf}
                                                    onChange={(e) => setFormData({ ...formData, uf: e.target.value.toUpperCase() })}
                                                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Linha 5: Condições Comerciais e Status */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                                Condição Pagto Padrão
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Ex: 30 DDL, A VISTA"
                                                value={formData.condicao_pagamento_padrao}
                                                onChange={(e) => setFormData({ ...formData, condicao_pagamento_padrao: e.target.value })}
                                                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                                Situação do Cliente
                                            </label>
                                            <select
                                                value={formData.status}
                                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="ativo">Ativo (Habilitado para pedidos)</option>
                                                <option value="bloqueado">Bloqueado (Restrição financeira)</option>
                                                <option value="inativo">Inativo (Desativado)</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB CONTATOS DA EMPRESA (MÚLTIPLOS CONTATOS, FOTOS, REDES SOCIAIS) */}
                            {activeTab === 'contatos' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between bg-blue-50 border border-blue-200 p-3.5 rounded-xl">
                                        <div className="flex items-center gap-2.5 text-blue-900">
                                            <Users className="w-5 h-5 text-blue-600 shrink-0" />
                                            <div>
                                                <p className="text-sm font-bold">Gestão de Contatos da Empresa</p>
                                                <p className="text-xs text-blue-700">
                                                    Cadastre múltiplos contatos (Compras, Financeiro, Diretoria, PCP, Engenharia), telefones, fotos e perfis sociais.
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={addContato}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-sm shrink-0"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            Novo Contato
                                        </button>
                                    </div>

                                    {(!formData.contatos || formData.contatos.length === 0) ? (
                                        <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                                            <User className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                            <p className="text-sm font-semibold text-gray-700">Nenhum contato cadastrado para este cliente</p>
                                            <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                                                Adicione contatos para vincular diretores, compradores, engenheiros ou responsáveis de faturamento da empresa.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={addContato}
                                                className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 border border-blue-300 text-blue-700 hover:bg-blue-50 rounded-lg text-xs font-semibold transition"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                                Adicionar Primeiro Contato
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-3.5">
                                            {formData.contatos.map((contato, idx) => (
                                                <div
                                                    key={contato.id || idx}
                                                    className={`p-4 bg-white border rounded-xl shadow-xs space-y-3 transition ${
                                                        contato.principal ? 'border-blue-400 ring-1 ring-blue-200' : 'border-gray-200 hover:border-gray-300'
                                                    }`}
                                                >
                                                    {/* Header do Contato */}
                                                    <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => setContatoPrincipal(idx)}
                                                                className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full transition ${
                                                                    contato.principal
                                                                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                                                        : 'bg-gray-100 text-gray-600 hover:bg-amber-50 hover:text-amber-700'
                                                                }`}
                                                                title="Clique para definir como contato principal da empresa"
                                                            >
                                                                <Star className={`w-3.5 h-3.5 ${contato.principal ? 'fill-amber-500 text-amber-500' : ''}`} />
                                                                {contato.principal ? 'Contato Principal' : 'Definir Principal'}
                                                            </button>
                                                            <span className="text-xs font-bold text-gray-700">
                                                                {contato.nome || `Contato #${idx + 1}`}
                                                            </span>
                                                        </div>

                                                        <button
                                                            type="button"
                                                            onClick={() => removeContato(idx)}
                                                            className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50 transition"
                                                            title="Excluir este contato"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>

                                                    {/* Corpo do Contato: Foto + Campos */}
                                                    <div className="flex flex-col sm:flex-row gap-4">
                                                        {/* Avatar / Foto do Contato */}
                                                        <div className="flex flex-col items-center gap-1.5 shrink-0">
                                                            {contato.foto_url ? (
                                                                <div className="relative group">
                                                                    <img
                                                                        src={contato.foto_url}
                                                                        alt={contato.nome}
                                                                        className="w-16 h-16 rounded-full object-cover border-2 border-blue-200 shadow-xs"
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => updateContato(idx, { foto_url: '' })}
                                                                        className="absolute -top-1 -right-1 bg-red-500 text-white p-0.5 rounded-full hover:bg-red-600 transition shadow"
                                                                        title="Remover foto"
                                                                    >
                                                                        <X className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div className="w-16 h-16 rounded-full bg-blue-50 border-2 border-dashed border-blue-200 flex flex-col items-center justify-center text-blue-500">
                                                                    <User className="w-6 h-6" />
                                                                    <span className="text-[9px] font-semibold text-gray-400 mt-0.5">Sem Foto</span>
                                                                </div>
                                                            )}
                                                            <label className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 cursor-pointer flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                                                <Upload className="w-3 h-3" />
                                                                Foto
                                                                <input
                                                                    type="file"
                                                                    accept="image/*"
                                                                    onChange={(e) => handleContatoFotoUpload(idx, e)}
                                                                    className="hidden"
                                                                />
                                                            </label>
                                                        </div>

                                                        {/* Campos de Dados do Contato */}
                                                        <div className="flex-1 space-y-3">
                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                                                                <div>
                                                                    <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">
                                                                        Nome Completo *
                                                                    </label>
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Nome do contato"
                                                                        value={contato.nome || ''}
                                                                        onChange={(e) => updateContato(idx, { nome: e.target.value })}
                                                                        className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                    />
                                                                </div>

                                                                <div>
                                                                    <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">
                                                                        Cargo / Função
                                                                    </label>
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Ex: Gerente de Compras"
                                                                        value={contato.cargo || ''}
                                                                        onChange={(e) => updateContato(idx, { cargo: e.target.value })}
                                                                        className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                    />
                                                                </div>

                                                                <div>
                                                                    <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">
                                                                        Departamento
                                                                    </label>
                                                                    <select
                                                                        value={contato.departamento || 'Comercial / Compras'}
                                                                        onChange={(e) => updateContato(idx, { departamento: e.target.value })}
                                                                        className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                    >
                                                                        <option value="Comercial / Compras">Comercial / Compras</option>
                                                                        <option value="Financeiro / Contábil">Financeiro / Contábil</option>
                                                                        <option value="Diretoria / Sócios">Diretoria / Sócios</option>
                                                                        <option value="Engenharia / Projetos">Engenharia / Projetos</option>
                                                                        <option value="PCP / Produção">PCP / Produção</option>
                                                                        <option value="Logística / Expedição">Logística / Expedição</option>
                                                                        <option value="Qualidade / SGQ">Qualidade / SGQ</option>
                                                                        <option value="Outro">Outro</option>
                                                                    </select>
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                                                                <div>
                                                                    <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">
                                                                        E-mail Direto
                                                                    </label>
                                                                    <input
                                                                        type="email"
                                                                        placeholder="contato@cliente.com.br"
                                                                        value={contato.email || ''}
                                                                        onChange={(e) => updateContato(idx, { email: e.target.value })}
                                                                        className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                    />
                                                                </div>

                                                                <div>
                                                                    <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">
                                                                        Telefone 1 (Celular/WhatsApp)
                                                                    </label>
                                                                    <div className="flex gap-1.5">
                                                                        <input
                                                                            type="text"
                                                                            placeholder="(00) 00000-0000"
                                                                            value={contato.telefone_1 || ''}
                                                                            onChange={(e) => updateContato(idx, { telefone_1: formatarTelefone(e.target.value) })}
                                                                            className="flex-1 bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                        />
                                                                        {contato.telefone_1 && (
                                                                            <a
                                                                                href={`https://wa.me/55${String(contato.telefone_1).replace(/\D/g, '')}`}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg border border-emerald-200 flex items-center justify-center shrink-0"
                                                                                title="Abrir conversa no WhatsApp"
                                                                            >
                                                                                <MessageCircle className="w-3.5 h-3.5" />
                                                                            </a>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                <div>
                                                                    <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">
                                                                        Telefone 2 (Fixo/Ramal)
                                                                    </label>
                                                                    <input
                                                                        type="text"
                                                                        placeholder="(00) 0000-0000 R. 12"
                                                                        value={contato.telefone_2 || ''}
                                                                        onChange={(e) => updateContato(idx, { telefone_2: e.target.value })}
                                                                        className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                    />
                                                                </div>
                                                            </div>

                                                            {/* Redes Sociais do Contato (LinkedIn, Instagram) */}
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="p-1.5 bg-blue-50 text-blue-700 rounded-md border border-blue-200 shrink-0">
                                                                        <Linkedin className="w-3.5 h-3.5" />
                                                                    </div>
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Perfil LinkedIn (ex: linkedin.com/in/...)"
                                                                        value={contato.linkedin || ''}
                                                                        onChange={(e) => updateContato(idx, { linkedin: e.target.value })}
                                                                        className="flex-1 bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                    />
                                                                </div>

                                                                <div className="flex items-center gap-2">
                                                                    <div className="p-1.5 bg-pink-50 text-pink-700 rounded-md border border-pink-200 shrink-0">
                                                                        <Instagram className="w-3.5 h-3.5" />
                                                                    </div>
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Instagram (ex: @usuario)"
                                                                        value={contato.instagram || ''}
                                                                        onChange={(e) => updateContato(idx, { instagram: e.target.value })}
                                                                        className="flex-1 bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB DOSSIÊ BRASILAPI / RECEITA FEDERAL */}
                            {activeTab === 'receita' && (
                                <div className="space-y-4">
                                    {!formData.dados_receita ? (
                                        <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                                            <Globe className="w-10 h-10 text-emerald-600 mx-auto mb-2 opacity-80" />
                                            <p className="text-base font-bold text-gray-800">Dossiê da Receita Federal Não Carregado</p>
                                            <p className="text-xs text-gray-500 max-w-md mx-auto mt-1">
                                                Preencha o CNPJ na aba principal e clique no botão <strong>"BrasilAPI"</strong> para importar automaticamente todos os dados societários, capital social, CNAEs e situação cadastral.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => handleConsultarCnpj()}
                                                disabled={searchingCnpj || !formData.cnpj_cpf}
                                                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition shadow-sm disabled:opacity-50"
                                            >
                                                {searchingCnpj ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                                                {searchingCnpj ? 'Consultando BrasilAPI...' : 'Consultar CNPJ Agora'}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {/* Header com Situação e Porte */}
                                            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                                                            Receita Federal do Brasil
                                                        </span>
                                                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-600 text-white">
                                                            {formData.dados_receita.descricao_situacao_cadastral || 'ATIVA'}
                                                        </span>
                                                        {formData.dados_receita.porte && (
                                                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-white text-emerald-800 border border-emerald-300">
                                                                Porte: {formData.dados_receita.porte}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm font-bold text-gray-900">
                                                        {formData.dados_receita.razao_social}
                                                    </p>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => handleConsultarCnpj()}
                                                    disabled={searchingCnpj}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-semibold transition shrink-0"
                                                >
                                                    <RefreshCw className={`w-3.5 h-3.5 ${searchingCnpj ? 'animate-spin' : ''}`} />
                                                    Reconsultar
                                                </button>
                                            </div>

                                            {/* Indicadores em Grid */}
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                <div className="p-3 bg-white border border-gray-200 rounded-xl shadow-xs">
                                                    <span className="text-[11px] font-semibold text-gray-500 uppercase block">Data de Abertura</span>
                                                    <span className="text-sm font-bold text-gray-900 mt-0.5 block flex items-center gap-1.5">
                                                        <Calendar className="w-3.5 h-3.5 text-blue-600" />
                                                        {formatarData(formData.dados_receita.data_inicio_atividade)}
                                                    </span>
                                                </div>

                                                <div className="p-3 bg-white border border-gray-200 rounded-xl shadow-xs">
                                                    <span className="text-[11px] font-semibold text-gray-500 uppercase block">Capital Social</span>
                                                    <span className="text-sm font-bold text-emerald-700 mt-0.5 block flex items-center gap-1.5">
                                                        <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                                                        {formatarMoeda(formData.dados_receita.capital_social)}
                                                    </span>
                                                </div>

                                                <div className="p-3 bg-white border border-gray-200 rounded-xl shadow-xs">
                                                    <span className="text-[11px] font-semibold text-gray-500 uppercase block">Simples Nacional</span>
                                                    <span className={`text-sm font-bold mt-0.5 block ${formData.dados_receita.opcao_pelo_simples ? 'text-emerald-600' : 'text-gray-700'}`}>
                                                        {formData.dados_receita.opcao_pelo_simples ? 'SIM' : 'NÃO'}
                                                    </span>
                                                </div>

                                                <div className="p-3 bg-white border border-gray-200 rounded-xl shadow-xs">
                                                    <span className="text-[11px] font-semibold text-gray-500 uppercase block">MEI</span>
                                                    <span className={`text-sm font-bold mt-0.5 block ${formData.dados_receita.opcao_pelo_mei ? 'text-emerald-600' : 'text-gray-700'}`}>
                                                        {formData.dados_receita.opcao_pelo_mei ? 'SIM' : 'NÃO'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Natureza Jurídica & CNAE Principal */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-1">
                                                    <span className="text-xs font-bold text-gray-600 uppercase flex items-center gap-1.5">
                                                        <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                                                        Natureza Jurídica
                                                    </span>
                                                    <p className="text-xs font-semibold text-gray-800">
                                                        {formData.dados_receita.natureza_juridica || 'Não informada'}
                                                    </p>
                                                </div>

                                                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-1">
                                                    <span className="text-xs font-bold text-gray-600 uppercase flex items-center gap-1.5">
                                                        <FileText className="w-3.5 h-3.5 text-blue-600" />
                                                        Atividade Principal (CNAE)
                                                    </span>
                                                    <p className="text-xs font-semibold text-gray-800">
                                                        {formData.dados_receita.cnae_fiscal ? `${formData.dados_receita.cnae_fiscal} - ` : ''}
                                                        {formData.dados_receita.cnae_fiscal_descricao || 'Não informada'}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Quadro de Sócios e Administradores (QSA) */}
                                            {Array.isArray(formData.dados_receita.qsa) && formData.dados_receita.qsa.length > 0 && (
                                                <div className="p-4 bg-white border border-gray-200 rounded-xl space-y-3">
                                                    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                                        <span className="text-xs font-bold text-gray-700 uppercase flex items-center gap-1.5">
                                                            <UserCheck className="w-4 h-4 text-blue-600" />
                                                            Quadro de Sócios e Administradores (QSA)
                                                        </span>
                                                        <span className="text-xs text-gray-400">
                                                            {formData.dados_receita.qsa.length} sócio(s) registrado(s)
                                                        </span>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto">
                                                        {formData.dados_receita.qsa.map((socio, sIdx) => (
                                                            <div key={sIdx} className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs space-y-0.5">
                                                                <p className="font-bold text-gray-900 leading-tight">
                                                                    {socio.nome_socio || 'Nome não informado'}
                                                                </p>
                                                                <p className="text-blue-700 font-medium">
                                                                    {socio.qualificacao_socio || 'Cargo / Qualificação'}
                                                                </p>
                                                                {socio.faixa_etaria && (
                                                                    <p className="text-[11px] text-gray-500">
                                                                        Faixa Etária: {socio.faixa_etaria}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* CNAEs Secundários */}
                                            {Array.isArray(formData.dados_receita.cnaes_secundarios) && formData.dados_receita.cnaes_secundarios.length > 0 && (
                                                <div className="p-4 bg-white border border-gray-200 rounded-xl space-y-2">
                                                    <span className="text-xs font-bold text-gray-700 uppercase block">
                                                        CNAEs Secundários ({formData.dados_receita.cnaes_secundarios.length})
                                                    </span>
                                                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                                                        {formData.dados_receita.cnaes_secundarios.map((cnae, cIdx) => (
                                                            <span
                                                                key={cIdx}
                                                                className="px-2 py-1 bg-gray-100 border border-gray-200 text-gray-700 text-[11px] rounded-md"
                                                                title={cnae.descricao}
                                                            >
                                                                <strong>{cnae.codigo}</strong> - {cnae.descricao}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB ENDEREÇOS ADICIONAIS / ENTREGA */}
                            {activeTab === 'enderecos' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between bg-blue-50 border border-blue-200 p-3 rounded-xl">
                                        <div className="flex items-center gap-2 text-blue-900">
                                            <MapPinned className="w-5 h-5 text-blue-600 shrink-0" />
                                            <div>
                                                <p className="text-sm font-bold">Endereços de Entrega & Locais Secundários</p>
                                                <p className="text-xs text-blue-700">
                                                    Cadastre múltiplos locais para expedição de pedidos (ex: Entrega 1, Entrega 2, Obra, Filial).
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={addEnderecoAdicional}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-sm shrink-0"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            Adicionar Endereço
                                        </button>
                                    </div>

                                    {(!formData.enderecos_adicionais || formData.enderecos_adicionais.length === 0) ? (
                                        <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
                                            <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                            <p className="text-sm font-semibold text-gray-600">Nenhum endereço adicional cadastrado</p>
                                            <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                                                Por padrão, as entregas utilizam o endereço principal do faturamento. Clique no botão acima para adicionar locais específicos.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={addEnderecoAdicional}
                                                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 border border-blue-300 text-blue-700 hover:bg-blue-50 rounded-lg text-xs font-semibold transition"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                                Adicionar Primeiro Endereço
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {formData.enderecos_adicionais.map((end, idx) => (
                                                <div
                                                    key={end.id || idx}
                                                    className="p-4 bg-white border border-gray-200 rounded-xl shadow-xs space-y-3 relative group hover:border-blue-300 transition"
                                                >
                                                    <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                                                        <div className="flex items-center gap-2">
                                                            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                                                                {idx + 1}
                                                            </span>
                                                            <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                                                                {end.descricao || `Endereço de Entrega ${idx + 1}`}
                                                            </span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeEnderecoAdicional(idx)}
                                                            className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50 transition"
                                                            title="Excluir este endereço"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                                        <div>
                                                            <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">
                                                                Identificação / Título
                                                            </label>
                                                            <input
                                                                type="text"
                                                                placeholder="Ex: Entrega 1, Filial Campinas"
                                                                value={end.descricao || ''}
                                                                onChange={(e) => updateEnderecoAdicional(idx, { descricao: e.target.value })}
                                                                className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                            />
                                                        </div>

                                                        <div>
                                                            <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">
                                                                Tipo
                                                            </label>
                                                            <select
                                                                value={end.tipo || 'Entrega'}
                                                                onChange={(e) => updateEnderecoAdicional(idx, { tipo: e.target.value })}
                                                                className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                            >
                                                                <option value="Entrega">Entrega</option>
                                                                <option value="Cobrança">Cobrança</option>
                                                                <option value="Filial">Filial</option>
                                                                <option value="Depósito">Depósito / Armazém</option>
                                                                <option value="Obra">Obra / Local de Instalação</option>
                                                            </select>
                                                        </div>

                                                        <div>
                                                            <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">
                                                                CEP (Autocompleta)
                                                            </label>
                                                            <input
                                                                type="text"
                                                                placeholder="00000-000"
                                                                value={end.cep || ''}
                                                                onBlur={() => handleCepBlurAdicional(idx)}
                                                                onChange={(e) => updateEnderecoAdicional(idx, { cep: formatarCEP(e.target.value) })}
                                                                className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                            />
                                                        </div>

                                                        <div>
                                                            <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">
                                                                Contato no Local
                                                            </label>
                                                            <input
                                                                type="text"
                                                                placeholder="Nome do recebedor / Tel"
                                                                value={end.contato || ''}
                                                                onChange={(e) => updateEnderecoAdicional(idx, { contato: e.target.value })}
                                                                className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                                        <div className="md:col-span-2">
                                                            <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">
                                                                Logradouro / Número
                                                            </label>
                                                            <input
                                                                type="text"
                                                                placeholder="Rua, Avenida, Número, Bloco..."
                                                                value={end.endereco || ''}
                                                                onChange={(e) => updateEnderecoAdicional(idx, { endereco: e.target.value })}
                                                                className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                            />
                                                        </div>

                                                        <div>
                                                            <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">
                                                                Bairro
                                                            </label>
                                                            <input
                                                                type="text"
                                                                placeholder="Bairro"
                                                                value={end.bairro || ''}
                                                                onChange={(e) => updateEnderecoAdicional(idx, { bairro: e.target.value })}
                                                                className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                            />
                                                        </div>

                                                        <div className="grid grid-cols-3 gap-2">
                                                            <div className="col-span-2">
                                                                <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">
                                                                    Cidade
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    placeholder="Cidade"
                                                                    value={end.cidade || ''}
                                                                    onChange={(e) => updateEnderecoAdicional(idx, { cidade: e.target.value })}
                                                                    className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">
                                                                    UF
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    maxLength="2"
                                                                    placeholder="SP"
                                                                    value={end.uf || ''}
                                                                    onChange={(e) => updateEnderecoAdicional(idx, { uf: e.target.value.toUpperCase() })}
                                                                    className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Modal Footer */}
                            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                                <div className="text-xs text-gray-500">
                                    {activeTab === 'contatos' ? (
                                        <span>{(formData.contatos || []).length} contato(s) cadastrado(s)</span>
                                    ) : activeTab === 'enderecos' ? (
                                        <span>{(formData.enderecos_adicionais || []).length} endereço(s) adicional(is) configurado(s)</span>
                                    ) : activeTab === 'receita' ? (
                                        <span>Dados consultados em tempo real na Receita Federal</span>
                                    ) : (
                                        <span>Campos marcados com * são obrigatórios</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="px-6 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                                        {saving ? 'Gravando...' : editingClient ? 'Atualizar Cliente' : 'Salvar Cliente'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
