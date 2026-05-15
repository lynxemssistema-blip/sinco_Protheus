import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Save, Plus, Trash2, Users, FileText, Layers, ArrowUp, ArrowDown } from 'lucide-react';

export default function SgqProcessModal({ process, onClose, onSave }) {
    const [formData, setFormData] = useState({
        title: process.title || '',
        description: process.description || '',
        responsables: Array.isArray(process.responsables) ? [...process.responsables] : [],
    });
    const navigate = useNavigate();

    const handleResponsableChange = (index, val) => {
        const newArr = [...formData.responsables];
        newArr[index] = val;
        setFormData({ ...formData, responsables: newArr });
    };

    const moveResponsable = (index, direction) => {
        if (direction === -1 && index === 0) return;
        if (direction === 1 && index === formData.responsables.length - 1) return;
        const newArr = [...formData.responsables];
        const temp = newArr[index];
        newArr[index] = newArr[index + direction];
        newArr[index + direction] = temp;
        setFormData({ ...formData, responsables: newArr });
    };

    // steps e tips agora são editados no módulo Documentos SGQ

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4 print:hidden backdrop-blur-sm">
             <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
                  <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
                       <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <FileText className="h-5 w-5 text-blue-600" />
                            Procedimento de Qualidade
                       </h3>
                       <button onClick={onClose} className="p-2 text-slate-500 hover:bg-slate-200 rounded-full transition-colors">
                            <X className="h-5 w-5" />
                       </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                       <div className="bg-blue-50 text-blue-800 text-sm p-3 rounded-lg border border-blue-100 flex gap-2">
                           <span className="font-semibold">Rota Mapeada:</span> {process.route_path}
                       </div>

                       <div>
                           <label className="block text-sm font-semibold text-slate-700 mb-1">Título do Processo / Tela</label>
                           <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white" 
                               value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                       </div>
                       
                       <div>
                           <label className="block text-sm font-semibold text-slate-700 mb-1">Objetivo (Descrição)</label>
                           <textarea className="w-full border border-slate-300 rounded-lg p-2.5 h-20 focus:ring-2 focus:ring-blue-500 resize-none bg-white" 
                               value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                       </div>

                       <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                           <div className="flex items-center justify-between mb-3">
                               <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                   <Users className="h-4 w-4 text-emerald-600" /> 
                                   Responsáveis pela Operação (Atores)
                               </label>
                               <button onClick={() => setFormData({...formData, responsables: [...formData.responsables, '']})}
                                   className="text-xs font-semibold flex items-center gap-1 text-emerald-700 hover:bg-emerald-100 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg transition-colors">
                                   <Plus className="h-3 w-3" /> Adicionar
                               </button>
                           </div>
                           {formData.responsables.length === 0 && <p className="text-sm text-slate-400 italic mb-2">Nenhum responsável definido. Clique em Adicionar.</p>}
                           <div className="space-y-2">
                               {formData.responsables.map((resp, i) => (
                                   <div key={i} className="flex gap-2">
                                       <input autoFocus={i === formData.responsables.length -1} type="text" className="flex-1 border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-500" value={resp}
                                           onChange={(e) => handleResponsableChange(i, e.target.value)} placeholder="Ex: Analista de PCP, João..." />
                                       <div className="flex gap-1 self-center">
                                           <button onClick={() => moveResponsable(i, -1)} disabled={i === 0} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-transparent hover:border-blue-100 disabled:opacity-30 transition-colors"><ArrowUp className="h-4 w-4" /></button>
                                           <button onClick={() => moveResponsable(i, 1)} disabled={i === formData.responsables.length - 1} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-transparent hover:border-blue-100 disabled:opacity-30 transition-colors"><ArrowDown className="h-4 w-4" /></button>
                                           <button onClick={() => {
                                               const newArr = formData.responsables.filter((_, idx) => idx !== i);
                                               setFormData({...formData, responsables: newArr});
                                           }} className="p-1.5 text-red-400 hover:bg-red-50 hover:text-red-700 rounded-lg border border-transparent hover:border-red-100 transition-colors"><Trash2 className="h-4 w-4" /></button>
                                       </div>
                                   </div>
                               ))}
                           </div>
                       </div>

                       <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200">
                           <div className="flex items-center justify-between">
                               <label className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-indigo-600" />
                                    Conteúdo do Manual / POP
                               </label>
                           </div>
                           <p className="text-sm text-indigo-700 mt-2 mb-4 leading-relaxed">
                               Os passos e dicas de como operar esta tela agora são gerenciados como um <strong>Documento Oficial do SGQ</strong>. 
                               Isto permite o uso de imagens, formatação rica e auxílio da Inteligência Artificial.
                           </p>
                           <button 
                                onClick={(e) => {
                                    e.preventDefault();
                                    onClose();
                                    navigate('/sgq/documentos');
                                }}
                                className="w-full bg-white border border-indigo-200 text-indigo-700 py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-bold shadow-sm hover:bg-indigo-600 hover:text-white transition-colors"
                           >
                               <FileText className="h-4 w-4" />
                               Abrir Módulo de Documentos SGQ
                           </button>
                           {process.document_id && (
                               <p className="text-xs text-indigo-400 mt-3 text-center font-semibold">
                                   Documento Vinculado: ID {process.document_id}
                               </p>
                           )}
                       </div>
                  </div>

                  <div className="p-5 border-t border-slate-200 flex justify-end gap-3 bg-slate-50 rounded-b-2xl">
                       <button onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded-xl transition-colors">Cancelar</button>
                       <button onClick={() => onSave({...process, ...formData})} 
                           className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center gap-2 shadow-sm shadow-blue-600/20 transition-colors">
                           <Save className="h-4 w-4" /> Salvar Sincronização Global
                       </button>
                  </div>
             </div>
        </div>
    )
}
