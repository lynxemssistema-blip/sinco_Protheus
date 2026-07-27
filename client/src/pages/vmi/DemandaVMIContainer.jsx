import React, { useState } from 'react';
import { Layers, FileSpreadsheet, Network, ShoppingCart } from 'lucide-react';
import DemandaVMIPage from './DemandaVMIPage';
import DemandaVMIMapeamentoPage from './DemandaVMIMapeamentoPage';
import VMIOcFornecedoresPage from './VMIOcFornecedoresPage';

export default function DemandaVMIContainer() {
    const [activeTab, setActiveTab] = useState('importacao');

    const tabs = [
        { id: 'importacao',    label: '1. Importação e Base',    icon: FileSpreadsheet },
        { id: 'mapeamento',    label: '2. Mapeamento Protheus',  icon: Network },
        { id: 'oc_fornecedor', label: "3. OC's Fornecedores",    icon: ShoppingCart },
    ];

    return (
        <div className="w-full">
            {/* Cabeçalho */}
            <div className="flex items-center justify-between mb-3">
                <div>
                    <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Layers className="w-5 h-5 text-cyan-600" />
                        VMI Forecast
                    </h1>
                    <p className="text-slate-400 text-xs mt-0.5">
                        Planilhas de clientes e OC's emitidas para fornecedores
                    </p>
                </div>
            </div>

            {/* Abas */}
            <div className="flex border-b border-slate-200 overflow-x-auto mb-4">
                {tabs.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        className={`px-4 py-2.5 font-medium flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap text-sm
                            ${activeTab === id
                                ? 'border-cyan-600 text-cyan-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                        onClick={() => setActiveTab(id)}
                    >
                        <Icon className="w-4 h-4" />
                        {label}
                    </button>
                ))}
            </div>

            {/* Conteúdo */}
            {activeTab === 'importacao'    && <DemandaVMIPage isTab={true} />}
            {activeTab === 'mapeamento'    && <DemandaVMIMapeamentoPage isTab={true} />}
            {activeTab === 'oc_fornecedor' && <VMIOcFornecedoresPage isTab={true} />}
        </div>
    );
}
