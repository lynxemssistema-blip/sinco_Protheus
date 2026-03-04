import React, { useState } from 'react';
import { FolderInput, Loader2, AlertCircle, CheckCircle, X } from 'lucide-react';
import api from '../services/api';

const BulkImportModal = ({ onClose, onSuccess }) => {
    const [folderPath, setFolderPath] = useState('');
    const [overwrite, setOverwrite] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const handleImport = async () => {
        if (!folderPath.trim()) {
            setError('Por favor, informe o caminho da pasta.');
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            // Nota: O endpoint é /api/docs/bulk, mas o axios base já pode ter /api.
            // Ajustar conforme services/api.js. Assumindo que api.post('/docs/bulk') resolve para /api/docs/bulk
            const response = await api.post('/docs/bulk', {
                folderPath,
                overwrite
            });

            setResult(response.data);
            if (onSuccess) onSuccess();
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || err.response?.data?.error || 'Erro ao realizar importação. Verifique se o caminho existe no servidor.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fadeIn">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <FolderInput className="h-6 w-6 text-blue-600" />
                        Importação em Massa
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full p-2 transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {!result ? (
                        <>
                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800">
                                <p className="font-semibold mb-1">Como funciona?</p>
                                <p>O sistema irá varrer a pasta informada (e subpastas) no servidor.</p>
                                <p>Arquivos com nome igual ao código do produto serão vinculados automaticamente.</p>
                                <p className="mt-2 text-xs opacity-75">Ex: <b>XA100.pdf</b> será vinculado ao produto <b>XA100</b>.</p>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">Caminho da Pasta (Servidor)</label>
                                <input
                                    type="text"
                                    value={folderPath}
                                    onChange={(e) => setFolderPath(e.target.value)}
                                    placeholder="Ex: C:\Arquivos\Engenharia"
                                    className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                />
                                <p className="text-xs text-gray-400">Use caminhos absolutos locais do servidor. A barra invertida (\) é suportada.</p>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="overwrite"
                                    checked={overwrite}
                                    onChange={(e) => setOverwrite(e.target.checked)}
                                    className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                />
                                <label htmlFor="overwrite" className="text-sm text-gray-700 cursor-pointer select-none">
                                    Atualizar (sobrescrever) vínculos existentes para o mesmo arquivo
                                </label>
                            </div>

                            {error && (
                                <div className="flex items-start gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm">
                                    <AlertCircle className="h-5 w-5 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div className="pt-4 flex justify-end gap-3">
                                <button
                                    onClick={onClose}
                                    disabled={loading}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleImport}
                                    disabled={loading}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-70 disabled:cursor-wait flex items-center gap-2"
                                >
                                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {loading ? 'Processando...' : 'Iniciar Importação'}
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="text-center space-y-6 py-4">
                            <div className="flex justify-center">
                                <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
                                    <CheckCircle className="h-8 w-8 text-green-600" />
                                </div>
                            </div>

                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Importação Concluída!</h3>
                                <p className="text-gray-500 text-sm mt-1">{result.details}</p>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-left bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <div className="p-3 bg-white rounded-lg shadow-sm border-l-4 border-gray-400">
                                    <p className="text-xs text-gray-500 uppercase font-bold">Processados</p>
                                    <p className="text-2xl font-mono text-gray-900">{result.stats.processed}</p>
                                </div>
                                <div className="p-3 bg-white rounded-lg shadow-sm border-l-4 border-green-500">
                                    <p className="text-xs text-gray-500 uppercase font-bold">Vinculados</p>
                                    <p className="text-2xl font-mono text-green-700">{result.stats.linked}</p>
                                </div>
                                <div className="p-3 bg-white rounded-lg shadow-sm border-l-4 border-blue-500">
                                    <p className="text-xs text-gray-500 uppercase font-bold">Atualizados</p>
                                    <p className="text-2xl font-mono text-blue-700">{result.stats.updated}</p>
                                </div>
                                <div className="p-3 bg-white rounded-lg shadow-sm border-l-4 border-yellow-500">
                                    <p className="text-xs text-gray-500 uppercase font-bold">Ignorados</p>
                                    <p className="text-2xl font-mono text-yellow-700">{result.stats.skipped}</p>
                                </div>
                                <div className="p-3 bg-white rounded-lg shadow-sm border-l-4 border-red-500">
                                    <p className="text-xs text-red-500 uppercase font-bold">Erros (Falhas DB)</p>
                                    <p className="text-2xl font-mono text-red-700">{result.stats.errors}</p>
                                </div>
                            </div>

                            <button
                                onClick={onClose}
                                className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-medium transition-all"
                            >
                                Fechar
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BulkImportModal;
