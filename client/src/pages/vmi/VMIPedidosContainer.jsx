import React, { useState } from 'react';
import { ListOrdered, FileSpreadsheet, Network } from 'lucide-react';
import VMIPedidosPage from './VMIPedidosPage';
import VMIPedidosMapeamentoPage from './VMIPedidosMapeamentoPage';

export default function VMIPedidosContainer() {
    const [activeTab, setActiveTab] = useState('importacao');

    return (
        <div className="w-full px-2 sm:px-4 py-2 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                    <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <ListOrdered className="w-5 h-5 text-indigo-600" />
                        VMI Pedido
                    </h1>
                    <p className="text-slate-500 text-xs mt-0.5">
                        Gerencie os pedidos de compra por data de entrega e relacione os produtos com o Protheus.
                    </p>
                </div>
            </div>

            {/* Abas Compactas */}
            <div className="flex border-b border-slate-200 gap-1 overflow-x-auto">
                <button
                    className={`px-3 py-2 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'importacao' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-md' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                    onClick={() => setActiveTab('importacao')}
                >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    1. Importação e Base
                </button>
                <button
                    className={`px-3 py-2 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'mapeamento' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-md' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                    onClick={() => setActiveTab('mapeamento')}
                >
                    <Network className="w-3.5 h-3.5" />
                    2. Mapeamento Protheus
                </button>
            </div>

            <div className="mt-2">
                {activeTab === 'importacao'  && <VMIPedidosPage isTab={true} />}
                {activeTab === 'mapeamento'  && <VMIPedidosMapeamentoPage isTab={true} />}
            </div>
        </div>
    );
}
