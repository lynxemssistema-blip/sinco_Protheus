import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Settings, ShieldCheck, Cpu, LayoutDashboard, Target, Zap, Box, Activity, Bell, MonitorSmartphone } from 'lucide-react';
import logo from '../assets/metalfisa-logo.png';

const LandingPage = () => {
    return (
        <div className="min-h-screen bg-white font-sans overflow-x-hidden">
            {/* Navbar */}
            <nav className="fixed w-full z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 transition-all">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-20 items-center">
                        <div className="flex items-center gap-3">
                            <img src={logo} alt="Metalfisa Logo" className="h-10 w-auto" />
                        </div>
                        <div className="hidden md:flex items-center space-x-8">
                            <a href="#sobre" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">Quem Somos</a>
                            <a href="#servicos" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">Serviços</a>
                            <a href="#sinco" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">Sistema SINCO</a>
                            <a href="#canal-cliente" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">Canal do Cliente</a>
                        </div>
                        <div className="flex items-center">
                            <Link 
                                to="/login" 
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                            >
                                Acessar Sistema
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
                <div className="absolute inset-0 z-0">
                    <img
                        src="https://metalfisa.com.br/site-2022/wp-content/uploads/2022/05/1.jpg"
                        alt="Hero Background"
                        className="w-full h-full object-cover opacity-15"
                        onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-white via-white/80 to-blue-50/90" />
                </div>
                
                {/* Decorative background elements */}
                <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 z-0">
                    <div className="w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
                </div>
                <div className="absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/3 z-0">
                    <div className="w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
                    <div className="text-center max-w-3xl mx-auto">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold mb-6">
                            <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse"></span>
                            Transformando Metais em Excelência
                        </div>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 tracking-tight leading-tight mb-6">
                            Gestão de Produção e <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Alta Tecnologia</span>
                        </h1>
                        <p className="text-lg text-slate-600 mb-10 leading-relaxed">
                            Infraestrutura completa, tecnologia de ponta e credibilidade a serviço dos clientes.
                            Descubra como nosso ecossistema integrado eleva a eficiência operacional.
                        </p>
                        
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link 
                                to="/login" 
                                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-8 py-3.5 rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                            >
                                Acessar Plataforma SINCO
                                <ArrowRight className="w-5 h-5" />
                            </Link>
                            <button 
                                onClick={() => document.getElementById('sinco')?.scrollIntoView({ behavior: 'smooth' })}
                                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-8 py-3.5 rounded-xl font-semibold transition-all hover:border-slate-300"
                            >
                                Conhecer Funcionalidades
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Metalfisa Services Grid */}
            <section id="servicos" className="py-20 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-slate-900 mb-4">Nossa Expertise em Aço</h2>
                        <p className="text-slate-500 max-w-2xl mx-auto">Oferecemos processos industriais completos para atender às mais rigorosas demandas de diversos setores.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[
                            { title: 'Corte a Laser', desc: 'Precisão milimétrica e acabamento impecável em chapas metálicas.', img: 'https://metalfisa.com.br/site-2022/wp-content/uploads/2019/06/Cortealaser3.jpg' },
                            { title: 'Estamparia', desc: 'Processos automatizados para produção em larga escala.', img: 'https://metalfisa.com.br/site-2022/wp-content/uploads/2019/12/estamparia3.jpg' },
                            { title: 'Dobras', desc: 'Conformação complexa com CNC de alta capacidade.', img: 'https://metalfisa.com.br/site-2022/wp-content/uploads/2019/12/dobras1.jpg' },
                            { title: 'Solda', desc: 'Soldagem certificada MIG/MAG e TIG.', img: 'https://metalfisa.com.br/site-2022/wp-content/uploads/2019/12/solda1.jpg' },
                            { title: 'Pintura Eletrostática', desc: 'Acabamento durável com preparação de superfície automatizada.', img: 'https://metalfisa.com.br/site-2022/wp-content/uploads/2019/12/Pinturaeletrostatica05.jpg' },
                            { title: 'Montagem', desc: 'Integração completa de conjuntos soldados e mecânicos.', img: 'https://metalfisa.com.br/site-2022/wp-content/uploads/2019/12/montagem1.jpg' }
                        ].map((srv, idx) => (
                            <div key={idx} className="group overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 hover:bg-white hover:shadow-xl hover:border-blue-200 transition-all duration-300">
                                <div className="h-48 w-full overflow-hidden">
                                    <img src={srv.img} alt={srv.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.classList.add('bg-gradient-to-br', 'from-slate-200', 'to-slate-300'); }} />
                                </div>
                                <div className="p-6">
                                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                        <Settings className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 mb-2">{srv.title}</h3>
                                    <p className="text-slate-500 text-sm leading-relaxed">{srv.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* SINCO System Showcase */}
            <section id="sinco" className="py-24 bg-slate-900 relative overflow-hidden">
                {/* Abstract background for SINCO */}
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl"></div>
                
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/20 text-blue-400 text-sm font-semibold mb-6">
                                <Cpu className="w-4 h-4" />
                                Sistema Integrado Metalfisa
                            </div>
                            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 leading-tight">
                                SINCO: O coração da nossa <span className="text-blue-400">indústria 4.0</span>
                            </h2>
                            <p className="text-slate-300 text-lg mb-8 leading-relaxed">
                                Desenvolvido para oferecer controle total, o SINCO gerencia cada etapa da produção, do planejamento avançado (PCP) à entrega, garantindo rastreabilidade e eficiência.
                            </p>
                            
                            <ul className="space-y-5 mb-10">
                                {[
                                    { icon: LayoutDashboard, title: 'Gestão de OPs e Roteiros', text: 'Apontamento digital integrado ao chão de fábrica.' },
                                    { icon: Zap, title: 'Planejamento Avançado', text: 'Gantt dinâmico e controle de capacidade produtiva.' },
                                    { icon: ShieldCheck, title: 'Qualidade Assegurada', text: 'Gestão de RNCs, calibração e checklists de manutenção.' },
                                    { icon: Box, title: 'VMI & Suprimentos', text: 'Monitoramento em tempo real do estoque de clientes parceiros.' }
                                ].map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-4">
                                        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 mt-1">
                                            <item.icon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h4 className="text-white font-semibold text-lg">{item.title}</h4>
                                            <p className="text-slate-400 text-sm mt-1">{item.text}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>

                            <Link 
                                to="/login" 
                                className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-3.5 rounded-xl font-semibold transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)]"
                            >
                                Iniciar Sessão no SINCO
                                <ArrowRight className="w-5 h-5" />
                            </Link>
                        </div>
                        
                        {/* Mockup visual */}
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent z-10 rounded-2xl"></div>
                            <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden transform transition-transform hover:scale-[1.02] duration-500">
                                <div className="h-8 bg-slate-800/80 border-b border-slate-700 flex items-center px-4 gap-2">
                                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                    <div className="ml-4 text-xs text-slate-500 font-medium">sinco.metalfisa.com.br</div>
                                </div>
                                <div className="p-6">
                                    {/* Abstract Dashboard UI */}
                                    <div className="flex gap-4 mb-6">
                                        <div className="w-1/4 h-24 bg-slate-700/50 rounded-xl animate-pulse"></div>
                                        <div className="w-1/4 h-24 bg-slate-700/50 rounded-xl animate-pulse delay-75"></div>
                                        <div className="w-1/4 h-24 bg-blue-900/40 border border-blue-700/50 rounded-xl animate-pulse delay-150"></div>
                                        <div className="w-1/4 h-24 bg-slate-700/50 rounded-xl animate-pulse delay-200"></div>
                                    </div>
                                    <div className="flex gap-6">
                                        <div className="w-2/3 h-48 bg-slate-700/30 rounded-xl border border-slate-700/50"></div>
                                        <div className="w-1/3 h-48 bg-slate-700/30 rounded-xl border border-slate-700/50"></div>
                                    </div>
                                    <div className="w-full h-32 bg-slate-700/20 rounded-xl border border-slate-700/50 mt-6"></div>
                                </div>
                            </div>
                            
                            {/* Floating badge */}
                            <div className="absolute -bottom-6 -left-6 bg-white p-4 rounded-xl shadow-xl flex items-center gap-4 z-20 border border-gray-100">
                                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                                    <Target className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Disponibilidade</p>
                                    <p className="text-xl font-bold text-slate-900">99.9% Uptime</p>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </section>

            {/* Canal do Cliente Section */}
            <section id="canal-cliente" className="py-24 bg-white relative">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="bg-slate-50 rounded-3xl p-8 md:p-12 lg:p-16 border border-slate-100 shadow-xl overflow-hidden relative">
                        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3">
                            <div className="w-80 h-80 bg-blue-100 rounded-full blur-3xl opacity-50" />
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
                            <div>
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold mb-6">
                                    <MonitorSmartphone className="w-4 h-4" />
                                    Portal do Cliente
                                </div>
                                <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
                                    Acompanhamento em <span className="text-blue-600">Tempo Real</span>
                                </h2>
                                <p className="text-slate-600 text-lg mb-8 leading-relaxed">
                                    Através do nosso Canal do Cliente integrado ao SINCO, você tem visão total sobre a vida real das suas OPs. Sem burocracia e com total transparência das etapas de fabricação.
                                </p>
                                
                                <div className="space-y-6">
                                    {[
                                        { icon: Activity, title: 'Status de Produção', desc: 'Saiba exatamente em qual setor suas peças estão no momento.' },
                                        { icon: Bell, title: 'Alertas e Atualizações', desc: 'Receba informações diretas sobre liberação de engenharia e prazos.' },
                                        { icon: Box, title: 'Gestão de Romaneios', desc: 'Acompanhe embarques, rastreabilidade e baixe notas fiscais.' }
                                    ].map((feature, idx) => (
                                        <div key={idx} className="flex items-start gap-4">
                                            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-blue-600">
                                                <feature.icon className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h4 className="text-slate-900 font-bold text-lg">{feature.title}</h4>
                                                <p className="text-slate-500 text-sm mt-1">{feature.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="relative">
                                <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 transform rotate-2 hover:rotate-0 transition-transform duration-500">
                                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-50">
                                        <div>
                                            <h5 className="font-bold text-slate-800">Pedido #94822</h5>
                                            <p className="text-xs text-slate-500">Cliente Parceiro LTDA</p>
                                        </div>
                                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">Em Produção</span>
                                    </div>
                                    
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">1</div>
                                            <div className="flex-1">
                                                <div className="flex justify-between mb-1">
                                                    <span className="text-sm font-semibold text-slate-700">Corte a Laser</span>
                                                    <span className="text-xs text-slate-500">Concluído</span>
                                                </div>
                                                <div className="w-full bg-slate-100 rounded-full h-1.5"><div className="bg-blue-600 h-1.5 rounded-full w-full"></div></div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">2</div>
                                            <div className="flex-1">
                                                <div className="flex justify-between mb-1">
                                                    <span className="text-sm font-semibold text-slate-700">Solda</span>
                                                    <span className="text-xs text-blue-600 font-medium">Em andamento (60%)</span>
                                                </div>
                                                <div className="w-full bg-slate-100 rounded-full h-1.5"><div className="bg-blue-600 h-1.5 rounded-full w-[60%]"></div></div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 opacity-50">
                                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-xs font-bold">3</div>
                                            <div className="flex-1">
                                                <div className="flex justify-between mb-1">
                                                    <span className="text-sm font-semibold text-slate-700">Pintura</span>
                                                    <span className="text-xs text-slate-500">Aguardando</span>
                                                </div>
                                                <div className="w-full bg-slate-100 rounded-full h-1.5"><div className="bg-slate-200 h-1.5 rounded-full w-0"></div></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-slate-50 py-12 border-t border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-3">
                            <img src={logo} alt="Metalfisa Logo" className="h-8 w-auto grayscale opacity-70" />
                        </div>
                        <div className="text-center md:text-right">
                            <p className="text-sm text-slate-500 font-medium">© {new Date().getFullYear()} Metalfisa. Todos os direitos reservados.</p>
                            <p className="text-xs text-slate-400 mt-1">Telefone: +55 (31) 3057 9000</p>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
