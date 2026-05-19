import React, { useState } from 'react';
import { Layers, FileSpreadsheet, Network, ListTree } from 'lucide-react';
import WabtecEstruturaImportacaoPage from './WabtecEstruturaImportacaoPage';
import WabtecEstruturaMapeamentoPage from './WabtecEstruturaMapeamentoPage';
import WabtecBOMPage from './WabtecBOMPage';

export default function WabtecEstruturaContainer() {
    const [activeTab, setActiveTab] = useState('importacao');
    const [selectedLote, setSelectedLote] = useState(null);

    return (
        <div className="p-4 md:p-6 max-w-screen-2xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Layers className="w-6 h-6 text-indigo-600" />
                        Estrutura WabTec
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Importe as planilhas de estrutura do cliente e cruze com a base do Protheus através das abas abaixo.
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
                <button
                    className={`px-4 py-3 font-medium flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'bom' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                    onClick={() => setActiveTab('bom')}
                >
                    <ListTree className="w-4 h-4" />
                    3. Lista de Materiais (BOM)
                </button>
            </div>

            {/* Conteúdo Renderizado */}
            <div className="mt-4">
                {activeTab === 'importacao' && <WabtecEstruturaImportacaoPage selectedLote={selectedLote} setSelectedLote={setSelectedLote} />}
                {activeTab === 'mapeamento' && <WabtecEstruturaMapeamentoPage selectedLote={selectedLote} />}
                {activeTab === 'bom' && <WabtecBOMPage selectedLote={selectedLote} />}
            </div>
        </div>
    );
}
