import React, { useState, useEffect, useCallback } from 'react';
import { api, getProductDocuments, getFileUrl } from '../../services/api';
import { toast } from 'react-toastify';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { logoBase64 as metalfisaLogoBase64 } from '../../services/metalfisaLogoBase64';
import EmailMontagemModal from '../../components/EmailMontagemModal';
import {
    Plus, Search, Package, User, CheckCircle, Clock,
    XCircle, AlertCircle, ChevronDown, ChevronUp, RefreshCw, Loader2, FileText, FileSpreadsheet,
    LayoutGrid, List, Mail
} from 'lucide-react';

const STATUS_CONFIG = {
    PENDENTE:    { label: 'Pendente',     color: 'bg-yellow-100 text-yellow-800 border-yellow-300', dot: 'bg-yellow-400', icon: Clock },
    EM_ANDAMENTO:{ label: 'Em Andamento', color: 'bg-blue-100 text-blue-800 border-blue-300',       dot: 'bg-blue-400',   icon: AlertCircle },
    ENTREGUE:    { label: 'Entregue',     color: 'bg-green-100 text-green-800 border-green-300',    dot: 'bg-green-500',  icon: CheckCircle },
    CANCELADO:   { label: 'Cancelado',    color: 'bg-slate-100 text-slate-500 border-slate-200',    dot: 'bg-slate-400',  icon: XCircle },
};

function StatusBadge({ status }) {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDENTE;
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.color}`}>
            <Icon size={11} /> {cfg.label}
        </span>
    );
}

function NovaSolicitacaoModal({ onClose, onSaved, usuario }) {
    const [tipoBusca, setTipoBusca] = useState('op'); // 'op' | 'produto'
    const [opNumero, setOpNumero] = useState('');
    const [codigoProduto, setCodigoProduto] = useState('');
    const [opInfo, setOpInfo] = useState(null);
    const [componentes, setComponentes] = useState([]);
    const [resultadosProduto, setResultadosProduto] = useState([]);
    const [loadingOp, setLoadingOp] = useState(false);
    const [modo, setModo] = useState(''); // 'OP' ou 'LIVRE'
    const [compSelecionado, setCompSelecionado] = useState(null);
    const [itemCodigo, setItemCodigo] = useState('');
    const [itemDescricao, setItemDescricao] = useState('');
    const [itemQuantidade, setItemQuantidade] = useState('1');
    const [obsSolicitador, setObsSolicitador] = useState('');
    const [saving, setSaving] = useState(false);

    const buscarOP = async () => {
        if (!opNumero.trim()) return;
        setLoadingOp(true);
        setOpInfo(null);
        setComponentes([]);
        setCompSelecionado(null);
        try {
            const [opRes, compRes] = await Promise.all([
                api.get(`/montagem/op/${opNumero.trim()}`),
                api.get(`/montagem/op/${opNumero.trim()}/componentes`)
            ]);
            setOpInfo(opRes.data);
            setComponentes(compRes.data || []);
        } catch (err) {
            toast.error(err.response?.data?.error || 'OP não encontrada');
        } finally {
            setLoadingOp(false);
        }
    };

    const buscarPorProduto = async () => {
        if (!codigoProduto.trim()) return;
        setLoadingOp(true);
        setResultadosProduto([]);
        setOpInfo(null);
        setComponentes([]);
        setCompSelecionado(null);
        try {
            const res = await api.get(`/montagem/buscar-por-produto/${codigoProduto.trim()}`);
            if (res.data.length === 0) toast.warn('Nenhuma OP encontrada para este produto');
            setResultadosProduto(res.data);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Erro ao buscar produto');
        } finally {
            setLoadingOp(false);
        }
    };

    const selecionarOPdoProduto = async (row) => {
        setOpNumero(row.op_numero);
        setLoadingOp(true);
        setResultadosProduto([]);
        try {
            const [opRes, compRes] = await Promise.all([
                api.get(`/montagem/op/${row.op_numero}`),
                api.get(`/montagem/op/${row.op_numero}/componentes`)
            ]);
            setOpInfo(opRes.data);
            setComponentes(compRes.data || []);
            setItemCodigo(row.produto);
            setItemDescricao(row.descricao);
            setModo('OP');
        } catch {
            toast.error('Erro ao carregar OP');
        } finally {
            setLoadingOp(false);
        }
    };

    const selecionarComponente = (comp) => {
        setCompSelecionado(comp);
        setItemCodigo(comp.codigo);
        setItemDescricao(comp.descricao || comp.codigo);
        setItemQuantidade(String(comp.quantidade || 1));
        setModo('OP');
    };

    const handleSalvar = async () => {
        if (!opNumero.trim()) return toast.error('Informe o número da OP');
        if (!itemDescricao.trim() && !itemCodigo.trim()) return toast.error('Informe o item que está faltando');
        setSaving(true);
        try {
            await api.post('/montagem/solicitacoes', {
                op_numero: opNumero.trim(),
                op_produto: opInfo?.produto || '',
                op_descricao: opInfo?.descricao || '',
                item_codigo: itemCodigo,
                item_descricao: itemDescricao,
                item_quantidade: parseFloat(itemQuantidade) || 1,
                origem_selecao: modo || 'LIVRE',
                obs_solicitador: obsSolicitador,
                solicitador_id: usuario.idUsuario || usuario.id || 0,
                solicitador_nome: usuario.NomeCompleto || usuario.nome || 'Desconhecido'
            });
            toast.success('Solicitação criada!');
            onSaved();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Erro ao criar solicitação');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                    <h2 className="text-base font-bold text-slate-800">Nova Solicitação — Montagem</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><XCircle size={20} /></button>
                </div>

                <div className="overflow-y-auto flex-1 p-5 space-y-4">
                    {/* Tabs busca */}
                    <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm font-semibold">
                        <button
                            onClick={() => { setTipoBusca('op'); setResultadosProduto([]); }}
                            className={`flex-1 py-2 transition-colors ${tipoBusca === 'op' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                        >
                            Buscar por Nº da OP
                        </button>
                        <button
                            onClick={() => { setTipoBusca('produto'); setOpInfo(null); setComponentes([]); }}
                            className={`flex-1 py-2 transition-colors ${tipoBusca === 'produto' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                        >
                            Buscar por Código do Produto
                        </button>
                    </div>

                    {/* Busca por OP */}
                    {tipoBusca === 'op' && (
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Número da OP *</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={opNumero}
                                onChange={e => setOpNumero(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && buscarOP()}
                                placeholder="Ex: 002730"
                                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <button
                                onClick={buscarOP}
                                disabled={loadingOp}
                                className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
                            >
                                {loadingOp ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                                Buscar
                            </button>
                        </div>
                    </div>
                    )}

                    {/* Busca por código do produto */}
                    {tipoBusca === 'produto' && (
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Código do Produto *</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={codigoProduto}
                                onChange={e => setCodigoProduto(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && buscarPorProduto()}
                                placeholder="Ex: MT6-1234"
                                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <button
                                onClick={buscarPorProduto}
                                disabled={loadingOp}
                                className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
                            >
                                {loadingOp ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                                Buscar
                            </button>
                        </div>

                        {/* Resultados OPs do produto */}
                        {resultadosProduto.length > 0 && (
                            <div className="mt-2 border border-slate-200 rounded-lg max-h-60 overflow-y-auto">
                                <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 sticky top-0">
                                    {resultadosProduto.length} OP(s) encontrada(s) — selecione uma
                                </div>
                                {resultadosProduto.map((r, i) => (
                                    <button
                                        key={i}
                                        onClick={() => selecionarOPdoProduto(r)}
                                        className="w-full text-left px-3 py-2.5 border-b border-slate-100 last:border-0 hover:bg-indigo-50 transition-colors"
                                    >
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-bold text-indigo-700 text-sm">OP {r.op_numero}</span>
                                            <span className="font-mono text-slate-700 text-xs bg-slate-100 px-1.5 py-0.5 rounded">{r.produto}</span>
                                            {r.tipo && <span className="text-[10px] bg-indigo-100 text-indigo-600 font-bold px-1 py-0.5 rounded">{r.tipo}</span>}
                                            {r.pedido && <span className="text-slate-400 text-xs">Ped: {r.pedido}</span>}
                                        </div>
                                        <div className="text-slate-600 text-xs mt-0.5">{r.descricao}</div>
                                        <div className="flex gap-3 mt-1 text-[11px] text-slate-500">
                                            <span>Qtd: <strong className="text-slate-700">{r.quantidade?.toLocaleString('pt-BR')} {r.unidade}</strong></span>
                                            {r.data_entrega && <span>Prazo: <strong className="text-slate-700">{r.data_entrega}</strong></span>}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    )}

                    {/* Info da OP */}
                    {opInfo && (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-indigo-800">OP {opInfo.op_numero}</span>
                                {opInfo.tipo && <span className="text-[10px] bg-indigo-200 text-indigo-700 font-bold px-1.5 py-0.5 rounded">{opInfo.tipo}</span>}
                            </div>
                            <div className="font-mono text-indigo-700 text-xs">{opInfo.produto}</div>
                            <div className="text-indigo-800 font-semibold">{opInfo.descricao}</div>
                            <div className="grid grid-cols-3 gap-2 mt-1.5 pt-1.5 border-t border-indigo-200">
                                <div className="text-center">
                                    <div className="text-[10px] text-indigo-400 font-bold uppercase">Qtd OP</div>
                                    <div className="text-indigo-800 font-bold text-sm">{opInfo.quantidade?.toLocaleString('pt-BR')} {opInfo.unidade}</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-[10px] text-indigo-400 font-bold uppercase">Entregue</div>
                                    <div className="text-indigo-800 font-bold text-sm">{opInfo.qtd_entregue?.toLocaleString('pt-BR')} {opInfo.unidade}</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-[10px] text-indigo-400 font-bold uppercase">Prazo</div>
                                    <div className="text-indigo-800 font-bold text-sm">{opInfo.data_entrega || '—'}</div>
                                </div>
                            </div>
                            {opInfo.pedido && <div className="text-indigo-500 text-xs">Pedido: {opInfo.pedido}</div>}
                        </div>
                    )}

                    {/* Componentes da OP */}
                    {componentes.length > 0 && (
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">
                                Selecionar componente da OP <span className="font-normal text-slate-400">(ou preencha manualmente abaixo)</span>
                            </label>
                            <div className="border border-slate-200 rounded-lg max-h-44 overflow-y-auto">
                                {componentes.map((c, i) => (
                                    <button
                                        key={i}
                                        onClick={() => selecionarComponente(c)}
                                        className={`w-full text-left px-3 py-2 text-sm border-b border-slate-100 last:border-0 hover:bg-indigo-50 transition-colors ${compSelecionado?.codigo === c.codigo ? 'bg-indigo-100 font-semibold' : ''}`}
                                    >
                                        <span className="font-mono text-indigo-700">{c.codigo}</span>
                                        <span className="text-slate-600 ml-2">{c.descricao}</span>
                                        <span className="text-slate-400 ml-2 text-xs">Qtd: {c.quantidade} {c.unidade}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Item livre */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Código do Item</label>
                            <input
                                type="text"
                                value={itemCodigo}
                                onChange={e => { setItemCodigo(e.target.value); setModo('LIVRE'); setCompSelecionado(null); }}
                                placeholder="Ex: MT6-1234"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Quantidade</label>
                            <input
                                type="number"
                                min="0.001"
                                step="0.001"
                                value={itemQuantidade}
                                onChange={e => setItemQuantidade(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Descrição do Item *</label>
                        <input
                            type="text"
                            value={itemDescricao}
                            onChange={e => { setItemDescricao(e.target.value); if (!compSelecionado) setModo('LIVRE'); }}
                            placeholder="O que está faltando?"
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Observação do Solicitador</label>
                        <textarea
                            value={obsSolicitador}
                            onChange={e => setObsSolicitador(e.target.value)}
                            rows={3}
                            placeholder="Informações adicionais sobre a peça ou urgência..."
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        />
                    </div>
                </div>

                <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                    <button
                        onClick={handleSalvar}
                        disabled={saving}
                        className="px-5 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                        Criar Solicitação
                    </button>
                </div>
            </div>
        </div>
    );
}

function EntregarModal({ solicitacao, onClose, onSaved, usuario }) {
    const [obs, setObs] = useState('');
    const [saving, setSaving] = useState(false);

    const handleEntregar = async () => {
        setSaving(true);
        try {
            await api.patch(`/montagem/solicitacoes/${solicitacao.id}/status`, {
                status: 'ENTREGUE',
                obs_entregador: obs,
                entregador_id: usuario.idUsuario || usuario.id || 0,
                entregador_nome: usuario.NomeCompleto || usuario.nome || 'Desconhecido'
            });
            toast.success('Marcado como entregue!');
            onSaved();
            onClose();
        } catch {
            toast.error('Erro ao registrar entrega');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                    <h2 className="text-base font-bold text-slate-800">Confirmar Entrega</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><XCircle size={20} /></button>
                </div>
                <div className="p-5 space-y-4">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                        <div className="font-semibold text-green-800">OP {solicitacao.op_numero}</div>
                        <div className="text-green-700">{solicitacao.item_codigo && <span className="font-mono mr-1">{solicitacao.item_codigo}</span>}{solicitacao.item_descricao}</div>
                        <div className="text-green-600 text-xs mt-0.5">Qtd: {solicitacao.item_quantidade}</div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Observação do Entregador</label>
                        <textarea
                            value={obs}
                            onChange={e => setObs(e.target.value)}
                            rows={3}
                            placeholder="Local onde encontrou, observações da entrega..."
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                        />
                    </div>
                    <div className="text-xs text-slate-500">Entregador: <strong>{usuario.nome}</strong></div>
                </div>
                <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                    <button
                        onClick={handleEntregar}
                        disabled={saving}
                        className="px-5 py-2 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                        Confirmar Entrega
                    </button>
                </div>
            </div>
        </div>
    );
}

function SolicitacaoCard({ item, onEntregar, onCancelar, onAndamento, onOpenDrawing }) {
    const [expandido, setExpandido] = useState(false);

    return (
        <div className={`bg-white border rounded-xl shadow-sm overflow-hidden transition-all ${item.status === 'CANCELADO' ? 'opacity-60' : ''}`}>
            <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-800 text-sm">OP {item.op_numero}</span>
                            <StatusBadge status={item.status} />
                            {item.origem_selecao === 'OP' && (
                                <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium">da estrutura</span>
                            )}
                        </div>
                        {item.op_descricao && <div className="text-xs text-slate-500 mt-0.5 truncate">{item.op_produto} — {item.op_descricao}</div>}
                        <div className="mt-2 flex items-center gap-2">
                            <Package size={14} className="text-indigo-500 flex-shrink-0" />
                            <span className="text-sm font-semibold text-slate-700 flex items-center">
                                {item.item_codigo && <span className="font-mono text-indigo-600 mr-1">{item.item_codigo}</span>}
                                {item.item_descricao}
                                {item.item_codigo && (
                                    <button onClick={(e) => { e.stopPropagation(); onOpenDrawing(item.item_codigo); }} className="ml-1.5 p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded" title="Abrir Desenho (PDF)">
                                        <FileText size={14} />
                                    </button>
                                )}
                            </span>
                            <span className="text-xs text-slate-400 ml-auto">Qtd: {parseFloat(item.item_quantidade)}</span>
                        </div>
                    </div>
                    <button onClick={() => setExpandido(v => !v)} className="text-slate-400 hover:text-slate-600 mt-0.5">
                        {expandido ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                </div>

                <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                    <User size={12} className="flex-shrink-0" />
                    <span><strong>{item.solicitador_nome}</strong> • {new Date(item.criado_em).toLocaleString('pt-BR')}</span>
                </div>
            </div>

            {expandido && (
                <div className="border-t border-slate-100 px-4 py-3 bg-slate-50 space-y-3 text-sm">
                    {item.obs_solicitador && (
                        <div>
                            <div className="text-xs font-semibold text-slate-500 mb-0.5">Obs. Solicitador</div>
                            <p className="text-slate-700 bg-white border border-slate-200 rounded p-2 text-xs">{item.obs_solicitador}</p>
                        </div>
                    )}
                    {item.entregador_nome && (
                        <div>
                            <div className="text-xs font-semibold text-slate-500 mb-0.5">Entregador</div>
                            <p className="text-slate-700 text-xs"><strong>{item.entregador_nome}</strong> • {item.entregue_em && new Date(item.entregue_em).toLocaleString('pt-BR')}</p>
                        </div>
                    )}
                    {item.obs_entregador && (
                        <div>
                            <div className="text-xs font-semibold text-slate-500 mb-0.5">Obs. Entregador</div>
                            <p className="text-slate-700 bg-white border border-slate-200 rounded p-2 text-xs">{item.obs_entregador}</p>
                        </div>
                    )}
                </div>
            )}

            {(item.status === 'PENDENTE' || item.status === 'EM_ANDAMENTO') && (
                <div className="border-t border-slate-100 px-4 py-2.5 flex items-center gap-2 bg-white">
                    {item.status === 'PENDENTE' && (
                        <button
                            onClick={() => onAndamento(item)}
                            className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
                        >
                            Em Andamento
                        </button>
                    )}
                    <button
                        onClick={() => onEntregar(item)}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 flex items-center gap-1"
                    >
                        <CheckCircle size={12} /> Entregar
                    </button>
                    <button
                        onClick={() => onCancelar(item)}
                        className="ml-auto px-3 py-1.5 text-xs text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                        Cancelar
                    </button>
                </div>
            )}
        </div>
    );
}

export default function MontagemSolicitacoes() {
    const [solicitacoes, setSolicitacoes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtroStatus, setFiltroStatus] = useState('TODOS');
    const [filtroOp, setFiltroOp] = useState('');
    const [filtroItem, setFiltroItem] = useState('');
    const [modalNova, setModalNova] = useState(false);
    const [modalEntregar, setModalEntregar] = useState(null);
    const [viewMode, setViewMode] = useState('cards'); // 'cards' ou 'table'
    const [emailModalOpen, setEmailModalOpen] = useState(false);
    const [emailPdfBlob, setEmailPdfBlob] = useState(null);
    const [emailPdfName, setEmailPdfName] = useState('');

    const usuario = JSON.parse(localStorage.getItem('@Lynx:user') || '{}');

    const carregar = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (filtroStatus !== 'TODOS') params.status = filtroStatus;
            if (filtroOp.trim())   params.op   = filtroOp.trim();
            if (filtroItem.trim()) params.item  = filtroItem.trim();
            const res = await api.get('/montagem/solicitacoes', { params });
            setSolicitacoes(res.data);
        } catch {
            toast.error('Erro ao carregar solicitações');
        } finally {
            setLoading(false);
        }
    }, [filtroStatus, filtroOp, filtroItem]);

    useEffect(() => { carregar(); }, [carregar]);

    const handleAndamento = async (item) => {
        try {
            await api.patch(`/montagem/solicitacoes/${item.id}/status`, { status: 'EM_ANDAMENTO' });
            toast.success('Status atualizado!');
            carregar();
        } catch { toast.error('Erro ao atualizar'); }
    };

    const handleCancelar = async (item) => {
        if (!window.confirm(`Cancelar solicitação da OP ${item.op_numero}?`)) return;
        try {
            await api.delete(`/montagem/solicitacoes/${item.id}`);
            toast.success('Solicitação cancelada');
            carregar();
        } catch { toast.error('Erro ao cancelar'); }
    };

    const handleExportExcel = () => {
        if (solicitacoes.length === 0) {
            toast.error('Não há dados para exportar');
            return;
        }

        const data = solicitacoes.map(s => ({
            'OP': s.op_numero,
            'Produto (OP)': s.op_produto ? `${s.op_produto} - ${s.op_descricao}` : '-',
            'Item Solicitado': `${s.item_codigo} - ${s.item_descricao}`,
            'Qtd': Number(s.item_quantidade || 0),
            'Status': STATUS_CONFIG[s.status]?.label || s.status,
            'Solicitante': s.solicitador_nome,
            'Data Solicitação': new Date(s.criado_em).toLocaleString('pt-BR'),
            'Entregador': s.entregador_nome || '-',
            'Data Entrega': s.entregue_em ? new Date(s.entregue_em).toLocaleString('pt-BR') : '-'
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Montagem');
        XLSX.writeFile(wb, `Solicitacoes_Montagem_${new Date().toISOString().slice(0,10)}.xlsx`);
    };

    const generateMontagemPdfDoc = () => {
        if (solicitacoes.length === 0) return null;

        const doc = new jsPDF('landscape', 'pt', 'A4');
        
        if (metalfisaLogoBase64) {
            doc.addImage(metalfisaLogoBase64, 'PNG', 40, 30, 100, 30);
        }
        
        doc.setFontSize(16);
        doc.setTextColor(40, 40, 40);
        doc.text('Lista de Separação / Entrega de Montagem', 160, 45);
        
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Emissão: ${new Date().toLocaleString('pt-BR')}  |  Impresso por: ${usuario?.NomeCompleto || usuario?.nome || 'Sistema'}`, 160, 60);

        const tableColumn = ["OP", "Produto OP", "Item Solicitado", "Solicitante", "Qtd Solicit.", "Qtd Entregue", "Data/Hora", "Assinatura Recebedor"];
        const tableRows = [];

        solicitacoes.forEach(s => {
            const data = [
                s.op_numero,
                `${s.op_produto || '-'}\n${s.op_descricao || ''}`.trim(),
                `${s.item_codigo || '-'}\n${s.item_descricao || ''}`.trim(),
                s.solicitador_nome,
                s.item_quantidade,
                "", // Qtd Entregue
                "", // Data/Hora
                ""  // Assinatura Recebedor
            ];
            tableRows.push(data);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 80,
            styles: { fontSize: 8, cellPadding: 8, valign: 'middle' },
            headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], halign: 'center' },
            columnStyles: {
                0: { cellWidth: 50 },
                1: { cellWidth: 150 },
                2: { cellWidth: 150 },
                3: { cellWidth: 80 },
                4: { cellWidth: 50, halign: 'center' },
                5: { cellWidth: 60 },
                6: { cellWidth: 80 },
                7: { cellWidth: 100 }
            },
            alternateRowStyles: { fillColor: [250, 250, 250] }
        });

        return doc;
    };

    const handleExportPdf = () => {
        const doc = generateMontagemPdfDoc();
        if (!doc) {
            toast.error('Não há dados para exportar');
            return;
        }
        doc.save(`Solicitacoes_Montagem_${new Date().toISOString().slice(0,10)}.pdf`);
    };

    const handleOpenEmailModal = () => {
        const doc = generateMontagemPdfDoc();
        if (!doc) {
            toast.error('Não há dados para exportar por e-mail');
            return;
        }
        const blob = doc.output('blob');
        setEmailPdfBlob(blob);
        setEmailPdfName(`Solicitacoes_Montagem_${new Date().toISOString().slice(0,10)}.pdf`);
        setEmailModalOpen(true);
    };

    const counts = solicitacoes.reduce((acc, s) => {
        acc[s.status] = (acc[s.status] || 0) + 1;
        return acc;
    }, {});

    const handleOpenDrawing = async (codigo) => {
        try {
            const data = await getProductDocuments(codigo);
            const desenho = data.find(d => d.tipo === 'Desenho' || d.titulo_desenho);
            if (desenho && desenho.url_arquivo) {
                window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(desenho.url_arquivo)}`), '_blank');
            } else {
                toast.warning('Nenhum desenho encontrado para este item.');
            }
        } catch (err) {
            toast.error('Erro ao buscar o desenho do item.');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="px-6 py-5">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">Pendências da Montagem</h1>
                        <p className="text-sm text-slate-500 mt-0.5">Solicitações de peças para o setor de montagem</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleExportExcel} title="Exportar Excel" className="p-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200">
                            <FileSpreadsheet size={16} />
                        </button>
                        <button onClick={handleExportPdf} title="Exportar PDF" className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200">
                            <FileText size={16} />
                        </button>
                        <button onClick={handleOpenEmailModal} title="Enviar por E-mail" className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200">
                            <Mail size={16} />
                        </button>
                        <button onClick={carregar} className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg">
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <div className="w-px h-6 bg-slate-300 mx-1"></div>
                        <div className="flex bg-slate-200 rounded-lg p-0.5">
                            <button onClick={() => setViewMode('cards')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'cards' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`} title="Ver em Cards">
                                <LayoutGrid size={16} />
                            </button>
                            <button onClick={() => setViewMode('table')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`} title="Ver em Tabela">
                                <List size={16} />
                            </button>
                        </div>
                        <div className="w-px h-6 bg-slate-300 mx-1"></div>
                        <button
                            onClick={() => setModalNova(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700"
                        >
                            <Plus size={16} /> Nova Solicitação
                        </button>
                    </div>
                </div>

                {/* Contadores */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                        <button
                            key={key}
                            onClick={() => setFiltroStatus(filtroStatus === key ? 'TODOS' : key)}
                            className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${filtroStatus === key ? cfg.color + ' border-current' : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'}`}
                        >
                            <span className={`w-3 h-3 rounded-full flex-shrink-0 ${cfg.dot}`} />
                            <div>
                                <div className="text-2xl font-bold leading-none">{counts[key] || 0}</div>
                                <div className="text-xs text-slate-500 mt-1">{cfg.label}</div>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Filtros */}
                <div className="flex gap-3 mb-4">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={filtroOp}
                            onChange={e => setFiltroOp(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && carregar()}
                            placeholder="Filtrar por OP..."
                            className="w-44 pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div className="relative">
                        <Package size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={filtroItem}
                            onChange={e => setFiltroItem(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && carregar()}
                            placeholder="Cód. ou desc. do produto..."
                            className="w-56 pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <select
                        value={filtroStatus}
                        onChange={e => setFiltroStatus(e.target.value)}
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                        <option value="TODOS">Todos os status</option>
                        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                        ))}
                    </select>
                </div>

                {/* Lista */}
                {loading ? (
                    <div className="flex items-center justify-center py-16 text-slate-400">
                        <Loader2 size={28} className="animate-spin mr-2" /> Carregando...
                    </div>
                ) : solicitacoes.length === 0 ? (
                    <div className="text-center py-16 text-slate-400">
                        <Package size={40} className="mx-auto mb-3 opacity-40" />
                        <p className="text-sm">Nenhuma solicitação encontrada</p>
                        <button onClick={() => setModalNova(true)} className="mt-3 text-indigo-600 text-sm font-semibold hover:underline">
                            Criar a primeira
                        </button>
                    </div>
                ) : (
                    <>
                        {viewMode === 'cards' ? (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                                {solicitacoes.map(item => (
                                    <SolicitacaoCard
                                        key={item.id}
                                        item={item}
                                        onEntregar={setModalEntregar}
                                        onCancelar={handleCancelar}
                                        onAndamento={handleAndamento}
                                        onOpenDrawing={handleOpenDrawing}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold">OP / Produto</th>
                                            <th className="px-4 py-3 font-semibold">Item Solicitado</th>
                                            <th className="px-4 py-3 font-semibold">Status</th>
                                            <th className="px-4 py-3 font-semibold">Solicitante / Entregador</th>
                                            <th className="px-4 py-3 font-semibold text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {solicitacoes.map(item => (
                                            <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${item.status === 'CANCELADO' ? 'opacity-60' : ''}`}>
                                                <td className="px-4 py-3">
                                                    <div className="font-bold text-slate-800 flex items-center gap-2">
                                                        OP {item.op_numero}
                                                        <StatusBadge status={item.status} />
                                                        {item.origem_selecao === 'OP' && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">estrutura</span>}
                                                    </div>
                                                    <div className="text-xs text-slate-500 truncate max-w-[200px]" title={`${item.op_produto || ''} ${item.op_descricao || ''}`}>{item.op_produto} — {item.op_descricao}</div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-1">
                                                        {item.item_codigo && <span className="font-mono text-indigo-600 font-semibold">{item.item_codigo}</span>}
                                                        {item.item_codigo && (
                                                            <button onClick={() => handleOpenDrawing(item.item_codigo)} className="p-1 text-slate-400 hover:text-indigo-600 rounded" title="Abrir Desenho">
                                                                <FileText size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-slate-700 max-w-[250px] truncate" title={item.item_descricao}>{item.item_descricao}</div>
                                                    <div className="text-xs text-slate-400 mt-0.5">Qtd: {parseFloat(item.item_quantidade)}</div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="text-xs font-medium text-slate-600">{STATUS_CONFIG[item.status]?.label}</div>
                                                    <div className="text-[10px] text-slate-400">{new Date(item.criado_em).toLocaleDateString('pt-BR')}</div>
                                                </td>
                                                <td className="px-4 py-3 text-xs">
                                                    <div className="text-slate-700 flex items-center"><User size={10} className="mr-1"/>{item.solicitador_nome}</div>
                                                    {item.entregador_nome && <div className="text-slate-500 mt-0.5 flex items-center"><CheckCircle size={10} className="mr-1 text-green-500"/>{item.entregador_nome}</div>}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {(item.status === 'PENDENTE' || item.status === 'EM_ANDAMENTO') && (
                                                        <div className="flex items-center justify-end gap-2">
                                                            {item.status === 'PENDENTE' && (
                                                                <button onClick={() => handleAndamento(item)} className="px-2 py-1 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100">
                                                                    Em Andamento
                                                                </button>
                                                            )}
                                                            <button onClick={() => setModalEntregar(item)} className="px-2 py-1 text-xs font-bold text-white bg-green-600 rounded hover:bg-green-700 flex items-center gap-1">
                                                                <CheckCircle size={12} /> Entregar
                                                            </button>
                                                            <button onClick={() => handleCancelar(item)} className="px-2 py-1 text-xs text-slate-500 hover:text-red-600 hover:bg-red-50 rounded" title="Cancelar">
                                                                <XCircle size={14} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
            </div>

            {modalNova && (
                <NovaSolicitacaoModal
                    onClose={() => setModalNova(false)}
                    onSaved={carregar}
                    usuario={usuario}
                />
            )}
            
            <EmailMontagemModal
                isOpen={emailModalOpen}
                onClose={() => setEmailModalOpen(false)}
                pdfBlob={emailPdfBlob}
                fileName={emailPdfName}
            />

            {modalEntregar && (
                <EntregarModal
                    solicitacao={modalEntregar}
                    onClose={() => setModalEntregar(null)}
                    onSaved={carregar}
                    usuario={usuario}
                />
            )}
        </div>
    );
}
