import React, { useState, useEffect } from 'react';
import { X, Link as LinkIcon, Plus, Trash2, ArrowRightLeft, Loader2 } from 'lucide-react';
import { getProductAssociations, createProductAssociation, deleteProductAssociation } from '../services/api';

export default function ProductAssociationsModal({ product, onClose }) {
    const [associations, setAssociations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [newAssoc, setNewAssoc] = useState({
        destino: '',
        tipo: 'Relacionado',
        obs: ''
    });

    useEffect(() => {
        if (product) fetchAssociations();
    }, [product]);

    const fetchAssociations = async () => {
        setLoading(true);
        try {
            const data = await getProductAssociations(product.codigo);
            setAssociations(data);
        } catch (err) {
            alert('Erro ao carregar associações');
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async () => {
        if (!newAssoc.destino) return;
        setLoading(true);
        try {
            await createProductAssociation(product.codigo, {
                produto_destino: newAssoc.destino,
                tipo: newAssoc.tipo,
                comentario: newAssoc.obs
            });
            setNewAssoc({ destino: '', tipo: 'Relacionado', obs: '' });
            fetchAssociations();
        } catch (err) {
            alert('Erro ao criar associação');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Remover esta associação?')) return;
        setLoading(true);
        try {
            await deleteProductAssociation(product.codigo, id);
            fetchAssociations();
        } catch (err) {
            alert('Erro ao remover');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <LinkIcon className="h-5 w-5 text-blue-600" />
                        Associações: {product.codigo}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full"><X className="h-5 w-5" /></button>
                </div>

                <div className="p-4 space-y-4">
                    {/* Form */}
                    <div className="bg-slate-50 p-3 rounded border text-sm space-y-2">
                        <div className="flex gap-2">
                            <input
                                placeholder="Cód. Produto Associado"
                                className="flex-1 p-2 border rounded"
                                value={newAssoc.destino}
                                onChange={e => setNewAssoc({ ...newAssoc, destino: e.target.value })}
                            />
                            <select
                                className="p-2 border rounded"
                                value={newAssoc.tipo}
                                onChange={e => setNewAssoc({ ...newAssoc, tipo: e.target.value })}
                            >
                                <option>Relacionado</option>
                                <option>Componente</option>
                                <option>Acessório</option>
                                <option>Opção</option>
                            </select>
                        </div>
                        <div className="flex gap-2">
                            <input
                                placeholder="Observação (opcional)"
                                className="flex-1 p-2 border rounded"
                                value={newAssoc.obs}
                                onChange={e => setNewAssoc({ ...newAssoc, obs: e.target.value })}
                            />
                            <button
                                onClick={handleAdd}
                                disabled={loading}
                                className="bg-blue-600 text-white px-3 rounded hover:bg-blue-700 flex items-center gap-1"
                            >
                                <Plus className="w-4 h-4" /> Add
                            </button>
                        </div>
                    </div>

                    {/* List */}
                    <div className="max-h-60 overflow-y-auto space-y-2">
                        {Array.isArray(associations) && associations.map(assoc => {
                            const isOrigin = assoc.produto_origem === product.codigo;
                            const other = isOrigin ? assoc.produto_destino : assoc.produto_origem;
                            return (
                                <div key={assoc.id} className="flex justify-between items-center border p-2 rounded hover:bg-slate-50 text-sm">
                                    <div className="flex items-center gap-2">
                                        <ArrowRightLeft className="w-4 h-4 text-slate-400" />
                                        <div>
                                            <div className="font-bold text-slate-700">{other}</div>
                                            <div className="text-xs text-slate-500">{assoc.tipo_associacao} {assoc.comentario && `- ${assoc.comentario}`}</div>
                                        </div>
                                    </div>
                                    <button onClick={() => handleDelete(assoc.id)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            );
                        })}
                        {associations.length === 0 && <p className="text-center text-slate-400 py-4">Nenhuma associação.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}
