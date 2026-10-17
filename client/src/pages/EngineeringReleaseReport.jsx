import React, { useState, useEffect, useMemo } from 'react';
import api, { getFileUrl } from '../services/api';
import { 
    ClipboardList, Search, Calendar, User, Package, 
    Download, Mail, Filter, Loader2, AlertCircle, 
    Inbox, Factory, ChevronDown, ChevronRight, Layers, FileText, Scissors, FileSpreadsheet, Trash2,
    Printer, FileDown, ExternalLink, Lock, CheckCircle2, ShieldAlert
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { generateSingleRNCPdf } from '../services/rncPdfGenerator';
import RNCSendEmailModal from '../components/RNCSendEmailModal';
import CorteReleaseTab from '../components/CorteReleaseTab';
import ReportStructureModal from '../components/ReportStructureModal';
import CorteForecastModal from '../components/CorteForecastModal';


// ─── Aba Engenharia ───────────────────────────────────────────────────────────
const EngineeringTab = () => {
    const [releases, setReleases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ startDate: '', endDate: '', product: '', user: '', pedido: '', item: '' });
    const [structureCode, setStructureCode] = useState(null);

    const fetchReleases = async (params = filters) => {
        setLoading(true);
        try {
            const { data } = await api.get('/engineering-releases', { params });
            setReleases(data);
        } catch {
            toast.error('Falha ao carregar liberações de engenharia.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchReleases(); }, []);

    const handleChange = e => setFilters(p => ({ ...p, [e.target.name]: e.target.value }));
    const clearFilters = () => { const c = { startDate:'',endDate:'',product:'',user:'',pedido:'',item:'' }; setFilters(c); fetchReleases(c); };

    const formatDate = dateStr => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleString('pt-BR', { day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit' });
    };

    const handleExportExcel = () => {
        import('xlsx').then(XLSX => {
            const data = releases.map(r => ({
                'Produto': r.codigo_produto,
                'Descrição do Produto': r.descricao_produto,
                'Cód. Liberação': r.codigo_liberacao || '-',
                'Ação': r.tipo_acao,
                'Data': formatDate(r.data_hora),
                'Pedido': r.pedido || '-',
                'Item': r.item || '-',
                'Usuário': r.usuario,
                'Modo': r.modo === 'FULL' ? 'COMPLETO' : 'NÍVEL 1',
                'Destinatários': r.destinatarios || '-'
            }));
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Liberações");
            XLSX.writeFile(wb, `Relatorio_Liberacoes_${new Date().getTime()}.xlsx`);
        });
    };

    const handleExportPdf = () => {
        Promise.all([
            import('jspdf'),
            import('jspdf-autotable')
        ]).then(([jsPDFLib, autoTableModule]) => {
            const jsPDF = jsPDFLib.jsPDF || jsPDFLib.default;
            const autoTable = autoTableModule.default;
            const doc = new jsPDF('landscape', 'mm', 'a4');
            
            const drawHeader = () => {
                const pageWidth = doc.internal.pageSize.getWidth();
                const ML = 10;
                const MR = 10;
                const usableW = pageWidth - ML - MR;
                const hY = 8;
                const hH = 16;
                
                doc.setDrawColor(0);
                doc.setLineWidth(0.3);
                doc.rect(ML, hY, usableW, hH);

                const col1 = ML + 52;
                const col2 = ML + 165;
                const col3 = ML + 222;
                doc.setLineWidth(0.2);
                [col1, col2, col3].forEach(x => doc.line(x, hY, x, hY + hH));

                // Logo
                doc.setFontSize(13);
                doc.setFont('helvetica', 'bold');
                doc.text('LYNX', ML + 4, hY + 6);
                doc.setFontSize(5.5);
                doc.setFont('helvetica', 'normal');
                doc.text('Transformando metais em excelência', ML + 4, hY + 10);

                // Company
                doc.setFontSize(7.5);
                doc.setFont('helvetica', 'bold');
                doc.text('LYNX EMS SISTEMAS LTDA', col1 + 3, hY + 5.5);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(6.5);
                doc.text('CNPJ: 23.881.592/0001-01', col1 + 3, hY + 9.5);
                doc.text('PCP - Planejamento e Controle de Produção', col1 + 3, hY + 13.5);

                // Emission
                doc.setFontSize(6.5);
                doc.setFont('helvetica', 'bold');
                doc.text('EMISSÃO:', col2 + 3, hY + 5.5);
                doc.setFont('helvetica', 'normal');
                
                const now = new Date();
                const emissionDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
                doc.text(emissionDate, col2 + 20, hY + 5.5);

                // Title
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.text('RELATÓRIO DE LIBERAÇÕES DE ENGENHARIA', col3 + (usableW - (col3 - ML)) / 2, hY + 5.5, { align: 'center' });
                doc.setFontSize(8);
                doc.text(`Total: ${releases.length} registros`, col3 + (usableW - (col3 - ML)) / 2, hY + 10.5, { align: 'center' });
                
                return hY + hH + 4;
            };

            const startY = drawHeader();
            
            const tableData = releases.map(r => [
                r.codigo_liberacao || '-',
                r.codigo_produto,
                r.tipo_acao,
                formatDate(r.data_hora),
                r.pedido || '-',
                r.usuario,
                r.modo === 'FULL' ? 'COMPLETO' : 'NÍVEL 1'
            ]);

            autoTable(doc, {
                startY,
                head: [['Cód. Lib.', 'Produto', 'Ação', 'Data', 'Pedido', 'Usuário', 'Modo']],
                body: tableData,
                styles: { fontSize: 7, font: 'helvetica' },
                headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [245, 247, 250] },
                margin: { left: 10, right: 10 },
                didDrawPage: (data) => {
                    if (data.pageNumber > 1) {
                        drawHeader();
                    }
                    const str = 'Página ' + doc.internal.getNumberOfPages();
                    doc.setFontSize(6);
                    doc.text(str, data.settings.margin.left, doc.internal.pageSize.height - 5);
                }
            });

            doc.save(`Relatorio_Liberacoes_${new Date().getTime()}.pdf`);
        });
    };

    const groupedReleases = useMemo(() => {
        const ObjectGroups = {};
        releases.forEach(r => {
            const key = r.codigo_produto || 'SEM_PRODUTO';
            if (!ObjectGroups[key]) ObjectGroups[key] = { codigo_produto: key, descricao_produto: r.descricao_produto, items: [] };
            ObjectGroups[key].items.push(r);
        });
        return Object.values(ObjectGroups);
    }, [releases]);

    return (
        <div className="space-y-5">
            {/* Filtros */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-red-600" />
                    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Filtros</h2>
                    <span className="ml-auto text-xs text-slate-400 font-medium">{releases.length} registros</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                        { name:'product', label:'Cód. Produto', icon: Package, placeholder:'Código...' },
                        { name:'pedido',  label:'Pedido',       icon: ClipboardList, placeholder:'Nº pedido...' },
                        { name:'item',    label:'Item',         icon: Search, placeholder:'Item...' },
                        { name:'user',    label:'Usuário',      icon: User, placeholder:'Nome...' },
                    ].map(f => (
                        <div key={f.name} className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">{f.label}</label>
                            <div className="relative">
                                <f.icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input type="text" name={f.name} placeholder={f.placeholder} value={filters[f.name]}
                                    onChange={handleChange}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-red-500 outline-none" />
                            </div>
                        </div>
                    ))}
                    {['startDate','endDate'].map((n,i) => (
                        <div key={n} className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">{i===0?'De':'Até'}</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input type="date" name={n} value={filters[n]} onChange={handleChange}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-red-500 outline-none" />
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex justify-between items-center gap-3 pt-1">
                    <div className="flex gap-2">
                        <button onClick={handleExportExcel} disabled={releases.length === 0} className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-semibold hover:bg-green-700 rounded-xl transition-all shadow-sm disabled:opacity-50">
                            <FileSpreadsheet className="w-4 h-4" /> Excel
                        </button>
                        <button onClick={handleExportPdf} disabled={releases.length === 0} className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-semibold hover:bg-red-700 rounded-xl transition-all shadow-sm disabled:opacity-50">
                            <FileText className="w-4 h-4" /> PDF
                        </button>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={clearFilters} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-all">Limpar</button>
                        <button onClick={() => fetchReleases()} className="flex items-center gap-2 px-5 py-2 bg-red-600 text-white rounded-xl text-sm font-bold shadow shadow-red-200 hover:bg-red-700 transition-all">
                            <Search className="w-4 h-4" /> Aplicar
                        </button>
                    </div>
                </div>
            </div>

            {/* Tabela */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)]">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-10 shadow-sm">
                            <tr className="bg-slate-50 border-b border-slate-100">
                                {['Cód. Lib.','Ação / Data','Pedido / Item','Usuário','Detalhes'].map(h => (
                                    <th key={h} className="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr><td colSpan={5} className="py-16 text-center"><Loader2 className="w-8 h-8 text-red-500 animate-spin mx-auto" /></td></tr>
                            ) : groupedReleases.length === 0 ? (
                                <tr><td colSpan={5} className="py-16 text-center text-slate-400 text-sm"><Inbox className="w-8 h-8 mx-auto mb-2 opacity-30" />Nenhum registro encontrado.</td></tr>
                            ) : groupedReleases.map(group => (
                                <React.Fragment key={group.codigo_produto}>
                                    <tr className="bg-red-50/50 border-t border-b border-red-100">
                                        <td colSpan={5} className="px-5 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="p-1.5 bg-red-100 rounded-lg"><Package className="w-4 h-4 text-red-600" /></div>
                                                <div>
                                                    <h3 className="text-sm font-bold text-slate-800 font-mono">{group.codigo_produto}</h3>
                                                    <p className="text-[11px] text-slate-500">{group.descricao_produto}</p>
                                                </div>
                                                <div className="ml-auto flex items-center gap-3">
                                                    <button 
                                                        onClick={() => setStructureCode(group.codigo_produto)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-200 text-red-600 rounded-lg text-[11px] font-bold hover:bg-red-50 transition-colors shadow-sm"
                                                    >
                                                        <Layers className="w-3.5 h-3.5" />
                                                        Ver Estrutura
                                                    </button>
                                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">
                                                        {group.items.length} registro(s)
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                    {group.items.map(r => (
                                        <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="px-5 py-4 pl-8">
                                                {r.codigo_liberacao
                                                    ? <span className="text-xs font-bold font-mono px-2 py-1 bg-red-100 text-red-800 border border-red-200 rounded-lg tracking-wider">{r.codigo_liberacao}</span>
                                                    : <span className="text-xs text-slate-300 italic">—</span>}
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className={`p-1.5 rounded-lg ${r.tipo_acao==='EMAIL'?'bg-blue-50 text-blue-500':'bg-orange-50 text-orange-500'}`}>
                                                        {r.tipo_acao==='EMAIL'?<Mail className="w-3.5 h-3.5"/>:<Download className="w-3.5 h-3.5"/>}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-700">{r.tipo_acao==='EMAIL'?'E-mail':'PDF'}</p>
                                                        <p className="text-[11px] text-slate-400">{formatDate(r.data_hora)}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                {r.pedido ? <div className="flex gap-1.5 flex-wrap">
                                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[11px] font-bold font-mono">PED: {r.pedido}</span>
                                                    {r.item && <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[11px] font-bold font-mono">ITEM: {r.item}</span>}
                                                </div> : <span className="text-xs text-slate-300">—</span>}
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center text-[10px] font-bold border border-indigo-100">
                                                        {r.usuario?.substring(0,2).toUpperCase()}
                                                    </div>
                                                    <span className="text-sm font-semibold text-slate-600">{r.usuario}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div>
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${r.modo==='FULL'?'bg-cyan-50 text-cyan-600 border border-cyan-100':'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                                                            {r.modo==='FULL'?'COMPLETO':'NÍVEL 1'}
                                                        </span>
                                                        {r.destinatarios && <p className="text-[10px] text-slate-400 mt-1 truncate max-w-[220px]">Para: {r.destinatarios}</p>}
                                                    </div>
                                                    {r.caminho_arquivo && (
                                                        <button
                                                            onClick={() => window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(r.caminho_arquivo)}`), '_blank')}
                                                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors border border-red-100 ml-auto"
                                                            title="Abrir PDF salvo na rede"
                                                        >
                                                            <FileText className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <ReportStructureModal 
                isOpen={!!structureCode} 
                onClose={() => setStructureCode(null)} 
                codigo={structureCode} 
            />
        </div>
    );
};

// ─── Aba PCP / Lote ───────────────────────────────────────────────────────────
const PCPTab = () => {
    const { user } = useAuth();
    const [releases, setReleases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(new Set());
    const [filters, setFilters] = useState({ startDate:'',endDate:'',lote:'',usuario:'',pedido:'',produto:'',codigo:'' });
    const [structureCode, setStructureCode] = useState(null);

    // Estados para Plano de Corte e Liberação Irreversível
    const [corteForecastTarget, setCorteForecastTarget] = useState(null);
    const [corteLpfCode, setCorteLpfCode] = useState(null);
    const [liberateTarget, setLiberateTarget] = useState(null);
    const [liberating, setLiberating] = useState(false);

    const fetchReleases = async (params = filters) => {
        setLoading(true);
        try {
            const { data } = await api.get('/pcp-releases', { params });
            setReleases(data);
        } catch {
            toast.error('Falha ao carregar liberações PCP.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchReleases(); }, []);

    const handleChange = e => setFilters(p => ({ ...p, [e.target.name]: e.target.value }));
    const clearFilters = () => { const c = {startDate:'',endDate:'',lote:'',usuario:'',pedido:'',produto:'',codigo:''}; setFilters(c); fetchReleases(c); };
    const toggleExpand = id => setExpanded(prev => { const n = new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });

    const formatDate = dateStr => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleString('pt-BR', { day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit' });
    };

    const handleOpenCorteModal = (r, e) => {
        if (e) e.stopPropagation();
        if (!r.ops || r.ops.length === 0) {
            toast.warning('Nenhuma OP cadastrada neste lote.');
            return;
        }
        const formattedItems = r.ops.map(op => ({
            pedido: op.pedido,
            item: op.item,
            codigo: op.codigo || op.produto || op.cod_produto,
            descricao: op.descricao || op.desc_produto,
            quantidade: op.qtd || op.visual_qtd || op.quantidade_pcp || 0,
            qtd_faturar: op.qtd || op.visual_qtd || op.quantidade_pcp || 0,
            op_num: op.visual_op || op.op_num || `${op.pedido}${op.item}`,
            cliente: op.nome_cliente || op.cliente
        }));
        setCorteForecastTarget(formattedItems);
        setCorteLpfCode(r.codigo_liberacao || r.codigo_lote || r.lote_info);
    };

    const handleConfirmLiberarLote = async () => {
        if (!liberateTarget) return;
        setLiberating(true);
        try {
            const code = liberateTarget.codigo_liberacao || liberateTarget.codigo_lote || liberateTarget.id;
            const res = await api.post('/pcp-releases/liberar', {
                id: liberateTarget.id,
                codigo_liberacao: liberateTarget.codigo_liberacao,
                lote_info: liberateTarget.lote_info,
                usuario: user?.nome || 'PCP'
            });
            if (res.data?.success) {
                toast.success(`Lote ${code} LIBERADO para fabricação com sucesso!`);
                setLiberateTarget(null);
                fetchReleases();
            }
        } catch (err) {
            console.error('Erro ao liberar lote:', err);
            toast.error(err.response?.data?.error || 'Erro ao liberar lote.');
        } finally {
            setLiberating(false);
        }
    };

    const handleExportExcel = () => {
        import('xlsx').then(XLSX => {
            const data = releases.map(r => ({
                'Lote': r.codigo_lote,
                'Ação': r.tipo_acao,
                'Data': formatDate(r.data_hora),
                'Pedido': r.pedido || '-',
                'Usuário': r.usuario,
                'Produto': r.codigo_produto || '-',
                'Destinatários': r.destinatarios || '-'
            }));
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "PCP");
            XLSX.writeFile(wb, `Relatorio_PCP_${new Date().getTime()}.xlsx`);
        });
    };

    const handleExportPdf = () => {
        Promise.all([
            import('jspdf'),
            import('jspdf-autotable')
        ]).then(([jsPDFLib, autoTableModule]) => {
            const jsPDF = jsPDFLib.jsPDF || jsPDFLib.default;
            const autoTable = autoTableModule.default;
            const doc = new jsPDF('landscape', 'mm', 'a4');
            
            const drawHeader = () => {
                const pageWidth = doc.internal.pageSize.getWidth();
                const ML = 10;
                const MR = 10;
                const usableW = pageWidth - ML - MR;
                const hY = 8;
                const hH = 16;
                
                doc.setDrawColor(0);
                doc.setLineWidth(0.3);
                doc.rect(ML, hY, usableW, hH);

                const col1 = ML + 52;
                const col2 = ML + 165;
                const col3 = ML + 222;
                doc.setLineWidth(0.2);
                [col1, col2, col3].forEach(x => doc.line(x, hY, x, hY + hH));

                // Logo
                doc.setFontSize(13);
                doc.setFont('helvetica', 'bold');
                doc.text('LYNX', ML + 4, hY + 6);
                doc.setFontSize(5.5);
                doc.setFont('helvetica', 'normal');
                doc.text('Transformando metais em excelência', ML + 4, hY + 10);

                // Company
                doc.setFontSize(7.5);
                doc.setFont('helvetica', 'bold');
                doc.text('LYNX EMS SISTEMAS LTDA', col1 + 3, hY + 5.5);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(6.5);
                doc.text('CNPJ: 23.881.592/0001-01', col1 + 3, hY + 9.5);
                doc.text('PCP - Planejamento e Controle de Produção', col1 + 3, hY + 13.5);

                // Emission
                doc.setFontSize(6.5);
                doc.setFont('helvetica', 'bold');
                doc.text('EMISSÃO:', col2 + 3, hY + 5.5);
                doc.setFont('helvetica', 'normal');
                
                const now = new Date();
                const emissionDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
                doc.text(emissionDate, col2 + 20, hY + 5.5);

                // Title
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.text('RELATÓRIO DE LIBERAÇÕES PCP', col3 + (usableW - (col3 - ML)) / 2, hY + 5.5, { align: 'center' });
                doc.setFontSize(8);
                doc.text(`Total: ${releases.length} registros`, col3 + (usableW - (col3 - ML)) / 2, hY + 10.5, { align: 'center' });
                
                return hY + hH + 4;
            };

            const startY = drawHeader();
            
            const tableData = releases.map(r => [
                r.codigo_lote,
                r.tipo_acao,
                formatDate(r.data_hora),
                r.pedido || '-',
                r.usuario,
                r.codigo_produto || '-'
            ]);

            autoTable(doc, {
                startY,
                head: [['Lote', 'Ação', 'Data', 'Pedido', 'Usuário', 'Produto']],
                body: tableData,
                styles: { fontSize: 7, font: 'helvetica' },
                headStyles: { fillColor: [22, 163, 74], textColor: 255, fontStyle: 'bold' }, // Green
                alternateRowStyles: { fillColor: [245, 247, 250] },
                margin: { left: 10, right: 10 },
                didDrawPage: (data) => {
                    if (data.pageNumber > 1) {
                        drawHeader();
                    }
                    const str = 'Página ' + doc.internal.getNumberOfPages();
                    doc.setFontSize(6);
                    doc.text(str, data.settings.margin.left, doc.internal.pageSize.height - 5);
                }
            });

            doc.save(`Relatorio_PCP_${new Date().getTime()}.pdf`);
        });
    };

    const [generatingLotCode, setGeneratingLotCode] = useState(null);
    const [generatingExcelCode, setGeneratingExcelCode] = useState(null);

    const handleGenerateLotPdf = async (r, e) => {
        if (e) e.stopPropagation();
        const code = r.codigo_liberacao || r.codigo_lote || r.lote_info;
        if (!r.ops || r.ops.length === 0) {
            toast.warning('Nenhuma OP / peça cadastrada neste lote.');
            return;
        }

        setGeneratingLotCode(code);
        toast.info(`Gerando Pacote PDF com desenhos e roteiros para o lote ${code}...`);

        try {
            const { generateLoteWithDrawingsPdf } = await import('../services/loteWithDrawingsPdfGenerator');
            
            // Format targets matching generateLoteWithDrawingsPdf requirements
            const targets = r.ops.map(op => ({
                pedido: op.pedido,
                item: op.item,
                visual_op: op.visual_op || op.op_num || `${op.pedido}${op.item}`,
                op_num: op.visual_op || op.op_num || `${op.pedido}${op.item}`,
                visual_qtd: op.qtd || op.visual_qtd || op.quantidade_pcp,
                qtd_faturar: op.qtd || op.visual_qtd || op.quantidade_pcp,
                quantidade: op.qtd || op.visual_qtd || op.quantidade_pcp,
                nome_cliente: op.nome_cliente || op.cliente || '—',
                cod_produto: op.codigo || op.produto || op.cod_produto,
                codigo: op.codigo || op.produto || op.cod_produto,
                descricao: op.descricao || op.desc_produto || '',
                data_entrega_pcp: op.data_entrega_pcp || op.entrega || r.data_pcp,
                lote: code,
                raw_numero_lote: code,
                data_pcp: r.data_pcp
            }));

            const pdfBytes = await generateLoteWithDrawingsPdf(targets, r.usuario || 'PCP', code);
            if (pdfBytes) {
                const fileName = `${code}_PACOTE_OPS_DESENHOS_ROTEIROS.pdf`;
                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                toast.success(`Pacote PDF do lote ${code} gerado com sucesso!`);
            }
        } catch (err) {
            console.error('Erro ao gerar Pacote PDF do lote:', err);
            toast.error(err.message || 'Erro ao gerar Pacote PDF.');
        } finally {
            setGeneratingLotCode(null);
        }
    };

    const handleGenerateLotExcel = async (r, e) => {
        if (e) e.stopPropagation();
        const code = r.codigo_liberacao || r.codigo_lote || r.lote_info;
        if (!r.ops || r.ops.length === 0) {
            toast.warning('Nenhuma OP / peça cadastrada neste lote.');
            return;
        }

        setGeneratingExcelCode(code);
        toast.info(`Gerando Excel com estruturas completas e roteiros para o lote ${code}...`);

        try {
            const { generateLoteExcel } = await import('../services/loteExcelGenerator');
            await generateLoteExcel(r);
            toast.success(`Planilha Excel completa do lote ${code} gerada com sucesso!`);
        } catch (err) {
            console.error('Erro ao gerar Excel do lote:', err);
            toast.error(err.message || 'Erro ao gerar Excel do lote.');
        } finally {
            setGeneratingExcelCode(null);
        }
    };

    const handleDeleteRelease = async (r, e) => {
        if (e) e.stopPropagation();
        const code = r.codigo_liberacao || r.codigo_lote || r.id;
        if (!window.confirm(`Deseja realmente excluir a liberação do lote ${code}? Os itens voltarão a ficar disponíveis no PCP.`)) {
            return;
        }

        try {
            await api.delete(`/pcp-releases/${encodeURIComponent(code)}`);
            toast.success(`Liberação do lote ${code} excluída com sucesso!`);
            fetchReleases();
        } catch (err) {
            console.error('Erro ao excluir liberação:', err);
            toast.error(err.response?.data?.error || 'Erro ao excluir liberação.');
        }
    };

    return (
        <div className="space-y-6">
            {/* Filtros */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[
                        { label: 'Data Início', name: 'startDate', type: 'date' },
                        { label: 'Data Fim', name: 'endDate', type: 'date' },
                        { label: 'Cód. Liberação / Lote', name: 'codigo', placeholder: 'Ex: LPF-2026-00001' },
                        { label: 'Usuário', name: 'usuario', placeholder: 'Filtrar por usuário' },
                    ].map(f => (
                        <div key={f.name}>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{f.label}</label>
                            <input
                                type={f.type || 'text'}
                                name={f.name}
                                value={filters[f.name]}
                                onChange={handleChange}
                                placeholder={f.placeholder}
                                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                            />
                        </div>
                    ))}
                </div>
                <div className="flex justify-between items-center gap-3 pt-1">
                    <div className="flex gap-2">
                        <button onClick={handleExportExcel} disabled={releases.length === 0} className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-semibold hover:bg-green-700 rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer">
                            <FileSpreadsheet className="w-4 h-4" /> Excel
                        </button>
                        <button onClick={handleExportPdf} disabled={releases.length === 0} className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-semibold hover:bg-red-700 rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer">
                            <FileText className="w-4 h-4" /> PDF
                        </button>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={clearFilters} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-all cursor-pointer">Limpar</button>
                        <button onClick={() => fetchReleases()} className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-xl text-sm font-bold shadow shadow-green-200 hover:bg-green-700 transition-all cursor-pointer">
                            <Search className="w-4 h-4" /> Aplicar
                        </button>
                    </div>
                </div>
            </div>

            {/* Tabela */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)]">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
                            <tr className="bg-slate-50 border-b border-slate-100">
                                {['','Cód. Liberação','Status','Data / Hora','Lote (OPs)','Data PCP','Usuário','Qtd. Peças / OPs','Ações'].map((h,i) => (
                                    <th key={i} className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={9} className="py-16 text-center"><Loader2 className="w-8 h-8 text-green-500 animate-spin mx-auto" /></td></tr>
                            ) : releases.length === 0 ? (
                                <tr><td colSpan={9} className="py-16 text-center text-slate-400 text-sm"><Inbox className="w-8 h-8 mx-auto mb-2 opacity-30" />Nenhuma liberação PCP registrada.</td></tr>
                            ) : releases.map(r => (
                                <React.Fragment key={r.id || r.codigo_liberacao || r.codigo_lote}>
                                    <tr className="hover:bg-slate-50/70 transition-colors cursor-pointer" onClick={() => toggleExpand(r.id || r.codigo_liberacao || r.codigo_lote)}>
                                        <td className="px-3 py-4 w-8 text-center">
                                            {expanded.has(r.id || r.codigo_liberacao || r.codigo_lote)
                                                ? <ChevronDown className="w-4 h-4 text-slate-500" />
                                                : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold font-mono px-2.5 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg tracking-wider shadow-2xs">
                                                    {r.codigo_liberacao || r.codigo_lote || 'LPF'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            {r.status === 'LIBERADO' ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-full text-[10px] font-bold shadow-2xs" title={r.data_liberacao ? `Liberado em: ${formatDate(r.data_liberacao)} por ${r.usuario_liberacao || 'PCP'}` : 'Liberado para produção'}>
                                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                                    LIBERADO P/ FABRICAÇÃO
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-300 rounded-full text-[10px] font-bold">
                                                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                                                    ABERTO / AGUARDANDO
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
                                                    <Factory className="w-3.5 h-3.5" />
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">LOTE PCP</span>
                                                    <p className="text-[11px] text-slate-500 mt-0.5">{formatDate(r.data_hora)}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 max-w-[280px]">
                                            <p className="text-xs font-bold text-slate-800 font-mono truncate" title={r.lote_info || r.observacao}>
                                                {r.lote_info || r.observacao || 'Lote Aglutinado PCP'}
                                            </p>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="text-xs font-semibold text-slate-700">{r.data_pcp || '—'}</span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 bg-emerald-50 text-emerald-700 rounded-full flex items-center justify-center text-[10px] font-bold border border-emerald-200">
                                                    {r.usuario?.substring(0,2).toUpperCase()}
                                                </div>
                                                <span className="text-xs font-semibold text-slate-700">{r.usuario}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-full text-xs font-bold border border-slate-200">
                                                {r.qtd_ops || (r.ops ? r.ops.length : 0)} OP(s)
                                            </span>
                                        </td>
                                        <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    onClick={(e) => handleGenerateLotPdf(r, e)}
                                                    disabled={generatingLotCode === (r.codigo_liberacao || r.codigo_lote)}
                                                    className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors border border-blue-200 cursor-pointer disabled:opacity-50"
                                                    title="Gerar Pacote PDF Completo (OPs + Desenhos + Roteiros)"
                                                >
                                                    {generatingLotCode === (r.codigo_liberacao || r.codigo_lote) ? (
                                                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                                                    ) : (
                                                        <Printer className="w-4 h-4" />
                                                    )}
                                                </button>

                                                <button
                                                    onClick={(e) => handleGenerateLotExcel(r, e)}
                                                    disabled={generatingExcelCode === (r.codigo_liberacao || r.codigo_lote)}
                                                    className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors border border-emerald-200 cursor-pointer disabled:opacity-50"
                                                    title="Gerar Excel do Lote (Resumo + Roteiros + BOM Somada)"
                                                >
                                                    {generatingExcelCode === (r.codigo_liberacao || r.codigo_lote) ? (
                                                        <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                                                    ) : (
                                                        <FileSpreadsheet className="w-4 h-4" />
                                                    )}
                                                </button>

                                                <button
                                                    onClick={(e) => handleOpenCorteModal(r, e)}
                                                    className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors border border-indigo-200 cursor-pointer"
                                                    title="Gerar Estratégia de Lotes / Plano de Corte"
                                                >
                                                    <Scissors className="w-4 h-4" />
                                                </button>

                                                {r.caminho_arquivo && (
                                                    <button
                                                        onClick={() => window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(r.caminho_arquivo)}`), '_blank')}
                                                        className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg transition-colors border border-slate-200 cursor-pointer"
                                                        title="Visualizar PDF Salvo na Rede"
                                                    >
                                                        <FileText className="w-4 h-4" />
                                                    </button>
                                                )}

                                                {r.status === 'LIBERADO' ? (
                                                    <span 
                                                        className="p-1.5 bg-slate-50 text-slate-400 rounded-lg border border-slate-200 cursor-not-allowed inline-flex items-center" 
                                                        title="Lote Liberado para Fabricação — Ação irreversível (Exclusão bloqueada)"
                                                    >
                                                        <Lock className="w-4 h-4 text-emerald-600" />
                                                    </span>
                                                ) : (
                                                    <button
                                                        onClick={(e) => handleDeleteRelease(r, e)}
                                                        className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg transition-colors border border-rose-200 cursor-pointer"
                                                        title="Excluir liberação e desmanchar lote"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                    {/* Expandable detail row */}
                                    {expanded.has(r.id || r.codigo_liberacao || r.codigo_lote) && r.ops && r.ops.length > 0 && (
                                        <tr>
                                            <td colSpan={9} className="px-6 py-4 bg-emerald-50/40 border-y border-emerald-100">
                                                <div className="rounded-xl border border-emerald-200 overflow-hidden shadow-2xs bg-white">
                                                    <div className="bg-emerald-100/70 px-4 py-2.5 text-xs font-bold text-emerald-950 flex flex-wrap items-center justify-between gap-3 border-b border-emerald-200">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-sm font-bold text-emerald-900">Peças e OPs Agrupadas neste Lote ({r.ops.length})</span>
                                                            <span className="text-[11px] px-2.5 py-0.5 bg-emerald-200 text-emerald-900 rounded-full font-semibold">
                                                                Total de peças: {r.ops.reduce((acc, o) => acc + parseFloat(o.qtd || o.visual_qtd || o.quantidade_pcp || 0), 0)} un
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => handleGenerateLotPdf(r, e)}
                                                                disabled={generatingLotCode === (r.codigo_liberacao || r.codigo_lote)}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                                                                title="Gerar e baixar PDF completo (OPs + Desenhos + Roteiros)"
                                                            >
                                                                {generatingLotCode === (r.codigo_liberacao || r.codigo_lote) ? (
                                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                ) : (
                                                                    <Printer className="w-3.5 h-3.5" />
                                                                )}
                                                                <span>Gerar PDF (OP + Desenhos + Roteiros)</span>
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={(e) => handleGenerateLotExcel(r, e)}
                                                                disabled={generatingExcelCode === (r.codigo_liberacao || r.codigo_lote)}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                                                                title="Gerar planilha Excel com Resumo, Roteiros, Operações e BOM Consolidada"
                                                            >
                                                                {generatingExcelCode === (r.codigo_liberacao || r.codigo_lote) ? (
                                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                ) : (
                                                                    <FileSpreadsheet className="w-3.5 h-3.5" />
                                                                )}
                                                                <span>Gerar Excel (Roteiro & Materiais)</span>
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={(e) => handleOpenCorteModal(r, e)}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
                                                                title="Abrir Estratégia de Lotes (Plano de Corte) com as OPs deste Lote"
                                                            >
                                                                <Scissors className="w-3.5 h-3.5" />
                                                                <span>Gerar Plano de Corte</span>
                                                            </button>

                                                            {r.status === 'LIBERADO' ? (
                                                                <div 
                                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold shadow-2xs"
                                                                    title="Lote Liberado para Fabricação — Irreversível"
                                                                >
                                                                    <Lock className="w-3.5 h-3.5 text-emerald-600" />
                                                                    <span>Liberado p/ Produção</span>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setLiberateTarget(r);
                                                                        }}
                                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
                                                                        title="Liberar peças aglutinadas para produção (ação irreversível)"
                                                                    >
                                                                        <Lock className="w-3.5 h-3.5" />
                                                                        <span>Liberar Peças Aglutinadas</span>
                                                                    </button>

                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => handleDeleteRelease(r, e)}
                                                                        className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                                                        title="Excluir liberação e desmanchar lote"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                        <span>Excluir</span>
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <table className="w-full text-left text-xs">
                                                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[10px] uppercase">
                                                            <tr>
                                                                <th className="px-3 py-2">Pedido</th>
                                                                <th className="px-3 py-2">Item</th>
                                                                <th className="px-3 py-2">OP / Fração</th>
                                                                <th className="px-3 py-2">Cód. Produto</th>
                                                                <th className="px-3 py-2">Descrição</th>
                                                                <th className="px-3 py-2 text-right">Qtd</th>
                                                                <th className="px-3 py-2">Cliente</th>
                                                                <th className="px-3 py-2">Data PCP</th>
                                                                <th className="px-3 py-2 text-center">Estrutura</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {r.ops.map((op, i) => (
                                                                <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                                    <td className="px-3 py-2 font-mono font-bold text-slate-800">{op.pedido}</td>
                                                                    <td className="px-3 py-2 text-slate-500">{op.item}</td>
                                                                    <td className="px-3 py-2 font-mono text-emerald-700 font-bold">{op.visual_op || op.op_num || op.op || '-'}</td>
                                                                    <td className="px-3 py-2 font-mono text-slate-700 font-semibold">{op.codigo || op.produto || '-'}</td>
                                                                    <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate" title={op.descricao || op.desc_produto}>
                                                                        {op.descricao || op.desc_produto || '-'}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-right font-bold text-emerald-900">
                                                                        {parseFloat(op.qtd || op.visual_qtd || op.quantidade_pcp || 0).toLocaleString('pt-BR')}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-slate-500 max-w-[140px] truncate" title={op.nome_cliente || op.cliente}>
                                                                        {op.nome_cliente || op.cliente || '-'}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-slate-600">
                                                                        {op.data_entrega_pcp || op.entrega || r.data_pcp || '—'}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-center">
                                                                        {(op.codigo || op.produto) && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setStructureCode(op.codigo || op.produto)}
                                                                                className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors inline-flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
                                                                                title="Ver organograma da estrutura do produto"
                                                                            >
                                                                                <Layers className="w-3.5 h-3.5" />
                                                                                <span>Ver</span>
                                                                            </button>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Confirmação Irreversível de Liberação */}
            {liberateTarget && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
                        <div className="bg-amber-500 px-6 py-4 flex items-center gap-3">
                            <div className="p-2 bg-white/20 rounded-xl text-white">
                                <AlertCircle className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-base">Confirmar Liberação de Fabricação</h3>
                                <p className="text-amber-100 text-xs">Ação Irreversível de Controle de Produção</p>
                            </div>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-950 space-y-2">
                                <p className="font-bold flex items-center gap-1.5 text-amber-900">
                                    <Lock className="w-4 h-4 text-amber-700" />
                                    Atenção: Esta ação não poderá ser desfeita!
                                </p>
                                <p>
                                    Ao liberar o lote <span className="font-mono font-bold text-slate-800">{liberateTarget.codigo_liberacao || liberateTarget.lote_info}</span> com <span className="font-bold">{liberateTarget.ops?.length || 0} OP(s)</span>, o lote será marcado permanentemente como <strong>LIBERADO P/ FABRICAÇÃO</strong> e não poderá ser excluído ou desmanchado.
                                </p>
                            </div>

                            <div className="flex justify-end items-center gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setLiberateTarget(null)}
                                    disabled={liberating}
                                    className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmLiberarLote}
                                    disabled={liberating}
                                    className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow shadow-emerald-200 transition-all cursor-pointer disabled:opacity-50"
                                >
                                    {liberating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                    <span>Confirmar Liberação</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Estratégia de Lotes / Plano de Corte integrado */}
            {corteForecastTarget && (
                <CorteForecastModal
                    isOpen={true}
                    items={corteForecastTarget}
                    lpfCodigo={corteLpfCode}
                    onClose={() => {
                        setCorteForecastTarget(null);
                        setCorteLpfCode(null);
                    }}
                    onSaveSuccess={() => {
                        setCorteForecastTarget(null);
                        setCorteLpfCode(null);
                        toast.success('Plano de Corte gravado e Lote LPF liberado com sucesso!');
                        fetchReleases();
                    }}
                    usuario={user?.nome || 'PCP'}
                    canEdit={true}
                />
            )}

            <ReportStructureModal 
                isOpen={!!structureCode} 
                onClose={() => setStructureCode(null)} 
                codigo={structureCode} 
            />
        </div>
    );
};

// ─── Aba Controle Romaneio ───────────────────────────────────────────────────
const RomaneioHistoryTab = () => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ startDate: '', endDate: '', search: '' });

    const fetchHistory = async (params = filters) => {
        setLoading(true);
        try {
            const { data } = await api.get('/romaneios/revisions/all', { params });
            setHistory(data);
        } catch {
            toast.error('Falha ao carregar histórico de romaneios.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchHistory(); }, []);

    const handleChange = e => setFilters(p => ({ ...p, [e.target.name]: e.target.value }));
    const clearFilters = () => { const c = { startDate: '', endDate: '', search: '' }; setFilters(c); fetchHistory(c); };

    const formatDate = dateStr => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="space-y-5">
            {/* Filtros */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-blue-600" />
                    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Filtros</h2>
                    <span className="ml-auto text-xs text-slate-400 font-medium">{history.length} registros</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">Busca Geral</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input type="text" name="search" placeholder="ID ou Cliente..." value={filters.search}
                                onChange={handleChange}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                    </div>
                    {['startDate', 'endDate'].map((n, i) => (
                        <div key={n} className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">{i === 0 ? 'De' : 'Até'}</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input type="date" name={n} value={filters[n]} onChange={handleChange}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex justify-end gap-3 pt-1">
                    <button onClick={clearFilters} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-all">Limpar</button>
                    <button onClick={() => fetchHistory()} className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold shadow shadow-blue-200 hover:bg-blue-700 transition-all">
                        <Search className="w-4 h-4" /> Aplicar
                    </button>
                </div>
            </div>

            {/* Tabela */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)]">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
                            <tr className="bg-slate-50 border-b border-slate-100">
                                {['Romaneio', 'Cliente', 'Mudança / Motivo', 'Data / Hora', 'Usuário', 'Status Atual', 'PDF'].map(h => (
                                    <th key={h} className="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr><td colSpan={7} className="py-16 text-center"><Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" /></td></tr>
                            ) : history.length === 0 ? (
                                <tr><td colSpan={7} className="py-16 text-center text-slate-400 text-sm"><Inbox className="w-8 h-8 mx-auto mb-2 opacity-30" />Nenhuma alteração registrada.</td></tr>
                            ) : history.map(h => (
                                <tr key={h.id} className="hover:bg-slate-50/60 transition-colors">
                                    <td className="px-5 py-4 text-center">
                                        <span className="text-xs font-bold font-mono px-2 py-1 bg-blue-100 text-blue-800 border border-blue-200 rounded-lg">#{h.romaneio_id}</span>
                                    </td>
                                    <td className="px-5 py-4 font-semibold text-sm text-slate-700">{h.cliente_nome}</td>
                                    <td className="px-5 py-4">
                                        <p className="text-xs font-bold text-slate-800">{h.reason}</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">Rev: {h.revision_number}</p>
                                    </td>
                                    <td className="px-5 py-4 text-[11px] text-slate-500">{formatDate(h.created_at)}</td>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-[10px] font-bold border border-blue-100">
                                                {h.usuario?.substring(0, 2).toUpperCase()}
                                            </div>
                                            <span className="text-sm font-semibold text-slate-600">{h.usuario}</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4 text-center">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${h.current_status === 'Finalizado' ? 'bg-green-100 text-green-700' : h.current_status === 'Cancelado' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {h.current_status?.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4 text-center">
                                        <button
                                            onClick={() => {
                                                const token = localStorage.getItem('@Lynx:token');
                                                window.open(`${api.defaults.baseURL}/romaneios/${h.romaneio_id}/generate-bundle?token=${token}`, '_blank');
                                            }}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors group"
                                            title="Abrir Caderno PDF"
                                        >
                                            <FileText className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// ─── Aba E-mails RNC ──────────────────────────────────────────────────────────
const RNCEmailsTab = () => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ startDate: '', endDate: '', search: '', rncId: '', product: '' });
    const [emailRncTarget, setEmailRncTarget] = useState(null);

    const fetchHistory = async (params = filters) => {
        setLoading(true);
        try {
            const { data } = await api.get('/email/rnc-history', { params });
            setHistory(data.data || []);
        } catch (err) {
            toast.error('Falha ao carregar histórico de e-mails da RNC.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const handleChange = e => setFilters(p => ({ ...p, [e.target.name]: e.target.value }));
    
    const clearFilters = () => {
        const c = { startDate: '', endDate: '', search: '', rncId: '', product: '' };
        setFilters(c);
        fetchHistory(c);
    };

    const formatDate = dateStr => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleViewPdf = async (rnc) => {
        if (!rnc) {
            toast.error('Dados da RNC não integrados neste registro de e-mail.');
            return;
        }
        try {
            await generateSingleRNCPdf(rnc);
            toast.success(`PDF da RNC #${rnc.id} gerado com sucesso!`);
        } catch (err) {
            toast.error('Erro ao gerar o PDF da RNC.');
        }
    };

    return (
        <div className="space-y-5">
            {/* Filtros */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-indigo-600" />
                    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Filtros</h2>
                    <span className="ml-auto text-xs text-slate-400 font-medium">{history.length} registros</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">ID da RNC</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="number"
                                name="rncId"
                                placeholder="ID..."
                                value={filters.rncId}
                                onChange={handleChange}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">Produto (Cód.)</label>
                        <div className="relative">
                            <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                name="product"
                                placeholder="Código..."
                                value={filters.product}
                                onChange={handleChange}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                    </div>
                    <div className="space-y-1 md:col-span-1">
                        <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">Buscar Destinatário</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                name="search"
                                placeholder="E-mail ou nome..."
                                value={filters.search}
                                onChange={handleChange}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                    </div>
                    {['startDate', 'endDate'].map((n, i) => (
                        <div key={n} className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">{i === 0 ? 'De' : 'Até'}</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="date"
                                    name={n}
                                    value={filters[n]}
                                    onChange={handleChange}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex justify-end gap-3 pt-1">
                    <button onClick={clearFilters} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-all">Limpar</button>
                    <button onClick={() => fetchHistory()} className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow shadow-indigo-200 hover:bg-indigo-700 transition-all">
                        <Search className="w-4 h-4" /> Aplicar
                    </button>
                </div>
            </div>

            {/* Tabela */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)]">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
                            <tr className="bg-slate-50 border-b border-slate-100">
                                {[
                                    'RNC ID',
                                    'Status RNC',
                                    'Data / Hora Envio',
                                    'Destinatários',
                                    'Produto',
                                    'Rastreabilidade',
                                    'Anexo Desenho',
                                    'Ações'
                                ].map(h => (
                                    <th key={h} className="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr><td colSpan={8} className="py-16 text-center"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto" /></td></tr>
                            ) : history.length === 0 ? (
                                <tr><td colSpan={8} className="py-16 text-center text-slate-400 text-sm"><Inbox className="w-8 h-8 mx-auto mb-2 opacity-30" />Nenhum e-mail de RNC encontrado.</td></tr>
                            ) : history.map(row => (
                                <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                                    <td className="px-5 py-4">
                                        {row.rncId ? (
                                            <span className="text-xs font-bold font-mono px-2 py-1 bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-lg tracking-wider">
                                                #{row.rncId}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-slate-300 italic">Desconhecido</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-4">
                                        {row.rnc ? (
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                row.rnc.status === 'CONCLUIDO' 
                                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                                    : row.rnc.status === 'EM ANDAMENTO' 
                                                    ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                                                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                                            }`}>
                                                {row.rnc.status}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-slate-300">—</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-indigo-50 text-indigo-500 rounded-lg">
                                                <Mail className="w-3.5 h-3.5" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-700">Enviado</p>
                                                <p className="text-[11px] text-slate-400">{formatDate(row.date)}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4 max-w-[220px]">
                                        <p className="text-xs text-slate-700 font-medium truncate" title={row.recipient_email}>
                                            {row.recipient_email}
                                        </p>
                                        <p className="text-[10px] text-slate-400 truncate">Por: {row.sender_name || row.sender_email}</p>
                                    </td>
                                    <td className="px-5 py-4">
                                        {row.rnc ? (
                                            <div>
                                                <p className="text-xs font-mono font-bold text-slate-800">{row.rnc.produto}</p>
                                                <p className="text-[10px] text-slate-500 max-w-[150px] truncate">{row.rnc.desc_produto}</p>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-slate-400 truncate max-w-[150px]" title={row.subject}>{row.subject}</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-4">
                                        {row.rnc ? (
                                            <div className="flex gap-1 flex-wrap max-w-[150px]">
                                                {row.rnc.op && <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold font-mono">OP: {row.rnc.op}</span>}
                                                {row.rnc.pedido && <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold font-mono">PV: {row.rnc.pedido}</span>}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-slate-300">—</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-4">
                                        {row.has_attachments ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded text-[10px] font-bold">
                                                Sim
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 text-slate-400 border border-slate-200 rounded text-[10px]">
                                                Não
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-2">
                                            {row.rnc && (
                                                <>
                                                    <button
                                                        onClick={() => handleViewPdf(row.rnc)}
                                                        className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors border border-red-100"
                                                        title="Visualizar Relatório PDF F 097-22"
                                                    >
                                                        <FileText className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setEmailRncTarget(row.rnc)}
                                                        className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors border border-indigo-100"
                                                        title="Reenviar Relatório por E-mail"
                                                    >
                                                        <Mail className="w-4 h-4" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de reenvio de e-mail */}
            {emailRncTarget && (
                <RNCSendEmailModal
                    isOpen={!!emailRncTarget}
                    rnc={emailRncTarget}
                    onClose={() => {
                        setEmailRncTarget(null);
                        fetchHistory();
                    }}
                />
            )}
        </div>
    );
};

// ─── Aba E-mails NFe (Fiscal) ───────────────────────────────────────────────
const NFEReceiptsTab = () => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/nfe-recebimento/emails/todos');
            setHistory(data);
        } catch (err) {
            toast.error('Falha ao carregar histórico de e-mails da NFe.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const formatDate = dateStr => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <div className="space-y-5">
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-teal-600" />
                    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Registro de Comunicação (Fiscal / Almoxarifado)</h2>
                </div>
                <button onClick={fetchHistory} className="px-4 py-2 bg-teal-50 text-teal-600 rounded-lg text-sm font-bold shadow-sm hover:bg-teal-100 transition-all">Atualizar</button>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                            {['NF', 'Fornecedor', 'Data / Hora', 'Remetente', 'Destinatários', 'Assunto', 'Status'].map(h => (
                                <th key={h} className="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {loading ? (
                            <tr><td colSpan={7} className="py-16 text-center"><Loader2 className="w-8 h-8 text-teal-500 animate-spin mx-auto" /></td></tr>
                        ) : history.length === 0 ? (
                            <tr><td colSpan={7} className="py-16 text-center text-slate-400 text-sm"><Inbox className="w-8 h-8 mx-auto mb-2 opacity-30" />Nenhum e-mail de NFe encontrado.</td></tr>
                        ) : history.map(row => (
                            <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                                <td className="px-5 py-4 font-bold font-mono text-slate-700">{row.numero_nf}</td>
                                <td className="px-5 py-4 font-medium text-slate-800 text-sm max-w-[200px] truncate">{row.emitente_nome}</td>
                                <td className="px-5 py-4 text-xs text-slate-500">{formatDate(row.created_at)}</td>
                                <td className="px-5 py-4 text-xs font-semibold text-slate-700">{row.remetente}</td>
                                <td className="px-5 py-4 text-[11px] text-slate-500 max-w-[200px] truncate" title={row.destinatarios}>{row.destinatarios}</td>
                                <td className="px-5 py-4 text-xs text-slate-600 max-w-[200px] truncate" title={row.assunto}>{row.assunto}</td>
                                <td className="px-5 py-4">
                                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-bold">{row.status}</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// ─── Página principal ─────────────────────────────────────────────────────────
const EngineeringReleaseReport = () => {
    const [activeTab, setActiveTab] = useState('engenharia');

    const tabs = [
        { id: 'engenharia', label: 'Engenharia', icon: ClipboardList, color: 'red' },
        { id: 'pcp',        label: 'PCP / Lote Aglutinado', icon: Factory,       color: 'green' },
        { id: 'corte',      label: 'Liberação de Corte', icon: Scissors,      color: 'indigo' },
        { id: 'romaneio',   label: 'Controle Romaneio', icon: Package,       color: 'blue' },
        { id: 'rnc_emails', label: 'Controle Envios RNC', icon: Mail,          color: 'indigo' },
        { id: 'nfe_emails', label: 'Recebimentos Fiscais', icon: FileText,     color: 'teal' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-red-600 rounded-2xl shadow-lg shadow-red-200">
                        <ClipboardList className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Relatório de Liberação</h1>
                        <p className="text-slate-500 text-sm font-medium">Engenharia e PCP — Liberações para fabricação</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 bg-slate-100 p-1 rounded-2xl w-fit">
                {tabs.map(tab => {
                    const active = activeTab === tab.id;
                    const colorMap = {
                        red:   { active: 'bg-white text-red-600 shadow-sm border border-red-100',   inactive: 'text-slate-500 hover:text-red-500' },
                        green: { active: 'bg-white text-green-600 shadow-sm border border-green-100', inactive: 'text-slate-500 hover:text-green-500' },
                        blue:  { active: 'bg-white text-blue-600 shadow-sm border border-blue-100',  inactive: 'text-slate-500 hover:text-blue-500' },
                        indigo:{ active: 'bg-white text-indigo-600 shadow-sm border border-indigo-100', inactive: 'text-slate-500 hover:text-indigo-500' },
                        teal:  { active: 'bg-white text-teal-600 shadow-sm border border-teal-100',   inactive: 'text-slate-500 hover:text-teal-500' },
                    };
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${active ? colorMap[tab.color].active : colorMap[tab.color].inactive}`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            {activeTab === 'engenharia' ? <EngineeringTab /> : 
             activeTab === 'pcp' ? <PCPTab /> : 
             activeTab === 'corte' ? <CorteReleaseTab /> : 
             activeTab === 'rnc_emails' ? <RNCEmailsTab /> : 
             activeTab === 'nfe_emails' ? <NFEReceiptsTab /> : <RomaneioHistoryTab />}
        </div>
    );
};

export default EngineeringReleaseReport;

