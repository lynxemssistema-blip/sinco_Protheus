import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
    ArrowRight, 
    ShieldCheck, 
    Cpu, 
    LayoutDashboard, 
    Target, 
    Zap, 
    Box, 
    Activity, 
    Bell, 
    MonitorSmartphone,
    CheckCircle2,
    BarChart3,
    Layers,
    Bot,
    Truck,
    Database,
    Clock,
    Flame,
    Sparkles,
    ChevronRight,
    ChevronLeft,
    Award,
    ExternalLink,
    Building2,
    Instagram,
    Menu,
    X,
    Smartphone
} from 'lucide-react';

// Brand Assets
import lynxLogo from '../assets/lynx-ems-logo.jpg';
import simLogo from '../assets/sim-consultoria-logo.png';
import heroBanner from '../assets/sinco-hero-banner.jpg';
import dashboardMockup from '../assets/sinco-dashboard-mockup.jpg';

// Client Logos
import amcLogo from '../assets/client-amc-logo.png';
import mettaLogo from '../assets/client-metta-logo.png';
import alfatecLogo from '../assets/client-alfatec-logo.png';
import metalfisaLogo from '../assets/metalfisa-logo.png';
import flrLogo from '../assets/client-flr-logo.png';

// High-Res Industrial Module Images
import pcpImage from '../assets/sinco-pcp-shopfloor.jpg';
import engBomImage from '../assets/sinco-eng-bom.jpg';
import sgqQualityImage from '../assets/sinco-sgq-quality.jpg';
import aiHermesImage from '../assets/sinco-ai-hermes.jpg';
import logisticsVmiImage from '../assets/sinco-logistics-vmi.jpg';
import erpOrdersImage from '../assets/sinco-erp-orders.jpg';

const LandingPage = () => {
    const [activeTab, setActiveTab] = useState('pcp');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [activeClientIndex, setActiveClientIndex] = useState(0);
    const [isCarouselPaused, setIsCarouselPaused] = useState(false);
    const carouselRef = useRef(null);

    // Track horizontal scroll of client carousel to update active dot
    const handleCarouselScroll = () => {
        if (!carouselRef.current) return;
        const container = carouselRef.current;
        const scrollPosition = container.scrollLeft;
        const isDesktop = window.innerWidth >= 1024;
        const itemWidth = isDesktop 
            ? (container.offsetWidth - 48) / 3 
            : container.offsetWidth * 0.85;
        const newIndex = Math.round(scrollPosition / itemWidth);
        if (newIndex >= 0 && newIndex < 5 && newIndex !== activeClientIndex) {
            setActiveClientIndex(newIndex);
        }
    };

    const scrollToClient = (index) => {
        if (!carouselRef.current) return;
        const container = carouselRef.current;
        const cardElements = container.children;
        if (cardElements && cardElements[index]) {
            cardElements[index].scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'start'
            });
            setActiveClientIndex(index);
        }
    };

    const scrollClientPrev = () => {
        const nextIdx = (activeClientIndex - 1 + 5) % 5;
        scrollToClient(nextIdx);
    };

    const scrollClientNext = () => {
        const nextIdx = (activeClientIndex + 1) % 5;
        scrollToClient(nextIdx);
    };

    // Continuous auto-play loop (3.5s per transition, pauses on hover)
    useEffect(() => {
        if (isCarouselPaused) return;

        const interval = setInterval(() => {
            setActiveClientIndex((prevIndex) => {
                const nextIndex = (prevIndex + 1) % 5;
                if (carouselRef.current) {
                    const cardElements = carouselRef.current.children;
                    if (cardElements && cardElements[nextIndex]) {
                        cardElements[nextIndex].scrollIntoView({
                            behavior: 'smooth',
                            block: 'nearest',
                            inline: 'start'
                        });
                    }
                }
                return nextIndex;
            });
        }, 3500);

        return () => clearInterval(interval);
    }, [isCarouselPaused]);

    const clients = [
        {
            id: 'amc',
            name: 'AMC Soluções em Energia',
            segment: 'Subestações até 500kV & Eletrocentros',
            desc: 'Especialista em soluções completas de energia, subestações de alta tensão até 500kV, skids móveis e cubículos da linha Schneider Electric SM6.',
            logo: amcLogo,
            link: 'https://amcsolucoes.com.br/sm6/',
            instagram: 'https://www.instagram.com/amcsolucoes/',
            instagramHandle: '@amcsolucoes',
            badge: 'Alta Tensão & Energia',
            isDarkLogo: true,
            theme: {
                cardBorder: 'border-orange-200/90 hover:border-orange-500 hover:shadow-2xl hover:shadow-orange-500/15 ring-1 ring-orange-500/20',
                topAccent: 'bg-gradient-to-r from-orange-500 via-[#F5811F] to-amber-500',
                logoBg: 'bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-orange-500/40 group-hover:border-orange-500 group-hover:shadow-[0_0_22px_rgba(245,129,31,0.25)]',
                badgeClass: 'bg-orange-50 border-orange-200 text-orange-700 font-extrabold',
                titleHover: 'group-hover:text-orange-600',
                checkColor: 'text-orange-500',
                btnClass: 'bg-orange-50/80 hover:bg-orange-500 border-orange-300 hover:border-orange-500 text-orange-900 hover:text-white',
                btnIcon: 'text-orange-600 group-hover/btn:text-white',
                instaBtn: 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 hover:shadow-orange-500/25'
            },
            highlights: [
                'Subestações até 500kV e Skids até 230kV',
                'Eletrocentros modulares customizados',
                'Linha Schneider Electric SM6 integrada'
            ]
        },
        {
            id: 'metta',
            name: 'Metta Indústria',
            segment: 'Painéis Elétricos & Cubículos BT/MT',
            desc: 'Engenharia de precisão para painéis elétricos industriais certificados de baixa e média tensão, cubículos e eletrocentros para grandes usinas e plantas industriais.',
            logo: mettaLogo,
            link: 'https://metta.ind.br/',
            instagram: 'https://www.instagram.com/metta_solucoeseletricas/',
            instagramHandle: '@metta_solucoeseletricas',
            badge: 'Soluções Elétricas & MT',
            isDarkLogo: true,
            theme: {
                cardBorder: 'border-lime-200/90 hover:border-lime-500 hover:shadow-2xl hover:shadow-lime-500/15 ring-1 ring-lime-500/20',
                topAccent: 'bg-gradient-to-r from-lime-500 via-emerald-400 to-green-500',
                logoBg: 'bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-lime-500/40 group-hover:border-lime-500 group-hover:shadow-[0_0_22px_rgba(132,204,22,0.25)]',
                badgeClass: 'bg-lime-50 border-lime-200 text-lime-800 font-extrabold',
                titleHover: 'group-hover:text-lime-700',
                checkColor: 'text-lime-600',
                btnClass: 'bg-lime-50/80 hover:bg-lime-600 border-lime-300 hover:border-lime-600 text-lime-900 hover:text-white',
                btnIcon: 'text-lime-600 group-hover/btn:text-white',
                instaBtn: 'bg-gradient-to-r from-lime-600 to-emerald-600 hover:from-lime-700 hover:to-emerald-700 hover:shadow-lime-600/25'
            },
            highlights: [
                'Painéis de Baixa e Média Tensão',
                'Cubículos de Média Tensão homologados',
                'Eletrocentros e Energia Solar Fotovoltaica'
            ]
        },
        {
            id: 'alfatec',
            name: 'Alfatec Cozinhas Profissionais',
            segment: 'Equipamentos Industriais em Aço Inox',
            desc: 'Pioneirismo e liderança nacional no desenvolvimento e manufatura de equipamentos profissionais em aço inox para redes de hotéis, hospitais e gastronomia pesada.',
            logo: alfatecLogo,
            link: 'https://www.alfatecozinhas.com.br/',
            instagram: 'https://www.instagram.com/alfatec.cozinhas/',
            instagramHandle: '@alfatec.cozinhas',
            badge: 'Aço Inoxidável & Foodservice',
            isDarkLogo: false,
            theme: {
                cardBorder: 'border-rose-200/90 hover:border-rose-700 hover:shadow-2xl hover:shadow-rose-900/15 ring-1 ring-rose-700/20',
                topAccent: 'bg-gradient-to-r from-rose-700 via-red-800 to-rose-900',
                logoBg: 'bg-gradient-to-b from-slate-50 to-white border-rose-200 group-hover:border-rose-700 group-hover:shadow-[0_0_22px_rgba(190,18,60,0.2)]',
                badgeClass: 'bg-rose-50 border-rose-200 text-rose-800 font-extrabold',
                titleHover: 'group-hover:text-rose-800',
                checkColor: 'text-rose-700',
                btnClass: 'bg-rose-50/80 hover:bg-rose-800 border-rose-300 hover:border-rose-800 text-rose-950 hover:text-white',
                btnIcon: 'text-rose-700 group-hover/btn:text-white',
                instaBtn: 'bg-gradient-to-r from-rose-800 to-red-900 hover:from-rose-900 hover:to-red-950 hover:shadow-rose-900/25'
            },
            highlights: [
                'Cozinhas industriais completas sob medida',
                'Caldeiraria sanitária em aço inox de alta durabilidade',
                'Atendimento a grandes redes e projetos hospitalares'
            ]
        },
        {
            id: 'metalfisa',
            name: 'Lynx',
            segment: 'Manufatura Metalmecânica 4.0 & Laser CNC',
            desc: 'Caldeiraria fina de ponta, corte a laser CNC de alta velocidade, conformação robotizada e solda certificada com controle operacional 100% digital via SINCO.',
            logo: metalfisaLogo,
            link: 'https://lynxems.com.br/',
            instagram: 'https://www.instagram.com/metalfisa/',
            instagramHandle: '@lynxems',
            badge: 'Metalmecânica de Precisão',
            isDarkLogo: false,
            theme: {
                cardBorder: 'border-blue-200/90 hover:border-blue-600 hover:shadow-2xl hover:shadow-blue-600/15 ring-1 ring-blue-600/20',
                topAccent: 'bg-gradient-to-r from-blue-600 via-sky-500 to-blue-700',
                logoBg: 'bg-gradient-to-b from-slate-50 to-white border-blue-200 group-hover:border-blue-600 group-hover:shadow-[0_0_22px_rgba(37,99,235,0.2)]',
                badgeClass: 'bg-blue-50 border-blue-200 text-blue-800 font-extrabold',
                titleHover: 'group-hover:text-blue-700',
                checkColor: 'text-blue-600',
                btnClass: 'bg-blue-50/80 hover:bg-blue-600 border-blue-300 hover:border-blue-600 text-blue-950 hover:text-white',
                btnIcon: 'text-blue-600 group-hover/btn:text-white',
                instaBtn: 'bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 hover:shadow-blue-600/25'
            },
            highlights: [
                'Corte a laser CNC com aproveitamento inteligente',
                'Dobra CNC e conformação mecânica estrita',
                'Rastreabilidade total de matéria-prima a produto acabado'
            ]
        },
        {
            id: 'flr',
            name: 'FLR Instalações',
            segment: 'Kits Elétricos & Hidráulicos Pré-Fabricados',
            desc: 'Engenharia de ponta em kits pré-fabricados sob medida para grandes obras residenciais e industriais. Chicotes prontos plug & play, conformidade NBR 5410/5626 e desperdício zero de cabos.',
            logo: flrLogo,
            link: 'https://flrinstalacoes.lynxems.com.br/',
            instagram: 'https://www.instagram.com/flrinstalacoes/',
            instagramHandle: '@flrinstalacoes',
            badge: 'Engenharia & Kits Pré-Fabricados',
            isDarkLogo: true,
            theme: {
                cardBorder: 'border-amber-200/90 hover:border-amber-500 hover:shadow-2xl hover:shadow-amber-500/15 ring-1 ring-amber-500/20',
                topAccent: 'bg-gradient-to-r from-blue-700 via-sky-600 to-amber-500',
                logoBg: 'bg-[#0e4582] border-sky-400/40 group-hover:border-amber-400 group-hover:shadow-[0_0_22px_rgba(2,132,199,0.3)]',
                badgeClass: 'bg-amber-50 border-amber-200 text-amber-900 font-extrabold',
                titleHover: 'group-hover:text-amber-600',
                checkColor: 'text-amber-500',
                btnClass: 'bg-amber-50/80 hover:bg-amber-500 border-amber-300 hover:border-amber-500 text-amber-950 hover:text-white',
                btnIcon: 'text-amber-600 group-hover/btn:text-white',
                instaBtn: 'bg-gradient-to-r from-blue-800 via-sky-700 to-amber-500 hover:from-blue-900 hover:to-amber-600 hover:shadow-amber-500/25'
            },
            highlights: [
                'Kits elétricos e hidráulicos pré-montados plug & play',
                'Compatibilização técnica BIM e normas NBR 5410 / NBR 5626',
                'Redução comprovada de até 40% em mão de obra no canteiro'
            ]
        }
    ];

    const modules = [
        {
            id: 'pcp',
            title: 'PCP & Chão de Fábrica 4.0',
            category: 'Planejamento Avançado & Sequenciamento',
            desc: 'Controle de apontamento vertical em tempo real nas máquinas e bancadas, balanceamento dinâmico de capacidade e painéis de TV inteligentes integrados ao chão de fábrica.',
            image: pcpImage,
            badge: 'Tempo Real',
            stats: '100% Digital',
            highlights: [
                'Sequenciamento de Ordens de Produção (OPs) e carga máquina inteligente',
                'Apontamento digital direto em tablets e totens operacionais',
                'Gantt interativo com cálculo de folga e gargalos de produção',
                'Painel de TV industrial para telemetria contínua da fábrica'
            ]
        },
        {
            id: 'erp',
            title: 'SINCO ERP Nativo',
            category: 'Gestão Comercial & Faturamento Industrial',
            desc: 'Módulo ERP 100% desvinculado de plataformas legadas. Motor de validação Protheus-grade com garantia de integridade referencial, transações ACID e conciliação de saldos em milissegundos.',
            image: erpOrdersImage,
            badge: 'Transações ACID',
            stats: 'Módulo 11 Integrado',
            highlights: [
                'Pipeline de pedidos de venda com cálculo de impostos e prazos de entrega',
                'Controle instantâneo de saldo disponível, reservado e empenhado',
                'Cadastro completo de clientes e fornecedores com validação de CPF/CNPJ',
                'Emissão e liberação automatizada de OPs vinculadas ao pedido'
            ]
        },
        {
            id: 'eng',
            title: 'Engenharia de Produto & BOM',
            category: 'Estruturas Multiníveis & Fichas Técnicas',
            desc: 'Explosão de estruturas de engenharia (BOM) em cascata até os componentes primários. Sincronização de roteiros, operações mecânicas e integração com especificações CAD.',
            image: engBomImage,
            badge: 'Estrutura Multinível',
            stats: 'Até 10 Níveis',
            highlights: [
                'Explosão rápida de árvores de produto e cálculo de custos de matéria-prima',
                'Mapeamento de tempos padrão de corte, conformação, solda e montagem',
                'Gestão de versões e histórico de alterações de engenharia',
                'Exportação instantânea de dossiês técnicos e fichas de processo'
            ]
        },
        {
            id: 'sgq',
            title: 'SGQ & Qualidade Total',
            category: 'Metrologia, Calibrações & RNCs',
            partner: 'SIM Consultoria',
            partnerLogo: simLogo,
            partnerLink: 'https://www.instagram.com/sim.consultoria/',
            desc: 'Gestão completa do Sistema de Gestão da Qualidade industrial estruturado em parceria com a SIM Consultoria (18 anos de excelência). Controle rigoroso de caixas de ferramentas (Toolbox), calibração de instrumentos, termos de responsabilidade e auditorias.',
            image: sgqQualityImage,
            badge: 'Parceria SIM Consultoria',
            stats: '18 anos de Excelência',
            highlights: [
                'Metodologia homologada e apoiada pela SIM Consultoria (18 anos de história)',
                'Monitoramento de calibração periódica de paquímetros, micrômetros e CMM',
                'Abertura, plano de ação e acompanhamento de RNCs com causa raiz',
                'Termos digitais de custódia e relatórios de auditoria com conformidade normativa'
            ]
        },
        {
            id: 'ai',
            title: 'IA Industrial Hermes & OCR',
            category: 'Inteligência Artificial & Extração de Blueprints',
            desc: 'Agente neural de inteligência artificial Hermes que lê desenhos técnicos, especificações em PDF e imagens, extraindo parâmetros de corte, tolerâncias e materiais de forma autônoma.',
            image: aiHermesImage,
            badge: 'IA Generativa & OCR',
            stats: 'Automação 95%',
            highlights: [
                'Extração automática de cotas, tipos de chapa e espessuras de projetos',
                'Eliminação de erros de digitação manual de ordens de engenharia',
                'Identificação de padrões geométricos para nesting e corte a laser',
                'Assistente virtual para análise de viabilidade e lead-times'
            ]
        },
        {
            id: 'log',
            title: 'Logística, Expedição & VMI',
            category: 'Cadeia de Suprimentos & Estoque Gerenciado',
            desc: 'Gestão estratégica de estoque parceiro (VMI - Vendor Managed Inventory), conferência digital de expedição, montagem de romaneios inteligentes e emissão de listas de carga rastreáveis.',
            image: logisticsVmiImage,
            badge: 'VMI Conectado',
            stats: 'Zero Divergência',
            highlights: [
                'Monitoramento em tempo real dos níveis de estoque de clientes parceiros',
                'Conferência ágil de expedição com coletores de dados e códigos de barra',
                'Geração de romaneios de embarque e controle de motoristas/transportadoras',
                'Rastreabilidade ponta a ponta desde o lote de matéria-prima até a entrega'
            ]
        }
    ];

    return (
        <div className="min-h-screen bg-slate-50 font-sans overflow-x-hidden text-slate-800">
            {/* Header / Navbar */}
            <nav className="fixed w-full z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-20 items-center">
                        <div className="flex items-center gap-3">
                            {/* Co-Branding Partner Header: Lynx EMS + SIM Consultoria */}
                            <div className="flex items-center gap-2">
                                <img 
                                    src={lynxLogo} 
                                    alt="Lynx EMS Sistemas" 
                                    className="h-11 w-11 rounded-xl object-cover shadow-sm border border-slate-200" 
                                />
                                <span className="text-slate-400 font-bold text-xs hidden sm:inline">✕</span>
                                <a 
                                    href="https://www.instagram.com/sim.consultoria/" 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="hidden sm:flex items-center group"
                                    title="SIM Consultoria - Parceira Estratégica em Gestão da Qualidade"
                                >
                                    <img 
                                        src={simLogo} 
                                        alt="SIM Consultoria" 
                                        className="h-11 w-11 rounded-xl object-contain bg-white border border-slate-200 p-0.5 group-hover:border-blue-500 shadow-sm transition-all" 
                                    />
                                </a>
                            </div>

                            <div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-lg font-black tracking-tight text-slate-900 block leading-tight">
                                        SINCO <span className="text-blue-600 font-extrabold text-sm uppercase px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 ml-0.5">Suite</span>
                                    </span>
                                </div>
                                <span className="text-[11px] text-slate-500 font-bold tracking-tight block leading-tight mt-0.5">
                                    Lynx EMS Sistemas <span className="text-blue-600 font-black">&</span> SIM Consultoria
                                </span>
                            </div>
                        </div>
                        
                        <div className="hidden lg:flex items-center space-x-5 xl:space-x-7">
                            <a href="#modulos" className="text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors">
                                Módulos
                            </a>
                            <a href="#clientes" className="text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors flex items-center gap-1">
                                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                                Clientes
                            </a>
                            <a href="#parceria-sgq" className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1.5 bg-blue-50/90 px-2.5 py-1 rounded-lg border border-blue-200">
                                <Award className="w-3.5 h-3.5 text-blue-600" />
                                Parceria Lynx & SIM
                            </a>
                            <a href="#plataforma" className="text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors">
                                Arquitetura 4.0
                            </a>
                            <a href="#portal-cliente" className="text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors">
                                Canal do Cliente
                            </a>
                        </div>

                        <div className="flex items-center gap-3">
                            <Link 
                                to="/login" 
                                className="hidden sm:flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transform hover:-translate-y-0.5"
                            >
                                <span>Acessar</span>
                                <ArrowRight className="w-4 h-4" />
                            </Link>

                            {/* Mobile Hamburger Toggle */}
                            <button
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                className="lg:hidden p-2 rounded-xl text-slate-700 hover:text-blue-600 hover:bg-slate-100 transition-colors border border-slate-200"
                                aria-label="Abrir Menu de Navegação"
                            >
                                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Navigation Dropdown Drawer */}
                {mobileMenuOpen && (
                    <div className="lg:hidden bg-white/95 backdrop-blur-xl border-b border-slate-200 px-4 pt-3 pb-6 space-y-3 shadow-xl animate-in slide-in-from-top duration-200">
                        <div className="flex flex-col space-y-2">
                            <a 
                                href="#modulos" 
                                onClick={() => setMobileMenuOpen(false)}
                                className="flex items-center justify-between p-2.5 rounded-lg text-sm font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                            >
                                <span>Módulos Industriais</span>
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                            </a>
                            <a 
                                href="#clientes" 
                                onClick={() => setMobileMenuOpen(false)}
                                className="flex items-center justify-between p-2.5 rounded-lg text-sm font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                            >
                                <span className="flex items-center gap-2">
                                    <Building2 className="w-4 h-4 text-blue-600" />
                                    Principais Clientes
                                </span>
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                            </a>
                            <a 
                                href="#parceria-sgq" 
                                onClick={() => setMobileMenuOpen(false)}
                                className="flex items-center justify-between p-2.5 rounded-lg text-sm font-bold text-blue-700 bg-blue-50/80 border border-blue-200 hover:bg-blue-100 transition-colors"
                            >
                                <span className="flex items-center gap-2">
                                    <Award className="w-4 h-4 text-blue-600" />
                                    Parceria Lynx & SIM (18 anos)
                                </span>
                                <ChevronRight className="w-4 h-4 text-blue-600" />
                            </a>
                            <a 
                                href="#plataforma" 
                                onClick={() => setMobileMenuOpen(false)}
                                className="flex items-center justify-between p-2.5 rounded-lg text-sm font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                            >
                                <span>Arquitetura 4.0 & Segurança</span>
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                            </a>
                            <a 
                                href="#portal-cliente" 
                                onClick={() => setMobileMenuOpen(false)}
                                className="flex items-center justify-between p-2.5 rounded-lg text-sm font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                            >
                                <span>Canal & Portal do Cliente</span>
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                            </a>
                        </div>

                        <div className="pt-2 border-t border-slate-100">
                            <Link 
                                to="/login" 
                                onClick={() => setMobileMenuOpen(false)}
                                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl font-bold text-sm shadow-md transition-all"
                            >
                                <span>Acessar SINCO Suite</span>
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                    </div>
                )}
            </nav>

            {/* Hero Section */}
            <section className="relative pt-32 pb-24 lg:pt-44 lg:pb-36 overflow-hidden bg-slate-950 text-white">
                <div className="absolute inset-0 z-0">
                    <img
                        src={heroBanner}
                        alt="SINCO Smart Factory Hero"
                        className="w-full h-full object-cover opacity-25 filter brightness-90 contrast-125"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/85 to-slate-950" />
                </div>

                {/* Ambient glowing orbs */}
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute bottom-10 right-10 w-[400px] h-[250px] bg-cyan-500/15 rounded-full blur-[100px] pointer-events-none" />

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="text-center max-w-4xl mx-auto">
                        <div className="inline-flex flex-wrap items-center justify-center gap-2 px-4 py-2 rounded-full bg-blue-500/15 border border-blue-400/40 text-blue-300 text-xs font-bold uppercase tracking-wider mb-8 backdrop-blur-md shadow-inner">
                            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                            <span>Lynx EMS Sistemas</span>
                            <span className="text-cyan-400 font-black">✕</span>
                            <span>SIM Consultoria (18 anos)</span>
                            <span className="text-slate-400 hidden sm:inline">•</span>
                            <span className="text-slate-300 hidden sm:inline font-semibold">Aliança Estratégica em Tecnologia & SGQ</span>
                        </div>

                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.15] mb-8">
                            A Inteligência Definitiva para a <br className="hidden sm:inline" />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-sky-400">
                                Indústria 4.0 e Chão de Fábrica
                            </span>
                        </h1>

                        <p className="text-lg sm:text-xl text-slate-300 mb-10 leading-relaxed max-w-3xl mx-auto font-normal">
                            Desenvolvido pela <strong>Lynx EMS Sistemas</strong> em aliança estratégica com a <strong>SIM Consultoria</strong> (18 anos de excelência em SGQ), o <strong>SINCO</strong> substitui sistemas legados por uma suíte de alta performance com <strong>PCP dinâmico</strong>, <strong>ERP nativo</strong>, controle metrológico <strong>SGQ homologado</strong>, <strong>logística VMI</strong> e <strong>Inteligência Artificial</strong>.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
                            <Link 
                                to="/login" 
                                className="w-full sm:w-auto flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl font-bold text-base transition-all shadow-xl shadow-blue-600/30 hover:shadow-2xl hover:shadow-blue-500/50 transform hover:-translate-y-0.5"
                            >
                                Iniciar Sessão na Plataforma
                                <ArrowRight className="w-5 h-5" />
                            </Link>
                            <a 
                                href="#modulos" 
                                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700 px-8 py-4 rounded-xl font-semibold text-base transition-all hover:border-slate-500 backdrop-blur-sm"
                            >
                                Conhecer Módulos do Sistema
                            </a>
                        </div>

                        {/* Top Key Metrics Banner */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-md shadow-2xl text-left">
                            <div className="border-r border-slate-800/80 pr-4 last:border-none">
                                <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">2.87M+</div>
                                <div className="text-xs text-slate-400 font-medium mt-1">Registros Industriais Ativos</div>
                            </div>
                            <div className="border-r border-slate-800/80 pr-4 last:border-none">
                                <div className="text-2xl sm:text-3xl font-black text-cyan-400 tracking-tight">100%</div>
                                <div className="text-xs text-slate-400 font-medium mt-1">Nativo & Desvinculado</div>
                            </div>
                            <div className="border-r border-slate-800/80 pr-4 last:border-none">
                                <div className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight">99.9%</div>
                                <div className="text-xs text-slate-400 font-medium mt-1">Disponibilidade Operacional</div>
                            </div>
                            <div>
                                <div className="text-2xl sm:text-3xl font-black text-blue-400 tracking-tight">Zero</div>
                                <div className="text-xs text-slate-400 font-medium mt-1">Dependência de Licenças</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Showcase Section: Live Dashboard Mockup */}
            <section id="plataforma" className="py-20 bg-slate-900 text-white relative border-y border-slate-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-3xl mx-auto mb-12">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/20 text-blue-400 text-xs font-bold uppercase tracking-wider mb-4">
                            <LayoutDashboard className="w-3.5 h-3.5" />
                            Painel de Controle Centralizado
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-4">
                            Visão 360° da sua Operação Fabril
                        </h2>
                        <p className="text-slate-400 text-base leading-relaxed">
                            Do pipeline de vendas até a última solda na linha de montagem: acompanhe indicadores de produtividade, gargalos e disponibilidade de estoque em tempo real.
                        </p>
                    </div>

                    <div className="relative rounded-2xl p-2 sm:p-4 bg-gradient-to-b from-slate-800 to-slate-950 border border-slate-700 shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 rounded-t-xl">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500" />
                                <div className="w-3 h-3 rounded-full bg-amber-500" />
                                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                                <span className="ml-3 text-xs font-mono text-slate-400">sinco.lynxems.com.br — SINCO Industrial Suite v4.2</span>
                            </div>
                            <div className="hidden sm:flex items-center gap-2 text-xs text-emerald-400 font-semibold bg-emerald-950/60 border border-emerald-800/40 px-3 py-1 rounded-full">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                                Servidor MySQL Conectado & Operante
                            </div>
                        </div>

                        <div className="relative rounded-b-xl overflow-hidden group">
                            <img 
                                src={dashboardMockup} 
                                alt="SINCO Dashboard Executivo" 
                                className="w-full h-auto object-cover transform transition-transform duration-700 group-hover:scale-[1.01]" 
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />
                        </div>
                    </div>
                </div>
            </section>

            {/* Core Modules Grid (Cards with Real High-Res Generated Images) */}
            <section id="modulos" className="py-24 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold uppercase tracking-wider mb-4">
                            <Layers className="w-3.5 h-3.5" />
                            Arquitetura Modular SINCO
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
                            Módulos Industriais Especializados
                        </h2>
                        <p className="text-slate-600 text-base sm:text-lg leading-relaxed">
                            Projetados pela <strong>Lynx EMS Sistemas</strong> com rigor de engenharia mecânica, eletrônica e software para proporcionar máxima eficiência fabril.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {modules.map((m) => (
                            <div 
                                key={m.id}
                                className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl hover:border-blue-300 transition-all duration-300 flex flex-col group"
                            >
                                <div className="h-52 w-full overflow-hidden relative">
                                    <img 
                                        src={m.image} 
                                        alt={m.title} 
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 filter brightness-95" 
                                    />
                                    <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-bold tracking-wide border border-slate-700">
                                        {m.badge}
                                    </div>
                                    <div className="absolute bottom-3 right-3 bg-blue-600 text-white px-2.5 py-0.5 rounded-md text-xs font-semibold shadow">
                                        {m.stats}
                                    </div>
                                </div>

                                <div className="p-6 flex-1 flex flex-col justify-between">
                                    <div>
                                        <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
                                            {m.category}
                                        </p>
                                        <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-blue-600 transition-colors">
                                            {m.title}
                                        </h3>
                                        <p className="text-slate-600 text-sm leading-relaxed mb-5">
                                            {m.desc}
                                        </p>

                                        <ul className="space-y-2 mb-6 border-t border-slate-200/80 pt-4">
                                            {m.highlights.map((h, i) => (
                                                <li key={i} className="flex items-start gap-2 text-xs text-slate-700 font-medium">
                                                    <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                                                    <span>{h}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <Link 
                                        to="/login"
                                        className="inline-flex items-center justify-between w-full py-2.5 px-4 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl text-xs font-bold text-slate-700 hover:text-blue-700 transition-all shadow-sm"
                                    >
                                        <span>Acessar Módulo</span>
                                        <ChevronRight className="w-4 h-4" />
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Interactive Module Highlight Section */}
            <section className="py-20 bg-slate-100 border-y border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-xl overflow-hidden">
                        <div className="flex flex-wrap gap-2 pb-6 border-b border-slate-200 mb-8">
                            {modules.map((m) => (
                                <button
                                    key={m.id}
                                    onClick={() => setActiveTab(m.id)}
                                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                                        activeTab === m.id
                                            ? 'bg-blue-600 text-white shadow-md'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                                    }`}
                                >
                                    {m.title.split('&')[0]}
                                </button>
                            ))}
                        </div>

                        {modules.filter(m => m.id === activeTab).map((curr) => (
                            <div key={curr.id} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                                <div className="lg:col-span-5 space-y-4">
                                    <span className="inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider">
                                        {curr.badge}
                                    </span>
                                    <h3 className="text-2xl sm:text-3xl font-black text-slate-900">
                                        {curr.title}
                                    </h3>
                                    <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                                        {curr.desc}
                                    </p>

                                    <div className="space-y-3 pt-2">
                                        {curr.highlights.map((item, idx) => (
                                            <div key={idx} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                                                <div className="w-6 h-6 rounded-md bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                                                    {idx + 1}
                                                </div>
                                                <span className="text-xs sm:text-sm font-semibold text-slate-800">{item}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="pt-4">
                                        <Link 
                                            to="/login"
                                            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-md transition-all"
                                        >
                                            Explorar {curr.title.split('&')[0]}
                                            <ArrowRight className="w-4 h-4" />
                                        </Link>
                                    </div>
                                </div>

                                <div className="lg:col-span-7 rounded-2xl overflow-hidden border border-slate-200 shadow-lg">
                                    <img 
                                        src={curr.image} 
                                        alt={curr.title} 
                                        className="w-full h-80 sm:h-96 object-cover" 
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Principais Clientes & Casos de Sucesso (Mobile & Tablet Carousel + Grid) */}
            <section id="clientes" className="py-20 sm:py-24 bg-slate-100/70 border-b border-slate-200 overflow-hidden">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
                        <div className="max-w-3xl">
                            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-100 border border-blue-200 text-blue-800 text-xs font-bold uppercase tracking-wider mb-4 shadow-2xs">
                                <Building2 className="w-4 h-4 text-blue-600" />
                                Principais Clientes & Ecossistema Produtivo
                            </div>
                            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
                                Grandes Indústrias que Confiam no Ecossistema SINCO
                            </h2>
                            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                                De subestações elétricas de alta potência a caldeiraria de alta precisão, kits pré-fabricados e cozinhas profissionais: tecnologia <strong>Lynx EMS</strong> e conformidade <strong>SIM Consultoria</strong> nas plantas mais exigentes do país.
                            </p>
                        </div>

                        {/* Carousel Action Controls (Mobile & Desktop) */}
                        <div className="flex items-center gap-3 self-start md:self-end">
                            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-600 shadow-2xs">
                                <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                                <span>{activeClientIndex + 1} / {clients.length}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={scrollClientPrev}
                                    className="p-2.5 rounded-xl bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-700 shadow-2xs transition-all disabled:opacity-40"
                                    title="Cliente Anterior"
                                    aria-label="Cliente Anterior"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={scrollClientNext}
                                    className="p-2.5 rounded-xl bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-700 shadow-2xs transition-all disabled:opacity-40"
                                    title="Próximo Cliente"
                                    aria-label="Próximo Cliente"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Container Deslizante / Carrossel Touch no Celular & 3 por vez no Web com Loop */}
                    <div 
                        ref={carouselRef}
                        onScroll={handleCarouselScroll}
                        onMouseEnter={() => setIsCarouselPaused(true)}
                        onMouseLeave={() => setIsCarouselPaused(false)}
                        className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar pb-4 gap-6 px-1"
                    >
                        {clients.map((c) => (
                            <div 
                                key={c.id} 
                                className={`w-[85vw] sm:w-[350px] md:w-[calc(50%-12px)] lg:w-[calc((100%-48px)/3)] flex-shrink-0 snap-start bg-white rounded-2xl border shadow-sm transition-all duration-300 flex flex-col justify-between overflow-hidden group ${c.theme.cardBorder}`}
                            >
                                {/* Linha de Destaque da Marca no Topo */}
                                <div className={`h-1.5 w-full ${c.theme.topAccent}`} />

                                <div className="p-5 sm:p-6 flex flex-col justify-between flex-1">
                                    <div>
                                        {/* Logo Container */}
                                        <div className={`h-24 w-full rounded-xl flex items-center justify-center p-3 mb-5 border transition-all ${c.theme.logoBg}`}>
                                            <img 
                                                src={c.logo} 
                                                alt={c.name} 
                                                className="max-h-16 max-w-[85%] object-contain filter group-hover:scale-105 transition-transform duration-300" 
                                            />
                                        </div>

                                        <div className="mb-2.5">
                                            <span className={`inline-block px-2.5 py-1 rounded-md text-[11px] uppercase tracking-wide border ${c.theme.badgeClass}`}>
                                                {c.badge}
                                            </span>
                                        </div>

                                        <h3 className={`text-base font-extrabold text-slate-900 transition-colors mb-2 leading-snug ${c.theme.titleHover}`}>
                                            {c.name}
                                        </h3>

                                        <p className="text-xs text-slate-600 leading-relaxed mb-4 line-clamp-3 sm:line-clamp-none">
                                            {c.desc}
                                        </p>

                                        <ul className="space-y-1.5 border-t border-slate-100 pt-3.5 mb-5">
                                            {c.highlights.map((h, idx) => (
                                                <li key={idx} className="flex items-start gap-2 text-[11px] text-slate-700 font-medium">
                                                    <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${c.theme.checkColor}`} />
                                                    <span>{h}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div className="space-y-2 pt-2 border-t border-slate-100">
                                        <a 
                                            href={c.link} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className={`inline-flex items-center justify-between w-full py-2.5 px-3.5 border rounded-xl text-xs font-bold transition-all shadow-2xs group/btn ${c.theme.btnClass}`}
                                        >
                                            <span>Visitar Site Oficial</span>
                                            <ExternalLink className={`w-3.5 h-3.5 transition-colors ${c.theme.btnIcon}`} />
                                        </a>

                                        {c.instagram && (
                                            <a 
                                                href={c.instagram} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className={`inline-flex items-center justify-center gap-2 w-full py-2 px-3 text-white rounded-xl text-[11px] font-extrabold tracking-wide transition-all shadow-sm group/insta ${c.theme.instaBtn}`}
                                            >
                                                <Instagram className="w-3.5 h-3.5 group-hover/insta:scale-110 transition-transform" />
                                                <span>{c.instagramHandle} no Instagram</span>
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Indicadores de Paginação Interativos do Carrossel */}
                    <div className="flex items-center justify-center gap-2 mt-6">
                        {clients.map((c, idx) => (
                            <button
                                key={c.id}
                                onClick={() => scrollToClient(idx)}
                                className={`transition-all duration-300 rounded-full ${
                                    activeClientIndex === idx 
                                        ? 'w-8 h-2.5 bg-blue-600 shadow-sm ring-2 ring-blue-400/30' 
                                        : 'w-2.5 h-2.5 bg-slate-300 hover:bg-slate-400'
                                }`}
                                aria-label={`Ir para cliente ${c.name}`}
                                title={c.name}
                            />
                        ))}
                    </div>

                    {/* Dica de Uso & Status de Auto-Loop */}
                    <div className="flex items-center justify-center gap-2 mt-3 text-xs font-semibold text-slate-500 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 shadow-2xs text-slate-700">
                            <span className={`w-2 h-2 rounded-full ${isCarouselPaused ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`} />
                            <span>{isCarouselPaused ? 'Carrossel em Pausa' : 'Transição Automática Contínua (3 por vez no Web)'}</span>
                        </span>
                        <span className="hidden sm:inline text-slate-300">•</span>
                        <span className="hidden sm:inline text-slate-600">Foco no Cliente {activeClientIndex + 1} de {clients.length}</span>
                    </div>
                </div>
            </section>

            {/* Parceria Estratégica em Gestão da Qualidade (Lynx EMS + SIM Consultoria) */}
            <section id="parceria-sgq" className="py-24 bg-gradient-to-br from-slate-950 via-[#0a192f] to-slate-900 text-white relative overflow-hidden border-b border-slate-800">
                {/* Background Ambient Glows */}
                <div className="absolute top-0 right-1/4 w-[500px] h-[300px] bg-blue-600/15 rounded-full blur-[140px] pointer-events-none" />
                <div className="absolute bottom-0 left-10 w-[400px] h-[250px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                        <div className="lg:col-span-7 space-y-6">
                            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-300 text-xs font-bold uppercase tracking-wider backdrop-blur-sm">
                                <Award className="w-4 h-4 text-cyan-400" />
                                Aliança Estratégica Oficial: Lynx EMS & SIM Consultoria
                            </div>

                            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[1.15]">
                                Tecnologia Industrial 4.0 aliada à <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-sky-300">
                                    SIM Consultoria (18 anos de Excelência)
                                </span>
                            </h2>

                            {/* Official Quote & Bio */}
                            <div className="relative pl-6 border-l-2 border-cyan-400/60 my-6 bg-slate-900/40 p-5 rounded-r-2xl border-y border-r border-slate-800/60 backdrop-blur-sm">
                                <p className="text-base sm:text-lg text-slate-200 font-normal leading-relaxed italic">
                                    "Há 18 anos, a Sim Consultoria nasceu com o propósito de transformar ideias em resultados, levando inovação, dedicação e compromisso para cada cliente. Nossa trajetória é marcada pela busca constante da excelência, sempre pautada em valores como ética, responsabilidade e profissionalismo."
                                </p>
                                <span className="block mt-3 text-xs font-bold uppercase tracking-wider text-cyan-400 not-italic">
                                    — Manifesto Oficial SIM Consultoria
                                </span>
                            </div>

                            <p className="text-slate-300 text-sm sm:text-base leading-relaxed font-normal">
                                Nessa parceria contínua, a <strong>Lynx EMS Sistemas</strong> desenvolve a infraestrutura digital e inteligência de software, enquanto a <strong>SIM Consultoria</strong> valida metodologias, implementa diretrizes normativas ISO e garante rigor metrológico absoluto para que cada ordem de produção do <strong>SINCO Suite</strong> nasça em conformidade total.
                            </p>

                            <div className="flex flex-wrap items-center gap-4 pt-2">
                                <a 
                                    href="https://www.instagram.com/sim.consultoria/" 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="inline-flex items-center gap-2.5 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-600/30 hover:shadow-blue-500/50 transform hover:-translate-y-0.5"
                                >
                                    <span>Conhecer a SIM Consultoria (@sim.consultoria)</span>
                                    <ExternalLink className="w-4 h-4" />
                                </a>

                                <a 
                                    href="#modulos" 
                                    className="inline-flex items-center gap-2 bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700 px-6 py-3.5 rounded-xl font-semibold text-sm transition-all hover:border-slate-500"
                                >
                                    Explorar Módulos da Suíte
                                    <ChevronRight className="w-4 h-4" />
                                </a>
                            </div>
                        </div>

                        {/* Co-Branding Card on Right */}
                        <div className="lg:col-span-5">
                            <div className="bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-slate-700/80 rounded-3xl p-8 shadow-2xl backdrop-blur-md relative">
                                <div className="flex items-center justify-between pb-6 mb-6 border-b border-slate-800">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-white p-2 rounded-2xl shadow-md border border-slate-200/50">
                                            <img 
                                                src={simLogo} 
                                                alt="SIM Consultoria" 
                                                className="h-14 w-14 object-contain rounded-xl" 
                                            />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-extrabold uppercase tracking-widest text-cyan-400 block">
                                                Aliança de Qualidade
                                            </span>
                                            <h3 className="text-xl font-black text-white">SIM Consultoria</h3>
                                            <span className="text-xs text-slate-400 font-medium">Parceira Estratégica Lynx EMS</span>
                                        </div>
                                    </div>
                                    <div className="px-3 py-1.5 rounded-xl bg-cyan-950/70 border border-cyan-800/60 text-cyan-300 text-xs font-bold text-center">
                                        18 anos de <br /> Excelência
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-start gap-3.5">
                                        <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0 mt-0.5">
                                            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                                        </div>
                                        <div>
                                            <h4 className="text-white font-bold text-sm">Metodologia Homologada</h4>
                                            <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">
                                                Processos fabris modelados segundo as melhores práticas normativas de qualidade industrial.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-start gap-3.5">
                                        <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0 mt-0.5">
                                            <ShieldCheck className="w-4 h-4 text-cyan-400" />
                                        </div>
                                        <div>
                                            <h4 className="text-white font-bold text-sm">Auditoria Contínua & RNCs</h4>
                                            <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">
                                                Tratamento de causa raiz com ciclo PDCA integrado ao chão de fábrica e à engenharia.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-start gap-3.5">
                                        <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0 mt-0.5">
                                            <Target className="w-4 h-4 text-cyan-400" />
                                        </div>
                                        <div>
                                            <h4 className="text-white font-bold text-sm">Foco em Resultados & Ética</h4>
                                            <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">
                                                Transformação de conceitos normativos em produtividade real, conformidade e redução de perdas.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-between text-xs">
                                    <span className="text-slate-400">Instagram Oficial:</span>
                                    <a 
                                        href="https://www.instagram.com/sim.consultoria/" 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="text-cyan-400 hover:text-cyan-300 font-bold inline-flex items-center gap-1.5"
                                    >
                                        @sim.consultoria <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Canal do Cliente Section */}
            <section id="portal-cliente" className="py-24 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 rounded-3xl p-8 md:p-14 text-white shadow-2xl overflow-hidden relative border border-slate-800">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
                            <div>
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold uppercase tracking-wider mb-6 border border-blue-400/30">
                                    <MonitorSmartphone className="w-4 h-4 text-blue-400" />
                                    Transparência Total de Fabricação
                                </div>
                                
                                <h2 className="text-3xl sm:text-4xl font-extrabold mb-6 leading-tight">
                                    Canal do Cliente Integrado ao <span className="text-cyan-400">SINCO Suite</span>
                                </h2>
                                
                                <p className="text-slate-300 text-base sm:text-lg mb-8 leading-relaxed">
                                    Conceda aos seus clientes acesso seguro e em tempo real à esteira produtiva de seus pedidos. Reduza 90% das ligações e consultas de status através do rastreamento digital de OPs.
                                </p>
                                
                                <div className="space-y-4">
                                    {[
                                        { icon: Activity, title: 'Telemetria de Etapas', desc: 'Acompanhamento do status de corte, dobra, solda, pintura e embalagem.' },
                                        { icon: Bell, title: 'Notificações de Faturamento', desc: 'Alertas automáticos de liberação de pedidos e conferência de romaneios.' },
                                        { icon: Box, title: 'Download de Dossiês & Laudos', desc: 'Acesso imediato aos certificados de qualidade SGQ e notas fiscais.' }
                                    ].map((f, idx) => (
                                        <div key={idx} className="flex items-start gap-4 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 backdrop-blur-sm">
                                            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-400 mt-0.5">
                                                <f.icon className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h4 className="text-white font-bold text-sm">{f.title}</h4>
                                                <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">{f.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="relative">
                                <div className="bg-white rounded-2xl shadow-2xl p-6 text-slate-800 border border-slate-200">
                                    <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
                                        <div>
                                            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Ordem de Produção</span>
                                            <h5 className="font-extrabold text-slate-900 text-lg">OP #049281-26</h5>
                                            <p className="text-xs text-slate-500">Conjunto Estrutural Soldado Aço 1020</p>
                                        </div>
                                        <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold border border-emerald-200">
                                            Em Produção
                                        </span>
                                    </div>
                                    
                                    <div className="space-y-4">
                                        <div>
                                            <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1.5">
                                                <span>1. Corte a Laser CNC</span>
                                                <span className="text-emerald-600 font-bold">100% Concluído</span>
                                            </div>
                                            <div className="w-full bg-slate-100 rounded-full h-2">
                                                <div className="bg-emerald-500 h-2 rounded-full w-full" />
                                            </div>
                                        </div>

                                        <div>
                                            <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1.5">
                                                <span>2. Conformação & Dobra</span>
                                                <span className="text-emerald-600 font-bold">100% Concluído</span>
                                            </div>
                                            <div className="w-full bg-slate-100 rounded-full h-2">
                                                <div className="bg-emerald-500 h-2 rounded-full w-full" />
                                            </div>
                                        </div>

                                        <div>
                                            <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1.5">
                                                <span>3. Soldagem Certificada MIG</span>
                                                <span className="text-blue-600 font-bold">Em Execução (72%)</span>
                                            </div>
                                            <div className="w-full bg-slate-100 rounded-full h-2">
                                                <div className="bg-blue-600 h-2 rounded-full w-[72%]" />
                                            </div>
                                        </div>

                                        <div className="opacity-50">
                                            <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1.5">
                                                <span>4. Pintura Eletrostática a Pó</span>
                                                <span>Aguardando Liberação</span>
                                            </div>
                                            <div className="w-full bg-slate-100 rounded-full h-2">
                                                <div className="bg-slate-300 h-2 rounded-full w-0" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                                        <span>Previsão de Expedição: <strong>24/09/2026</strong></span>
                                        <span className="text-blue-600 font-bold">Rastreio Ativo</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Technical Differentials */}
            <section id="diferenciais" className="py-20 bg-slate-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-4">
                            Por que Escolher o SINCO da Lynx EMS Sistemas?
                        </h2>
                        <p className="text-slate-600 text-base">
                            Construído especificamente para os desafios da indústria metalmecânica e manufatura sob encomenda.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="p-8 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-6 border border-blue-100">
                                <Database className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">Desvinculação Completa</h3>
                            <p className="text-slate-600 text-sm leading-relaxed">
                                Operação 100% independente de ERPs caros ou rígidos. Banco de dados relacional veloz, sem amarras proprietárias e com total propriedade dos seus dados fabris.
                            </p>
                        </div>

                        <div className="p-8 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-6 border border-blue-100">
                                <Zap className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">Performance & Reatividade</h3>
                            <p className="text-slate-600 text-sm leading-relaxed">
                                Consultas em milissegundos sobre milhões de registros. Telas modernas, intuitivas e responsivas criadas para operadores de chão de fábrica e diretores corporativos.
                            </p>
                        </div>

                        <div className="p-8 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-6 border border-blue-100">
                                <ShieldCheck className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">Validação Industrial Estrita</h3>
                            <p className="text-slate-600 text-sm leading-relaxed">
                                Verificação automática de integridade referencial, bloqueio de saldos insuficientes, cálculo preciso de BOM e validação cadastral Módulo 11 de CNPJ e CPF.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-slate-950 text-slate-400 py-16 border-t border-slate-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-10 pb-12 border-b border-slate-800/80">
                        <div className="md:col-span-2">
                            <div className="flex items-center gap-3 mb-4">
                                <img 
                                    src={lynxLogo} 
                                    alt="Lynx EMS Sistemas" 
                                    className="h-10 w-10 rounded-xl object-cover border border-slate-700" 
                                />
                                <div>
                                    <span className="text-white font-extrabold text-lg tracking-tight block">
                                        SINCO Industrial Suite
                                    </span>
                                    <span className="text-xs text-blue-400 font-medium">
                                        Desenvolvido por Lynx EMS Sistemas
                                    </span>
                                </div>
                            </div>
                            <p className="text-sm text-slate-400 max-w-md leading-relaxed mb-6">
                                Plataforma integrada de alta performance para manufatura moderna. Conectando engenharia, PCP, qualidade e logística sob uma arquitetura digital inteligente.
                            </p>
                            <div className="text-xs text-slate-500 font-mono">
                                Lynx EMS Sistemas — Soluções Tecnológicas Industriais
                            </div>
                        </div>

                        {/* Co-Branding Partner SIM Consultoria */}
                        <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-3 mb-3">
                                    <img 
                                        src={simLogo} 
                                        alt="SIM Consultoria" 
                                        className="h-10 w-10 rounded-xl object-contain bg-white p-1 border border-slate-700 shadow-sm" 
                                    />
                                    <div>
                                        <span className="text-[10px] uppercase tracking-wider text-cyan-400 font-bold block">
                                            Parceiro em Qualidade
                                        </span>
                                        <h5 className="text-white font-extrabold text-sm leading-tight">SIM Consultoria</h5>
                                        <span className="text-[11px] text-slate-400 font-medium">18 anos de História</span>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                                    Especialista em Gestão da Qualidade, transformando ideias em resultados com ética e inovação.
                                </p>
                            </div>
                            <a 
                                href="https://www.instagram.com/sim.consultoria/" 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="inline-flex items-center justify-between px-3 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 hover:text-white text-xs font-bold transition-all"
                            >
                                <span>@sim.consultoria</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                        </div>

                        <div>
                            <h4 className="text-white text-xs font-bold uppercase tracking-wider mb-4">
                                Módulos Principais
                            </h4>
                            <ul className="space-y-2.5 text-sm">
                                <li><a href="#modulos" className="hover:text-white transition-colors">PCP & Chão de Fábrica</a></li>
                                <li><a href="#modulos" className="hover:text-white transition-colors">SINCO ERP Nativo</a></li>
                                <li><a href="#modulos" className="hover:text-white transition-colors">Engenharia de Produto & BOM</a></li>
                                <li><a href="#parceria-sgq" className="hover:text-white transition-colors text-blue-400">Qualidade Total SGQ (SIM)</a></li>
                                <li><a href="#modulos" className="hover:text-white transition-colors">IA Hermes & OCR</a></li>
                                <li><a href="#modulos" className="hover:text-white transition-colors">Logística & VMI</a></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="text-white text-xs font-bold uppercase tracking-wider mb-4">
                                Acesso Rápido
                            </h4>
                            <ul className="space-y-2.5 text-sm">
                                <li><Link to="/login" className="hover:text-white transition-colors font-semibold text-blue-400">Acessar Sistema</Link></li>
                                <li><a href="#portal-cliente" className="hover:text-white transition-colors">Canal do Cliente</a></li>
                                <li><a href="#parceria-sgq" className="hover:text-white transition-colors">Parceria de Qualidade</a></li>
                                <li><a href="#plataforma" className="hover:text-white transition-colors">Visão Geral da Plataforma</a></li>
                                <li><a href="#diferenciais" className="hover:text-white transition-colors">Diferenciais Competitivos</a></li>
                            </ul>
                        </div>
                    </div>

                    <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
                        <p>© {new Date().getFullYear()} Lynx EMS Sistemas. Todos os direitos reservados.</p>
                        <p className="font-mono">SINCO Industrial Suite — Versão 4.2 Protheus-Decoupled</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
