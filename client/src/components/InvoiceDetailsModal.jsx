import React, { useEffect } from 'react';
import { X, FileText, Calendar, Truck, CreditCard, Scale, Package } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function InvoiceDetailsModal({ isOpen, onClose, invoice, item }) {
    const { hasPermission } = useAuth();
    const canViewValues = hasPermission('valores_financeiros', 'view');

    // Fechar ao pressionar ESC
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen || !invoice) return null;

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-100"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100 bg-gradient-to-r from-slate-900 to-slate-800 text-white">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-500/20 p-2.5 rounded-xl border border-blue-400/30">
                            <FileText className="h-6 w-6 text-blue-300" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold">Nota Fiscal: {invoice.nota}</h3>
                            <p className="text-sm text-slate-300 font-medium">
                                Série {invoice.serie} <span className="mx-2 opacity-30">|</span> Natureza: {invoice.natureza}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-full transition-all"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50/30">

                    {/* Top Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-gray-500 mb-1">
                                <Calendar className="h-4 w-4" />
                                <span className="text-[11px] font-bold uppercase tracking-wider">Emissão</span>
                            </div>
                            <span className="text-lg font-bold text-gray-800">{invoice.emissao}</span>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-gray-500 mb-1">
                                <Package className="h-4 w-4" />
                                <span className="text-[11px] font-bold uppercase tracking-wider">Quantidade</span>
                            </div>
                            <span className="text-lg font-bold text-gray-800">{invoice.qtd} <span className="text-sm text-gray-400 font-normal">{item?.unidade}</span></span>
                        </div>
                        {canViewValues && (
                            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-1 bg-green-50/30 border-green-100">
                                <div className="flex items-center gap-2 text-green-600 mb-1">
                                    <CreditCard className="h-4 w-4" />
                                    <span className="text-[11px] font-bold uppercase tracking-wider">Valor Total</span>
                                </div>
                                <span className="text-lg font-bold text-green-700">{formatCurrency(invoice.valor_total)}</span>
                            </div>
                        )}
                    </div>

                    {/* Section: Detalhes Financeiros */}
                    <div>
                        <h4 className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-4 px-1">
                            <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                            Valores e Impostos
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {canViewValues && (
                                <div className="bg-white border border-gray-200 p-4 rounded-xl">
                                    <span className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Valor Unitário</span>
                                    <span className="text-sm font-semibold text-gray-700">{formatCurrency(invoice.valor_unit)}</span>
                                </div>
                            )}
                            {canViewValues && (
                                <div className="bg-white border border-gray-200 p-4 rounded-xl">
                                    <span className="block text-[10px] uppercase font-bold text-gray-400 mb-1">ICMS</span>
                                    <span className="text-sm font-semibold text-gray-700">{formatCurrency(invoice.valor_icms)}</span>
                                </div>
                            )}
                            {canViewValues && (
                                <div className="bg-white border border-gray-200 p-4 rounded-xl">
                                    <span className="block text-[10px] uppercase font-bold text-gray-400 mb-1">IPI</span>
                                    <span className="text-sm font-semibold text-gray-700">{formatCurrency(invoice.valor_ipi)}</span>
                                </div>
                            )}
                            <div className="bg-white border border-gray-200 p-4 rounded-xl">
                                <span className="block text-[10px] uppercase font-bold text-gray-400 mb-1">CFOP</span>
                                <span className="text-sm font-bold text-blue-600">{invoice.cfop}</span>
                            </div>
                        </div>
                    </div>

                    {/* Section: Logística */}
                    <div>
                        <h4 className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-4 px-1">
                            <div className="w-1 h-4 bg-orange-500 rounded-full"></div>
                            Logística e Transporte
                        </h4>
                        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                                <div className="p-5 flex items-start gap-4">
                                    <div className="bg-slate-50 p-2 rounded-lg"><Scale className="h-5 w-5 text-slate-400" /></div>
                                    <div>
                                        <span className="block text-[10px] uppercase font-bold text-gray-400 mb-0.5">Peso Líquido</span>
                                        <span className="text-sm font-bold text-gray-800">{invoice.peso_liquido || '0.00'} KG</span>
                                    </div>
                                </div>
                                <div className="p-5 flex items-start gap-4">
                                    <div className="bg-slate-50 p-2 rounded-lg"><Scale className="h-5 w-5 text-slate-400" /></div>
                                    <div>
                                        <span className="block text-[10px] uppercase font-bold text-gray-400 mb-0.5">Peso Bruto</span>
                                        <span className="text-sm font-bold text-gray-800">{invoice.peso_bruto || '0.00'} KG</span>
                                    </div>
                                </div>
                                <div className="p-5 flex items-start gap-4">
                                    <div className="bg-slate-50 p-2 rounded-lg"><Truck className="h-5 w-5 text-slate-400" /></div>
                                    <div>
                                        <span className="block text-[10px] uppercase font-bold text-gray-400 mb-0.5">Transportadora</span>
                                        <span className="text-sm font-bold text-gray-800">{invoice.transporte || '-'}</span>
                                    </div>
                                </div>
                            </div>
                            {canViewValues && invoice.valor_frete > 0 && (
                                <div className="p-4 bg-slate-50/50 border-t border-gray-100 flex justify-between items-center">
                                    <span className="text-xs font-semibold text-gray-500 italic">Valor do Frete destacado nesta nota</span>
                                    <span className="text-sm font-bold text-gray-700">{formatCurrency(invoice.valor_frete)}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer Info */}
                    <div className="bg-slate-900 border border-slate-700 p-5 rounded-2xl flex items-center justify-between shadow-lg">
                        <div className="flex gap-4">
                            <div>
                                <span className="block text-[9px] uppercase font-bold text-slate-500 tracking-widest mb-1">Código do Produto</span>
                                <span className="text-xs font-mono font-bold text-blue-400">{item?.codigo}</span>
                            </div>
                            <div className="w-px h-8 bg-slate-700"></div>
                            <div>
                                <span className="block text-[9px] uppercase font-bold text-slate-500 tracking-widest mb-1">Produto</span>
                                <span className="text-xs font-bold text-slate-200 truncate max-w-[300px] block" title={item?.descricao}>{item?.descricao}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="block text-[9px] uppercase font-bold text-slate-500 tracking-widest mb-1">Pedido Venda</span>
                            <span className="text-xs font-mono font-bold text-slate-300">{item?.pedido}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
