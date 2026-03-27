import React, { useState } from 'react';
import { Save, Search, FileText, Download, FileDigit, Settings, RefreshCw, Upload, FileSignature } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

export default function SINCOFormularioPrincipal() {
    // Parâmetros de URL, passados pelo Desktop Solid Edge
    const [searchParams] = useSearchParams();
    const arquivoCorrente = searchParams.get('arquivo') || 'Nenhum arquivo carregado';
    const tituloCorrente = searchParams.get('titulo') || '';
    const grupoCorrente = searchParams.get('grupo') || '';
    const unidadeCorrente = searchParams.get('unidade') || '';
    const tipoCorrente = searchParams.get('tipo') || '';
    const revCorrente = searchParams.get('rev') || '';

    const [loading, setLoading] = useState(false);

    return (
        <div className="space-y-6">
            {/* Cabeçalho */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                        SINCO - Solid Edge - Lynx
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                            Web Version (MetalFisa 5 UI)
                        </span>
                        <p className="text-slate-500 text-sm">
                            Arquivo Corrente: <strong className="text-slate-700">{arquivoCorrente}</strong>
                        </p>
                    </div>
                </div>
            </div>

            {/* Barra de Ferramentas (Top Buttons) */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2 flex flex-wrap gap-2 overflow-x-auto">
                <button className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm">
                    <Save className="h-4 w-4" />
                    Salvar - SINCO
                </button>
                <div className="w-px h-8 bg-slate-200 self-center mx-1"></div>
                <button className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-sm font-medium rounded-lg transition-colors">
                    <Search className="h-4 w-4 text-slate-500" />
                    Buscar Cod. - Protheus
                </button>
                <button className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-sm font-medium rounded-lg transition-colors">
                    <FileText className="h-4 w-4 text-emerald-500" />
                    Abrir DFT
                </button>
                <div className="w-px h-8 bg-slate-200 self-center mx-1"></div>
                <button className="flex items-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-sm font-medium rounded-lg transition-colors">
                    <FileDigit className="h-4 w-4" />
                    Gerar PDF
                </button>
                <button className="flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-sm font-medium rounded-lg transition-colors">
                    <Download className="h-4 w-4" />
                    Gerar dxf
                </button>
                <div className="w-px h-8 bg-slate-200 self-center mx-1"></div>
                <button className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-sm font-medium rounded-lg transition-colors">
                    <Upload className="h-4 w-4 text-blue-500" />
                    Ativar/Criar Propriedades
                </button>
                <button className="flex items-center gap-2 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-sm font-medium rounded-lg transition-colors">
                    <FileSignature className="h-4 w-4" />
                    Projeto Protheus
                </button>
                <div className="w-px h-8 bg-slate-200 self-center mx-1"></div>
                <button className="flex items-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-sm font-medium rounded-lg transition-colors">
                    <FileDigit className="h-4 w-4" />
                    Gerar PDF Lote
                </button>
                <div className="w-px h-8 bg-slate-200 self-center mx-1"></div>
                <button className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-sm font-medium rounded-lg transition-colors">
                    <RefreshCw className="h-4 w-4 text-slate-500" />
                    Atualizações de dados
                </button>
                <button className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-sm font-medium rounded-lg transition-colors">
                    <Settings className="h-4 w-4 text-slate-500" />
                    Configurações
                </button>
            </div>

            {/* Painel Principal de Dados */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
                
                {/* Linha 1: Filtros/Campos */}
                <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    <div className="col-span-1 border-r border-slate-100 pr-4">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Tipo</label>
                        <input type="text" defaultValue={tipoCorrente} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" />
                    </div>
                    <div className="col-span-1 border-r border-slate-100 pr-4">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Unidade</label>
                        <input type="text" defaultValue={unidadeCorrente} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" />
                    </div>
                    <div className="col-span-1 lg:col-span-2 border-r border-slate-100 pr-4">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Grupo</label>
                        <input type="text" defaultValue={grupoCorrente} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" />
                    </div>
                    <div className="col-span-1 lg:col-span-2">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Título</label>
                        <input type="text" defaultValue={tituloCorrente} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" placeholder="Ex: PORCA SEXT A6 INOX" />
                    </div>
                </div>

                {/* Linha 2 de Detalhes e Operação Protheus */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4 border-t border-slate-100">
                    
                    {/* Campos Diversos */}
                    <div className="lg:col-span-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Num. Documento</label>
                                <input type="text" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono text-slate-600" defaultValue="MTA-0350 PAR" readOnly />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Rev. Metalfisa</label>
                                <input type="text" defaultValue={revCorrente} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Comentários-Acabamento</label>
                            <input type="text" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" defaultValue="CINZA N6,5 TEXTURIZADO - 80 MICRAS" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Autor</label>
                                <input type="text" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" defaultValue="ADM" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Data</label>
                                <input type="text" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                            </div>
                        </div>
                    </div>

                    {/* Operação do Protheus / Processos */}
                    <div className="lg:col-span-4 border border-slate-200 rounded-lg overflow-hidden flex flex-col">
                        <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 font-semibold text-sm text-slate-700 flex justify-between items-center">
                            <span>Operação do Protheus</span>
                        </div>
                        <div className="flex-1 overflow-auto bg-white p-2 text-sm text-slate-500 flex items-center justify-center">
                            <span className="italic">Nenhuma operação carregada.</span>
                        </div>
                    </div>

                    {/* Gabaritos Cliente */}
                    <div className="lg:col-span-4 border border-slate-200 rounded-lg overflow-hidden flex flex-col">
                        <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 font-semibold text-sm text-slate-700 flex justify-between items-center">
                            <span>Gabaritos / Desenho do Cliente</span>
                        </div>
                        <div className="flex-1 p-0 overflow-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-white sticky top-0 border-b border-slate-100">
                                    <tr className="text-xs text-slate-500 uppercase tracking-wider">
                                        <th className="px-3 py-2">Gabarito</th>
                                        <th className="px-3 py-2">DescDetalha</th>
                                        <th className="px-3 py-2">Endereço</th>
                                        <th className="px-3 py-2">Descrição</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td colSpan="4" className="text-center py-8 text-slate-400 italic">Lista vazia</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* As listas de Materiais inferiores foram removidas a pedido do usuário, que irá recriá-las/alterá-las futuramente. */}

            </div>
        </div>
    );
}
