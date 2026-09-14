import React from 'react';
import { Network } from 'lucide-react';

export default function WabtecMapeamentoPage({ isTab = false }) {
    return (
        <div className={isTab ? "space-y-3" : "w-full px-2 sm:px-4 py-2 space-y-3"}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {!isTab && (
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <Network className="w-7 h-7 text-indigo-600" />
                            Mapeamento Protheus (WabTec)
                        </h1>
                        <p className="text-slate-500 text-sm mt-1">Vincule os códigos de produto da WabTec com os códigos internos do Protheus.</p>
                    </div>
                )}
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm text-center text-slate-500 py-12">
                <Network className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-700 mb-2">Mapeamento em Desenvolvimento</h3>
                <p>Esta funcionalidade está sendo estruturada para ficar igual à aba de mapeamento do VMI.</p>
            </div>
        </div>
    );
}
