import React, { useState, useEffect } from 'react';
import axios from 'axios';
import api from '../../services/api';
import { useDebounce } from '../../hooks/useDebounce';
import {
    Users, Plus, Search, RefreshCw, CheckCircle2, AlertCircle,
    Building2, Phone, Mail, MapPin, CreditCard, ShieldAlert,
    Edit3, ExternalLink, Filter, X
} from 'lucide-react';

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
        status: 'ativo'
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
        const limpo = formData.cnpj_cpf.replace(/\D/g, '');
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

    // Autopreenchimento por CEP (ViaCEP)
    const handleCepBlur = async () => {
        const cepLimpo = formData.cep.replace(/\D/g, '');
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

    const handleOpenModal = (cliente = null) => {
        setModalError(null);
        setModalSuccess(null);
        if (cliente) {
            setEditingClient(cliente);
            setFormData({
                codigo: cliente.codigo || '',
                loja: cliente.loja || '01',
                tipo_pessoa: cliente.tipo_pessoa || (cliente.cnpj_cpf?.length === 11 ? 'F' : 'J'),
                cnpj_cpf: cliente.cnpj_cpf || '',
                razao_social: cliente.razao_social || '',
                nome_fantasia: cliente.nome_fantasia || '',
                inscricao_estadual: cliente.inscricao_estadual || '',
                endereco: cliente.endereco || '',
                bairro: cliente.bairro || '',
                cidade: cliente.cidade || '',
                uf: cliente.uf || 'SP',
                cep: cliente.cep || '',
                telefone: cliente.telefone || '',
                email: cliente.email || '',
                contato: cliente.contato || '',
                condicao_pagamento_padrao: cliente.condicao_pagamento_padrao || '30 DDL',
                status: cliente.status || 'ativo'
            });
        } else {
            setEditingClient(null);
            setFormData(initialForm);
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setModalError(null);
        setModalSuccess(null);

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
            }, 1000);
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
                            <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">Cadastro de Clientes (MATA030)</h1>
                            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                ERP Nativo
                            </span>
                        </div>
                        <p className="text-xs md:text-sm text-gray-500 mt-0.5">
                            Gestão cadastral com validação de CNPJ/CPF (Módulo 11) e condições comerciais.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
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
                                <th className="py-3 px-4">Razão Social / Nome Fantasia</th>
                                <th className="py-3 px-4">CNPJ / CPF</th>
                                <th className="py-3 px-4">Cidade / UF</th>
                                <th className="py-3 px-4">Telefone / E-mail</th>
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
                                filteredClientes.map((c) => (
                                    <tr key={c.id || c.codigo} className="hover:bg-gray-50/80 transition">
                                        <td className="py-3.5 px-4 font-mono font-bold text-blue-700">
                                            {c.codigo} <span className="text-xs text-gray-400 font-normal">/{c.loja || '01'}</span>
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <div className="font-semibold text-gray-900">{c.razao_social}</div>
                                            {c.nome_fantasia && (
                                                <div className="text-xs text-gray-500">{c.nome_fantasia}</div>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-4 font-mono text-xs text-gray-600">
                                            {c.cnpj_cpf || '-'}
                                        </td>
                                        <td className="py-3.5 px-4 text-xs text-gray-600">
                                            {c.cidade ? `${c.cidade} - ${c.uf}` : '-'}
                                        </td>
                                        <td className="py-3.5 px-4 text-xs text-gray-600">
                                            {c.telefone && <div>{c.telefone}</div>}
                                            {c.email && <div className="text-gray-400 truncate max-w-[180px]">{c.email}</div>}
                                            {!c.telefone && !c.email && '-'}
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
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Cadastro / Edição MATA030 */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-3xl overflow-hidden my-8">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                    <Building2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-gray-900">
                                        {editingClient ? `Editar Cliente: ${editingClient.codigo}` : 'Novo Cliente (MATA030)'}
                                    </h2>
                                    <p className="text-xs text-gray-500">
                                        Validação de CNPJ/CPF por algoritmo Módulo 11 e consistência cadastral
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

                        {/* Modal Form */}
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                        Código
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Automático (000xxx)"
                                        disabled={!!editingClient}
                                        value={formData.codigo}
                                        onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                        Tipo de Pessoa
                                    </label>
                                    <select
                                        value={formData.tipo_pessoa}
                                        onChange={(e) => setFormData({ ...formData, tipo_pessoa: e.target.value })}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="J">Jurídica (CNPJ)</option>
                                        <option value="F">Física (CPF)</option>
                                    </select>
                                </div>

                                <div className="md:col-span-2">
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                            {formData.tipo_pessoa === 'J' ? 'CNPJ' : 'CPF'}
                                        </label>
                                        {docValidation && (
                                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                                                docValidation.valid ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                                            }`}>
                                                {docValidation.text}
                                            </span>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        placeholder={formData.tipo_pessoa === 'J' ? '00.000.000/0000-00' : '000.000.000-00'}
                                        value={formData.cnpj_cpf}
                                        onChange={(e) => setFormData({ ...formData, cnpj_cpf: e.target.value })}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

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
                                        CEP (Autocompleta)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="00000-000"
                                        value={formData.cep}
                                        onBlur={handleCepBlur}
                                        onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
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

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                        Endereço
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
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                        Telefone
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="(00) 00000-0000"
                                        value={formData.telefone}
                                        onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                        E-mail
                                    </label>
                                    <input
                                        type="email"
                                        placeholder="financeiro@cliente.com.br"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

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
                                    <option value="ativo">Ativo (Habilitado para pedidos e faturamento)</option>
                                    <option value="bloqueado">Bloqueado (Restrição financeira / cadastral)</option>
                                    <option value="inativo">Inativo (Desativado)</option>
                                </select>
                            </div>

                            {/* Modal Footer */}
                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
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
                                    className="px-6 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm disabled:opacity-50"
                                >
                                    {saving ? 'Gravando...' : editingClient ? 'Atualizar Cliente' : 'Salvar Cliente'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
