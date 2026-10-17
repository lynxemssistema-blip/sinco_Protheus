import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import api, { getFileUrl, getProductDocuments } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useHelp } from '../contexts/HelpContext';
import {
    MonitorSmartphone, Search, RefreshCw, AlertTriangle,
    Truck, FileText, ChevronDown, ChevronUp, ChevronRight, BarChart2,
    Calendar, Layers, Package, Inbox, CheckCircle, Clock,
    Factory, Filter, X, SlidersHorizontal, Hash, Loader2, ExternalLink,
    HelpCircle, BookOpen, Info, FileDown, Globe, ShieldCheck, Sparkles, Zap,
    Smartphone, Laptop, Grid, List, MessageSquare
} from 'lucide-react';
import PortalClienteSolicitacoes from '../components/PortalClienteSolicitacoes';
import PortalClienteTabletView from '../components/PortalClienteTabletView';

// ─── helpers ────────────────────────────────────────────────────────────────
const fmtQtd = (n) =>
    Number(n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const STATUS_CONFIG = {
    ENTREGUE:           { label: 'Entregue',           color: 'text-emerald-700', bg: 'bg-emerald-100', bar: 'bg-emerald-500' },
    PRODUCAO_CONCLUIDA: { label: 'Pronto p/ Embarque', color: 'text-teal-700',   bg: 'bg-teal-100',    bar: 'bg-teal-500'   },
    EM_PRODUCAO:        { label: 'Em Produção',         color: 'text-blue-700',   bg: 'bg-blue-100',    bar: 'bg-blue-500'   },
    OP_ABERTA:          { label: 'OP Aberta',           color: 'text-sky-700',    bg: 'bg-sky-100',     bar: 'bg-sky-400'    },
    AGUARDANDO_OP:      { label: 'Em Planejamento',     color: 'text-amber-700',  bg: 'bg-amber-100',   bar: 'bg-amber-400'  },
    AGUARDANDO:         { label: 'Aguardando',          color: 'text-slate-600',  bg: 'bg-slate-100',   bar: 'bg-slate-300'  },
};

// ─── Status badge ────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
    const s = STATUS_CONFIG[status] || STATUS_CONFIG.AGUARDANDO;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${s.bg} ${s.color}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
            {s.label}
        </span>
    );
};

// ─── OP Badge (igual à Visão Geral) ─────────────────────────────────────────
const OpBadge = ({ opNum, opTipo }) => {
    if (!opNum) return <span className="text-gray-400 text-xs">-</span>;
    return (
        <div className="flex items-center justify-center gap-1">
            <span className={`px-1.5 py-0.5 rounded text-xs font-mono ${opTipo === 'F' ? 'bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
                {opNum}
            </span>
            {opTipo === 'F' && <span className="px-1 py-0.5 text-[9px] font-bold bg-emerald-100 text-emerald-800 rounded border border-emerald-200">F</span>}
            {opTipo === 'P' && <span className="px-1 py-0.5 text-[9px] font-bold bg-orange-100 text-orange-800 rounded border border-orange-200">P</span>}
        </div>
    );
};

// ─── Evolução OP bar ─────────────────────────────────────────────────────────
const EvolucaoBar = ({ pct, status }) => {
    const display = status === 'ENTREGUE' ? 100 : pct;
    const colorBar = display >= 100 ? 'bg-green-500' : display > 0 ? 'bg-blue-500' : 'bg-gray-300';
    const colorTxt = display >= 100 ? 'text-green-600' : display > 0 ? 'text-blue-600' : 'text-gray-500';
    return (
        <div className="flex flex-col items-center gap-0.5 min-w-[60px]">
            <span className={`text-xs font-bold ${colorTxt}`}>{display}%</span>
            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                <div className={`h-1.5 rounded-full transition-all duration-500 ${colorBar}`} style={{ width: `${Math.max(display > 0 ? 4 : 0, display)}%` }} />
            </div>
        </div>
    );
};

// ─── Expanded NF panel ───────────────────────────────────────────────────────
const NfPanel = ({ item, entregas, colSpan = 15 }) => {
    const nfs = entregas.filter(e => e.pedido === item.pedido && e.item === item.item);
    return (
        <tr className="bg-indigo-50/30">
            <td colSpan={colSpan} className="px-5 py-3 border-b border-slate-200">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    <Truck className="w-3.5 h-3.5" /> NFs emitidas para este item
                </div>
                {item.observacoes && (
                    <div className="mb-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-2.5 py-1.5 max-w-2xl">
                        <strong>Obs:</strong> {item.observacoes}
                    </div>
                )}
                {nfs.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Nenhuma NF emitida para este item ainda.</p>
                ) : (
                    <table className="min-w-max text-xs border-collapse">
                        <thead>
                            <tr className="text-slate-400 uppercase text-[10px] tracking-wide">
                                <th className="text-left pr-6 pb-1.5 font-semibold">NF / Série</th>
                                <th className="text-left pr-6 pb-1.5 font-semibold">Emissão</th>
                                <th className="text-right pr-6 pb-1.5 font-semibold">Qtd Entregue</th>
                                <th className="text-left pb-1.5 font-semibold">Transportadora</th>
                            </tr>
                        </thead>
                        <tbody>
                            {nfs.map((nf, i) => (
                                <tr key={i} className="border-t border-indigo-100">
                                    <td className="pr-6 py-1.5 font-mono font-bold text-slate-700">
                                        {nf.nota}<span className="text-slate-400 font-normal text-[10px]">/{nf.serie}</span>
                                    </td>
                                    <td className="pr-6 py-1.5 font-semibold text-slate-600">{nf.emissao_nf || '—'}</td>
                                    <td className="pr-6 py-1.5 text-right font-bold text-emerald-700">
                                        {fmtQtd(nf.qtd_entregue)} {nf.unidade}
                                    </td>
                                    <td className="py-1.5 text-slate-500">{nf.transportadora || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </td>
        </tr>
    );
};

// ─── Item Row — 15 Colunas Exatas da Planilha / Imagem ─────────────────────────
const ItemRow = ({ item, entregas }) => {
    const [open, setOpen] = useState(false);
    const itemNfs = entregas.filter(e => e.pedido === item.pedido && e.item === item.item);
    const latestNf = itemNfs.length > 0 ? itemNfs[0] : null;

    const dataEmissaoFmt = item.data_emissao || (item.emissao_raw ? `${item.emissao_raw.substring(6,8)}/${item.emissao_raw.substring(4,6)}/${item.emissao_raw.substring(0,4)}` : '—');
    const dataEntregaFmt = item.data_pcp || item.entrega || (item.entrega_raw ? `${item.entrega_raw.substring(6,8)}/${item.entrega_raw.substring(4,6)}/${item.entrega_raw.substring(0,4)}` : '—');

    return (
        <>
            <tr
                onClick={() => setOpen(o => !o)}
                className={`border-b border-slate-100 cursor-pointer transition-colors text-xs hover:bg-blue-50/40
                    ${item.saldo_faturar <= 0 ? 'bg-emerald-50/30' : 'bg-white'}
                    ${open ? '!bg-indigo-50/60' : ''}`}
            >
                {/* 1. Pedido */}
                <td className="px-3 py-2 font-mono font-bold text-slate-900 whitespace-nowrap">
                    {item.pedido}
                </td>

                {/* 2. Emissão Pedido */}
                <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                    {dataEmissaoFmt}
                </td>

                {/* 3. Cliente */}
                <td className="px-3 py-2 font-medium text-slate-700 max-w-[140px] truncate" title={item.nome_cliente}>
                    {item.nome_cliente || '—'}
                </td>

                {/* 4. Ordem de Compra */}
                <td className="px-3 py-2 font-mono text-slate-600 max-w-[110px] truncate" title={item.ped_cliente}>
                    {item.ped_cliente || '—'}
                </td>

                {/* 5. Ref. Cliente */}
                <td className="px-3 py-2 font-mono text-slate-600 max-w-[110px] truncate" title={item.ref_cliente}>
                    {item.ref_cliente || '—'}
                </td>

                {/* 6. Item */}
                <td className="px-3 py-2 font-mono text-center text-slate-700">
                    {item.item}
                </td>

                {/* 7. PC */}
                <td className="px-3 py-2 font-mono text-indigo-700 max-w-[100px] truncate" title={item.ped_cliente}>
                    {item.ped_cliente || '—'}
                </td>

                {/* 8. Produto */}
                <td className="px-3 py-2 font-mono font-bold text-blue-700 whitespace-nowrap">
                    {item.produto}
                </td>

                {/* 9. Descrição */}
                <td className="px-3 py-2 text-slate-600 max-w-[180px] truncate" title={item.desc_produto}>
                    {item.desc_produto || '—'}
                </td>

                {/* 10. Qtd Total */}
                <td className="px-3 py-2 text-right font-bold text-slate-800 whitespace-nowrap">
                    {fmtQtd(item.qtd_vendida)} <span className="text-[10px] text-slate-400 font-normal">{item.unidade}</span>
                </td>

                {/* 11. Entrega Prev. */}
                <td className="px-3 py-2 text-center font-medium text-blue-800 whitespace-nowrap">
                    {dataEntregaFmt}
                </td>

                {/* 12. NF Emissão */}
                <td className="px-3 py-2 text-center text-slate-600 whitespace-nowrap">
                    {latestNf?.emissao_nf || '—'}
                </td>

                {/* 13. NF Número */}
                <td className="px-3 py-2 text-center font-mono font-bold text-slate-700 whitespace-nowrap">
                    {latestNf ? `${latestNf.nota}${latestNf.serie ? `/${latestNf.serie}` : ''}` : '—'}
                </td>

                {/* 14. Qtd Faturada */}
                <td className="px-3 py-2 text-right font-semibold text-emerald-700 whitespace-nowrap">
                    {fmtQtd(item.qtd_faturada)}
                </td>

                {/* 15. Saldo Item */}
                <td className={`px-3 py-2 text-right font-bold whitespace-nowrap ${item.saldo_faturar <= 0 ? 'text-emerald-600' : 'text-amber-700'}`}>
                    {fmtQtd(item.saldo_faturar)}
                </td>
            </tr>
            {open && <NfPanel item={item} entregas={entregas} colSpan={15} />}
        </>
    );
};

// ─── Main ────────────────────────────────────────────────────────────────────
const fmtDateBR = (d) => {
    if (!d || d === '—' || d === 'Sem NF') return '—';
    if (d instanceof Date) {
        if (isNaN(d.getTime())) return '—';
        const day = String(d.getUTCDate()).padStart(2, '0');
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const year = d.getUTCFullYear();
        return `${day}/${month}/${year}`;
    }
    const s = String(d).trim();
    if (s.includes('/')) {
        const parts = s.split('/');
        if (parts.length === 3 && parts[2].length === 4) return s;
    }
    if (s.length === 8 && /^\d{8}$/.test(s)) {
        return `${s.substring(6, 8)}/${s.substring(4, 6)}/${s.substring(0, 4)}`;
    }
    if (s.includes('-')) {
        const parts = s.substring(0, 10).split('-');
        if (parts.length === 3 && parts[0].length === 4) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
    }
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
        const day = String(parsed.getUTCDate()).padStart(2, '0');
        const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
        const year = parsed.getUTCFullYear();
        return `${day}/${month}/${year > 2000 ? year : new Date().getFullYear()}`;
    }
    return s || '—';
};

// ─── Carrossel de Imagens Lynx durante o Carregamento ───────────────────
const SLIDES = [
    {
        image: '/images/carrossel/laser.png',
        tag: 'TECNOLOGIA FABRIL LYNX',
        title: 'Corte a Laser de Alta Precisão (CNC)',
        desc: 'Tecnologia de fibra de alta velocidade para corte em aços carbono, inox e alumínio com tolerâncias micrométricas e máxima produtividade.'
    },
    {
        image: '/images/carrossel/dobra.png',
        tag: 'CONFORMAÇÃO METÁLICA',
        title: 'Dobra CNC & Conformação de Chapas',
        desc: 'Dobradeiras automatizadas de alta tonelagem garantindo precisão de ângulos, acabamento impecável e reprodutibilidade de peças industriais.'
    },
    {
        image: '/images/carrossel/solda.png',
        tag: 'SOLUÇÕES ESTRUTURAIS',
        title: 'Caldeiraria & Solda Robótica Especializada',
        desc: 'Processos MIG, TIG e células de soldagem robotizada para montagem de conjuntos metálicos de alta complexidade com rigoroso controle de qualidade.'
    },
    {
        image: '/images/carrossel/laser.png',
        tag: 'GESTÃO INTEGRADA LYNX.COM.BR',
        title: 'Rastreabilidade Total & Transparência PCP',
        desc: 'Acompanhamento em tempo real de saldo a faturar, emissão de notas fiscais, datas de produção e consulta de folhas técnicas em PDF.'
    }
];

const LynxLoadingCarousel = () => {
    const [currentSlide, setCurrentSlide] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentSlide(prev => (prev + 1) % SLIDES.length);
        }, 3800);
        return () => clearInterval(timer);
    }, []);

    const slide = SLIDES[currentSlide];

    return (
        <div className="flex flex-col items-center justify-center p-4 sm:p-8 w-full h-full min-h-[460px]">
            <div className="relative w-full max-w-4xl h-[420px] rounded-3xl overflow-hidden shadow-2xl border border-slate-700/50 bg-slate-950 text-white flex flex-col justify-between p-6 sm:p-10 select-none">
                
                {/* Imagens com transição suave de opacidade (Crossfade) */}
                {SLIDES.map((s, idx) => (
                    <div
                        key={idx}
                        className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out ${idx === currentSlide ? 'opacity-45 scale-105 transition-transform duration-[4000ms]' : 'opacity-0 pointer-events-none'}`}
                        style={{ backgroundImage: `url(${s.image})` }}
                    />
                ))}

                {/* Overlays de gradiente para contraste e elegância */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-950/40 pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/50 to-transparent pointer-events-none" />

                {/* Top Bar: Tag & Loading Indicator */}
                <div className="relative z-10 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 px-3.5 py-1.5 bg-blue-500/20 backdrop-blur-md rounded-xl border border-blue-400/30">
                        <Sparkles className="w-4 h-4 text-blue-400 animate-pulse" />
                        <span className="text-xs font-bold tracking-wider uppercase text-blue-200">{slide.tag}</span>
                    </div>

                    <div className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 shadow-md">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
                        <span>Carregando dados em tempo real...</span>
                    </div>
                </div>

                {/* Conteúdo do Slide */}
                <div className="relative z-10 space-y-3 max-w-2xl my-auto">
                    <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight drop-shadow-md">
                        {slide.title}
                    </h3>
                    <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed drop-shadow-sm">
                        {slide.desc}
                    </p>
                </div>

                {/* Rodapé: Link Institucional & Dots de Navegação */}
                <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/10">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400">Lynx Metalúrgica</span>
                        <span className="text-slate-600">·</span>
                        <a
                            href="https://lynxems.com.br/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 font-semibold"
                        >
                            <span>lynxems.com.br</span>
                            <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>

                    {/* Dots Indicadores de Navegação */}
                    <div className="flex items-center gap-2">
                        {SLIDES.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => setCurrentSlide(idx)}
                                className={`h-2 rounded-full transition-all duration-500 cursor-pointer ${idx === currentSlide ? 'w-8 bg-blue-500 shadow-sm shadow-blue-500/50' : 'w-2 bg-slate-700 hover:bg-slate-500'}`}
                                title={`Ir para o slide ${idx + 1}`}
                            />
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
};

const handleOpenDrawing = async (desenhoUrl, produto) => {
    if (desenhoUrl) {
        const finalUrl = (desenhoUrl.startsWith('/api') || desenhoUrl.startsWith('http'))
            ? desenhoUrl
            : `/api/docs/view?path=${encodeURIComponent(desenhoUrl)}`;
        window.open(getFileUrl(finalUrl), '_blank');
        return;
    }
    if (produto) {
        try {
            const docs = await getProductDocuments(produto);
            if (docs && docs.length > 0) {
                const pdf = docs.find(d => (d.url || d.url_arquivo || '').toLowerCase().endsWith('.pdf')) || docs[0];
                const rawUrl = pdf?.url || pdf?.url_arquivo;
                if (rawUrl) {
                    const finalUrl = (rawUrl.startsWith('/api') || rawUrl.startsWith('http'))
                        ? rawUrl
                        : `/api/docs/view?path=${encodeURIComponent(rawUrl)}`;
                    window.open(getFileUrl(finalUrl), '_blank');
                    return;
                }
            }
            alert(`Nenhum desenho técnico encontrado para o produto ${produto}`);
        } catch (e) {
            console.error('Erro ao buscar desenho:', e);
            alert('Não foi possível carregar o desenho técnico.');
        }
    }
};

const PortalCliente = ({ defaultTab }) => {
    const { user } = useAuth();
    const { openHelp } = useHelp();
    const [items, setItems]       = useState([]);
    const [entregas, setEntregas] = useState([]);
    const [loading, setLoading]   = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError]       = useState(null);
    const [search, setSearch]     = useState('');
    const [tab, setTab]           = useState(defaultTab || 'detalhado'); // 'detalhado' | 'saldo' | 'solicitacoes' | 'solicitacao_tablet'

    useEffect(() => {
        if (defaultTab) {
            setTab(defaultTab);
        }
    }, [defaultTab]);
    const [groupBy, setGroupBy]   = useState('none'); // 'none' | 'pedcli' | 'pedido' | 'produto' | 'ref_cliente' | 'cliente'
    const [collapsedGroups, setCollapsedGroups] = useState({});
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage]         = useState(1);
    const [hasMore, setHasMore]   = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [showLandingModal, setShowLandingModal] = useState(() => {
        const seen = sessionStorage.getItem('@Lynx:landingSeen');
        const isClient = user?.tipo === 'E' || user?.tipoExterno === 'cliente' || !!user?.idCliente;
        return (!seen && isClient);
    });

    // Detecção de Dispositivo Móvel (Smartphone / Tablet) & Visão Responsiva
    const [isMobile, setIsMobile] = useState(() => {
        return window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    });
    const [viewMode, setViewMode] = useState(() => {
        return (window.innerWidth < 768) ? 'cards' : 'table'; // 'cards' | 'table'
    });

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            setIsMobile(mobile);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleExportExcel = () => {
        try {
            const wb = XLSX.utils.book_new();
            const dateStr = new Date().toLocaleString('pt-BR');
            const fileDate = new Date().toISOString().split('T')[0];

            // Constroi descrição de filtros aplicados
            const filterParts = [];
            if (filters.cliente) filterParts.push(`Cliente: ${filters.cliente}`);
            if (filters.pedido) filterParts.push(`Pedido: ${filters.pedido}`);
            if (filters.pedcli) filterParts.push(`Ordem Compra: ${filters.pedcli}`);
            if (filters.produto) filterParts.push(`Produto: ${filters.produto}`);
            if (filters.refCliente) filterParts.push(`Ref. Cliente: ${filters.refCliente}`);
            if (filters.dataInicial || filters.dataFinal) filterParts.push(`Período (${filters.dateType}): ${filters.dataInicial || '—'} a ${filters.dataFinal || '—'}`);
            if (filters.only_active === 'true') filterParts.push('Apenas Pendentes');
            const filterLabel = filterParts.length > 0 ? filterParts.join(' | ') : 'Todos os Registros Sem Filtro Restritivo';

            if (tab === 'detalhado') {
                const headerRow = [
                    'PEDIDO', 'EMISSÃO PEDIDO', 'CLIENTE', 'ORDEM DE COMPRA (PC)', 'REF. CLIENTE',
                    'ITEM', 'PRODUTO', 'DESCRIÇÃO DO PRODUTO', 'QTD VENDIDA', 'UNIDADE',
                    'NF EMISSÃO', 'NOTA FISCAL / SÉRIE', 'QTD FATURADA', 'SALDO ITEM'
                ];

                let totVend = 0, totFat = 0, totSal = 0;
                const dataRows = searchedFlatRows.map(row => {
                    const qTot = Number(row.qtd_total || 0);
                    const qFat = Number(row.qtd_faturada || 0);
                    const qSal = Number(row.saldo_item || 0);
                    totVend += qTot;
                    totFat += qFat;
                    totSal += qSal;
                    return [
                        row.pedido,
                        row.emissao_ped,
                        row.cliente,
                        row.ordem_compra,
                        row.ref_cliente,
                        row.item,
                        row.produto,
                        row.descricao,
                        qTot,
                        row.unidade || 'UN',
                        row.nf_emissao || '—',
                        row.nf_nota || '—',
                        qFat,
                        qSal
                    ];
                });

                const summaryRow = [
                    'TOTAL GERAL', '', '', '', '', '', '', '',
                    totVend, '', '', '', totFat, totSal
                ];

                const metaHeader = [
                    ['LYNX EMS SISTEMAS LTDA — SISTEMA DE GESTÃO INTEGRADO (PCP)'],
                    ['RELATÓRIO: CANAL DO CLIENTE — TABELA COMPLETA (NOTAS FISCAIS & ENTREGAS)'],
                    [`Data de Emissão: ${dateStr}  |  Usuário: ${user?.nome || 'Portal Cliente'}  |  Filtros Aplicados: ${filterLabel}`],
                    [], // Linha em branco
                    headerRow,
                    ...dataRows,
                    [], // Linha em branco antes dos totais
                    summaryRow
                ];

                const ws = XLSX.utils.aoa_to_sheet(metaHeader);
                ws['!cols'] = [
                    { wch: 12 }, { wch: 16 }, { wch: 32 }, { wch: 20 }, { wch: 20 },
                    { wch: 8 },  { wch: 18 }, { wch: 40 }, { wch: 14 }, { wch: 10 },
                    { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 14 }
                ];
                XLSX.utils.book_append_sheet(wb, ws, 'Tabela Completa (NFs)');
                XLSX.writeFile(wb, `Lynx_Canal_Cliente_NFs_${fileDate}.xlsx`);
            } else {
                const headerRow = [
                    'PEDIDO', 'EMISSÃO PEDIDO', 'CLIENTE', 'ORDEM DE COMPRA (PC)', 'REF. CLIENTE',
                    'ITEM', 'PRODUTO', 'DESCRIÇÃO DO PRODUTO', 'QTD VENDIDA', 'UNIDADE',
                    'QTD FATURADA', 'SALDO A FATURAR', '% FATURADO', 'DATA PCP', 'QTD PCP', 'STATUS'
                ];

                let totVend = 0, totFat = 0, totSal = 0;
                const dataRows = itemsComSaldo.map(item => {
                    const qTot = Number(item.qtd_vendida || 0);
                    const qFat = Number(item.qtd_faturada || 0);
                    const qSal = Number(item.saldo_faturar || 0);
                    const pct  = qTot > 0 ? Math.round((qFat / qTot) * 100) : 0;
                    totVend += qTot;
                    totFat += qFat;
                    totSal += qSal;
                    return [
                        item.pedido,
                        fmtDateBR(item.data_emissao || item.emissao_raw),
                        item.nome_cliente || '—',
                        item.ped_cliente || '—',
                        item.ref_cliente || '—',
                        item.item,
                        item.produto,
                        item.desc_produto || '—',
                        qTot,
                        item.unidade || 'UN',
                        qFat,
                        qSal,
                        `${pct}%`,
                        fmtDateBR(item.data_pcp) || '—',
                        Number(item.qtd_pcp || 0),
                        STATUS_CONFIG[item.status]?.label || item.status
                    ];
                });

                const summaryRow = [
                    'TOTAL GERAL', '', '', '', '', '', '', '',
                    totVend, '', totFat, totSal, '', '', '', ''
                ];

                const metaHeader = [
                    ['LYNX EMS SISTEMAS LTDA — SISTEMA DE GESTÃO INTEGRADO (PCP)'],
                    ['RELATÓRIO: CANAL DO CLIENTE — ITENS COM SALDO A FATURAR'],
                    [`Data de Emissão: ${dateStr}  |  Usuário: ${user?.nome || 'Portal Cliente'}  |  Filtros Aplicados: ${filterLabel}`],
                    [], // Linha em branco
                    headerRow,
                    ...dataRows,
                    [], // Linha em branco antes dos totais
                    summaryRow
                ];

                const ws = XLSX.utils.aoa_to_sheet(metaHeader);
                ws['!cols'] = [
                    { wch: 12 }, { wch: 16 }, { wch: 32 }, { wch: 20 }, { wch: 20 },
                    { wch: 8 },  { wch: 18 }, { wch: 40 }, { wch: 14 }, { wch: 10 },
                    { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 20 }
                ];
                XLSX.utils.book_append_sheet(wb, ws, 'Saldo a Faturar');
                XLSX.writeFile(wb, `Lynx_Canal_Cliente_Saldo_${fileDate}.xlsx`);
            }
        } catch (err) {
            console.error('Erro ao exportar para Excel:', err);
            alert('Não foi possível gerar a planilha Excel.');
        }
    };

    // Filtros espelhando a Visão Geral
    const [filters, setFilters] = useState({
        cliente: '',
        pedido: '',
        pedcli: '',
        produto: '',
        refCliente: '',
        dataInicial: '',
        dataFinal: '',
        dateType: 'pedido',
        tipo_item: '',
        only_active: 'true',
    });

    const scrollContainerRef = useRef(null);

    const buildQuery = useCallback((f, pageNum) => {
        const p = new URLSearchParams();
        p.set('page', pageNum);
        p.set('limit', '10000'); // Carregamento completo de todos os registros em sua totalidade com base nos filtros
        if (f.cliente)     p.set('cliente', f.cliente);
        if (f.pedido)      p.set('pedido', f.pedido);
        if (f.pedcli)      p.set('pedcli', f.pedcli);
        if (f.produto)     p.set('produto', f.produto);
        if (f.refCliente)  p.set('refCliente', f.refCliente);
        if (f.dataInicial) p.set('dataInicial', f.dataInicial);
        if (f.dataFinal)   p.set('dataFinal', f.dataFinal);
        if (f.dateType)    p.set('dateType', f.dateType);
        if (f.tipo_item)   p.set('tipo_item', f.tipo_item);
        if (f.only_active === 'true') p.set('only_active', 'true');
        return p.toString();
    }, []);

    const fetchData = useCallback(async (pageNum = 1, isLoadMore = false, overrideFilters = null) => {
        const f = overrideFilters || filters;
        try {
            if (isLoadMore) setLoadingMore(true);
            else setLoading(true);
            
            setError(null);
            const qs = buildQuery(f, pageNum);
            const { data } = await api.get(`/pedidos/portal-cliente?${qs}`);
            
            const newItems = Array.isArray(data.items) ? data.items : [];
            const newEntregas = Array.isArray(data.entregas) ? data.entregas : [];
            
            if (isLoadMore) {
                setItems(prev => {
                    const map = new Map();
                    [...prev, ...newItems].forEach(i => map.set(`${i.pedido}-${i.item}`, i));
                    return Array.from(map.values());
                });
                setEntregas(prev => {
                    const map = new Map();
                    [...prev, ...newEntregas].forEach(e => {
                        map.set(`${e.pedido}-${e.item}-${e.nota}-${e.serie}`, e);
                    });
                    return Array.from(map.values());
                });
            } else {
                setItems(newItems);
                setEntregas(newEntregas);
            }
            
            setHasMore(data.meta ? data.meta.hasNextPage : false);
            setPage(pageNum);
        } catch (err) {
            console.error('[PortalCliente] Erro:', err);
            setError('Não foi possível carregar os dados. Tente novamente.');
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [filters, buildQuery]);

    // Carregamento em lotes automático por scroll
    const handleScroll = useCallback(() => {
        if (!scrollContainerRef.current || loadingMore || !hasMore || loading) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        if (scrollHeight - scrollTop - clientHeight < 250) {
            fetchData(page + 1, true);
        }
    }, [loadingMore, hasMore, loading, page, fetchData]);

    // Executa a primeira busca automaticamente para inicializar os dados
    useEffect(() => {
        setHasSearched(true);
        fetchData(1);
    }, []);

    const kpis = useMemo(() => ({
        total:      items.length,
        emProd:     items.filter(i => ['EM_PRODUCAO','OP_ABERTA','PRODUCAO_CONCLUIDA'].includes(i.status)).length,
        entregues:  items.filter(i => i.status === 'ENTREGUE').length,
        aguardando: items.filter(i => ['AGUARDANDO_OP','AGUARDANDO'].includes(i.status)).length,
        qtdTotal:   items.reduce((s, i) => s + (i.qtd_vendida || 0), 0),
        qtdFat:     items.reduce((s, i) => s + (i.qtd_faturada || 0), 0),
    }), [items]);

    const filteredItems = useMemo(() => {
        let result = items;
        if (statusFilter) result = result.filter(i => i.status === statusFilter);
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(i =>
                i.pedido.toLowerCase().includes(q) ||
                i.item.toLowerCase().includes(q) ||
                (i.produto || '').toLowerCase().includes(q) ||
                (i.desc_produto || '').toLowerCase().includes(q) ||
                (i.ped_cliente || '').toLowerCase().includes(q) ||
                (i.nome_cliente || '').toLowerCase().includes(q) ||
                (i.op_num || '').toLowerCase().includes(q)
            );
        }
        return result;
    }, [items, search, statusFilter]);

    // Flatten data: se um item tiver NFs emitidas, repete a linha para cada NF (Lógica da Planilha do Faturamento)
    const flatTableRows = useMemo(() => {
        const rows = [];
        filteredItems.forEach((item, itemIdx) => {
            const itemNfs = entregas.filter(
                e => String(e.pedido).trim() === String(item.pedido).trim() &&
                     String(e.item).trim() === String(item.item).trim()
            );

            const dataEmissaoFmt = fmtDateBR(item.data_emissao || item.emissao_raw);
            const dataEntregaFmt = fmtDateBR(item.entrega || item.entrega_raw);
            const dataPcpFmt     = fmtDateBR(item.data_pcp);

            if (itemNfs.length > 0) {
                itemNfs.forEach((nf, idx) => {
                    rows.push({
                        id: `${item.pedido}-${item.item}-NF-${nf.nota}-${nf.serie}-${itemIdx}-${idx}`,
                        pedido: item.pedido,
                        emissao_ped: dataEmissaoFmt,
                        cliente: item.nome_cliente || '—',
                        ordem_compra: item.ped_cliente || '—',
                        ref_cliente: item.ref_cliente || '—',
                        item: item.item,
                        pc: item.ped_cliente || '—',
                        produto: item.produto,
                        desenho_url: item.desenho_url || null,
                        descricao: item.desc_produto || '—',
                        qtd_total: item.qtd_vendida,
                        unidade: item.unidade,
                        entrega_prev: dataEntregaFmt,
                        data_pcp: dataPcpFmt,
                        nf_emissao: fmtDateBR(nf.emissao_nf || nf.emissao),
                        nf_nota: `${nf.nota}${nf.serie ? `/${nf.serie}` : ''}`,
                        qtd_faturada: nf.qtd_entregue,
                        saldo_item: item.saldo_faturar,
                        hasNf: true
                    });
                });
            } else {
                rows.push({
                    id: `${item.pedido}-${item.item}-NO_NF-${itemIdx}`,
                    pedido: item.pedido,
                    emissao_ped: dataEmissaoFmt,
                    cliente: item.nome_cliente || '—',
                    ordem_compra: item.ped_cliente || '—',
                    ref_cliente: item.ref_cliente || '—',
                    item: item.item,
                    pc: item.ped_cliente || '—',
                    produto: item.produto,
                    desenho_url: item.desenho_url || null,
                    descricao: item.desc_produto || '—',
                    qtd_total: item.qtd_vendida,
                    unidade: item.unidade,
                    entrega_prev: dataEntregaFmt,
                    data_pcp: dataPcpFmt,
                    nf_emissao: '—',
                    nf_nota: '—',
                    qtd_faturada: 0,
                    saldo_item: item.saldo_faturar,
                    hasNf: false
                });
            }
        });
        return rows;
    }, [filteredItems, entregas]);

    // Busca local nas linhas achatadas
    const searchedFlatRows = useMemo(() => {
        if (!search.trim()) return flatTableRows;
        const q = search.toLowerCase();
        return flatTableRows.filter(r =>
            r.pedido.toLowerCase().includes(q) ||
            r.produto.toLowerCase().includes(q) ||
            r.descricao.toLowerCase().includes(q) ||
            r.ordem_compra.toLowerCase().includes(q) ||
            r.ref_cliente.toLowerCase().includes(q) ||
            r.nf_nota.toLowerCase().includes(q)
        );
    }, [flatTableRows, search]);

    // Itens com Saldo Pendente a Faturar (saldo_faturar > 0)
    const itemsComSaldo = useMemo(() => {
        return filteredItems.filter(i => (Number(i.saldo_faturar) || 0) > 0);
    }, [filteredItems]);

    // KPIs específicos da aba de Saldo a Faturar
    const kpisSaldo = useMemo(() => {
        const totalItens  = itemsComSaldo.length;
        const qtdTotal    = itemsComSaldo.reduce((s, i) => s + (Number(i.qtd_vendida) || 0), 0);
        const qtdFat      = itemsComSaldo.reduce((s, i) => s + (Number(i.qtd_faturada) || 0), 0);
        const saldoTotal  = itemsComSaldo.reduce((s, i) => s + (Number(i.saldo_faturar) || 0), 0);
        const pctConcluido = qtdTotal > 0 ? Math.round((qtdFat / qtdTotal) * 100) : 0;

        return { totalItens, qtdTotal, qtdFat, saldoTotal, pctConcluido };
    }, [itemsComSaldo]);

    // Table columns — Colunas da tabela detalhada por NF
    const COLS_DETALHADO = [
        'Pedido', 'Emissão Pedido', 'Cliente', 'Ordem de Compra', 'Ref. Cliente',
        'Item', 'PC', 'Produto', 'Descrição', 'Qtd Total',
        'NF Emissão', 'NF Número', 'Qtd Faturada', 'Saldo Item'
    ];

    // Table columns — Colunas da aba Saldo a Faturar
    const COLS_SALDO = [
        'Pedido', 'Emissão Pedido', 'Cliente', 'Ordem de Compra', 'Ref. Cliente',
        'Item', 'Produto', 'Descrição', 'Qtd Total (Vendida)', 'Qtd Faturada',
        'Saldo a Faturar', '% Faturado', 'Data PCP', 'Qtd PCP', 'Status'
    ];

    // Configuração de Agrupamento Dinâmico
    const GROUP_LABELS = {
        pedcli: 'Ordem de Compra (PC)',
        pedido: 'Pedido de Venda',
        produto: 'Produto',
        ref_cliente: 'Ref. Cliente',
        cliente: 'Cliente',
        nf: 'Nota Fiscal (NF)',
        emissao_ped: 'Data Emissão Pedido',
        nf_emissao: 'Data Emissão NF'
    };

    const toggleGroup = (key) => {
        setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const toggleAllGroups = (collapse = true) => {
        if (!groupedData) return;
        const newMap = {};
        if (collapse) {
            groupedData.forEach(g => { newMap[g.key] = true; });
        }
        setCollapsedGroups(newMap);
    };

    const groupedData = useMemo(() => {
        if (groupBy === 'none') return null;

        const targetList = tab === 'detalhado' ? searchedFlatRows : itemsComSaldo;
        const map = new Map();

        targetList.forEach(item => {
            let key = 'Sem Informação';
            if (groupBy === 'pedcli') key = item.ordem_compra || item.ped_cliente || item.pc || 'Sem Ordem de Compra';
            else if (groupBy === 'pedido') key = item.pedido || 'Sem Pedido';
            else if (groupBy === 'produto') key = item.produto || 'Sem Produto';
            else if (groupBy === 'ref_cliente') key = item.ref_cliente || 'Sem Ref. Cliente';
            else if (groupBy === 'cliente') key = item.cliente || item.nome_cliente || 'Sem Cliente';
            else if (groupBy === 'nf') key = item.nf_nota && item.nf_nota !== '—' ? item.nf_nota : 'Sem NF Emitida';
            else if (groupBy === 'emissao_ped') key = item.emissao_ped || 'Sem Data Emissão';
            else if (groupBy === 'nf_emissao') key = item.nf_emissao || 'Sem Data Emissão NF';

            key = String(key).trim() || 'Sem Informação';
            if (!map.has(key)) {
                map.set(key, {
                    key,
                    items: [],
                    qtdTotal: 0,
                    qtdFat: 0,
                    saldoTotal: 0
                });
            }
            const g = map.get(key);
            g.items.push(item);

            const qTot = Number(item.qtd_total ?? item.qtd_vendida ?? 0);
            const qFat = Number(item.qtd_faturada ?? item.qtd_entregue ?? 0);
            const qSal = Number(item.saldo_item ?? item.saldo_faturar ?? 0);

            g.qtdTotal += qTot;
            g.qtdFat += qFat;
            g.saldoTotal += qSal;
        });

        return Array.from(map.values());
    }, [groupBy, tab, searchedFlatRows, itemsComSaldo]);

    return (
        <div className="h-screen overflow-hidden bg-gray-50 p-2 font-sans flex flex-col">
            <div className="w-full h-full flex flex-col overflow-hidden">

                {/* Main table card */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col flex-1 min-h-0">
                    {/* Filter Bar */}
                    {tab !== 'solicitacao_tablet' && (
                        <form className="p-4 border-b border-slate-100 bg-white flex-shrink-0" onSubmit={e => { e.preventDefault(); fetchData(1); }}>
                            {/* Linha 1: 5 Inputs de Filtro Primários */}
                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-y-3 gap-x-2.5 items-end mb-3">

                                {/* 1. Cliente */}
                                <div className="flex flex-col gap-1">
                                    <label className="text-[11px] font-medium text-slate-600 ml-0.5">Cliente:</label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Cliente..."
                                            value={filters.cliente}
                                            onChange={e => setFilters(f => ({ ...f, cliente: e.target.value }))}
                                            className="pl-9 w-full rounded-xl border border-slate-200 bg-slate-50/70 p-2 text-xs outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition-all font-medium text-slate-700"
                                        />
                                    </div>
                                </div>

                                {/* 2. Pedido */}
                                <div className="flex flex-col gap-1">
                                    <label className="text-[11px] font-medium text-slate-600 ml-0.5">Pedido:</label>
                                    <div className="relative">
                                        <Filter className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Ex: 4618, 4620..."
                                            value={filters.pedido}
                                            onChange={e => setFilters(f => ({ ...f, pedido: e.target.value }))}
                                            className="pl-9 w-full rounded-xl border border-slate-200 bg-slate-50/70 p-2 text-xs outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition-all font-medium text-slate-700"
                                        />
                                    </div>
                                </div>

                                {/* 3. Ordem Compra */}
                                <div className="flex flex-col gap-1">
                                    <label className="text-[11px] font-medium text-slate-600 ml-0.5">Ordem Compra:</label>
                                    <div className="relative">
                                        <Filter className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Ex: 4618, 4620..."
                                            value={filters.pedcli}
                                            onChange={e => setFilters(f => ({ ...f, pedcli: e.target.value }))}
                                            className="pl-9 w-full rounded-xl border border-slate-200 bg-slate-50/70 p-2 text-xs outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition-all font-medium text-slate-700"
                                        />
                                    </div>
                                </div>

                                {/* 4. Produto */}
                                <div className="flex flex-col gap-1">
                                    <label className="text-[11px] font-medium text-slate-600 ml-0.5">Produto:</label>
                                    <div className="relative">
                                        <Package className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Cód. Produto..."
                                            value={filters.produto}
                                            onChange={e => setFilters(f => ({ ...f, produto: e.target.value }))}
                                            className="pl-9 w-full rounded-xl border border-slate-200 bg-slate-50/70 p-2 text-xs outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition-all font-medium text-slate-700"
                                        />
                                    </div>
                                </div>

                                {/* 5. Ref. Cliente */}
                                <div className="flex flex-col gap-1">
                                    <label className="text-[11px] font-medium text-slate-600 ml-0.5">Ref. Cliente:</label>
                                    <div className="relative">
                                        <Hash className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="# Ref..."
                                            value={filters.refCliente}
                                            onChange={e => setFilters(f => ({ ...f, refCliente: e.target.value }))}
                                            className="pl-9 w-full rounded-xl border border-slate-200 bg-slate-50/70 p-2 text-xs outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition-all font-medium text-slate-700"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Linha 2: Intervalo de Datas */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-2 gap-x-2.5 items-end mb-3 pt-2 border-t border-slate-100">
                                {/* Tipo de Data */}
                                <div className="flex flex-col gap-1">
                                    <label className="text-[11px] font-medium text-slate-600 ml-0.5">Filtrar Data Por:</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                        <select
                                            value={filters.dateType}
                                            onChange={e => setFilters(f => ({ ...f, dateType: e.target.value }))}
                                            className="pl-9 w-full rounded-xl border border-slate-200 bg-slate-50/70 p-2 text-xs outline-none focus:border-blue-500 focus:bg-white transition-all font-medium text-slate-700 cursor-pointer"
                                        >
                                            <option value="pedido">Data Emissão Pedido</option>
                                            <option value="entrega">Data Prev. Entrega</option>
                                            <option value="pcp">Data Previsão PCP</option>
                                            <option value="nf">Data Emissão NF</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Data Inicial */}
                                <div className="flex flex-col gap-1">
                                    <label className="text-[11px] font-medium text-slate-600 ml-0.5">Data Inicial:</label>
                                    <input
                                        type="date"
                                        value={filters.dataInicial}
                                        onChange={e => setFilters(f => ({ ...f, dataInicial: e.target.value }))}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50/70 p-2 text-xs outline-none focus:border-blue-500 focus:bg-white transition-all font-medium text-slate-700"
                                    />
                                </div>

                                {/* Data Final */}
                                <div className="flex flex-col gap-1">
                                    <label className="text-[11px] font-medium text-slate-600 ml-0.5">Data Final:</label>
                                    <input
                                        type="date"
                                        value={filters.dataFinal}
                                        onChange={e => setFilters(f => ({ ...f, dataFinal: e.target.value }))}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50/70 p-2 text-xs outline-none focus:border-blue-500 focus:bg-white transition-all font-medium text-slate-700"
                                    />
                                </div>
                            </div>

                            {/* Linha 3: Botão Filtrar + Botão Limpar + Toggle Pesado */}
                            <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                                <div className="flex items-center gap-2">
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex items-center justify-center gap-2 px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                                    >
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                        Filtrar
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            const clean = { cliente: '', pedido: '', pedcli: '', produto: '', refCliente: '', dataInicial: '', dataFinal: '', dateType: 'pedido', tipo_item: '', only_active: 'true' };
                                            setFilters(clean);
                                            setSearch('');
                                            setGroupBy('none');
                                            fetchData(1, false, clean);
                                        }}
                                        className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition-all cursor-pointer"
                                        title="Limpar todos os filtros e buscar tudo"
                                    >
                                        <X className="w-3.5 h-3.5 text-slate-500" />
                                        <span>Limpar Filtros</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => openHelp('/portal-cliente')}
                                        className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-semibold border border-blue-200 transition-all shadow-2xs cursor-pointer ml-1"
                                        title="Abrir Ajuda de Contexto no Painel Lateral (HelpDrawer)"
                                    >
                                        <HelpCircle className="w-4 h-4 text-blue-600" />
                                        <span>Ajuda de Contexto</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleExportExcel}
                                        disabled={loading || (tab === 'detalhado' ? searchedFlatRows.length === 0 : itemsComSaldo.length === 0)}
                                        className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-semibold border border-emerald-200 transition-all shadow-2xs cursor-pointer disabled:opacity-50 ml-1"
                                        title="Exportar todos os registros filtrados para Excel (.xlsx)"
                                    >
                                        <FileDown className="w-4 h-4 text-emerald-600" />
                                        <span>Exportar Excel</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setShowLandingModal(true)}
                                        className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-800 rounded-xl text-xs font-semibold border border-purple-200 transition-all shadow-2xs cursor-pointer ml-1"
                                        title="Conheça a Lynx e visite o site oficial"
                                    >
                                        <Globe className="w-4 h-4 text-purple-600" />
                                        <span>Sobre a Lynx</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setViewMode(v => v === 'cards' ? 'table' : 'cards')}
                                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all shadow-2xs cursor-pointer ml-1 ${viewMode === 'cards' ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'}`}
                                        title="Alternar entre Visão de Cards Rápidos (Celular/Smartphone) e Tabela Completa (Desktop)"
                                    >
                                        {viewMode === 'cards' ? (
                                            <>
                                                <Smartphone className="w-4 h-4 text-amber-600 animate-pulse" />
                                                <span>Cards Rápidos (Mobile)</span>
                                            </>
                                        ) : (
                                            <>
                                                <Laptop className="w-4 h-4 text-slate-600" />
                                                <span>Tabela Completa (Desktop)</span>
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* Switch Apenas Pendentes */}
                                <div className="flex items-center gap-3">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={filters.only_active === 'true'}
                                            onChange={e => setFilters(f => ({ ...f, only_active: e.target.checked ? 'true' : 'false' }))}
                                            className="sr-only peer"
                                        />
                                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                        <span className="ml-2 text-xs font-medium text-slate-700">Apenas Pendentes</span>
                                    </label>
                                    <span className="text-[10px] text-slate-400 hidden sm:inline">(Filtro Pesado — Desative para busca completa)</span>
                                </div>
                            </div>
                        </form>
                    )}

                    {/* Table Toolbar & Tab Selector */}
                    <div className="px-4 py-2 bg-slate-100/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs flex-shrink-0">
                        <div className="flex flex-wrap items-center gap-3">
                            {/* Tab Pills */}
                            <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl">
                                <button
                                    type="button"
                                    onClick={() => setTab('detalhado')}
                                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        tab === 'detalhado'
                                            ? 'bg-white text-slate-900 shadow-sm'
                                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                                    }`}
                                >
                                    <Layers className="w-3.5 h-3.5 text-blue-600" />
                                    <span>Tabela Completa (NFs)</span>
                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${tab === 'detalhado' ? 'bg-blue-100 text-blue-800 font-extrabold' : 'bg-slate-300/60 text-slate-700'}`}>
                                        {searchedFlatRows.length}
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setTab('saldo')}
                                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        tab === 'saldo'
                                            ? 'bg-white text-slate-900 shadow-sm'
                                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                                    }`}
                                >
                                    <BarChart2 className="w-3.5 h-3.5 text-amber-600" />
                                    <span>Saldo a Faturar</span>
                                    {itemsComSaldo.length > 0 && (
                                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${tab === 'saldo' ? 'bg-amber-100 text-amber-900 font-extrabold' : 'bg-amber-100 text-amber-800 font-semibold'}`}>
                                            {itemsComSaldo.length}
                                        </span>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setTab('solicitacoes')}
                                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        tab === 'solicitacoes'
                                            ? 'bg-white text-slate-900 shadow-sm'
                                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                                    }`}
                                >
                                    <MessageSquare className="w-3.5 h-3.5 text-purple-600" />
                                    <span>Minhas Solicitações</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setTab('solicitacao_tablet')}
                                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        tab === 'solicitacao_tablet'
                                            ? 'bg-white text-slate-900 shadow-sm'
                                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                                    }`}
                                >
                                    <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                                    <span>Solicitação Rápida (Tablet)</span>
                                </button>
                            </div>

                            {/* Dropdown Agrupar por */}
                            {tab !== 'solicitacoes' && tab !== 'solicitacao_tablet' && (
                                <>
                                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                                        <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                                        <span className="text-xs font-semibold text-slate-600">Agrupar por:</span>
                                        <select
                                            value={groupBy}
                                            onChange={e => setGroupBy(e.target.value)}
                                            className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
                                        >
                                            <option value="none">Sem Agrupamento</option>
                                            <option value="pedcli">Ordem de Compra (PC)</option>
                                            <option value="pedido">Pedido de Venda</option>
                                            <option value="produto">Produto</option>
                                            <option value="ref_cliente">Ref. Cliente</option>
                                            <option value="cliente">Cliente</option>
                                            <option value="nf">Nota Fiscal (NF)</option>
                                            <option value="emissao_ped">Data Emissão Pedido</option>
                                            <option value="nf_emissao">Data Emissão NF</option>
                                        </select>
                                    </div>

                                    {groupBy !== 'none' && groupedData && (
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => toggleAllGroups(false)}
                                                className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 rounded-lg border border-slate-200 text-[11px] font-medium transition-all"
                                            >
                                                Expandir Todos
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => toggleAllGroups(true)}
                                                className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 rounded-lg border border-slate-200 text-[11px] font-medium transition-all"
                                            >
                                                Recolher Todos
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Batch Info */}
                        {tab !== 'solicitacoes' && tab !== 'solicitacao_tablet' && (
                            <div className="flex items-center gap-2 text-slate-500 font-medium">
                                {groupBy !== 'none' && groupedData ? (
                                    <span><strong>{groupedData.length}</strong> grupos ({tab === 'detalhado' ? searchedFlatRows.length : itemsComSaldo.length} itens)</span>
                                ) : tab === 'detalhado' ? (
                                    <span>Exibindo <strong>{searchedFlatRows.length}</strong> registros / NFs</span>
                                ) : (
                                    <span>Exibindo <strong>{itemsComSaldo.length}</strong> itens com saldo pendente</span>
                                )}
                                {items.length > 0 && (
                                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md font-mono text-[10px] font-semibold border border-blue-100">
                                        Total: {items.length} itens
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Table area — Tabela Única Achatada / Saldo a Faturar / Agrupamentos com Carregamento Dinâmico em Lotes */}
                    <div
                        ref={scrollContainerRef}
                        onScroll={handleScroll}
                        className="flex-1 overflow-auto min-h-0"
                    >
                        {loading && items.length === 0 ? (
                            <LynxLoadingCarousel />
                        ) : error ? (
                            <div className="flex flex-col items-center justify-center h-56 gap-3 text-red-500">
                                <AlertTriangle className="w-7 h-7" />
                                <p className="text-sm text-center max-w-xs">{error}</p>
                                <button onClick={fetchData} className="px-3 py-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded border border-red-100">
                                    Tentar novamente
                                </button>
                            </div>
                        ) : tab === 'solicitacoes' ? (
                            <PortalClienteSolicitacoes user={user} allOrderItems={items} filters={filters} onOpenDrawing={handleOpenDrawing} />
                        ) : tab === 'solicitacao_tablet' ? (
                            <PortalClienteTabletView user={user} allOrderItems={items} onOpenDrawing={handleOpenDrawing} />
                        ) : viewMode === 'cards' ? (
                            <div className="p-3 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                {(tab === 'detalhado' ? searchedFlatRows : itemsComSaldo).length === 0 ? (
                                    <div className="col-span-full flex flex-col items-center justify-center h-56 gap-3 text-slate-400">
                                        <Inbox className="w-9 h-9 opacity-40" />
                                        <p className="text-sm font-medium">Nenhum registro encontrado para exibição em cards.</p>
                                    </div>
                                ) : (
                                    (tab === 'detalhado' ? searchedFlatRows : itemsComSaldo).map((row, idx) => {
                                        const qTot = Number(row.qtd_total ?? row.qtd_vendida ?? 0);
                                        const qFat = Number(row.qtd_faturada ?? row.qtd_entregue ?? 0);
                                        const qSal = Number(row.saldo_item ?? row.saldo_faturar ?? 0);
                                        const pct = qTot > 0 ? Math.min(100, Math.round((qFat / qTot) * 100)) : 0;
                                        const statusKey = String(row.status || (qSal <= 0 ? 'ENTREGUE' : 'EM_ANDAMENTO')).toUpperCase();
                                        const st = STATUS_CONFIG[statusKey] || { label: row.status || 'Em Andamento', color: 'text-blue-700', bg: 'bg-blue-100' };

                                        return (
                                            <div key={`card-${idx}-${row.pedido}-${row.item}`} className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all p-4 flex flex-col justify-between gap-3.5 relative overflow-hidden">
                                                {/* Top: Pedido, Ordem de Compra & Status */}
                                                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                                                    <div className="flex flex-col gap-0.5">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="px-2.5 py-0.5 bg-slate-900 text-white font-mono text-xs font-bold rounded-lg shadow-2xs">
                                                                Ped: {row.pedido}
                                                            </span>
                                                            {row.item && (
                                                                <span className="text-[11px] font-bold text-slate-400">Item {row.item}</span>
                                                            )}
                                                        </div>
                                                        {row.ordem_compra && row.ordem_compra !== '—' && (
                                                            <span className="text-xs font-semibold text-slate-600 truncate max-w-[170px]" title={row.ordem_compra}>
                                                                PC: <strong className="text-slate-800">{row.ordem_compra}</strong>
                                                            </span>
                                                        )}
                                                    </div>

                                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border whitespace-nowrap ${st.bg} ${st.color}`}>
                                                        {st.label}
                                                    </span>
                                                </div>

                                                {/* Produto & Descrição */}
                                                <div className="space-y-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                                            {row.produto}
                                                        </span>
                                                        {row.ref_cliente && row.ref_cliente !== '—' && (
                                                            <span className="text-[11px] text-slate-500 font-medium truncate max-w-[140px]">Ref: <strong>{row.ref_cliente}</strong></span>
                                                        )}
                                                    </div>
                                                    <h4 className="text-xs font-bold text-slate-800 line-clamp-2 leading-snug">
                                                        {row.descricao}
                                                    </h4>
                                                </div>

                                                {/* Card Grid de Quantidades */}
                                                <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 space-y-2">
                                                    <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
                                                        <div className="bg-white p-1.5 rounded-lg border border-slate-200/60 shadow-2xs">
                                                            <span className="block text-[9px] text-slate-400 font-bold uppercase">Qtd Total</span>
                                                            <span className="font-bold text-slate-700">{fmtQtd(qTot)} {row.unidade}</span>
                                                        </div>
                                                        <div className="bg-emerald-50/80 p-1.5 rounded-lg border border-emerald-100">
                                                            <span className="block text-[9px] text-emerald-700 font-bold uppercase">Faturada</span>
                                                            <span className="font-bold text-emerald-700">{fmtQtd(qFat)} {row.unidade}</span>
                                                        </div>
                                                        <div className="bg-amber-50/80 p-1.5 rounded-lg border border-amber-100">
                                                            <span className="block text-[9px] text-amber-700 font-bold uppercase">Saldo</span>
                                                            <span className="font-bold text-amber-800">{fmtQtd(qSal)} {row.unidade}</span>
                                                        </div>
                                                    </div>

                                                    {/* Barra de Progresso */}
                                                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full transition-all duration-500 ${pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-blue-500' : 'bg-amber-400'}`}
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium px-0.5">
                                                        <span>Progresso: <strong>{pct}%</strong> Concluído</span>
                                                        {row.nf_nota && row.nf_nota !== '—' && (
                                                            <span className="text-emerald-700 font-bold">NF: {row.nf_nota} ({fmtDateBR(row.nf_emissao)})</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Footer: Datas & Ação Técnica */}
                                                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                                                    <div className="flex flex-col gap-0.5 text-[11px] text-slate-500 font-medium">
                                                        <div className="flex items-center gap-1">
                                                            <Calendar className="w-3.5 h-3.5 text-blue-600" />
                                                            <span>PCP: <strong>{row.data_pcp || '—'}</strong></span>
                                                        </div>
                                                        {row.entrega && (
                                                            <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                                                <Truck className="w-3 h-3 text-slate-400" />
                                                                <span>Entrega: {fmtDateBR(row.entrega)}</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <button
                                                        onClick={() => handleOpenDrawing(row.desenho_url, row.produto)}
                                                        className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                                                    >
                                                        <FileText className="w-3.5 h-3.5 text-white" />
                                                        <span>Desenho PDF</span>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        ) : tab === 'detalhado' ? (
                            searchedFlatRows.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-56 gap-3 text-slate-400">
                                    <Inbox className="w-9 h-9 opacity-40" />
                                    <p className="text-sm">Nenhum registro encontrado.</p>
                                </div>
                            ) : (
                                <table className="min-w-full text-sm border-collapse">
                                    <thead className="bg-[#24312D] text-white sticky top-0 z-10">
                                        <tr>
                                            {COLS_DETALHADO.map((h, i) => (
                                                <th key={i} className={`px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap border-b border-slate-700 ${
                                                    ['Qtd Total', 'Qtd Faturada', 'Saldo Item'].includes(h) ? 'text-right' :
                                                    ['Item', 'NF Emissão', 'NF Número'].includes(h) ? 'text-center' : 'text-left'
                                                }`}>
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {groupBy !== 'none' && groupedData ? (
                                            groupedData.map((group) => {
                                                const isCollapsed = collapsedGroups[group.key];
                                                const pct = group.qtdTotal > 0 ? Math.min(100, Math.round((group.qtdFat / group.qtdTotal) * 100)) : 0;
                                                return (
                                                    <React.Fragment key={`group-fragment-${group.key}`}>
                                                        <tr
                                                            onClick={() => toggleGroup(group.key)}
                                                            className="bg-slate-100 hover:bg-slate-200/90 cursor-pointer border-y border-slate-300 select-none sticky top-[33px] z-10"
                                                        >
                                                            <td colSpan={14} className="px-4 py-2">
                                                                <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                                                                    <div className="flex items-center gap-2.5 font-bold text-slate-800">
                                                                        <span className="p-0.5 rounded bg-white text-slate-600 border border-slate-200 shadow-2xs">
                                                                            {isCollapsed ? <ChevronRight className="w-4 h-4 text-blue-600" /> : <ChevronDown className="w-4 h-4 text-blue-600" />}
                                                                        </span>
                                                                        <span className="text-slate-500 font-medium">{GROUP_LABELS[groupBy] || groupBy}:</span>
                                                                        <span className="font-mono text-xs text-blue-900 bg-white px-2.5 py-0.5 rounded border border-slate-200 shadow-2xs font-extrabold">
                                                                            {group.key}
                                                                        </span>
                                                                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full font-bold text-[10px]">
                                                                            {group.items.length} {group.items.length === 1 ? 'registro' : 'registros'}
                                                                        </span>
                                                                    </div>

                                                                    <div className="flex items-center gap-4 text-xs font-semibold">
                                                                        <span className="text-slate-600">Total: <strong className="text-slate-900">{fmtQtd(group.qtdTotal)}</strong></span>
                                                                        <span className="text-slate-600">Faturado: <strong className="text-emerald-700">{fmtQtd(group.qtdFat)}</strong></span>
                                                                        <span className="text-slate-600">Saldo: <strong className="text-amber-800 font-extrabold bg-amber-100/90 px-2 py-0.5 rounded border border-amber-200">{fmtQtd(group.saldoTotal)}</strong></span>

                                                                        <div className="flex items-center gap-1.5 min-w-[90px]">
                                                                            <div className="w-14 bg-slate-300 rounded-full h-1.5 overflow-hidden">
                                                                                <div
                                                                                    className={`h-full transition-all ${pct >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                                                                    style={{ width: `${pct}%` }}
                                                                                />
                                                                            </div>
                                                                            <span className="text-[11px] font-bold text-slate-700">{pct}%</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                        {!isCollapsed && group.items.map((row) => (
                                                            <tr
                                                                key={row.id}
                                                                className={`border-b border-slate-100 transition-colors text-xs hover:bg-blue-50/40 ${
                                                                    row.saldo_item <= 0 ? 'bg-emerald-50/20' : 'bg-white'
                                                                }`}
                                                            >
                                                                <td className="px-3 py-2 font-mono font-bold text-slate-900 whitespace-nowrap">{row.pedido}</td>
                                                                <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.emissao_ped}</td>
                                                                <td className="px-3 py-2 font-medium text-slate-700 max-w-[150px] truncate" title={row.cliente}>{row.cliente}</td>
                                                                <td className="px-3 py-2 font-mono text-slate-600 max-w-[110px] truncate" title={row.ordem_compra}>{row.ordem_compra}</td>
                                                                <td className="px-3 py-2 font-mono text-slate-600 max-w-[110px] truncate" title={row.ref_cliente}>{row.ref_cliente}</td>
                                                                <td className="px-3 py-2 font-mono text-center text-slate-700">{row.item}</td>
                                                                <td className="px-3 py-2 font-mono text-indigo-700 max-w-[100px] truncate" title={row.pc}>{row.pc}</td>
                                                                <td className="px-3 py-2 font-mono font-bold text-blue-700 whitespace-nowrap">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleOpenDrawing(row.desenho_url, row.produto)}
                                                                        className="hover:underline inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 text-left font-bold"
                                                                        title="Clique para abrir o desenho em PDF"
                                                                    >
                                                                        <span>{row.produto}</span>
                                                                        <FileText className="w-3.5 h-3.5 text-red-500 hover:text-red-700 transition-colors flex-shrink-0" />
                                                                    </button>
                                                                </td>
                                                                <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate" title={row.descricao}>{row.descricao}</td>
                                                                <td className="px-3 py-2 text-right font-bold text-slate-800 whitespace-nowrap">
                                                                    {fmtQtd(row.qtd_total)} <span className="text-[10px] text-slate-400 font-normal">{row.unidade}</span>
                                                                </td>
                                                                <td className="px-3 py-2 text-center text-slate-600 whitespace-nowrap">{row.nf_emissao}</td>
                                                                <td className="px-3 py-2 text-center font-mono font-bold text-slate-700 whitespace-nowrap">{row.nf_nota}</td>
                                                                <td className="px-3 py-2 text-right font-semibold text-emerald-700 whitespace-nowrap">{fmtQtd(row.qtd_faturada)}</td>
                                                                <td className={`px-3 py-2 text-right font-bold whitespace-nowrap ${row.saldo_item <= 0 ? 'text-emerald-600' : 'text-amber-700'}`}>
                                                                    {fmtQtd(row.saldo_item)}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </React.Fragment>
                                                );
                                            })
                                        ) : (
                                            searchedFlatRows.map((row) => (
                                                <tr
                                                    key={row.id}
                                                    className={`border-b border-slate-100 transition-colors text-xs hover:bg-blue-50/40 ${
                                                        row.saldo_item <= 0 ? 'bg-emerald-50/20' : 'bg-white'
                                                    }`}
                                                >
                                                    <td className="px-3 py-2 font-mono font-bold text-slate-900 whitespace-nowrap">{row.pedido}</td>
                                                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.emissao_ped}</td>
                                                    <td className="px-3 py-2 font-medium text-slate-700 max-w-[150px] truncate" title={row.cliente}>{row.cliente}</td>
                                                    <td className="px-3 py-2 font-mono text-slate-600 max-w-[110px] truncate" title={row.ordem_compra}>{row.ordem_compra}</td>
                                                    <td className="px-3 py-2 font-mono text-slate-600 max-w-[110px] truncate" title={row.ref_cliente}>{row.ref_cliente}</td>
                                                    <td className="px-3 py-2 font-mono text-center text-slate-700">{row.item}</td>
                                                    <td className="px-3 py-2 font-mono text-indigo-700 max-w-[100px] truncate" title={row.pc}>{row.pc}</td>
                                                    <td className="px-3 py-2 font-mono font-bold text-blue-700 whitespace-nowrap">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenDrawing(row.desenho_url, row.produto)}
                                                            className="hover:underline inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 text-left font-bold"
                                                            title="Clique para abrir o desenho em PDF"
                                                        >
                                                            <span>{row.produto}</span>
                                                            <FileText className="w-3.5 h-3.5 text-red-500 hover:text-red-700 transition-colors flex-shrink-0" />
                                                        </button>
                                                    </td>
                                                    <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate" title={row.descricao}>{row.descricao}</td>
                                                    <td className="px-3 py-2 text-right font-bold text-slate-800 whitespace-nowrap">
                                                        {fmtQtd(row.qtd_total)} <span className="text-[10px] text-slate-400 font-normal">{row.unidade}</span>
                                                    </td>
                                                    <td className="px-3 py-2 text-center text-slate-600 whitespace-nowrap">{row.nf_emissao}</td>
                                                    <td className="px-3 py-2 text-center font-mono font-bold text-slate-700 whitespace-nowrap">{row.nf_nota}</td>
                                                    <td className="px-3 py-2 text-right font-semibold text-emerald-700 whitespace-nowrap">{fmtQtd(row.qtd_faturada)}</td>
                                                    <td className={`px-3 py-2 text-right font-bold whitespace-nowrap ${row.saldo_item <= 0 ? 'text-emerald-600' : 'text-amber-700'}`}>
                                                        {fmtQtd(row.saldo_item)}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            )
                        ) : (
                            /* Aba Saldo a Faturar (Resumida por Item) */
                            itemsComSaldo.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-56 gap-3 text-slate-400">
                                    <CheckCircle className="w-9 h-9 text-emerald-500 opacity-60" />
                                    <p className="text-sm font-medium text-slate-600">Nenhum item com saldo a faturar pendente!</p>
                                    <p className="text-xs text-slate-400">Todos os itens selecionados foram faturados integralmente.</p>
                                </div>
                            ) : (
                                <table className="min-w-full text-sm border-collapse">
                                    <thead className="bg-[#24312D] text-white sticky top-0 z-10">
                                        <tr>
                                            {COLS_SALDO.map((h, i) => (
                                                <th key={i} className={`px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap border-b border-slate-700 ${
                                                    ['Qtd Total (Vendida)', 'Qtd Faturada', 'Saldo a Faturar', 'Qtd PCP'].includes(h) ? 'text-right' :
                                                    ['Item', '% Faturado', 'Data PCP', 'Previsão Entrega', 'Status'].includes(h) ? 'text-center' : 'text-left'
                                                }`}>
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {groupBy !== 'none' && groupedData ? (
                                            groupedData.map((group) => {
                                                const isCollapsed = collapsedGroups[group.key];
                                                const pct = group.qtdTotal > 0 ? Math.min(100, Math.round((group.qtdFat / group.qtdTotal) * 100)) : 0;
                                                return (
                                                    <React.Fragment key={`group-fragment-saldo-${group.key}`}>
                                                        <tr
                                                            onClick={() => toggleGroup(group.key)}
                                                            className="bg-amber-100/70 hover:bg-amber-200/80 cursor-pointer border-y border-amber-300 select-none sticky top-[33px] z-10"
                                                        >
                                                            <td colSpan={16} className="px-4 py-2">
                                                                <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                                                                    <div className="flex items-center gap-2.5 font-bold text-slate-800">
                                                                        <span className="p-0.5 rounded bg-white text-slate-600 border border-amber-300 shadow-2xs">
                                                                            {isCollapsed ? <ChevronRight className="w-4 h-4 text-amber-700" /> : <ChevronDown className="w-4 h-4 text-amber-700" />}
                                                                        </span>
                                                                        <span className="text-amber-900 font-semibold">{GROUP_LABELS[groupBy] || groupBy}:</span>
                                                                        <span className="font-mono text-xs text-amber-950 bg-white px-2.5 py-0.5 rounded border border-amber-300 shadow-2xs font-extrabold">
                                                                            {group.key}
                                                                        </span>
                                                                        <span className="px-2 py-0.5 bg-amber-200/80 text-amber-900 rounded-full font-bold text-[10px]">
                                                                            {group.items.length} {group.items.length === 1 ? 'item pendente' : 'itens pendentes'}
                                                                        </span>
                                                                    </div>

                                                                    <div className="flex items-center gap-4 text-xs font-semibold">
                                                                        <span className="text-slate-700">Total: <strong className="text-slate-900">{fmtQtd(group.qtdTotal)}</strong></span>
                                                                        <span className="text-slate-700">Faturado: <strong className="text-emerald-700">{fmtQtd(group.qtdFat)}</strong></span>
                                                                        <span className="text-slate-700">Saldo: <strong className="text-amber-900 font-extrabold bg-amber-200/90 px-2 py-0.5 rounded border border-amber-300">{fmtQtd(group.saldoTotal)}</strong></span>

                                                                        <div className="flex items-center gap-1.5 min-w-[90px]">
                                                                            <div className="w-14 bg-amber-200 rounded-full h-1.5 overflow-hidden">
                                                                                <div
                                                                                    className={`h-full transition-all ${pct >= 100 ? 'bg-emerald-500' : 'bg-amber-600'}`}
                                                                                    style={{ width: `${pct}%` }}
                                                                                />
                                                                            </div>
                                                                            <span className="text-[11px] font-bold text-amber-900">{pct}%</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                        {!isCollapsed && group.items.map((item, idx) => {
                                                            const dataEmissaoFmt = fmtDateBR(item.data_emissao || item.emissao_raw);
                                                            const dataEntregaFmt = fmtDateBR(item.entrega || item.entrega_raw);
                                                            const qtdTotal = Number(item.qtd_vendida) || 0;
                                                            const qtdFat   = Number(item.qtd_faturada) || 0;
                                                            const saldo    = Number(item.saldo_faturar) || 0;
                                                            const itemPct  = qtdTotal > 0 ? Math.min(100, Math.round((qtdFat / qtdTotal) * 100)) : 0;

                                                            return (
                                                                <tr
                                                                    key={`${item.pedido}-${item.item}-${idx}`}
                                                                    className="border-b border-slate-100 transition-colors text-xs hover:bg-amber-50/30 bg-white"
                                                                >
                                                                    <td className="px-3 py-2.5 font-mono font-bold text-slate-900 whitespace-nowrap">{item.pedido}</td>
                                                                    <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{dataEmissaoFmt}</td>
                                                                    <td className="px-3 py-2.5 font-medium text-slate-700 max-w-[150px] truncate" title={item.nome_cliente}>{item.nome_cliente || '—'}</td>
                                                                    <td className="px-3 py-2.5 font-mono text-slate-600 max-w-[110px] truncate" title={item.ped_cliente}>{item.ped_cliente || '—'}</td>
                                                                    <td className="px-3 py-2.5 font-mono text-slate-600 max-w-[110px] truncate" title={item.ref_cliente}>{item.ref_cliente || '—'}</td>
                                                                    <td className="px-3 py-2.5 font-mono text-center text-slate-700">{item.item}</td>
                                                                    <td className="px-3 py-2.5 font-mono font-bold text-blue-700 whitespace-nowrap">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleOpenDrawing(item.desenho_url, item.produto)}
                                                                            className="hover:underline inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 text-left font-bold"
                                                                            title="Clique para abrir o desenho em PDF"
                                                                        >
                                                                            <span>{item.produto}</span>
                                                                            <FileText className="w-3.5 h-3.5 text-red-500 hover:text-red-700 transition-colors flex-shrink-0" />
                                                                        </button>
                                                                    </td>
                                                                    <td className="px-3 py-2.5 text-slate-600 max-w-[200px] truncate" title={item.desc_produto}>{item.desc_produto || '—'}</td>
                                                                    <td className="px-3 py-2.5 text-right font-bold text-slate-800 whitespace-nowrap">
                                                                        {fmtQtd(qtdTotal)} <span className="text-[10px] text-slate-400 font-normal">{item.unidade}</span>
                                                                    </td>
                                                                    <td className="px-3 py-2.5 text-right font-semibold text-emerald-700 whitespace-nowrap">{fmtQtd(qtdFat)}</td>
                                                                    <td className="px-3 py-2.5 text-right font-extrabold text-amber-800 whitespace-nowrap">
                                                                        <span className="bg-amber-100/70 border border-amber-200/80 px-2 py-0.5 rounded-md">{fmtQtd(saldo)}</span>
                                                                    </td>
                                                                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                                                        <div className="flex flex-col items-center gap-0.5 min-w-[70px]">
                                                                            <span className={`text-[11px] font-bold ${itemPct >= 100 ? 'text-emerald-600' : itemPct > 0 ? 'text-blue-600' : 'text-slate-500'}`}>{itemPct}%</span>
                                                                            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                                                                <div
                                                                                    className={`h-full transition-all duration-500 ${
                                                                                        itemPct >= 100 ? 'bg-emerald-500' : itemPct > 50 ? 'bg-blue-500' : itemPct > 0 ? 'bg-amber-500' : 'bg-slate-300'
                                                                                    }`}
                                                                                    style={{ width: `${Math.max(itemPct > 0 ? 5 : 0, itemPct)}%` }}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-3 py-2.5 text-center font-medium text-purple-700 whitespace-nowrap">{item.data_pcp || '—'}</td>
                                                                    <td className="px-3 py-2.5 text-right font-semibold text-purple-800 whitespace-nowrap">{item.qtd_pcp > 0 ? fmtQtd(item.qtd_pcp) : '—'}</td>
                                                                    <td className="px-3 py-2.5 text-center whitespace-nowrap"><StatusBadge status={item.status} /></td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </React.Fragment>
                                                );
                                            })
                                        ) : (
                                            itemsComSaldo.map((item, idx) => {
                                                const dataEmissaoFmt = fmtDateBR(item.data_emissao || item.emissao_raw);
                                                const dataEntregaFmt = fmtDateBR(item.entrega || item.entrega_raw);
                                                const qtdTotal = Number(item.qtd_vendida) || 0;
                                                const qtdFat   = Number(item.qtd_faturada) || 0;
                                                const saldo    = Number(item.saldo_faturar) || 0;
                                                const itemPct  = qtdTotal > 0 ? Math.min(100, Math.round((qtdFat / qtdTotal) * 100)) : 0;

                                                return (
                                                    <tr
                                                        key={`${item.pedido}-${item.item}-${idx}`}
                                                        className="border-b border-slate-100 transition-colors text-xs hover:bg-amber-50/30 bg-white"
                                                    >
                                                        <td className="px-3 py-2.5 font-mono font-bold text-slate-900 whitespace-nowrap">{item.pedido}</td>
                                                        <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{dataEmissaoFmt}</td>
                                                        <td className="px-3 py-2.5 font-medium text-slate-700 max-w-[150px] truncate" title={item.nome_cliente}>{item.nome_cliente || '—'}</td>
                                                        <td className="px-3 py-2.5 font-mono text-slate-600 max-w-[110px] truncate" title={item.ped_cliente}>{item.ped_cliente || '—'}</td>
                                                        <td className="px-3 py-2.5 font-mono text-slate-600 max-w-[110px] truncate" title={item.ref_cliente}>{item.ref_cliente || '—'}</td>
                                                        <td className="px-3 py-2.5 font-mono text-center text-slate-700">{item.item}</td>
                                                        <td className="px-3 py-2.5 font-mono font-bold text-blue-700 whitespace-nowrap">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenDrawing(item.desenho_url, item.produto)}
                                                                className="hover:underline inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 text-left font-bold"
                                                                title="Clique para abrir o desenho em PDF"
                                                            >
                                                                <span>{item.produto}</span>
                                                                <FileText className="w-3.5 h-3.5 text-red-500 hover:text-red-700 transition-colors flex-shrink-0" />
                                                            </button>
                                                        </td>
                                                        <td className="px-3 py-2.5 text-slate-600 max-w-[200px] truncate" title={item.desc_produto}>{item.desc_produto || '—'}</td>
                                                        <td className="px-3 py-2.5 text-right font-bold text-slate-800 whitespace-nowrap">
                                                            {fmtQtd(qtdTotal)} <span className="text-[10px] text-slate-400 font-normal">{item.unidade}</span>
                                                        </td>
                                                        <td className="px-3 py-2.5 text-right font-semibold text-emerald-700 whitespace-nowrap">{fmtQtd(qtdFat)}</td>
                                                        <td className="px-3 py-2.5 text-right font-extrabold text-amber-800 whitespace-nowrap">
                                                            <span className="bg-amber-100/70 border border-amber-200/80 px-2 py-0.5 rounded-md">{fmtQtd(saldo)}</span>
                                                        </td>
                                                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                                            <div className="flex flex-col items-center gap-0.5 min-w-[70px]">
                                                                <span className={`text-[11px] font-bold ${itemPct >= 100 ? 'text-emerald-600' : itemPct > 0 ? 'text-blue-600' : 'text-slate-500'}`}>{itemPct}%</span>
                                                                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                                                    <div
                                                                        className={`h-full transition-all duration-500 ${
                                                                            itemPct >= 100 ? 'bg-emerald-500' : itemPct > 50 ? 'bg-blue-500' : itemPct > 0 ? 'bg-amber-500' : 'bg-slate-300'
                                                                        }`}
                                                                        style={{ width: `${Math.max(itemPct > 0 ? 5 : 0, itemPct)}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2.5 text-center font-medium text-purple-700 whitespace-nowrap">{item.data_pcp || '—'}</td>
                                                        <td className="px-3 py-2.5 text-right font-semibold text-purple-800 whitespace-nowrap">{item.qtd_pcp > 0 ? fmtQtd(item.qtd_pcp) : '—'}</td>
                                                        <td className="px-3 py-2.5 text-center font-medium text-blue-800 whitespace-nowrap">{dataEntregaFmt}</td>
                                                        <td className="px-3 py-2.5 text-center whitespace-nowrap"><StatusBadge status={item.status} /></td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            )
                        )}
                        
                        {/* Load More Button / Batch Loading Indicator */}
                        {hasMore && !loading && !error && (
                            <div className="flex flex-col items-center justify-center p-4 border-t border-slate-100 gap-1.5">
                                <button
                                    onClick={() => fetchData(page + 1, true)}
                                    disabled={loadingMore}
                                    className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-sm transition-all disabled:opacity-60"
                                >
                                    {loadingMore ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                    Carregar mais itens
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {!loading && !error && items.length > 0 && (
                        tab === 'saldo' ? (
                            <div className="px-4 py-2.5 border-t border-amber-200 bg-amber-50/50 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-700">
                                <span className="font-semibold text-amber-900">Resumo Saldo a Faturar:</span>
                                <span><strong className="text-amber-900">{kpisSaldo.totalItens}</strong> itens pendentes</span>
                                <span>·</span>
                                <span><strong className="text-slate-800">{fmtQtd(kpisSaldo.qtdTotal)}</strong> un. vendidas</span>
                                <span>·</span>
                                <span><strong className="text-emerald-700">{fmtQtd(kpisSaldo.qtdFat)}</strong> un. faturadas ({kpisSaldo.pctConcluido}%)</span>
                                <span>·</span>
                                <span><strong className="text-amber-800 font-extrabold">{fmtQtd(kpisSaldo.saldoTotal)}</strong> un. SALDO RESTANTE</span>
                            </div>
                        ) : (
                            <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                                <span><strong className="text-slate-700">{kpis.total}</strong> itens</span>
                                <span>·</span>
                                <span><strong className="text-slate-700">{fmtQtd(kpis.qtdTotal)}</strong> un. vendidas</span>
                                <span>·</span>
                                <span><strong className="text-emerald-700">{fmtQtd(kpis.qtdFat)}</strong> un. faturadas</span>
                                <span>·</span>
                                <span><strong className="text-amber-700">{fmtQtd(kpis.qtdTotal - kpis.qtdFat)}</strong> un. saldo</span>
                            </div>
                        )
                    )}
                </div>
            </div>
            
            {/* Modal / Landing Page para Perfil Cliente */}
            {showLandingModal && (
                <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto relative">
                        
                        {/* Header Banner */}
                        <div className="relative bg-gradient-to-r from-[#1E2825] via-[#24312D] to-[#32423D] text-white p-6 sm:p-8 flex flex-col justify-between overflow-hidden border-b border-[#425750]/40">
                            <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
                                <Factory className="w-80 h-80 text-white" />
                            </div>
                            
                            <div className="flex items-center justify-between z-10 mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="px-3 py-1.5 bg-blue-500/20 backdrop-blur-md rounded-xl border border-blue-400/30 flex items-center gap-2">
                                        <ShieldCheck className="w-4 h-4 text-blue-400" />
                                        <span className="text-xs font-bold tracking-wider uppercase text-blue-200">Portal Exclusivo do Cliente</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        sessionStorage.setItem('@Lynx:landingSeen', 'true');
                                        setShowLandingModal(false);
                                    }}
                                    className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                                    title="Fechar e ir para os pedidos"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="z-10 space-y-2">
                                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
                                    LYNX METALÚRGICA
                                </h2>
                                <p className="text-sm sm:text-base text-blue-200 font-medium max-w-2xl">
                                    Excelência em Conformação Metálica, Corte a Laser de Alta Precisão e Tecnologia Industrial de Ponta.
                                </p>
                            </div>
                        </div>

                        {/* Scrollable Body Content */}
                        <div className="p-6 sm:p-8 overflow-y-auto space-y-8 bg-slate-50/50">

                            {/* Sobre a Lynx */}
                            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                                <div className="flex items-center gap-2.5 text-slate-900 font-bold text-base">
                                    <Sparkles className="w-5 h-5 text-blue-600" />
                                    <h3>Tradição, Inovação e Qualidade Sem Concorrência</h3>
                                </div>
                                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                                    Com vasta experiência no mercado de transformação de aços e metais, a <strong>Lynx Metalúrgica</strong> combina 
                                    tecnologia fabril automatizada com rigorosas diretrizes de engenharia. Atendemos aos mais exigentes 
                                    segmentos industriais com soluções customizadas de alto desempenho.
                                </p>
                            </div>

                            {/* Soluções e Capacidades */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2.5">
                                    <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl w-fit border border-blue-100">
                                        <Zap className="w-5 h-5" />
                                    </div>
                                    <h4 className="font-bold text-slate-900 text-sm">Corte a Laser & Dobra CNC</h4>
                                    <p className="text-xs text-slate-500 leading-relaxed">
                                        Corte de alta precisão em aços carbono, inox e alumínio com dobradeiras CNC de grande porte.
                                    </p>
                                </div>

                                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2.5">
                                    <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl w-fit border border-emerald-100">
                                        <Factory className="w-5 h-5" />
                                    </div>
                                    <h4 className="font-bold text-slate-900 text-sm">Caldeiraria & Solda</h4>
                                    <p className="text-xs text-slate-500 leading-relaxed">
                                        Processos MIG, TIG e solda automatizada para montagem de conjuntos estruturais certificados.
                                    </p>
                                </div>

                                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2.5">
                                    <div className="p-2.5 bg-purple-50 text-purple-700 rounded-xl w-fit border border-purple-100">
                                        <CheckCircle className="w-5 h-5" />
                                    </div>
                                    <h4 className="font-bold text-slate-900 text-sm">Rastreabilidade Total</h4>
                                    <p className="text-xs text-slate-500 leading-relaxed">
                                        Acompanhamento online de saldo a faturar, notas fiscais emitidas e folhas de desenhos em PDF.
                                    </p>
                                </div>
                            </div>

                            {/* Banner de Acesso ao Site Oficial */}
                            <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 border border-blue-800/40">
                                <div className="space-y-1 text-center sm:text-left">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Website Institucional</span>
                                    <h4 className="font-bold text-base text-white">Conheça Nossos Serviços e Portfólio Completo</h4>
                                    <p className="text-xs text-slate-300">Acesse nosso site oficial e veja todos os detalhes de nossa infraestrutura fabril.</p>
                                </div>
                                <a
                                    href="https://lynxems.com.br/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all shadow-md whitespace-nowrap cursor-pointer hover:scale-105"
                                >
                                    <span>Visitar lynxems.com.br</span>
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                            </div>

                        </div>

                        {/* Footer Actions */}
                        <div className="p-4 sm:p-6 bg-slate-100 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <Globe className="w-4 h-4 text-blue-600" />
                                <span>https://lynxems.com.br/ · Soluções Industriais</span>
                            </div>
                            <button
                                onClick={() => {
                                    sessionStorage.setItem('@Lynx:landingSeen', 'true');
                                    setShowLandingModal(false);
                                }}
                                className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                            >
                                <span>Acessar Meus Pedidos & Faturamento</span>
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
};

export default PortalCliente;
