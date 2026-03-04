import React, { useState, useEffect } from 'react';
import { X, Image as ImageIcon, Check, Loader2 } from 'lucide-react';
import { saveProductImage } from '../services/api';

export default function ProductImageModal({ product, onClose, onSuccess }) {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (product) setUrl(product.imagem_url || '');
    }, [product]);

    const handleSave = async () => {
        if (!url) return;
        setLoading(true);
        try {
            await saveProductImage(product.codigo, url);
            onSuccess();
        } catch (err) {
            alert('Erro ao salvar imagem');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <ImageIcon className="h-5 w-5 text-blue-600" />
                        Imagem do Produto
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full"><X className="h-5 w-5" /></button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="bg-slate-50 p-4 rounded text-center">
                        {url ? (
                            <img src={url} alt="Preview" className="max-h-48 mx-auto rounded shadow-sm" onError={(e) => e.target.src = 'https://placehold.co/200x200?text=Inválido'} />
                        ) : (
                            <div className="h-32 flex items-center justify-center text-gray-400">
                                <ImageIcon className="w-12 h-12" />
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">URL da Imagem</label>
                        <input
                            type="text"
                            placeholder="https://exemplo.com/imagem.jpg"
                            value={url}
                            onChange={e => setUrl(e.target.value)}
                            className="w-full p-2 border rounded-lg focus:border-blue-500 outline-none"
                            autoFocus
                        />
                        <p className="text-xs text-gray-400">Cole o link direto da imagem (Google Drive, Site, etc)</p>
                    </div>

                    <div className="flex justify-end pt-2">
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            Salvar Imagem
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
