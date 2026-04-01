import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Plus, Edit2, Trash2, Search, X, Briefcase, Calendar, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-toastify';

const VagasManager = () => {
    const [vagas, setVagas] = useState([]);
    const [cargos, setCargos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        cargo_id: '',
        titulo: '',
        descricao: '',
        requisitos_extras: '',
        status: 'Aberta',
        data_abertura: '',
        data_fechamento: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [vagasRes, cargosRes] = await Promise.all([
                api.get('/rh/vagas'),
                api.get('/sgq/cargos-funcoes')
            ]);
            setVagas(vagasRes.data);
            setCargos(cargosRes.data);
        } catch (error) {
            console.error(error);
            toast.error('Erro ao carregar os dados de vagas e cargos.');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (vaga = null) => {
        if (vaga) {
            setEditingId(vaga.id);
            setFormData({
                cargo_id: vaga.cargo_id || '',
                titulo: vaga.titulo || '',
                descricao: vaga.descricao || '',
                requisitos_extras: vaga.requisitos_extras || '',
                status: vaga.status || 'Aberta',
                data_abertura: vaga.data_abertura ? vaga.data_abertura.split('T')[0] : '',
                data_fechamento: vaga.data_fechamento ? vaga.data_fechamento.split('T')[0] : ''
            });
        } else {
            setEditingId(null);
            setFormData({
                cargo_id: '',
                titulo: '',
                descricao: '',
                requisitos_extras: '',
                status: 'Aberta',
                data_abertura: new Date().toISOString().split('T')[0],
                data_fechamento: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingId(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (!formData.cargo_id) {
                toast.error('Selecione um Cargo/Função base.');
                return;
            }

            if (editingId) {
                await api.put(`/rh/vagas/${editingId}`, formData);
                toast.success('Vaga atualizada com sucesso!');
            } else {
                await api.post('/rh/vagas', formData);
                toast.success('Vaga criada com sucesso!');
            }
            fetchData();
            handleCloseModal();
        } catch (error) {
            console.error(error);
            toast.error('Erro ao salvar.');
        }
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'Aberta': return 'bg-green-100 text-green-800 border-green-200';
            case 'Pausada': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'Fechada': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const filteredVagas = vagas.filter(v => 
        (v.titulo && v.titulo.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (v.cargo_nome && v.cargo_nome.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (v.status && v.status.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">Gestão de Vagas</h1>
                    <p className="text-sm text-gray-500 mt-1">Crie processos seletivos baseados em cargos existentes para receber e avaliar os candidatos.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow transition-colors"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Abrir Nova Vaga
                </button>
            </div>

            {/* Config & Search */}
            <div className="mb-6 flex space-x-4 items-center">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar vaga por título, cargo base ou status..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 w-full py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                </div>
                <div className="text-sm font-medium text-gray-500 flex items-center">
                    <Briefcase className="w-4 h-4 mr-1 text-blue-500" />
                    {vagas.filter(v => v.status === 'Aberta').length} Vagas Abertas
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-gray-500 flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-blue-500 animate-spin mb-4"></div>
                        Carregando vagas...
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Título da Vaga / Cargo Base</th>
                                    <th scope="col" className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                    <th scope="col" className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Abertura</th>
                                    <th scope="col" className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Término</th>
                                    <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200 indent-0">
                                {filteredVagas.map((vaga) => (
                                    <tr key={vaga.id} className="hover:bg-blue-50/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-normal">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-900">{vaga.titulo}</span>
                                                <span className="text-xs text-slate-500 font-medium flex items-center mt-0.5">
                                                    <Briefcase className="w-3 h-3 mr-1" />
                                                    Base: {vaga.cargo_nome}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusStyle(vaga.status)}`}>
                                                {vaga.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-600 font-medium">
                                            {vaga.data_abertura ? new Date(vaga.data_abertura).toLocaleDateString('pt-BR') : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-600 font-medium">
                                            {vaga.data_fechamento ? new Date(vaga.data_fechamento).toLocaleDateString('pt-BR') : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex justify-end space-x-2">
                                                <button 
                                                    onClick={() => handleOpenModal(vaga)}
                                                    className="inline-flex items-center text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 rounded p-1.5 transition-colors"
                                                    title="Editar Vaga"
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredVagas.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-8 text-center text-sm text-gray-500">
                                            Nenhuma vaga encontrada.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal de Cadastro / Edição */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
                            <h2 className="text-xl font-bold flex items-center text-gray-800">
                                <Briefcase className="w-5 h-5 mr-2 text-blue-600" />
                                {editingId ? 'Editar Vaga / Processo Seletivo' : 'Abertura de Nova Vaga'}
                            </h2>
                            <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 bg-gray-200 hover:bg-gray-300 p-1.5 rounded-full transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto flex-1">
                            <form id="vagaForm" onSubmit={handleSubmit} className="space-y-5">
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="col-span-2">
                                        <label className="block text-sm font-bold text-slate-700 mb-1">
                                            Título da Vaga / Anúncio <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.titulo}
                                            onChange={e => setFormData({ ...formData, titulo: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 focus:bg-white font-medium shadow-sm transition-colors"
                                            placeholder="Ex: Auxiliar de Produção - Turno Tarde"
                                        />
                                    </div>
                                    
                                    <div className="col-span-2">
                                        <label className="block text-sm font-bold text-slate-700 mb-1">
                                            Cargo Base Relacionado <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            required
                                            value={formData.cargo_id}
                                            onChange={e => setFormData({ ...formData, cargo_id: e.target.value })}
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white"
                                        >
                                            <option value="">Selecione um Cargo/Função (SGQ)...</option>
                                            {cargos.map(c => (
                                                <option key={c.id} value={c.id}>{c.denominacao}</option>
                                            ))}
                                        </select>
                                        <p className="mt-1 text-xs text-slate-500">A IA usará as descrições e atividades deste cargo para avaliar os candidatos dessa vaga.</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                                            Data de Abertura
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.data_abertura}
                                            onChange={e => setFormData({ ...formData, data_abertura: e.target.value })}
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                                            Data de Encerramento Prevista
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.data_fechamento}
                                            onChange={e => setFormData({ ...formData, data_fechamento: e.target.value })}
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                                            Status da Vaga
                                        </label>
                                        <select
                                            value={formData.status}
                                            onChange={e => setFormData({ ...formData, status: e.target.value })}
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 font-medium"
                                        >
                                            <option value="Aberta">Aberta (Recebendo Currículos)</option>
                                            <option value="Pausada">Pausada</option>
                                            <option value="Fechada">Fechada / Concluída</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="border-t border-slate-200 pt-5 mt-5">
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                                        Descrição da Vaga Opcional
                                    </label>
                                    <textarea
                                        value={formData.descricao}
                                        onChange={e => setFormData({ ...formData, descricao: e.target.value })}
                                        rows={3}
                                        placeholder="Benefícios, salário, modalidade, horário de trabalho..."
                                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                                        Requisitos Extras para esta Vaga
                                    </label>
                                    <textarea
                                        value={formData.requisitos_extras}
                                        onChange={e => setFormData({ ...formData, requisitos_extras: e.target.value })}
                                        rows={2}
                                        placeholder="Ex: Necessário veículo próprio, disponibilidade de viagem (A IA vai pontuar o candidato usando isso também!)"
                                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm bg-yellow-50"
                                    />
                                    <p className="mt-1 text-xs font-medium text-amber-600 flex items-center">
                                        <CheckCircle2 className="w-3 h-3 mr-1" />
                                        Os requisitos desta caixa farão parte do checklist de aprovação do currículo.
                                    </p>
                                </div>

                            </form>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={handleCloseModal}
                                className="px-5 py-2.5 border border-slate-300 text-slate-700 bg-white rounded-lg hover:bg-slate-50 font-medium shadow-sm transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                form="vagaForm"
                                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-sm transition-colors"
                            >
                                {editingId ? 'Salvar Alterações' : 'Criar Vaga Oficial'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VagasManager;
