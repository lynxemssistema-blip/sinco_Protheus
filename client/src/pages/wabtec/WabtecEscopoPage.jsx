import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
import { FileUp, FileText, Download, Trash2, X, Eye, Loader2, Bot, Layers, CheckCircle2 } from 'lucide-react';

export default function WabtecEscopoPage() {
    const { user } = useAuth();
    const [escopos, setEscopos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    // Form state
    const [projeto, setProjeto] = useState('');
    const [revisao, setRevisao] = useState('');
    const [file, setFile] = useState(null);

    // Modal view state
    const [viewDoc, setViewDoc] = useState(null);
    const [aiText, setAiText] = useState('');
    const [loadingText, setLoadingText] = useState(false);
    const [activeTab, setActiveTab] = useState('pdf'); // 'pdf' | 'ai'
    const [pdfUrl, setPdfUrl] = useState(null);

    useEffect(() => {
        fetchEscopos();
    }, []);

    const fetchEscopos = async () => {
        try {
            const { data } = await api.get('/wabtec/escopos');
            setEscopos(data);
        } catch (error) {
            console.error("Erro ao buscar escopos:", error);
            toast.error("Erro ao carregar lista de escopos.");
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!projeto || !revisao || !file) {
            return toast.warning("Preencha todos os campos e selecione um arquivo.");
        }

        const formData = new FormData();
        formData.append('projeto', projeto);
        formData.append('revisao', revisao);
        formData.append('pdfFile', file);
        formData.append('criado_por', user?.NomeCompleto || user?.Login || 'Usuário');

        setUploading(true);
        try {
            await api.post('/wabtec/escopos', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success("Escopo importado e indexado para IA com sucesso!");
            setProjeto('');
            setRevisao('');
            setFile(null);
            fetchEscopos();
        } catch (error) {
            console.error("Erro no upload:", error);
            toast.error("Erro ao importar o documento.");
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Deseja marcar este documento como obsoleto?")) return;
        try {
            await api.delete(`/wabtec/escopos/${id}`);
            toast.success("Documento marcado como obsoleto.");
            fetchEscopos();
        } catch (error) {
            toast.error("Erro ao excluir documento.");
        }
    };

    const openViewModal = async (doc) => {
        setViewDoc(doc);
        setActiveTab('pdf');
        setLoadingText(true);
        setPdfUrl(null);

        try {
            // Fetch PDF content as Blob using API (with token)
            const pdfResponse = await api.get(`/wabtec/escopos/download/${doc.id}`, { responseType: 'blob' });
            const url = URL.createObjectURL(pdfResponse.data);
            setPdfUrl(url);

            // Fetch AI Text
            const { data } = await api.get(`/wabtec/escopos/${doc.id}/texto`);
            setAiText(data.texto);
        } catch (error) {
            console.error(error);
            setAiText("Erro ao carregar texto ou PDF.");
        } finally {
            setLoadingText(false);
        }
    };

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                        <FileText className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Escopos de Fornecimento</h1>
                        <p className="text-sm text-slate-500">Gestão e inteligência de documentos WabTec</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Upload Form */}
                <div className="lg:col-span-1">
                    <form onSubmit={handleUpload} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4 sticky top-6">
                        <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-4">
                            <FileUp className="w-4 h-4 text-blue-600" /> Importar Novo Escopo
                        </h2>
                        
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Projeto / Conjunto</label>
                            <input 
                                type="text" 
                                value={projeto}
                                onChange={(e) => setProjeto(e.target.value)}
                                placeholder="Ex: CABINE 84A237235AF" 
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Revisão</label>
                            <input 
                                type="text" 
                                value={revisao}
                                onChange={(e) => setRevisao(e.target.value)}
                                placeholder="Ex: REV.F" 
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Arquivo PDF</label>
                            <input 
                                type="file" 
                                accept="application/pdf"
                                onChange={(e) => setFile(e.target.files[0])}
                                className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                            />
                        </div>

                        <button 
                            type="submit" 
                            disabled={uploading}
                            className="w-full mt-4 bg-blue-600 text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
                            {uploading ? 'Processando...' : 'Fazer Upload e Indexar'}
                        </button>
                    </form>
                </div>

                {/* Document List */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h2 className="text-sm font-semibold text-slate-700">Documentos Ativos</h2>
                            <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-1 rounded-md">
                                {escopos.length} arquivos
                            </span>
                        </div>
                        
                        {loading ? (
                            <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 text-blue-600 animate-spin" /></div>
                        ) : escopos.length === 0 ? (
                            <div className="p-12 text-center text-slate-400">
                                <FileText className="w-12 h-12 mx-auto text-slate-200 mb-3" />
                                <p>Nenhum escopo importado ainda.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {escopos.map((doc) => (
                                    <div key={doc.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                                        <div className="flex items-start gap-4">
                                            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                                                <FileText className="w-5 h-5 text-red-500" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-slate-800 text-sm">{doc.projeto}</h3>
                                                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                                    <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{doc.revisao}</span>
                                                    <span className="truncate max-w-[200px]" title={doc.nome_original}>{doc.nome_original}</span>
                                                    <span>• {new Date(doc.data_criacao).toLocaleDateString('pt-BR')}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => openViewModal(doc)}
                                                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Visualizar e Informações IA"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(doc.id)}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Marcar como obsoleto"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Viewer Modal */}
            {viewDoc && (
                <div className="fixed inset-0 z-50 flex bg-slate-900/60 backdrop-blur-sm p-4 md:p-8">
                    <div className="bg-white w-full h-full rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center">
                                    <Layers className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800">{viewDoc.projeto} <span className="text-blue-600 text-sm ml-2 bg-blue-100 px-2 py-0.5 rounded-full">{viewDoc.revisao}</span></h2>
                                    <p className="text-xs text-slate-500">{viewDoc.nome_original} • Importado por {viewDoc.criado_por}</p>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <div className="flex bg-slate-200/50 p-1 rounded-lg">
                                    <button 
                                        onClick={() => setActiveTab('pdf')}
                                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'pdf' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Visualizar PDF
                                    </button>
                                    <button 
                                        onClick={() => setActiveTab('ai')}
                                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${activeTab === 'ai' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-blue-600'}`}
                                    >
                                        <Bot className="w-4 h-4" /> Leitura da IA
                                    </button>
                                </div>
                                <button 
                                    onClick={() => setViewDoc(null)}
                                    className="p-2 bg-slate-200 hover:bg-red-100 hover:text-red-600 text-slate-600 rounded-lg ml-4 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 bg-slate-100 overflow-hidden relative">
                            {activeTab === 'pdf' ? (
                                pdfUrl ? (
                                    <iframe 
                                        src={pdfUrl}
                                        className="w-full h-full border-0"
                                        title="PDF Viewer"
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full">
                                        <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
                                    </div>
                                )
                            ) : (
                                <div className="h-full overflow-y-auto p-6 md:p-12">
                                    <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                                        <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-100">
                                            <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center">
                                                <Bot className="w-6 h-6 text-indigo-600" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-800">Texto Extraído para IA</h3>
                                                <p className="text-sm text-slate-500">Este é o conteúdo exato que nossos agentes de Inteligência Artificial conseguem ler deste PDF.</p>
                                            </div>
                                        </div>
                                        
                                        {loadingText ? (
                                            <div className="flex items-center justify-center py-20">
                                                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                                            </div>
                                        ) : (
                                            <pre className="text-sm text-slate-700 whitespace-pre-wrap font-mono bg-slate-50 p-6 rounded-lg border border-slate-100 leading-relaxed">
                                                {aiText || "Nenhum texto pôde ser extraído."}
                                            </pre>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
