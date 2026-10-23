import React, { useState, useEffect } from 'react';
import { MessageSquare, RefreshCw, AlertTriangle, Inbox, CheckCircle, Clock, X, FileText } from 'lucide-react';
import api from '../services/api';
import * as XLSX from 'xlsx';

const PortalClienteSolicitacoes = ({ user, allOrderItems = [], filters, onOpenDrawing }) => {
    const [solicitacoes, setSolicitacoes] = useState([]);
    const [typeFilter, setTypeFilter] = useState('');
    const [groupByType, setGroupByType] = useState(false);

    const filteredSolicitacoes = React.useMemo(() => {
        if (!filters) return solicitacoes;
        
        return solicitacoes.filter(sol => {
            // 1. Cliente (cliente_nome)
            if (filters.cliente) {
                const q = filters.cliente.toLowerCase().trim();
                const name = (sol.cliente_nome || '').toLowerCase();
                if (!name.includes(q)) return false;
            }
            
            // 2. Pedido Lynx
            if (filters.pedido) {
                const q = filters.pedido.toLowerCase().trim();
                const ped = (sol.pedido_metalfisa || '').toLowerCase();
                if (!ped.includes(q)) return false;
            }
            
            // 3. Ordem de Compra / Pedido Cliente
            if (filters.pedcli) {
                const q = filters.pedcli.toLowerCase().trim();
                const pedCli = (sol.pedido_cliente || '').toLowerCase();
                if (!pedCli.includes(q)) return false;
            }
            
            // 4. Produto
            if (filters.produto) {
                const q = filters.produto.toLowerCase().trim();
                const prod = (sol.produto || '').toLowerCase();
                if (!prod.includes(q)) return false;
            }
            
            // 5. Ref Cliente
            if (filters.refCliente) {
                const q = filters.refCliente.toLowerCase().trim();
                const ref = (sol.ref_cliente || '').toLowerCase();
                if (!ref.includes(q)) return false;
            }
            
            // 6. Datas (criado_em)
            if (filters.dataInicial) {
                const start = new Date(filters.dataInicial);
                start.setHours(0,0,0,0);
                const solDate = new Date(sol.criado_em);
                if (solDate < start) return false;
            }
            
            if (filters.dataFinal) {
                const end = new Date(filters.dataFinal);
                end.setHours(23,59,59,999);
                const solDate = new Date(sol.criado_em);
                if (solDate > end) return false;
            }

            // 7. Tipo de Solicitação (Filtro local)
            if (typeFilter && sol.tipo_solicitacao !== typeFilter) {
                return false;
            }
            
            return true;
        });
    }, [solicitacoes, filters, typeFilter]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // States para modal de resposta (Administrador)
    const [replyModalOpen, setReplyModalOpen] = useState(false);
    const [selectedSol, setSelectedSol] = useState(null);
    const [replyText, setReplyText] = useState('');
    const [replyStatus, setReplyStatus] = useState('Atendida');
    const [replyLoading, setReplyLoading] = useState(false);

    const isInternal = user?.tipoExterno !== 'cliente' && !user?.idCliente;

    // Desmembrar solicitações gerais em uma linha por produto
    const flattenedSolicitacoes = React.useMemo(() => {
        const list = [];
        
        filteredSolicitacoes.forEach(sol => {
            if (sol.produto) {
                list.push({
                    ...sol,
                    realId: sol.id
                });
            } else {
                const orderItems = allOrderItems.filter(
                    item => String(item.pedido).trim() === String(sol.pedido_metalfisa).trim()
                );
                
                if (orderItems.length > 0) {
                    orderItems.forEach((item, index) => {
                        list.push({
                            ...sol,
                            id: `${sol.id}-item-${index}`,
                            realId: sol.id,
                            produto: item.produto,
                            ref_cliente: item.ref_cliente,
                            saldo_faturar: item.saldo_faturar !== undefined ? item.saldo_faturar : item.saldo_item,
                            tem_faturamento_aberto: sol.tem_faturamento_aberto // Mantém indicador se houver
                        });
                    });
                } else {
                    list.push({
                        ...sol,
                        realId: sol.id
                    });
                }
            }
        });
        
        return list;
    }, [filteredSolicitacoes, allOrderItems]);

    const fetchSolicitacoes = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get('/clients/solicitacoes');
            setSolicitacoes(res.data || []);
        } catch (err) {
            console.error('Erro ao buscar solicitações:', err);
            setError('Não foi possível carregar suas solicitações.');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenReply = (sol) => {
        setSelectedSol(sol);
        setReplyText(sol.resposta || '');
        setReplyStatus(sol.status || 'Atendida');
        setReplyModalOpen(true);
    };

    const handleSaveReply = async () => {
        setReplyLoading(true);
        try {
            const idToSave = selectedSol.realId || selectedSol.id;
            await api.put(`/clients/solicitacoes/${idToSave}`, {
                resposta: replyText,
                status: replyStatus
            });
            setReplyModalOpen(false);
            fetchSolicitacoes();
        } catch (err) {
            console.error('Erro ao salvar resposta:', err);
            alert('Erro ao salvar resposta. Tente novamente.');
        } finally {
            setReplyLoading(false);
        }
    };

    useEffect(() => {
        fetchSolicitacoes();
    }, []);

    const fmtDateBR = (d) => {
        if (!d) return '—';
        const parsed = new Date(d);
        if (!isNaN(parsed.getTime())) {
            return parsed.toLocaleString('pt-BR');
        }
        return String(d);
    };

    const getTipoBadge = (tipo) => {
        const t = String(tipo || '').trim();
        if (t === 'Atualização de Dados') {
            return (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    Atualização de Dados
                </span>
            );
        }
        if (t === 'Peças em Linha de Produção') {
            return (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    Linha de Produção
                </span>
            );
        }
        if (t === 'Peças Para Próxima Sequência de Montagem') {
            return (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                    Seq. Montagem
                </span>
            );
        }
        return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-50 text-slate-700 border border-slate-200">
                {tipo}
            </span>
        );
    };

    const exportToExcel = () => {
        try {
            const wb = XLSX.utils.book_new();
            const dateStr = new Date().toLocaleDateString('pt-BR');
            const fileDate = new Date().toISOString().slice(0,10);
            
            const headerRow = [
                'SOLICITAÇÃO', 'DATA', 'SOLICITANTE', 'TIPO', 'PEDIDO', 'ORDEM COMPRA',
                'PRODUTO', 'REF. CLIENTE', 'SALDO', 'STATUS FAT.', 'MENSAGEM', 'RESPOSTA', 'STATUS SOL.'
            ];

            const dataRows = flattenedSolicitacoes.map(sol => {
                const statusFat = sol.produto 
                    ? (sol.saldo_faturar <= 0 ? 'Faturado' : `Saldo: ${sol.saldo_faturar}`)
                    : '—';
                return [
                    `SOL-${String(sol.realId || sol.id).padStart(5, '0')}`,
                    fmtDateBR(sol.criado_em),
                    sol.criado_por || '—',
                    sol.tipo_solicitacao || '—',
                    sol.pedido_metalfisa || '—',
                    sol.pedido_cliente || '—',
                    sol.produto || '—',
                    sol.ref_cliente || '—',
                    sol.saldo_faturar !== null && sol.saldo_faturar !== undefined ? sol.saldo_faturar : '—',
                    statusFat,
                    sol.observacao || '—',
                    sol.resposta || '—',
                    sol.status || '—'
                ];
            });

            // Replicar filtros ativos na tela para o cabeçalho do relatório
            const activeFilters = [];
            if (filters?.cliente) activeFilters.push(`Cliente: ${filters.cliente}`);
            if (filters?.pedido) activeFilters.push(`Pedido: ${filters.pedido}`);
            if (filters?.pedcli) activeFilters.push(`OC: ${filters.pedcli}`);
            if (filters?.produto) activeFilters.push(`Produto: ${filters.produto}`);
            if (filters?.refCliente) activeFilters.push(`Ref: ${filters.refCliente}`);
            if (filters?.dataInicial) activeFilters.push(`Início: ${fmtDateBR(filters.dataInicial)}`);
            if (filters?.dataFinal) activeFilters.push(`Fim: ${fmtDateBR(filters.dataFinal)}`);
            if (typeFilter) activeFilters.push(`Tipo: ${typeFilter}`);

            const filterLabel = activeFilters.length > 0 ? activeFilters.join(' | ') : 'Sem Filtros Ativos';

            const metaHeader = [
                ['LYNX EMS SISTEMAS LTDA — SISTEMA DE GESTÃO INTEGRADO (PCP)'],
                ['RELATÓRIO: PORTAL DO CLIENTE — HISTÓRICO DE SOLICITAÇÕES'],
                [`Data de Emissão: ${dateStr}  |  Usuário: ${user?.nome || 'Portal Cliente'}  |  Filtros Aplicados: ${filterLabel}`],
                [], // Linha em branco
                headerRow,
                ...dataRows
            ];

            const ws = XLSX.utils.aoa_to_sheet(metaHeader);
            ws['!cols'] = [
                { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 25 }, { wch: 12 }, { wch: 15 },
                { wch: 18 }, { wch: 18 }, { wch: 10 }, { wch: 15 }, { wch: 35 }, { wch: 35 }, { wch: 15 }
            ];
            XLSX.utils.book_append_sheet(wb, ws, 'Solicitações');
            XLSX.writeFile(wb, `Lynx_Portal_Cliente_Solicitacoes_${fileDate}.xlsx`);
        } catch (err) {
            console.error('Erro ao exportar para Excel:', err);
            alert('Não foi possível gerar a planilha Excel.');
        }
    };

    const exportToPdf = async () => {
        try {
            const { default: jsPDFLib } = await import('jspdf');
            const jsPDF = jsPDFLib.jsPDF || jsPDFLib;
            const { default: autoTable } = await import('jspdf-autotable');
            const { getCompanyLogoBase64, getCompanyShortName } = await import('../services/companyBranding');
            const logo = getCompanyLogoBase64();
            const brandName = getCompanyShortName();

            const doc = new jsPDF('landscape', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            const ML = 10;
            const MR = 10;

            const drawHeader = (pageDoc, currentY) => {
                let hY = currentY || 5;
                const usableW = pageWidth - ML - MR;
                const hH = 15;

                pageDoc.setDrawColor(30, 58, 95);
                pageDoc.setLineWidth(0.3);
                pageDoc.rect(ML, hY, usableW, hH);

                const col1 = ML + 45;
                const col2 = ML + 200;

                pageDoc.setLineWidth(0.2);
                [col1, col2].forEach(x => pageDoc.line(x, hY, x, hY + hH));

                // Logo da Empresa Ativa
                try {
                    if (logo) {
                        pageDoc.addImage(logo, 'PNG', ML + 2, hY + 1, 38, 13);
                    } else {
                        pageDoc.setFontSize(13);
                        pageDoc.setFont('helvetica', 'bold');
                        pageDoc.setTextColor(30, 58, 95);
                        pageDoc.text(brandName, ML + 4, hY + 9);
                    }
                } catch(e) {
                    pageDoc.setFontSize(13);
                    pageDoc.setFont('helvetica', 'bold');
                    pageDoc.setTextColor(30, 58, 95);
                    pageDoc.text(brandName, ML + 4, hY + 9);
                }

                pageDoc.setTextColor(0, 0, 0);
                pageDoc.setFontSize(11);
                pageDoc.setFont('helvetica', 'bold');
                pageDoc.text('Portal do Cliente - Histórico de Solicitações', col1 + 5, hY + 9);

                pageDoc.setFontSize(7);
                pageDoc.setFont('helvetica', 'normal');
                pageDoc.text(`Data/Hora: ${new Date().toLocaleString('pt-BR')}`, col2 + 5, hY + 6);
                pageDoc.text(`Usuário: ${user?.nome || 'Portal Cliente'}`, col2 + 5, hY + 11);

                return hY + hH + 5;
            };

            const startY = drawHeader(doc, 5);

            // Replicar filtros ativos na tela para o cabeçalho do PDF
            const activeFilters = [];
            if (filters?.cliente) activeFilters.push(`Cliente: ${filters.cliente}`);
            if (filters?.pedido) activeFilters.push(`Pedido: ${filters.pedido}`);
            if (filters?.pedcli) activeFilters.push(`OC: ${filters.pedcli}`);
            if (filters?.produto) activeFilters.push(`Produto: ${filters.produto}`);
            if (filters?.refCliente) activeFilters.push(`Ref: ${filters.refCliente}`);
            if (filters?.dataInicial) activeFilters.push(`Início: ${fmtDateBR(filters.dataInicial)}`);
            if (filters?.dataFinal) activeFilters.push(`Fim: ${fmtDateBR(filters.dataFinal)}`);
            if (typeFilter) activeFilters.push(`Tipo: ${typeFilter}`);

            const filterLabel = activeFilters.length > 0 ? activeFilters.join(' | ') : 'Sem Filtros Ativos';

            doc.setFontSize(8);
            doc.setTextColor(80, 80, 80);
            doc.text(`Filtros Aplicados: ${filterLabel}`, ML, startY + 2);

            const tableHead = [[
                'Nº', 'Data', 'Solicitante', 'Tipo', 'Pedido', 'Ordem', 'Produto', 'Ref.', 'Saldo/Fat', 'Obs.', 'Resposta', 'Status'
            ]];

            const dataRows = flattenedSolicitacoes.map(sol => {
                const statusFat = sol.produto 
                    ? (sol.saldo_faturar <= 0 ? 'Faturado' : `Saldo: ${sol.saldo_faturar}`)
                    : '—';
                return [
                    `SOL-${String(sol.realId || sol.id).padStart(5, '0')}`,
                    fmtDateBR(sol.criado_em),
                    sol.criado_por || '—',
                    sol.tipo_solicitacao || '—',
                    sol.pedido_metalfisa || '—',
                    sol.pedido_cliente || '—',
                    sol.produto || '—',
                    sol.ref_cliente || '—',
                    statusFat,
                    sol.observacao || '—',
                    sol.resposta || '—',
                    sol.status || '—'
                ];
            });

            autoTable(doc, {
                startY: startY + 6,
                head: tableHead,
                body: dataRows,
                margin: { left: ML, right: MR, top: 25, bottom: 15 },
                styles: { fontSize: 7, cellPadding: 1.5, valign: 'middle' },
                headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontStyle: 'bold' },
                columnStyles: {
                    0: { cellWidth: 16 },
                    1: { cellWidth: 20 },
                    2: { cellWidth: 20 },
                    3: { cellWidth: 32 },
                    4: { cellWidth: 15 },
                    5: { cellWidth: 15 },
                    6: { cellWidth: 22 },
                    7: { cellWidth: 22 },
                    8: { cellWidth: 20 },
                    9: { cellWidth: 40 },
                    10: { cellWidth: 40 },
                    11: { cellWidth: 18 }
                },
                didDrawPage: (data) => {
                    if (data.pageNumber > 1) {
                        drawHeader(doc, 5);
                    }
                }
            });

            doc.save(`Lynx_Portal_Cliente_Solicitacoes_${new Date().toISOString().slice(0,10)}.pdf`);
        } catch (err) {
            console.error('Erro ao exportar para PDF:', err);
            alert('Não foi possível gerar o arquivo PDF.');
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50/50 relative">
            {/* Header / Toolbar */}
            <div className="px-4 py-2 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-purple-600" />
                    <h3 className="font-bold text-slate-800 text-sm">Minhas Solicitações e Histórico</h3>
                </div>
                <div className="flex items-center gap-2.5">
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-white text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                    >
                        <option value="">Filtrar Tipo: Todos</option>
                        <option value="Atualização de Dados">Atualização de Dados</option>
                        <option value="Peças em Linha de Produção">Peças em Linha de Produção</option>
                        <option value="Peças Para Próxima Sequência de Montagem">Peças Para Próxima Sequência de Montagem</option>
                    </select>

                    <button
                        onClick={() => setGroupByType(prev => !prev)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg shadow-2xs transition-all border cursor-pointer ${
                            groupByType
                                ? 'bg-[#1e3a5f] border-[#1e3a5f] text-white hover:bg-[#152943]'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        📂 {groupByType ? 'Desagrupar' : 'Agrupar por Tipo'}
                    </button>

                    <button
                        onClick={exportToExcel}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-white border border-slate-200 hover:bg-emerald-50 rounded-lg shadow-2xs transition-all cursor-pointer"
                        title="Exportar para Excel"
                    >
                        <FileText className="w-3.5 h-3.5 text-emerald-600" />
                        Excel
                    </button>

                    <button
                        onClick={exportToPdf}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-700 bg-white border border-slate-200 hover:bg-red-50 rounded-lg shadow-2xs transition-all cursor-pointer"
                        title="Exportar para PDF"
                    >
                        <FileText className="w-3.5 h-3.5 text-red-600" />
                        PDF
                    </button>

                    <button
                        onClick={fetchSolicitacoes}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        Atualizar
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4 sm:p-6">
                {loading && solicitacoes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 gap-3 text-slate-400">
                        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                        <p className="text-sm font-medium">Carregando histórico...</p>
                    </div>
                ) : error ? (
                    <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 flex flex-col items-center justify-center gap-2 h-40 shadow-sm">
                        <AlertTriangle className="w-8 h-8 text-red-500" />
                        <p className="font-semibold text-sm">{error}</p>
                        <button onClick={fetchSolicitacoes} className="text-xs underline font-medium hover:text-red-900 mt-2">Tentar Novamente</button>
                    </div>
                ) : filteredSolicitacoes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-400 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                        <Inbox className="w-10 h-10 opacity-40 text-purple-500" />
                        <div className="text-center">
                            <p className="text-sm font-bold text-slate-700">Nenhuma solicitação encontrada.</p>
                            <p className="text-xs text-slate-500 mt-1">Utilize o botão de ações nas tabelas de itens para fazer um novo pedido ou limpe os filtros aplicados.</p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        <table className="min-w-full text-sm border-collapse">
                            <thead className="bg-[#1e3a5f] text-white">
                                <tr>
                                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-left border-b border-slate-700">Nº Solicitação</th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-left border-b border-slate-700">Data</th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-left border-b border-slate-700">Solicitante</th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-left border-b border-slate-700">Tipo</th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-left border-b border-slate-700">Pedido</th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-left border-b border-slate-700">Ordem Compra</th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-left border-b border-slate-700">Produto</th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-left border-b border-slate-700">Ref. Cliente</th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-center border-b border-slate-700">Saldo / Fat.</th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-left border-b border-slate-700">Mensagem / Observação</th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-left border-b border-slate-700">Resposta / Retorno</th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-center border-b border-slate-700">Status</th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-center border-b border-slate-700">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(() => {
                                    const renderRow = (sol, isFirstRowOfGroup, rowSpan) => {
                                        const statusUpper = (sol.status || '').toUpperCase();

                                        const getStatusBadge = () => {
                                            if (statusUpper === 'PENDENTE') {
                                                return (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                                        <Clock className="w-3 h-3" /> Pendente
                                                    </span>
                                                );
                                            }
                                            if (statusUpper === 'EM ANÁLISE' || statusUpper === 'EM ANALISE') {
                                                return (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                                                        <Clock className="w-3 h-3 animate-pulse" /> Em Análise
                                                    </span>
                                                );
                                            }
                                            if (statusUpper === 'CONCLUIDO' || statusUpper === 'CONCLUÍDO' || statusUpper === 'ATENDIDA') {
                                                return (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                                        <CheckCircle className="w-3 h-3" /> {sol.status}
                                                    </span>
                                                );
                                            }
                                            if (statusUpper === 'CANCELADA' || statusUpper === 'CANCELADO') {
                                                return (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-800">
                                                        <AlertTriangle className="w-3 h-3" /> Cancelada
                                                    </span>
                                                );
                                            }
                                            return (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800">
                                                    {sol.status}
                                                </span>
                                            );
                                        };

                                        return (
                                            <tr key={sol.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors text-xs">
                                                {isFirstRowOfGroup && (
                                                    <td rowSpan={rowSpan} className="px-4 py-3 font-mono font-bold text-slate-700 whitespace-nowrap border-r border-slate-100 align-middle">
                                                        SOL-{String(sol.realId).padStart(5, '0')}
                                                    </td>
                                                )}
                                                {isFirstRowOfGroup && (
                                                    <td rowSpan={rowSpan} className="px-4 py-3 font-mono text-slate-600 whitespace-nowrap border-r border-slate-100 align-middle">
                                                        {fmtDateBR(sol.criado_em)}
                                                    </td>
                                                )}
                                                {isFirstRowOfGroup && (
                                                    <td rowSpan={rowSpan} className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap border-r border-slate-100 align-middle">
                                                        {sol.criado_por || '—'}
                                                    </td>
                                                )}
                                                {isFirstRowOfGroup && (
                                                    <td rowSpan={rowSpan} className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap border-r border-slate-100 align-middle">
                                                        {getTipoBadge(sol.tipo_solicitacao)}
                                                    </td>
                                                )}
                                                {isFirstRowOfGroup && (
                                                    <td rowSpan={rowSpan} className="px-4 py-3 font-mono font-bold text-slate-700 whitespace-nowrap border-r border-slate-100 align-middle">
                                                        {sol.pedido_metalfisa || '—'}
                                                    </td>
                                                )}
                                                {isFirstRowOfGroup && (
                                                    <td rowSpan={rowSpan} className="px-4 py-3 font-mono text-slate-600 whitespace-nowrap border-r border-slate-100 align-middle">
                                                        {sol.pedido_cliente || '—'}
                                                    </td>
                                                )}
                                                <td className="px-4 py-3 font-mono text-blue-700 font-semibold whitespace-nowrap align-middle">
                                                    {sol.produto ? (
                                                        <button
                                                            onClick={() => onOpenDrawing && onOpenDrawing(sol.desenho_url, sol.produto)}
                                                            className="inline-flex items-center gap-1.5 hover:text-blue-900 hover:underline cursor-pointer focus:outline-none text-left"
                                                            title="Abrir desenho PDF/Lynx"
                                                        >
                                                            <FileText className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                                                            <span>{sol.produto}</span>
                                                        </button>
                                                    ) : (
                                                        '—'
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 font-mono text-slate-600 whitespace-nowrap align-middle">
                                                    {sol.ref_cliente || '—'}
                                                </td>
                                                
                                                <td className="px-4 py-3 text-center whitespace-nowrap align-middle border-r border-slate-100">
                                                    <div className="flex flex-col gap-1 items-center justify-center">
                                                        {sol.saldo_faturar !== null && sol.saldo_faturar !== undefined && (
                                                            Number(sol.saldo_faturar) <= 0 ? (
                                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                    Faturado
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                                                    Saldo: {sol.saldo_faturar}
                                                                </span>
                                                            )
                                                        )}
                                                        
                                                        {sol.tem_faturamento_aberto && (
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-50 text-orange-700 border border-orange-200 animate-pulse">
                                                                Fat. Solicitado
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                {isFirstRowOfGroup && (
                                                    <td rowSpan={rowSpan} className="px-4 py-3 text-slate-700 max-w-xs border-r border-slate-100 align-middle font-medium">
                                                        <p className="line-clamp-3 whitespace-pre-line" title={sol.observacao}>{sol.observacao || '—'}</p>
                                                    </td>
                                                )}
                                                {isFirstRowOfGroup && (
                                                    <td rowSpan={rowSpan} className="px-4 py-3 text-slate-700 max-w-xs border-r border-slate-100 align-middle">
                                                        {sol.resposta ? (
                                                            <div>
                                                                <p className="font-semibold text-slate-800 whitespace-pre-line">{sol.resposta}</p>
                                                                {sol.respondido_por && (
                                                                    <span className="text-[10px] text-slate-400 block mt-1">
                                                                        Por: <strong>{sol.respondido_por}</strong> em {fmtDateBR(sol.respondido_em)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-400 italic">Sem resposta ainda</span>
                                                        )}
                                                    </td>
                                                )}
                                                {isFirstRowOfGroup && (
                                                    <td rowSpan={rowSpan} className="px-4 py-3 text-center whitespace-nowrap border-r border-slate-100 align-middle">
                                                        {getStatusBadge()}
                                                    </td>
                                                )}
                                                {isFirstRowOfGroup && (
                                                    <td rowSpan={rowSpan} className="px-4 py-3 text-center whitespace-nowrap align-middle">
                                                        {isInternal ? (
                                                            <button
                                                                onClick={() => handleOpenReply(sol)}
                                                                className="px-2.5 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
                                                            >
                                                                Responder
                                                            </button>
                                                        ) : (
                                                            <span className="text-slate-400">—</span>
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    };

                                    if (groupByType) {
                                        const groups = {};
                                        flattenedSolicitacoes.forEach(sol => {
                                            const t = sol.tipo_solicitacao || 'Outros';
                                            if (!groups[t]) groups[t] = [];
                                            groups[t].push(sol);
                                        });

                                        const renderedElements = [];
                                        const allTypes = Object.keys(groups);

                                        allTypes.forEach(tipoName => {
                                            const list = groups[tipoName];
                                            renderedElements.push(
                                                <tr key={`group-header-${tipoName}`} className="bg-slate-100/80 font-bold border-y border-slate-200">
                                                    <td colSpan="13" className="px-4 py-2.5 text-slate-700 text-xs text-left font-bold tracking-wide">
                                                        📂 {tipoName} ({list.length} {list.length === 1 ? 'solicitação' : 'solicitações'})
                                                    </td>
                                                </tr>
                                            );

                                            const renderedGroups = new Set();
                                            const rowSpanMap = {};
                                            list.forEach(sol => {
                                                const gid = sol.realId || sol.id;
                                                rowSpanMap[gid] = (rowSpanMap[gid] || 0) + 1;
                                            });

                                            list.forEach((sol) => {
                                                const groupId = sol.realId || sol.id;
                                                const isFirstRowOfGroup = !renderedGroups.has(groupId);
                                                if (isFirstRowOfGroup) {
                                                    renderedGroups.add(groupId);
                                                }
                                                const rowSpan = rowSpanMap[groupId] || 1;
                                                renderedElements.push(renderRow(sol, isFirstRowOfGroup, rowSpan));
                                            });
                                        });

                                        return renderedElements;
                                    } else {
                                        const renderedGroups = new Set();
                                        const rowSpanMap = {};
                                        flattenedSolicitacoes.forEach(sol => {
                                            const gid = sol.realId || sol.id;
                                            rowSpanMap[gid] = (rowSpanMap[gid] || 0) + 1;
                                        });

                                        return flattenedSolicitacoes.map((sol) => {
                                            const groupId = sol.realId || sol.id;
                                            const isFirstRowOfGroup = !renderedGroups.has(groupId);
                                            if (isFirstRowOfGroup) {
                                                renderedGroups.add(groupId);
                                            }
                                            const rowSpan = rowSpanMap[groupId] || 1;
                                            return renderRow(sol, isFirstRowOfGroup, rowSpan);
                                        });
                                    }
                                })()}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal de Resposta para Administrador / PCP (Interno) */}
            {replyModalOpen && selectedSol && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden max-h-[90vh] animate-fade-in-up">
                        <div className="bg-[#1e3a5f] px-5 py-3 flex items-center justify-between text-white">
                            <h3 className="font-bold text-sm">Responder Solicitação #{selectedSol.id}</h3>
                            <button onClick={() => setReplyModalOpen(false)} disabled={replyLoading} className="text-white/80 hover:text-white cursor-pointer">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4 overflow-y-auto text-xs">
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
                                <div><span className="text-slate-500 font-semibold">Cliente:</span> <strong className="text-slate-800">{selectedSol.cliente_nome}</strong></div>
                                <div><span className="text-slate-500 font-semibold">Tipo:</span> <strong className="text-slate-800">{selectedSol.tipo_solicitacao}</strong></div>
                                <div><span className="text-slate-500 font-semibold">Item:</span> <strong className="text-slate-800">{selectedSol.produto || selectedSol.pedido_metalfisa || '—'}</strong></div>
                                <div>
                                    <span className="text-slate-500 font-semibold">Mensagem / Observação:</span>
                                    <p className="text-slate-700 mt-1 italic whitespace-pre-line bg-white p-2 rounded border border-slate-100 max-h-32 overflow-y-auto">
                                        {selectedSol.observacao || '—'}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="block font-bold text-slate-700">Texto de Resposta / Retorno</label>
                                <textarea
                                    rows={4}
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    placeholder="Digite o retorno da solicitação para o cliente externo visualizar..."
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-medium text-slate-800"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="block font-bold text-slate-700">Status da Solicitação</label>
                                <select
                                    value={replyStatus}
                                    onChange={(e) => setReplyStatus(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-slate-700 bg-white"
                                >
                                    <option value="Pendente">Pendente</option>
                                    <option value="Em Análise">Em Análise</option>
                                    <option value="Concluído">Concluído</option>
                                    <option value="Atendida">Atendida</option>
                                    <option value="Cancelada">Cancelada</option>
                                </select>
                            </div>
                        </div>
                        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end gap-2.5">
                            <button
                                onClick={() => setReplyModalOpen(false)}
                                disabled={replyLoading}
                                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveReply}
                                disabled={replyLoading}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                                {replyLoading ? 'Gravando...' : 'Salvar Resposta'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PortalClienteSolicitacoes;
