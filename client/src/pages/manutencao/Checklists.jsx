import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Plus, ListChecks, Settings2, Image as ImageIcon, Save, X, Trash2 } from 'lucide-react';

export default function ManutencaoChecklists() {
    const [activeTab, setActiveTab] = useState('modelos'); // 'diarios' ou 'modelos'
    const [modelos, setModelos] = useState([]);
    const [loading, setLoading] = useState(false);

    // Estado da Modal de Modelo
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    
    // Form do Modelo
    const [formData, setFormData] = useState({
        id: null,
        nome: '',
        observacoes: '',
        tipo: 'DIARIO',
        status: 'ATIVO',
        itens: []
    });

    const loadModelos = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/manutencao/checklists/modelos');
            setModelos(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'modelos') {
            loadModelos();
        }
    }, [activeTab]);

    const handleOpenModal = (modelo = null) => {
        if (modelo) {
            setFormData({
                id: modelo.id,
                nome: modelo.nome,
                observacoes: modelo.observacoes || '',
                tipo: modelo.tipo,
                status: modelo.status,
                itens: modelo.itens || []
            });
        } else {
            setFormData({
                id: null,
                nome: '',
                observacoes: '',
                tipo: 'DIARIO',
                status: 'ATIVO',
                itens: []
            });
        }
        setIsModalOpen(true);
    };

    const handleAddItem = () => {
        setFormData(prev => ({
            ...prev,
            itens: [
                ...prev.itens,
                { id: Date.now().toString(), pergunta: '', tipo_resposta: 'BOOLEAN', obrigatorio: true, foto_certo: '', foto_errado: '' }
            ]
        }));
    };

    const handleRemoveItem = (id) => {
        setFormData(prev => ({
            ...prev,
            itens: prev.itens.filter(i => i.id !== id)
        }));
    };

    const handleItemChange = (id, field, value) => {
        setFormData(prev => ({
            ...prev,
            itens: prev.itens.map(i => i.id === id ? { ...i, [field]: value } : i)
        }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (formData.itens.length === 0) {
            alert("Adicione pelo menos um item de verificação no checklist.");
            return;
        }

        try {
            setSaving(true);
            if (formData.id) {
                await api.put(`/manutencao/checklists/modelos/${formData.id}`, formData);
            } else {
                await api.post('/manutencao/checklists/modelos', formData);
            }
            setIsModalOpen(false);
            loadModelos();
        } catch (err) {
            console.error(err);
            alert("Erro ao salvar modelo.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Checklists de Manutenção</h1>
                    <p className="text-sm text-slate-500">Gestão de Poka-Yoke visual e inspeções diárias</p>
                </div>
                
                {/* Tabs */}
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                    <button 
                        onClick={() => setActiveTab('diarios')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'diarios' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                        <ListChecks size={16} /> Preenchimentos Diários
                    </button>
                    <button 
                        onClick={() => setActiveTab('modelos')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'modelos' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                        <Settings2 size={16} /> Modelos (Templates)
                    </button>
                </div>
            </div>

            {/* TAB: MODELOS */}
            {activeTab === 'modelos' && (
                <div className="flex-1 flex flex-col">
                    <div className="flex justify-end mb-4">
                        <button 
                            onClick={() => handleOpenModal()}
                            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                            <Plus size={16} /> Novo Modelo
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex justify-center p-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {modelos.length === 0 ? (
                                <div className="col-span-full p-12 text-center text-slate-500 bg-white rounded-lg border border-slate-200 border-dashed">
                                    Nenhum modelo de checklist configurado.
                                </div>
                            ) : (
                                modelos.map(m => (
                                    <div key={m.id} className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative group">
                                        <div className="flex justify-between items-start mb-3">
                                            <h3 className="font-bold text-slate-800 text-lg pr-8 leading-tight">{m.nome}</h3>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${m.tipo === 'DIARIO' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                                {m.tipo}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-500 mb-4">{m.itens?.length || 0} itens de verificação</p>
                                        
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => handleOpenModal(m)}
                                                className="text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded"
                                            >
                                                Editar Estrutura
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* TAB: DIARIOS */}
            {activeTab === 'diarios' && (
                <div className="flex-1 bg-white rounded-lg border border-slate-200 flex items-center justify-center p-12 text-center">
                    <div>
                        <ListChecks className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-slate-700">Preenchimentos Diários</h3>
                        <p className="text-slate-500 max-w-md mx-auto mt-2">
                            Aqui aparecerão os checklists preenchidos pelos operadores na fábrica através da versão mobile. 
                            Você poderá auditar se os parâmetros visuais estão de acordo com as fotos de referência (Poka-Yoke).
                        </p>
                    </div>
                </div>
            )}

            {/* MODAL DE CRIAÇÃO DO MODELO */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[95vh]">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <Settings2 className="text-indigo-600" />
                                {formData.id ? 'Editar Modelo de Checklist' : 'Novo Modelo de Checklist (Poka-Yoke)'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
                            <form id="modelo-form" onSubmit={handleSave} className="space-y-6">
                                {/* Informações Básicas */}
                                <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm grid grid-cols-3 gap-5">
                                    <div className="col-span-3 md:col-span-2">
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">Nome do Checklist *</label>
                                        <input 
                                            required
                                            type="text" 
                                            value={formData.nome}
                                            onChange={e => setFormData({...formData, nome: e.target.value})}
                                            className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500"
                                            placeholder="Ex: Inspeção Diária - Injetoras"
                                        />
                                    </div>
                                    <div className="col-span-3 md:col-span-1">
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">Frequência</label>
                                        <select 
                                            value={formData.tipo}
                                            onChange={e => setFormData({...formData, tipo: e.target.value})}
                                            className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="DIARIO">Diário</option>
                                            <option value="SEMANAL">Semanal</option>
                                            <option value="MENSAL">Mensal</option>
                                            <option value="PREVENTIVA">Preventiva (Agendada)</option>
                                        </select>
                                    </div>
                                    <div className="col-span-3">
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">Observações / Instruções Gerais</label>
                                        <textarea
                                            value={formData.observacoes}
                                            onChange={e => setFormData({...formData, observacoes: e.target.value})}
                                            rows="3"
                                            className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500"
                                            placeholder="Ex: Utilizar EPIs adequados antes de iniciar a inspeção..."
                                        ></textarea>
                                    </div>
                                </div>

                                {/* Builder de Itens */}
                                <div>
                                    <div className="flex justify-between items-end mb-3">
                                        <h3 className="text-lg font-bold text-slate-800">Itens de Verificação (Poka-Yoke)</h3>
                                        <button 
                                            type="button"
                                            onClick={handleAddItem}
                                            className="text-sm font-medium text-indigo-700 bg-indigo-100 hover:bg-indigo-200 px-3 py-1.5 rounded flex items-center gap-1"
                                        >
                                            <Plus size={16} /> Adicionar Pergunta
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        {formData.itens.length === 0 ? (
                                            <div className="text-center p-8 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 bg-white">
                                                Nenhuma pergunta adicionada. Clique no botão acima para começar.
                                            </div>
                                        ) : (
                                            formData.itens.map((item, index) => (
                                                <div key={item.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex gap-4 items-start relative group">
                                                    <div className="bg-slate-100 text-slate-500 font-bold rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-2 text-sm">
                                                        {index + 1}
                                                    </div>
                                                    
                                                    <div className="flex-1 grid grid-cols-12 gap-4">
                                                        <div className="col-span-12 md:col-span-7">
                                                            <input 
                                                                required
                                                                type="text" 
                                                                value={item.pergunta}
                                                                onChange={e => handleItemChange(item.id, 'pergunta', e.target.value)}
                                                                className="w-full border border-slate-300 rounded p-2 text-sm focus:ring-1 focus:ring-indigo-500"
                                                                placeholder="Descreva a verificação. Ex: O nível de óleo está na marca verde?"
                                                            />
                                                        </div>
                                                        <div className="col-span-6 md:col-span-3">
                                                            <select 
                                                                value={item.tipo_resposta}
                                                                onChange={e => handleItemChange(item.id, 'tipo_resposta', e.target.value)}
                                                                className="w-full border border-slate-300 rounded p-2 text-sm focus:ring-1 focus:ring-indigo-500"
                                                            >
                                                                <option value="BOOLEAN">Conforme / Não Conforme</option>
                                                                <option value="TEXT">Texto Livre</option>
                                                                <option value="NUMBER">Número / Medida</option>
                                                                <option value="PHOTO">Exigir Foto da Peça</option>
                                                            </select>
                                                        </div>
                                                        <div className="col-span-6 md:col-span-2 flex items-center">
                                                            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600">
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={item.obrigatorio}
                                                                    onChange={e => handleItemChange(item.id, 'obrigatorio', e.target.checked)}
                                                                    className="rounded text-indigo-600 focus:ring-indigo-500"
                                                                />
                                                                Obrigatório
                                                            </label>
                                                        </div>

                                                        {/* Fotos Referência (Poka-Yoke: Certo / Errado) */}
                                                        <div className="col-span-12 mt-2 pt-3 border-t border-slate-100">
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <ImageIcon size={14} className="text-slate-400" />
                                                                <span className="font-semibold text-sm text-slate-700">Padrão Visual (Poka-Yoke)</span>
                                                            </div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                                {/* Foto CERTO */}
                                                                <div className="bg-green-50/50 p-3 rounded border border-green-100 flex flex-col gap-2">
                                                                    <span className="text-xs font-bold text-green-700 uppercase">✅ Padrão Correto</span>
                                                                    {item.foto_certo ? (
                                                                        <div className="flex items-center justify-between bg-white px-2 py-2 rounded border border-green-200">
                                                                            <img src={item.foto_certo} alt="Certo" className="h-16 w-16 object-cover rounded shadow-sm" />
                                                                            <button 
                                                                                type="button" 
                                                                                onClick={() => handleItemChange(item.id, 'foto_certo', '')}
                                                                                className="text-red-500 hover:text-red-700 text-xs font-medium"
                                                                            >
                                                                                Remover
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <input 
                                                                            type="file" accept="image/*" capture="environment"
                                                                            onChange={e => {
                                                                                const file = e.target.files[0];
                                                                                if (file) {
                                                                                    const r = new FileReader();
                                                                                    r.onloadend = () => handleItemChange(item.id, 'foto_certo', r.result);
                                                                                    r.readAsDataURL(file);
                                                                                }
                                                                            }}
                                                                            className="w-full text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-green-100 file:text-green-800 hover:file:bg-green-200 cursor-pointer"
                                                                        />
                                                                    )}
                                                                </div>

                                                                {/* Foto ERRADO */}
                                                                <div className="bg-red-50/50 p-3 rounded border border-red-100 flex flex-col gap-2">
                                                                    <span className="text-xs font-bold text-red-700 uppercase">❌ Padrão Incorreto</span>
                                                                    {item.foto_errado ? (
                                                                        <div className="flex items-center justify-between bg-white px-2 py-2 rounded border border-red-200">
                                                                            <img src={item.foto_errado} alt="Errado" className="h-16 w-16 object-cover rounded shadow-sm" />
                                                                            <button 
                                                                                type="button" 
                                                                                onClick={() => handleItemChange(item.id, 'foto_errado', '')}
                                                                                className="text-red-500 hover:text-red-700 text-xs font-medium"
                                                                            >
                                                                                Remover
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <input 
                                                                            type="file" accept="image/*" capture="environment"
                                                                            onChange={e => {
                                                                                const file = e.target.files[0];
                                                                                if (file) {
                                                                                    const r = new FileReader();
                                                                                    r.onloadend = () => handleItemChange(item.id, 'foto_errado', r.result);
                                                                                    r.readAsDataURL(file);
                                                                                }
                                                                            }}
                                                                            className="w-full text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-red-100 file:text-red-800 hover:file:bg-red-200 cursor-pointer"
                                                                        />
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <button 
                                                        type="button"
                                                        onClick={() => handleRemoveItem(item.id)}
                                                        className="text-slate-400 hover:text-red-500 mt-2 transition-colors"
                                                        title="Remover pergunta"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </form>
                        </div>
                        
                        <div className="p-5 border-t border-slate-100 bg-white flex justify-end gap-3 rounded-b-xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] relative z-10">
                            <button 
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="submit"
                                form="modelo-form"
                                disabled={saving}
                                className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {saving ? 'Salvando...' : <><Save size={18} /> Salvar Checklist</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
