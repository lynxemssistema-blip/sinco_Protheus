import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import {
    FileText,
    ArrowLeft,
    Save,
    Printer,
    FilePlus,
    Layout,
    ChevronRight,
    Search,
    History,
    FileUp,
    FileDown,
    Bot,
    Send,
    Loader2,
    Trash2
} from 'lucide-react';
import api from '../services/api';
import DOMPurify from 'dompurify';

const SGQDocuments = () => {
    const navigate = useNavigate();
    const quillRef = useRef(null);
    const fileInputRef = useRef(null);

    // Core state
    const [documents, setDocuments] = useState([]);
    const [activeSector, setActiveSector] = useState('Geral');
    const [searchQuery, setSearchQuery] = useState('');

    // Editor State
    const [content, setContent] = useState('');
    const [selectedDoc, setSelectedDoc] = useState(null);

    // AI Assistant State
    const [isAIOpen, setIsAIOpen] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [aiHistory, setAiHistory] = useState([
        { role: 'system', text: 'Olá! Sou seu assistente ISO 9001. Selecione um trecho do texto e me diga como quer melhorar, ou peça para eu gerar um novo parágrafo.' }
    ]);
    const [selectedText, setSelectedText] = useState('');
    const [selectionRange, setSelectionRange] = useState(null);

    const sectors = [
        'Geral', 'Administrativo', 'Almoxarifado', 'Comercial',
        'Engenharia', 'Produção', 'PCP', 'Qualidade', 'RH'
    ];

    const isoTemplate = `
        <h1 style="text-align: center; color: #1e3a8a;">
            PROCEDIMENTO OPERACIONAL PADRÃO (POP)
        </h1>
        <br>
        <div style="background-color: #f8fafc; padding: 15px; border: 1px solid #e2e8f0; font-size: 14px;">
            <p><strong>Código:</strong> POP-MF-00X</p>
            <p><strong>Setor:</strong> ${activeSector}</p>
            <p><strong>Versão:</strong> 01</p>
            <p><strong>Norma de Referência:</strong> ISO 9001:2015</p>
        </div>
        <br>
        <h2>1. OBJETIVO</h2>
        <p>Descrever a finalidade deste procedimento e os resultados esperados para garantir a conformidade com as normas de qualidade.</p>
        <br>
        <h2>2. ESCOPO</h2>
        <p>Define onde e quando este procedimento deve ser aplicado dentro do setor de ${activeSector}.</p>
        <br>
        <h2>3. RESPONSABILIDADES</h2>
        <p>Lista os cargos responsáveis pela execução, supervisão e aprovação das atividades descritas.</p>
        <br>
        <h2>4. DESCRIÇÃO DO PROCEDIMENTO</h2>
        <p>Descreva aqui o passo a passo detalhado da atividade, incluindo critérios de aceitação e pontos de controle de qualidade.</p>
        <ul>
            <li>Etapa 1: ...</li>
            <li>Etapa 2: ...</li>
            <li>Ponto de Inspeção: Verificar conformidade conforme ISO clause 8.5.</li>
        </ul>
        <br>
        <h2>5. REGISTROS E FORMULÁRIOS</h2>
        <p>Listar documentos gerados por este processo (ex: Relatório de Inspeção, Checklist de Setup).</p>
        <br>
        <p style="text-align: right;"><strong>Elaborado por: _________________________</strong></p>
        <p style="text-align: right;"><strong>Aprovado por: _________________________</strong></p>
    `;

    const modules = {
        toolbar: [
            [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
            [{ 'font': [] }],
            [{ 'size': ['small', false, 'large', 'huge'] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'color': [] }, { 'background': [] }],
            [{ 'script': 'sub' }, { 'script': 'super' }],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            [{ 'indent': '-1' }, { 'indent': '+1' }],
            [{ 'align': [] }],
            ['blockquote', 'code-block'],
            ['link', 'image', 'video'],
            ['clean']
        ],
    };

    // --- Database CRUD ---
    const fetchDocuments = async () => {
        try {
            const res = await api.get('/sgq-documents');
            setDocuments(res.data);
        } catch (error) {
            console.error('Falha ao carregar documentos', error);
        }
    };

    useEffect(() => {
        fetchDocuments();
    }, []);

    const openDocument = async (docId) => {
        try {
            const res = await api.get(`/sgq-documents/${docId}`);
            setSelectedDoc(res.data);
            setContent(res.data.content);
            setActiveSector(res.data.sector || 'Geral');
        } catch (error) {
            console.error('Falha ao abrir documento', error);
        }
    };

    const loadTemplate = () => {
        setContent(isoTemplate);
    };

    const saveDocument = async () => {
        if (!content) return alert('O documento está vazio.');

        try {
            // Extrac basic title from first H1 if possible
            let tempTitle = 'Novo Procedimento';
            const parser = new DOMParser();
            const docHtml = parser.parseFromString(content, 'text/html');
            const h1 = docHtml.querySelector('h1');
            if (h1 && h1.innerText) tempTitle = h1.innerText.substring(0, 100);
            else if (selectedDoc?.title) tempTitle = selectedDoc.title;

            const payload = {
                title: tempTitle,
                sector: activeSector,
                code: selectedDoc?.code || 'POP-MF-00X',
                version: selectedDoc?.version || '01',
                content: content
            };

            if (selectedDoc && selectedDoc.id) {
                payload.id = selectedDoc.id; // UPDATE
            }

            const res = await api.post('/sgq-documents', payload);
            setSelectedDoc(res.data);
            alert('Documento salvo com sucesso!');
            fetchDocuments();
        } catch (error) {
            console.error('Erro ao salvar documento', error);
            alert('Falha ao salvar no banco de dados.');
        }
    };

    const deleteDocument = async (id) => {
        if (!confirm('Tem certeza que deseja excluir permanentemente este documento?')) return;
        try {
            await api.delete(`/sgq-documents/${id}`);
            if (selectedDoc?.id === id) {
                setSelectedDoc(null);
                setContent('');
            }
            fetchDocuments();
        } catch (error) {
            console.error('Falha ao deletar', error);
        }
    };

    const createNewDoc = () => {
        setSelectedDoc(null);
        setContent('');
    };

    // --- Import / Export Microsoft Word ---
    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await api.post('/ai/import-word', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (res.data.html) {
                setContent(res.data.html);
                alert('Documento importado com sucesso!');
            }
        } catch (error) {
            console.error(error);
            alert('Falha ao importar o documento Word. Verifique a conexão com o servidor.');
        } finally {
            event.target.value = ''; // Reset input
        }
    };

    const handleExportWord = async () => {
        if (!content) return alert('O documento está vazio.');
        try {
            const res = await api.post('/ai/export-word', {
                htmlContent: content,
                title: selectedDoc?.title || 'Documento SGQ'
            });

            // Decode Base64 and trigger download
            const base64str = res.data.base64;
            const binary = atob(base64str);
            const array = [];
            for (let i = 0; i < binary.length; i++) {
                array.push(binary.charCodeAt(i));
            }
            const blob = new Blob([new Uint8Array(array)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

            const link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.download = `${selectedDoc?.title || 'Documento_SGQ'}.docx`;
            link.click();

        } catch (error) {
            console.error(error);
            alert('Falha ao exportar para o Word.');
        }
    };

    // --- AI Assistant Logic ---
    const handleQuillChangeSelection = (range, source, editor) => {
        if (range && range.length > 0) {
            setSelectedText(editor.getText(range.index, range.length));
            setSelectionRange(range);
        } else {
            setSelectedText('');
            setSelectionRange(null);
        }
    };

    const handleAskAI = async () => {
        if (!aiPrompt.trim()) return;

        const newHistory = [...aiHistory, { role: 'user', text: aiPrompt }];
        setAiHistory(newHistory);
        setAiLoading(true);

        try {
            const res = await api.post('/ai/document-assist', {
                documentContext: content,
                selectedText: selectedText,
                prompt: aiPrompt
            });

            const suggestion = res.data.suggestion;

            setAiHistory(prev => [...prev, { role: 'ai', text: suggestion }]);

            // If user has text selected, automatically replace it, else append at end.
            if (quillRef.current) {
                const editor = quillRef.current.getEditor();
                if (selectionRange && selectionRange.length > 0) {
                    // Replace selection 
                    editor.clipboard.dangerouslyPasteHTML(selectionRange.index, suggestion);
                    editor.deleteText(selectionRange.index + suggestion.length, selectionRange.length);
                    editor.setSelection(selectionRange.index + suggestion.length, 0); // Move cursor
                } else {
                    // Append at the cursor or end of document
                    const range = editor.getSelection();
                    const index = range ? range.index : editor.getLength();
                    editor.clipboard.dangerouslyPasteHTML(index, `<br/>${suggestion}`);
                }
            }

        } catch (error) {
            console.error(error);
            setAiHistory(prev => [...prev, { role: 'ai', text: '❌ Ocorreu um erro ao conectar com o Servidor de IA.' }]);
        } finally {
            setAiLoading(false);
            setAiPrompt('');
        }
    };

    // Filter documents for Sidebar
    const filteredDocs = documents.filter(doc =>
        (doc.sector === activeSector) &&
        (doc.title.toLowerCase().includes(searchQuery.toLowerCase()) || doc.code?.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            {/* Hidden File Input */}
            <input
                type="file"
                accept=".docx"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileUpload}
            />

            {/* Sidebar de Seleção e Carregamento */}
            <aside className="w-80 bg-white border-r border-slate-200 flex flex-col shadow-sm flex-shrink-0 z-20">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                    <button
                        onClick={() => navigate('/sgq')}
                        className="flex items-center text-slate-500 hover:text-blue-600 mb-4 text-sm transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Painel SGQ
                    </button>
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <FileText className="h-6 w-6 text-blue-600" />
                        Documentação
                    </h2>
                </div>

                <div className="p-4 flex-1 flex flex-col min-h-0">
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar documentos..."
                            className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500 transition-all"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="flex bg-slate-100 p-1 rounded-lg mb-4 text-xs font-semibold overflow-x-auto hide-scrollbar">
                        {sectors.map(s => (
                            <button
                                key={s}
                                onClick={() => setActiveSector(s)}
                                className={`px-3 py-1.5 rounded-md whitespace-nowrap transition-all ${activeSector === s ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>

                    <div className="space-y-2 overflow-y-auto flex-1 pr-2">
                        {filteredDocs.length === 0 ? (
                            <div className="text-center py-8 text-slate-400 text-sm">
                                Nenhum documento encontrado.
                            </div>
                        ) : (
                            filteredDocs.map(doc => (
                                <div
                                    key={doc.id}
                                    className={`p-3 rounded-lg border cursor-pointer transition-all group ${selectedDoc?.id === doc.id ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-500' : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm'}`}
                                    onClick={() => openDocument(doc.id)}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <h3 className="text-sm font-semibold text-slate-800 line-clamp-1 flex-1">{doc.title}</h3>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); deleteDocument(doc.id); }}
                                            className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 -mt-1 -mr-1"
                                            title="Excluir"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <div className="flex items-center text-[11px] text-slate-500 justify-between">
                                        <span className="bg-slate-100 px-1.5 py-0.5 rounded font-medium">{doc.code}</span>
                                        <span>v{doc.version}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="mt-auto p-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-2">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-all"
                    >
                        <FileUp className="h-4 w-4" />
                        Importar Word (.docx)
                    </button>
                    <button
                        onClick={createNewDoc}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-all shadow-md active:scale-95"
                    >
                        <FilePlus className="h-4 w-4" />
                        Novo Documento
                    </button>
                </div>
            </aside>

            {/* Main Editor Area */}
            <main className="flex-1 flex flex-col min-w-0 bg-slate-200/50 overflow-hidden relative">
                <div aria-label="header" className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-700 border-r border-slate-300 pr-4 mr-2">
                            {selectedDoc ? `${selectedDoc.code} - ${selectedDoc.title}` : 'Novo Documento'}
                        </span>
                        <button
                            onClick={loadTemplate}
                            className="flex items-center gap-2 px-3 py-1.5 hover:bg-blue-50 hover:text-blue-700 rounded-md text-blue-600 text-xs font-bold transition-all border border-blue-200 bg-white shadow-sm"
                        >
                            <Layout className="h-3.5 w-3.5" />
                            CARREGAR MODELO ISO
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            className={`p-2 rounded transition-colors flex items-center gap-2 text-sm font-semibold ${isAIOpen ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50'}`}
                            onClick={() => setIsAIOpen(!isAIOpen)}
                        >
                            <Bot className="h-5 w-5" />
                            Assistente IA
                        </button>

                        <div className="w-px h-6 bg-slate-300 mx-1"></div>

                        <button
                            onClick={handleExportWord}
                            className="p-2 text-slate-500 hover:text-blue-600 transition-colors flex items-center gap-2 text-sm font-semibold"
                            title="Exportar Word"
                        >
                            <FileDown className="h-5 w-5" />
                            Exportar
                        </button>

                        <button
                            onClick={saveDocument}
                            className="ml-2 bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all"
                        >
                            <Save className="h-4 w-4" />
                            SALVAR NO BANCO
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto w-full flex justify-center pb-32 pt-8 relative">
                    <div className="w-[210mm] min-h-[297mm] bg-white shadow-2xl border border-slate-300 relative group flex flex-col mb-12">
                        <style dangerouslySetInnerHTML={{
                            __html: `
                        .custom-quill-editor {
                            display: flex;
                        flex-direction: column;
                        flex: 1;
                            }
                        .ql-toolbar.ql-snow {
                            position: sticky !important;
                        top: 0 !important;
                        z-index: 50 !important;
                        background: #f8fafc;
                        border: none !important;
                        border-bottom: 1px solid #e2e8f0 !important;
                        padding: 12px 24px !important;
                        display: flex;
                        flex-wrap: wrap;
                        gap: 4px;
                            }
                        .ql-container.ql-snow {
                            border: none !important;
                        flex: 1;
                        padding: 40px 60px 80px 60px;
                        font-family: 'Arial', sans-serif;
                        font-size: 11pt;
                        line-height: 1.5;
                        color: #1e293b;
                            }
                        .ql-editor {
                            min-height: 100%;
                            }
                        .ql-editor h1 {font-family: 'Arial', sans-serif; color: #1e3a8a; font-weight: bold; }
                        .ql-editor h2 {font-family: 'Arial', sans-serif; color: #2563eb; font-weight: bold; margin-top: 1.5em; margin-bottom: 0.5em; border-left: 4px solid #2563eb; padding-left: 10px; }
                        `
                        }} />

                        <ReactQuill
                            ref={quillRef}
                            theme="snow"
                            value={content}
                            onChange={setContent}
                            onChangeSelection={handleQuillChangeSelection}
                            modules={modules}
                            className="custom-quill-editor"
                            placeholder="Comece a redigir o documento aqui..."
                        />
                    </div>
                </div>
            </main>

            {/* AI Assistant Drawer */}
            {isAIOpen && (
                <aside className="w-80 bg-white border-l border-slate-200 flex flex-col shadow-2xl z-20 absolute right-0 top-0 bottom-0 transform transition-transform animate-in slide-in-from-right">
                    <div className="p-4 border-b border-slate-100 bg-indigo-600 text-white flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-lg">
                            <Bot className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="font-bold text-sm">Assistente ISO 9001</h2>
                            <p className="text-[10px] text-indigo-100 opacity-90">Powered by Gemini AI</p>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                        {aiHistory.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-xl p-3 text-sm shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none'}`}>
                                    <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(msg.text) }} />
                                </div>
                            </div>
                        ))}
                        {aiLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white border border-slate-200 rounded-xl p-3 rounded-bl-none shadow-sm flex items-center gap-2 text-slate-500">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span className="text-sm">Pensando...</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {
                        selectedText && (
                            <div className="px-4 py-2 bg-indigo-50 border-t border-indigo-100 text-xs">
                                <span className="font-bold text-indigo-800">Texto Selecionado:</span>
                                <p className="text-indigo-600/80 truncate mt-1 italic">"{selectedText}"</p>
                            </div>
                        )
                    }

                    <div className="p-4 bg-white border-t border-slate-200">
                        <div className="relative">
                            <textarea
                                rows="3"
                                className="w-full bg-slate-100 border-none rounded-xl pr-12 pl-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 resize-none"
                                placeholder="Descreva a melhoria desejada..."
                                value={aiPrompt}
                                onChange={(e) => setAiPrompt(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleAskAI();
                                    }
                                }}
                            />
                            <button
                                onClick={handleAskAI}
                                disabled={aiLoading || !aiPrompt.trim()}
                                className="absolute right-2 bottom-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <Send className="h-4 w-4" />
                            </button>
                        </div>
                        <p className="text-[10px] text-center text-slate-400 mt-2 text-balance leading-tight">
                            {selectedText ? 'O resultado substituirá o texto selecionado automaticamente.' : 'O resultado será inserido no fim do documento.'}
                        </p>
                    </div>
                </aside >
            )}
        </div >
    );
};

export default SGQDocuments;
