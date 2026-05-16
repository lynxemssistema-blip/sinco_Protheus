import React, { useState, useEffect, useRef } from 'react';
import { Shield, Search, CheckCircle, AlertTriangle, Clock, Filter, Printer, FileText, Camera, X } from 'lucide-react';
import { getAllRncs, updateRnc, getSgqNaoConformidades, getProcessList } from '../../services/api';
import { generateRNCPdf, generateSingleRNCPdf } from '../../services/rncPdfGenerator';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';

export default function GestaoRNCs() {
    const { user } = useAuth();
    const [rncs, setRncs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState('');
    
    // Treat RNC Modal
    const [treatingRnc, setTreatingRnc] = useState(null);
    const [tratativaObs, setTratativaObs] = useState('');
    const [tratativaStatus, setTratativaStatus] = useState('CONCLUIDO');
    const [fotosTratativa, setFotosTratativa] = useState([]);

    // Novas Variáveis F097 (Tratativa)
    const [w2hOQue, setW2hOQue] = useState('');
    const [w2hQuem, setW2hQuem] = useState('');
    const [w2hQuando, setW2hQuando] = useState('');
    const [w2hOnde, setW2hOnde] = useState('');
    const [w2hPorQue, setW2hPorQue] = useState('');
    const [w2hQuantidade, setW2hQuantidade] = useState('');
    const [w2hFrequencia, setW2hFrequencia] = useState('');

    const [disposicaoRetrabalho, setDisposicaoRetrabalho] = useState(false);
    const [disposicaoNovaPeca, setDisposicaoNovaPeca] = useState(false);
    
    const [eficAcoesImplementadas, setEficAcoesImplementadas] = useState('');
    const [eficCorrigiram, setEficCorrigiram] = useState('');
    const [eficReincidencia, setEficReincidencia] = useState('');
    const [eficEficazes, setEficEficazes] = useState('');
    const [eficConclusao, setEficConclusao] = useState('');

    const [naoConformidades, setNaoConformidades] = useState([]);
    const [recursos, setRecursos] = useState([]);
    
    // Edit Abertura State
    const [isEditingAbertura, setIsEditingAbertura] = useState(false);
    const [aberturaRecurso, setAberturaRecurso] = useState('');
    const [aberturaNc, setAberturaNc] = useState('');
    const [aberturaOrigem, setAberturaOrigem] = useState('');
    const [aberturaResp, setAberturaResp] = useState('');
    const [aberturaSetorEnvolvido, setAberturaSetorEnvolvido] = useState('');
    const [aberturaSetorOrigem, setAberturaSetorOrigem] = useState('');
    const [aberturaLocalDet, setAberturaLocalDet] = useState('');
    const [aberturaQtd, setAberturaQtd] = useState('');
    const [aberturaObs, setAberturaObs] = useState('');

    const fileInputRef = useRef(null);

    useEffect(() => {
        loadData();
        loadBaseData();
    }, [statusFilter]);

    const loadBaseData = async () => {
        try {
            const [ncRes, recRes] = await Promise.all([
                getSgqNaoConformidades(),
                getProcessList()
            ]);
            setNaoConformidades(ncRes || []);
            setRecursos(Array.isArray(recRes) ? recRes : (recRes?.data || []));
        } catch (e) {
            console.error('Erro ao carregar dados base', e);
        }
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await getAllRncs({ status: statusFilter });
            setRncs(data || []);
        } catch (error) {
            console.error('Erro ao buscar RNCs:', error);
            toast.error('Falha ao carregar lista de RNCs.');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveTratativa = async () => {
        try {
            const userName = user?.nome || user?.login || 'Sistema';
            const dataAgora = new Date().toLocaleString('pt-BR');
            const novaAnotacao = tratativaObs.trim() ? `[${dataAgora} por ${userName}]: ${tratativaObs}` : '';
            
            const historicoAtual = treatingRnc.tratativa_resposta ? treatingRnc.tratativa_resposta + (novaAnotacao ? '\n\n' : '') : '';
            const novoHistorico = historicoAtual + novaAnotacao;

            let existingF097 = {};
            if (treatingRnc.f097_dados) {
                try {
                    existingF097 = JSON.parse(treatingRnc.f097_dados);
                } catch(e) {}
            }

            const f097Updated = {
                ...existingF097,
                registro: {
                    ...(existingF097.registro || {}),
                    origem: aberturaOrigem,
                    responsavel_qualidade: aberturaResp,
                    local_deteccao: aberturaLocalDet,
                    setor_envolvido: aberturaSetorEnvolvido,
                    setor_origem: aberturaSetorOrigem,
                    qtd_nao_conforme: aberturaQtd
                },
                tratativa: {
                    w2h_o_que: w2hOQue,
                    w2h_quem: w2hQuem,
                    w2h_quando: w2hQuando,
                    w2h_onde: w2hOnde,
                    w2h_por_que: w2hPorQue,
                    w2h_quantidade: w2hQuantidade,
                    w2h_frequencia: w2hFrequencia,
                    disposicao_retrabalho: disposicaoRetrabalho,
                    disposicao_nova_peca: disposicaoNovaPeca,
                    efic_acoes_implementadas: eficAcoesImplementadas,
                    efic_corrigiram: eficCorrigiram,
                    efic_reincidencia: eficReincidencia,
                    efic_eficazes: eficEficazes,
                    efic_conclusao: eficConclusao
                }
            };

            await updateRnc(treatingRnc.id, {
                status: tratativaStatus,
                tratativa_resposta: novoHistorico,
                tratado_por: userName,
                fotos_tratativa: fotosTratativa.length > 0 ? fotosTratativa : undefined,
                f097_dados: JSON.stringify(f097Updated),
                recurso_inconformidade: aberturaRecurso,
                nao_conformidade_id: aberturaNc,
                observacao: aberturaObs
            });
            toast.success('RNC atualizada com sucesso!');
            setTreatingRnc(null);
            setIsEditingAbertura(false);
            setTratativaObs('');
            setFotosTratativa([]);
            loadData();
        } catch (error) {
            console.error('Erro ao atualizar RNC:', error);
            toast.error('Falha ao salvar tratativa.');
        }
    };

    const handlePhotoUpload = (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        files.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFotosTratativa(prev => [...prev, reader.result]);
            };
            reader.readAsDataURL(file);
        });
    };

    const removeFoto = (indexToRemove) => {
        setFotosTratativa(prev => prev.filter((_, i) => i !== indexToRemove));
    };

    const handlePrint = () => {
        if (rncs.length === 0) {
            toast.warning('Não há dados para gerar o relatório.');
            return;
        }
        generateRNCPdf(rncs, { status: statusFilter }, user);
    };

    const getStatusBadge = (status) => {
        if (status === 'CONCLUIDO') return <span className="px-2 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full text-[10px] font-bold flex items-center gap-1 w-max"><CheckCircle className="w-3 h-3"/> CONCLUÍDO</span>;
        if (status === 'EM ANDAMENTO') return <span className="px-2 py-1 bg-amber-100 text-amber-800 border border-amber-200 rounded-full text-[10px] font-bold flex items-center gap-1 w-max"><Clock className="w-3 h-3"/> EM ANDAMENTO</span>;
        return <span className="px-2 py-1 bg-rose-100 text-rose-800 border border-rose-200 rounded-full text-[10px] font-bold flex items-center gap-1 w-max"><AlertTriangle className="w-3 h-3"/> ABERTO</span>;
    };

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Shield className="w-7 h-7 text-indigo-600" />
                        Gestão Global de RNCs
                    </h1>
                    <p className="text-sm text-slate-600 mt-1">Controle e acompanhamento de Não-Conformidades da produção.</p>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-4 flex gap-3 items-center">
                <div className="flex items-center gap-2 font-medium text-sm text-slate-600">
                    <Filter className="w-4 h-4" /> Filtro de Status:
                </div>
                <select 
                    className="border rounded px-3 py-1.5 text-sm outline-none focus:border-indigo-500"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="">Todas as RNCs</option>
                    <option value="ABERTO">Abertas</option>
                    <option value="EM ANDAMENTO">Em Andamento</option>
                    <option value="CONCLUIDO">Concluídas</option>
                </select>
                <div className="ml-auto flex items-center gap-2">
                    <button onClick={handlePrint} className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded text-sm font-bold border border-slate-200 hover:bg-slate-200 transition-colors flex items-center gap-1">
                        <Printer className="w-4 h-4" />
                        Imprimir PDF
                    </button>
                    <button onClick={loadData} className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded text-sm font-bold border border-indigo-200 hover:bg-indigo-100 transition-colors">
                        Atualizar Lista
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-10 text-slate-500 font-medium animate-pulse">Carregando RNCs...</div>
            ) : rncs.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border p-10 text-center text-slate-500">
                    Nenhuma RNC encontrada para este filtro.
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-600 border-b">
                            <tr>
                                <th className="px-4 py-3 font-semibold">ID</th>
                                <th className="px-4 py-3 font-semibold">Status</th>
                                <th className="px-4 py-3 font-semibold">Rastreabilidade</th>
                                <th className="px-4 py-3 font-semibold">Problema / Máquina</th>
                                <th className="px-4 py-3 font-semibold">Criado Por</th>
                                <th className="px-4 py-3 font-semibold text-right">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {rncs.map(rnc => (
                                <tr key={rnc.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3 font-mono font-bold text-slate-400">#{rnc.id}</td>
                                    <td className="px-4 py-3">{getStatusBadge(rnc.status)}</td>
                                    <td className="px-4 py-3">
                                        <div className="font-bold text-slate-800 text-xs">OP: {rnc.op}-{rnc.item_op} ({rnc.sequen_op})</div>
                                        <div className="text-[10px] text-slate-500">PV: {rnc.pedido || 'N/A'}</div>
                                        <div className="text-[10px] text-indigo-600 font-semibold truncate max-w-[200px]" title={rnc.produto}>{rnc.produto}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="font-bold text-slate-700 text-xs flex items-center gap-1">
                                            {rnc.nc_descricao || 'Outro / Não Listado'}
                                            {rnc.imagem_evidencia && (
                                                <button onClick={() => window.open(rnc.imagem_evidencia)} className="text-blue-500 hover:text-blue-700 p-0.5 bg-blue-50 rounded border border-blue-200 ml-1" title="Ver Foto">
                                                    <FileText className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                        <div className="text-[10px] text-slate-500 mt-0.5">Recurso: {rnc.recurso_inconformidade}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="text-xs font-semibold text-slate-600">{rnc.criado_por}</div>
                                        <div className="text-[10px] text-slate-400">{new Date(rnc.data_criacao).toLocaleDateString('pt-BR')}</div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => {
                                                setTreatingRnc(rnc);
                                                setTratativaStatus(rnc.status === 'ABERTO' ? 'EM ANDAMENTO' : rnc.status);
                                                setTratativaObs('');
                                                setFotosTratativa([]);
                                                
                                                // Load Edit Abertura
                                                setAberturaRecurso(rnc.recurso_inconformidade || '');
                                                setAberturaNc(rnc.nao_conformidade_id || '');
                                                setAberturaObs(rnc.observacao || '');
                                                
                                                if (rnc.f097_dados) {
                                                    try {
                                                        const fData = JSON.parse(rnc.f097_dados);
                                                        const tData = fData.tratativa || {};
                                                        const rData = fData.registro || {};
                                                        setW2hOQue(tData.w2h_o_que || '');
                                                        setW2hQuem(tData.w2h_quem || '');
                                                        setW2hQuando(tData.w2h_quando || '');
                                                        setW2hOnde(tData.w2h_onde || '');
                                                        setW2hPorQue(tData.w2h_por_que || '');
                                                        setW2hQuantidade(tData.w2h_quantidade || '');
                                                        setW2hFrequencia(tData.w2h_frequencia || '');
                                                        setDisposicaoRetrabalho(!!tData.disposicao_retrabalho);
                                                        setDisposicaoNovaPeca(!!tData.disposicao_nova_peca);
                                                        setEficAcoesImplementadas(tData.efic_acoes_implementadas || '');
                                                        setEficCorrigiram(tData.efic_corrigiram || '');
                                                        setEficReincidencia(tData.efic_reincidencia || '');
                                                        setEficEficazes(tData.efic_eficazes || '');
                                                        setEficConclusao(tData.efic_conclusao || '');

                                                        setAberturaOrigem(rData.origem || '');
                                                        setAberturaResp(rData.responsavel_qualidade || '');
                                                        setAberturaLocalDet(rData.local_deteccao || '');
                                                        setAberturaSetorEnvolvido(rData.setor_envolvido || '');
                                                        setAberturaSetorOrigem(rData.setor_origem || '');
                                                        setAberturaQtd(rData.qtd_nao_conforme || '');
                                                    } catch(e) {
                                                        console.error('Erro ao ler f097_dados', e);
                                                    }
                                                } else {
                                                    setW2hOQue(''); setW2hQuem(''); setW2hQuando(''); setW2hOnde('');
                                                    setW2hPorQue(''); setW2hQuantidade(''); setW2hFrequencia('');
                                                    setDisposicaoRetrabalho(false); setDisposicaoNovaPeca(false);
                                                    setEficAcoesImplementadas(''); setEficCorrigiram(''); setEficReincidencia('');
                                                    setEficEficazes(''); setEficConclusao('');
                                                    
                                                    setAberturaOrigem(''); setAberturaResp(''); setAberturaLocalDet('');
                                                    setAberturaSetorEnvolvido(''); setAberturaSetorOrigem(''); setAberturaQtd('');
                                                }
                                            }}
                                            className="text-[10px] font-bold px-3 py-1.5 rounded border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
                                        >
                                            {rnc.status === 'CONCLUIDO' ? 'VER DETALHES' : 'TRATAR RNC'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal de Tratativa */}
            {treatingRnc && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b bg-slate-800 text-white">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <Shield className="w-5 h-5 text-indigo-400" />
                                Tratativa de RNC #{treatingRnc.id}
                            </h2>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => generateSingleRNCPdf(treatingRnc)}
                                    className="text-xs font-bold px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded flex items-center gap-1 transition-colors"
                                    title="Baixar F 097-22 em PDF"
                                >
                                    <Printer className="w-4 h-4" />
                                    PDF F097
                                </button>
                                <button onClick={() => setTreatingRnc(null)} className="p-2 hover:bg-slate-700 rounded-full transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        
                        <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
                            
                            {/* Resumo da RNC */}
                            <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-sm">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="grid grid-cols-2 gap-2 flex-1">
                                        <div><span className="text-slate-500">OP:</span> <strong>{treatingRnc.op}-{treatingRnc.item_op}</strong></div>
                                        <div><span className="text-slate-500">Pedido:</span> <strong>{treatingRnc.pedido}</strong></div>
                                        <div className="col-span-2"><span className="text-slate-500">Produto:</span> <strong>{treatingRnc.produto}</strong></div>
                                        <div className="col-span-2"><span className="text-slate-500">Defeito:</span> <strong className="text-red-600">{treatingRnc.nc_descricao}</strong></div>
                                        <div className="col-span-2"><span className="text-slate-500">Recurso:</span> <strong>{treatingRnc.recurso_inconformidade}</strong></div>
                                    </div>
                                    {treatingRnc.status !== 'CONCLUIDO' && (
                                        <button 
                                            onClick={() => setIsEditingAbertura(!isEditingAbertura)}
                                            className="text-xs font-bold px-2 py-1 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded"
                                        >
                                            {isEditingAbertura ? 'Cancelar Edição' : 'Editar Abertura'}
                                        </button>
                                    )}
                                </div>
                                
                                {isEditingAbertura ? (
                                    <div className="bg-white border rounded p-3 mt-3 shadow-inner grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase">Origem</label>
                                            <select value={aberturaOrigem} onChange={e => setAberturaOrigem(e.target.value)} className="w-full border rounded p-1.5 text-xs bg-slate-50">
                                                <option value="">Selecione...</option><option value="Interna">Interna</option><option value="Fornecedor">Fornecedor</option><option value="Cliente">Cliente</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase">Resp. Qualidade</label>
                                            <input type="text" value={aberturaResp} onChange={e => setAberturaResp(e.target.value)} className="w-full border rounded p-1.5 text-xs bg-slate-50" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase">Setor Envolvido (Recurso)</label>
                                            <select value={aberturaRecurso} onChange={e => {
                                                setAberturaRecurso(e.target.value);
                                                setAberturaSetorEnvolvido(e.target.value);
                                                setAberturaNc('');
                                            }} className="w-full border rounded p-1.5 text-xs bg-slate-50">
                                                <option value="">-- Selecione o Setor --</option>
                                                {recursos.map(r => <option key={r.codigo} value={r.codigo}>{r.codigo} {r.descricao ? `- ${r.descricao}` : ''}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase">Problema Encontrado</label>
                                            <select value={aberturaNc} onChange={e => setAberturaNc(e.target.value)} disabled={!aberturaRecurso} className="w-full border rounded p-1.5 text-xs bg-slate-50">
                                                <option value="">{aberturaRecurso ? "-- Selecione o Defeito --" : "-- Selecione o Setor Primeiro --"}</option>
                                                {naoConformidades.filter(nc => !aberturaRecurso || nc.recurso_codigo === aberturaRecurso).map(nc => (
                                                    <option key={nc.id} value={nc.id}>{nc.descricao} ({nc.gravidade})</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase">Local de Detecção</label>
                                            <input type="text" value={aberturaLocalDet} onChange={e => setAberturaLocalDet(e.target.value)} className="w-full border rounded p-1.5 text-xs bg-slate-50" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase">Setor de Origem</label>
                                            <input type="text" value={aberturaSetorOrigem} onChange={e => setAberturaSetorOrigem(e.target.value)} className="w-full border rounded p-1.5 text-xs bg-slate-50" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase">Qtd Não Conforme</label>
                                            <input type="number" value={aberturaQtd} onChange={e => setAberturaQtd(e.target.value)} className="w-full border rounded p-1.5 text-xs bg-slate-50" />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase">Descrição da Falha</label>
                                            <textarea value={aberturaObs} onChange={e => setAberturaObs(e.target.value)} rows="2" className="w-full border rounded p-1.5 text-xs bg-slate-50" />
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {treatingRnc.observacao && (
                                            <div className="mt-2 text-xs italic bg-white p-2 rounded border border-slate-100">
                                                " {treatingRnc.observacao} "
                                            </div>
                                        )}
                                        {treatingRnc.imagem_evidencia && (
                                            <div className="mt-3">
                                                <span className="text-xs font-bold text-slate-500 block mb-1">Evidências (Abertura):</span>
                                                <div className="flex flex-wrap gap-2">
                                                    {(treatingRnc.fotos_registro ? JSON.parse(treatingRnc.fotos_registro) : [treatingRnc.imagem_evidencia]).map((imgUrl, idx) => (
                                                        <img key={idx} src={imgUrl} className="h-24 object-cover rounded border cursor-pointer hover:opacity-80" alt={`Evidência ${idx}`} onClick={() => window.open(imgUrl)} />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                               

                                {treatingRnc.tratativa_resposta && (
                                    <div className="mt-3 bg-indigo-50 border border-indigo-100 p-2 rounded text-xs">
                                        <span className="font-bold text-indigo-800 mb-1 block">Histórico de Tratativas:</span>
                                        <pre className="whitespace-pre-wrap font-sans text-indigo-900 leading-relaxed">{treatingRnc.tratativa_resposta}</pre>
                                        
                                        {treatingRnc.fotos_tratativa && (
                                            <div className="mt-2 pt-2 border-t border-indigo-200">
                                                <span className="font-bold text-indigo-800 mb-1 block text-[10px]">Fotos da Solução:</span>
                                                <div className="flex flex-wrap gap-2">
                                                    {JSON.parse(treatingRnc.fotos_tratativa).map((imgUrl, idx) => (
                                                        <img key={idx} src={imgUrl} className="h-16 object-cover rounded border border-indigo-200 cursor-pointer hover:opacity-80" alt={`Solução ${idx}`} onClick={() => window.open(imgUrl)} />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Área de Ação */}
                            {treatingRnc.status !== 'CONCLUIDO' ? (
                                <div className="space-y-4">
                                    <div className="bg-white border rounded p-3 shadow-sm">
                                        <h4 className="font-bold text-slate-800 text-xs mb-2 border-b pb-1">1. Disposição do Produto</h4>
                                        <div className="flex gap-4 mb-2">
                                            <label className="flex items-center gap-1.5 text-xs text-slate-700">
                                                <input type="checkbox" checked={disposicaoRetrabalho} onChange={e => setDisposicaoRetrabalho(e.target.checked)} className="rounded" />
                                                Retrabalho
                                            </label>
                                            <label className="flex items-center gap-1.5 text-xs text-slate-700">
                                                <input type="checkbox" checked={disposicaoNovaPeca} onChange={e => setDisposicaoNovaPeca(e.target.checked)} className="rounded" />
                                                Nova Peça
                                            </label>
                                        </div>
                                    </div>

                                    <div className="bg-white border rounded p-3 shadow-sm">
                                        <h4 className="font-bold text-slate-800 text-xs mb-2 border-b pb-1">2. Investigação (5W2H)</h4>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-600">O Quê? (Problema)</label>
                                                <input type="text" className="w-full border rounded p-1.5 text-xs bg-slate-50 focus:bg-white" value={w2hOQue} onChange={e => setW2hOQue(e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-600">Por Quê? (Causa)</label>
                                                <input type="text" className="w-full border rounded p-1.5 text-xs bg-slate-50 focus:bg-white" value={w2hPorQue} onChange={e => setW2hPorQue(e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-600">Onde? (Local)</label>
                                                <input type="text" className="w-full border rounded p-1.5 text-xs bg-slate-50 focus:bg-white" value={w2hOnde} onChange={e => setW2hOnde(e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-600">Quando? (Data/Hora)</label>
                                                <input type="text" className="w-full border rounded p-1.5 text-xs bg-slate-50 focus:bg-white" value={w2hQuando} onChange={e => setW2hQuando(e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-600">Quem? (Responsável)</label>
                                                <input type="text" className="w-full border rounded p-1.5 text-xs bg-slate-50 focus:bg-white" value={w2hQuem} onChange={e => setW2hQuem(e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-600">Quantidade / Custo (How Much)</label>
                                                <input type="text" className="w-full border rounded p-1.5 text-xs bg-slate-50 focus:bg-white" value={w2hQuantidade} onChange={e => setW2hQuantidade(e.target.value)} />
                                            </div>
                                            <div className="col-span-2">
                                                <label className="block text-[10px] font-bold text-slate-600">Como ocorrerá? (Frequência - How)</label>
                                                <input type="text" className="w-full border rounded p-1.5 text-xs bg-slate-50 focus:bg-white" value={w2hFrequencia} onChange={e => setW2hFrequencia(e.target.value)} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white border rounded p-3 shadow-sm">
                                        <h4 className="font-bold text-slate-800 text-xs mb-2 border-b pb-1">3. Verificação da Eficácia</h4>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="col-span-2">
                                                <label className="block text-[10px] font-bold text-slate-600">Ações Foram Implementadas?</label>
                                                <select className="w-full border rounded p-1.5 text-xs bg-slate-50" value={eficAcoesImplementadas} onChange={e => setEficAcoesImplementadas(e.target.value)}>
                                                    <option value="">Selecione...</option><option value="Sim">Sim</option><option value="Não">Não</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-600">Corrigiram o problema?</label>
                                                <select className="w-full border rounded p-1.5 text-xs bg-slate-50" value={eficCorrigiram} onChange={e => setEficCorrigiram(e.target.value)}>
                                                    <option value="">Selecione...</option><option value="Sim">Sim</option><option value="Não">Não</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-600">Houve Reincidência?</label>
                                                <select className="w-full border rounded p-1.5 text-xs bg-slate-50" value={eficReincidencia} onChange={e => setEficReincidencia(e.target.value)}>
                                                    <option value="">Selecione...</option><option value="Sim">Sim</option><option value="Não">Não</option>
                                                </select>
                                            </div>
                                            <div className="col-span-2">
                                                <label className="block text-[10px] font-bold text-slate-600">Conclusão</label>
                                                <select className="w-full border rounded p-1.5 text-xs bg-slate-50" value={eficConclusao} onChange={e => setEficConclusao(e.target.value)}>
                                                    <option value="">Selecione...</option>
                                                    <option value="Eficaz">Eficaz</option>
                                                    <option value="Manter Aberta">Manter Aberta</option>
                                                    <option value="Não Eficaz">Não Eficaz</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white border rounded p-3 shadow-sm space-y-3">
                                        <h4 className="font-bold text-slate-800 text-xs mb-2 border-b pb-1">4. Resumo e Status</h4>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Mudar Status</label>
                                            <select 
                                                className="w-full border rounded p-2 text-sm outline-none focus:border-indigo-500 bg-slate-50"
                                                value={tratativaStatus}
                                                onChange={e => setTratativaStatus(e.target.value)}
                                            >
                                                <option value="EM ANDAMENTO">Em Andamento</option>
                                                <option value="CONCLUIDO">Concluído</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Descrição / Anotação Extra</label>
                                            <textarea 
                                                className="w-full border rounded p-2 text-sm outline-none focus:border-indigo-500 bg-slate-50"
                                                rows="2"
                                                placeholder="Descreva observações adicionais..."
                                                value={tratativaObs}
                                                onChange={e => setTratativaObs(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Fotos da Solução (Opcional)</label>
                                            <label className="flex items-center justify-center gap-2 w-full border border-dashed border-slate-300 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-slate-600 rounded p-2 cursor-pointer transition-colors text-xs font-medium">
                                                <Camera className="w-4 h-4" />
                                                <span>Adicionar Fotos</span>
                                                <input 
                                                    type="file" 
                                                    accept="image/*"
                                                    multiple 
                                                    capture="environment"
                                                    className="hidden" 
                                                    ref={fileInputRef}
                                                    onChange={handlePhotoUpload}
                                                />
                                            </label>
                                            {fotosTratativa.length > 0 && (
                                                <div className="mt-2 grid grid-cols-4 gap-2">
                                                    {fotosTratativa.map((foto, index) => (
                                                        <div key={index} className="relative group">
                                                            <img src={foto} alt={`Solução ${index + 1}`} className="h-16 w-full object-cover rounded border border-slate-200" />
                                                            <button 
                                                                type="button" 
                                                                onClick={() => removeFoto(index)}
                                                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <button 
                                        onClick={handleSaveTratativa}
                                        className="w-full bg-indigo-600 text-white font-bold py-2 rounded shadow hover:bg-indigo-700 transition-colors"
                                    >
                                        Salvar Tratativa
                                    </button>
                                </div>
                            ) : (
                                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg">
                                    <h4 className="text-sm font-bold text-emerald-800 mb-2 flex items-center gap-1.5"><CheckCircle className="w-4 h-4"/> RNC Concluída</h4>
                                    <div className="text-sm text-emerald-900 bg-white p-3 rounded border border-emerald-100">
                                        <span className="font-bold mb-1 block text-emerald-800">Histórico Final:</span>
                                        <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed">{treatingRnc.tratativa_resposta || 'Nenhuma tratativa registrada.'}</pre>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
