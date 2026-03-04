import React, { useState, useEffect } from 'react';
import { FileText, Link as LinkIcon, Plus, Trash2, ExternalLink } from 'lucide-react';
import api, { getProductDocuments } from '../services/api';

// Componente deve ser inserido na página de Estrutura ou Detalhe
const ProductDocuments = ({ produtoCodigo }) => {
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(false);

    // Form states
    const [isAdding, setIsAdding] = useState(false);
    const [newDoc, setNewDoc] = useState({ titulo: '', url_arquivo: '', tipo: 'Desenho' });

    const fetchDocs = async () => {
        setLoading(true);
        try {
            const data = await getProductDocuments(produtoCodigo);
            setDocs(data);
        } catch (error) {
            console.error("Erro ao carregar documentos:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (produtoCodigo) fetchDocs();
    }, [produtoCodigo]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/docs', {
                produto_codigo: produtoCodigo,
                ...newDoc
            });
            setNewDoc({ titulo: '', url_arquivo: '', tipo: 'Desenho' });
            setIsAdding(false);
            fetchDocs();
        } catch (error) {
            alert('Erro ao salvar documento. Verifique o console.');
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
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <h3 className="text-lg font-bold text-gray-800">Documentos & Arquivos</h3>
                </div>
                {!isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-1 text-sm text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors font-medium border border-transparent hover:border-blue-100"
                    >
                        <Plus className="h-4 w-4" />
                        Adicionar Link
                    </button>
                )}
            </div>

            {/* Form de Adição */}
            {isAdding && (
                <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-lg mb-4 border border-blue-100 animate-fadeIn">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-3">
                        <div className="md:col-span-3">
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Tipo</label>
                            <select
                                value={newDoc.tipo}
                                onChange={e => setNewDoc({ ...newDoc, tipo: e.target.value })}
                                className="w-full rounded border-gray-300 p-2 text-sm focus:border-blue-500 outline-none bg-white"
                            >
                                <option value="Desenho">Desenho 📐</option>
                                <option value="Manual">Manual 📖</option>
                                <option value="Datasheet">Datasheet 📊</option>
                                <option value="Outro">Outro 📎</option>
                            </select>
                        </div>
                        <div className="md:col-span-4">
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Título do Documento</label>
                            <input
                                type="text"
                                placeholder="Ex: Manual Técnico, Datasheet..."
                                value={newDoc.titulo}
                                onChange={e => setNewDoc({ ...newDoc, titulo: e.target.value })}
                                className="w-full rounded border-gray-300 p-2 text-sm focus:border-blue-500 outline-none"
                                required
                            />
                        </div>
                        <div className="md:col-span-5">
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Link / Caminho do Arquivo</label>
                            <input
                                type="text"
                                placeholder="C:\Docs\manual.pdf ou https://..."
                                value={newDoc.url_arquivo}
                                onChange={e => setNewDoc({ ...newDoc, url_arquivo: e.target.value })}
                                className="w-full rounded border-gray-300 p-2 text-sm focus:border-blue-500 outline-none"
                                required
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setIsAdding(false)}
                            className="text-gray-500 hover:text-gray-700 text-sm px-3 py-1"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded hover:bg-blue-700 transition-colors"
                        >
                            Salvar Link
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
                                                doc.tipo === 'Manual' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' :
                                                    'bg-gray-100 text-gray-600 border-gray-200'
                                                }`}>
                                                {doc.tipo}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <a
                                            href={`http://${window.location.hostname}:3001/api/docs/view?path=${encodeURIComponent(doc.url_arquivo)}`}
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
                            <button
                                onClick={() => handleDelete(doc.id)}
                                className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-600 transition-all"
                                title="Remover"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ProductDocuments;
