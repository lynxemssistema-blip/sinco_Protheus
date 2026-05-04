import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Plus, Search, Edit2, Trash2, X, Save, AlertCircle, Image as ImageIcon, FileText, Upload } from 'lucide-react';

export default function ManutencaoMaquinas() {
    const [maquinas, setMaquinas] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [setores, setSetores] = useState([]);
    const [checklistsModelos, setChecklistsModelos] = useState([]);
    const [usuarios, setUsuarios] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        id: null,
        nome: '',
        numero_serie: '',
        tag_identificacao: '',
        tipo: 'MAQUINA',
        id_categoria: '',
        id_setor: '',
        status: 'ATIVO',
        status_operacional: 'OPERANDO',
        checklists_vinculados: [],
        operadores_vinculados: [],
        fotos: [],
        documentos_pdf: []
    });

    const loadData = async () => {
        try {
            setLoading(true);
            const [resMaq, resCat, resSetores, resCheck, resUsers] = await Promise.all([
                api.get('/manutencao/maquinas'),
                api.get('/manutencao/categorias'),
                api.get('/pcp-setores'),
                api.get('/manutencao/checklists/modelos').catch(() => ({ data: [] })),
                api.get('/users').catch(() => ({ data: [] }))
            ]);
            setMaquinas(resMaq.data);
            setCategorias(resCat.data);
            setSetores(resSetores.data);
            setChecklistsModelos(resCheck.data);
            setUsuarios(resUsers.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleOpenModal = (maquina = null) => {
        if (maquina) {
            setFormData({
                id: maquina.id,
                nome: maquina.nome,
                numero_serie: maquina.numero_serie || '',
                tag_identificacao: maquina.tag_identificacao || '',
                tipo: maquina.tipo || 'MAQUINA',
                id_categoria: maquina.id_categoria || '',
                id_setor: maquina.id_setor || '',
                status: maquina.status,
                status_operacional: maquina.status_operacional,
                checklists_vinculados: maquina.checklists_vinculados || [],
                operadores_vinculados: maquina.operadores_vinculados || [],
                fotos: maquina.fotos || [],
                documentos_pdf: maquina.documentos_pdf || []
            });
        } else {
            setFormData({
                id: null,
                nome: '',
                numero_serie: '',
                tag_identificacao: '',
                tipo: 'MAQUINA',
                id_categoria: '',
                id_setor: '',
                status: 'ATIVO',
                status_operacional: 'OPERANDO',
                checklists_vinculados: [],
                operadores_vinculados: [],
                fotos: [],
                documentos_pdf: []
            });
        }
        setIsModalOpen(true);
    };

    const toggleChecklist = (id) => {
        setFormData(prev => {
            const has = prev.checklists_vinculados.includes(id);
            if (has) return { ...prev, checklists_vinculados: prev.checklists_vinculados.filter(c => c !== id) };
            return { ...prev, checklists_vinculados: [...prev.checklists_vinculados, id] };
        });
    };

    const handleFileUpload = (type, file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            setFormData(prev => ({
                ...prev,
                [type]: [...(prev[type] || []), {
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                    name: file.name,
                    data: reader.result
                }]
            }));
        };
        reader.readAsDataURL(file);
    };

    const removeFile = (type, id) => {
        setFormData(prev => ({
            ...prev,
            [type]: prev[type].filter(f => f.id !== id)
        }));
    };

    const addOperador = () => {
        setFormData(prev => ({
            ...prev,
            operadores_vinculados: [
                ...prev.operadores_vinculados,
                { id: Date.now().toString(), id_usuario: '', turno: 'COMERCIAL' }
            ]
        }));
    };

    const removeOperador = (id) => {
        setFormData(prev => ({
            ...prev,
            operadores_vinculados: prev.operadores_vinculados.filter(o => o.id !== id)
        }));
    };

    const updateOperador = (id, field, value) => {
        setFormData(prev => ({
            ...prev,
            operadores_vinculados: prev.operadores_vinculados.map(o => o.id === id ? { ...o, [field]: value } : o)
        }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);
            const payload = {
                ...formData,
                id_categoria: formData.id_categoria ? parseInt(formData.id_categoria) : null,
                id_setor: formData.id_setor ? parseInt(formData.id_setor) : null
            };

            if (formData.id) {
                await api.put(`/manutencao/maquinas/${formData.id}`, payload);
            } else {
                await api.post('/manutencao/maquinas', payload);
            }
            setIsModalOpen(false);
            loadData();
        } catch (err) {
            console.error(err);
            alert("Erro ao salvar máquina.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id, nome) => {
        if (window.confirm(`Tem certeza que deseja excluir a máquina/equipamento "${nome}"?`)) {
            try {
                await api.delete(`/manutencao/maquinas/${id}`);
                loadData();
            } catch (err) {
                console.error(err);
                if (err.response && err.response.data && err.response.data.error) {
                    alert(err.response.data.error);
                } else {
                    alert("Erro ao excluir máquina.");
                }
            }
        }
    };

    const handleAddCategoria = async () => {
        const nome = window.prompt("Nome da nova categoria:");
        if (!nome) return;
        try {
            await api.post('/manutencao/categorias', { nome, descricao: '' });
            const { data } = await api.get('/manutencao/categorias');
            setCategorias(data);
        } catch (err) {
            alert("Erro ao criar categoria");
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Máquinas & Equipamentos</h1>
                    <p className="text-sm text-slate-500">Gestão do parque fabril e identificação</p>
                </div>
                <button 
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors shadow-sm"
                >
                    <Plus size={16} /> Nova Máquina
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center p-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-800">
                            <tr>
                                <th className="p-4 font-semibold">Nome/Modelo</th>
                                <th className="p-4 font-semibold">TAG</th>
                                <th className="p-4 font-semibold">Tipo</th>
                                <th className="p-4 font-semibold">Categoria</th>
                                <th className="p-4 font-semibold">Setor</th>
                                <th className="p-4 font-semibold text-center">Status Operacional</th>
                                <th className="p-4 font-semibold text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {maquinas.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-slate-500">
                                        <div className="flex flex-col items-center">
                                            <AlertCircle className="w-8 h-8 text-slate-300 mb-2" />
                                            <p>Nenhuma máquina cadastrada.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                maquinas.map(m => (
                                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="p-4 font-bold text-slate-800">{m.nome}</td>
                                        <td className="p-4">
                                            {m.tag_identificacao ? (
                                                <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200">
                                                    {m.tag_identificacao}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="p-4">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                                m.tipo === 'VEICULO'     ? 'bg-blue-100 text-blue-700' :
                                                m.tipo === 'EQUIPAMENTO' ? 'bg-orange-100 text-orange-700' :
                                                'bg-slate-100 text-slate-600'
                                            }`}>
                                                {m.tipo === 'VEICULO' ? '🚗 Veículo' : m.tipo === 'EQUIPAMENTO' ? '🔧 Equip.' : '⚙️ Máquina'}
                                            </span>
                                        </td>
                                        <td className="p-4">{m.categoria_nome || '-'}</td>
                                        <td className="p-4">{m.setor_nome || '-'}</td>
                                        <td className="p-4 text-center">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center ${
                                                m.status_operacional === 'OPERANDO' ? 'bg-green-100 text-green-700' :
                                                m.status_operacional === 'EM_MANUTENCAO' ? 'bg-red-100 text-red-700' :
                                                'bg-yellow-100 text-yellow-700'
                                            }`}>
                                                {m.status_operacional === 'OPERANDO' && <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse"></span>}
                                                {m.status_operacional.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="p-4 flex gap-3 justify-center" style={{minWidth:'90px'}}>
                                            <button 
                                                onClick={() => handleOpenModal(m)}
                                                className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 p-1.5 rounded"
                                                title="Editar Máquina"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(m.id, m.nome)}
                                                className="text-red-600 hover:text-red-900 bg-red-50 p-1.5 rounded"
                                                title="Excluir Máquina"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal de Cadastro/Edição */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-xl font-bold text-slate-800">
                                {formData.id ? 'Editar Máquina' : 'Nova Máquina'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1">
                            <form id="maquina-form" onSubmit={handleSave} className="space-y-5">
                                <div className="grid grid-cols-2 gap-5">
                                    <div className="col-span-2 md:col-span-1">
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">Nome/Modelo *</label>
                                        <input 
                                            required
                                            type="text" 
                                            value={formData.nome}
                                            onChange={e => setFormData({...formData, nome: e.target.value})}
                                            className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                            placeholder="Ex: Dobradeira CNC 120T"
                                        />
                                    </div>
                                    <div className="col-span-2 md:col-span-1">
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">Número de Série</label>
                                        <input 
                                            type="text" 
                                            value={formData.numero_serie}
                                            onChange={e => setFormData({...formData, numero_serie: e.target.value.toUpperCase()})}
                                            className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                                            placeholder="Ex: SN-102938"
                                        />
                                    </div>
                                    <div className="col-span-2 md:col-span-1">
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">TAG de Identificação</label>
                                        <input
                                            type="text"
                                            value={formData.tag_identificacao}
                                            onChange={e => setFormData({...formData, tag_identificacao: e.target.value.toUpperCase()})}
                                            className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                                            placeholder="Ex: DOB-01"
                                        />
                                    </div>

                                    <div className="col-span-2 md:col-span-1">
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">Tipo de Ativo</label>
                                        <select
                                            value={formData.tipo}
                                            onChange={e => setFormData({...formData, tipo: e.target.value})}
                                            className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 bg-white"
                                        >
                                            <option value="MAQUINA">⚙️ Máquina / Equipamento Produtivo</option>
                                            <option value="EQUIPAMENTO">🔧 Equipamento / Utilitário</option>
                                            <option value="VEICULO">🚗 Veículo / Transporte</option>
                                        </select>
                                    </div>

                                    <div className="col-span-2 md:col-span-1">
                                        <label className="block text-sm font-semibold text-slate-700 mb-1 flex justify-between">
                                            Categoria
                                            <button 
                                                type="button" 
                                                onClick={handleAddCategoria}
                                                className="text-indigo-600 hover:text-indigo-800 text-xs flex items-center"
                                            >
                                                <Plus size={12} className="mr-0.5"/> Nova
                                            </button>
                                        </label>
                                        <select 
                                            value={formData.id_categoria}
                                            onChange={e => setFormData({...formData, id_categoria: e.target.value})}
                                            className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 bg-white"
                                        >
                                            <option value="">Selecione...</option>
                                            {categorias.map(c => (
                                                <option key={c.id} value={c.id}>{c.nome}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="col-span-2 md:col-span-1">
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">Setor Responsável</label>
                                        <select 
                                            value={formData.id_setor}
                                            onChange={e => setFormData({...formData, id_setor: e.target.value})}
                                            className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 bg-white"
                                        >
                                            <option value="">Selecione o Setor...</option>
                                            {setores.map(s => (
                                                <option key={s.id} value={s.id}>{s.nome}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="col-span-2 md:col-span-1">
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">Status Operacional</label>
                                        <select 
                                            value={formData.status_operacional}
                                            onChange={e => setFormData({...formData, status_operacional: e.target.value})}
                                            className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 bg-white font-medium"
                                        >
                                            <option value="OPERANDO">✅ OPERANDO</option>
                                            <option value="AGUARDANDO_MANUTENCAO">⚠️ AGUARDANDO MANUTENÇÃO</option>
                                            <option value="EM_MANUTENCAO">🛑 EM MANUTENÇÃO</option>
                                        </select>
                                    </div>
                                    
                                    <div className="col-span-2 md:col-span-1">
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">Situação do Cadastro</label>
                                        <select 
                                            value={formData.status}
                                            onChange={e => setFormData({...formData, status: e.target.value})}
                                            className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 bg-white"
                                        >
                                            <option value="ATIVO">Ativo</option>
                                            <option value="INATIVO">Inativo</option>
                                        </select>
                                    </div>

                                    {/* SEÇÃO: FOTOS E ARQUIVOS PDF */}
                                    <div className="col-span-2 mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* FOTOS */}
                                        <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
                                            <div className="flex justify-between items-center mb-3">
                                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                                    <ImageIcon size={16} className="text-indigo-600" /> Fotos do Equipamento
                                                </h3>
                                                <label className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded cursor-pointer">
                                                    <Plus size={14} /> Adicionar
                                                    <input 
                                                        type="file" 
                                                        accept="image/*" 
                                                        multiple
                                                        capture="environment"
                                                        className="hidden"
                                                        onChange={e => Array.from(e.target.files).forEach(f => handleFileUpload('fotos', f))}
                                                    />
                                                </label>
                                            </div>
                                            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                                {formData.fotos.length === 0 ? (
                                                    <div className="text-xs text-slate-500 italic text-center py-4">Nenhuma foto adicionada.</div>
                                                ) : (
                                                    formData.fotos.map(foto => (
                                                        <div key={foto.id} className="flex items-center justify-between bg-white p-2 border border-slate-200 rounded shadow-sm">
                                                            <div className="flex items-center gap-2 truncate">
                                                                <img src={foto.data} alt="thumb" className="w-8 h-8 object-cover rounded border border-slate-100 flex-shrink-0" />
                                                                <span className="text-xs text-slate-600 truncate" title={foto.name}>{foto.name}</span>
                                                            </div>
                                                            <button 
                                                                type="button" 
                                                                onClick={() => removeFile('fotos', foto.id)}
                                                                className="text-red-400 hover:text-red-600 p-1 flex-shrink-0"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>

                                        {/* PDFs */}
                                        <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
                                            <div className="flex justify-between items-center mb-3">
                                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                                    <FileText size={16} className="text-orange-600" /> Manuais e PDFs
                                                </h3>
                                                <label className="text-xs font-bold text-orange-600 hover:text-orange-800 flex items-center gap-1 bg-orange-50 px-2 py-1 rounded cursor-pointer">
                                                    <Plus size={14} /> Adicionar
                                                    <input 
                                                        type="file" 
                                                        accept="application/pdf" 
                                                        multiple
                                                        className="hidden"
                                                        onChange={e => Array.from(e.target.files).forEach(f => handleFileUpload('documentos_pdf', f))}
                                                    />
                                                </label>
                                            </div>
                                            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                                {formData.documentos_pdf.length === 0 ? (
                                                    <div className="text-xs text-slate-500 italic text-center py-4">Nenhum PDF adicionado.</div>
                                                ) : (
                                                    formData.documentos_pdf.map(pdf => (
                                                        <div key={pdf.id} className="flex items-center justify-between bg-white p-2 border border-slate-200 rounded shadow-sm">
                                                            <div className="flex items-center gap-2 truncate">
                                                                <FileText size={20} className="text-red-500 flex-shrink-0" />
                                                                <span className="text-xs text-slate-600 truncate font-medium" title={pdf.name}>{pdf.name}</span>
                                                            </div>
                                                            <button 
                                                                type="button" 
                                                                onClick={() => removeFile('documentos_pdf', pdf.id)}
                                                                className="text-red-400 hover:text-red-600 p-1 flex-shrink-0"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* SEÇÃO: CHECKLISTS VINCULADOS */}
                                    <div className="col-span-2 mt-4">
                                        <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-2 mb-3">Checklists de Inspeção Associados</h3>
                                        {checklistsModelos.length === 0 ? (
                                            <div className="text-sm text-slate-500 italic">Nenhum modelo de checklist cadastrado no sistema.</div>
                                        ) : (
                                            <div className="flex flex-wrap gap-2">
                                                {checklistsModelos.map(c => {
                                                    const isSelected = formData.checklists_vinculados.includes(c.id);
                                                    return (
                                                        <button
                                                            key={c.id}
                                                            type="button"
                                                            onClick={() => toggleChecklist(c.id)}
                                                            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                                                                isSelected 
                                                                    ? 'bg-indigo-100 border-indigo-300 text-indigo-700' 
                                                                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                                                            }`}
                                                        >
                                                            {isSelected ? '✓ ' : '+ '} {c.nome}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* SEÇÃO: OPERADORES VINCULADOS */}
                                    <div className="col-span-2 mt-2">
                                        <div className="flex justify-between items-end border-b border-slate-200 pb-2 mb-3">
                                            <h3 className="text-sm font-bold text-slate-800">Operadores Responsáveis pelo Equipamento</h3>
                                            <button 
                                                type="button"
                                                onClick={addOperador}
                                                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded"
                                            >
                                                <Plus size={14} /> Adicionar Operador
                                            </button>
                                        </div>
                                        
                                        <div className="space-y-3">
                                            {formData.operadores_vinculados.length === 0 ? (
                                                <div className="text-sm text-slate-500 italic bg-slate-50 p-3 rounded text-center">
                                                    Nenhum operador associado a esta máquina.
                                                </div>
                                            ) : (
                                                formData.operadores_vinculados.map((op, i) => (
                                                    <div key={op.id} className="flex gap-3 items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                                                        <div className="font-bold text-slate-400 text-xs w-5 text-center">{i + 1}</div>
                                                        <div className="flex-1">
                                                            <select
                                                                value={op.id_usuario}
                                                                onChange={e => updateOperador(op.id, 'id_usuario', e.target.value)}
                                                                className="w-full text-sm border border-slate-300 rounded p-2 focus:ring-1 focus:ring-indigo-500"
                                                            >
                                                                <option value="">Selecione o Usuário...</option>
                                                                {usuarios.map(u => (
                                                                    <option key={u.idUsuario} value={u.idUsuario}>{u.NomeCompleto}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div className="w-40">
                                                            <select
                                                                value={op.turno}
                                                                onChange={e => updateOperador(op.id, 'turno', e.target.value)}
                                                                className="w-full text-sm border border-slate-300 rounded p-2 focus:ring-1 focus:ring-indigo-500"
                                                            >
                                                                <option value="COMERCIAL">Turno Comercial</option>
                                                                <option value="MANHA">Turno da Manhã</option>
                                                                <option value="TARDE">Turno da Tarde</option>
                                                                <option value="NOITE">Turno da Noite</option>
                                                            </select>
                                                        </div>
                                                        <button 
                                                            type="button"
                                                            onClick={() => removeOperador(op.id)}
                                                            className="text-red-400 hover:text-red-600 p-1"
                                                            title="Remover Operador"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>
                        
                        <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-xl">
                            <button 
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="submit"
                                form="maquina-form"
                                disabled={saving}
                                className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {saving ? 'Salvando...' : <><Save size={18} /> Salvar Máquina</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
