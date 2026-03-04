import React, { useState } from 'react';
import {
    Search, Book, Package, ShoppingCart, Truck, Factory, FileText,
    Settings, Info, ChevronRight, HelpCircle, ArrowRight, Bot,
    Zap, Database, ShieldCheck, History, Share2, Printer, Layers
} from 'lucide-react';

const HelpCenter = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('overview');

    const modules = [
        {
            id: 'sinco',
            category: 'Engenharia',
            title: 'SINCO: Estrutura & Engenharia',
            icon: <Package className="h-6 w-6 text-indigo-600" />,
            description: 'Lógica da árvore de produtos, roteiros e materiais.',
            content: (
                <div className="space-y-4">
                    <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                        <h4 className="font-bold text-indigo-900 flex items-center gap-2 mb-2">
                            <Zap className="h-4 w-4 text-amber-500" />
                            Árvore Hierárquica Inteligente
                        </h4>
                        <p className="text-sm text-indigo-800 leading-relaxed">
                            O sistema reconstrói a estrutura do produto em tempo real. Itens com fundo azul são <strong>Conjuntos/Pai</strong> (possuem sub-níveis), enquanto fundos brancos são <strong>Componentes</strong> simples.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div className="p-3 border rounded-lg bg-white shadow-sm">
                            <h5 className="font-bold text-gray-800 text-sm mb-1 uppercase tracking-tight">Vínculo de Materiais</h5>
                            <p className="text-xs text-gray-600">
                                Materiais de consumo (tinta, eletrodos, chapas) são puxados da <code className="bg-gray-100 px-1 rounded text-red-600 font-bold">viewmontapeca</code>. O sistema realiza um vínculo <em>case-insensitive</em> via nome de arquivo, garantindo que o desenho .asm encontre seus consumíveis mesmo com variações de nomenclatura.
                            </p>
                        </div>
                        <div className="p-3 border rounded-lg bg-white shadow-sm">
                            <h5 className="font-bold text-gray-800 text-sm mb-1 uppercase tracking-tight">Controle de Revisão (Social)</h5>
                            <p className="text-xs text-gray-600">
                                O ícone de balão <code className="bg-amber-100 px-1 rounded text-amber-600"><Bot size={12} className="inline" /></code> indica revisões pendentes. Você pode "Resolver" discussões de engenharia diretamente pelo painel, mantendo um histórico auditável de por que uma peça foi alterada.
                            </p>
                        </div>
                    </div>

                    <div className="bg-slate-800 text-slate-200 p-4 rounded-xl text-xs font-mono">
                        <p className="text-blue-400 font-bold mb-1">// Dica de Engenharia</p>
                        <p>O ícone de PDF fica vermelho se o desenho existir no servidor (/mnt/engenharia). Se ficar cinza, o arquivo físico não foi encontrado no caminho mapeado.</p>
                    </div>
                </div>
            )
        },
        {
            id: 'sales',
            category: 'Comercial',
            title: 'Pedidos de Venda & Comercial',
            icon: <ShoppingCart className="h-6 w-6 text-blue-600" />,
            description: 'Monitor de pedidos, agrupamento de códigos e Ata Viva.',
            content: (
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-800 border-b pb-2">Gestão de Pedidos Protheus</h3>

                    <div className="space-y-3">
                        <div className="flex gap-3">
                            <div className="bg-blue-100 p-2 rounded h-fit"><ShieldCheck className="h-4 w-4 text-blue-600" /></div>
                            <div>
                                <h4 className="font-bold text-sm">Status Evolução (Real-time)</h4>
                                <p className="text-xs text-gray-500">Integração nativa via query SQL. O sistema identifica se um item está em aberto, produção ou faturado analisando as flags do ERP.</p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <div className="bg-green-100 p-2 rounded h-fit"><Share2 className="h-4 w-4 text-green-600" /></div>
                            <div>
                                <h4 className="font-bold text-sm">Agrupamento de Códigos (Novidade)</h4>
                                <p className="text-xs text-gray-500">Múltiplos "Códigos do Cliente" para o mesmo produto são consolidados em uma única linha usando <code className="bg-gray-100 px-1 rounded">STRING_AGG</code>, eliminando duplicidade visual no grid.</p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <div className="bg-amber-100 p-2 rounded h-fit"><History className="h-4 w-4 text-amber-600" /></div>
                            <div>
                                <h4 className="font-bold text-sm">Ata Viva (Notes System)</h4>
                                <p className="text-xs text-gray-500">Use o ícone de post-it para registrar comunicações críticas. Diferente do Protheus, o PCP Metalfisa foca na velocidade da informação.</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 flex items-start gap-3">
                        <Printer className="h-8 w-8 text-blue-400 flex-shrink-0" />
                        <p className="text-xs text-blue-800">
                            <strong>Dica Pro:</strong> Ao imprimir o relatório de Vendas (Ctrl+P), o sistema oculta automaticamente menus e barras laterais para gerar um PDF limpo e formatado.
                        </p>
                    </div>
                </div>
            )
        },
        {
            id: 'pcpmetal',
            category: 'Inteligência Artificial',
            title: 'PCPMetal: O Cérebro AI',
            icon: <Bot className="h-6 w-6 text-teal-600" />,
            description: 'Análise de dados, previsões de carga e suporte contextuall.',
            content: (
                <div className="space-y-4">
                    <p className="text-sm text-gray-600 italic">O PCPMetal não é apenas um chat, é uma integração profunda com seus dados produtivos.</p>

                    <ul className="space-y-2">
                        <li className="flex items-center gap-2 text-sm text-gray-700">
                            <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                            <strong>Contexto Inteligente:</strong> A IA "lê" a tela onde você está. Se você abrir a IA no SINCO, ela já sabe qual produto você está analisando.
                        </li>
                        <li className="flex items-center gap-2 text-sm text-gray-700">
                            <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                            <strong>Previsão de Carga:</strong> Capaz de analisar prazos vs. roteiros de produção para alertar gargalos.
                        </li>
                        <li className="flex items-center gap-2 text-sm text-gray-700">
                            <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                            <strong>Chat com Documentos:</strong> Ajuda a traduzir erros técnicos ou explicar campos complexos do sistema.
                        </li>
                    </ul>

                    <div className="bg-teal-950 text-teal-200 p-4 rounded-xl shadow-inner">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-teal-400">Security Note</span>
                            <ShieldCheck className="h-3 w-3 text-teal-400" />
                        </div>
                        <p className="text-xs leading-relaxed">
                            A IA processa apenas metadados necessários para a resposta. Dados sensíveis de custo ou segredos industriais são higienizados antes do processamento externo.
                        </p>
                    </div>
                </div>
            )
        },
        {
            id: 'logistics',
            category: 'Expedição',
            title: 'Logística & Romaneio',
            icon: <Truck className="h-6 w-6 text-red-600" />,
            description: 'Finalização de processos e despacho de carga.',
            content: (
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">O módulo Logística fecha o ciclo de vida do pedido dentro da fábrica.</p>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                            <h5 className="font-bold text-xs text-red-700">Romaneio</h5>
                            <p className="text-[10px] text-red-600/70">Criação de listas de carga por veículo.</p>
                        </div>
                        <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                            <h5 className="font-bold text-xs text-red-700">Etiquetagem</h5>
                            <p className="text-[10px] text-red-600/70">Geração de etiquetas de volume para volumes rastreáveis.</p>
                        </div>
                    </div>
                </div>
            )
        }
    ];

    const filteredModules = modules.filter(m =>
        m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-6 bg-[#f8fafc] min-h-screen font-sans selection:bg-blue-100">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header (Premium Redesign) */}
                <div className="relative py-12 px-8 overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 text-white shadow-2xl">
                    <div className="absolute top-0 right-0 p-12 opacity-10">
                        <Book className="h-64 w-64 -rotate-12" />
                    </div>

                    <div className="relative z-10 max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs font-bold uppercase tracking-widest mb-6 backdrop-blur-md">
                            <HelpCircle className="h-3 w-3" />
                            <span>Centro de Suporte MetalFisa</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight leading-tight">
                            Documentação <span className="text-blue-400">Completa</span> do Ecossistema.
                        </h1>
                        <p className="text-slate-300 text-lg leading-relaxed mb-8">
                            Entenda a lógica de funcionamento, os fluxos de dados e as novas ferramentas de IA integradas ao seu PCP.
                        </p>

                        <div className="relative group max-w-lg">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-400 transition-colors" />
                            <input
                                type="text"
                                placeholder="O que você deseja saber hoje?"
                                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white/10 border border-white/10 text-white placeholder:text-slate-500 backdrop-blur-xl focus:bg-white focus:text-slate-900 focus:ring-4 focus:ring-blue-500/20 transition-all outline-none"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Tabs / Navigation */}
                <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-200 overflow-hidden">
                    <div className="flex border-b border-slate-100 p-2 gap-2 bg-slate-50/50">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`px-8 py-3 text-sm font-bold rounded-xl transition-all ${activeTab === 'overview' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'}`}
                        >
                            <div className="flex items-center gap-2">
                                <Layers className="h-4 w-4" />
                                Visão Geral do Fluxo
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('modules')}
                            className={`px-8 py-3 text-sm font-bold rounded-xl transition-all ${activeTab === 'modules' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'}`}
                        >
                            <div className="flex items-center gap-2">
                                <Database className="h-4 w-4" />
                                Documentação de Módulos
                            </div>
                        </button>
                    </div>

                    <div className="p-8 md:p-12">
                        {activeTab === 'overview' && (
                            <div className="space-y-12">
                                <div className="text-center max-w-xl mx-auto space-y-2">
                                    <h2 className="text-3xl font-black text-slate-900">Workflow MetalFisa</h2>
                                    <p className="text-slate-500">O caminho do dado: da intenção de compra à entrega final no cliente.</p>
                                </div>

                                {/* Flowchart (Refined) */}
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-6 relative">
                                    <div className="hidden md:block absolute top-[60px] left-0 right-0 h-0.5 bg-gradient-to-r from-blue-100 via-indigo-100 to-red-100 -z-10"></div>

                                    {[
                                        { label: 'Vendas', desc: 'Pedido Protheus', icon: <ShoppingCart />, color: 'blue' },
                                        { label: 'SINCO', desc: 'Engenharia/BOM', icon: <Package />, color: 'indigo' },
                                        { label: 'PCP', desc: 'Geração de OPs', icon: <Factory />, color: 'orange' },
                                        { label: 'Produção', desc: 'Apontamento', icon: <Settings />, color: 'green' },
                                        { label: 'Logística', desc: 'Romaneio/Entrega', icon: <Truck />, color: 'red' },
                                    ].map((step, i) => (
                                        <div key={i} className="flex flex-col items-center group">
                                            <div className={`w-28 h-28 bg-white border-2 border-slate-100 rounded-3xl flex items-center justify-center shadow-sm group-hover:border-${step.color}-500 group-hover:shadow-lg group-hover:-translate-y-2 transition-all duration-300`}>
                                                <div className={`p-4 rounded-2xl bg-${step.color === 'blue' ? 'blue-50' : step.color === 'indigo' ? 'indigo-50' : step.color === 'orange' ? 'orange-50' : step.color === 'green' ? 'green-50' : 'red-50'} text-${step.color === 'blue' ? 'blue-600' : step.color === 'indigo' ? 'indigo-600' : step.color === 'orange' ? 'orange-600' : step.color === 'green' ? 'green-600' : 'red-600'}`}>
                                                    {React.cloneElement(step.icon, { className: "h-8 w-8" })}
                                                </div>
                                            </div>
                                            <div className="mt-4 text-center">
                                                <h4 className="font-black text-slate-800 tracking-tight">{step.label}</h4>
                                                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">{step.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <h3 className="font-black text-xl text-slate-900 flex items-center gap-3">
                                            <div className="p-2 bg-blue-600 rounded-lg text-white shadow-lg shadow-blue-200">
                                                <Info className="h-5 w-5" />
                                            </div>
                                            Dicas Rápidas de Navegação
                                        </h3>
                                        <ul className="space-y-3">
                                            <li className="flex gap-2 text-sm text-slate-600">
                                                <ChevronRight className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                                                <span><strong>Barra de Busca:</strong> Utilize códigos do Protheus (ex: PV) ou nomes de clientes. O sistema sincroniza de 1 em 1 minuto.</span>
                                            </li>
                                            <li className="flex gap-2 text-sm text-slate-600">
                                                <ChevronRight className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                                                <span><strong>Atalhos:</strong> Em telas de grid, <code className="bg-white border rounded px-1">Esc</code> geralmente limpa filtros e <code className="bg-white border rounded px-1">F5</code> força a atualização com o banco Protheus.</span>
                                            </li>
                                        </ul>
                                    </div>
                                    <div className="space-y-4">
                                        <h3 className="font-black text-xl text-slate-900 flex items-center gap-3">
                                            <div className="p-2 bg-teal-600 rounded-lg text-white shadow-lg shadow-teal-200">
                                                <Bot className="h-5 w-5" />
                                            </div>
                                            Interação com a IA
                                        </h3>
                                        <p className="text-sm text-slate-600 leading-relaxed">
                                            Sempre que vir o ícone da <strong>IA Flutuante</strong>, você pode pedir análises como <em>"Qual a previsão de término desse pedido?"</em> ou <em>"Explique o roteiro de produção deste item"</em>. A IA possui acesso ao histórico de revisões e aos roteiros de processo definidos na Engenharia.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'modules' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {filteredModules.map((module) => (
                                    <div key={module.id} className="group relative bg-white border border-slate-200 rounded-[2rem] p-8 hover:shadow-2xl hover:shadow-blue-900/5 transition-all hover:border-blue-400">
                                        <div className="flex items-start justify-between mb-6">
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 bg-blue-50 px-2 py-1 rounded-md">{module.category}</span>
                                                <h3 className="text-2xl font-black text-slate-900 tracking-tight">{module.title}</h3>
                                            </div>
                                            <div className="p-4 bg-slate-50 rounded-2xl group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                                {module.icon}
                                            </div>
                                        </div>

                                        <p className="text-slate-500 text-sm mb-8 font-medium">{module.description}</p>

                                        <div className="relative">
                                            <div className="content-rendered">
                                                {module.content}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {filteredModules.length === 0 && (
                                    <div className="col-span-2 text-center py-20 bg-slate-50 rounded-[2rem] border border-dashed border-slate-300">
                                        <Search className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                                        <p className="text-slate-500 font-bold">Infelizmente não encontramos documentação para o termo "{searchTerm}".</p>
                                        <p className="text-slate-400 text-sm">Tente palavras-chave como SINCO, Vendas ou IA.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Info */}
                <div className="text-center pb-12">
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">
                        PCP MetalFisa &copy; 2025 - Documentação Interna v3.2
                    </p>
                </div>
            </div>
        </div>
    );
};

export default HelpCenter;
