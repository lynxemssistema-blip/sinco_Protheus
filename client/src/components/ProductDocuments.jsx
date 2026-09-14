import React, { useState, useEffect } from 'react';
import { FileText, Link as LinkIcon, Plus, Trash2, ExternalLink, UploadCloud, Paperclip } from 'lucide-react';
import api, { getProductDocuments, getFileUrl } from '../services/api';

// Componente para listagem e anexação de documentos
const ProductDocuments = ({ produtoCodigo, altCodigo = null, canEdit = true }) => {
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(false);

    // Form states
    const [isAdding, setIsAdding] = useState(false);
    const [addMode, setAddMode] = useState('upload'); // 'upload' | 'link'
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [newDoc, setNewDoc] = useState({ titulo: 'Desenho', url_arquivo: '', tipo: 'Desenho' });

    const fetchDocs = async () => {
        setLoading(true);
        try {
            const data = await getProductDocuments(produtoCodigo, altCodigo);
            setDocs(data);
        } catch (error) {
            console.error("Erro ao carregar documentos:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (produtoCodigo || altCodigo) fetchDocs();
    }, [produtoCodigo, altCodigo]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (addMode === 'upload') {
                if (!selectedFile) {
                    alert('Por favor, selecione um arquivo PDF para anexar.');
                    return;
                }
                setUploading(true);
                const formData = new FormData();
                formData.append('file', selectedFile);
                formData.append('produto_codigo', produtoCodigo);
                formData.append('titulo', newDoc.titulo || selectedFile.name);
                formData.append('tipo', newDoc.tipo);

                await api.post('/docs/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                setSelectedFile(null);
            } else {
                await api.post('/docs', {
                    produto_codigo: produtoCodigo,
                    ...newDoc
                });
            }

            setNewDoc({ titulo: 'Desenho', url_arquivo: '', tipo: 'Desenho' });
            setIsAdding(false);
            fetchDocs();
        } catch (error) {
            console.error(error);
            alert('Erro ao salvar documento. ' + (error.response?.data?.error || error.message));
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Tem certeza que deseja remover este link?')) return;
        try {
            await api.delete(`/docs/${id}`);
            fetchDocs();
        } catch (error) {
            alert('Erro ao excluir.');
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-gray-500" />
                    Documentos ({docs.length})
                </h3>
                {canEdit && (
                    <button
                        onClick={() => setIsAdding(!isAdding)}
                        className="flex items-center gap-1 text-sm bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors font-medium"
                    >
                        <Plus className="h-4 w-4" />
                        Vincular Arquivo
                    </button>
                )}
            </div>

            {/* Form de Adição */}
            {isAdding && (
                <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-lg mb-4 border border-blue-100 animate-fadeIn">
                    {/* Seletor de Modo: Upload direto vs Caminho de Rede */}
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
                        <button
                            type="button"
                            onClick={() => setAddMode('upload')}
                            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition ${addMode === 'upload' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
                        >
                            <UploadCloud className="w-3.5 h-3.5" />
                            Upload de Arquivo (PDF)
                        </button>
                        <button
                            type="button"
                            onClick={() => setAddMode('link')}
                            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition ${addMode === 'link' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
                        >
                            <LinkIcon className="w-3.5 h-3.5" />
                            Caminho de Rede / UNC
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-3">
                        <div className="md:col-span-3">
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Tipo</label>
                            <select
                                value={newDoc.tipo}
                                onChange={e => {
                                    const tipo = e.target.value;
                                    const autoTitles = {
                                        'Desenho': 'Desenho',
                                        'Manual': 'Manual',
                                        'Datasheet': 'Datasheet',
                                        'Gabarito': 'Gabarito'
                                    };
                                    let newTitle = newDoc.titulo;
                                    if (!newTitle || Object.values(autoTitles).includes(newTitle)) {
                                        newTitle = autoTitles[tipo] || '';
                                    }
                                    setNewDoc({ ...newDoc, tipo, titulo: newTitle });
                                }}
                                className="w-full rounded border-gray-300 p-2 text-sm focus:border-blue-500 outline-none bg-white"
                            >
                                <option value="Desenho">Desenho 📐</option>
                                <option value="Gabarito">Gabarito 📏</option>
                                <option value="Manual">Manual 📖</option>
                                <option value="Datasheet">Datasheet 📊</option>
                                <option value="Outro">Outro 📎</option>
                            </select>
                        </div>
                        <div className="md:col-span-4">
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Título do Documento</label>
                            <input
                                type="text"
                                placeholder="Ex: Desenho Técnico..."
                                value={newDoc.titulo}
                                onChange={e => setNewDoc({ ...newDoc, titulo: e.target.value })}
                                className="w-full rounded border-gray-300 p-2 text-sm focus:border-blue-500 outline-none bg-white"
                                required
                            />
                        </div>
                        <div className="md:col-span-5">
                            {addMode === 'upload' ? (
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1">Selecionar Arquivo PDF</label>
                                    <input
                                        type="file"
                                        accept=".pdf,application/pdf"
                                        onChange={e => {
                                            const f = e.target.files?.[0];
                                            setSelectedFile(f || null);
                                            if (f && (!newDoc.titulo || newDoc.titulo === 'Desenho')) {
                                                setNewDoc({ ...newDoc, titulo: f.name.replace(/\.[^/.]+$/, '') });
                                            }
                                        }}
                                        className="w-full text-xs text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer bg-white border border-gray-300 rounded p-1"
                                        required
                                    />
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1">Caminho do Arquivo (UNC ou URL)</label>
                                    <input
                                        type="text"
                                        placeholder="\\\\192.168.1.253\\Engenharia\\desenho.pdf"
                                        value={newDoc.url_arquivo}
                                        onChange={e => setNewDoc({ ...newDoc, url_arquivo: e.target.value })}
                                        className="w-full rounded border-gray-300 p-2 text-sm focus:border-blue-500 outline-none bg-white"
                                        required
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => { setIsAdding(false); setSelectedFile(null); }}
                            className="text-gray-500 hover:text-gray-700 text-sm px-3 py-1"
                            disabled={uploading}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={uploading}
                            className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded hover:bg-blue-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                            {uploading && <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                            {uploading ? 'Salvando...' : (addMode === 'upload' ? 'Enviar e Anexar' : 'Salvar Link')}
                        </button>
                    </div>
                </form>
            )}

            {/* Lista */}
            {loading ? (
                <div className="flex justify-center py-4">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                </div>
            ) : docs.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-sm bg-gray-50/50 rounded-lg border border-dashed border-gray-200">
                    Nenhum documento associado.
                </div>
            ) : (
                <div className="space-y-2">
                    {docs.map(doc => (
                        <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200 transition-all group">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className={`p-2 rounded border border-gray-200 ${doc.tipo === 'Desenho' ? 'bg-blue-50 text-blue-600' :
                                    doc.tipo === 'Gabarito' ? 'bg-cyan-50 text-cyan-600' :
                                    doc.tipo === 'Manual' ? 'bg-indigo-50 text-indigo-600' :
                                    'bg-white text-gray-500'
                                    }`}>
                                    <FileText className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-medium text-gray-800 truncate">{doc.titulo}</h4>
                                        {doc.tipo && (
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase font-bold tracking-wider ${doc.tipo === 'Desenho' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                                doc.tipo === 'Gabarito' ? 'bg-cyan-100 text-cyan-700 border-cyan-200' :
                                                doc.tipo === 'Manual' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' :
                                                'bg-gray-100 text-gray-600 border-gray-200'
                                                }`}>
                                                {doc.tipo}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <a
                                            href={getFileUrl(`/api/docs/view?path=${encodeURIComponent(doc.url_arquivo)}`)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-blue-600 hover:underline flex items-center gap-1 truncate font-medium bg-blue-50 px-2 py-1 rounded"
                                        >
                                            <ExternalLink className="h-3 w-3" />
                                            Abrir Arquivo
                                        </a>
                                        <span className="text-xs text-gray-400 truncate max-w-[200px]" title={doc.url_arquivo}>
                                            {doc.url_arquivo}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            {canEdit && (
                                <button
                                    onClick={() => handleDelete(doc.id)}
                                    className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-600 transition-all"
                                    title="Remover"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ProductDocuments;
