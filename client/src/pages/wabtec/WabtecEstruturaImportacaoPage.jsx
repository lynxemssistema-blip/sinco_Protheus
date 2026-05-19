import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, FileUp, CheckCircle2, RefreshCw, Trash2, Layers, Search, Save } from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-toastify';

export default function WabtecEstruturaImportacaoPage({ selectedLote, setSelectedLote }) {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [previewMode, setPreviewMode] = useState(false);
    const [previewData, setPreviewData] = useState([]);
    const [headers, setHeaders] = useState([]);
    const [lotes, setLotes] = useState([]);
    const [loadingData, setLoadingData] = useState(false);
    const [loteData, setLoteData] = useState([]);
    const [loteHeaders, setLoteHeaders] = useState([]);
    const [nomeAba, setNomeAba] = useState('');
    const [abas, setAbas] = useState([]);
    const [abaSelecionada, setAbaSelecionada] = useState('');
    const [uploadedFilePath, setUploadedFilePath] = useState(null);
    const [step, setStep] = useState(1); // 1: Select File, 2: Select Aba, 3: Preview
    
    const fileInputRef = useRef(null);

    const fetchLotes = async (isInitial = false) => {
        try {
            const { data } = await api.get('/wabtec/lotes');
            const loaded = data.data || [];
            setLotes(loaded);
            if (isInitial && loaded.length > 0 && !selectedLote) {
                handleSelectLote(loaded[0].lote_id);
            } else if (loaded.length === 0) {
                setSelectedLote(null);
                setLoteData([]);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleSelectLote = async (loteId) => {
        setSelectedLote(loteId);
        setLoadingData(true);
        try {
            const res = await api.get(`/wabtec/estruturas?lote_id=${loteId}`);
            const data = res.data.data || [];
            setLoteData(data);
            if (data.length > 0) {
                try {
                    const lote = lotes.find(l => l.lote_id === loteId);
                    if (lote && lote.headers && lote.headers.length > 0) {
                        let parsedHeaders = typeof lote.headers === 'string' ? JSON.parse(lote.headers) : lote.headers;
                        setLoteHeaders(parsedHeaders);
                    } else {
                        const parsed = JSON.parse(data[0].raw_data);
                        setLoteHeaders(parsed.map((_, i) => `Col ${i+1}`));
                    }
                } catch(e) {
                    setLoteHeaders([]);
                }
            } else {
                setLoteHeaders([]);
            }
        } catch (err) {
            toast.error("Erro ao carregar dados do lote.");
        } finally {
            setLoadingData(false);
        }
    };

    useEffect(() => {
        fetchLotes(true);
    }, []);

    const handleAtualizar = () => {
        fetchLotes(false);
        if (selectedLote) handleSelectLote(selectedLote);
    };

    const handleFileChange = (e) => {
        if (e.target.files?.[0]) setFile(e.target.files[0]);
    };

    const handleLerAbas = async () => {
        if (!file) return toast.warning("Selecione um arquivo Excel.");
        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const { data } = await api.post('/wabtec/ler-abas', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setAbas(data.abas || []);
            setUploadedFilePath(data.filePath);
            setStep(2);
            toast.success("Abas lidas com sucesso. Selecione a aba desejada.");
        } catch (err) {
            toast.error("Erro ao processar arquivo.");
        } finally {
            setUploading(false);
        }
    };

    const handleProcessarAba = async () => {
        if (!abaSelecionada) return toast.warning("Selecione uma aba.");
        setUploading(true);
        try {
            const { data } = await api.post('/wabtec/upload-estrutura', {
                filePath: uploadedFilePath,
                aba_selecionada: abaSelecionada,
                originalName: file.name
            });
            setPreviewData(data.preview_data || []);
            setHeaders(data.headers || []);
            setNomeAba(data.nome_aba || '');
            setStep(3);
            setPreviewMode(true);
            toast.success(data.message);
        } catch (err) {
            toast.error("Erro ao processar a aba selecionada.");
        } finally {
            setUploading(false);
        }
    };

    const handleCancelPreview = () => {
        setPreviewMode(false);
        setPreviewData([]);
        setHeaders([]);
        setNomeAba('');
        setFile(null);
        setStep(1);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleConfirmSave = async () => {
        setSaving(true);
        try {
            await api.post('/wabtec/save-lote', {
                records: previewData,
                nome_arquivo: file?.name || 'Estrutura_Wabtec',
                nome_aba: nomeAba,
                headers: headers
            });
            toast.success("Lote salvo com sucesso!");
            handleCancelPreview();
            fetchLotes();
        } catch (err) {
            toast.error("Erro ao salvar lote.");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteLote = async (id, e) => {
        e.stopPropagation();
        if (!window.confirm("Deseja realmente excluir este lote?")) return;
        try {
            await api.delete(`/wabtec/lotes/${id}`);
            toast.success("Lote removido.");
            if (selectedLote === id) {
                setSelectedLote(null);
                setLoteData([]);
            }
            fetchLotes(false);
        } catch {
            toast.error("Erro ao remover.");
        }
    };

    const formatDate = (d) => {
        return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2">
                <button onClick={handleAtualizar} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition shadow-sm">
                    <RefreshCw className="w-4 h-4" /> Atualizar
                </button>
            </div>

            {/* Upload Box */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2 mb-4">
                    <FileUp className="w-4 h-4 text-indigo-500" /> Importar Planilha de Estrutura
                </h3>
                <div className="flex flex-col gap-4">
                    {step === 1 && (
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                            <div className="relative flex-1 max-w-xl">
                                <input type="file" accept=".xlsx,.xlsm" onChange={handleFileChange}
                                    ref={fileInputRef} disabled={uploading}
                                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-colors border border-slate-200 rounded-lg bg-slate-50 disabled:opacity-50" />
                            </div>
                            <button onClick={handleLerAbas} disabled={!file || uploading}
                                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 text-sm font-bold transition shadow-sm disabled:opacity-50">
                                {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                                {uploading ? 'Lendo Abas...' : 'Ler Abas'}
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <div className="flex-1 max-w-xl">
                                <label className="block text-xs font-bold text-slate-500 mb-1">Selecione a Aba que contém a estrutura:</label>
                                <select 
                                    value={abaSelecionada} 
                                    onChange={(e) => setAbaSelecionada(e.target.value)}
                                    className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="" disabled>-- Selecione uma aba --</option>
                                    {abas.map((a, i) => (
                                        <option key={i} value={a}>{a}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-end gap-2 mt-auto">
                                <button onClick={() => { setStep(1); setAbas([]); }}
                                    className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition shadow-sm">
                                    Voltar
                                </button>
                                <button onClick={handleProcessarAba} disabled={!abaSelecionada || uploading}
                                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 text-sm font-bold transition shadow-sm disabled:opacity-50">
                                    {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                                    Processar Planilha
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-green-50 p-4 rounded-lg border border-green-200">
                            <div className="flex items-center gap-3">
                                <CheckCircle2 className="w-6 h-6 text-green-600" />
                                <div>
                                    <p className="text-sm font-bold text-green-800">Planilha processada com sucesso!</p>
                                    <p className="text-xs text-green-600">Confirme os dados na visualização abaixo antes de salvar.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={handleCancelPreview} disabled={saving}
                                    className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition shadow-sm disabled:opacity-50">
                                    Cancelar
                                </button>
                                <button onClick={handleConfirmSave} disabled={saving}
                                    className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 text-sm font-bold transition shadow-sm disabled:opacity-50">
                                    {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    {saving ? 'Gravando...' : 'Confirmar e Salvar'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Lotes */}
            {lotes.length > 0 && !previewMode && (
                <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Importações Registradas ({lotes.length})</p>
                    <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
                        {lotes.map(l => (
                            <div key={l.lote_id} 
                                className={`flex-shrink-0 relative px-5 py-4 rounded-xl border ${selectedLote === l.lote_id ? 'border-indigo-400 bg-indigo-50 shadow-md ring-2 ring-indigo-100' : 'border-slate-200 bg-white hover:border-indigo-200 hover:shadow-sm'} cursor-pointer w-64 snap-start transition-all duration-200`}
                                onClick={() => handleSelectLote(l.lote_id)}
                            >
                                <button onClick={(e) => handleDeleteLote(l.lote_id, e)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 p-1">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                                <div className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-2 w-48 truncate" title={l.nome_arquivo}>
                                    <Layers className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                                    {l.nome_arquivo}
                                </div>
                                <div className="text-[10px] text-slate-500">{formatDate(l.data_criacao)}</div>
                                <div className="text-[10px] text-slate-400 mt-2">
                                    Lote #{l.lote_id} &bull; {l.criado_por}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Preview Table (upload in progress) */}
            {previewMode && previewData.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                        <span className="text-sm font-bold text-slate-700">Preview Original da Planilha ({previewData.length} itens)</span>
                    </div>
                    <div className="overflow-x-auto max-h-[500px]">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-slate-50 sticky top-0 shadow-sm text-xs text-slate-500 uppercase">
                                <tr>
                                    {headers.map((h, i) => (
                                        <th key={i} className="px-4 py-2 border-b">{h || `Col ${i+1}`}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {previewData.map((r, i) => {
                                    let raw = [];
                                    try {
                                        raw = JSON.parse(r.raw_data);
                                    } catch(e) {}
                                    return (
                                        <tr key={i} className="hover:bg-slate-50">
                                            {headers.map((_, colIdx) => (
                                                <td key={colIdx} className="px-4 py-2 text-xs text-slate-700">
                                                    {raw[colIdx] || ''}
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Saved Data Table (click on lote) */}
            {!previewMode && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[300px] flex flex-col">
                    <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                        <span className="text-sm font-bold text-slate-800">Estrutura Cadastrada (Ativa)</span>
                    </div>
                    {loadingData ? (
                        <div className="flex-1 flex items-center justify-center py-12">
                            <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
                        </div>
                    ) : loteData.length > 0 ? (
                        <div className="overflow-x-auto max-h-[600px] flex-1">
                            <table className="w-full text-left border-collapse text-sm whitespace-nowrap">
                                <thead className="bg-slate-50 sticky top-0 shadow-sm z-10 text-xs text-slate-500 uppercase">
                                    <tr>
                                        {loteHeaders.map((h, i) => (
                                            <th key={i} className="px-4 py-3">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loteData.map((r, i) => {
                                        let raw = [];
                                        try {
                                            raw = JSON.parse(r.raw_data);
                                        } catch(e) {}
                                        return (
                                            <tr key={i} className="hover:bg-slate-50">
                                                {loteHeaders.map((_, colIdx) => (
                                                    <td key={colIdx} className="px-4 py-2 text-xs text-slate-700">
                                                        {raw[colIdx] || ''}
                                                    </td>
                                                ))}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center text-center p-12 text-slate-400 flex-1">
                            <Layers className="w-12 h-12 mb-3 opacity-20" />
                            <p className="text-slate-500 font-bold">Nenhuma estrutura registrada ou selecionada.</p>
                            <p className="text-sm mt-1">Importe uma planilha WabTec para visualizar os dados originais.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
