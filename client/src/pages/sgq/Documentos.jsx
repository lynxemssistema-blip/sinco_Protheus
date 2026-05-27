import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import SunEditor from 'suneditor-react';
import 'suneditor/dist/css/suneditor.min.css';
import metalfisaLogo from '../../assets/metalfisa-logo.png';
import { 
    FileText,
    HelpCircle,
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
    Trash2,
    Settings2,
    Plus,
    Check,
    X,
    Pencil
, Paperclip } from 'lucide-react';
import api from '../../services/api';
import { useHelp } from '../../contexts/HelpContext';
import HelpDrawer from '../../components/HelpDrawer';
import DOMPurify from 'dompurify';


const DocumentHeader = ({ headerData, setHeaderData, activeSector }) => {
    return (
        <div className="px-[60px] pt-[40px] pb-4 print:pt-[10px] print:px-[10px]">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Arial, sans-serif', fontSize: '10pt', border: '1px solid #000', textAlign: 'center', verticalAlign: 'middle' }}>
                <tbody>
                    <tr>
                        <td rowSpan="6" style={{ width: '25%', border: '1px solid #000', padding: '10px' }}>
                            <img src={metalfisaLogo} alt="MetalFisa" style={{ maxWidth: '100%', height: 'auto', maxHeight: '60px', margin: '0 auto' }} />
                        </td>
                        <td rowSpan="2" style={{ width: '45%', border: '1px solid #000', fontWeight: 'bold', fontSize: '12pt', color: '#555' }}>
                            SISTEMA DE GESTÃO DA QUALIDADE
                        </td>
                        <td style={{ width: '15%', border: '1px solid #000', backgroundColor: '#f2f2f2', fontSize: '8pt', color: '#555' }}>CÓDIGO</td>
                        <td style={{ width: '15%', border: '1px solid #000', backgroundColor: '#f2f2f2', fontSize: '8pt', color: '#555' }}>REVISÃO</td>
                    </tr>
                    <tr>
                        <td style={{ border: '1px solid #000', fontWeight: 'bold', color: '#555' }}>
                            <input value={headerData.code} onChange={e => setHeaderData({...headerData, code: e.target.value})} className="w-full text-center outline-none bg-transparent" />
                        </td>
                        <td style={{ border: '1px solid #000', fontWeight: 'bold', color: '#555' }}>
                            <input value={headerData.version} onChange={e => setHeaderData({...headerData, version: e.target.value})} className="w-full text-center outline-none bg-transparent" />
                        </td>
                    </tr>
                    <tr>
                        <td style={{ border: '1px solid #000', backgroundColor: '#f2f2f2', fontSize: '8pt', color: '#555' }}>TIPO DE DOCUMENTO</td>
                        <td colSpan="2" style={{ border: '1px solid #000', backgroundColor: '#f2f2f2', fontSize: '8pt', color: '#555' }}>DATA</td>
                    </tr>
                    <tr>
                        <td style={{ border: '1px solid #000', color: '#555' }}>Procedimento da Qualidade</td>
                        <td colSpan="2" style={{ border: '1px solid #000', fontWeight: 'bold', color: '#555' }}>
                            <input value={headerData.date} onChange={e => setHeaderData({...headerData, date: e.target.value})} className="w-full text-center outline-none bg-transparent" />
                        </td>
                    </tr>
                    <tr>
                        <td style={{ border: '1px solid #000', backgroundColor: '#f2f2f2', fontSize: '8pt', color: '#555' }}>TÍTULO DO DOCUMENTO</td>
                        <td colSpan="2" style={{ border: '1px solid #000', backgroundColor: '#f2f2f2', fontSize: '8pt', color: '#555' }}>PÁGINA</td>
                    </tr>
                    <tr>
                        <td style={{ border: '1px solid #000', color: '#555' }}>{activeSector}</td>
                        <td colSpan="2" style={{ border: '1px solid #000', fontWeight: 'bold', color: '#555' }}>1/1</td>
                    </tr>
                    <tr>
                        <td colSpan="2" style={{ border: '1px solid #000', backgroundColor: '#f2f2f2', fontSize: '8pt', color: '#555' }}>ANÁLISE CRÍTICA</td>
                        <td colSpan="2" style={{ border: '1px solid #000', backgroundColor: '#f2f2f2', fontSize: '8pt', color: '#555' }}>RESPONSÁVEL PELA APROVAÇÃO</td>
                    </tr>
                    <tr>
                        <td colSpan="2" style={{ border: '1px solid #000', textAlign: 'left', padding: '4px 8px', color: '#555' }}>
                            Documento elaborado por: 
                            <input value={headerData.preparedBy} onChange={e => setHeaderData({...headerData, preparedBy: e.target.value})} className="ml-2 w-[70%] outline-none bg-transparent" />
                        </td>
                        <td colSpan="2" style={{ border: '1px solid #000', color: '#555' }}>
                            <input value={headerData.approvedBy} onChange={e => setHeaderData({...headerData, approvedBy: e.target.value})} className="w-full text-center outline-none bg-transparent" />
                        </td>
                    </tr>
                    <tr>
                        <td colSpan="2" style={{ border: '1px solid #000', textAlign: 'left', padding: '4px 8px', color: '#555' }}>Documento analisado e aprovado quanto à adequação.</td>
                        <td colSpan="2" style={{ border: '1px solid #000', color: '#555' }}>
                            <input value={headerData.approvedBy2} onChange={e => setHeaderData({...headerData, approvedBy2: e.target.value})} className="w-full text-center outline-none bg-transparent" />
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

const SGQDocuments = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { openHelp } = useHelp();
    const docIdToOpen = searchParams.get('docId');
    
    const fileInputRef = useRef(null);

    // Core state
    const [documents, setDocuments] = useState([]);
    const [sectors, setSectors] = useState([]);
    const [activeSector, setActiveSector] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Sector management state
    const [isEditingSectors, setIsEditingSectors] = useState(false);
    const [editingsector, setEditingSector] = useState(null); // { id, name }
    const [newSectorName, setNewSectorName] = useState('');
    const [isAddingSecor, setIsAddingSector] = useState(false);

        const isoTemplate = `
        <br>
        <h2>1. OBJETIVO</h2>
        <p><br></p>
        <br>
        <h2>2. ABRANGÊNCIA</h2>
        <p><br></p>
        <br>
        <h2>3. SIGLAS</h2>
        <p><br></p>
        <br>
        <h2>4. DEFINIÇÕES</h2>
        <p><br></p>
        <br>
        <h2>5. RESPONSABILIDADES</h2>
        <p><br></p>
        <br>
        <h2>6. PROCEDIMENTOS</h2>
        <p><br></p>
        <br>
        <h2>7. INFORMAÇÃO DOCUMENTADA</h2>
        <p><br></p>
        <br>
        <h2>8. ABORDAGEM A RISCOS</h2>
        <p><br></p>
        <br>
        <h2>9. ANEXOS</h2>
        <p><br></p>
        <br>
        <h2>10. HISTÓRICO DE REVISÕES</h2>
        <p><br></p>
        <br>
        <hr style="border: 1px solid #000; margin-top: 40px;">
        <p style="text-align: center; font-size: 9pt; font-family: Arial, sans-serif; margin-top: 5px;">
            <strong>Proibido reproduzir ou ceder a terceiros sem autorização da Metalfisa.</strong>
        </p>
    `;

    

    // Editor State
    const [content, setContent] = useState('');
    const [selectedDoc, setSelectedDoc] = useState(null);
    const [headerData, setHeaderData] = useState({
        code: 'PQ xx-xx',
        version: 'xx',
        date: 'dd/mm/yyyy',
        preparedBy: '',
        approvedBy: '',
        approvedBy2: ''
    });
    const [showHeader, setShowHeader] = useState(false);

    // AI Assistant State
    const [isAIOpen, setIsAIOpen] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiModel, setAiModel] = useState('gemini-2.5-flash');
    const [aiContextFileName, setAiContextFileName] = useState('');
    const [aiContextText, setAiContextText] = useState('');
    const [aiContextLoading, setAiContextLoading] = useState(false);
    const sunEditorRef = useRef(null);
    const contextFileInputRef = useRef(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiHistory, setAiHistory] = useState([
        { role: 'system', text: 'Olá! Sou seu assistente ISO 9001. Selecione um trecho do texto e me diga como quer melhorar, ou peça para eu gerar um novo parágrafo.' }
    ]);
    const [selectedText, setSelectedText] = useState('');
    const [selectionRange, setSelectionRange] = useState(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const isInitialLoad = useRef(false);

    // --- Sectors CRUD ---
    const fetchSectors = async () => {
        try {
            const res = await api.get('/sgq-documents/sectors');
            const data = res.data;
            setSectors(data);
            if (data.length > 0 && !activeSector) {
                setActiveSector(data[0].name);
            }
        } catch (err) {
            console.error('Falha ao carregar setores', err);
        }
    };

    const saveSector = async (id, name) => {
        try {
            await api.post('/sgq-documents/sectors', { id, name });
            await fetchSectors();
            setEditingSector(null);
        } catch (err) {
            console.error('Erro ao salvar setor', err);
        }
    };

    const addSector = async () => {
        const name = newSectorName.trim();
        if (!name) return;
        try {
            await api.post('/sgq-documents/sectors', { name });
            setNewSectorName('');
            setIsAddingSector(false);
            await fetchSectors();
        } catch (err) {
            console.error('Erro ao adicionar setor', err);
        }
    };

    const deleteSector = async (id, name) => {
        if (!confirm(`Excluir o setor "${name}"? Os documentos não serão deletados.`)) return;
        try {
            await api.delete(`/sgq-documents/sectors/${id}`);
            if (activeSector === name) setActiveSector(sectors[0]?.name || '');
            await fetchSectors();
        } catch (err) {
            console.error('Erro ao deletar setor', err);
        }
    };

    // --- Database CRUD ---
    const fetchDocuments = async () => {
        try {
            const res = await api.get('/sgq-documents');
            setDocuments(res.data);
            return res.data;
        } catch (error) {
            console.error('Falha ao carregar documentos', error);
        }
    };

    useEffect(() => {
        fetchSectors();
        fetchDocuments().then(() => {
            if (docIdToOpen) {
                openDocument(docIdToOpen);
            }
        });
    }, [docIdToOpen]);

    const handleDocumentSwitch = async (action) => {
        if (hasUnsavedChanges) {
            const wantsToSave = window.confirm("Existem alterações não salvas neste documento.\n\nClique em [OK] para SALVAR antes de sair, ou [Cancelar] para ignorar e perder as alterações.");
            if (wantsToSave) {
                await saveDocument();
            }
        }
        action();
        setHasUnsavedChanges(false);
    };

    const openDocument = async (docId) => {
        try {
            const res = await api.get(`/sgq-documents/${docId}`);
            setSelectedDoc(res.data);
            
            let loadedContent = res.data.content || '';
            let loadedHeader = {
                code: res.data.code || 'PQ xx-xx',
                version: res.data.version || 'xx',
                date: 'dd/mm/yyyy',
                preparedBy: '',
                approvedBy: '',
                approvedBy2: ''
            };
            
            // Check if there's a hidden header JSON in the content
            const headerMatch = loadedContent.match(/<div data-header='(.*?)' style="display:none;"><\/div>/);
            let hasHeader = false;
            if (headerMatch) {
                try {
                    const parsed = JSON.parse(headerMatch[1]);
                    loadedHeader = { ...loadedHeader, ...parsed };
                    loadedContent = loadedContent.replace(headerMatch[0], '');
                    hasHeader = true;
                } catch (e) {}
            }

            isInitialLoad.current = true;
            setHeaderData(loadedHeader);
            setShowHeader(hasHeader);
            setContent(loadedContent);
            setActiveSector(res.data.sector || 'Geral');
            setTimeout(() => { isInitialLoad.current = false; }, 500);
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

            // Injeta o cabeçalho no corpo HTML para salvamento persistente
            let finalContent = content;
            if (showHeader) {
                // remove cabeçalhos antigos antes de injetar o novo
                finalContent = finalContent.replace(/<div data-header='(.*?)' style="display:none;"><\/div>/g, '');
                const headerHtml = `<div data-header='${JSON.stringify(headerData)}' style="display:none;"></div>`;
                finalContent = headerHtml + finalContent;
            }

            const payload = {
                title: tempTitle,
                sector: activeSector,
                code: headerData?.code || selectedDoc?.code || 'POP-MF-00X',
                version: headerData?.version || selectedDoc?.version || '01',
                content: finalContent
            };

            if (selectedDoc && selectedDoc.id) {
                payload.id = selectedDoc.id; // UPDATE
            }

            const res = await api.post('/sgq-documents', payload);
            setSelectedDoc(res.data);
            setHasUnsavedChanges(false);
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
    

    const handleUploadContext = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setAiContextFileName(file.name);
        setAiContextLoading(true);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await api.post('/ai/extract-context', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setAiContextText({ 
                type: res.data.type, 
                data: res.data.type === 'image' ? res.data.data : res.data.text,
                mimeType: res.data.mimeType
            });
        } catch (error) {
            console.error('Erro ao extrair contexto:', error);
            alert('Falha ao processar o arquivo de contexto.');
            setAiContextFileName('');
        } finally {
            setAiContextLoading(false);
            e.target.value = ''; // Reset input
        }
    };

    const handleAskAI = async () => {
        if (!aiPrompt.trim()) return;

        const currentSelectedText = selectedText;
        const displayPrompt = currentSelectedText ? 
            `<div class="text-[10px] text-indigo-200 mb-1 pb-1 border-b border-indigo-500 italic line-clamp-2">" ${currentSelectedText} "</div>${aiPrompt}` : 
            aiPrompt;
        
        const newHistory = [...aiHistory, { role: 'user', text: displayPrompt, targetText: currentSelectedText }];
        setAiHistory(newHistory);
        setAiLoading(true);
        // Salva as variáveis locais para a chamada da API e limpa a tela pro usuário
        const promptToSend = aiPrompt;
        setAiPrompt('');
        setSelectedText('');

        try {
            const res = await api.post('/ai/document-assist', {
                documentContext: content,
                selectedText: currentSelectedText,
                prompt: promptToSend,
                modelName: aiModel,
                extraContext: aiContextText
            });

            const suggestion = res.data.suggestion;

            setAiHistory(prev => [...prev, { 
                role: 'ai', 
                text: suggestion,
                targetText: currentSelectedText 
            }]);

            // DO NOT auto insert. Let user choose via UI.

        } catch (error) {
            console.error(error);
            const msg = error?.response?.status === 429
                ? '⏳ Cota da API de IA excedida. Aguarde alguns segundos e tente novamente.'
                : (error?.response?.data?.error || '❌ Ocorreu um erro ao conectar com o Servidor de IA.');
            setAiHistory(prev => [...prev, { role: 'ai', text: msg }]);
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

                    {/* Sector tabs with management */}
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                            {isEditingSectors && (
                                <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">Modo edição</span>
                            )}
                            <button
                                onClick={() => { setIsEditingSectors(v => !v); setEditingSector(null); setIsAddingSector(false); }}
                                className={`ml-auto p-1.5 rounded-md transition-colors ${
                                    isEditingSectors
                                        ? 'bg-amber-100 text-amber-700'
                                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                                }`}
                                title="Gerenciar setores"
                            >
                                <Settings2 className="h-3.5 w-3.5" />
                            </button>
                        </div>

                        {!isEditingSectors ? (
                            // Normal pill view
                            <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-semibold overflow-x-auto hide-scrollbar">
                                {sectors.map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => setActiveSector(s.name)}
                                        className={`px-3 py-1.5 rounded-md whitespace-nowrap transition-all ${
                                            activeSector === s.name
                                                ? 'bg-white text-blue-600 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                    >
                                        {s.name}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            // Edit mode: list with rename + delete + add
                            <div className="space-y-1.5 bg-amber-50 border border-amber-200 rounded-lg p-2">
                                {sectors.map(s => (
                                    <div key={s.id} className="flex items-center gap-1.5 group">
                                        {editingsector?.id === s.id ? (
                                            <>
                                                <input
                                                    autoFocus
                                                    value={editingsector?.name ?? s.name}
                                                    onChange={e => setEditingSector({ id: s.id, name: e.target.value })}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') saveSector(s.id, editingsector.name);
                                                        if (e.key === 'Escape') setEditingSector(null);
                                                    }}
                                                    className="flex-1 text-xs border border-blue-400 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                                                />
                                                <button
                                                    onClick={() => saveSector(s.id, editingsector.name)}
                                                    className="p-1 text-green-600 hover:bg-green-100 rounded"
                                                    title="Salvar"
                                                >
                                                    <Check className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => setEditingSector(null)}
                                                    className="p-1 text-slate-500 hover:bg-slate-100 rounded"
                                                    title="Cancelar"
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <span className="flex-1 text-xs text-slate-700 font-medium px-2 py-1 bg-white rounded border border-slate-200 truncate">
                                                    {s.name}
                                                </span>
                                                <button
                                                    onClick={() => setEditingSector({ id: s.id, name: s.name })}
                                                    className="p-1 text-blue-500 hover:bg-blue-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Renomear"
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => deleteSector(s.id, s.name)}
                                                    className="p-1 text-red-400 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Excluir"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                ))}

                                {/* Add new sector */}
                                {isAddingSecor ? (
                                    <div className="flex items-center gap-1.5 mt-1 pt-1 border-t border-amber-200">
                                        <input
                                            autoFocus
                                            value={newSectorName}
                                            onChange={e => setNewSectorName(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') addSector();
                                                if (e.key === 'Escape') { setIsAddingSector(false); setNewSectorName(''); }
                                            }}
                                            placeholder="Nome do setor..."
                                            className="flex-1 text-xs border border-blue-400 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                                        />
                                        <button onClick={addSector} className="p-1 text-green-600 hover:bg-green-100 rounded" title="Confirmar">
                                            <Check className="h-3.5 w-3.5" />
                                        </button>
                                        <button onClick={() => { setIsAddingSector(false); setNewSectorName(''); }} className="p-1 text-slate-500 hover:bg-slate-100 rounded" title="Cancelar">
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setIsAddingSector(true)}
                                        className="w-full mt-1 pt-1 border-t border-amber-200 flex items-center justify-center gap-1 text-xs text-blue-600 hover:bg-blue-50 rounded py-1 transition-colors font-semibold"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        Novo setor
                                    </button>
                                )}
                            </div>
                        )}
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
                                    onClick={() => handleDocumentSwitch(() => openDocument(doc.id))}
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
                        onClick={() => handleDocumentSwitch(() => fileInputRef.current?.click())}
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
            <main className="flex-1 flex flex-col min-w-0 bg-slate-200/50 overflow-hidden relative print:overflow-visible print:bg-white">
                <div aria-label="header" className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm print:hidden">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-700 border-r border-slate-300 pr-4 mr-2">
                            {selectedDoc ? `${selectedDoc.code} - ${selectedDoc.title}` : 'Novo Documento'}
                        </span>
                        <button
                            onClick={() => setShowHeader(!showHeader)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all border shadow-sm ${showHeader ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50'}`}
                            title="Ativa/desativa o cabeçalho fixo no topo da página"
                        >
                            <Layout className="h-3.5 w-3.5" />
                            {showHeader ? 'REMOVER CABEÇALHO' : 'INSERIR CABEÇALHO'}
                        </button>
                        <button
                            onClick={() => handleDocumentSwitch(loadTemplate)}
                            className="flex items-center gap-2 px-3 py-1.5 hover:bg-blue-50 hover:text-blue-700 rounded-md text-blue-600 text-xs font-bold transition-all border border-blue-200 bg-white shadow-sm"
                            title="Apaga o documento atual e carrega a estrutura ISO de 10 tópicos"
                        >
                            <Layout className="h-3.5 w-3.5" />
                            CARREGAR TÓPICOS ISO
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
                            onClick={() => window.print()}
                            className="p-2 text-slate-500 hover:text-red-600 transition-colors flex items-center gap-2 text-sm font-semibold"
                            title="Imprimir / Gerar PDF"
                        >
                            <FileDown className="h-5 w-5" />
                            PDF / Imprimir
                        </button>
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
                    <div className="sgq-document-content w-[210mm] min-h-[297mm] bg-white shadow-2xl border border-slate-300 relative group flex flex-col mb-12 print:shadow-none print:border-none print:w-full print:h-full print:m-0">
                                                <style dangerouslySetInnerHTML={{
                            __html: `
                        .sun-editor { border: none !important; }
                        .se-resizing-bar { display: none !important; }
                        .se-toolbar {
                            position: sticky !important;
                            top: 0 !important;
                            z-index: 50 !important;
                            box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;
                            background-color: #f8fafc !important;
                            border-bottom: 1px solid #e2e8f0 !important;
                        }
                        .se-wrapper { border-radius: 8px; }
                        .se-wrapper-inner { 
                            min-height: 100%;
                            padding: ${showHeader ? '10px' : '40px'} 60px 80px 60px !important;
                            background-image: repeating-linear-gradient(
                                to bottom,
                                transparent 0mm,
                                transparent 296.8mm,
                                #cbd5e1 296.8mm,
                                #cbd5e1 297mm
                            );
                        }
                        .se-container { z-index: 10 !important; }
                        @media print {
                            .se-toolbar { display: none !important; }
                            .se-wrapper-inner { padding: 0 !important; background-image: none !important; }
                            body { background: white !important; }
                            .sgq-document-content { margin: 0 !important; border: none !important; box-shadow: none !important; }
                            aside, header, [aria-label="header"] { display: none !important; }
                        }
                        `
                        }} />

                        {showHeader && <DocumentHeader headerData={headerData} setHeaderData={setHeaderData} activeSector={activeSector} />}
                        <SunEditor 
                            setContents={content}
                            onChange={setContent}
                            onMouseUp={(e, core) => {
                                const sel = window.getSelection();
                                if (sel && sel.toString().trim()) {
                                    setSelectedText(sel.toString());
                                }
                            }}
                            onKeyUp={(e, core) => {
                                const sel = window.getSelection();
                                if (sel && sel.toString().trim()) {
                                    setSelectedText(sel.toString());
                                }
                            }}
                            setOptions={{
                                height: 'auto',
                                minHeight: '600px',
                                buttonList: [
                                    ['undo', 'redo'],
                                    ['font', 'fontSize', 'formatBlock'],
                                    ['paragraphStyle', 'blockquote'],
                                    ['bold', 'underline', 'italic', 'strike', 'subscript', 'superscript'],
                                    ['fontColor', 'hiliteColor', 'textStyle'],
                                    ['removeFormat'],
                                    '/', 
                                    ['outdent', 'indent'],
                                    ['align', 'horizontalRule', 'list', 'lineHeight'],
                                    ['table', 'link', 'image', 'video'],
                                    ['fullScreen', 'showBlocks', 'codeView'],
                                    ['preview', 'print']
                                ],
                                defaultStyle: "font-family: Arial, sans-serif; font-size: 11pt;"
                            }}
                            className="custom-sun-editor"
                        />
                    </div>
                </div>
            </main>

            {/* AI Assistant Drawer */}
            {isAIOpen && (
                <aside className="w-80 bg-white border-l border-slate-200 flex flex-col shadow-2xl z-20 flex-shrink-0 animate-in slide-in-from-right">
                    <div className="p-4 border-b border-slate-100 bg-indigo-600 text-white flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                            <div className="bg-white/20 p-2 rounded-lg">
                                <Bot className="h-6 w-6" />
                            </div>
                            <div className="flex-1">
                                <h2 className="font-bold text-sm">Assistente ISO 9001</h2>
                                <select 
                                    value={aiModel} 
                                    onChange={(e) => setAiModel(e.target.value)}
                                    className="mt-1 text-[10px] bg-indigo-700 text-indigo-100 border-none rounded outline-none w-full p-1 cursor-pointer font-medium appearance-none"
                                >
                                    <option value="gemini-2.5-flash">⚡ Gemini 2.5 Flash (Rápido)</option>
                                    <option value="gemini-2.5-pro">🧠 Gemini 2.5 Pro (Avançado)</option>
                                    <option value="gemini-1.5-pro">🧠 Gemini 1.5 Pro (Legado)</option>
                                </select>
                            </div>
                            <button 
                                onClick={() => setIsAIOpen(false)}
                                className="p-1 hover:bg-white/20 rounded text-white transition-colors self-start"
                                title="Fechar Assistente"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <button 
                            onClick={() => {
                                const sel = window.getSelection();
                                const text = sel ? sel.toString().trim() : '';
                                if (text) setSelectedText(text);
                                else alert('Nenhum texto selecionado no editor!');
                            }}
                            className="w-full py-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-[11px] font-bold rounded flex items-center justify-center gap-2 transition-colors border border-indigo-400"
                            title="Puxar o texto que está selecionado no documento"
                        >
                            Capturar Texto Selecionado
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                        {aiHistory.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[90%] rounded-xl p-3 text-sm shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none flex flex-col gap-2'}`}>
                                    <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(msg.text) }} />
                                    {msg.role === 'ai' && (
                                        <div className="flex gap-2 mt-2 pt-2 border-t border-slate-100">
                                            <button 
                                                onClick={() => {
                                                    if (sunEditorRef.current) {
                                                        if (msg.targetText) {
                                                            // Se existe no HTML puro, substitui direto
                                                            if (content.includes(msg.targetText)) {
                                                                setContent(content.replace(msg.targetText, msg.text));
                                                            } else {
                                                                // Truque: Procura o texto na tela para forçar a seleção no SunEditor
                                                                // e então injeta em cima da seleção.
                                                                // Limpa seleção atual primeiro para garantir que find procure do início
                                                                window.getSelection().removeAllRanges();
                                                                const found = window.find(msg.targetText, false, false, true, false, false, false);
                                                                if (found) {
                                                                    sunEditorRef.current.insertHTML(msg.text, true, true);
                                                                } else {
                                                                    sunEditorRef.current.insertHTML(msg.text, true, true);
                                                                }
                                                            }
                                                        } else {
                                                            sunEditorRef.current.insertHTML(msg.text, true, true);
                                                        }
                                                    } else {
                                                        setContent(content + `<br/>${msg.text}`);
                                                    }
                                                }}
                                                className="flex-1 bg-green-500 hover:bg-green-600 text-white text-[10px] font-bold py-1.5 px-2 rounded flex items-center justify-center gap-1 transition-colors"
                                            >
                                                <Check className="h-3 w-3" />
                                                {msg.targetText ? 'Substituir Seleção' : 'Inserir no Cursor'}
                                            </button>
                                        </div>
                                    )}
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
                            <div className="mb-2">
                                <input type="file" ref={contextFileInputRef} className="hidden" accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.webp" onChange={handleUploadContext} />
                                {aiContextFileName ? (
                                    <div className="flex items-center justify-between bg-emerald-50 text-emerald-700 text-[10px] p-2 rounded border border-emerald-200">
                                        <div className="flex items-center gap-1 overflow-hidden">
                                            <FileUp className="h-3 w-3 flex-shrink-0" />
                                            <span className="truncate font-medium">{aiContextFileName}</span>
                                        </div>
                                        <button onClick={() => {setAiContextFileName(''); setAiContextText('');}} className="p-1 hover:bg-emerald-100 rounded text-emerald-600"><X className="h-3 w-3" /></button>
                                    </div>
                                ) : (
                                    <button 
                                        onClick={() => contextFileInputRef.current?.click()} 
                                        disabled={aiContextLoading}
                                        className="w-full flex items-center justify-center gap-2 text-[10px] text-slate-500 bg-slate-100 hover:bg-slate-200 py-1.5 rounded transition-colors"
                                    >
                                        {aiContextLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
                                        {aiContextLoading ? 'Processando arquivo...' : 'Anexar PDF, Word ou Imagem'}
                                    </button>
                                )}
                            </div>
                            <textarea
                                rows="3"
                                className="w-full bg-slate-100 border-none rounded-xl pr-12 pl-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 resize-none"
                                placeholder="Ex: Crie um tópico com base no anexo..."
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

            {/* Help Drawer & Floating Button */}
            <HelpDrawer />
            <button
                onClick={() => openHelp('/sgq/documentos')}
                title="Ajuda desta tela"
                aria-label="Abrir ajuda contextual"
                className="fixed bottom-6 right-6 z-[990] w-12 h-12 rounded-full bg-slate-900 text-white shadow-2xl hover:bg-blue-600 flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 print:hidden"
            >
                <HelpCircle className="h-5 w-5" />
            </button>
        </div >
    );
};

export default SGQDocuments;
