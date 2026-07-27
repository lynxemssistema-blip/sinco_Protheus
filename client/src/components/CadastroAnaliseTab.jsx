import React, { useState, useEffect } from 'react';
import { Sparkles, Search, Loader2, Check, X, MessageCircleQuestion } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
    analisarCadastroIA,
    consultarCadastroIA,
    salvarCorrecaoCadastro,
    getCorrecoesCadastro,
    atualizarStatusCorrecao
} from '../services/api';

function GrupoSugeridoCard({ grupo, onSalvar, jaSalvo }) {
    const [tipo, setTipo] = useState(grupo.tipo === 'equivalente' ? 'equivalente' : 'duplicado');
    const [produtosAtivos, setProdutosAtivos] = useState(grupo.produtos || []);
    const [codigoCorreto, setCodigoCorreto] = useState(grupo.sugestao_codigo_correto || grupo.produtos?.[0]?.codigo);
    const [salvando, setSalvando] = useState(false);

    const removerItem = (codigo) => {
        setProdutosAtivos(prev => prev.filter(p => p.codigo !== codigo));
    };

    const handleSalvar = async () => {
        if (produtosAtivos.length < 2) return;
        const itens = produtosAtivos.map(p => ({
            codigo: p.codigo,
            descricao: p.descricao,
            empresa: p.empresa,
            papel: tipo === 'duplicado'
                ? (p.codigo === codigoCorreto ? 'correto' : 'bloquear')
                : 'equivalente'
        }));
        setSalvando(true);
        try {
            await onSalvar({ tipo_relacao: tipo, motivo_ia: grupo.motivo, itens });
        } finally {
            setSalvando(false);
        }
    };

    if (produtosAtivos.length < 2) {
        return null;
    }

    return (
        <div className="border rounded-lg p-4 bg-white shadow-sm space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${tipo === 'duplicado' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                        {tipo === 'duplicado' ? 'Duplicado' : 'Equivalente'}
                    </span>
                    <span className="text-xs text-slate-400">Confiança: {grupo.confianca || 'n/d'}</span>
                </div>
                {!jaSalvo && (
                    <select
                        className="text-xs border rounded px-2 py-1"
                        value={tipo}
                        onChange={e => setTipo(e.target.value)}
                    >
                        <option value="duplicado">Duplicado (bloquear)</option>
                        <option value="equivalente">Equivalente (substituível)</option>
                    </select>
                )}
            </div>
            {grupo.motivo && <p className="text-sm text-slate-600">{grupo.motivo}</p>}
            <div className="space-y-2">
                {produtosAtivos.map(p => (
                    <div key={p.codigo} className="flex items-center gap-3 border rounded p-2">
                        {tipo === 'duplicado' && !jaSalvo && (
                            <input
                                type="radio"
                                name={`correto-${grupo._id}`}
                                checked={codigoCorreto === p.codigo}
                                onChange={() => setCodigoCorreto(p.codigo)}
                            />
                        )}
                        <div className="flex-1 min-w-0">
                            <div className="font-mono text-sm font-bold truncate">
                                {p.codigo} <span className="text-xs text-slate-400 font-normal">({p.empresa})</span>
                            </div>
                            <div className="text-xs text-slate-600 truncate">{p.descricao}</div>
                        </div>
                        {tipo === 'duplicado' && (
                            <span className={`text-xs font-bold shrink-0 ${codigoCorreto === p.codigo ? 'text-green-600' : 'text-red-500'}`}>
                                {codigoCorreto === p.codigo ? 'Manter' : 'Bloquear'}
                            </span>
                        )}
                        {!jaSalvo && (
                            <button
                                onClick={() => removerItem(p.codigo)}
                                className="text-slate-300 hover:text-red-500 shrink-0"
                                title="Remover do grupo (falso positivo)"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                ))}
            </div>
            <div className="flex justify-end">
                {jaSalvo ? (
                    <span className="text-xs text-green-600 font-bold flex items-center gap-1">
                        <Check className="w-4 h-4" /> Decisão salva
                    </span>
                ) : (
                    <button
                        onClick={handleSalvar}
                        disabled={salvando || produtosAtivos.length < 2}
                        className="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-50 flex items-center gap-2"
                    >
                        {salvando && <Loader2 className="w-3 h-3 animate-spin" />}
                        Salvar decisão
                    </button>
                )}
            </div>
        </div>
    );
}

export default function CadastroAnaliseTab() {
    const { user } = useAuth();
    const criadoPor = user?.nome || user?.login || 'Usuário Desconhecido';

    // Consulta pontual
    const [pergunta, setPergunta] = useState('');
    const [codigoConsulta, setCodigoConsulta] = useState('');
    const [loadingConsulta, setLoadingConsulta] = useState(false);
    const [respostaConsulta, setRespostaConsulta] = useState('');
    const [gruposConsulta, setGruposConsulta] = useState([]);
    const [erroConsulta, setErroConsulta] = useState(null);

    // Análise em lote
    const [filtros, setFiltros] = useState({ empresa: '', grupo: '', tipo: '', descricao: '', prefixo: '' });
    const [loadingLote, setLoadingLote] = useState(false);
    const [gruposLote, setGruposLote] = useState([]);
    const [erroLote, setErroLote] = useState(null);
    const [buscaLoteFeita, setBuscaLoteFeita] = useState(false);

    // Correções registradas
    const [correcoes, setCorrecoes] = useState([]);
    const [loadingCorrecoes, setLoadingCorrecoes] = useState(false);
    const [gruposSalvos, setGruposSalvos] = useState(new Set());

    useEffect(() => {
        carregarCorrecoes();
    }, []);

    const carregarCorrecoes = async () => {
        setLoadingCorrecoes(true);
        try {
            const data = await getCorrecoesCadastro({});
            setCorrecoes(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingCorrecoes(false);
        }
    };

    const handleConsultar = async () => {
        if (!pergunta.trim() && !codigoConsulta.trim()) return;
        setLoadingConsulta(true);
        setErroConsulta(null);
        setRespostaConsulta('');
        setGruposConsulta([]);
        try {
            const data = await consultarCadastroIA({
                pergunta: pergunta.trim() || undefined,
                codigo: codigoConsulta.trim() || undefined
            });
            setRespostaConsulta(data.resposta || '');
            setGruposConsulta((data.groups || []).map((g, idx) => ({ ...g, _id: `consulta-${idx}-${Date.now()}` })));
        } catch (err) {
            console.error(err);
            setErroConsulta(err?.response?.data?.error || 'Erro ao consultar a IA.');
        } finally {
            setLoadingConsulta(false);
        }
    };

    const handleAnalisarLote = async () => {
        setLoadingLote(true);
        setErroLote(null);
        setBuscaLoteFeita(true);
        setGruposLote([]);
        try {
            const data = await analisarCadastroIA(filtros);
            setGruposLote((data.groups || []).map((g, idx) => ({ ...g, _id: `lote-${idx}-${Date.now()}` })));
        } catch (err) {
            console.error(err);
            setErroLote(err?.response?.data?.error || 'Erro ao analisar cadastro com IA.');
        } finally {
            setLoadingLote(false);
        }
    };

    const handleSalvarGrupo = async (grupoId, payload) => {
        try {
            await salvarCorrecaoCadastro({ ...payload, criado_por: criadoPor });
            setGruposSalvos(prev => new Set(prev).add(grupoId));
            carregarCorrecoes();
        } catch (err) {
            console.error(err);
            alert(err?.response?.data?.error || 'Erro ao salvar decisão do grupo.');
        }
    };

    const handleAtualizarStatus = async (grupoUuid, status) => {
        try {
            await atualizarStatusCorrecao(grupoUuid, status);
            carregarCorrecoes();
        } catch (err) {
            console.error(err);
            alert('Erro ao atualizar status.');
        }
    };

    return (
        <div className="space-y-8">
            {/* Consulta pontual */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-3">
                <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <MessageCircleQuestion className="w-5 h-5 text-blue-600" />
                    Consulta rápida
                </h2>
                <div className="flex flex-col md:flex-row gap-3">
                    <input
                        type="text"
                        className="flex-1 border rounded p-2 text-sm"
                        placeholder='Ex: "existe equivalente pra chapa aço 1006 4,5mm?"'
                        value={pergunta}
                        onChange={e => setPergunta(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleConsultar()}
                    />
                    <input
                        type="text"
                        className="w-full md:w-48 border rounded p-2 text-sm"
                        placeholder="ou código (ex: MTC-0872)"
                        value={codigoConsulta}
                        onChange={e => setCodigoConsulta(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleConsultar()}
                    />
                    <button
                        onClick={handleConsultar}
                        disabled={loadingConsulta || (!pergunta.trim() && !codigoConsulta.trim())}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50 whitespace-nowrap"
                    >
                        {loadingConsulta ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        Perguntar à IA
                    </button>
                </div>
                {erroConsulta && <p className="text-xs text-red-600">{erroConsulta}</p>}
                {respostaConsulta && (
                    <div className="bg-blue-50 border border-blue-100 rounded p-3 text-sm text-slate-700">{respostaConsulta}</div>
                )}
                {gruposConsulta.length > 0 && (
                    <div className="space-y-3 pt-2">
                        {gruposConsulta.map(grupo => (
                            <GrupoSugeridoCard
                                key={grupo._id}
                                grupo={grupo}
                                jaSalvo={gruposSalvos.has(grupo._id)}
                                onSalvar={(payload) => handleSalvarGrupo(grupo._id, payload)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Análise em lote */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-4">
                <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-blue-600" />
                    Análise em lote por filtro
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Empresa</label>
                        <select
                            className="w-full border rounded p-2 text-sm"
                            value={filtros.empresa}
                            onChange={e => setFiltros({ ...filtros, empresa: e.target.value })}
                        >
                            <option value="">Todas</option>
                            <option value="010">010 - Matriz</option>
                            <option value="990">990 - Filial</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Grupo</label>
                        <input
                            type="text"
                            className="w-full border rounded p-2 text-sm"
                            value={filtros.grupo}
                            onChange={e => setFiltros({ ...filtros, grupo: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Prefixo (Ex: MTC)</label>
                        <input
                            type="text"
                            className="w-full border rounded p-2 text-sm"
                            value={filtros.prefixo}
                            onChange={e => setFiltros({ ...filtros, prefixo: e.target.value })}
                            placeholder="Prefixo do Código"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Tipo</label>
                        <input
                            type="text"
                            className="w-full border rounded p-2 text-sm"
                            value={filtros.tipo}
                            onChange={e => setFiltros({ ...filtros, tipo: e.target.value })}
                            placeholder="Ex: MP, PA"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Descrição</label>
                        <input
                            type="text"
                            className="w-full border rounded p-2 text-sm"
                            value={filtros.descricao}
                            onChange={e => setFiltros({ ...filtros, descricao: e.target.value })}
                            placeholder="Contém..."
                        />
                    </div>
                </div>
                <p className="text-xs text-slate-400">Recomendado filtrar por grupo e/ou tipo para manter o recorte pequeno e a análise precisa.</p>
                <div className="flex justify-end">
                    <button
                        onClick={handleAnalisarLote}
                        disabled={loadingLote}
                        className="bg-slate-800 text-white px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50"
                    >
                        {loadingLote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        Analisar com IA
                    </button>
                </div>
                {erroLote && <p className="text-xs text-red-600">{erroLote}</p>}
                {buscaLoteFeita && !loadingLote && !erroLote && gruposLote.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-4">Nenhum grupo de duplicata/equivalência encontrado nesse recorte.</p>
                )}
                {gruposLote.length > 0 && (
                    <div className="space-y-3 pt-2">
                        {gruposLote.map(grupo => (
                            <GrupoSugeridoCard
                                key={grupo._id}
                                grupo={grupo}
                                jaSalvo={gruposSalvos.has(grupo._id)}
                                onSalvar={(payload) => handleSalvarGrupo(grupo._id, payload)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Correções registradas */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-3">
                <h2 className="text-sm font-bold text-slate-700">Correções registradas</h2>
                {loadingCorrecoes ? (
                    <p className="text-sm text-slate-400 text-center py-4">Carregando...</p>
                ) : correcoes.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">Nenhuma correção registrada ainda.</p>
                ) : (
                    <div className="space-y-3">
                        {correcoes.map(grupo => (
                            <div key={grupo.grupo_uuid} className="border rounded-lg p-3 space-y-2">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${grupo.tipo_relacao === 'duplicado' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {grupo.tipo_relacao === 'duplicado' ? 'Duplicado' : 'Equivalente'}
                                        </span>
                                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                                            grupo.status === 'aplicado' ? 'bg-green-100 text-green-700' :
                                            grupo.status === 'ignorado' ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-700'
                                        }`}>
                                            {grupo.status === 'aplicado'
                                                ? (grupo.tipo_relacao === 'duplicado' ? 'Bloqueado no Protheus' : 'Confirmado')
                                                : grupo.status === 'ignorado' ? 'Ignorado' : 'Pendente'}
                                        </span>
                                        <span className="text-xs text-slate-400">
                                            por {grupo.criado_por} em {new Date(grupo.criado_em).toLocaleString('pt-BR')}
                                        </span>
                                    </div>
                                    {grupo.status === 'pendente' && (
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => handleAtualizarStatus(grupo.grupo_uuid, 'aplicado')}
                                                className="text-xs font-bold text-green-700 hover:underline"
                                            >
                                                Marcar como aplicado
                                            </button>
                                            <button
                                                onClick={() => handleAtualizarStatus(grupo.grupo_uuid, 'ignorado')}
                                                className="text-xs font-bold text-slate-400 hover:underline"
                                            >
                                                Ignorar
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {grupo.itens.map(item => (
                                        <span
                                            key={item.id}
                                            className={`text-xs font-mono px-2 py-1 rounded border ${
                                                item.papel === 'correto' ? 'border-green-300 bg-green-50 text-green-700' :
                                                item.papel === 'bloquear' ? 'border-red-300 bg-red-50 text-red-700 line-through' :
                                                'border-blue-300 bg-blue-50 text-blue-700'
                                            }`}
                                            title={item.descricao}
                                        >
                                            {item.codigo}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
