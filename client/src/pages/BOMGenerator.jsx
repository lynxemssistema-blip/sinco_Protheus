import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Calculator, Settings, Table } from 'lucide-react';
import { getEstruturaProduto } from '../services/api';

const BOMGenerator = () => {
    const { codigo } = useParams();
    const navigate = useNavigate();

    // Estados
    const [structure, setStructure] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [multiplier, setMultiplier] = useState(1);

    // Carregar estrutura recursiva
    useEffect(() => {
        const fetchStructure = async () => {
            try {
                const data = await getEstruturaProduto(codigo);
                setStructure(data);
            } catch (err) {
                setError('Erro ao carregar estrutura.');
            } finally {
                setLoading(false);
            }
        };
        fetchStructure();
    }, [codigo]);

    // Lógica de Aglutinação (Memoized para performance)
    const aglutinatedData = useMemo(() => {
        if (!structure.length) return [];

        const map = new Map();

        // Função recursiva para percorrer a árvore
        const traverse = (nodes, currentMultiplier) => {
            nodes.forEach(node => {
                // Chave única para aglutinar (Código)
                const key = node.codigo;

                // Calcula quantidade total necessária para este nó neste contexto
                // Qtd Necessária do Item * Multiplicador acumulado dos pais
                const qtdTotalNode = parseFloat(node.qtd_necessaria || 0);
                // NOTA: A API recursiva já retorna 'qtd_necessaria' calculada baseada no pai imediato? 
                // Se a API retorna a estrutura flat recursiva (CTE), ela geralmente já traz a qtd considerando os pais se foi feita assim.
                // Mas a nossa API retorna uma lista flat com 'nivel' e 'qtd_necessaria'.
                // Vamos assumir que 'qtd_necessaria' é a qtd unitária para fazer 1 unidade do pai imediato.
                // ESPERA: A CTE recursiva no backend já faz a explosão. Se ela retorna uma lista plana (não aninhada em 'children'),
                // então cada linha já é uma ocorrência.

                // Verificando o retorno do Backend na Fase 4:
                // SELECT ... nivel, qtd_necessaria ... FROM cte
                // Se for CTE, ela explode tudo. Se o parafuso repete, ele aparece 2x na lista.

                const existing = map.get(key);
                if (existing) {
                    existing.totalQtd += qtdTotalNode;
                } else {
                    map.set(key, {
                        codigo: node.codigo,
                        descricao: node.descricao,
                        tipo: node.tipo,
                        unidade: node.unidade,
                        totalQtd: qtdTotalNode
                    });
                }

                // Se a estrutura viesse aninhada (com .filhos), precisaria recursão aqui.
                // Mas a API atual retorna uma lista plana ordenada por path?
                // Vamos verificar ProductStructure.jsx. Ele usa `renderTree` com recursão se tiver `filhos`. 
                // Mas a API retorna flat, e o ProductStructure monta a árvore? NAO.
                // O ProductStructure recebe `structure` e faz map simples. Ele usa `nivel` para indentar.
                // Isso significa que a lista JÁ É EXPLODIDA.
                // Então basta somar as quantidades de códigos iguais.
            });
        };

        // Se a lista já é flat e explodida (CTE), basta iterar e somar.
        // A qtd_necessaria retornada pela CTE geralmente é a quantidade TOTAL acumulada até aquele nível?
        // Ou é a quantidade unitária do pai? 
        // PRECISO VALIDAR ISSO. Se a CTE multiplica pelo pai, então é a Qtd Total para fazer 1 Produto Principal.
        // Assumindo que a CTE está correta e `qtd_necessaria` é "Para fazer 1 unidade do Produto Raiz, preciso de X deste componente", 
        // então basta somar as ocorrências do mesmo componente.

        structure.forEach(item => {
            // Ignorar o próprio produto pai (nível 0) se não quisermos que ele apareça na lista de compras
            // Mas o usuário pediu BOM Aglutinada. Geralmente o Pai (Nível 0) é o produto final, não componente.
            if (item.nivel === 0) return;

            const key = item.codigo;
            const qtdParaUm = parseFloat(item.qtd_necessaria || 0);

            if (map.has(key)) {
                const current = map.get(key);
                current.totalQtd += qtdParaUm;
            } else {
                map.set(key, {
                    codigo: item.codigo,
                    descricao: item.descricao,
                    tipo: item.tipo,
                    unidade: item.unidade,
                    totalQtd: qtdParaUm
                });
            }
        });

        // Converter Map para Array e aplicar o Multiplicador do Usuário
        return Array.from(map.values()).map(item => ({
            ...item,
            finalQtd: item.totalQtd * multiplier
        })).sort((a, b) => a.descricao.localeCompare(b.descricao));

    }, [structure, multiplier]);

    // Exportar CSV
    const handleExport = () => {
        const headers = ["Código", "Descrição", "Tipo", "UM", "Qtd Unitária (x1)", `Qtd Total (x${multiplier})`];
        const csvContent = [
            headers.join(";"),
            ...aglutinatedData.map(item => [
                item.codigo,
                `"${item.descricao}"`, // Aspas para evitar quebra com ponto e vírgula na descrição
                item.tipo,
                item.unidade,
                item.totalQtd.toFixed(4).replace('.', ','),
                item.finalQtd.toFixed(4).replace('.', ',')
            ].join(";"))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `BOM_${codigo}_${multiplier}unid.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6 md:p-10">
            <div className="max-w-6xl mx-auto">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center text-gray-500 hover:text-blue-600 mb-6 transition-colors"
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Voltar
                </button>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    {/* Header */}
                    <div className="p-6 border-b border-gray-100 bg-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <Table className="h-6 w-6 text-blue-600" />
                                <h1 className="text-2xl font-bold text-gray-900">Lista de Materiais (BOM)</h1>
                            </div>
                            <p className="text-gray-500 text-sm">
                                Produto: <span className="font-mono font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded">{codigo}</span>
                            </p>
                        </div>

                        {/* Controls */}
                        <div className="flex items-end gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Quantidade a Produzir</label>
                                <div className="relative">
                                    <Calculator className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                    <input
                                        type="number"
                                        min="1"
                                        value={multiplier}
                                        onChange={(e) => setMultiplier(Math.max(1, parseFloat(e.target.value) || 0))}
                                        className="pl-9 w-32 rounded-md border border-gray-300 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={handleExport}
                                disabled={aglutinatedData.length === 0}
                                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Download className="h-4 w-4" />
                                Exportar Excel (CSV)
                            </button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">Código</th>
                                    <th className="px-6 py-4 font-semibold">Descrição</th>
                                    <th className="px-6 py-4 text-center font-semibold">Tipo</th>
                                    <th className="px-6 py-4 text-center font-semibold">UM</th>
                                    <th className="px-6 py-4 text-right font-semibold">Qtd Unitária</th>
                                    <th className="px-6 py-4 text-right font-bold text-blue-700 bg-blue-50/50">Qtd Total ({multiplier})</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan="6" className="p-12 text-center">
                                            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                                        </td>
                                    </tr>
                                ) : aglutinatedData.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="p-12 text-center text-gray-400">
                                            Nenhum material encontrado para aglutinação.
                                        </td>
                                    </tr>
                                ) : (
                                    aglutinatedData.map((item) => (
                                        <tr key={item.codigo} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-3 font-mono text-gray-600 text-xs">
                                                {item.codigo}
                                            </td>
                                            <td className="px-6 py-3 font-medium text-gray-700">
                                                {item.descricao}
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                <span className={`text-xs px-2 py-0.5 rounded border ${item.tipo === 'MP' ? 'bg-green-50 text-green-700 border-green-100' :
                                                        item.tipo === 'PA' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                            'bg-gray-50 text-gray-600 border-gray-200'
                                                    }`}>
                                                    {item.tipo}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 text-center text-gray-500 text-xs">
                                                {item.unidade}
                                            </td>
                                            <td className="px-6 py-3 text-right text-gray-600 font-mono">
                                                {item.totalQtd.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}
                                            </td>
                                            <td className="px-6 py-3 text-right font-bold text-blue-700 bg-blue-50/10 font-mono">
                                                {item.finalQtd.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {/* Footer Summary */}
                    {!loading && aglutinatedData.length > 0 && (
                        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 text-right text-sm text-gray-600">
                            Total de Itens Únicos: <span className="font-bold text-gray-900">{aglutinatedData.length}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BOMGenerator;
