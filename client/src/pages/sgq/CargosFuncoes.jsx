import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { generateCargoPdf } from '../../services/sgqCargoPdfGenerator';
import { Plus, Edit2, Trash2, Printer, Search, X, GripVertical, AlertTriangle } from 'lucide-react';
import { toast } from 'react-toastify';

const CargosFuncoes = () => {
    const [cargos, setCargos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        denominacao: '',
        codigo_interno: '',
        cbo: '',
        atividades: [''],
        educacao: '',
        experiencia: '',
        treinamento: ''
    });

    useEffect(() => {
        fetchCargos();
    }, []);

    const fetchCargos = async () => {
        try {
            setLoading(true);
            const response = await api.get('/sgq/cargos-funcoes');
            setCargos(response.data);
        } catch (error) {
            console.error(error);
            toast.error('Erro ao carregar os cargos e funções');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (cargo = null) => {
        if (cargo) {
            setEditingId(cargo.id);
            setFormData({
                denominacao: cargo.denominacao || '',
                codigo_interno: cargo.codigo_interno || '',
                cbo: cargo.cbo || '',
                // Ensure at least one empty string if array is empty
                atividades: Array.isArray(cargo.atividades) && cargo.atividades.length > 0 
                  ? cargo.atividades 
                  : [''],
                educacao: cargo.educacao || '',
                experiencia: cargo.experiencia || '',
                treinamento: cargo.treinamento || ''
            });
        } else {
            setEditingId(null);
            setFormData({
                denominacao: '',
                codigo_interno: '',
                cbo: '',
                atividades: [''],
                educacao: '',
                experiencia: '',
                treinamento: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingId(null);
    };

    const handleAtividadeChange = (index, value) => {
        const newAtividades = [...formData.atividades];
        newAtividades[index] = value;
        setFormData({ ...formData, atividades: newAtividades });
    };

    const handleAddAtividade = () => {
        setFormData({ ...formData, atividades: [...formData.atividades, ''] });
    };

    const handleRemoveAtividade = (index) => {
        const newAtividades = formData.atividades.filter((_, i) => i !== index);
        if (newAtividades.length === 0) newAtividades.push('');
        setFormData({ ...formData, atividades: newAtividades });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // Remove empty activities before saving
            const cleanedAtividades = formData.atividades.filter(a => a.trim() !== '');
            const payload = { ...formData, atividades: cleanedAtividades };

            if (editingId) {
                await api.put(`/sgq/cargos-funcoes/${editingId}`, payload);
                toast.success('Cargo/Função atualizado com sucesso!');
            } else {
                await api.post('/sgq/cargos-funcoes', payload);
                toast.success('Cargo/Função criado com sucesso!');
            }
            fetchCargos();
            handleCloseModal();
        } catch (error) {
            console.error(error);
            toast.error('Erro ao salvar os dados.');
        }
    };

    const handleDelete = async (id, denominacao) => {
        if (window.confirm(`Tem certeza que deseja excluir o cargo "${denominacao}"? Esta ação não pode ser desfeita.`)) {
            try {
                await api.delete(`/sgq/cargos-funcoes/${id}`);
                toast.success('Cargo/Função excluído com sucesso!');
                fetchCargos();
            } catch (error) {
                console.error(error);
                toast.error('Erro ao excluir o cargo e função.');
            }
        }
    };

    const filteredCargos = cargos.filter(c => 
        c.denominacao.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.codigo_interno && c.codigo_interno.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.cbo && c.cbo.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">Cargos e Funções (SGQ)</h1>
                    <p className="text-sm text-gray-500 mt-1">Gerencie a estrutura de cargos, CBO e matriz de atividades e responsabilidades.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="inline-flex items-center px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-md transition-colors"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Cargo/Função
                </button>
            </div>

            {/* Config & Search */}
            <div className="mb-6 flex space-x-4 items-center">
                <div className="relative flex-1 max-w-md cursor-pointer">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por denominação, código ou CBO..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 w-full py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                </div>
                <div className="text-sm font-medium text-gray-500">
                    {filteredCargos.length} registros encontrados
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-gray-500 flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-blue-500 animate-spin mb-4"></div>
                        Carregando registros...
                    </div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código Interno</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Denominação do Cargo</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CBO</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nº Atividades</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredCargos.map((cargo) => (
                                <tr key={cargo.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800">
                                        {cargo.codigo_interno || '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">
                                        {cargo.denominacao}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {cargo.cbo || '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                            {Array.isArray(cargo.atividades) ? cargo.atividades.length : 0} registradas
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex justify-end space-x-2">
                                            <button 
                                                onClick={() => generateCargoPdf(cargo)}
                                                className="text-slate-600 hover:text-slate-900 p-1"
                                                title="Gerar PDF SGQ"
                                            >
                                                <Printer className="h-4 w-4" />
                                            </button>
                                            <button 
                                                onClick={() => handleOpenModal(cargo)}
                                                className="text-blue-600 hover:text-blue-900 p-1"
                                                title="Editar Registro"
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(cargo.id, cargo.denominacao)}
                                                className="text-red-500 hover:text-red-700 p-1 ml-2"
                                                title="Deletar Registro"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredCargos.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-sm text-gray-500">
                                        Nenhum registro encontrado correspondente à sua busca.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal de Cadastro / Edição */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
                            <h2 className="text-xl font-bold text-gray-800">
                                {editingId ? 'Editar Cargo / Função' : 'Novo Cadastro de Cargo e Função'}
                            </h2>
                            <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto flex-1">
                            <form id="cargoForm" onSubmit={handleSubmit} className="space-y-6">
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="col-span-2">
                                        <label className="block text-sm font-bold text-gray-700 mb-1">
                                            Denominação do Cargo <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.denominacao}
                                            onChange={e => setFormData({ ...formData, denominacao: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 font-medium"
                                            placeholder="Ex: Acabamentista I"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Código (Opcional)</label>
                                        <input
                                            type="text"
                                            value={formData.codigo_interno}
                                            onChange={e => setFormData({ ...formData, codigo_interno: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 uppercase"
                                            placeholder="Ex: R5"
                                        />
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">CBO (Código Brasileiro de Ocupações)</label>
                                    <input
                                        type="text"
                                        value={formData.cbo}
                                        onChange={e => setFormData({ ...formData, cbo: e.target.value })}
                                        className="w-full max-w-[200px] px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Ex: 8214-40"
                                    />
                                </div>

                                <div className="border-t pt-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-800">Atividades Principais e Responsabilidades</h3>
                                            <p className="text-sm text-slate-500">Descreva as tarefas e operações executadas rotineiramente pelo colaborador.</p>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        {formData.atividades.map((atv, index) => (
                                            <div key={index} className="flex gap-2 items-start">
                                                <div className="mt-2.5 cursor-move text-gray-300 hover:text-gray-500">
                                                    <GripVertical className="h-5 w-5" />
                                                </div>
                                                <div className="flex-1">
                                                    <textarea
                                                        value={atv}
                                                        onChange={(e) => handleAtividadeChange(index, e.target.value)}
                                                        rows={2}
                                                        placeholder={`Atividade ${index + 1}...`}
                                                        className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm resize-y"
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveAtividade(index)}
                                                    className="p-2 text-red-500 hover:bg-red-50 rounded-md mt-1 transition-colors group"
                                                    title="Remover Atividade"
                                                >
                                                    <Trash2 className="h-5 w-5 group-hover:scale-110 transition-transform" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleAddAtividade}
                                        className="mt-4 inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800"
                                    >
                                        <Plus className="h-4 w-4 mr-1" /> Adicionar Nova Atividade
                                    </button>
                                </div>

                                {/* Seção Qualificações */}
                                <div className="border-t pt-6 space-y-4">
                                    <h3 className="text-lg font-bold text-slate-800">Qualificações Exigidas</h3>
                                    
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Educação</label>
                                        <textarea
                                            value={formData.educacao}
                                            onChange={e => setFormData({ ...formData, educacao: e.target.value })}
                                            rows={2}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                                            placeholder="Ex: Ensino Fundamental Incompleto"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Experiência</label>
                                        <textarea
                                            value={formData.experiencia}
                                            onChange={e => setFormData({ ...formData, experiencia: e.target.value })}
                                            rows={2}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                                            placeholder="Ex: Desejável 0 a 2 anos em atividades semelhantes"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Treinamento</label>
                                        <textarea
                                            value={formData.treinamento}
                                            onChange={e => setFormData({ ...formData, treinamento: e.target.value })}
                                            rows={2}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                                            placeholder="Ex: Treinamento introdutório, NR-12"
                                        />
                                    </div>
                                </div>

                            </form>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={handleCloseModal}
                                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100 font-medium transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                form="cargoForm"
                                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-bold shadow-sm transition-colors"
                            >
                                Salvar Registro
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CargosFuncoes;
