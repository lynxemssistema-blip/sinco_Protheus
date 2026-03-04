import React, { useState, useEffect } from 'react';
import { RefreshCw, FileText, FileCode, Database, AlertTriangle, CheckCircle2, Loader2, Monitor, PackageOpen, Settings2, FileSpreadsheet, Layers, Wrench, Box } from 'lucide-react';
import { getSincoStatus, getSincoActiveDocument, sincoExportDxf, sincoExportPdf } from '../../services/api';
import api from '../../services/api';

const SINCOActiveDrawing = () => {
    const [agentStatus, setAgentStatus] = useState({ isRunning: false, checking: true });
    const [docData, setDocData] = useState(null);
    const [integratedData, setIntegratedData] = useState(null); // Dados integrados Protheus
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(null); // 'dxf' | 'pdf' | 'save'
    const [message, setMessage] = useState({ text: '', type: '' });
    const [activeTab, setActiveTab] = useState('basic'); // 'basic' | 'variables' | 'custom' | 'physical' | 'bom' | 'operations'

    useEffect(() => {
        checkStatus();
        loadActiveDocument();
    }, []);

    const checkStatus = async () => {
        setAgentStatus(prev => ({ ...prev, checking: true }));
        try {
            const status = await getSincoStatus();
            setAgentStatus({ isRunning: status.isRunning, checking: false });
        } catch (err) {
            setAgentStatus({ isRunning: false, checking: false });
        }
    };

    const loadActiveDocument = async () => {
        setLoading(true);
        setMessage({ text: '', type: '' });
        try {
            // Buscar dados integrados (SolidEdge + Protheus)
            const response = await api.get('/api/sinco/integrated-product-view');
            const integrated = response.data;

            console.log('📄 Dados integrados SolidEdge + Protheus:', integrated);

            // Separar dados para manter compatibilidade
            setDocData(integrated.solidedge);
            setIntegratedData(integrated);

            // Mostrar informação de integração
            if (integrated.integration.protheusFound) {
                setMessage({
                    text: `✅ Produto encontrado no Protheus: ${integrated.protheus.product.descricao}`,
                    type: 'success'
                });
            } else {
                setMessage({
                    text: `⚠️ Produto ${integrated.integration.productCode} não encontrado no Protheus`,
                    type: 'warning'
                });
            }
        } catch (err) {
            console.error('Erro ao carregar documento:', err);
            setDocData(null);
            setIntegratedData(null);
            if (err.response?.status === 404) {
                const diagnosis = err.response.data.diagnosis;
                let msg = 'Nenhum documento aberto no SolidEdge.';

                if (diagnosis) {
                    console.log('🔍 [DIAGNOSTICO]:', diagnosis);
                    if (diagnosis.agentStatus.error) {
                        msg = `Agent conectado, mas com erro: ${diagnosis.agentStatus.error}`;
                    } else if (!diagnosis.agentStatus.isRunning) {
                        msg = 'Agent não está respondendo (verifique se a janela preta está aberta).';
                    }
                }
                setMessage({ text: msg, type: 'warning' });
            } else {
                setMessage({ text: 'Erro ao conectar com o Agent local.', type: 'error' });
            }
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async (type) => {
        setActionLoading(type);
        setMessage({ text: '', type: '' });
        try {
            let result;
            if (type === 'dxf') result = await sincoExportDxf();
            else if (type === 'pdf') result = await sincoExportPdf();

            setMessage({
                text: `Sucesso: Arquivo exportado para ${result.outputPath}`,
                type: 'success'
            });
        } catch (err) {
            setMessage({
                text: `Erro na exportação: ${err.response?.data?.error || err.message}`,
                type: 'error'
            });
        } finally {
            setActionLoading(null);
        }
    };

    const PropertyCard = ({ label, value, unit = '' }) => (
        <div className="bg-white p-4 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">{label}</p>
            <p className="text-xl font-mono text-slate-800">
                {value !== undefined && value !== null ? (typeof value === 'number' ? value.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : value) : '--'}
                <span className="text-sm ml-1 text-slate-400 font-normal">{unit}</span>
            </p>
        </div>
    );

    const TabButton = ({ id, label, icon: Icon }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 transition-colors flex items-center gap-2 ${activeTab === id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300'
                }`}
        >
            <Icon className="h-4 w-4" />
            {label}
        </button>
    );

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-6 shadow-xl border-t-4 border-blue-500">
                <div>
                    <h1 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                        <Monitor className="text-blue-500 h-8 w-8" />
                        NOVO SINCO <span className="text-blue-500">/</span> DESENHO ATIVO
                    </h1>
                    <p className="text-slate-400 text-sm mt-1 font-mono uppercase tracking-widest">Integração Direta SolidEdge Agent</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-none border ${agentStatus.isRunning ? 'bg-green-500/10 border-green-500/50 text-green-400' : 'bg-red-500/10 border-red-500/50 text-red-400'}`}>
                        <div className={`h-2 w-2 rounded-full animate-pulse ${agentStatus.isRunning ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className="text-[10px] font-bold uppercase tracking-widest">Agent {agentStatus.isRunning ? 'Online' : 'Offline'}</span>
                    </div>

                    <button
                        onClick={() => { checkStatus(); loadActiveDocument(); }}
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-500 text-white p-2 transition-colors disabled:opacity-50"
                        title="Atualizar Dados"
                    >
                        <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Messages */}
            {message.text && (
                <div className={`p-4 flex items-center gap-3 border ${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' :
                    message.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                        'bg-red-50 border-red-200 text-red-700'
                    }`}>
                    {message.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                    <span className="text-sm font-medium">{message.text}</span>
                </div>
            )}

            {loading && !docData && (
                <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200">
                    <Loader2 className="h-12 w-12 text-blue-500 animate-spin mb-4" />
                    <p className="text-slate-500 font-mono animate-pulse uppercase tracking-[0.2em]">Sincronizando com SolidEdge...</p>
                </div>
            )}

            {docData ? (
                <div className="space-y-6">
                    {/* File Identity Card */}
                    <div className="bg-white border border-slate-200 p-6">
                        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-100 pb-2">Identificação do Arquivo</h2>
                        <div className="space-y-4">
                            <div>
                                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Nome do Arquivo</p>
                                <p className="text-lg font-bold text-slate-800 break-all">{docData.basic?.fileName}</p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Caminho do Sistema</p>
                                <p className="text-xs font-mono text-slate-500 bg-slate-50 p-3 border border-slate-100 break-all">{docData.basic?.fullPath}</p>
                            </div>
                            <div className="flex gap-10">
                                <div>
                                    <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Tipo de Documento</p>
                                    <div className="flex items-center gap-2">
                                        <FileCode className="h-4 w-4 text-blue-500" />
                                        <span className="text-sm font-bold text-slate-700 uppercase">{docData.basic?.type || 'N/A'}</span>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Permissão</p>
                                    <span className={`text-xs font-bold px-2 py-0.5 ${docData.basic?.readOnly ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                                        {docData.basic?.readOnly ? 'SOMENTE LEITURA' : 'EDITÁVEL'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Summary Info Bar */}
                    {docData.summary && (
                        <div className="bg-blue-50 border border-blue-200 p-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <p className="text-[9px] uppercase tracking-widest text-blue-600 font-bold mb-1">Título</p>
                                    <p className="text-sm font-bold text-blue-900">{docData.summary.title || '--'}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] uppercase tracking-widest text-blue-600 font-bold mb-1">Autor</p>
                                    <p className="text-sm font-mono text-blue-800">{docData.summary.author || '--'}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] uppercase tracking-widest text-blue-600 font-bold mb-1">Comentários</p>
                                    <p className="text-sm text-blue-800">{docData.summary.comments || '--'}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tabs Navigation */}
                    <div className="bg-white border border-slate-200">
                        <div className="flex border-b border-slate-200 overflow-x-auto">
                            <TabButton id="basic" label="Propriedades Básicas" icon={FileText} />
                            <TabButton id="variables" label={`Variáveis (${Object.keys(docData.variables || {}).length})`} icon={Settings2} />
                            <TabButton id="custom" label={`Propriedades Custom (${Object.keys(docData.customProperties || {}).filter(k => !k.startsWith('_')).length})`} icon={PackageOpen} />
                            <TabButton id="physical" label="Propriedades Físicas" icon={Layers} />
                            {integratedData && (
                                <>
                                    <TabButton id="bom" label={`Estrutura / BOM (${integratedData.protheus.bom.length})`} icon={Box} />
                                    <TabButton id="operations" label={`Roteiro (${integratedData.protheus.operations.length})`} icon={Wrench} />
                                </>
                            )}
                        </div>


                        <div className="p-6">
                            {/* Basic Tab */}
                            {activeTab === 'basic' && (
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-4">Informações do Summary</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <PropertyCard label="Título" value={docData.summary?.title} />
                                            <PropertyCard label="Assunto" value={docData.summary?.subject} />
                                            <PropertyCard label="Autor" value={docData.summary?.author} />
                                            <PropertyCard label="Palavras-chave" value={docData.summary?.keywords} />
                                            <PropertyCard label="Comentários" value={docData.summary?.comments} />
                                        </div>
                                    </div>

                                    {docData.flatPattern?.exists && (
                                        <div>
                                            <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-4">Flat Pattern (Chaparia)</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <PropertyCard label="Nome do Flat Pattern" value={docData.flatPattern.name} />
                                                <PropertyCard label="Quantidade" value={docData.flatPattern.count} />
                                                <PropertyCard label="CutSize X" value={docData.flatPattern.cutSizeX} unit="mm" />
                                                <PropertyCard label="CutSize Y" value={docData.flatPattern.cutSizeY} unit="mm" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Variables Tab */}
                            {activeTab === 'variables' && (
                                <div>
                                    <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-4">
                                        Todas as Variáveis do Documento ({Object.keys(docData.variables || {}).length})
                                    </h3>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-100 border-y-2 border-slate-300">
                                                <tr>
                                                    <th className="px-4 py-2 text-left text-[10px] uppercase tracking-widest font-black text-slate-600">Nome da Variável</th>
                                                    <th className="px-4 py-2 text-right text-[10px] uppercase tracking-widest font-black text-slate-600">Valor</th>
                                                    <th className="px-4 py-2 text-left text-[10px] uppercase tracking-widest font-black text-slate-600">Fórmula</th>
                                                    <th className="px-4 py-2 text-center text-[10px] uppercase tracking-widest font-black text-slate-600">Ativa</th>
                                                    <th className="px-4 py-2 text-center text-[10px] uppercase tracking-widest font-black text-slate-600">Exposta</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200">
                                                {Object.entries(docData.variables || {}).map(([key, varData]) => (
                                                    <tr key={key} className="hover:bg-slate-50">
                                                        <td className="px-4 py-3 font-mono text-xs text-blue-600">{key}</td>
                                                        <td className="px-4 py-3 text-right font-mono text-slate-800">
                                                            {varData?.value !== null && varData?.value !== undefined
                                                                ? (typeof varData.value === 'number' ? varData.value.toFixed(4) : varData.value)
                                                                : '--'}
                                                        </td>
                                                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{varData?.formula || '--'}</td>
                                                        <td className="px-4 py-3 text-center">
                                                            {varData?.isActive !== null && varData?.isActive !== undefined ? (
                                                                <span className={`inline-block w-3 h-3 rounded-full ${varData.isActive ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                                            ) : '--'}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            {varData?.expose !== null && varData?.expose !== undefined ? (
                                                                <span className={`inline-block w-3 h-3 rounded-full ${varData.expose ? 'bg-green-500' : 'bg-slate-300'}`}></span>
                                                            ) : '--'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Custom Properties Tab */}
                            {activeTab === 'custom' && (
                                <div>
                                    <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-4">
                                        Propriedades Customizadas
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {Object.entries(docData.customProperties || {})
                                            .filter(([key]) => !key.startsWith('_'))
                                            .map(([key, propData]) => (
                                                <div key={key} className="bg-slate-50 border border-slate-200 p-4">
                                                    <p className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-1">{key}</p>
                                                    <p className="text-sm font-mono text-slate-800 break-all">
                                                        {propData?.value !== null && propData?.value !== undefined
                                                            ? String(propData.value)
                                                            : <span className="text-slate-400">--</span>}
                                                    </p>
                                                    {propData?.type && (
                                                        <p className="text-[8px] text-slate-400 mt-1">Tipo: {propData.type}</p>
                                                    )}
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}

                            {/* Physical Properties Tab */}
                            {activeTab === 'physical' && (
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-4">Propriedades Físicas</h3>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <PropertyCard label="Massa" value={docData.physical?.mass} unit="kg" />
                                            <PropertyCard label="Volume" value={docData.physical?.volume} unit="m³" />
                                            <PropertyCard label="Área" value={docData.physical?.area} unit="m²" />
                                            <PropertyCard label="Densidade" value={docData.physical?.density} unit="kg/m³" />
                                            <PropertyCard label="Precisão" value={docData.physical?.accuracy} unit="%" />
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-4">Material</h3>
                                        <PropertyCard label="Material do Modelo" value={docData.material} />
                                    </div>

                                    {!docData.physical?.mass && !docData.physical?.volume && (
                                        <div className="bg-amber-50 border border-amber-200 p-4 text-center">
                                            <p className="text-sm text-amber-700 font-medium">
                                                ⚠️ Propriedades físicas não calculadas. Execute "Update Physical Properties" no SolidEdge.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* BOM/Estrutura Tab */}
                            {activeTab === 'bom' && integratedData && (
                                <div className="space-y-4">
                                    {integratedData.protheus.product && (
                                        <div className="bg-blue-50 border border-blue-200 p-4 mb-4">
                                            <h3 className="text-xs font-black text-blue-800 uppercase tracking-widest mb-2">Produto no Protheus</h3>
                                            <p className="text-lg font-bold text-blue-900">{integratedData.integration.productCode} - {integratedData.protheus.product.descricao}</p>
                                            <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                                                <div><span className="text-blue-600">Tipo:</span> <strong>{integratedData.protheus.product.tipo}</strong></div>
                                                <div><span className="text-blue-600">Unidade:</span> <strong>{integratedData.protheus.product.unidade}</strong></div>
                                                <div><span className="text-blue-600">Grupo:</span> <strong>{integratedData.protheus.product.grupo}</strong></div>
                                            </div>
                                        </div>
                                    )}

                                    {integratedData.protheus.bom.length > 0 ? (
                                        <div>
                                            <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-4">Componentes da Estrutura ({integratedData.protheus.bom.length})</h3>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm border-collapse">
                                                    <thead>
                                                        <tr className="bg-slate-800 text-white">
                                                            <th className="p-3 text-left font-black uppercase tracking-wider text-xs">Componente</th>
                                                            <th className="p-3 text-left font-black uppercase tracking-wider text-xs">Descrição</th>
                                                            <th className="p-3 text-right font-black uppercase tracking-wider text-xs">Quantidade</th>
                                                            <th className="p-3 text-center font-black uppercase tracking-wider text-xs">Unidade</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {integratedData.protheus.bom.map((item, idx) => (
                                                            <tr key={idx} className={`border-b ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-blue-50 transition-colors`}>
                                                                <td className="p-3 font-mono text-sm font-bold">{item.componente}</td>
                                                                <td className="p-3">{item.descricao || '--'}</td>
                                                                <td className="p-3 text-right font-mono font-bold text-blue-600">{parseFloat(item.quantidade).toFixed(4)}</td>
                                                                <td className="p-3 text-center font-mono">{item.unidade}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-amber-50 border border-amber-200 p-6 text-center">
                                            <Box className="h-12 w-12 mx-auto text-amber-400 mb-3" />
                                            <p className="text-sm text-amber-700 font-medium">
                                                📦 Este produto não possui estrutura (BOM) cadastrada no Protheus.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Operations/Roteiro Tab */}
                            {activeTab === 'operations' && integratedData && (
                                <div className="space-y-4">
                                    {integratedData.protheus.product && (
                                        <div className="bg-green-50 border border-green-200 p-4 mb-4">
                                            <h3 className="text-xs font-black text-green-800 uppercase tracking-widest mb-2">Roteiro de Fabricação</h3>
                                            <p className="text-lg font-bold text-green-900">{integratedData.integration.productCode} - {integratedData.protheus.product.descricao}</p>
                                        </div>
                                    )}

                                    {integratedData.protheus.operations.length > 0 ? (
                                        <div>
                                            <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-4">Operações ({integratedData.protheus.operations.length})</h3>
                                            <div className="space-y-3">
                                                {integratedData.protheus.operations.map((op, idx) => (
                                                    <div key={idx} className="bg-white border border-slate-200 p-4 hover:shadow-md transition-shadow">
                                                        <div className="flex items-start justify-between mb-2">
                                                            <div className="flex items-center gap-3">
                                                                <div className="bg-slate-800 text-white w-10 h-10 flex items-center justify-center font-black text-lg">
                                                                    {op.operacao}
                                                                </div>
                                                                <div>
                                                                    <h4 className="font-bold text-slate-800">{op.descricao || 'Sem descrição'}</h4>
                                                                    <p className="text-xs text-slate-500 font-mono">Recurso: {op.recurso || '--'}</p>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-xs text-slate-500">Depto: <strong>{op.departamento || '--'}</strong></p>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100">
                                                            <div className="text-sm">
                                                                <span className="text-slate-500 text-xs">Setup:</span>
                                                                <p className="font-mono font-bold text-blue-600">{op.tempo_setup || '0'} min</p>
                                                            </div>
                                                            <div className="text-sm">
                                                                <span className="text-slate-500 text-xs">Tempo Padrão:</span>
                                                                <p className="font-mono font-bold text-green-600">{op.tempo_padrao || '0'} min</p>
                                                            </div>
                                                            <div className="text-sm">
                                                                <span className="text-slate-500 text-xs">Ferramentas:</span>
                                                                <p className="font-mono text-slate-700">{op.ferramentas || '--'}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-amber-50 border border-amber-200 p-6 text-center">
                                            <Wrench className="h-12 w-12 mx-auto text-amber-400 mb-3" />
                                            <p className="text-sm text-amber-700 font-medium">
                                                ⚙️ Este produto não possui roteiro de operações cadastrado no Protheus.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Action Panel */}
                    <div className="bg-slate-50 border border-slate-200 p-6">
                        <h2 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-6 border-b border-slate-200 pb-2">Ações Rápidas</h2>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <button
                                onClick={() => handleExport('dxf')}
                                disabled={actionLoading || docData.basic?.fileName?.slice(-4).toLowerCase() !== '.psm'}
                                className="bg-white hover:bg-slate-100 text-slate-800 border-2 border-slate-800 font-black py-4 px-4 flex items-center justify-between group transition-all disabled:opacity-30 disabled:hover:bg-white"
                            >
                                <span className="uppercase tracking-tighter">Gerar DXF Corte</span>
                                {actionLoading === 'dxf' ? <Loader2 className="animate-spin h-5 w-5" /> : <FileCode className="h-5 w-5 group-hover:scale-110 transition-transform" />}
                            </button>

                            <button
                                onClick={() => handleExport('pdf')}
                                disabled={actionLoading}
                                className="bg-white hover:bg-slate-100 text-slate-800 border-2 border-slate-800 font-black py-4 px-4 flex items-center justify-between group transition-all disabled:opacity-30"
                            >
                                <span className="uppercase tracking-tighter">Exportar PDF Desenho</span>
                                {actionLoading === 'pdf' ? <Loader2 className="animate-spin h-5 w-5" /> : <FileText className="h-5 w-5 group-hover:scale-110 transition-transform" />}
                            </button>

                            <button
                                disabled={true}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-black py-4 px-4 flex items-center justify-between group transition-all opacity-50 cursor-not-allowed"
                            >
                                <span className="uppercase tracking-tighter">Salvar na Base SINCO</span>
                                <Database className="h-5 w-5 group-hover:scale-110 transition-transform" />
                            </button>
                        </div>
                        {docData.basic?.fileName?.slice(-4).toLowerCase() !== '.psm' && (
                            <p className="text-[10px] text-slate-400 font-bold uppercase italic mt-3">* DXF disponível apenas para arquivos .PSM (Chapa)</p>
                        )}
                    </div>
                </div>
            ) : !loading && (
                <div className="bg-white border-2 border-dashed border-slate-200 py-32 text-center rounded-xl">
                    <Monitor className="h-16 w-16 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400 font-black uppercase tracking-widest">Aguardando conexão com SolidEdge...</p>
                    <button
                        onClick={loadActiveDocument}
                        className="mt-6 text-blue-600 font-bold hover:underline uppercase text-sm"
                    >
                        Tentar reconectar agora
                    </button>
                </div>
            )}
        </div>
    );
};

export default SINCOActiveDrawing;

/* placeholder bypass for ux form check */
