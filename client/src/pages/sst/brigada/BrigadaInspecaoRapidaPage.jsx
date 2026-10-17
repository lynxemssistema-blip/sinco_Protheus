import React, { useState, useEffect } from 'react';
import { 
    Flame, QrCode, Search, CheckCircle2, AlertOctagon, CheckSquare, 
    ArrowLeft, ShieldCheck, MapPin, Calendar, Clock, RefreshCw, AlertTriangle,
    Camera, Image, Trash2, ZoomIn, X
} from 'lucide-react';
import api from '../../../services/api';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function BrigadaInspecaoRapidaPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const hashParam = searchParams.get('qr') || '';

    const [termoBusca, setTermoBusca] = useState(hashParam);
    const [carregando, setCarregando] = useState(false);
    const [equipamento, setEquipamento] = useState(null);
    const [erro, setErro] = useState(null);
    const [sucesso, setSucesso] = useState(null);

    // Evidência fotográfica com câmera do celular
    const [fotoInspecao, setFotoInspecao] = useState(null);
    const [fotoInspecaoPreview, setFotoInspecaoPreview] = useState(null);
    const [fotoVisualizacaoModal, setFotoVisualizacaoModal] = useState(false);

    const [checklist, setChecklist] = useState({
        lacre_intacto: true,
        manometro_pressao_conforme: true,
        desobstruido: true,
        sinalizacao_visivel: true,
        mangueira_bico_ok: true,
        carga_no_prazo: true,
        observacoes: ''
    });

    const buscarEquipamento = async (codigoOuHash) => {
        if (!codigoOuHash) return;
        try {
            setCarregando(true);
            setErro(null);
            setSucesso(null);
            const res = await api.get(`/sst/brigada/equipamento-por-qr/${encodeURIComponent(codigoOuHash.trim())}`);
            setEquipamento(res.data);
            setChecklist({
                lacre_intacto: true,
                manometro_pressao_conforme: true,
                desobstruido: true,
                sinalizacao_visivel: true,
                mangueira_bico_ok: true,
                carga_no_prazo: true,
                observacoes: ''
            });
        } catch (err) {
            setEquipamento(null);
            setErro(err.response?.data?.error || 'Equipamento não localizado. Verifique o código ou QR Code.');
        } finally {
            setCarregando(false);
        }
    };

    useEffect(() => {
        if (hashParam) {
            buscarEquipamento(hashParam);
        }
    }, [hashParam]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!equipamento) return;

        try {
            setCarregando(true);
            setErro(null);
            const formData = new FormData();
            formData.append('equipamento_id', equipamento.id);
            Object.keys(checklist).forEach(k => {
                formData.append(k, checklist[k]);
            });
            if (fotoInspecao) {
                formData.append('foto', fotoInspecao);
            }
            const res = await api.post('/sst/brigada/inspecoes', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setSucesso(res.data.message);
            setFotoInspecao(null);
            setFotoInspecaoPreview(null);
            // Recarrega o equipamento atualizado
            const eqUpdated = await api.get(`/sst/brigada/equipamento-por-qr/${equipamento.codigo_identificador}`);
            setEquipamento(eqUpdated.data);
        } catch (err) {
            setErro(err.response?.data?.error || 'Erro ao registrar vistoria.');
        } finally {
            setCarregando(false);
        }
    };

    const formatTipo = (t) => {
        switch (t) {
            case 'extintor_pqs_abc': return 'Extintor Pó ABC';
            case 'extintor_co2': return 'Extintor CO2';
            case 'extintor_agua': return 'Extintor Água Pressurizada';
            case 'hidrante_abrigo': return 'Hidrante / Abrigo';
            default: return t;
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center p-4">
            
            {/* CABEÇALHO MOBILE */}
            <div className="w-full max-w-md flex items-center justify-between pb-4 border-b border-slate-800">
                <button
                    onClick={() => navigate('/sst/brigada')}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Voltar à Central</span>
                </button>
                <div className="flex items-center gap-2">
                    <Flame className="w-5 h-5 text-red-500" />
                    <span className="font-bold text-sm tracking-tight">Vistoria Mobile (NR-23)</span>
                </div>
            </div>

            <div className="w-full max-w-md mt-4 space-y-4">
                
                {/* CAMPO DE LEITURA / BUSCA DE QR */}
                <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 shadow-lg">
                    <label className="block text-xs font-bold text-slate-300 uppercase mb-2 flex items-center gap-2">
                        <QrCode className="w-4 h-4 text-red-400" />
                        <span>Identificador do Equipamento ou QR Code</span>
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Ex: EXT-01 ou BRIG-EXT-01-MTSA"
                            value={termoBusca}
                            onChange={e => setTermoBusca(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && buscarEquipamento(termoBusca)}
                            className="flex-1 bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5 text-sm font-mono uppercase text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
                        />
                        <button
                            onClick={() => buscarEquipamento(termoBusca)}
                            disabled={carregando}
                            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-xl flex items-center gap-1.5 text-xs"
                        >
                            {carregando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                            <span>Buscar</span>
                        </button>
                    </div>
                </div>

                {erro && (
                    <div className="bg-red-950/80 border border-red-500/50 p-4 rounded-xl text-xs text-red-200 flex items-start gap-3">
                        <AlertOctagon className="w-5 h-5 text-red-400 flex-shrink-0" />
                        <div>
                            <strong className="block font-bold">Atenção</strong>
                            <span>{erro}</span>
                        </div>
                    </div>
                )}

                {sucesso && (
                    <div className="bg-emerald-950/80 border border-emerald-500/50 p-4 rounded-xl text-xs text-emerald-200 flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                        <div>
                            <strong className="block font-bold">Vistoria Concluída</strong>
                            <span>{sucesso}</span>
                        </div>
                    </div>
                )}

                {/* DETALHES DO EQUIPAMENTO IDENTIFICADO */}
                {equipamento && (
                    <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 space-y-4">
                        
                        <div className="flex items-start justify-between border-b border-slate-700 pb-3">
                            <div>
                                <span className="text-2xl font-black text-white font-mono">{equipamento.codigo_identificador}</span>
                                <h3 className="font-bold text-red-400 text-sm">{formatTipo(equipamento.tipo)} ({equipamento.capacidade_carga})</h3>
                            </div>
                            <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                                equipamento.status_operacional === 'operacional' ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-500/40' : 'bg-red-900/60 text-red-300 border border-red-500/40'
                            }`}>
                                {equipamento.status_operacional.toUpperCase()}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs text-slate-300 bg-slate-900/60 p-3 rounded-xl">
                            <div>
                                <span className="text-slate-400 block flex items-center gap-1">
                                    <MapPin className="w-3 h-3 text-red-400" /> Setor:
                                </span>
                                <strong className="text-white">{equipamento.setor_localizacao}</strong>
                            </div>
                            <div>
                                <span className="text-slate-400 block flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-blue-400" /> Recarga:
                                </span>
                                <strong className="text-white">
                                    {equipamento.data_proxima_recarga ? new Date(equipamento.data_proxima_recarga).toLocaleDateString('pt-BR') : '-'}
                                </strong>
                            </div>
                        </div>

                        {equipamento.ponto_referencia && (
                            <p className="text-xs text-slate-400 italic">
                                Ref: {equipamento.ponto_referencia}
                            </p>
                        )}

                        {/* FORMULÁRIO DE CHECKLIST RÁPIDO */}
                        <form onSubmit={handleSubmit} className="space-y-3 pt-2">
                            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                                Checklist Obrigatório de Conformidade:
                            </h4>

                            <div className="space-y-2">
                                {[
                                    { key: 'lacre_intacto', label: '1. Lacre de segurança intacto' },
                                    { key: 'manometro_pressao_conforme', label: '2. Manômetro na faixa verde' },
                                    { key: 'desobstruido', label: '3. Acesso 100% desobstruído' },
                                    { key: 'sinalizacao_visivel', label: '4. Sinalização e piso visíveis' },
                                    { key: 'mangueira_bico_ok', label: '5. Mangueira e bico em ordem' },
                                    { key: 'carga_no_prazo', label: '6. Carga dentro do prazo de validade' }
                                ].map(item => (
                                    <button
                                        type="button"
                                        key={item.key}
                                        onClick={() => setChecklist({ ...checklist, [item.key]: !checklist[item.key] })}
                                        className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-bold transition-all text-left ${
                                            checklist[item.key]
                                                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                                                : 'bg-red-950/40 border-red-500/50 text-red-200'
                                        }`}
                                    >
                                        <span>{item.label}</span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-black ${
                                            checklist[item.key] ? 'bg-emerald-500 text-slate-900' : 'bg-red-500 text-white'
                                        }`}>
                                            {checklist[item.key] ? 'CONFORME' : 'AVARIA'}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            {/* Evidência Fotográfica (Câmera Celular) */}
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                                    Evidência Fotográfica do Equipamento (Opcional / Câmera)
                                </label>
                                {fotoInspecaoPreview ? (
                                    <div className="relative rounded-xl overflow-hidden border-2 border-emerald-500 bg-slate-900 group">
                                        <img 
                                            src={fotoInspecaoPreview} 
                                            alt="Evidência" 
                                            className="w-full h-44 object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setFotoVisualizacaoModal(true)}
                                                className="p-2.5 bg-white/20 hover:bg-white/40 text-white rounded-xl backdrop-blur-sm cursor-pointer"
                                                title="Ampliar Foto"
                                            >
                                                <ZoomIn className="w-5 h-5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setFotoInspecao(null);
                                                    setFotoInspecaoPreview(null);
                                                }}
                                                className="p-2.5 bg-red-600/80 hover:bg-red-600 text-white rounded-xl cursor-pointer"
                                                title="Remover Foto"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-xl cursor-pointer bg-slate-900/80 hover:bg-slate-900 transition-colors group">
                                        <Camera className="w-7 h-7 text-slate-400 group-hover:text-emerald-400 mb-1" />
                                        <span className="text-xs font-bold text-slate-200 group-hover:text-white">Tirar Foto do Equipamento</span>
                                        <span className="text-[10px] text-slate-500">Tocar para abrir a câmera do celular ou escolher foto</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    setFotoInspecao(file);
                                                    setFotoInspecaoPreview(URL.createObjectURL(file));
                                                }
                                            }}
                                            className="hidden"
                                        />
                                    </label>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Observações do Inspetor</label>
                                <textarea
                                    rows={2}
                                    placeholder="Detalhes ou pendências de manutenção..."
                                    value={checklist.observacoes}
                                    onChange={e => setChecklist({ ...checklist, observacoes: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs text-white focus:outline-none focus:border-red-500"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={carregando}
                                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
                            >
                                {carregando ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        <span>Gravando Vistoria...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-5 h-5" />
                                        <span>FINALIZAR VISTORIA</span>
                                    </>
                                )}
                            </button>
                        </form>

                    </div>
                )}

                {/* MODAL ZOOM DE FOTO */}
                {fotoVisualizacaoModal && fotoInspecaoPreview && (
                    <div 
                        onClick={() => setFotoVisualizacaoModal(false)}
                        className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-pointer backdrop-blur-sm"
                    >
                        <div className="relative max-w-lg w-full bg-slate-900 rounded-2xl overflow-hidden p-2" onClick={e => e.stopPropagation()}>
                            <button
                                onClick={() => setFotoVisualizacaoModal(false)}
                                className="absolute top-4 right-4 p-2 bg-black/60 text-white rounded-full hover:bg-black cursor-pointer z-10"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <img src={fotoInspecaoPreview} alt="Evidência" className="w-full h-auto rounded-xl object-contain max-h-[80vh]" />
                        </div>
                    </div>
                )}

            </div>

        </div>
    );
}
