import { useState, useEffect, useRef } from 'react';
import { X, ClipboardList, Clock, User, CheckCircle, XCircle, AlertTriangle, Camera, ImagePlus, Trash2 } from 'lucide-react';
import { getAppointmentHistory, submitConferencia } from '../services/api';

export default function ProductionHistoryModal({ opData, onClose }) {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loggedUser, setLoggedUser] = useState(null);

    // Modal de recusa
    const [recusaModal, setRecusaModal] = useState(null); // { id }
    const [motivoRecusa, setMotivoRecusa] = useState('');
    const [fotosRecusa, setFotosRecusa] = useState([]);
    const [fotosPreview, setFotosPreview] = useState([]);
    const fotoInputRef = useRef(null);
    const [savingId, setSavingId] = useState(null);
    const [toast, setToast] = useState(null);

    useEffect(() => {
        const userStr = localStorage.getItem('@MetalFisa:user');
        if (userStr) {
            try { setLoggedUser(JSON.parse(userStr)); } catch (e) { }
        }
        if (opData) fetchHistory();
    }, [opData]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const data = await getAppointmentHistory(opData.op, opData.item_op, opData.sequen, opData.operacao);
            setHistory(data || []);
        } catch (err) {
            console.error('Error fetching history:', err);
        } finally {
            setLoading(false);
        }
    };

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleConferencia = async (id, status, observacao = '', fotos = []) => {
        if (!loggedUser) return;
        setSavingId(id);
        try {
            await submitConferencia({
                id, status, observacao, fotos,
                conferido_por: loggedUser.NomeCompleto || loggedUser.Login || 'Conferente'
            });
            showToast(status === 'OK' ? 'Apontamento aprovado!' : 'Apontamento recusado!', status === 'OK' ? 'success' : 'error');
            fetchHistory();
        } catch (err) {
            console.error('Erro ao registrar conferência', err);
            showToast('Erro ao registrar conferência. Tente novamente.', 'error');
        } finally {
            setSavingId(null);
        }
    };

    const handleRecusar = (id) => {
        setMotivoRecusa('');
        setFotosRecusa([]);
        setFotosPreview([]);
        setRecusaModal({ id });
    };

    const handleFotosChange = (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        const novos = [...fotosRecusa, ...files].slice(0, 5);
        setFotosRecusa(novos);
        setFotosPreview(novos.map(f => URL.createObjectURL(f)));
    };

    const removerFoto = (idx) => {
        const novos = fotosRecusa.filter((_, i) => i !== idx);
        setFotosRecusa(novos);
        setFotosPreview(novos.map(f => URL.createObjectURL(f)));
    };

    const confirmRecusa = async () => {
        if (!motivoRecusa.trim()) return;
        await handleConferencia(recusaModal.id, 'DIVERGENTE', motivoRecusa.trim(), fotosRecusa);
        setRecusaModal(null);
    };

    if (!opData) return null;

    const canConferir = loggedUser && ['A', 'C'].includes(loggedUser.TipoUsuario);

    const fmtDate = (d) => {
        if (!d) return '-';
        const dt = new Date(d);
        return isNaN(dt) ? '-' : dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    };
    const fmtTime = (d) => {
        if (!d) return '-';
        const dt = new Date(d);
        return isNaN(dt) ? '-' : dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };
    const calcDuration = (start, end) => {
        if (!start || !end) return '-';
        const ms = new Date(end).getTime() - new Date(start).getTime();
        if (isNaN(ms) || ms < 0) return '-';
        const totalMin = Math.floor(ms / 60000);
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        return h > 0 ? `${h}h${String(m).padStart(2, '0')}min` : `${m}min`;
    };

    const totalQty = history.reduce((acc, r) => acc + Number(r.quantidade || 0), 0);
    const totalMs = history.reduce((acc, r) => {
        if (!r.data_inicio || !r.data_fim) return acc;
        const ms = new Date(r.data_fim).getTime() - new Date(r.data_inicio).getTime();
        return acc + (isNaN(ms) ? 0 : Math.max(0, ms));
    }, 0);
    const totalH = Math.floor(totalMs / 3600000);
    const totalM = Math.floor((totalMs % 3600000) / 60000);

    return (
        <>
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
                    {/* Header */}
                    <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
                        <div>
                            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                                <ClipboardList className="w-5 h-5 text-blue-600" />
                                Histórico de Apontamentos
                            </h3>
                            <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-3">
                                <span>OP: <strong>{opData.op}</strong></span>
                                <span>Item: <strong>{opData.item_op}</strong></span>
                                <span>Seq: <strong>{opData.sequen}</strong></span>
                                <span>Oper: <strong>{opData.operacao}</strong> ({opData.desc_operacao})</span>
                                {opData.desc_produto && <span>Produto: <strong>{opData.desc_produto}</strong></span>}
                            </div>
                        </div>
                        <button onClick={onClose} className="p-1 hover:bg-red-100 rounded-full transition">
                            <X className="w-5 h-5 text-slate-400 hover:text-red-500" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="flex justify-center items-center h-40">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            </div>
                        ) : history.length === 0 ? (
                            <div className="text-center py-12 text-slate-400">
                                Nenhum apontamento registrado para esta operação.
                            </div>
                        ) : (
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-600 font-medium sticky top-0 shadow-sm text-xs">
                                    <tr>
                                        <th className="px-4 py-3">#</th>
                                        <th className="px-4 py-3">Data</th>
                                        <th className="px-4 py-3">Início</th>
                                        <th className="px-4 py-3">Fim</th>
                                        <th className="px-4 py-3">Duração</th>
                                        <th className="px-4 py-3">Qtd</th>
                                        <th className="px-4 py-3">Usuário</th>
                                        <th className="px-4 py-3">Conferência</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {history.map((record, idx) => {
                                        const isSaving = savingId === record.id;
                                        return (
                                            <tr key={record.id || idx} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-2.5 text-slate-400 text-xs">{idx + 1}</td>
                                                <td className="px-4 py-2.5 font-mono text-xs text-slate-600">
                                                    {fmtDate(record.data_inicio || record.criado_em)}
                                                </td>
                                                <td className="px-4 py-2.5 font-mono text-xs text-slate-700">
                                                    <div className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3 text-blue-400" />
                                                        {fmtTime(record.data_inicio)}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2.5 font-mono text-xs text-slate-700">
                                                    {fmtTime(record.data_fim)}
                                                </td>
                                                <td className="px-4 py-2.5 text-xs font-semibold text-indigo-600">
                                                    {calcDuration(record.data_inicio, record.data_fim)}
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold text-xs">
                                                        {Number(record.quantidade || 0).toFixed(0)} pc
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold">
                                                            {(record.usuario || 'U').charAt(0).toUpperCase()}
                                                        </div>
                                                        <span className="text-xs font-medium text-slate-700">{record.usuario || 'Sistema'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2.5 text-xs">
                                                    {record.conferencia_status === 'OK' ? (
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="text-green-600 font-bold flex items-center gap-1">
                                                                <CheckCircle className="w-3.5 h-3.5" /> Aprovado
                                                            </span>
                                                            {record.conferido_por && <span className="text-slate-400 text-[10px]">por {record.conferido_por}</span>}
                                                        </div>
                                                    ) : record.conferencia_status === 'DIVERGENTE' ? (
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="text-red-600 font-bold flex items-center gap-1">
                                                                <XCircle className="w-3.5 h-3.5" /> Recusado
                                                            </span>
                                                            {record.conferido_por && <span className="text-slate-400 text-[10px]">por {record.conferido_por}</span>}
                                                            {record.conferencia_obs && <span className="text-red-500 italic text-[10px] max-w-[150px] truncate" title={record.conferencia_obs}>{record.conferencia_obs}</span>}
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-orange-500 font-bold flex items-center gap-1">
                                                                <AlertTriangle className="w-3.5 h-3.5" /> Pendente
                                                            </span>
                                                            {canConferir && (
                                                                <div className="flex gap-1.5 mt-1">
                                                                    <button
                                                                        disabled={isSaving}
                                                                        onClick={() => handleConferencia(record.id, 'OK')}
                                                                        className="text-[10px] px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded font-medium transition disabled:opacity-50"
                                                                    >
                                                                        {isSaving ? '...' : '✓ Aprovar'}
                                                                    </button>
                                                                    <button
                                                                        disabled={isSaving}
                                                                        onClick={() => handleRecusar(record.id)}
                                                                        className="text-[10px] px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded font-medium transition disabled:opacity-50"
                                                                    >
                                                                        ✕ Recusar
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    {record.observacao && (
                                                        <div className="mt-1 max-w-[150px] truncate text-[10px] italic text-slate-400" title={record.observacao}>
                                                            Obs: {record.observacao}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot className="bg-slate-50 font-bold text-xs text-slate-700 border-t-2 border-slate-200">
                                    <tr>
                                        <td colSpan="4" className="px-4 py-3 text-right">Totais:</td>
                                        <td className="px-4 py-3 text-indigo-600">
                                            {totalH > 0 ? `${totalH}h${String(totalM).padStart(2, '0')}min` : `${totalM}min`}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                                {totalQty.toFixed(0)} pc
                                            </span>
                                        </td>
                                        <td colSpan="2" className="px-4 py-3 text-slate-400">
                                            {history.length} apontamento{history.length !== 1 ? 's' : ''}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-3 border-t bg-slate-50 rounded-b-xl flex justify-end">
                        <button onClick={onClose} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium text-sm transition-colors">
                            Fechar
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal de Motivo da Recusa */}
            {recusaModal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                                <XCircle className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800">Recusar Apontamento</h3>
                                <p className="text-sm text-slate-500">Informe o motivo e, se necessário, anexe fotos como evidência</p>
                            </div>
                        </div>
                        <textarea
                            className="w-full border rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
                            rows={3}
                            placeholder="Ex: Quantidade incorreta, operação não executada, etc."
                            value={motivoRecusa}
                            onChange={e => setMotivoRecusa(e.target.value)}
                            autoFocus
                        />
                        {/* Upload de fotos */}
                        <div className="mt-3">
                            <p className="text-xs font-medium text-slate-600 mb-2">Fotos de evidência (opcional — máx. 5)</p>
                            <div className="flex flex-wrap gap-2">
                                {fotosPreview.map((src, idx) => (
                                    <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 group">
                                        <img src={src} alt={`foto ${idx + 1}`} className="w-full h-full object-cover" />
                                        <button
                                            onClick={() => removerFoto(idx)}
                                            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition"
                                        >
                                            <Trash2 className="w-4 h-4 text-white" />
                                        </button>
                                    </div>
                                ))}
                                {fotosRecusa.length < 5 && (
                                    <button
                                        onClick={() => fotoInputRef.current?.click()}
                                        className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-300 hover:border-blue-400 flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-blue-500 transition"
                                        title="Adicionar foto"
                                    >
                                        <Camera className="w-5 h-5" />
                                        <span className="text-[9px] font-medium">Foto</span>
                                    </button>
                                )}
                            </div>
                            <input
                                ref={fotoInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={handleFotosChange}
                            />
                            <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                <ImagePlus className="w-3 h-3" />
                                No celular: abre câmera ou galeria. No PC: selecione arquivos de imagem.
                            </p>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <button
                                onClick={() => setRecusaModal(null)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmRecusa}
                                disabled={!motivoRecusa.trim()}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                            >
                                Confirmar Recusa
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-6 right-6 z-[80] px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium flex items-center gap-2 transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
                    {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {toast.msg}
                </div>
            )}
        </>
    );
}
