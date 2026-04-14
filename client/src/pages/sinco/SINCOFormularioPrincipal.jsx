import { useState, useEffect, useCallback } from 'react';
import { Save, Search, FileText, Download, FileDigit, Settings, RefreshCw, Upload, FileSignature, Plus, X, Pencil } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { getSincoArvore, getSincoRestricoes, getSincoRestricoesSz0, createSincoRestricaoSz0, getSincoOperacoes, getSincoProduto } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const estadoVazio = {
    arquivo: 'Nenhum arquivo carregado',
    caminho: 'Nenhum arquivo carregado',
    titulo: '',
    grupo: '',
    unidade: '',
    tipo: '',
    rev: '',
    peso: '',
    espessura: '',
    largura: '',
    comprimento: '',
    area: '',
    acabamento: '' // Mantido da imagem, mas sem Autor/Data
};

export default function SINCOFormularioPrincipal() {
    const [searchParams] = useSearchParams();
    const { user } = useAuth();

    const [dados, setDados] = useState({
        arquivo: searchParams.get('arquivo') || estadoVazio.arquivo,
        caminho: searchParams.get('caminho') || searchParams.get('arquivo') || estadoVazio.caminho,
        titulo: searchParams.get('titulo') || '',
        grupo: searchParams.get('grupo') || '',
        unidade: searchParams.get('unidade') || '',
        tipo: searchParams.get('tipo') || '',
        rev: searchParams.get('rev') || '',
        peso: searchParams.get('peso') || '',
        espessura: searchParams.get('espessura') || '',
        largura: searchParams.get('largura') || '',
        comprimento: searchParams.get('comprimento') || '',
        area: searchParams.get('area') || '',
        acabamento: searchParams.get('acabamento') || '',
    });
    const [busca, setBusca] = useState('');
    const [arvore, setArvore] = useState([]);
    const [restricoes, setRestricoes] = useState([]);
    const [operacoes, setOperacoes] = useState([]);
    const [restricoesSz0, setRestricoesSz0] = useState([]);
    const [erroProtheus, setErroProtheus] = useState(null);

    const [loadingArvore, setLoadingArvore] = useState(false);
    const [loadingRest, setLoadingRest] = useState(false);
    const [loadingOpe, setLoadingOpe] = useState(false);
    const [loadingSz0, setLoadingSz0] = useState(false);

    // Modal Nova/Editar Restrição SZ0
    const [showModalSz0, setShowModalSz0] = useState(false);
    const [savingSz0, setSavingSz0] = useState(false);
    const [editandoRestricao, setEditandoRestricao] = useState(null); // null = nova, objeto = edição
    const [novaRestricao, setNovaRestricao] = useState({ resumo: '', restricao: '', responsavel: '', revMetalfisa: '', status: 'P' });

    const carregarProtheus = useCallback(async (codigo) => {
        if (!codigo || codigo === estadoVazio.arquivo) {
            setArvore([]);
            setRestricoes([]);
            setOperacoes([]);
            setErroProtheus(null);
            return;
        }

        // Remover a extensão do arquivo (.psm, .asm, .par, etc.)
        const codigoSemExtensao = codigo.replace(/\.[^/.]+$/, '').trim().toUpperCase();

        setErroProtheus(null);
        setLoadingArvore(true);
        setLoadingRest(true);
        setLoadingOpe(true);
        setLoadingSz0(true);
        try {
            const [rA, rR, rO, rSz0] = await Promise.all([
                getSincoArvore(codigoSemExtensao),
                getSincoRestricoes(codigoSemExtensao),
                getSincoOperacoes(codigoSemExtensao),
                getSincoRestricoesSz0(codigoSemExtensao),
            ]);
            setArvore(Array.isArray(rA) ? rA : []);
            setRestricoes(Array.isArray(rR) ? rR : []);
            setOperacoes(Array.isArray(rO) ? rO : []);
            setRestricoesSz0(Array.isArray(rSz0) ? rSz0 : []);
        } catch (error) {
            console.error("Erro ao carregar dados do Protheus:", error);
            setErroProtheus(error.response?.data?.error || error.message || 'Erro desconhecido ao consultar');
            setArvore([]);
            setRestricoes([]);
            setOperacoes([]);
            setRestricoesSz0([]);
        } finally {
            setLoadingArvore(false);
            setLoadingRest(false);
            setLoadingOpe(false);
            setLoadingSz0(false);
        }
    }, []);

    // Carrega na primeira abertura (via URL)
    useEffect(() => {
        const cod = searchParams.get('arquivo');
        if (cod) carregarProtheus(cod);
    }, [searchParams, carregarProtheus]);

    // Socket.io — recebe atualização em tempo real do Solid Edge Desktop
    useEffect(() => {
        let socket = null;
        import('socket.io-client').then(({ io }) => {
            socket = io(window.location.origin, { transports: ['websocket', 'polling'] });
            socket.on('connect', () => { socket.emit('join_sinco_formulario'); });
            socket.on('sinco:desenho_atualizado', (novos) => {
                setDados(prev => {
                    const arquivoMudou = novos.arquivo && novos.arquivo !== prev.arquivo;
                    if (arquivoMudou) carregarProtheus(novos.arquivo);
                    return arquivoMudou ? { ...estadoVazio, ...novos } : { ...prev, ...novos };
                });
            });
        });
        return () => { if (socket) socket.disconnect(); };
    }, [carregarProtheus]);

    const buscarProdutoManual = async (codigo) => {
        if (!codigo) return;
        const codigoSemExtensao = codigo.replace(/\.[^/.]+$/, '').trim().toUpperCase();

        setErroProtheus(null);
        setDados({
            ...estadoVazio,
            arquivo: codigoSemExtensao,
            caminho: 'Busca via ERP',
        });

        try {
            const p = await getSincoProduto(codigoSemExtensao);
            if (p) {
                setDados(prev => ({
                    ...prev,
                    titulo: p.titulo || '',
                    tipo: p.tipo || '',
                    unidade: p.unidade || '',
                    grupo: p.grupo || '',
                    peso: p.peso || prev.peso,
                    rev: p.rev || prev.rev,
                    espessura: p.espessura || prev.espessura,
                    largura: p.largura || prev.largura,
                    comprimento: p.comprimento || prev.comprimento,
                    area: p.area || prev.area
                }));
            }
        } catch (e) {
            setErroProtheus(`Produto ${codigoSemExtensao} não encontrado no Protheus (SB1/SB5). As tabelas ainda podem retornar dados se existirem.`);
        }

        carregarProtheus(codigoSemExtensao);
    };

    const temArquivo = dados.arquivo !== estadoVazio.arquivo;

    const handleAtualizarDados = async () => {
        if (!temArquivo) return;
        const codigoSemExtensao = dados.arquivo.replace(/\.[^/.]+$/, '').trim().toUpperCase();

        try {
            const p = await getSincoProduto(codigoSemExtensao);
            if (p) {
                setDados(prev => ({
                    ...prev,
                    titulo: p.titulo || '',
                    tipo: p.tipo || '',
                    unidade: p.unidade || '',
                    grupo: p.grupo || '',
                    peso: p.peso || prev.peso,
                    rev: p.rev || prev.rev,
                    espessura: p.espessura || prev.espessura,
                    largura: p.largura || prev.largura,
                    comprimento: p.comprimento || prev.comprimento,
                    area: p.area || prev.area
                }));
            }
        } catch (e) {
            console.warn(`Produto ${codigoSemExtensao} não encontrado (SB1/SB5).`);
        }

        carregarProtheus(codigoSemExtensao);
    };

    const handleSalvarRestricao = async () => {
        if (!temArquivo) return;
        const produto = dados.arquivo.replace(/\.[^/.]+$/, '').trim().toUpperCase();

        // Data/hora local — evita conversão UTC que faz cair no dia seguinte após 21h
        const now = new Date();
        const dtHoje = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const hrAgora = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        const isEdit = !!editandoRestricao;

        // Edição: mantém a chave primária existente
        // Inclusão: encontra o maior item do array e soma 1
        const item = isEdit
            ? editandoRestricao.item
            : (() => {
                const maxItem = restricoesSz0.reduce((max, r) => {
                    const n = parseInt(r.item, 10);
                    return isNaN(n) ? max : Math.max(max, n);
                }, 0);
                return String(maxItem + 1).padStart(3, '0');
            })();

        const formatProtheusStr = (text) => {
            if (!text) return '';
            return text
                .normalize('NFD') // Remove accents
                .replace(/[\u0300-\u036f]/g, '')
                .toUpperCase() // Force uppercase
                .replace(/[^A-Z0-9\s.,\-:()\/]/g, ''); // Remove strict special characters
        };

        const payload = {
            data: {
                restricoes: [{
                    EMPRESA: '01',
                    CFILANT: '01',
                    NOPER: isEdit ? 4 : 3,
                    Z0_PRODUTO: produto,
                    Z0_ITEM: item,
                    Z0_STATUS: novaRestricao.status || 'P',
                    Z0_RESUMO: formatProtheusStr(novaRestricao.resumo),
                    Z0_RESTRIC: formatProtheusStr(novaRestricao.restricao),
                    Z0_RESPONS: novaRestricao.responsavel,
                    Z0_DTULTAL: dtHoje,
                    Z0_HRULTAL: hrAgora,
                    Z0_XREVM: (novaRestricao.revMetalfisa || dados.rev || '').substring(0, 2),
                }]
            }
        };

        setSavingSz0(true);
        try {
            await createSincoRestricaoSz0(payload);
            setShowModalSz0(false);
            setEditandoRestricao(null);
            setNovaRestricao({ resumo: '', restricao: '', responsavel: '', revMetalfisa: '', status: 'P' });
            const rSz0 = await getSincoRestricoesSz0(produto);
            setRestricoesSz0(Array.isArray(rSz0) ? rSz0 : []);
        } catch (err) {
            alert('Erro ao salvar restrição: ' + (err.response?.data?.error || err.response?.data?.message || err.message));
        } finally {
            setSavingSz0(false);
        }
    };
    const materiais = arvore; // mostra todos os componentes do BOM, sem filtrar por tipo

    const inputCls = "w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder-slate-400";
    const readCls = "w-full px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-md text-sm font-mono text-slate-600";
    const lblCls = "block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1";
    const boxTitleCls = "text-xs font-semibold uppercase tracking-wider px-3 py-2 border-b";
    const thCls = "px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-white sticky top-0 border-b border-slate-100";

    return (
        <div className="flex flex-col h-screen space-y-4 max-w-[1800px] mx-auto p-4 overflow-hidden">
            {/* Cabeçalho */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-900">SINCO - Solid Edge - Lynx</h1>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                            Web Version (MetalFisa 5 UI)
                        </span>
                        <span className="text-slate-400 text-xs">|</span>
                        <span className="text-xs text-slate-500 flex items-center gap-1.5">
                            Arquivo Corrente:
                            {temArquivo && dados.caminho && dados.caminho !== estadoVazio.caminho ? (
                                <button
                                    title="Abrir no Solid Edge"
                                    onClick={() => {
                                        fetch('http://localhost:8080/api/solidedge/open-file', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ caminho: dados.caminho })
                                        }).catch(() => alert('Agente Solid Edge não encontrado.\nInicie o INICIAR_AGENT.bat na sua máquina.'));
                                    }}
                                    className="font-mono text-blue-600 hover:text-blue-800 hover:underline cursor-pointer bg-transparent border-none p-0 text-xs">
                                    {dados.caminho}
                                </button>
                            ) : (
                                <strong className="text-slate-400 font-mono">{dados.caminho}</strong>
                            )}
                        </span>
                    </div>
                </div>

                {/* Filtro de Busca Manual e Botão de Atualizar Formulário */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleAtualizarDados}
                        title="Emular recarregamento da página (atualiza dados do cabeçalho Protheus e as tabelas sem perder o último ERP e caminho)"
                        className="p-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors"
                    >
                        <RefreshCw className="h-4 w-4" />
                    </button>
                    <div className="relative">
                        <Search className="h-4 w-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && buscarProdutoManual(busca)}
                            placeholder="Consultar Produto..."
                            className="w-56 pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                    </div>
                    <button
                        onClick={() => buscarProdutoManual(busca)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-sm border border-blue-700 text-xs font-medium rounded-md transition-colors whitespace-nowrap"
                    >
                        Buscar ERP
                    </button>
                </div>
            </div>

            {/* Barra de Ferramentas (removido Atualizar Protheus pois agora tem Atualizar Dados no topo) */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-1.5 flex flex-wrap gap-1.5 items-center">
                <span className="text-xs font-medium text-slate-400 px-2 flex items-center gap-1.5">
                    Modo Solid Edge / Formulário
                </span>
            </div>

            {/* Erro de comunicação com Protheus */}
            {erroProtheus && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-start gap-2">
                    <span className="font-semibold whitespace-nowrap">Erro Protheus:</span>
                    <span className="font-mono break-all">{erroProtheus}</span>
                </div>
            )}

            {/* Layout do Formulário Principal - Limpo e Compacto */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                <div className="grid grid-cols-12 gap-x-4 gap-y-3">

                    {/* Linha 1 */}
                    <div className="col-span-2">
                        <label className={lblCls}>Tipo</label>
                        <input type="text" value={dados.tipo} onChange={e => setDados(p => ({ ...p, tipo: e.target.value }))} className={inputCls} />
                    </div>
                    <div className="col-span-2">
                        <label className={lblCls}>Unidade</label>
                        <input type="text" value={dados.unidade} onChange={e => setDados(p => ({ ...p, unidade: e.target.value }))} className={inputCls} />
                    </div>
                    <div className="col-span-3">
                        <label className={lblCls}>Grupo</label>
                        <input type="text" value={dados.grupo} onChange={e => setDados(p => ({ ...p, grupo: e.target.value }))} className={inputCls} />
                    </div>
                    <div className="col-span-5">
                        <label className={lblCls}>Título</label>
                        <input type="text" value={dados.titulo} onChange={e => setDados(p => ({ ...p, titulo: e.target.value }))} placeholder="Ex: PORCA SEXT A6 INOX" className={inputCls} />
                    </div>

                    {/* Linha 2 */}
                    <div className="col-span-3">
                        <label className={lblCls}>Num. Documento</label>
                        <input type="text" value={dados.arquivo} readOnly className={readCls} />
                    </div>
                    <div className="col-span-2">
                        <label className={lblCls}>Rev. Metalfisa</label>
                        <input type="text" value={dados.rev} onChange={e => setDados(p => ({ ...p, rev: e.target.value }))} className={inputCls} />
                    </div>
                    <div className="col-span-2">
                        <label className={lblCls}>Peso (kg)</label>
                        <input type="text" value={dados.peso || '0'} onChange={e => setDados(p => ({ ...p, peso: e.target.value }))} className={inputCls} />
                    </div>
                    <div className="col-span-2">
                        <label className={lblCls}>Área Pintura (m²)</label>
                        <input type="text" value={dados.area || '0'} onChange={e => setDados(p => ({ ...p, area: e.target.value }))} className={inputCls} />
                    </div>
                    <div className="col-span-1">
                        <label className={lblCls}>Espess. (mm)</label>
                        <input type="text" value={dados.espessura || '0'} onChange={e => setDados(p => ({ ...p, espessura: e.target.value }))} className={inputCls} />
                    </div>
                    <div className="col-span-1">
                        <label className={lblCls}>Larg. (mm)</label>
                        <input type="text" value={dados.largura || '0'} onChange={e => setDados(p => ({ ...p, largura: e.target.value }))} className={inputCls} />
                    </div>
                    <div className="col-span-1">
                        <label className={lblCls}>Compr. (mm)</label>
                        <input type="text" value={dados.comprimento || '0'} onChange={e => setDados(p => ({ ...p, comprimento: e.target.value }))} className={inputCls} />
                    </div>

                    {/* Linha 3 */}
                    <div className="col-span-12">
                        <label className={lblCls}>Comentários - Acabamento</label>
                        <input type="text" value={dados.acabamento} onChange={e => setDados(p => ({ ...p, acabamento: e.target.value }))} placeholder="Ex: CINZA N6,5 TEXTURIZADO - 80 MICRAS" className={inputCls} />
                    </div>
                </div>
            </div>

            {/* Sub-tabelas: Árvore do Produto + Operações + Restrições SZ1 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0 pb-2">
                {/* 1. Árvore */}
                <div className="bg-white rounded-lg border border-slate-200 flex flex-col shadow-sm overflow-hidden h-full">
                    <div className={`${boxTitleCls} bg-emerald-50 text-emerald-700 border-emerald-100 flex justify-between items-center`}>
                        <span>Árvore do Produto (Materiais)</span>
                        <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-emerald-200 text-emerald-600 font-mono">{temArquivo ? dados.arquivo.replace(/\.[^/.]+$/, '') : '—'}</span>
                    </div>
                    <div className="flex-1 overflow-auto bg-slate-50/50">
                        {loadingArvore ? (
                            <div className="flex items-center justify-center py-12 text-slate-400 text-sm">Carregando componentes...</div>
                        ) : (
                            <table className="w-full text-left text-xs bg-white">
                                <thead>
                                    <tr>
                                        <th className={thCls}>Nív.</th>
                                        <th className={thCls}>Código</th>
                                        <th className={thCls}>Descrição</th>
                                        <th className={thCls + " text-right"}>Qtde</th>
                                        <th className={thCls}>UN</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {materiais.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="text-center py-12 text-slate-400 italic">
                                                Nenhum material carregado para a estrutura
                                            </td>
                                        </tr>
                                    ) : materiais.map((r, i) => (
                                        <tr key={i} className="hover:bg-emerald-50/30 transition-colors">
                                            <td className="px-3 py-2 text-slate-400 font-medium">{r.nivel}</td>
                                            <td className="px-3 py-2 font-mono font-medium text-slate-700">{r.componente}</td>
                                            <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate" title={r.descricao}>{r.descricao || '—'}</td>
                                            <td className="px-3 py-2 text-right text-slate-700 font-mono tabular-nums">{Number(r.quantidade).toFixed(4)}</td>
                                            <td className="px-3 py-2 text-slate-500">{r.unidade || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* 2. Restrições */}
                <div className="bg-white rounded-lg border border-slate-200 flex flex-col shadow-sm overflow-hidden h-full">
                    <div className={`${boxTitleCls} bg-amber-50 text-amber-700 border-amber-100 flex justify-between items-center`}>
                        <span>Produto Metalfisa/Cliente (SZ1)</span>
                        <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-amber-200 text-amber-600 font-mono">{temArquivo ? dados.arquivo.replace(/\.[^/.]+$/, '') : '—'}</span>
                    </div>
                    <div className="flex-1 overflow-auto bg-slate-50/50">
                        {loadingRest ? (
                            <div className="flex items-center justify-center py-12 text-slate-400 text-sm">Carregando restrições...</div>
                        ) : (
                            <table className="w-full text-left text-xs bg-white">
                                <thead>
                                    <tr>
                                        <th className={thCls}>Cliente</th>
                                        <th className={thCls}>Nome</th>
                                        <th className={thCls}>Cód CL.</th>
                                        <th className={thCls}>Rev</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {restricoes.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" className="text-center py-12 text-slate-400 italic">
                                                Nenhuma restrição encontrada no Protheus
                                            </td>
                                        </tr>
                                    ) : restricoes.map((r, i) => (
                                        <tr key={i} className="hover:bg-amber-50/30 transition-colors">
                                            <td className="px-3 py-2 font-mono font-medium text-slate-700">{r.cliente}</td>
                                            <td className="px-3 py-2 text-slate-600 max-w-[150px] truncate" title={r.nome_cliente}>{r.nome_cliente}</td>
                                            <td className="px-3 py-2 font-mono text-slate-500">{r.cod_cliente || '—'}</td>
                                            <td className="px-3 py-2 font-semibold text-amber-700 bg-amber-50/50 text-center">{r.revisao}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* 3. Operações */}
                <div className="bg-white rounded-lg border border-slate-200 flex flex-col shadow-sm overflow-hidden h-full">
                    <div className={`${boxTitleCls} bg-blue-50 text-blue-700 border-blue-100 flex justify-between items-center`}>
                        <span>Operações (Roteiro)</span>
                        <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-blue-200 text-blue-600 font-mono">{temArquivo ? dados.arquivo.replace(/\.[^/.]+$/, '') : '—'}</span>
                    </div>
                    <div className="flex-1 overflow-auto bg-slate-50/50">
                        {loadingOpe ? (
                            <div className="flex items-center justify-center py-12 text-slate-400 text-sm">Carregando operações...</div>
                        ) : (
                            <table className="w-full text-left text-xs bg-white">
                                <thead>
                                    <tr>
                                        <th className={thCls}>Operação</th>
                                        <th className={thCls}>Descrição</th>
                                        <th className={thCls}>Recurso</th>
                                        <th className={thCls + " text-right"}>Tempo Padrão</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {operacoes.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" className="text-center py-12 text-slate-400 italic">
                                                Nenhuma operação encontrada no Protheus
                                            </td>
                                        </tr>
                                    ) : operacoes.map((r, i) => (
                                        <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                                            <td className="px-3 py-2 font-mono font-medium text-slate-700">{r.operacao}</td>
                                            <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate" title={r.descricao || r.recurso_descricao}>{r.descricao || r.recurso_descricao || r.recurso}</td>
                                            <td className="px-3 py-2 font-mono text-slate-500">{r.recurso_descricao ? `${r.recurso} - ${r.recurso_descricao}` : (r.recurso || '—')}</td>
                                            <td className="px-3 py-2 font-mono text-blue-600 font-medium text-right bg-blue-50/50">{Number(r.tempo || 0).toFixed(2)} min</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            {/* 4. Restrições de Engenharia SZ0 */}
            <div className="bg-white rounded-lg border border-slate-200 flex flex-col shadow-sm overflow-hidden">
                <div className={`${boxTitleCls} bg-red-50 text-red-700 border-red-100 flex justify-between items-center`}>
                    <span>Restrições de Engenharia (SZ0){restricoesSz0.length > 0 && <span className="ml-2 text-[10px] bg-red-100 px-1.5 py-0.5 rounded-full font-bold">{restricoesSz0.length}</span>}</span>
                    <div className="flex items-center gap-2">
                        {temArquivo && (
                            <button
                                onClick={() => {
                                    setNovaRestricao({ resumo: '', restricao: '', responsavel: (user?.nome || user?.login || '').toUpperCase(), revMetalfisa: '' });
                                    setShowModalSz0(true);
                                }}
                                className="flex items-center gap-1 px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white text-[10px] font-medium rounded transition-colors shadow-sm"
                            >
                                <Plus className="h-3 w-3" /> Nova
                            </button>
                        )}
                        <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-red-200 text-red-600 font-mono">{temArquivo ? dados.arquivo.replace(/\.[^/.]+$/, '') : '—'}</span>
                    </div>
                </div>
                <div className="overflow-auto bg-slate-50/50" style={{ maxHeight: '220px' }}>
                    {loadingSz0 ? (
                        <div className="flex items-center justify-center py-8 text-slate-400 text-sm">Carregando restrições SZ0...</div>
                    ) : (
                        <table className="w-full text-left text-xs bg-white">
                            <thead>
                                <tr>
                                    <th className={thCls}>Item</th>
                                    <th className={thCls}>Status</th>
                                    <th className={thCls}>Resumo</th>
                                    <th className={thCls}>Descrição da Restrição *</th>
                                    <th className={thCls}>Revisão</th>
                                    <th className={thCls}>Responsável</th>
                                    <th className={thCls}>Últ. Alteração</th>
                                    <th className={thCls}></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {restricoesSz0.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="text-center py-8 text-slate-400 italic">
                                            Nenhuma restrição SZ0 encontrada para este produto
                                        </td>
                                    </tr>
                                ) : [...restricoesSz0].sort((a, b) => Number(b.item) - Number(a.item)).map((r, i) => {
                                    const statusLabel = r.status === 'P' ? 'Pendente' : r.status === 'A' ? 'Aprovado' : r.status === 'R' ? 'Rejeitado' : r.status;
                                    const statusCls = r.status === 'P' ? 'bg-amber-100 text-amber-700 border-amber-200' : r.status === 'A' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200';
                                    const dtFormatted = r.dt_ultima_alt ? r.dt_ultima_alt.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1') : '—';
                                    return (
                                        <tr key={i} className="hover:bg-red-50/30 transition-colors" title={r.restricao || ''}>
                                            <td className="px-3 py-2 font-mono font-medium text-slate-700">{r.item}</td>
                                            <td className="px-3 py-2">
                                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${statusCls}`}>{statusLabel}</span>
                                            </td>
                                            <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate" title={r.resumo}>{r.resumo || '—'}</td>
                                            <td className="px-3 py-2 text-slate-600 max-w-[300px] truncate" title={r.restricao}>{r.restricao || '—'}</td>
                                            <td className="px-3 py-2 font-mono text-slate-500 font-bold">{r.revisao || '—'}</td>
                                            <td className="px-3 py-2 font-mono text-slate-500">{r.responsavel || '—'}</td>
                                            <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{dtFormatted} {r.hr_ultima_alt || ''}</td>
                                            <td className="px-3 py-2 text-right">
                                                {temArquivo && (
                                                    <button
                                                        onClick={() => {
                                                            setEditandoRestricao(r);
                                                            setNovaRestricao({
                                                                resumo: r.resumo || '',
                                                                restricao: r.restricao || '',
                                                                responsavel: (user?.nome || user?.login || '').toUpperCase(),
                                                                revMetalfisa: r.revisao || dados.rev || '',
                                                                status: r.status || 'P',
                                                            });
                                                            setShowModalSz0(true);
                                                        }}
                                                        className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                                                        title="Editar restrição"
                                                    >
                                                        <Pencil className="h-3 w-3" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Modal Nova/Editar Restrição SZ0 */}
            {showModalSz0 && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => { setShowModalSz0(false); setEditandoRestricao(null); }}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 border border-slate-200" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50 rounded-t-xl">
                            <h3 className="text-sm font-bold text-slate-800">
                                {editandoRestricao ? `Editar Restrição ${editandoRestricao.item}` : 'Nova Restrição'} — {dados.arquivo.replace(/\.[^/.]+$/, '')}
                            </h3>
                            <button onClick={() => { setShowModalSz0(false); setEditandoRestricao(null); }} className="text-slate-400 hover:text-slate-600 transition-colors"><X className="h-4 w-4" /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className={lblCls}>Resumo *</label>
                                <input type="text" maxLength={80} value={novaRestricao.resumo} onChange={e => setNovaRestricao(p => ({ ...p, resumo: e.target.value }))} placeholder="Breve descrição da restrição" className={inputCls} autoFocus />
                            </div>
                            <div>
                                <label className={lblCls}>Descrição da Restrição *</label>
                                <textarea rows={3} maxLength={500} value={novaRestricao.restricao} onChange={e => setNovaRestricao(p => ({ ...p, restricao: e.target.value }))} placeholder="Detalhe completo da restrição..." className={inputCls + ' resize-none'} />
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className={lblCls}>Responsável</label>
                                    <input type="text" value={novaRestricao.responsavel} readOnly className={readCls} title="Preenchido automaticamente com o usuário logado" />
                                </div>
                                <div>
                                    <label className={lblCls}>Rev. Metalfisa</label>
                                    <input type="text" maxLength={2} value={novaRestricao.revMetalfisa || dados.rev || ''} onChange={e => setNovaRestricao(p => ({ ...p, revMetalfisa: e.target.value }))} className={inputCls} />
                                </div>
                                <div>
                                    <label className={lblCls}>Status</label>
                                    <select value={novaRestricao.status} onChange={e => setNovaRestricao(p => ({ ...p, status: e.target.value }))} className={inputCls}>
                                        <option value="P">Pendente</option>
                                        <option value="A">Aprovado</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                <span>Item: {editandoRestricao ? editandoRestricao.item : String(restricoesSz0.length + 1).padStart(3, '0')}</span>
                                <span>•</span>
                                <span>Data/Hora: agora</span>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50/50 rounded-b-xl">
                            <button onClick={() => { setShowModalSz0(false); setEditandoRestricao(null); }} className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 transition-colors">Cancelar</button>
                            <button
                                onClick={handleSalvarRestricao}
                                disabled={savingSz0 || !novaRestricao.resumo.trim() || !novaRestricao.restricao.trim()}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white text-xs font-medium rounded-md transition-colors shadow-sm flex items-center gap-1.5"
                            >
                                {savingSz0 ? 'Salvando...' : <><Save className="h-3.5 w-3.5" /> {editandoRestricao ? 'Salvar Alterações' : 'Salvar Restrição'}</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
