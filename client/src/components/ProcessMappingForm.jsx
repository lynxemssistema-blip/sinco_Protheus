import React, { useState } from 'react';
import { X, Save, HelpCircle, ArrowRight, User, Box, FileText, CheckSquare, Target } from 'lucide-react';
import './ProcessMappingForm.css'; // We'll create simple styles

const ProcessMappingForm = ({ onClose, onSave, initialData = null }) => {
    const [formData, setFormData] = useState({
        sector: '',
        leader: '',
        inputsList: [{ supplier: '', input: '' }],
        activity: '',
        outputsList: [{ output: '', customer: '' }],
        mission: '',
        supportActivities: ''
    });

    React.useEffect(() => {
        if (initialData) {
            // Migration logic for legacy data
            let newInputs = initialData.inputsList || [];
            if (newInputs.length === 0 && (initialData.supplier || initialData.inputs)) {
                newInputs.push({ supplier: initialData.supplier || '', input: initialData.inputs || '' });
            }
            if (newInputs.length === 0) newInputs.push({ supplier: '', input: '' });

            let newOutputs = initialData.outputsList || [];
            if (newOutputs.length === 0 && (initialData.outputs || initialData.customer)) {
                newOutputs.push({ output: initialData.outputs || '', customer: initialData.customer || '' });
            }
            if (newOutputs.length === 0) newOutputs.push({ output: '', customer: '' });

            setFormData(prev => ({
                ...prev,
                ...initialData,
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
            [listName]: [...prev[listName], listName === 'inputsList' ? { supplier: '', input: '' } : { output: '', customer: '' }]
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
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto animate-slideUp">
                {/* PRINT HEADER - METALFISA STANDARD */}
                <div className="hidden print:flex flex-col border-b border-black mb-6">
                    <div className="flex border-b border-black">
                        <div className="w-40 p-4 border-r border-black flex items-center justify-center font-bold text-2xl tracking-wider bg-gray-100">METALFISA</div>
                        <div className="flex-1 p-2 flex items-center justify-center font-bold text-xl uppercase tracking-wide">Mapeamento de Processo</div>
                        <div className="w-40 text-xs flex flex-col text-center">
                            <div className="border-b border-black p-2 flex-1 flex items-center justify-center font-mono">DATA: {new Date().toLocaleDateString()}</div>
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
                                        <div key={index} className="flex gap-2 items-start group">
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
                                        className="w-full p-2.5 border border-blue-200 rounded-md text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none print:border-none print:p-0"
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
                                        <div key={index} className="flex gap-2 items-start group">
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
                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                placeholder="Ex: Preenchimento de relatório de produção, Limpeza da máquina, Solicitação de manutenção..."
                            />
                        </div>
                    </section>

                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 flex items-start gap-3">
                        <Target className="h-5 w-5 text-yellow-600 mt-0.5" />
                        <div>
                            <h4 className="text-sm font-bold text-yellow-800">Lembre-se da Regra de Ouro:</h4>
                            <p className="text-sm text-yellow-700 italic">"O próximo setor é meu cliente! Se entrego com defeito, prejudico meu cliente."</p>
                        </div>
                    </div>

                </form>

                <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 flex justify-end gap-3 rounded-b-xl">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm flex items-center gap-2 transition-colors"
                    >
                        <Save className="h-4 w-4" />
                        {initialData ? 'Atualizar Mapeamento' : 'Salvar Mapeamento'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProcessMappingForm;
