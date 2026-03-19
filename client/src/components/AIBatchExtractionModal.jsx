import React, { useState, useEffect } from 'react';
import { Bot, X, FileText, CheckCircle2, XCircle, ChevronRight, Save, Edit3, Loader2 } from 'lucide-react';
import { getProdutos, extractProductAIInfo, bulkSaveAIMetadata } from '../services/api';

const AIBatchExtractionModal = ({ isOpen, onClose, productFilters, onSuccess }) => {
    const [step, setStep] = useState(1); // 1: Selection, 2: Processing, 3: Review
    const [status, setStatus] = useState('loading'); // loading, idle, processing, saving, finished
    const [productsToProcess, setProductsToProcess] = useState([]);
    const [selectedProducts, setSelectedProducts] = useState(new Set());
    const [results, setResults] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);

    // Initial setup: fetch how many products match the current filters AND have PDFs
    useEffect(() => {
        if (isOpen && step === 1) {
            const fetchProducts = async () => {
                setStatus('loading');
                try {
                    const { data } = await getProdutos({
                        ...productFilters,
                        pdf_status: 'with_pdf',
                        limit: 999999,
                        page: 1
                    });
                    
                    const eligible = data.filter(p => p.tem_arquivos);
                    setProductsToProcess(eligible);
                    // Selecionar todos por padrão
                    setSelectedProducts(new Set(eligible.map(p => p.codigo)));
                    setStatus('idle');
                } catch (err) {
                    console.error('Erro ao buscar produtos para extração IA:', err);
                    setStatus('idle');
                }
            };
            fetchProducts();
        }
    }, [isOpen, productFilters, step]);

    const handleToggleSelection = (codigo) => {
        const newSet = new Set(selectedProducts);
        if (newSet.has(codigo)) newSet.delete(codigo);
        else newSet.add(codigo);
        setSelectedProducts(newSet);
    };

    const handleToggleAll = () => {
        if (selectedProducts.size === productsToProcess.length) {
            setSelectedProducts(new Set());
        } else {
            setSelectedProducts(new Set(productsToProcess.map(p => p.codigo)));
        }
    };

    const handleStartProcessing = async () => {
        setStep(2);
        setStatus('processing');
        setResults([]);
        setCurrentIndex(0);

        const itemsToProcess = productsToProcess.filter(p => selectedProducts.has(p.codigo));

        for (let i = 0; i < itemsToProcess.length; i++) {
            setCurrentIndex(i);
            const prodCode = itemsToProcess[i].codigo;
            
            try {
                // Pass preview: true to skip DB save
                const result = await extractProductAIInfo(prodCode, { preview: true });
                setResults(prev => [...prev, { 
                    codigo: prodCode, 
                    success: true,
                    documento_id: result.documento_id,
                    url_arquivo: result.url_arquivo,
                    data: {
                        peso_kg: result.metadata?.peso_kg || '',
                        area_pintura_m2: result.metadata?.area_pintura_m2 || ''
                    }
                }]);
            } catch (err) {
                setResults(prev => [...prev, { 
                    codigo: prodCode, 
                    success: false, 
                    error: err.response?.data?.error || err.message,
                    data: { peso_kg: '', area_pintura_m2: '' }
                }]);
            }

            // Rate limit safety delay
            if (i < itemsToProcess.length - 1) {
                await new Promise(r => setTimeout(r, 1500));
            }
        }
        
        setStep(3);
        setStatus('idle');
    };

    const handleResultChange = (index, field, value) => {
        const newResults = [...results];
        newResults[index].data[field] = value;
        setResults(newResults);
    };

    const handleFinalSave = async () => {
        setStatus('saving');
        try {
            // Only send successful extractions or items the user manually filled, that have a documento_id
            const itemsToSave = results
                .filter(r => r.documento_id && (r.data.peso_kg !== '' || r.data.area_pintura_m2 !== ''))
                .map(r => ({
                    documento_id: r.documento_id,
                    peso_kg: r.data.peso_kg,
                    area_pintura_m2: r.data.area_pintura_m2
                }));

            if (itemsToSave.length > 0) {
                await bulkSaveAIMetadata(itemsToSave);
            }
            setStatus('finished');
        } catch (err) {
            console.error('Erro ao salvar lote:', err);
            alert('Erro ao salvar os dados. Verifique a conexão.');
            setStatus('idle');
        }
    };

    const handleClose = () => {
        if (status === 'finished' && onSuccess) {
            onSuccess();
        }
        // Reseta estados para próxima vez
        setStep(1);
        setStatus('idle');
        setResults([]);
        setProductsToProcess([]);
        onClose();
    };

    // Helper to get filename
    const getFileName = (url) => {
        if (!url) return 'Desconhecido';
        const parts = url.split(/[/\\]/);
        return parts[parts.length - 1];
    };

    if (!isOpen) return null;

    const itemsToProcessCount = selectedProducts.size;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 sm:p-6">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                
                {/* Header */}
                <div className="p-5 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-50 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-indigo-600 p-2.5 rounded-lg shadow-sm">
                            <Bot className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">
                                Extração em Lote com Inteligência Artificial
                            </h2>
                            <p className="text-sm text-gray-600 mt-1 flex items-center gap-2">
                                <span className={step >= 1 ? "font-semibold text-indigo-700" : ""}>1. Seleção</span>
                                <ChevronRight className="h-3 w-3 text-gray-400" />
                                <span className={step >= 2 ? "font-semibold text-indigo-700" : ""}>2. Processamento</span>
                                <ChevronRight className="h-3 w-3 text-gray-400" />
                                <span className={step >= 3 ? "font-semibold text-indigo-700" : ""}>3. Revisão & Salvar</span>
                            </p>
                        </div>
                    </div>
                    {status !== 'processing' && status !== 'saving' && (
                        <button
                            onClick={handleClose}
                            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-white rounded-full transition-colors"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    )}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50/50">
                    
                    {status === 'loading' && step === 1 && (
                        <div className="flex flex-col items-center justify-center py-16">
                            <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mb-4" />
                            <p className="text-gray-600 font-medium">Mapeando produtos filtrados que possuem anexos PDF...</p>
                        </div>
                    )}

                    {/* Step 1: Selection */}
                    {step === 1 && status === 'idle' && (
                        <div className="flex flex-col h-full">
                            {productsToProcess.length === 0 ? (
                                <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                                    <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                                    <p className="text-lg font-medium text-gray-800">Nenhum produto com PDF encontrado</p>
                                    <p className="text-gray-500 mt-1">Refine seus filtros no Catálogo atual e tente novamente.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="mb-4 flex items-center justify-between">
                                        <p className="text-sm text-gray-600 bg-blue-50 text-blue-800 px-3 py-1.5 rounded-lg border border-blue-100 font-medium">
                                            Selecione os arquivos que deseja enviar para a inteligência artificial analisar.
                                        </p>
                                        <div className="text-sm font-semibold text-indigo-600 bg-white px-3 py-1 border border-indigo-100 rounded-md shadow-sm">
                                            {selectedProducts.size} de {productsToProcess.length} selecionados
                                        </div>
                                    </div>
                                    
                                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex-1 flex flex-col min-h-0">
                                        <div className="overflow-y-auto flex-1">
                                            <table className="w-full text-sm text-left relative">
                                                <thead className="bg-gray-50 text-gray-600 text-xs font-semibold uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                                                    <tr>
                                                        <th className="px-4 py-3 w-12 text-center">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={selectedProducts.size === productsToProcess.length && productsToProcess.length > 0}
                                                                onChange={handleToggleAll}
                                                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer h-4 w-4"
                                                            />
                                                        </th>
                                                        <th className="px-4 py-3">Produto</th>
                                                        <th className="px-4 py-3 border-l border-gray-200">Arquivo PDF Mapeado</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {productsToProcess.map((prod) => (
                                                        <tr key={prod.codigo} className={`hover:bg-indigo-50/50 transition-colors ${selectedProducts.has(prod.codigo) ? 'bg-indigo-50/30' : ''}`}>
                                                            <td className="px-4 py-3 text-center">
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={selectedProducts.has(prod.codigo)}
                                                                    onChange={() => handleToggleSelection(prod.codigo)}
                                                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer h-4 w-4"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3 font-mono font-bold text-gray-800">{prod.codigo}</td>
                                                            <td className="px-4 py-3 border-l border-gray-100">
                                                                <div className="flex items-center gap-2 text-gray-600">
                                                                    <FileText className="h-4 w-4 text-red-500 shrink-0" />
                                                                    <span className="truncate max-w-[250px] sm:max-w-md xl:max-w-lg block" title="O PDF mais recente será usado na extração">
                                                                        Será analisado automaticamente
                                                                    </span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Step 2: Processing */}
                    {step === 2 && status === 'processing' && (
                        <div className="py-12 px-4 max-w-xl mx-auto flex flex-col justify-center h-full">
                            <div className="bg-white p-8 rounded-2xl shadow-sm border border-indigo-100 text-center relative overflow-hidden">
                                {/* Decorative background element */}
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-teal-500 to-indigo-500"></div>
                                
                                <Bot className="h-16 w-16 text-indigo-500 mx-auto mb-6 animate-pulse" />
                                
                                <div className="flex justify-between text-sm font-bold mb-3 text-indigo-900">
                                    <span>Lendo arquivo PDF e analisando geometria...</span>
                                    <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">{Math.round(((currentIndex) / itemsToProcessCount) * 100)}%</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-3 mb-6 overflow-hidden border border-gray-200">
                                    <div 
                                        className="bg-indigo-600 h-full rounded-full transition-all duration-500 ease-out flex items-center justify-end pr-2 relative overflow-hidden" 
                                        style={{ width: `${Math.max(5, ((currentIndex + 1) / itemsToProcessCount) * 100)}%` }}
                                    >
                                        <div className="absolute top-0 bottom-0 left-0 right-0 bg-white/20 animate-move-stripes" style={{ backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)', backgroundSize: '1rem 1rem' }}></div>
                                    </div>
                                </div>
                                
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center mt-4">
                                    <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">Processando Produto</p>
                                    <p className="text-lg text-gray-800 font-mono font-semibold tracking-tight">
                                        {Array.from(selectedProducts)[currentIndex]}
                                    </p>
                                    <p className="text-sm text-gray-400 mt-2">Pode levar até 15 segundos por arquivo.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Review */}
                    {step === 3 && (status === 'idle' || status === 'saving' || status === 'finished') && (
                        <div className="flex flex-col h-full animate-fadeIn">
                            {status === 'finished' ? (
                                <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center mb-6 shadow-sm">
                                    <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-3" />
                                    <h3 className="text-2xl font-bold text-green-800 mb-2">Dados Salvos com Sucesso!</h3>
                                    <p className="text-green-700">Seu catálogo já foi atualizado com as extrações e edições manuais.</p>
                                </div>
                            ) : (
                                <div className="mb-4 bg-yellow-50 text-yellow-800 p-4 rounded-lg flex items-start gap-3 border border-yellow-200 shadow-sm">
                                    <Edit3 className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-bold text-sm">Passo de Revisão da IA</p>
                                        <p className="text-sm mt-1 opacity-90">
                                            A IA extraiu os dados abaixo a partir da leitura dos PDFs. 
                                            <strong> Preencha manualmente os campos que falharam ou corrija os valores antes de salvar.</strong>
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex-1 flex flex-col min-h-0">
                                <div className="overflow-y-auto flex-1">
                                    <table className="w-full text-sm text-left relative">
                                        <thead className="bg-gray-50 text-gray-700 text-xs font-bold uppercase tracking-wider sticky top-0 z-10 shadow-sm border-b border-gray-200">
                                            <tr>
                                                <th className="px-5 py-4 w-10 text-center">St</th>
                                                <th className="px-4 py-4 w-40">Produto</th>
                                                <th className="px-4 py-4 w-64 border-l border-gray-200">Arquivo Mapeado</th>
                                                <th className="px-4 py-4 w-40 bg-indigo-50/50 border-l border-gray-200">
                                                    Peso (KG) <span className="text-red-500">*</span>
                                                </th>
                                                <th className="px-4 py-4 w-40 bg-indigo-50/50 border-l border-gray-200">
                                                    Área (m²) <span className="text-red-500">*</span>
                                                </th>
                                                <th className="px-4 py-4 border-l border-gray-200">Erro IA / Ops</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {results.map((r, idx) => (
                                                <tr key={idx} className={`${r.success ? 'hover:bg-gray-50' : 'bg-red-50/50'} transition-colors`}>
                                                    <td className="px-4 py-3 text-center">
                                                        {r.success ? (
                                                            <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                                                        ) : (
                                                            <XCircle className="h-5 w-5 text-red-500 mx-auto" title={r.error} />
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 font-mono font-bold text-gray-900">{r.codigo}</td>
                                                    <td className="px-4 py-3 border-l border-gray-100">
                                                        <div className="flex items-center gap-2 text-xs">
                                                            {r.documento_id ? (
                                                                <>
                                                                    <FileText className="h-4 w-4 text-red-500 shrink-0" />
                                                                    <span className="truncate text-gray-600 font-medium" title={r.url_arquivo}>
                                                                        {getFileName(r.url_arquivo)}
                                                                    </span>
                                                                </>
                                                            ) : (
                                                                <span className="text-gray-400 italic">Nenhum</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 bg-indigo-50/20 border-l border-gray-100">
                                                        <input 
                                                            type="number"
                                                            step="0.001"
                                                            value={r.data.peso_kg || ''}
                                                            onChange={(e) => handleResultChange(idx, 'peso_kg', e.target.value)}
                                                            placeholder={r.success && !r.data.peso_kg ? "Não achou" : "Insira"}
                                                            className={`w-full h-8 px-2 rounded border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm font-semibold
                                                                ${r.data.peso_kg ? 'border-gray-300 text-gray-900 bg-white' : 'border-red-200 bg-red-50/50 placeholder-red-300'}`}
                                                            disabled={status === 'saving' || status === 'finished'}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 bg-indigo-50/20 border-l border-gray-100">
                                                        <input 
                                                            type="number"
                                                            step="0.001"
                                                            value={r.data.area_pintura_m2 || ''}
                                                            onChange={(e) => handleResultChange(idx, 'area_pintura_m2', e.target.value)}
                                                            placeholder={r.success && !r.data.area_pintura_m2 ? "Não achou" : "Insira"}
                                                            className={`w-full h-8 px-2 rounded border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm font-semibold
                                                                ${r.data.area_pintura_m2 ? 'border-gray-300 text-gray-900 bg-white' : 'border-red-200 bg-red-50/50 placeholder-red-300'}`}
                                                            disabled={status === 'saving' || status === 'finished'}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 border-l border-gray-100 text-xs">
                                                        {!r.success && <span className="text-red-600 font-medium line-clamp-2" title={r.error}>{r.error}</span>}
                                                        {r.success && !r.data.peso_kg && !r.data.area_pintura_m2 && <span className="text-orange-600">A IA não encontrou dados</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-between items-center rounded-b-xl shrink-0">
                    <button
                        onClick={handleClose}
                        className="px-5 py-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 font-medium rounded-lg transition-colors border border-transparent"
                    >
                        {status === 'finished' ? 'Fechar Catálogo' : 'Cancelar Processo'}
                    </button>

                    {step === 1 && (
                        <button
                            onClick={handleStartProcessing}
                            disabled={selectedProducts.size === 0}
                            className={`flex items-center gap-2 px-6 py-2.5 text-white font-bold rounded-lg transition-all shadow-md
                                ${selectedProducts.size === 0 
                                    ? 'bg-indigo-300 cursor-not-allowed' 
                                    : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg hover:-translate-y-0.5'}`}
                        >
                            <Bot className="h-5 w-5" />
                            <span>Extrair de {selectedProducts.size} arquivos seleccionados</span>
                        </button>
                    )}

                    {step === 3 && status !== 'finished' && (
                        <button
                            onClick={handleFinalSave}
                            disabled={status === 'saving'}
                            className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
                        >
                            {status === 'saving' ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Gravando no Banco...
                                </>
                            ) : (
                                <>
                                    <Save className="h-5 w-5" />
                                    Confirmar e Gravar Resultados
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AIBatchExtractionModal;
