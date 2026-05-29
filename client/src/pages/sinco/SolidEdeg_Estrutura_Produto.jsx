import React, { useState, useEffect, useCallback } from 'react';
import { Layers, Search, RefreshCw, FileText, Download, Network, Package, ChevronRight, ChevronDown, Filter, Printer, Minus, FolderOpen, CheckCircle2, XCircle, AlertCircle, Loader2, Mail } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import api, { getSincoArvore } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import * as XLSX from 'xlsx';
import SincoEmailModal from '../../components/SincoEmailModal';

export default function SolidEdeg_Estrutura_Produto() {
    const [searchParams] = useSearchParams();
    const { user } = useAuth();

    const [arquivo, setArquivo] = useState(searchParams.get('arquivo') || 'Nenhum arquivo carregado');
    const [caminho, setCaminho] = useState(searchParams.get('caminho') || searchParams.get('arquivo') || 'Nenhum arquivo carregado');

    const [busca, setBusca] = useState('');
    const [arvore, setArvore] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [expandedRows, setExpandedRows] = useState({});
    
    const [validationStatus, setValidationStatus] = useState({});
    const [validating, setValidating] = useState(false);
    
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

    useEffect(() => {
        if (!arvore || arvore.length === 0) return;
        
        const fetchValidation = async () => {
            setValidating(true);
            try {
                const components = [...new Set(arvore.map(item => item.componente || item.codigo))].filter(Boolean);
                const res = await api.post('/sinco/validar-estruturas', { components });
                setValidationStatus(res.data || {});
            } catch (err) {
                console.error("Erro ao validar estruturas:", err);
            } finally {
                setValidating(false);
            }
        };

        fetchValidation();
    }, [arvore]);
    
    // Filtros visuais
    const [filters, setFilters] = useState({
        texto: '',
        tipo: ''
    });

    const carregarEstrutura = useCallback(async (codigo) => {
        if (!codigo || codigo === 'Nenhum arquivo carregado') {
            setArvore([]);
            setError(null);
            return;
        }

        const codigoSemExtensao = codigo.replace(/\.[^/.]+$/, '').trim().toUpperCase();

        setError(null);
        setLoading(true);
        try {
            const result = await getSincoArvore(codigoSemExtensao);
            
            // Mapeia os dados do ERP (Protheus) ou do payload padronizado
            const arvoreFormatada = Array.isArray(result) ? result.map(item => {
                let tipoStr = item.TipoArquivo || item['Tipo de Desenho'] || '';
                if (!tipoStr && item.B1_XCODDES) {
                    const parts = item.B1_XCODDES.split('.');
                    if (parts.length > 1) tipoStr = parts[parts.length - 1].toUpperCase();
                }

                return {
                    nivel: item.Nivel !== undefined ? item.Nivel : (item.NIVEL !== undefined ? item.NIVEL : 0),
                    componente: item.B1_COD || item.Arquivo || item.CaminhoCompleto || item.componente || '',
                    descricao: item.B1_DESC || item.Título || item.DescDetal || item.Assunto || item.descricao || '',
                    quantidade: item.QUANTIDADE !== undefined ? item.QUANTIDADE : (item.QtdeTotal !== undefined ? item.QtdeTotal : (item.Qtde || item.quantidade || 0)),
                    material: item.Material || item.material || '',
                    peso: item.B1_PESO !== undefined ? item.B1_PESO : (item.PesoTotal || item.Mass || item.peso || 0),
                    tipo: tipoStr || item.tipo || '',
                    um: item.B1_UM || item.Unidade || item.um || 'UN',
                    _raw: item
                };
            }) : [];
            
            setArvore(arvoreFormatada);
            
            // Expandir tudo por padrão
            const initialExpanded = {};
            if (Array.isArray(result)) {
                result.forEach(item => { 
                    if (item.componente) initialExpanded[item.componente] = true; 
                });
            }
            setExpandedRows(initialExpanded);

        } catch (err) {
            console.error("Erro ao carregar estrutura do Protheus:", err);
            setError(err.response?.data?.error || err.message || 'Erro desconhecido ao consultar a estrutura');
            setArvore([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const carregarEstruturaSolidEdge = useCallback(async (isAuto = false) => {
        setError(null);
        if (!isAuto) setLoading(true);
        try {
            const res = await api.get('/sinco/estrutura-completa');
            if (res.data) {
                let parsedData = [];
                if (Array.isArray(res.data)) {
                    parsedData = res.data;
                } else if (typeof res.data === 'string') {
                    try {
                        parsedData = JSON.parse(res.data);
                    } catch (e) {
                        console.error('Erro ao fazer parse dos dados do Solid Edge:', e);
                    }
                }

                if (parsedData.length > 0) {
                    // Mapear os dados recebidos do Solid Edge Desktop para o formato esperado pela tabela
                    const mapeado = parsedData.map(item => {
                        let tipoStr = item.TipoArquivo || item['Tipo de Desenho'] || '';
                        if (!tipoStr && item.B1_XCODDES) {
                            const parts = item.B1_XCODDES.split('.');
                            if (parts.length > 1) tipoStr = parts[parts.length - 1].toUpperCase();
                        }

                        let componenteBruto = item.B1_COD || item.Arquivo || item.CaminhoCompleto || '';
                        let componenteLimpo = componenteBruto;
                        if (componenteLimpo) {
                            componenteLimpo = String(componenteLimpo).trim();
                            const lastDot = componenteLimpo.lastIndexOf('.');
                            if (lastDot > 0) componenteLimpo = componenteLimpo.substring(0, lastDot);
                            componenteLimpo = componenteLimpo.toUpperCase();
                        }

                        return {
                            nivel: item.Nivel !== undefined ? item.Nivel : (item.NIVEL !== undefined ? item.NIVEL : 0),
                            componente: componenteLimpo,
                            descricao: item.B1_DESC || item.Título || item.DescDetal || item.Assunto || '',
                            quantidade: item.QUANTIDADE !== undefined ? item.QUANTIDADE : (item.QtdeTotal !== undefined ? item.QtdeTotal : (item.Qtde || 0)),
                            material: item.Material || '',
                            peso: item.B1_PESO !== undefined ? item.B1_PESO : (item.PesoTotal || item.Mass || 0),
                            tipo: tipoStr,
                            um: item.B1_UM || item.Unidade || 'UN',
                            _raw: item
                        };
                    });
                    
                    setArvore(mapeado);
                    setArquivo(mapeado.length > 0 ? mapeado[0].componente : 'BOM Solid Edge');
                    if (parsedData.length > 0 && parsedData[0].CaminhoCompleto) {
                        setCaminho(parsedData[0].CaminhoCompleto);
                    } else if (parsedData.length > 0 && parsedData[0].B1_XCODDES) {
                        setCaminho(parsedData[0].B1_XCODDES);
                    }
                    
                    const initialExpanded = {};
                    mapeado.forEach(i => { if (i.componente) initialExpanded[i.componente] = true; });
                    setExpandedRows(initialExpanded);
                } else {
                    setArvore([]);
                    if (!isAuto) setError("A BOM enviada pelo Solid Edge está vazia ou em formato inválido.");
                }
            } else {
                setArvore([]);
                if (!isAuto) setError("Nenhuma estrutura temporária encontrada na memória do servidor.");
            }
        } catch (err) {
            console.error("Erro ao carregar estrutura do Solid Edge:", err);
            if (!isAuto) setError(err.response?.data?.error || err.message || 'Erro ao buscar a estrutura do Solid Edge');
            setArvore([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Carrega na primeira abertura ou retorno à página
    useEffect(() => {
        const source = searchParams.get('source');
        const cod = searchParams.get('arquivo');
        
        if (cod) {
            setArquivo(cod);
            carregarEstrutura(cod);
        } else if (source === 'solidedge' || (!cod && !source)) {
            // Tenta resgatar a estrutura em memória caso o usuário navegue e volte
            carregarEstruturaSolidEdge(true);
        }
    }, [searchParams, carregarEstrutura, carregarEstruturaSolidEdge]);

    // Socket.io — recebe atualização em tempo real do Solid Edge Desktop
    useEffect(() => {
        let socket = null;
        import('socket.io-client').then(({ io }) => {
            const socketUrl = api.defaults.baseURL.replace(/\/api\/?$/, '');
            socket = io(socketUrl, { transports: ['websocket', 'polling'] });
            socket.on('connect', () => { socket.emit('join_sinco_formulario'); });
            
            socket.on('sinco:desenho_atualizado', (novos) => {
                if (novos.arquivo && novos.arquivo !== arquivo) {
                    setArquivo(novos.arquivo);
                    if (novos.caminho) setCaminho(novos.caminho);
                    carregarEstrutura(novos.arquivo);
                }
            });

            socket.on('sinco:bom_solidedge_atualizada', () => {
                const source = searchParams.get('source');
                if (source === 'solidedge') {
                    carregarEstruturaSolidEdge();
                }
            });
        });
        return () => { if (socket) socket.disconnect(); };
    }, [arquivo, carregarEstrutura, carregarEstruturaSolidEdge, searchParams]);

    const buscarManual = (codigo) => {
        if (!codigo) return;
        const codigoSemExtensao = codigo.replace(/\.[^/.]+$/, '').trim().toUpperCase();
        setArquivo(codigoSemExtensao);
        setCaminho('Busca via ERP');
        carregarEstrutura(codigoSemExtensao);
    };

    const toggleExpand = (codigo) => {
        setExpandedRows(prev => ({ ...prev, [codigo]: !prev[codigo] }));
    };

    // Filter logic
    const buildVisibleRows = () => {
        if (!arvore || arvore.length === 0) return [];
        
        let filtered = arvore;
        if (filters.texto) {
            filtered = arvore.filter(item => 
                (item.componente && item.componente.toLowerCase().includes(filters.texto.toLowerCase())) ||
                (item.descricao && item.descricao.toLowerCase().includes(filters.texto.toLowerCase()))
            );
        }

        // Em uma implementação real, tratar a lógica de parentesco (nível)
        return filtered.map((item, index) => ({
            item,
            idx: index,
            isExpanded: expandedRows[item.componente] || false
        }));
    };

    const handleExportExcel = () => {
        if (!arvore || arvore.length === 0) return;
        
        const exportData = arvore.map(item => ({
            'Nível': item.nivel || 0,
            'Componente': item.componente,
            'Descrição': item.descricao || '',
            'Quantidade': item.quantidade || 0,
            'Unidade': item.um || item.unidade || ''
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        ws['!cols'] = [{ wch: 10 }, { wch: 25 }, { wch: 50 }, { wch: 15 }, { wch: 10 }];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Estrutura BOM");
        XLSX.writeFile(wb, `Estrutura_BOM_${arquivo}.xlsx`);
    };

    const handleExportPdf = async () => {
        if (!arvore || arvore.length === 0) return;
        try {
            const { default: generateSincoStructurePdf } = await import('../../services/sincoStructurePdfGenerator');
            
            // Map the data to the format expected by the generator
            const structureObj = {
                rootCode: arquivo,
                tree: arvore.map(item => ({
                    nivel: item.nivel || 0,
                    CodMatFabricante: item.componente || item.codigo || 'S/COD',
                    DescResumo: item.descricao || '',
                    QtdeTotal: item.quantidade || 0,
                    Unidade: item.um || 'UN',
                    materiais: [],
                    processos: []
                })),
                protheusData: {}
            };
            
            await generateSincoStructurePdf(structureObj, user);
        } catch (error) {
            console.error('Erro ao gerar PDF:', error);
            alert('Erro ao gerar o PDF. Verifique o console para mais detalhes.');
        }
    };

    const rows = buildVisibleRows();
    const temArquivo = arquivo !== 'Nenhum arquivo carregado';

    return (
        <div className="flex flex-col h-full bg-slate-50 p-4 md:p-6 max-w-7xl mx-auto w-full space-y-4">
            
            {/* Header */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded-lg">
                        <Network className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-slate-900">SolidEdge Estrutura Produto</h1>
                        <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-1">
                            Arquivo: 
                            {temArquivo && caminho && caminho !== 'Nenhum arquivo carregado' ? (
                                <button
                                    title="Abrir arquivo original no Solid Edge"
                                    onClick={() => {
                                        fetch('http://localhost:8080/api/solidedge/open-file', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ caminho: caminho })
                                        }).catch(() => alert('Agente Solid Edge não encontrado.\\nInicie o INICIAR_AGENT.bat na sua máquina.'));
                                    }}
                                    className="font-mono text-blue-600 hover:text-blue-800 hover:underline cursor-pointer bg-transparent border-none p-0 text-sm flex items-center gap-1">
                                    <FolderOpen className="w-3 h-3" />
                                    {arquivo}
                                </button>
                            ) : (
                                <span className="font-mono text-blue-600">{arquivo}</span>
                            )}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => carregarEstrutura(arquivo)}
                        title="Recarregar Estrutura"
                        className="p-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors"
                    >
                        <RefreshCw className="h-4 w-4" />
                    </button>
                    <div className="relative">
                        <Search className="h-4 w-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && buscarManual(busca)}
                            placeholder="Consultar Produto Pai..."
                            className="w-64 pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                    </div>
                    <button
                        onClick={() => buscarManual(busca)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm border border-blue-700 text-sm font-medium rounded-md transition-colors whitespace-nowrap"
                    >
                        Buscar
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-start gap-2">
                    <span className="font-semibold whitespace-nowrap">Erro:</span>
                    <span className="font-mono break-all">{error}</span>
                </div>
            )}

            {!temArquivo && !loading && !error && (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400 bg-white border rounded-lg">
                    <Package className="w-16 h-16 mb-4 opacity-20" />
                    <p className="text-lg font-medium">Aguardando integração com Solid Edge ou busca manual.</p>
                </div>
            )}

            {loading && (
                <div className="flex items-center justify-center h-64 bg-white border rounded-lg">
                    <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                </div>
            )}

            {temArquivo && !loading && (
                <div className="flex flex-col gap-4 flex-1">
                    
                    {/* Toolbar Central */}
                    <div className="bg-white rounded-lg shadow-sm border p-3 flex flex-wrap gap-4 items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Filter className="w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Filtrar na estrutura..."
                                className="border border-slate-300 rounded text-sm px-3 py-1.5 w-64 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                value={filters.texto}
                                onChange={e => setFilters(prev => ({ ...prev, texto: e.target.value }))}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={handleExportExcel} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center shadow-sm" title="Exportar para Excel">
                                <Download className="w-4 h-4 mr-2" />
                                Excel
                            </button>
                            <button onClick={handleExportPdf} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center shadow-sm" title="Imprimir Relatório PDF">
                                <Printer className="w-4 h-4 mr-2" />
                                PDF
                            </button>
                            <button onClick={() => setIsEmailModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center shadow-sm" title="Enviar PDF por E-mail">
                                <Mail className="w-4 h-4 mr-2" />
                                E-mail
                            </button>
                        </div>
                    </div>

                    {/* Layout de Painéis (Dashboard) */}
                    <div className="grid grid-cols-1 gap-4 flex-1">
                        
                        {/* 1. ÁRVORE DO PRODUTO (MATERIAIS) */}
                        <div className="bg-white rounded-lg shadow-sm border border-green-200 overflow-hidden flex flex-col flex-1">
                            <div className="bg-green-50/50 border-b border-green-200 px-4 py-2 flex justify-between items-center">
                                <span className="font-bold text-green-700 text-[11px] tracking-wider uppercase">Árvore do Produto (Materiais)</span>
                                <button className="p-0.5 border border-green-200 rounded text-green-500 bg-white hover:bg-green-50"><Minus className="w-3 h-3" /></button>
                            </div>
                            <div className="overflow-auto flex-1">
                                <table className="w-full text-left border-collapse text-sm">
                                    <thead>
                                        <tr className="bg-white text-slate-500 text-[10px] uppercase font-bold tracking-wider border-b sticky top-0 z-10">
                                            <th className="px-3 py-2 w-12 text-center">Nív.</th>
                                            <th className="px-3 py-2 min-w-[120px]">Código</th>
                                            <th className="px-3 py-2 min-w-[200px]">Descrição</th>
                                            <th className="px-3 py-2 w-16 text-right">Qtde</th>
                                            <th className="px-3 py-2 w-12 text-center">UN</th>
                                            <th className="px-3 py-2 w-20 text-center" title="Materiais (SG1)">Mat. (BOM)</th>
                                            <th className="px-3 py-2 w-20 text-center" title="Produto (SZ1)">Prod. (SZ1)</th>
                                            <th className="px-3 py-2 w-20 text-center" title="Operações (SG2)">Roteiro</th>
                                            <th className="px-3 py-2 w-20 text-center" title="Restrições (SZ0)">Restri.</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.length === 0 ? (
                                            <tr>
                                                <td colSpan={9} className="text-center py-12 text-[11px] italic text-slate-400">
                                                    Nenhum material carregado para a estrutura
                                                </td>
                                            </tr>
                                        ) : (
                                            rows.map(({ item, idx }) => {
                                                const nivel = item.nivel || 0;
                                                const indentPx = nivel * 12;
                                                
                                                const vStatus = validationStatus[item.componente || item.codigo];
                                                const renderIcon = (statusKey) => {
                                                    if (validating) return <Loader2 className="w-4 h-4 animate-spin text-slate-300 mx-auto" />;
                                                    if (!vStatus) return <AlertCircle className="w-4 h-4 text-slate-300 mx-auto" />;
                                                    return vStatus[statusKey] 
                                                        ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> 
                                                        : <XCircle className="w-4 h-4 text-red-500 mx-auto" />;
                                                };

                                                return (
                                                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                                                        <td className="px-3 py-1.5 text-center">
                                                            <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${nivel === 0 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                                                {nivel}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-1.5">
                                                            <div className="flex items-start gap-1" style={{ paddingLeft: `${indentPx}px` }}>
                                                                {nivel > 0 && <span className="text-slate-300 font-mono text-[10px] mt-0.5 shrink-0 select-none">└─</span>}
                                                                <span className="font-mono font-bold text-[11px] text-slate-700">{item.componente || item.codigo || '—'}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-1.5 text-slate-600 text-[11px] leading-tight truncate max-w-[200px]" title={item.descricao}>
                                                            {item.descricao || '—'}
                                                        </td>
                                                        <td className="px-3 py-1.5 text-right font-mono text-[11px] font-bold text-slate-700">
                                                            {parseFloat(item.quantidade || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 })}
                                                        </td>
                                                        <td className="px-3 py-1.5 text-center text-slate-500 text-[10px] font-semibold">
                                                            {item.um || 'UN'}
                                                        </td>
                                                        <td className="px-3 py-1.5">{renderIcon('materiais')}</td>
                                                        <td className="px-3 py-1.5">{renderIcon('sz1')}</td>
                                                        <td className="px-3 py-1.5">{renderIcon('roteiro')}</td>
                                                        <td className="px-3 py-1.5">{renderIcon('sz0')}</td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal de E-mail */}
            <SincoEmailModal 
                isOpen={isEmailModalOpen} 
                onClose={() => setIsEmailModalOpen(false)} 
                arvore={arvore} 
                arquivo={arquivo} 
            />
        </div>
    );
}
