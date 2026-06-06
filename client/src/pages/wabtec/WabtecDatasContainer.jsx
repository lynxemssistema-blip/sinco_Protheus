import React, { useState } from 'react';
import { Layers, FileSpreadsheet, Network } from 'lucide-react';
import WabtecDatasSolicitacaoPage from './WabtecDatasSolicitacaoPage';
import WabtecMapeamentoPage from './WabtecMapeamentoPage';

export default function WabtecDatasContainer() {
    const [activeTab, setActiveTab] = useState('importacao');

    return (
        <div className="p-4 md:p-6 max-w-screen-2xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Layers className="w-6 h-6 text-indigo-600" />
                        WabTec Forecast (Solicitações)
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Gerencie as planilhas importadas da WabTec e relacione os produtos com a base do Protheus.
                    </p>
                </div>
            </div>

            {/* Abas */}
            <div className="flex border-b border-slate-200">
                <button
                    className={`px-4 py-3 font-medium flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'importacao' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                    onClick={() => setActiveTab('importacao')}
                >
                    <FileSpreadsheet className="w-4 h-4" />
                    1. Importação e Base
                </button>
                <button
                    className={`px-4 py-3 font-medium flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'mapeamento' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                    onClick={() => setActiveTab('mapeamento')}
                >
                    <Network className="w-4 h-4" />
                    2. Mapeamento Protheus
                </button>
            </div>

            <div className="mt-4">
                {activeTab === 'importacao' && <WabtecDatasSolicitacaoPage isTab={true} />}
                {activeTab === 'mapeamento' && <WabtecMapeamentoPage isTab={true} />}
            </div>
        </div>
    );
}
