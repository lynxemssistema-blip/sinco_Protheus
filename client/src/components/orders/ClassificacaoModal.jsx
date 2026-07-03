import React, { useState, useEffect } from 'react';
import { X, Upload, FileText, Trash2, Download } from 'lucide-react';
import { api } from '../../services/api';
import { toast } from 'react-toastify';

export default function ClassificacaoModal({ isOpen, onClose, item, onSaveSuccess, canEdit = true }) {
    const [classificacao, setClassificacao] = useState('Nenhum');
    const [ppapNumero, setPpapNumero] = useState('');
    const [dataAtualizacao, setDataAtualizacao] = useState('');
    const [anexos, setAnexos] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen && item) {
            setClassificacao(item.classificacao || 'Nenhum');
            setPpapNumero(item.ppap_numero || '');
            if (item.data_atualizacao) {
                // Ensure date is in YYYY-MM-DD format for input type="date"
                const dateObj = new Date(item.data_atualizacao);
                if (!isNaN(dateObj.getTime())) {
                    setDataAtualizacao(dateObj.toISOString().split('T')[0]);
                } else {
                    setDataAtualizacao(item.data_atualizacao);
                }
            } else {
                setDataAtualizacao('');
            }
            fetchAnexos();
        }
    }, [isOpen, item]);

    const fetchAnexos = async () => {
        try {
            if (!item?.pedido || !item?.item) return;
            const res = await api.get(`/pedidos/classificacao/anexos/${item.pedido}/${item.item}`);
            setAnexos(res.data);
        } catch (error) {
            console.error('Erro ao buscar anexos:', error);
            toast.error('Não foi possível carregar os anexos.');
        }
    };

    const handleSave = async () => {
        try {
            setIsSaving(true);
            const data = {
                pedido: item.pedido,
                item: item.item,
                classificacao,
                ppap_numero: classificacao.includes('PPAP') ? ppapNumero : null,
                data_atualizacao: classificacao.includes('PPAP') ? dataAtualizacao : null
            };

            await api.post('/pedidos/classificacao', data);
            toast.success('Classificação salva com sucesso!');
            
            if (onSaveSuccess) {
                onSaveSuccess({ ...item, ...data });
            }
            onClose();
        } catch (error) {
            console.error('Erro ao salvar classificação:', error);
            toast.error('Erro ao salvar os dados.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            setIsUploading(true);
            const formData = new FormData();
            formData.append('file', file);
            formData.append('pedido', item.pedido);
            formData.append('item', item.item);

            await api.post('/pedidos/classificacao/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            toast.success('Arquivo anexado com sucesso!');
            fetchAnexos();
        } catch (error) {
            console.error('Erro no upload:', error);
            toast.error('Erro ao anexar arquivo.');
        } finally {
            setIsUploading(false);
            e.target.value = ''; // Reset input
        }
    };

    const handleDeleteAnexo = async (id) => {
        if (!window.confirm('Deseja realmente remover este anexo?')) return;
        
        try {
            await api.delete(`/pedidos/classificacao/anexos/${id}`);
            toast.success('Anexo removido!');
            fetchAnexos();
        } catch (error) {
            console.error('Erro ao remover anexo:', error);
            toast.error('Erro ao remover arquivo.');
        }
    };

    if (!isOpen) return null;

    const showPpapFields = classificacao.includes('PPAP');

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl w-[500px] max-w-full flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b border-slate-200">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">Classificação do Item</h2>
                        <p className="text-sm text-slate-500">
                            Pedido {item?.pedido} • Item {item?.item} • {item?.c6_prod}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 overflow-y-auto flex-1 space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Classificação</label>
                        <select
                            value={classificacao}
                            onChange={(e) => setClassificacao(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        >
                            <option value="Nenhum">Nenhum</option>
                            <option value="Jits">Jits</option>
                            <option value="PPAP">PPAP</option>
                            <option value="Jits e PPAP">Jits e PPAP</option>
                        </select>
                    </div>

                    {showPpapFields && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Número do PPAP</label>
                                <input
                                    type="text"
                                    value={ppapNumero}
                                    onChange={(e) => setPpapNumero(e.target.value)}
                                    placeholder="Ex: PPAP-1234"
                                    disabled={!canEdit}
                                    className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Data de Atualização</label>
                                <input
                                    type="date"
                                    value={dataAtualizacao}
                                    onChange={(e) => setDataAtualizacao(e.target.value)}
                                    disabled={!canEdit}
                                    className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
                                />
                            </div>
                        </div>
                    )}

                    <div className="mt-6">
                        <h3 className="text-sm font-bold text-slate-700 mb-2 border-b pb-1">Anexos</h3>
                        
                        {canEdit && (
                            <div className="mb-3">
                                <label className="flex items-center justify-center w-full h-20 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
                                    <div className="flex flex-col items-center justify-center">
                                        <Upload size={20} className="text-slate-400 mb-1" />
                                        <span className="text-xs text-slate-500 font-medium">
                                            {isUploading ? 'Enviando...' : 'Clique para enviar arquivo (PDF ou Imagem)'}
                                        </span>
                                    </div>
                                    <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} accept=".pdf,image/*" />
                                </label>
                            </div>
                        )}

                        {anexos.length > 0 ? (
                            <ul className="space-y-2">
                                {anexos.map((anexo) => (
                                    <li key={anexo.id} className="flex items-center justify-between bg-white border border-slate-200 rounded p-2 text-sm">
                                        <div className="flex items-center flex-1 truncate mr-2">
                                            <FileText size={16} className="text-indigo-500 mr-2 flex-shrink-0" />
                                            <a 
                                                href={`${import.meta.env.VITE_API_URL || ''}${anexo.url}`} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="truncate text-slate-700 hover:text-indigo-600 hover:underline"
                                                title={anexo.original_name}
                                            >
                                                {anexo.original_name}
                                            </a>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <a 
                                                href={`${import.meta.env.VITE_API_URL || ''}${anexo.url}`} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="text-slate-400 hover:text-indigo-600"
                                                title="Baixar"
                                            >
                                                <Download size={16} />
                                            </a>
                                            {canEdit && (
                                                <button 
                                                    onClick={() => handleDeleteAnexo(anexo.id)}
                                                    className="text-slate-400 hover:text-red-600"
                                                    title="Excluir"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-xs text-slate-400 text-center italic py-2">Nenhum anexo encontrado.</p>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-slate-200 flex justify-end space-x-2 bg-slate-50">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded"
                    >
                        {canEdit ? 'Cancelar' : 'Fechar'}
                    </button>
                    {canEdit && (
                        <button 
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded disabled:opacity-50"
                        >
                            {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
