import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Plus, Trash2, Edit2, AlertCircle, RefreshCw, Printer, Image as ImageIcon, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'react-toastify';

const NaoConformidades = () => {
    const [recursos, setRecursos] = useState([]);
    const [loadingRecursos, setLoadingRecursos] = useState(true);
    const [selectedRecurso, setSelectedRecurso] = useState('');
    
    const [naoConformidades, setNaoConformidades] = useState([]);
    const [loadingNc, setLoadingNc] = useState(false);
    
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);
    const [descricao, setDescricao] = useState('');
    const [tipo, setTipo] = useState('check');
    const [gravidade, setGravidade] = useState('observacao');
    const [imagemCorreta, setImagemCorreta] = useState('');
    const [imagemIncorreta, setImagemIncorreta] = useState('');

    useEffect(() => {
        fetchRecursos();
    }, []);

    useEffect(() => {
        if (selectedRecurso) {
            fetchNaoConformidades(selectedRecurso);
        } else {
            setNaoConformidades([]);
        }
    }, [selectedRecurso]);

    const fetchRecursos = async () => {
        try {
            setLoadingRecursos(true);
            const { data } = await api.get('/production/processes');
            // Assuming data returns { data: [...] }
            setRecursos(data.data || []);
        } catch (error) {
            console.error('Erro ao buscar recursos:', error);
            toast.error('Erro ao carregar lista de recursos');
        } finally {
            setLoadingRecursos(false);
        }
    };

    const fetchNaoConformidades = async (codigo) => {
        try {
            setLoadingNc(true);
            const { data } = await api.get(`/sgq/nao-conformidades/${codigo}`);
            setNaoConformidades(data);
        } catch (error) {
            console.error('Erro ao buscar não-conformidades:', error);
            toast.error('Erro ao carregar não-conformidades');
        } finally {
            setLoadingNc(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!descricao.trim()) return toast.warning('A descrição é obrigatória');
        if (!selectedRecurso) return toast.warning('Selecione um recurso primeiro');

        const payload = {
            recurso_codigo: selectedRecurso,
            descricao,
            tipo,
            gravidade,
            imagem_correta: imagemCorreta,
            imagem_incorreta: imagemIncorreta
        };

        try {
            if (isEditing) {
                await api.put(`/sgq/nao-conformidades/${editId}`, payload);
                toast.success('Não-conformidade atualizada');
            } else {
                await api.post('/sgq/nao-conformidades', payload);
                toast.success('Não-conformidade cadastrada');
            }
            
            resetForm();
            fetchNaoConformidades(selectedRecurso);
        } catch (error) {
            console.error('Erro ao salvar não-conformidade:', error);
            toast.error('Erro ao salvar os dados');
        }
    };

    const resetForm = () => {
        setDescricao('');
        setTipo('check');
        setGravidade('observacao');
        setImagemCorreta('');
        setImagemIncorreta('');
        setIsEditing(false);
        setEditId(null);
    };

    const handleEdit = (nc) => {
        setIsEditing(true);
        setEditId(nc.id);
        setDescricao(nc.descricao);
        setTipo(nc.tipo || 'check');
        setGravidade(nc.gravidade || 'observacao');
        setImagemCorreta(nc.imagem_correta || '');
        setImagemIncorreta(nc.imagem_incorreta || '');
    };

    const handleImageUpload = (e, setter) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            setter(reader.result);
        };
        reader.readAsDataURL(file);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Tem certeza que deseja excluir esta não-conformidade?')) return;
        try {
            await api.delete(`/sgq/nao-conformidades/${id}`);
            toast.success('Não-conformidade removida');
            fetchNaoConformidades(selectedRecurso);
        } catch (error) {
            console.error('Erro ao excluir não-conformidade:', error);
            toast.error('Erro ao remover o registro');
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
            <style type="text/css" media="print">
                {`@page { size: A4 portrait; margin: 15mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; }`}
            </style>

            <div className="mb-6 flex justify-between items-center border-b border-slate-100 pb-4 print:hidden">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <AlertCircle className="w-6 h-6 text-indigo-600" />
                        Padrões de Pendências / Não-Conformidades
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Cadastre as possíveis não-conformidades para cada operação ou recurso.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => window.print()} 
                        disabled={!selectedRecurso || naoConformidades.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition-colors rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Imprimir Relatório de Padrão"
                    >
                        <Printer className="w-4 h-4" /> Imprimir Relatório
                    </button>
                    <button 
                        onClick={fetchRecursos} 
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Recarregar Recursos"
                    >
                        <RefreshCw className={`w-5 h-5 ${loadingRecursos ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Cabeçalho de Impressão Lynx */}
            <div className="hidden print:block mb-8 text-center pt-4">
                <h1 className="text-2xl font-bold text-black uppercase tracking-wider mb-2 border-b-2 border-black pb-2">Lynx Indústria e Comércio</h1>
                <h2 className="text-lg font-semibold text-gray-800 uppercase">Padrão Visual de Não-Conformidade</h2>
                {selectedRecurso && (
                    <div className="mt-4 text-left p-3 border border-gray-300 rounded bg-gray-50 flex justify-between">
                        <div>
                            <span className="font-bold">Recurso/Operação:</span> {selectedRecurso}
                        </div>
                        <div>
                            <span className="font-bold">Data de Emissão:</span> {new Date().toLocaleDateString('pt-BR')}
                        </div>
                    </div>
                )}
            </div>

            <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Selecione o Recurso / Operação</label>
                <select 
                    className="w-full border border-slate-300 rounded-lg p-3 text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 disabled:bg-slate-100"
                    value={selectedRecurso}
                    onChange={(e) => {
                        setSelectedRecurso(e.target.value);
                        resetForm();
                    }}
                    disabled={loadingRecursos}
                >
                    <option value="">-- Selecione --</option>
                    {recursos.map((r, idx) => (<option key={`${r.codigo}-${idx}`} value={r.codigo}>
                            {r.codigo} - {r.descricao}
                        </option>
                    ))}
                </select>
            </div>

            {selectedRecurso && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Formulário */}
                    <div className="md:col-span-1 print:hidden">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                                {isEditing ? <Edit2 className="w-4 h-4 text-indigo-600" /> : <Plus className="w-4 h-4 text-indigo-600" />}
                                {isEditing ? 'Editar Não-Conformidade' : 'Nova Não-Conformidade'}
                            </h3>
                            <form onSubmit={handleSubmit}>
                                <div className="mb-4">
                                    <label className="block text-sm text-slate-600 mb-1">Descrição</label>
                                    <textarea 
                                        className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        rows="3"
                                        placeholder="Ex: Peça arranhada durante o corte..."
                                        value={descricao}
                                        onChange={(e) => setDescricao(e.target.value)}
                                        required
                                    ></textarea>
                                </div>
                                <div className="mb-4">
                                    <label className="block text-sm text-slate-600 mb-1">Tipo de Resposta</label>
                                    <select 
                                        className="w-full border border-slate-300 rounded-lg p-2 bg-white"
                                        value={tipo}
                                        onChange={(e) => setTipo(e.target.value)}
                                    >
                                        <option value="check">Check (OK / Não OK)</option>
                                        <option value="numero">Valor Numérico (Medição)</option>
                                        <option value="texto">Texto (Observação)</option>
                                    </select>
                                </div>
                                <div className="mb-4">
                                    <label className="block text-sm text-slate-600 mb-1">Gravidade / Categoria</label>
                                    <select 
                                        className="w-full border border-slate-300 rounded-lg p-2 bg-white"
                                        value={gravidade}
                                        onChange={(e) => setGravidade(e.target.value)}
                                    >
                                        <option value="observacao">Ponto de Observação (Suave)</option>
                                        <option value="moderada">Moderada (Atenção)</option>
                                        <option value="critica">Crítica (Impede Aprovação)</option>
                                    </select>
                                </div>
                                
                                <div className="mb-4 border border-slate-200 rounded p-3 bg-white">
                                    <label className="block text-sm font-semibold text-green-700 mb-1 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Padrão Aceitável (Correto)</label>
                                    <input 
                                        type="file" 
                                        accept="image/*"
                                        onChange={(e) => handleImageUpload(e, setImagemCorreta)}
                                        className="text-xs text-slate-500 w-full mb-2"
                                    />
                                    {imagemCorreta && <img src={imagemCorreta} alt="Correto" className="h-20 object-contain border border-green-200 rounded" />}
                                </div>

                                <div className="mb-6 border border-slate-200 rounded p-3 bg-white">
                                    <label className="block text-sm font-semibold text-red-700 mb-1 flex items-center gap-1"><XCircle className="w-4 h-4" /> Padrão Inaceitável (Errado)</label>
                                    <input 
                                        type="file" 
                                        accept="image/*"
                                        onChange={(e) => handleImageUpload(e, setImagemIncorreta)}
                                        className="text-xs text-slate-500 w-full mb-2"
                                    />
                                    {imagemIncorreta && <img src={imagemIncorreta} alt="Incorreto" className="h-20 object-contain border border-red-200 rounded" />}
                                </div>

                                <div className="flex gap-2">
                                    <button 
                                        type="submit" 
                                        className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                                    >
                                        {isEditing ? 'Atualizar' : 'Salvar'}
                                    </button>
                                    {isEditing && (
                                        <button 
                                            type="button" 
                                            onClick={resetForm}
                                            className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300 transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                    )}
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* Lista */}
                    <div className="md:col-span-2">
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-50">
                                    <tr className="print:bg-gray-100">
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider print:text-black print:border print:border-black">
                                            Critério de Avaliação
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider print:text-black print:border print:border-black">
                                            Padrão Correto
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider print:text-black print:border print:border-black">
                                            Padrão Incorreto
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider w-24 print:hidden">
                                            Ações
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-200">
                                    {loadingNc ? (
                                        <tr>
                                            <td colSpan="2" className="px-6 py-8 text-center text-slate-500">
                                                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                                                Carregando...
                                            </td>
                                        </tr>
                                    ) : naoConformidades.length === 0 ? (
                                        <tr>
                                            <td colSpan="2" className="px-6 py-8 text-center text-slate-500">
                                                Nenhuma não-conformidade cadastrada para este recurso.
                                            </td>
                                        </tr>
                                    ) : (
                                        naoConformidades.map(nc => (
                                            <tr key={nc.id} className="hover:bg-slate-50 transition-colors print:break-inside-avoid print:border-b print:border-black">
                                                <td className="px-6 py-4 text-sm text-slate-700 print:text-black print:border print:border-black align-top">
                                                    <div className="font-bold mb-1">{nc.descricao}</div>
                                                    <div className="flex gap-2 mb-1 print:hidden">
                                                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs border border-slate-200">
                                                            {nc.tipo === 'check' ? '☑️ Check (OK/NOK)' : nc.tipo === 'numero' ? '🔢 Medição Numérica' : '📝 Texto / Obs'}
                                                        </span>
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border font-medium ${
                                                            nc.gravidade === 'critica' ? 'bg-red-50 text-red-700 border-red-200' : 
                                                            nc.gravidade === 'moderada' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                                                            'bg-blue-50 text-blue-700 border-blue-200'
                                                        }`}>
                                                            {nc.gravidade === 'critica' ? '🚨 Crítica' : nc.gravidade === 'moderada' ? '⚠️ Moderada' : 'ℹ️ Observação'}
                                                        </span>
                                                    </div>
                                                    {/* Versão impressão com apenas texto limpo */}
                                                    <div className="hidden print:block text-xs mt-2 italic text-gray-700">
                                                        [{nc.tipo === 'check' ? 'Check OK/NOK' : nc.tipo === 'numero' ? 'Medição' : 'Texto'}] - 
                                                        [{nc.gravidade === 'critica' ? 'CRÍTICA' : nc.gravidade === 'moderada' ? 'MODERADA' : 'OBSERVAÇÃO'}]
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center align-top print:border print:border-black">
                                                    {nc.imagem_correta ? (
                                                        <img src={nc.imagem_correta} alt="Correto" className="h-24 w-24 object-cover rounded mx-auto border-2 border-green-500 print:border-black print:h-32 print:w-32" />
                                                    ) : (
                                                        <span className="text-xs text-slate-400 italic">Sem imagem</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center align-top print:border print:border-black">
                                                    {nc.imagem_incorreta ? (
                                                        <img src={nc.imagem_incorreta} alt="Incorreto" className="h-24 w-24 object-cover rounded mx-auto border-2 border-red-500 print:border-black print:h-32 print:w-32" />
                                                    ) : (
                                                        <span className="text-xs text-slate-400 italic">Sem imagem</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium align-top print:hidden">
                                                    <button 
                                                        onClick={() => handleEdit(nc)} 
                                                        className="text-indigo-600 hover:text-indigo-900 mr-3 p-1 rounded hover:bg-indigo-50 transition-colors"
                                                        title="Editar"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete(nc.id)} 
                                                        className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 transition-colors"
                                                        title="Excluir"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NaoConformidades;
