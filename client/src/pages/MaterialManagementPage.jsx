import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import MaterialExplosionTab from '../components/materials/MaterialExplosionTab';
import SolicitacoesTab from '../components/materials/SolicitacoesTab';
import { Package, ClipboardList, PieChart, Search, X } from 'lucide-react';

const MaterialManagementPage = () => {
    const [activeTab, setActiveTab] = useState('explosion');
    const [filters, setFilters] = useState({
        pedido: '',
        produto: '',
        quantidade: '',
        cliente: ''
    });
    const [tempFilters, setTempFilters] = useState(filters);

    const handleSearch = () => {
        setFilters(tempFilters);
    };

    const clearFilters = () => {
        const cleared = { pedido: '', produto: '', quantidade: '', cliente: '' };
        setTempFilters(cleared);
        setFilters(cleared);
    };

    return (
        <div className="flex h-screen overflow-hidden bg-gray-50">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-auto p-6 space-y-6">

                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                                <Package className="h-8 w-8 text-indigo-600 mr-3" />
                                Gestão de Materiais e Necessidades
                            </h1>
                            <p className="text-gray-500 mt-1 ml-11">PCP / Controle de Almoxarifado</p>
                        </div>
                    </div>

                    {/* Global Filters */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Número do Pedido</label>
                                <input
                                    type="text"
                                    className="w-full border-gray-200 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="Ex: 123456"
                                    value={tempFilters.pedido}
                                    onChange={e => setTempFilters({ ...tempFilters, pedido: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Código do Produto</label>
                                <input
                                    type="text"
                                    className="w-full border-gray-200 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="Ex: PA001"
                                    value={tempFilters.produto}
                                    onChange={e => setTempFilters({ ...tempFilters, produto: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Quantidade</label>
                                <input
                                    type="number"
                                    className="w-full border-gray-200 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="Ex: 100"
                                    value={tempFilters.quantidade}
                                    onChange={e => setTempFilters({ ...tempFilters, quantidade: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleSearch}
                                    className="flex-1 bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center shadow-sm"
                                >
                                    <Search className="h-4 w-4 mr-2" />
                                    Buscar
                                </button>
                                <button
                                    onClick={clearFilters}
                                    className="bg-white border border-gray-200 text-gray-600 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-h-[500px]">
                        <div className="flex border-b border-gray-100 overflow-x-auto">
                            <button
                                onClick={() => setActiveTab('explosion')}
                                className={`flex items-center px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${activeTab === 'explosion'
                                    ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                    }`}
                            >
                                <Package className="h-4 w-4 mr-2" />
                                Explosão de Materiais
                            </button>
                            <button
                                onClick={() => setActiveTab('requests')}
                                className={`flex items-center px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${activeTab === 'requests'
                                    ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                    }`}
                            >
                                <ClipboardList className="h-4 w-4 mr-2" />
                                Solicitações Almox.
                            </button>
                            <button
                                onClick={() => setActiveTab('dashboard')}
                                className={`flex items-center px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${activeTab === 'dashboard'
                                    ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                    }`}
                            >
                                <PieChart className="h-4 w-4 mr-2" />
                                Dashboard Gerencial
                            </button>
                        </div>

                        <div className="p-6">
                            {activeTab === 'explosion' && <MaterialExplosionTab filters={filters} />}
                            {activeTab === 'requests' && <SolicitacoesTab />}
                            {activeTab === 'dashboard' && (
                                <div className="text-center py-12 text-gray-400">
                                    <PieChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p>Dashboard em desenvolvimento. Use a aba "Explosão" para ver os dados.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MaterialManagementPage;
