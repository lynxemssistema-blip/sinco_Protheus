import React, { useMemo } from 'react';
import { Layers, Users, ChevronRight, FileText } from 'lucide-react';

export default function SgqOrganogramTab({ data, onNodeClick }) {
    
    const tree = useMemo(() => {
        if (!data || data.length === 0) return {};
        const categories = {};
        data.forEach(proc => {
            const cat = proc.category || 'Outros';
            if(!categories[cat]) categories[cat] = [];
            categories[cat].push(proc);
        });
        return categories;
    }, [data]);

    return (
        <div className="p-8 overflow-y-auto h-full bg-slate-50 print:bg-white print:p-0 absolute inset-0">
             <div className="max-w-6xl mx-auto space-y-10 pb-20">
                  <div className="mb-10 p-6 bg-gradient-to-r from-slate-800 to-slate-700 rounded-3xl shadow-xl border border-slate-600 flex flex-col items-center justify-center text-center">
                       <h3 className="text-3xl font-black tracking-tight text-white mb-2">Sistema de Gestão da Qualidade Integrada</h3>
                       <p className="text-slate-300 font-medium max-w-2xl">Mapeamento em tempo real de todas as interfaces, rotinas e responsáveis do Lynx Anty PCP.</p>
                  </div>

                  {Object.entries(tree).map(([categoryName, processos]) => {
                      const color = processos[0]?.category_color || '#425750';
                      return (
                          <div key={categoryName} className="relative bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                               {/* Category Header */}
                               <div className="flex items-center gap-4 mb-8">
                                   <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20" style={{ backgroundColor: color }}>
                                        <Layers className="h-7 w-7" />
                                   </div>
                                   <div>
                                        <h4 className="text-2xl font-black text-slate-800 tracking-tight">{categoryName}</h4>
                                        <p className="text-sm font-medium text-slate-500">{processos.length} processos catalogados</p>
                                   </div>
                               </div>

                               {/* Processes Grid */}
                               <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                   {processos.map(proc => (
                                       <div 
                                          key={proc.id} 
                                          onClick={() => onNodeClick(proc.id)}
                                          className="group cursor-pointer bg-slate-50 border border-slate-200 rounded-2xl p-5 hover:bg-white hover:border-blue-300 hover:shadow-lg transition-all"
                                       >
                                                <div className="flex items-center justify-between mb-3 border-b border-slate-200/60 pb-3">
                                                    <h5 className="font-bold text-slate-700 text-lg flex items-center gap-2 group-hover:text-blue-600 transition-colors">
                                                        <FileText className="h-5 w-5 opacity-70" />
                                                        {proc.title || proc.route_path}
                                                    </h5>
                                                    <div className="bg-slate-200 group-hover:bg-blue-100 p-1.5 rounded-full transition-colors">
                                                        <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-blue-600" />
                                                    </div>
                                                </div>
                                                
                                                <p className="text-sm text-slate-500 line-clamp-2 mb-4 leading-relaxed h-10">
                                                    {proc.description || 'Nenhum POP definido para esta etapa.'}
                                                </p>

                                                <div className="flex flex-wrap gap-2">
                                                    {(!proc.responsables || proc.responsables.length === 0) ? (
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-orange-50 text-orange-600 border border-orange-200/50">
                                                            <Users className="h-3.5 w-3.5" /> Pendente de Responsável
                                                        </span>
                                                    ) : (
                                                        proc.responsables.map((r, i) => (
                                                            <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/50 shadow-sm">
                                                                <Users className="h-3.5 w-3.5" /> {r}
                                                            </span>
                                                        ))
                                                    )}
                                                </div>
                                       </div>
                                   ))}
                               </div>
                          </div>
                      );
                  })}
             </div>
        </div>
    );
}
