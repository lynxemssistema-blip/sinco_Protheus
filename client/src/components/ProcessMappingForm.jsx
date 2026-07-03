import React, { useState, useEffect } from 'react';
import { X, Save, ArrowRight, User, Box, FileText, CheckSquare, Target } from 'lucide-react';
import './ProcessMappingForm.css'; // We'll create simple styles

import api from '../services/api';

const generateId = () => {
    return (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') 
        ? crypto.randomUUID() 
        : Date.now().toString(36) + Math.random().toString(36).substring(2);
};

const ProcessMappingForm = ({ onClose, onSave, initialData = null }) => {
    const [sgqDocuments, setSgqDocuments] = useState([]);
    const [formData, setFormData] = useState({
        sector: '',
        leader: '',
        inputsList: [{ id: generateId(), supplier: '', input: '', documents: [] }],
        activity: '',
        outputsList: [{ id: generateId(), output: '', customer: '', documents: [] }],
        mission: '',
        supportActivities: '',
        supportDocuments: []
    });

    React.useEffect(() => {
        // Fetch SGQ Documents
        const fetchDocs = async () => {
            try {
                const res = await api.get('/sgq-documents');
                setSgqDocuments(res.data);
            } catch (err) {
                console.error("Erro ao carregar documentos SGQ:", err);
            }
        };
        fetchDocs();

        if (initialData) {
            // Migration logic for legacy data
            let newInputs = initialData.inputsList ? [...initialData.inputsList] : [];
            if (newInputs.length === 0 && (initialData.supplier || initialData.inputs)) {
                newInputs.push({ id: generateId(), supplier: initialData.supplier || '', input: initialData.inputs || '', documents: [] });
            }
            if (newInputs.length === 0) newInputs.push({ id: generateId(), supplier: '', input: '', documents: [] });
            else newInputs = newInputs.map(item => ({ ...item, id: item.id || generateId(), documents: item.documents || [] }));

            let newOutputs = initialData.outputsList ? [...initialData.outputsList] : [];
            if (newOutputs.length === 0 && (initialData.outputs || initialData.customer)) {
                newOutputs.push({ id: generateId(), output: initialData.outputs || '', customer: initialData.customer || '', documents: [] });
            }
            if (newOutputs.length === 0) newOutputs.push({ id: generateId(), output: '', customer: '', documents: [] });
            else newOutputs = newOutputs.map(item => ({ ...item, id: item.id || generateId(), documents: item.documents || [] }));

            setFormData(prev => ({
                ...prev,
                ...initialData,
                mission: initialData.mission || '',
                supportDocuments: initialData.supportDocuments || [],
                inputsList: newInputs,
                outputsList: newOutputs
            }));
        }
    }, [initialData]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Dynamic List Handlers
    const handleListChange = (listName, index, field, value) => {
        setFormData(prev => {
            const newList = [...prev[listName]];
            newList[index] = { ...newList[index], [field]: value };
            return { ...prev, [listName]: newList };
        });
    };

    const addRow = (listName) => {
        setFormData(prev => ({
            ...prev,
            [listName]: [...prev[listName], listName === 'inputsList' ? { id: generateId(), supplier: '', input: '' } : { id: generateId(), output: '', customer: '' }]
        }));
    };

    const removeRow = (listName, index) => {
        setFormData(prev => {
            if (prev[listName].length <= 1) return prev; // Keep at least one
            const newList = prev[listName].filter((_, i) => i !== index);
            return { ...prev, [listName]: newList };
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[1001] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto animate-slideUp print:max-h-none print:h-auto print:overflow-visible print:shadow-none">
                {/* PRINT HEADER - METALFISA STANDARD */}
                <div className="hidden print:flex flex-col border-b border-black mb-6">
                    <div className="flex border-b border-black">
                        <div className="w-40 p-4 border-r border-black flex items-center justify-center font-bold text-2xl tracking-wider bg-gray-100">METALFISA</div>
                        <div className="flex-1 p-2 flex items-center justify-center font-bold text-xl uppercase tracking-wide">Mapeamento de Processo</div>
                        <div className="w-40 text-xs flex flex-col text-center">
                            <div className="border-b border-black p-2 flex-1 flex items-center justify-center font-mono">DATA: {new Date().toLocaleDateString('pt-BR')}</div>
                            <div className="p-2 flex-1 flex items-center justify-center font-mono">REV: 02</div>
                        </div>
                    </div>
                </div>

                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center z-10 print:hidden">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <FileText className="h-5 w-5 text-blue-600" />
                            Ficha de Processo
                        </h2>
                        <p className="text-sm text-gray-500">Mapeamento padronizado conforme Manual de Organização</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => window.print()}
                            className="p-2 hover:bg-blue-50 text-blue-600 rounded-full transition-colors print:hidden"
                            title="Imprimir / Salvar PDF"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors print:hidden">
                            <X className="h-6 w-6" />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-8">

                    {/* 1. Identification */}
                    <section className="bg-blue-50 p-6 rounded-lg border border-blue-100 print:bg-white print:border-black">
                        <h3 className="text-md font-bold text-blue-800 mb-4 flex items-center gap-2 print:text-black">
                            <User className="h-4 w-4" />
                            Identificação do Setor
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Setor / Departamento</label>
                                <input
                                    name="sector"
                                    value={formData.sector}
                                    onChange={handleChange}
                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none print:border-b print:border-t-0 print:border-x-0 print:rounded-none"
                                    placeholder="Ex: Corte a Laser"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Líder / Responsável</label>
                                <input
                                    name="leader"
                                    value={formData.leader}
                                    onChange={handleChange}
                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none print:border-b print:border-t-0 print:border-x-0 print:rounded-none"
                                    placeholder="Ex: João Silva"
                                    required
                                />
                            </div>
                            <div className="col-span-1 md:col-span-2 space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Missão do Setor</label>
                                <p className="text-xs text-gray-500 italic print:hidden">Por que este setor existe? Qual seu papel na fábrica?</p>
                                <textarea
                                    name="mission"
                                    value={formData.mission}
                                    onChange={handleChange}
                                    rows={2}
                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none print:border-b print:border-t-0 print:border-x-0 print:rounded-none"
                                    placeholder="Ex: Garantir o corte preciso de peças metálicas para alimentar a linha de produção..."
                                />
                            </div>
                        </div>
                    </section>

                    {/* 2. Process Flow */}
                    <section className="print:border-none print:p-0">
                        <h3 className="text-md font-bold text-gray-800 mb-4 flex items-center gap-2 print:text-black print:border-b print:border-black print:pb-2">
                            <Box className="h-4 w-4 text-gray-600 print:text-black" />
                            Fluxo do Processo (SIPOC)
                        </h3>

                        <div className="flex flex-col md:flex-row items-stretch gap-4 print:gap-8">

                            {/* Input Side - Dynmaic List */}
                            <div className="flex-1 space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200 print:bg-white print:border-none print:p-0">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider print:text-black print:border-b print:border-black print:w-full print:mb-2">Entradas (Inputs)</span>
                                    <button type="button" onClick={() => addRow('inputsList')} className="text-blue-600 hover:text-blue-800 text-xs font-bold flex items-center gap-1 print:hidden">
                                        <div className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center">+</div> Adicionar
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {formData.inputsList.map((item, index) => (
                                        <div key={item.id} className="flex gap-2 items-start group">
                                            <div className="flex-1 grid grid-cols-1 gap-2 border-b border-gray-200 pb-3 print:border-gray-400">
                                                <div>
                                                    <label className="text-[10px] font-semibold text-gray-500 uppercase print:hidden">Fornecedor</label>
                                                    <input
                                                        value={item.supplier}
                                                        onChange={(e) => handleListChange('inputsList', index, 'supplier', e.target.value)}
                                                        className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500 print:border-none print:p-0 print:font-bold"
                                                        placeholder="Fornecedor"
                                                    />
                                                </div>
                                                <div className="relative">
                                                    <label className="text-[10px] font-semibold text-gray-500 uppercase print:hidden">Item / Entrada</label>
                                                    <textarea
                                                        value={item.input}
                                                        onChange={(e) => handleListChange('inputsList', index, 'input', e.target.value)}
                                                        rows={2}
                                                        className="w-full p-2 border border-gray-300 rounded-md text-sm resize-none focus:ring-1 focus:ring-blue-500 print:border-none print:p-0"
                                                        placeholder="Descrição da entrada..."
                                                    />
                                                    <div className="mt-2 print:hidden">
                                                        <label className="text-[10px] font-semibold text-blue-600 uppercase mb-1 block">Documentos Associados</label>
                                                        
                                                        {item.documents && item.documents.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mb-2">
                                                                {item.documents.map(docId => {
                                                                    const doc = sgqDocuments.find(d => String(d.id) === String(docId));
                                                                    if (!doc) return null;
                                                                    return (
                                                                        <a 
                                                                            key={docId} 
                                                                            href={`/sgq/documentos?docId=${docId}`} 
                                                                            target="_blank" 
                                                                            rel="noopener noreferrer"
                                                                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full hover:bg-blue-200 transition-colors"
                                                                            title={doc.title}
                                                                        >
                                                                            📄 {doc.code || 'DOC'}
                                                                            <button 
                                                                                type="button" 
                                                                                onClick={(e) => { 
                                                                                    e.preventDefault(); 
                                                                                    handleListChange('inputsList', index, 'documents', item.documents.filter(id => id !== docId));
                                                                                }} 
                                                                                className="text-blue-400 hover:text-red-500 ml-1 rounded-full p-0.5 flex items-center justify-center"
                                                                            >
                                                                                <X className="h-3 w-3" />
                                                                            </button>
                                                                        </a>
                                                                    )
                                                                })}
                                                            </div>
                                                        )}

                                                        <select
                                                            value=""
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                if (!val) return;
                                                                const currentDocs = item.documents || [];
                                                                if (!currentDocs.includes(val)) {
                                                                    handleListChange('inputsList', index, 'documents', [...currentDocs, val]);
                                                                }
                                                            }}
                                                            className="w-full p-1.5 border border-blue-200 rounded text-xs bg-white focus:ring-1 focus:ring-blue-500 outline-none text-slate-600"
                                                        >
                                                            <option value="">+ Associar novo documento...</option>
                                                            {sgqDocuments.filter(d => !(item.documents||[]).includes(String(d.id))).map(doc => (
                                                                <option key={doc.id} value={doc.id}>{doc.code || 'DOC'} - {doc.title}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    {item.documents?.length > 0 && (
                                                        <div className="mt-1 text-[10px] text-blue-800 font-bold hidden print:block">
                                                            📄 Docs: {item.documents.map(id => sgqDocuments.find(d => String(d.id) === String(id))?.code).filter(Boolean).join(', ')}
                                                        </div>
                                                    )}
                                                    <div className="absolute -left-3 top-2 print:block hidden">
                                                        <ArrowRight className="h-3 w-3 text-black" />
                                                    </div>
                                                </div>
                                            </div>
                                            {formData.inputsList.length > 1 && (
                                                <button type="button" onClick={() => removeRow('inputsList', index)} className="mt-2 text-gray-400 hover:text-red-500 print:hidden">
                                                    <X className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Center Arrow - Screen Only */}
                            <div className="hidden md:flex items-center justify-center print:hidden">
                                <ArrowRight className="text-gray-400 h-6 w-6" />
                            </div>

                            {/* Processing Side */}
                            <div className="flex-[1.5] space-y-4 bg-blue-50 p-4 rounded-lg border-2 border-blue-200 print:bg-white print:border-l-2 print:border-r-2 print:border-black print:px-6">
                                <span className="text-xs font-bold text-blue-400 uppercase tracking-wider print:text-black print:border-b print:border-black print:w-full print:block print:mb-2">Processamento</span>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-blue-900 print:text-black">Atividades Principais</label>
                                    <p className="text-xs text-blue-600 italic print:hidden">As tarefas que agregam valor e transformam o input em output.</p>
                                    <textarea
                                        name="activity"
                                        value={formData.activity}
                                        onChange={handleChange}
                                        rows={8} // More space
                                        className="w-full p-2.5 border border-blue-200 rounded-md text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none print:border-none print:p-0 print:h-auto print:overflow-visible print:whitespace-pre-wrap"
                                        placeholder="1. Verificar OP e material&#10;2. Configurar máquina CNC&#10;3. Executar corte..."
                                        required
                                    />
                                </div>
                            </div>

                            {/* Center Arrow - Screen Only */}
                            <div className="hidden md:flex items-center justify-center print:hidden">
                                <ArrowRight className="text-gray-400 h-6 w-6" />
                            </div>

                            {/* Output Side - Dynamic List */}
                            <div className="flex-1 space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200 print:bg-white print:border-none print:p-0">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider print:text-black print:border-b print:border-black print:w-full print:mb-2">Saídas (Outputs)</span>
                                    <button type="button" onClick={() => addRow('outputsList')} className="text-blue-600 hover:text-blue-800 text-xs font-bold flex items-center gap-1 print:hidden">
                                        <div className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center">+</div> Adicionar
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {formData.outputsList.map((item, index) => (
                                        <div key={item.id} className="flex gap-2 items-start group">
                                            {formData.outputsList.length > 1 && (
                                                <button type="button" onClick={() => removeRow('outputsList', index)} className="mt-2 text-gray-400 hover:text-red-500 print:hidden">
                                                    <X className="h-4 w-4" />
                                                </button>
                                            )}
                                            <div className="flex-1 grid grid-cols-1 gap-2 border-b border-gray-200 pb-3 print:border-gray-400">
                                                <div className="relative">
                                                    <label className="text-[10px] font-semibold text-gray-500 uppercase print:hidden">Item / Saída</label>
                                                    <textarea
                                                        value={item.output}
                                                        onChange={(e) => handleListChange('outputsList', index, 'output', e.target.value)}
                                                        rows={2}
                                                        className="w-full p-2 border border-gray-300 rounded-md text-sm resize-none focus:ring-1 focus:ring-blue-500 print:border-none print:p-0 text-right print:text-left"
                                                        placeholder="Descrição da saída..."
                                                    />
                                                    <div className="mt-2 print:hidden">
                                                        <label className="text-[10px] font-semibold text-blue-600 uppercase mb-1 block text-right">Documentos Associados</label>
                                                        
                                                        {item.documents && item.documents.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mb-2 justify-end">
                                                                {item.documents.map(docId => {
                                                                    const doc = sgqDocuments.find(d => String(d.id) === String(docId));
                                                                    if (!doc) return null;
                                                                    return (
                                                                        <a 
                                                                            key={docId} 
                                                                            href={`/sgq/documentos?docId=${docId}`} 
                                                                            target="_blank" 
                                                                            rel="noopener noreferrer"
                                                                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full hover:bg-blue-200 transition-colors"
                                                                            title={doc.title}
                                                                        >
                                                                            📄 {doc.code || 'DOC'}
                                                                            <button 
                                                                                type="button" 
                                                                                onClick={(e) => { 
                                                                                    e.preventDefault(); 
                                                                                    handleListChange('outputsList', index, 'documents', item.documents.filter(id => id !== docId));
                                                                                }} 
                                                                                className="text-blue-400 hover:text-red-500 ml-1 rounded-full p-0.5 flex items-center justify-center"
                                                                            >
                                                                                <X className="h-3 w-3" />
                                                                            </button>
                                                                        </a>
                                                                    )
                                                                })}
                                                            </div>
                                                        )}

                                                        <select
                                                            value=""
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                if (!val) return;
                                                                const currentDocs = item.documents || [];
                                                                if (!currentDocs.includes(val)) {
                                                                    handleListChange('outputsList', index, 'documents', [...currentDocs, val]);
                                                                }
                                                            }}
                                                            className="w-full p-1.5 border border-blue-200 rounded text-xs bg-white focus:ring-1 focus:ring-blue-500 outline-none text-slate-600 text-right"
                                                        >
                                                            <option value="">+ Associar novo documento...</option>
                                                            {sgqDocuments.filter(d => !(item.documents||[]).includes(String(d.id))).map(doc => (
                                                                <option key={doc.id} value={doc.id} dir="rtl">{doc.title} - {doc.code || 'DOC'}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    {item.documents?.length > 0 && (
                                                        <div className="mt-1 text-[10px] text-blue-800 font-bold hidden print:block text-left">
                                                            📄 Docs: {item.documents.map(id => sgqDocuments.find(d => String(d.id) === String(id))?.code).filter(Boolean).join(', ')}
                                                        </div>
                                                    )}
                                                    <div className="absolute -right-3 top-2 print:block hidden">
                                                        <ArrowRight className="h-3 w-3 text-black" />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-semibold text-gray-500 uppercase print:hidden">Cliente</label>
                                                    <input
                                                        value={item.customer}
                                                        onChange={(e) => handleListChange('outputsList', index, 'customer', e.target.value)}
                                                        className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500 print:border-none print:p-0 print:font-bold text-right print:text-left"
                                                        placeholder="Cliente"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* 3. Support Activities */}
                    <section>
                        <h3 className="text-md font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <CheckSquare className="h-4 w-4 text-gray-600" />
                            Atividades de Apoio & Responsabilidades
                        </h3>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Atividades de Suporte / Burocráticas</label>
                            <textarea
                                name="supportActivities"
                                value={formData.supportActivities}
                                onChange={handleChange}
                                rows={3}
                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none mb-2"
                                placeholder="Ex: Preenchimento de relatório de produção, Limpeza da máquina, Solicitação de manutenção..."
                            />

                            <div className="print:hidden bg-gray-50 p-3 rounded-lg border border-gray-200">
                                <label className="text-[11px] font-semibold text-gray-600 uppercase mb-2 block">Documentos Associados (Apoio)</label>
                                
                                {formData.supportDocuments && formData.supportDocuments.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mb-2">
                                        {formData.supportDocuments.map(docId => {
                                            const doc = sgqDocuments.find(d => String(d.id) === String(docId));
                                            if (!doc) return null;
                                            return (
                                                <a 
                                                    key={docId} 
                                                    href={`/sgq/documentos?docId=${docId}`} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 px-2 py-1 bg-gray-200 text-gray-700 text-[10px] font-bold rounded-full hover:bg-gray-300 transition-colors"
                                                    title={doc.title}
                                                >
                                                    📄 {doc.code || 'DOC'}
                                                    <button 
                                                        type="button" 
                                                        onClick={(e) => { 
                                                            e.preventDefault(); 
                                                            setFormData({...formData, supportDocuments: formData.supportDocuments.filter(id => id !== docId)});
                                                        }} 
                                                        className="text-gray-500 hover:text-red-500 ml-1 rounded-full p-0.5 flex items-center justify-center"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </a>
                                            )
                                        })}
                                    </div>
                                )}

                                <select
                                    value=""
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (!val) return;
                                        const currentDocs = formData.supportDocuments || [];
                                        if (!currentDocs.includes(val)) {
                                            setFormData({...formData, supportDocuments: [...currentDocs, val]});
                                        }
                                    }}
                                    className="w-full p-2 border border-gray-300 rounded text-xs bg-white focus:ring-1 focus:ring-blue-500 outline-none text-slate-600"
                                >
                                    <option value="">+ Associar novo documento ao apoio...</option>
                                    {sgqDocuments.filter(d => !(formData.supportDocuments||[]).includes(String(d.id))).map(doc => (
                                        <option key={doc.id} value={doc.id}>{doc.code || 'DOC'} - {doc.title}</option>
                                    ))}
                                </select>
                            </div>
                            
                            {formData.supportDocuments?.length > 0 && (
                                <div className="mt-1 text-xs text-gray-700 hidden print:block border-t border-gray-300 pt-1">
                                    <span className="font-bold">📄 Documentos de Apoio:</span> {formData.supportDocuments.map(id => sgqDocuments.find(d => String(d.id) === String(id))?.code).filter(Boolean).join(', ')}
                                </div>
                            )}
                        </div>
                    </section>

                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 flex items-start gap-3">
                        <Target className="h-5 w-5 text-yellow-600 mt-0.5" />
                        <div>
                            <h4 className="text-sm font-bold text-yellow-800">Lembre-se da Regra de Ouro:</h4>
                            <p className="text-sm text-yellow-700 italic">"O próximo setor é meu cliente! Se entrego com defeito, prejudico meu cliente."</p>
                        </div>
                    </div>

                    <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 flex justify-end gap-3 rounded-b-xl mt-8 print:hidden">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm flex items-center gap-2 transition-colors"
                        >
                            <Save className="h-4 w-4" />
                            {initialData ? 'Atualizar Mapeamento' : 'Salvar Mapeamento'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProcessMappingForm;
