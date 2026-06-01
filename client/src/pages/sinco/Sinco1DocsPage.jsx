import React, { useState } from 'react';
import { Database, Link, ChevronRight, ChevronDown, Layers, Box, ShoppingCart, Truck, Factory, Users } from 'lucide-react';

const Sinco1DocsPage = () => {
    const [expandedModules, setExpandedModules] = useState({
        engenharia: true,
        comercial: true,
        producao: true
    });

    const [expandedTables, setExpandedTables] = useState({});

    const toggleModule = (module) => {
        setExpandedModules(prev => ({ ...prev, [module]: !prev[module] }));
    };

    const toggleTable = (table, e) => {
        e.stopPropagation();
        setExpandedTables(prev => ({ ...prev, [table]: !prev[table] }));
    };

    const modules = [
        {
            id: 'comercial',
            title: 'Módulo Comercial (Vendas)',
            icon: <ShoppingCart className="w-5 h-5 text-emerald-500" />,
            color: 'border-emerald-200 bg-emerald-50',
            tables: [
                {
                    name: 'SA1 (sa1010)',
                    desc: 'Cadastro de Clientes',
                    fields: ['A1_COD', 'A1_LOJA', 'A1_NOME', 'A1_NREDUZ'],
                    links: [
                        { to: 'SC5', desc: 'A1_COD = C5_CLIENTE' },
                        { to: 'SZ1', desc: 'A1_COD = Z1_CLIENTE' }
                    ]
                },
                {
                    name: 'SC5 (sc5010)',
                    desc: 'Cabeçalho do Pedido de Venda',
                    fields: ['C5_NUM', 'C5_CLIENTE', 'C5_LOJACLI', 'C5_EMISSAO'],
                    links: [
                        { to: 'SC6', desc: 'C5_NUM = C6_NUM' },
                        { to: 'SC2', desc: 'C5_NUM = C2_PEDIDO' }
                    ]
                },
                {
                    name: 'SC6 (sc6010)',
                    desc: 'Itens do Pedido de Venda',
                    fields: ['C6_NUM', 'C6_ITEM', 'C6_PRODUTO', 'C6_QTDVEN', 'C6_ENTREGA'],
                    links: [
                        { to: 'SB1', desc: 'C6_PRODUTO = B1_COD' },
                        { to: 'SC2', desc: 'C6_ITEM = C2_ITEMPV' }
                    ]
                }
            ]
        },
        {
            id: 'engenharia',
            title: 'Módulo Engenharia',
            icon: <Layers className="w-5 h-5 text-blue-500" />,
            color: 'border-blue-200 bg-blue-50',
            tables: [
                {
                    name: 'SB1 (sb1010)',
                    desc: 'Cadastro de Produtos',
                    fields: ['B1_COD', 'B1_DESC', 'B1_TIPO', 'B1_UM', 'B1_GRUPO'],
                    links: [
                        { to: 'SG1', desc: 'B1_COD = G1_COD (Pai) ou G1_COMP (Filho)' },
                        { to: 'SG2', desc: 'B1_COD = G2_PRODUTO' }
                    ]
                },
                {
                    name: 'SG1 (sg1010)',
                    desc: 'Estrutura do Produto (BOM)',
                    fields: ['G1_COD', 'G1_COMP', 'G1_QUANT'],
                    links: [
                        { to: 'SB1', desc: 'G1_COMP = B1_COD' }
                    ]
                },
                {
                    name: 'SG2 (sg2010)',
                    desc: 'Roteiro de Operações',
                    fields: ['G2_PRODUTO', 'G2_RECURSO', 'G2_OPERAC', 'G2_TEMPO'],
                    links: [
                        { to: 'SH6', desc: 'G2_RECURSO = H6_RECURSO' }
                    ]
                },
                {
                    name: 'SZ1 (sz1010)',
                    desc: 'Produto x Cliente',
                    fields: ['Z1_PRODUTO', 'Z1_CLIENTE', 'Z1_CODCLI', 'Z1_REVISAO'],
                    links: [
                        { to: 'SB1', desc: 'Z1_PRODUTO = B1_COD' },
                        { to: 'SA1', desc: 'Z1_CLIENTE = A1_COD' }
                    ]
                }
            ]
        },
        {
            id: 'producao',
            title: 'Módulo Produção (PCP)',
            icon: <Factory className="w-5 h-5 text-amber-500" />,
            color: 'border-amber-200 bg-amber-50',
            tables: [
                {
                    name: 'SC2 (sc2010)',
                    desc: 'Ordens de Produção (OPs)',
                    fields: ['C2_NUM', 'C2_ITEM', 'C2_SEQUEN', 'C2_PRODUTO', 'C2_QUANT', 'C2_PEDIDO'],
                    links: [
                        { to: 'SH6', desc: 'C2_NUM+ITEM+SEQ = H6_OP' },
                        { to: 'SB1', desc: 'C2_PRODUTO = B1_COD' }
                    ]
                },
                {
                    name: 'SH6 (sh6010)',
                    desc: 'Apontamentos de Produção',
                    fields: ['H6_OP', 'H6_RECURSO', 'H6_OPERAC', 'H6_DATA', 'H6_QTDPROD'],
                    links: [
                        { to: 'SC2', desc: 'H6_OP = OP Completa' }
                    ]
                }
            ]
        }
    ];

    return (
        <div className="p-6 max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Database className="w-6 h-6 text-blue-600" />
                        SINCO 1.0 - Dicionário de Dados & Relacionamentos
                    </h1>
                    <p className="text-slate-500 mt-2">
                        Visão estruturada das tabelas do Protheus ERP utilizadas pelo ecossistema SINCO.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {modules.map(mod => (
                        <div key={mod.id} className={`border rounded-xl shadow-sm overflow-hidden bg-white`}>
                            <div 
                                className={`px-4 py-3 flex items-center justify-between cursor-pointer border-b ${mod.color}`}
                                onClick={() => toggleModule(mod.id)}
                            >
                                <div className="flex items-center gap-2 font-bold text-slate-800">
                                    {mod.icon}
                                    {mod.title}
                                </div>
                                {expandedModules[mod.id] ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                            </div>

                            {expandedModules[mod.id] && (
                                <div className="p-4 space-y-4">
                                    {mod.tables.map(table => (
                                        <div key={table.name} className="border border-slate-100 rounded-lg bg-slate-50 overflow-hidden">
                                            <div 
                                                className="px-3 py-2 flex justify-between items-center bg-slate-100 cursor-pointer hover:bg-slate-200 transition-colors"
                                                onClick={(e) => toggleTable(table.name, e)}
                                            >
                                                <div>
                                                    <span className="font-mono font-bold text-slate-700 text-sm">{table.name}</span>
                                                    <p className="text-xs text-slate-500">{table.desc}</p>
                                                </div>
                                                {expandedTables[table.name] ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                            </div>

                                            {expandedTables[table.name] && (
                                                <div className="p-3 text-sm">
                                                    <div className="mb-3">
                                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Campos Principais</span>
                                                        <div className="flex flex-wrap gap-1">
                                                            {table.fields.map(f => (
                                                                <span key={f} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-xs font-mono text-slate-600">
                                                                    {f}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {table.links.length > 0 && (
                                                        <div>
                                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Relacionamentos (Joins)</span>
                                                            <div className="space-y-1.5">
                                                                {table.links.map((link, idx) => (
                                                                    <div key={idx} className="flex items-center gap-2 text-xs">
                                                                        <Link className="w-3 h-3 text-blue-400" />
                                                                        <span className="font-bold text-blue-600">{link.to}</span>
                                                                        <span className="text-slate-500 font-mono text-[10px] bg-white px-1 border rounded">{link.desc}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-5">
                    <h3 className="font-bold text-blue-800 flex items-center gap-2 mb-2">
                        <Box className="w-5 h-5" /> Regras Universais de Integração
                    </h3>
                    <ul className="list-disc pl-5 text-sm text-blue-900 space-y-1">
                        <li>Sempre aplique <code className="bg-blue-100 px-1 rounded">TRIM()</code> em queries PostgreSQL, pois os campos CHAR do Protheus possuem espaços em branco à direita.</li>
                        <li>Sempre adicione a cláusula <code className="bg-blue-100 px-1 rounded">d_e_l_e_t_ = ' '</code> para evitar retornar registros apagados logicamente.</li>
                        <li>Nunca execute DML (INSERT, UPDATE, DELETE) no PostgreSQL da réplica. Use a porta TLPP via REST.</li>
                    </ul>
                </div>
        </div>
    );
};

export default Sinco1DocsPage;
