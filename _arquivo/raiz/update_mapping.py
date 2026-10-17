import re

with open('client/src/components/ProcessMappingForm.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Input list documents block
old_input_docs = '''                                                    <div className="mt-2 print:hidden">
                                                        <label className="text-[10px] font-semibold text-blue-600 uppercase">Documentos Associados</label>
                                                        <select
                                                            multiple
                                                            value={item.documents || []}
                                                            onChange={(e) => {
                                                                const selected = Array.from(e.target.selectedOptions, option => option.value);
                                                                handleListChange('inputsList', index, 'documents', selected);
                                                            }}
                                                            className="w-full p-1 border border-blue-200 rounded text-xs bg-blue-50 focus:ring-1 focus:ring-blue-500 h-16"
                                                        >
                                                            {sgqDocuments.map(doc => (
                                                                <option key={doc.id} value={doc.id}>{doc.code || 'DOC'} - {doc.title}</option>
                                                            ))}
                                                        </select>
                                                    </div>'''

new_input_docs = '''                                                    <div className="mt-2 print:hidden">
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
                                                    </div>'''
code = code.replace(old_input_docs, new_input_docs)

# Output list documents block
old_output_docs = '''                                                    <div className="mt-2 print:hidden">
                                                        <label className="text-[10px] font-semibold text-blue-600 uppercase">Documentos Associados</label>
                                                        <select
                                                            multiple
                                                            value={item.documents || []}
                                                            onChange={(e) => {
                                                                const selected = Array.from(e.target.selectedOptions, option => option.value);
                                                                handleListChange('outputsList', index, 'documents', selected);
                                                            }}
                                                            className="w-full p-1 border border-blue-200 rounded text-xs bg-blue-50 focus:ring-1 focus:ring-blue-500 h-16"
                                                        >
                                                            {sgqDocuments.map(doc => (
                                                                <option key={doc.id} value={doc.id}>{doc.code || 'DOC'} - {doc.title}</option>
                                                            ))}
                                                        </select>
                                                    </div>'''

new_output_docs = '''                                                    <div className="mt-2 print:hidden">
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
                                                            className="w-full p-1.5 border border-blue-200 rounded text-xs bg-white focus:ring-1 focus:ring-blue-500 outline-none text-slate-600"
                                                        >
                                                            <option value="">+ Associar novo documento...</option>
                                                            {sgqDocuments.filter(d => !(item.documents||[]).includes(String(d.id))).map(doc => (
                                                                <option key={doc.id} value={doc.id}>{doc.code || 'DOC'} - {doc.title}</option>
                                                            ))}
                                                        </select>
                                                    </div>'''
code = code.replace(old_output_docs, new_output_docs)

with open('client/src/components/ProcessMappingForm.jsx', 'w', encoding='utf-8') as f:
    f.write(code)

print('Process mapping multi-select updated successfully.')
