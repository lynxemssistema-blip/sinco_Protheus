import React, { useState, useEffect } from 'react';
import { Package, Search, File, FileText } from 'lucide-react';
import { getSincoOsItems } from '../../services/api';

const resolvePdfPath = (filePath) => {
    if (!filePath) return null;
    const replaced = filePath.replace(/\.[^./\\]+$/, '.pdf');
    return replaced === filePath ? `${filePath}.pdf` : replaced;
};

const openDoc = (filePath) => {
    if (!filePath) return;
    window.open(`/api/docs/view?path=${encodeURIComponent(filePath)}`, '_blank', 'noopener,noreferrer');
};

const ServiceOrderItems = ({ osId }) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        const fetchItems = async () => {
            if (!osId) return;

            try {
                setLoading(true);
                const data = await getSincoOsItems(osId);
                console.log('Items received:', data);
                setItems(data);
            } catch (error) {
                console.error('Failed to fetch OS items', error);
            } finally {
                setLoading(false);
            }
        };

        fetchItems();
    }, [osId]);

    const filteredItems = items.filter(item =>
        (item.CodMatFabricante || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        (item.DescResumo || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        (item.txtTipoDesenho || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    );

    if (loading) return <div className="p-4 text-center text-gray-500">Carregando itens...</div>;

    if (items.length === 0) return <div className="p-4 text-center text-gray-500">Nenhum item encontrado para esta OS.</div>;

    return (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mt-2">
            <div className="flex justify-between items-center mb-4">
                <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Itens da Ordem de Serviço
                </h4>
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Filtrar itens..."
                        className="pl-9 pr-4 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 bg-white shadow-sm rounded-md">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nível</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produto</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Observação</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qtde Unit.</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qtde Total</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unidade</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dimensões (Esp x Lar x Alt)</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Peso Unit.</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Peso Total</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">PDF</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Área Pint. Unit.</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Área Pint. Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {filteredItems.map((item, index) => {
                            const nivel = item.Nivel || 0;
                            const indentPx = nivel * 20;
                            const desenhoPath = item.EnderecoArquivo || null;
                            const pdfPath = resolvePdfPath(desenhoPath);

                            return (
                                <tr key={item.IdOrdemServicoItem || index} className="hover:bg-gray-50">
                                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">
                                        {item.IdOrdemServicoItem}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-xs text-center">
                                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${nivel === 0 ? 'bg-blue-100 text-blue-700' :
                                            nivel === 1 ? 'bg-green-100 text-green-700' :
                                                nivel === 2 ? 'bg-yellow-100 text-yellow-700' :
                                                    'bg-gray-100 text-gray-700'
                                            }`}>
                                            {nivel}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-xs font-medium text-gray-900">
                                        <div style={{ paddingLeft: `${indentPx}px` }} className="flex items-center gap-1">
                                            {nivel > 0 && (
                                                <span className="text-gray-400">└─</span>
                                            )}
                                            <div>
                                                {item.CodMatFabricante || '-'}
                                                <div className="text-[10px] text-gray-400">
                                                    {item.txtTipoDesenho}
                                                </div>
                                                {(item.Projeto || item.Tag) && (
                                                    <div className="flex items-center gap-1 mt-0.5">
                                                        {item.Projeto && (
                                                            <span className="px-1 py-0.5 bg-blue-50 text-blue-600 rounded-[3px] text-[9px] font-bold border border-blue-100 uppercase">
                                                                P: {item.Projeto}
                                                            </span>
                                                        )}
                                                        {item.Tag && (
                                                            <span className="px-1 py-0.5 bg-amber-50 text-amber-600 rounded-[3px] text-[9px] font-bold border border-amber-100 uppercase">
                                                                T: {item.Tag}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 text-xs text-gray-500 max-w-xs" title={item.DescResumo}>
                                        {item.DescResumo || '-'}
                                        {item.Acabamento && (
                                            <div className="text-xs text-blue-600 font-medium mt-1">
                                                {item.Acabamento}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-gray-500 max-w-xs truncate" title={item.C2_OBS}>
                                        {item.C2_OBS || '-'}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">
                                        {item.qtde || 0}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900 font-bold">
                                        {item.QtdeTotal || 0}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">
                                        {item.Unidade || '-'}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">
                                        {item.Espessura || 0} x {item.Largura || 0} x {item.Altura || 0}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">
                                        {item.PesoUnitario ? parseFloat(item.PesoUnitario).toFixed(2) : '0.00'}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-xs font-semibold text-gray-900">
                                        {item.Peso ? parseFloat(item.Peso).toFixed(2) : '0.00'}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        {pdfPath ? (
                                            <button onClick={() => openDoc(pdfPath)} className="p-1 rounded hover:bg-red-50 transition-colors mx-auto block">
                                                <FileText className="h-4 w-4 text-red-500" />
                                            </button>
                                        ) : (
                                            <FileText className="h-4 w-4 text-gray-200 mx-auto" title="Sem PDF" />
                                        )}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">
                                        {item.AreaPinturaUnitario ? parseFloat(item.AreaPinturaUnitario).toFixed(2) : '0.00'}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-xs font-semibold text-gray-900">
                                        {item.AreaPintura ? parseFloat(item.AreaPintura).toFixed(2) : '0.00'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <div className="mt-2 text-xs text-gray-500 text-right">
                Total de itens: {items.length} (Exibindo {filteredItems.length})
            </div>
        </div>
    );
};

export default ServiceOrderItems;
