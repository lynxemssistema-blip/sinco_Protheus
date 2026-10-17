import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-toastify';
import { AlertTriangle, CheckCircle2, Clock, Printer, History, RefreshCw, FileText, Loader2 } from 'lucide-react';
import { createPendenciasSnapshot, getPendenciasSnapshots, getPendenciasSnapshotById } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { generatePendenciasReportPdf } from '../services/pendenciasPdfGenerator';

const STATUS_LABEL = {
    waiting: 'Aguardando',
    in_progress: 'Em Andamento',
};

// Lista de pendências de apontamento (recursos não concluídos) de uma OP,
// com histórico de snapshots gerados automaticamente e opção de impressão em PDF padrão Lynx.
export default function PendenciasList({ opNum, itemPv, pedido, produtoPai, liveItens }) {
    const { user } = useAuth();
    const [snapshots, setSnapshots] = useState([]);
    const [loadingSnapshots, setLoadingSnapshots] = useState(false);
    const [selectedSnapshotId, setSelectedSnapshotId] = useState('live'); // 'live' | number
    const [snapshotDetail, setSnapshotDetail] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const autoSavedRef = useRef(false);

    const loadSnapshots = useCallback(() => {
        setLoadingSnapshots(true);
        getPendenciasSnapshots(opNum)
            .then(setSnapshots)
            .catch(err => toast.error('Erro ao buscar histórico de pendências: ' + err.message))
            .finally(() => setLoadingSnapshots(false));
    }, [opNum]);

    useEffect(() => { loadSnapshots(); }, [loadSnapshots]);

    // Gera e salva automaticamente a lista de pendências atual ao abrir (uma vez por sessão do modal)
    useEffect(() => {
        if (autoSavedRef.current || !liveItens) return;
        autoSavedRef.current = true;
        if (liveItens.length === 0) return; // nada pendente, não registra snapshot vazio
        createPendenciasSnapshot({ op_num: opNum, pedido, itens_pendentes: liveItens })
            .then(() => loadSnapshots())
            .catch(err => toast.error('Erro ao salvar lista de pendências: ' + err.message));
    }, [liveItens, opNum, pedido, loadSnapshots]);

    const handleSelectSnapshot = (value) => {
        const id = value === 'live' ? 'live' : Number(value);
        setSelectedSnapshotId(id);
        if (id === 'live') { setSnapshotDetail(null); return; }
        setLoadingDetail(true);
        getPendenciasSnapshotById(id)
            .then(setSnapshotDetail)
            .catch(err => toast.error('Erro ao carregar snapshot: ' + err.message))
            .finally(() => setLoadingDetail(false));
    };

    const rawItens = selectedSnapshotId === 'live' ? (liveItens || []) : (snapshotDetail?.itens_pendentes || []);

    const displayItens = React.useMemo(() => {
        if (!rawItens || rawItens.length === 0) return [];
        if (!opNum && !itemPv && !produtoPai) return rawItens;
        const norm = v => String(v || '').trim().replace(/^0+/, '');
        const targetOp = opNum ? norm(opNum) : null;
        const targetItem = itemPv ? norm(itemPv) : null;

        return rawItens.filter(it => {
            const itOp = norm(it.op);
            const itItem = norm(it.item_pv || it.item_op);

            if (targetOp && itOp && itOp !== targetOp && !targetOp.startsWith(itOp) && !itOp.startsWith(targetOp)) {
                return false;
            }
            if (targetItem && itItem && itItem !== targetItem) {
                return false;
            }
            return true;
        });
    }, [rawItens, opNum, itemPv]);

    const displayMeta = selectedSnapshotId === 'live'
        ? { usuario: null, created_at: new Date() }
        : snapshotDetail;

    const handlePrintPdf = async () => {
        if (!displayItens || displayItens.length === 0) {
            toast.warning('Nenhuma pendência para gerar relatório.');
            return;
        }
        setGeneratingPdf(true);
        try {
            const snapshotLabel = selectedSnapshotId === 'live'
                ? 'Atual (ao vivo)'
                : `${new Date(displayMeta?.created_at).toLocaleString('pt-BR')} (por ${displayMeta?.usuario || 'Sistema'})`;

            await generatePendenciasReportPdf({
                opNum,
                itemPv,
                pedido,
                produtoPai: produtoPai || displayItens[0]?.produto,
                itens: displayItens,
                user,
                snapshotInfo: snapshotLabel,
                onProgress: (msg) => console.log('[PDF Pendências]', msg)
            });
            toast.success('Relatório gerado com sucesso com anexo do desenho técnico!');
        } catch (err) {
            console.error('Erro ao gerar relatório de pendências:', err);
            toast.error('Erro ao gerar relatório PDF: ' + err.message);
        } finally {
            setGeneratingPdf(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-200 print:hidden">
                <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-slate-400" />
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Snapshot:</label>
                    <select
                        className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={selectedSnapshotId}
                        onChange={e => handleSelectSnapshot(e.target.value)}
                    >
                        <option value="live">Atual (agora) — {(liveItens || []).length} pendência(s)</option>
                        {snapshots.map(s => (
                            <option key={s.id} value={s.id}>
                                {new Date(s.created_at).toLocaleString('pt-BR')} — {s.usuario} ({s.total_pendencias})
                            </option>
                        ))}
                    </select>
                    {loadingSnapshots && <RefreshCw className="w-3.5 h-3.5 text-slate-400 animate-spin" />}
                </div>
                <button
                    onClick={handlePrintPdf}
                    disabled={generatingPdf}
                    className="flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wide shadow-sm transition-all hover:shadow"
                    title="Gera o Relatório de Pendências no formato oficial Lynx com o Desenho Técnico do Produto Pai anexado"
                >
                    {generatingPdf ? (
                        <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Gerando PDF + Anexo...
                        </>
                    ) : (
                        <>
                            <Printer className="w-3.5 h-3.5" /> Imprimir Relatório PDF
                        </>
                    )}
                </button>
            </div>

            <div className="flex-1 overflow-auto pendencias-print-area">
                <style dangerouslySetInnerHTML={{ __html: `
                    @media print {
                        body * { visibility: hidden !important; }
                        .pendencias-print-area, .pendencias-print-area * { visibility: visible !important; }
                        .pendencias-print-area { position: absolute; left: 0; top: 0; width: 100%; }
                    }
                `}} />

                <div className="p-6">
                    <div className="mb-4">
                        <h3 className="text-lg font-bold text-slate-900">Lista de Pendências de Apontamento</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            OP {opNum}{pedido ? ` · Pedido ${pedido}` : ''} · Gerado em {displayMeta?.created_at ? new Date(displayMeta.created_at).toLocaleString('pt-BR') : '-'}
                            {displayMeta?.usuario ? ` · por ${displayMeta.usuario}` : ''}
                        </p>
                    </div>

                    {loadingDetail ? (
                        <div className="flex items-center justify-center py-12"><RefreshCw className="w-8 h-8 text-blue-500 animate-spin" /></div>
                    ) : displayItens.length === 0 ? (
                        <div className="text-center text-slate-400 py-16">
                            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30 text-green-500" />
                            <p className="font-medium">Nenhuma pendência de apontamento encontrada.</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="border-b-2 border-slate-300">
                                    <th className="text-left py-2 pr-3 font-bold text-slate-600 text-xs uppercase">Pedido / Item</th>
                                    <th className="text-left py-2 pr-3 font-bold text-slate-600 text-xs uppercase">Cliente</th>
                                    <th className="text-left py-2 pr-3 font-bold text-slate-600 text-xs uppercase">PC Cliente</th>
                                    <th className="text-left py-2 pr-3 font-bold text-slate-600 text-xs uppercase">Ref. Cliente</th>
                                    <th className="text-left py-2 pr-3 font-bold text-slate-600 text-xs uppercase">OP Completa</th>
                                    <th className="text-left py-2 pr-3 font-bold text-slate-600 text-xs uppercase">Produto</th>
                                    <th className="text-left py-2 pr-3 font-bold text-slate-600 text-xs uppercase">Operação</th>
                                    <th className="text-left py-2 pr-3 font-bold text-slate-600 text-xs uppercase">Recurso</th>
                                    <th className="text-center py-2 pr-3 font-bold text-slate-600 text-xs uppercase">Qtd Plan/Prod</th>
                                    <th className="text-center py-2 font-bold text-slate-600 text-xs uppercase">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayItens.map((it, idx) => (
                                    <tr key={idx} className="border-b border-slate-100">
                                        <td className="py-2 pr-3 text-xs">
                                            <div className="font-bold text-slate-800">{it.pedido || '-'}</div>
                                            <div className="text-[11px] text-slate-500">Item {it.item_pv || '-'}</div>
                                        </td>
                                        <td className="py-2 pr-3 text-xs text-slate-600 max-w-[160px] truncate" title={it.cliente}>{it.cliente || '-'}</td>
                                        <td className="py-2 pr-3 text-xs font-mono text-slate-600">{it.ped_cliente || '-'}</td>
                                        <td className="py-2 pr-3 text-xs font-mono text-slate-600">{it.ref_cliente || '-'}</td>
                                        <td className="py-2 pr-3 font-mono text-xs font-bold text-blue-700">{it.op_completa || `${it.op || ''}${it.item_op || ''}${it.sequen || ''}`}</td>
                                        <td className="py-2 pr-3">
                                            <div className="font-semibold text-slate-800 text-xs">{it.produto}</div>
                                            <div className="text-[11px] text-slate-500">{it.desc_produto}</div>
                                        </td>
                                        <td className="py-2 pr-3 font-mono text-xs">{it.operac}</td>
                                        <td className="py-2 pr-3 text-xs">
                                            <div>{it.recurso}</div>
                                            <div className="text-[11px] text-slate-500">{it.desc_recurso}</div>
                                        </td>
                                        <td className="py-2 pr-3 text-center text-xs">{it.qtde_produzida} / {it.qtde_planejada} <span className="text-[10px] text-slate-400">{it.um}</span></td>
                                        <td className="py-2 text-center">
                                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${it.status === 'in_progress' ? 'bg-yellow-50 text-yellow-800 border border-yellow-300' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                                                {it.status === 'in_progress' ? <Clock className="w-2.5 h-2.5" /> : <AlertTriangle className="w-2.5 h-2.5" />}
                                                {STATUS_LABEL[it.status] || it.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
