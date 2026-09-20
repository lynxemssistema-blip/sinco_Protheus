import React, { useState } from 'react';
import {
    X, BrainCircuit, Clock, Calendar, Layers, Zap, AlertTriangle,
    CheckCircle2, Gauge, ShieldAlert, BookOpen, ChevronRight, Calculator,
    TrendingUp, Ban, Cpu, ArrowRight, Bot, Sparkles, RefreshCw, Check
} from 'lucide-react';

export default function FcsExplanationModal({ isOpen, onClose }) {
    // Aba padrão: 'agente' (explicação direta de como o agente funciona)
    const [activeTab, setActiveTab] = useState('agente');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[10000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-200">

                {/* CABEÇALHO */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-950 via-indigo-900 to-slate-900 text-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-500/20 border border-indigo-400/30 rounded-xl shadow-inner">
                            <Bot className="w-6 h-6 text-indigo-300" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                                    Agente: Planejamento Inteligente
                                </h2>
                                <span className="text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-indigo-500/30 border border-indigo-400/40 text-indigo-200">
                                    Capacidade Finita (FCS)
                                </span>
                            </div>
                            <p className="text-xs text-indigo-200/90 mt-0.5">
                                Como o Agente pensa, simula e distribui a carga da fábrica minuto a minuto
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-indigo-200 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                        title="Fechar (Esc)"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* ABAS DE NAVEGAÇÃO */}
                <div className="flex border-b border-slate-200 bg-slate-50/80 px-6 shrink-0 gap-1 overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('agente')}
                        className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'agente'
                                ? 'border-indigo-600 text-indigo-700 bg-white shadow-xs rounded-t-lg'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <Bot className="w-4 h-4 text-indigo-600" />
                        1. Como o Agente Funciona
                    </button>
                    <button
                        onClick={() => setActiveTab('regras')}
                        className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'regras'
                                ? 'border-indigo-600 text-indigo-700 bg-white shadow-xs rounded-t-lg'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <Layers className="w-4 h-4" />
                        2. Regras de Sequenciamento
                    </button>
                    <button
                        onClick={() => setActiveTab('calculo')}
                        className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'calculo'
                                ? 'border-indigo-600 text-indigo-700 bg-white shadow-xs rounded-t-lg'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <Calculator className="w-4 h-4" />
                        3. Como a Carga é Calculada
                    </button>
                    <button
                        onClick={() => setActiveTab('filtros')}
                        className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'filtros'
                                ? 'border-indigo-600 text-indigo-700 bg-white shadow-xs rounded-t-lg'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <Ban className="w-4 h-4 text-rose-500" />
                        4. Ordens Desconsideradas
                    </button>
                    <button
                        onClick={() => setActiveTab('sync')}
                        className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'sync'
                                ? 'border-indigo-600 text-indigo-700 bg-white shadow-xs rounded-t-lg'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <RefreshCw className="w-4 h-4 text-amber-600" />
                        5. Sincronização de Datas (Sync)
                    </button>
                </div>

                {/* CORPO DO CONTEÚDO */}
                <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50 space-y-6 text-slate-700 text-sm">

                    {/* ═══════════════════════════════════════════════════════════════
                        ABA 1: COMO O AGENTE FUNCIONA (VISÃO GERAL DO AGENTE)
                    ═══════════════════════════════════════════════════════════════ */}
                    {activeTab === 'agente' && (
                        <div className="space-y-5 animate-in fade-in duration-150">

                            {/* Card Hero: O que é o Agente? */}
                            <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-900 via-indigo-850 to-slate-900 text-white shadow-md relative overflow-hidden">
                                <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-white/10 rounded-xl border border-white/10 shrink-0">
                                        <Sparkles className="w-7 h-7 text-amber-300" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <span className="text-xs uppercase tracking-widest font-extrabold text-indigo-300">
                                            O Cérebro do PCP MetalFisa
                                        </span>
                                        <h3 className="text-lg font-bold text-white leading-snug">
                                            O que faz o Agente de Planejamento Inteligente?
                                        </h3>
                                        <p className="text-xs text-indigo-100/90 leading-relaxed max-w-3xl">
                                            O Agente é um motor de sequenciamento autônomo baseado no conceito de <strong>Capacidade Finita (FCS - Finite Capacity Scheduling)</strong>. Ele substitui o planejamento manual por planilhas, simulando em segundos o comportamento físico de cada posto de trabalho da fábrica, garantindo que <strong>nenhuma máquina receba mais horas do que pode produzir</strong> e que as <strong>datas de entrega prometidas aos clientes sejam cumpridas</strong>.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* O Fluxo do Agente em 6 Passos */}
                            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                                <div className="border-b border-slate-100 pb-3">
                                    <h4 className="font-bold text-slate-900 text-base flex items-center gap-2">
                                        <Cpu className="w-5 h-5 text-indigo-600" />
                                        O Ciclo de Decisão do Agente (Passo a Passo)
                                    </h4>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Quando você clica em "Executar", o Agente executa automaticamente esta sequência de 6 etapas:
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">

                                    {/* Passo 1 */}
                                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3">
                                        <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                                            1
                                        </div>
                                        <div className="space-y-1 text-xs">
                                            <strong className="text-slate-900 block font-semibold text-sm">
                                                Varredura & Higienização da Carteira
                                            </strong>
                                            <p className="text-slate-600 leading-relaxed">
                                                O Agente conecta ao Protheus e extrai as OPs e pedidos abertos. Ele aplica filtros de segurança automáticos: descarta pedidos inativos (<code className="bg-slate-200 px-1 py-0.5 rounded">app_pedidos_inativos</code>), orçamentos, produtos bloqueados e ordens sem cliente comercial.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Passo 2 */}
                                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3">
                                        <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                                            2
                                        </div>
                                        <div className="space-y-1 text-xs">
                                            <strong className="text-slate-900 block font-semibold text-sm">
                                                Fila de Priorização Inteligente
                                            </strong>
                                            <p className="text-slate-600 leading-relaxed">
                                                Quem ganha a máquina primeiro? O Agente prioriza quem tem <strong>Data de Entrega PCP mais próxima</strong>. Em seguida, respeita a árvore do produto (BOM): peças cortadas na chapa entram antes de dobrar e soldar.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Passo 3 */}
                                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3">
                                        <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                                            3
                                        </div>
                                        <div className="space-y-1 text-xs">
                                            <strong className="text-slate-900 block font-semibold text-sm">
                                                Mapeamento de Postos & Matriz de Capacidade
                                            </strong>
                                            <p className="text-slate-600 leading-relaxed">
                                                O Agente lê a capacidade em minutos de cada máquina (ex: Laser = 1.920 min/dia em 3 turnos; Dobra = 480 min/dia) e consulta os tempos unitários de engenharia do roteiro (<code className="bg-slate-200 px-1 py-0.5 rounded">SG2010.G2_TEMPAD</code>).
                                            </p>
                                        </div>
                                    </div>

                                    {/* Passo 4 */}
                                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3">
                                        <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                                            4
                                        </div>
                                        <div className="space-y-1 text-xs">
                                            <strong className="text-slate-900 block font-semibold text-sm">
                                                Fatiamento Diário & Transbordo Multi-Dia
                                            </strong>
                                            <p className="text-slate-600 leading-relaxed">
                                                A carga de cada OP é calculada (<span className="font-mono font-bold text-indigo-700">Qtd × Tempo</span>). Se um lote precisa de 1.200 min e o posto só tem 480 min livres hoje, o Agente <strong>aloca 480 min hoje e transborda o restante automaticamente para os próximos dias úteis</strong>.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Passo 5 */}
                                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3">
                                        <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                                            5
                                        </div>
                                        <div className="space-y-1 text-xs">
                                            <strong className="text-slate-900 block font-semibold text-sm">
                                                Sobreposição (180 min) & Sobrecarga (+50%)
                                            </strong>
                                            <p className="text-slate-600 leading-relaxed">
                                                Para não travar a fábrica esperando todo o lote terminar, a próxima operação pode começar assim que <strong>180 minutos de peças</strong> estiverem prontos no posto anterior. Se a entrega for atrasar, o Agente aciona o <strong>mecanismo de sobrecarga (+50% em horas extras)</strong> para proteger o prazo!
                                            </p>
                                        </div>
                                    </div>

                                    {/* Passo 6 */}
                                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3">
                                        <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                                            6
                                        </div>
                                        <div className="space-y-1 text-xs">
                                            <strong className="text-slate-900 block font-semibold text-sm">
                                                Determinação da Prev. Fat & Sincronização
                                            </strong>
                                            <p className="text-slate-600 leading-relaxed">
                                                Ao terminar de alocar a última operação da última peça, o Agente define com precisão matemática a <strong>Previsão de Faturamento (Prev. Fat)</strong>. Se o Sync estiver ativado, ele atualiza a Data PCP vencida para essa nova data viável.
                                            </p>
                                        </div>
                                    </div>

                                </div>
                            </div>

                        </div>
                    )}

                    {/* ═══════════════════════════════════════════════════════════════
                        ABA 2: REGRAS DO SEQUENCIAMENTO
                    ═══════════════════════════════════════════════════════════════ */}
                    {activeTab === 'regras' && (
                        <div className="space-y-4 animate-in fade-in duration-150">

                            {/* Card 1: Fila de Priorização */}
                            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                                <div className="flex items-center gap-2 mb-2 text-indigo-900 font-bold text-base">
                                    <div className="w-6 h-6 rounded-md bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-black">1</div>
                                    <h3>Fila de Prioridade das Ordens (Quem entra primeiro?)</h3>
                                </div>
                                <p className="text-xs text-slate-600 leading-relaxed mb-3">
                                    Ao receber a lista de OPs selecionadas, o motor <strong>não</strong> as processa aleatoriamente. Ele reordena a fila seguindo dois critérios rigorosos:
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                    <div className="p-3 bg-indigo-50/60 rounded-lg border border-indigo-100">
                                        <p className="font-bold text-indigo-900 flex items-center gap-1.5 mb-1">
                                            <span>🎯</span> 1º Critério: Data de Entrega PCP
                                        </p>
                                        <p className="text-slate-600">
                                            A OP com a data de entrega mais próxima ao cliente entra primeiro no posto de trabalho. OPs sem data cadastrada vão para o final da fila.
                                        </p>
                                    </div>
                                    <div className="p-3 bg-indigo-50/60 rounded-lg border border-indigo-100">
                                        <p className="font-bold text-indigo-900 flex items-center gap-1.5 mb-1">
                                            <span>🌳</span> 2º Critério: Nível da Estrutura (BOM)
                                        </p>
                                        <p className="text-slate-600">
                                            Peças cortadas e subconjuntos mais profundos da árvore do produto são agendados antes do conjunto soldado ou montagem final.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Card 2: Fatiamento Diário e Multi-Dia */}
                            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                                <div className="flex items-center gap-2 mb-2 text-indigo-900 font-bold text-base">
                                    <div className="w-6 h-6 rounded-md bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-black">2</div>
                                    <h3>Alocação por Capacidade Finita (Fatiamento Diário)</h3>
                                </div>
                                <p className="text-xs text-slate-600 leading-relaxed mb-3">
                                    Cada máquina/recurso possui uma capacidade diária em minutos (ex: 480 min = 8h, 960 min = 16h, 1.920 min = Laser multi-turnos).
                                </p>
                                <div className="p-3 bg-slate-100 rounded-lg border border-slate-200 space-y-2 text-xs">
                                    <div className="flex items-start gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                        <div>
                                            <strong>Consumo no Dia:</strong> Se a operação precisa de 300 min e o posto tem 480 min livres, ela consome 300 min e é concluída hoje. Restam 180 min para a próxima OP.
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                        <div>
                                            <strong>Transbordo Multi-Dia:</strong> Se a carga de um lote grande precisa de 1.200 min, o motor aloca 480 min no Dia 1, 480 min no Dia 2 e 240 min no Dia 3. O saldo transborda sem sobrecarregar nenhum dia!
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Card 3: Regra de Sobreposição dos 180 Minutos */}
                            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                                <div className="flex items-center gap-2 mb-2 text-indigo-900 font-bold text-base">
                                    <div className="w-6 h-6 rounded-md bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-black">3</div>
                                    <h3>Transição entre Postos & Regra de Sobreposição (180 min)</h3>
                                </div>
                                <p className="text-xs text-slate-600 leading-relaxed mb-3">
                                    Como o motor trata a transição da Operação 10 (ex: Corte) para a Operação 20 (ex: Dobra ou Usinagem)?
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                        <span className="font-bold text-slate-800 block mb-1">🔁 Mesmo Recurso</span>
                                        <span className="text-slate-600">
                                            A próxima operação só pode iniciar no <strong>dia útil seguinte</strong> ao término da anterior, pois a máquina ainda está ocupada finalizando o lote.
                                        </span>
                                    </div>
                                    <div className="p-3 bg-emerald-50/70 rounded-lg border border-emerald-200">
                                        <span className="font-bold text-emerald-900 block mb-1">⚡ Recurso Diferente (Sobreposição)</span>
                                        <span className="text-slate-600">
                                            <strong>Não espera o lote todo terminar!</strong> Assim que a operação atual acumular <strong>180 minutos de peças concluídas</strong>, a próxima operação já pode começar no posto subsequente!
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Card 4: Mecanismo de Sobrecarga (+50%) */}
                            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                                <div className="flex items-center gap-2 mb-2 text-indigo-900 font-bold text-base">
                                    <div className="w-6 h-6 rounded-md bg-amber-100 flex items-center justify-center text-amber-800 text-xs font-black">4</div>
                                    <h3>Mecanismo de Sobrecarga (+50% Horas Extras para Salvar Prazo)</h3>
                                </div>
                                <p className="text-xs text-slate-600 leading-relaxed">
                                    Se ao calcular a OP com capacidade normal de 100% ela for terminar <strong>depois</strong> da Data PCP prometida ao cliente:
                                </p>
                                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 leading-relaxed">
                                    O motor <strong>desfaz o cálculo normal</strong> e retenta alocar liberando um bucket extra de <strong>+50% de capacidade adicional por dia</strong> naquele posto de trabalho (simulando hora extra ou turno estendido). As fatias salvas recebem o marcador <code className="bg-amber-200/70 px-1 py-0.5 rounded font-mono font-bold">is_sobrecarga = 1</code>.
                                </div>
                            </div>

                        </div>
                    )}

                    {/* ═══════════════════════════════════════════════════════════════
                        ABA 3: COMO A CARGA É CALCULADA
                    ═══════════════════════════════════════════════════════════════ */}
                    {activeTab === 'calculo' && (
                        <div className="space-y-4 animate-in fade-in duration-150">

                            {/* Fórmula Principal */}
                            <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-5 rounded-xl shadow-md">
                                <span className="text-xs font-bold uppercase tracking-widest text-indigo-300 block mb-1">Fórmula Central da Carga</span>
                                <div className="text-lg sm:text-xl font-mono font-bold text-amber-300 py-2 border-y border-indigo-700/60 my-2">
                                    Carga (minutos) = Quantidade Pendente × Tempo Unitário (min)
                                </div>
                                <p className="text-xs text-indigo-200 mt-2">
                                    A carga calculada em minutos é deduzida da capacidade diária disponível do posto de trabalho na data planejada.
                                </p>
                            </div>

                            {/* Variável 1: Tempo Unitário */}
                            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 mb-2">
                                    <Clock className="w-4 h-4 text-indigo-600" />
                                    1. De onde vem o Tempo Unitário?
                                </h4>
                                <ul className="space-y-2 text-xs text-slate-600">
                                    <li className="flex items-start gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                                        <span>
                                            <strong>Roteiro Protheus (`SG2010` - Campo `G2_TEMPAD`):</strong> Tempo de engenharia cadastrado na operação em minutos por peça.
                                        </span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                                        <span>
                                            <strong>Fallback da Máquina (`app_recursos_capacidade`):</strong> Se o roteiro não tiver tempo cadastrado, o motor utiliza o tempo padrão unitário configurado para aquele recurso.
                                        </span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                                        <span>
                                            <strong>Bloqueio de Segurança:</strong> Se o tempo for zero ou nulo, o FCS impede a alocação e avisa o usuário com a lista dos produtos sem tempo.
                                        </span>
                                    </li>
                                </ul>
                            </div>

                            {/* Variável 2: Quantidade Pendente */}
                            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 mb-2">
                                    <Gauge className="w-4 h-4 text-indigo-600" />
                                    2. Como é determinado o Saldo Pendente?
                                </h4>
                                <p className="text-xs text-slate-600 mb-2 leading-relaxed">
                                    O FCS não agenda peças que já foram fabricadas ou apontadas no chão de fábrica:
                                </p>
                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 font-mono text-xs text-slate-700 space-y-1">
                                    <div>Qtd Concluída = MAX( Apontado ERP Protheus, Apontamentos Locais MySQL )</div>
                                    <div className="text-indigo-700 font-bold">Qtd Pendente = MAX( 0, Quantidade Total da OP - Qtd Concluída )</div>
                                </div>
                                <p className="text-[11px] text-slate-500 mt-2">
                                    * Se uma operação já estiver 100% apontada, ela é ignorada pelo motor e não consome capacidade das máquinas.
                                </p>
                            </div>

                            {/* Variável 3: Calendário e Dias Úteis */}
                            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 mb-2">
                                    <Calendar className="w-4 h-4 text-indigo-600" />
                                    3. Regras de Calendário Produtivo
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-900">
                                        <strong>Domingos:</strong> Sempre bloqueados (Capacidade = 0 min).
                                    </div>
                                    <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-900">
                                        <strong>Sábados:</strong> Bloqueados por padrão. Podem ser ativados pelo botão "Incluir Sábado".
                                    </div>
                                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900">
                                        <strong>Data no Passado:</strong> Proibida. A produção sempre inicia a partir de hoje ou da data base útil selecionada.
                                    </div>
                                </div>
                            </div>

                        </div>
                    )}

                    {/* ═══════════════════════════════════════════════════════════════
                        ABA 4: ORDENS DESCONSIDERADAS
                    ═══════════════════════════════════════════════════════════════ */}
                    {activeTab === 'filtros' && (
                        <div className="space-y-4 animate-in fade-in duration-150">

                            <div className="p-4 bg-rose-50/80 border border-rose-200 rounded-xl text-xs text-rose-900 leading-relaxed flex items-start gap-3">
                                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-bold text-sm text-rose-950 mb-1">
                                        Filtros Prévios Obrigatórios do Motor FCS
                                    </p>
                                    <p>
                                        Para garantir que a capacidade fabril não seja consumida por pedidos cancelados, arquivados ou ordens sem cliente, o motor desconsidera automaticamente qualquer ordem que se enquadre nas condições abaixo:
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">

                                <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
                                    <div className="font-bold text-slate-900 flex items-center gap-2 mb-1.5">
                                        <Ban className="w-4 h-4 text-rose-500" />
                                        1. Projetos / Pedidos Inativos
                                    </div>
                                    <p className="text-slate-600 leading-relaxed">
                                        Pedidos cadastrados na tabela <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">app_pedidos_inativos</code> são <strong>100% desconsiderados</strong>. Nenhuma de suas peças consome capacidade das máquinas.
                                    </p>
                                </div>

                                <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
                                    <div className="font-bold text-slate-900 flex items-center gap-2 mb-1.5">
                                        <Ban className="w-4 h-4 text-rose-500" />
                                        2. Ordens sem Cliente Comercial
                                    </div>
                                    <p className="text-slate-600 leading-relaxed">
                                        Ordens de serviço internas ou produções que não possuam vínculo com cliente cadastrado no ERP Protheus (`SA1010`) são <strong>desconsideradas</strong> da fila do FCS.
                                    </p>
                                </div>

                                <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
                                    <div className="font-bold text-slate-900 flex items-center gap-2 mb-1.5">
                                        <Ban className="w-4 h-4 text-rose-500" />
                                        3. Pedidos Tipo Orçamento (B)
                                    </div>
                                    <p className="text-slate-600 leading-relaxed">
                                        Pedidos com flag de orçamento no Protheus (`C5_TIPO = 'B'`) não representam venda fechada firme e não reservam capacidade produtiva.
                                    </p>
                                </div>

                                <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
                                    <div className="font-bold text-slate-900 flex items-center gap-2 mb-1.5">
                                        <Ban className="w-4 h-4 text-rose-500" />
                                        4. OPs Canceladas ou Concluídas
                                    </div>
                                    <p className="text-slate-600 leading-relaxed">
                                        OPs marcadas com status de cancelamento (`C2_STATUS = 'C'`) ou que já foram totalmente entregues pelo chão de fábrica (`Qtd Feita ≥ Qtd Total`).
                                    </p>
                                </div>

                                <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
                                    <div className="font-bold text-slate-900 flex items-center gap-2 mb-1.5">
                                        <Ban className="w-4 h-4 text-rose-500" />
                                        5. Produtos Bloqueados no ERP
                                    </div>
                                    <p className="text-slate-600 leading-relaxed">
                                        Códigos de produto com bloqueio de engenharia ou almoxarifado no Protheus (`B1_MSBLQL` ativo).
                                    </p>
                                </div>

                                <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
                                    <div className="font-bold text-slate-900 flex items-center gap-2 mb-1.5">
                                        <Ban className="w-4 h-4 text-rose-500" />
                                        6. Pedidos 100% Faturados
                                    </div>
                                    <p className="text-slate-600 leading-relaxed">
                                        Itens de pedidos de venda que já tiveram todas as suas notas fiscais emitidas (saldo a faturar menor ou igual a zero).
                                    </p>
                                </div>

                            </div>

                        </div>
                    )}

                    {/* ═══════════════════════════════════════════════════════════════
                        ABA 5: SINCRONIZAÇÃO DE DATAS (SYNC PREV. FAT -> DATA PCP)
                    ═══════════════════════════════════════════════════════════════ */}
                    {activeTab === 'sync' && (
                        <div className="space-y-4 animate-in fade-in duration-150">

                            <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 text-xs text-amber-950 leading-relaxed space-y-2 shadow-xs">
                                <div className="flex items-center gap-2">
                                    <RefreshCw className="w-5 h-5 text-amber-700 shrink-0" />
                                    <h3 className="font-bold text-sm text-amber-950">
                                        Como funciona a Sincronização: Prev. Fat ➜ Data PCP?
                                    </h3>
                                </div>
                                <p className="text-slate-700 leading-relaxed">
                                    Muitos pedidos no ERP possuem uma <strong>Data PCP vencida no passado</strong> porque a fábrica sofreu atrasos anteriores ou o cliente reprogramou o projeto. Quando você ativa a opção <strong>"Sync Prev. Fat → Data PCP"</strong>, o Agente calcula um cronograma 100% viável e atualiza apenas as datas que não podem mais ser cumpridas no passado.
                                </p>
                            </div>

                            {/* Comparativo Didático e Cronologicamente Coerente */}
                            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
                                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-indigo-600" />
                                    Exemplo Prático e Coerente (Cronologia Realista)
                                </h4>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">

                                    {/* Caso 1: Data Vencida */}
                                    <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 space-y-2">
                                        <div className="flex items-center gap-1.5 text-amber-900 font-bold text-sm">
                                            <span>🔄</span> Caso 1: Data PCP Vencida (Atualiza)
                                        </div>
                                        <p className="text-slate-600 text-[11px]">
                                            O pedido estava cadastrado com data antiga no Protheus:
                                        </p>
                                        <div className="bg-white p-3 rounded-lg border border-amber-200/80 font-mono text-[11px] space-y-1">
                                            <div>Data Início (Hoje): <strong className="text-slate-800">17/09/2026</strong></div>
                                            <div className="text-red-600">Data PCP antiga no ERP: <span className="line-through font-bold">15/08/2026</span> (vencida)</div>
                                            <div className="text-emerald-700">Agente calcula Prev. Fat: <strong className="font-bold">08/10/2026</strong> (no futuro)</div>
                                            <div className="mt-1 pt-1 border-t border-slate-100 text-amber-800 font-bold">
                                                ➜ Data PCP atualizada para: 08/10/2026 ✓
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-emerald-800 font-medium">
                                            ✓ O pedido ganha uma data de entrega viável e realista no futuro!
                                        </p>
                                    </div>

                                    {/* Caso 2: Data Futura */}
                                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                                        <div className="flex items-center gap-1.5 text-slate-900 font-bold text-sm">
                                            <span>🛡️</span> Caso 2: Data PCP no Futuro (Preserva)
                                        </div>
                                        <p className="text-slate-600 text-[11px]">
                                            O pedido tem entrega prometida para daqui a 2 meses:
                                        </p>
                                        <div className="bg-white p-3 rounded-lg border border-slate-200 font-mono text-[11px] space-y-1">
                                            <div>Data Início (Hoje): <strong className="text-slate-800">17/09/2026</strong></div>
                                            <div className="text-emerald-700">Data PCP atual no ERP: <strong className="font-bold">25/11/2026</strong> (futura)</div>
                                            <div className="text-slate-500">Agente calcula Prev. Fat: <strong>14/10/2026</strong> (pronto antes)</div>
                                            <div className="mt-1 pt-1 border-t border-slate-100 text-slate-700 font-bold">
                                                ➜ Data PCP mantida: 25/11/2026 (inalterada)
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-slate-600 font-medium">
                                            ✓ O prazo negociado com o cliente é 100% preservado e protegido!
                                        </p>
                                    </div>

                                </div>

                                <div className="p-3 bg-slate-100 rounded-lg text-slate-700 text-xs flex items-start gap-2">
                                    <ShieldAlert className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                                    <span>
                                        <strong>Regra de Segurança Inviolável:</strong> O Agente <strong>nunca</strong> retrocede datas e <strong>nunca</strong> altera datas PCP futuras válidas. Apenas pedidos que estavam com a data no passado (vencidos em relação à Data de Início) recebem a nova Previsão de Faturamento.
                                    </span>
                                </div>
                            </div>

                        </div>
                    )}

                </div>

                {/* RODAPÉ */}
                <div className="px-6 py-3.5 bg-white border-t border-slate-100 flex items-center justify-between shrink-0">
                    <div className="text-xs text-slate-500 flex items-center gap-1.5">
                        <Cpu className="w-4 h-4 text-indigo-500" />
                        <span>Motor de Capacidade Finita · MetalFisa ERP Engine</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition-colors shadow-sm active:scale-95"
                    >
                        Entendi, Voltar ao Planejamento
                    </button>
                </div>

            </div>
        </div>
    );
}
