import re

with open('client/src/components/ProcessMappingForm.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update useState
code = code.replace(
    "supportActivities: ''",
    "supportActivities: '',\n        supportDocuments: []"
)

# 2. Update initialData load
code = code.replace(
    "mission: initialData.mission || '',",
    "mission: initialData.mission || '',\n                supportDocuments: initialData.supportDocuments || [],"
)

# 3. Add UI inside the Support section
old_ui = '''                            <textarea
                                name="supportActivities"
                                value={formData.supportActivities}
                                onChange={handleChange}
                                rows={3}
                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                placeholder="Ex: Preenchimento de relatório de produção, Limpeza da máquina, Solicitação de manutenção..."
                            />'''

new_ui = '''                            <textarea
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
                            )}'''

code = code.replace(old_ui, new_ui)

with open('client/src/components/ProcessMappingForm.jsx', 'w', encoding='utf-8') as f:
    f.write(code)

print('Support documents added')
