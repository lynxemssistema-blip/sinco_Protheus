import { useState } from 'react';
import { X, FileText, Loader2, AlertCircle, Printer } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Modal para gerar Espelho de OP a partir de um b1_cod (produto pai VMI).
 * Props:
 *   b1cod        — código Protheus do produto pai
 *   label        — descrição / nome do grupo
 *   defaultQty   — quantidade sugerida (groupTotal, min da demanda)
 *   sheetName    — nome da planilha/lote ativo
 *   sheetDate    — data do lote ativo
 *   onClose      — callback ao fechar
 */
export default function VMIOpMirrorModal({ b1cod, label, defaultQty, sheetName, sheetDate, onClose }) {
    const { user } = useAuth();
    const [qty, setQty]       = useState(defaultQty || 1);
    const [loading, setLoading] = useState(false);
    const [error, setError]   = useState(null);

    const handleGerar = async (comDesenhos) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                qty:   qty,
                sheet: sheetName || '',
                data:  sheetDate  || ''
            });
            const res = await api.get(`/vmi/op-mirror/${encodeURIComponent(b1cod.trim())}?${params}`);
            const mirrorData = res.data;
            const userName = user?.nome || 'Usuário';

            if (comDesenhos) {
                const { generateOPByOperationWithDrawingsPdf } = await import('../../services/opByOperationWithDrawingsPdfGenerator');
                await generateOPByOperationWithDrawingsPdf(mirrorData, userName);
            } else {
                const { generateOPByOperationPdf } = await import('../../services/opByOperationPdfGenerator');
                generateOPByOperationPdf(mirrorData);
            }
            onClose();
        } catch (err) {
            const msg = err.response?.data?.error || err.message;
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col">

                {/* Header */}
                <div className="flex items-start justify-between p-5 border-b border-slate-200">
                    <div className="flex-1 min-w-0">
                        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                            Espelho da OP
                        </h2>
                        <p className="text-sm text-slate-500 mt-0.5 truncate">
                            <span className="font-mono text-slate-700 font-semibold">{b1cod}</span>
                            {label && <> — {label}</>}
                        </p>
                        {sheetName && (
                            <p className="text-xs text-slate-400 mt-0.5 truncate">
                                Planilha: <span className="text-slate-600">{sheetName}</span>
                                {sheetDate && <> · {sheetDate}</>}
                            </p>
                        )}
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition ml-3 flex-shrink-0">
                        <X className="w-4 h-4 text-slate-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <label className="text-sm font-medium text-slate-600 whitespace-nowrap">
                            Quantidade (fator):
                        </label>
                        <input
                            type="number" min="1" value={qty}
                            onChange={e => setQty(e.target.value)}
                            className="w-28 border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-mono font-bold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                        <span className="text-xs text-slate-400">unidades do produto pai</span>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
                        </div>
                    )}

                    <div className="flex flex-col gap-2 pt-1">
                        <button
                            onClick={() => handleGerar(true)}
                            disabled={loading}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                            Espelho OP + Desenhos (PDF)
                        </button>
                        <button
                            onClick={() => handleGerar(false)}
                            disabled={loading}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 disabled:opacity-50 transition">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                            Espelho OP Simples (PDF)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
