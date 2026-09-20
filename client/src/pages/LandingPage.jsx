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
    Smartphone,
    Mail,
    Phone,
    MapPin,
    Calendar,
    Building,
    MessageCircle
} from 'lucide-react';

// Brand Assets - Official Lynx SM IDV
import lynxLogoForest from '../assets/brand-lynx/LOGOTIPO FOREST.svg';
import lynxLogoSnow from '../assets/brand-lynx/LOGOTIPO SNOW.svg';
import lynxIconForest from '../assets/brand-lynx/ICONE FOREST.svg';
import lynxIconSnow from '../assets/brand-lynx/ICONE SNOW-17.svg';
import lynxSublogoForest from '../assets/brand-lynx/SUBLOGO FOREST.svg';
import sincoCelularImg from '../assets/brand-lynx/SINCO- CELULAR 01.png';

// Strategic Partner Logo
import simLogo from '../assets/sim-consultoria-logo.png';

// Section Graphic Assets
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

    // Clients definition
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
            segment: 'Soluções Elétricas & Painéis MT',
            desc: 'Engenharia de precisão para painéis elétricos industriais certificados de baixa e média tensão, cubículos e eletrocentros para grandes usinas e plantas industriais.',
            logo: mettaLogo,
            link: 'https://metta.ind.br/',
            instagram: 'https://www.instagram.com/metta_solucoeseletricas/',
            instagramHandle: '@metta_solucoeseletricas',
            badge: 'Soluções Elétricas & MT',
            isDarkLogo: true,
            theme: {
                cardBorder: 'border-emerald-200/90 hover:border-emerald-500 hover:shadow-2xl hover:shadow-emerald-500/15 ring-1 ring-emerald-500/20',
                topAccent: 'bg-gradient-to-r from-emerald-500 via-lime-500 to-emerald-600',
                logoBg: 'bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-emerald-500/40 group-hover:border-emerald-400 group-hover:shadow-[0_0_22px_rgba(34,197,94,0.25)]',
                badgeClass: 'bg-emerald-50 border-emerald-200 text-emerald-800 font-extrabold',
                titleHover: 'group-hover:text-emerald-700',
                checkColor: 'text-emerald-600',
                btnClass: 'bg-emerald-50/80 hover:bg-emerald-600 border-emerald-300 hover:border-emerald-600 text-emerald-900 hover:text-white',
                btnIcon: 'text-emerald-600 group-hover/btn:text-white',
                instaBtn: 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 hover:shadow-emerald-600/25'
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
            segment: 'Aço Inox & Foodservice Industrial',
            desc: 'Pioneirismo e liderança nacional no desenvolvimento e manufatura de equipamentos profissionais em aço inox para redes de hotéis, hospitais e gastronomia pesada.',
            logo: alfatecLogo,
            link: 'https://www.alfatecozinhas.com.br/',
            instagram: 'https://www.instagram.com/alfatec.cozinhas/',
            instagramHandle: '@alfatec.cozinhas',
            badge: 'Aço Inoxidável & Foodservice',
            isDarkLogo: false,
            theme: {
                cardBorder: 'border-red-200/90 hover:border-red-600 hover:shadow-2xl hover:shadow-red-600/15 ring-1 ring-red-600/20',
                topAccent: 'bg-gradient-to-r from-red-600 via-rose-600 to-red-700',
                logoBg: 'bg-gradient-to-b from-white to-slate-50 border-red-200 group-hover:border-red-500 group-hover:shadow-[0_0_22px_rgba(220,38,38,0.2)]',
                badgeClass: 'bg-red-50 border-red-200 text-red-800 font-extrabold',
                titleHover: 'group-hover:text-red-700',
                checkColor: 'text-red-600',
                btnClass: 'bg-red-50/80 hover:bg-red-600 border-red-300 hover:border-red-600 text-red-900 hover:text-white',
                btnIcon: 'text-red-600 group-hover/btn:text-white',
                instaBtn: 'bg-gradient-to-r from-red-700 via-rose-800 to-red-900 hover:from-red-800 hover:to-rose-900 hover:shadow-red-700/25'
            },
            highlights: [
                'Cozinhas industriais completas sob medida',
                'Caldeiraria sanitária em aço inox de alta durabilidade',
                'Atendimento a grandes redes e projetos hospitalares'
            ]
        },
        {
            id: 'metalfisa',
            name: 'MetalFisa',
            segment: 'Metalmecânica & Corte Laser CNC',
            desc: 'Caldeiraria fina de ponta, corte a laser CNC de alta velocidade, conformação robotizada e solda certificada com controle operacional 100% digital via SINCO.',
            logo: metalfisaLogo,
            link: 'https://metalfisa.com.br/',
            instagram: 'https://www.instagram.com/metalfisa/',
            instagramHandle: '@metalfisa',
            badge: 'Metalmecânica de Precisão',
            isDarkLogo: false,
            theme: {
                cardBorder: 'border-sky-200/90 hover:border-sky-600 hover:shadow-2xl hover:shadow-sky-600/15 ring-1 ring-sky-600/20',
                topAccent: 'bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-600',
                logoBg: 'bg-gradient-to-b from-white to-slate-50 border-sky-200 group-hover:border-sky-500 group-hover:shadow-[0_0_22px_rgba(2,132,199,0.2)]',
                badgeClass: 'bg-sky-50 border-sky-200 text-sky-800 font-extrabold',
                titleHover: 'group-hover:text-sky-700',
                checkColor: 'text-sky-600',
                btnClass: 'bg-sky-50/80 hover:bg-sky-600 border-sky-300 hover:border-sky-600 text-sky-900 hover:text-white',
                btnIcon: 'text-sky-600 group-hover/btn:text-white',
                instaBtn: 'bg-gradient-to-r from-[#0e4582] via-[#1f365c] to-[#0284c7] hover:from-[#15253f] hover:to-[#0284c7] hover:shadow-sky-600/25'
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
            segment: 'Engenharia Elétrica & Chicotes Pré-Fabricados',
            desc: 'Engenharia de ponta em kits pré-fabricados sob medida para grandes obras residenciais e industriais. Chicotes prontos plug & play, conformidade NBR 5410/5626 e desperdício zero de cabos.',
            logo: flrLogo,
            link: 'https://flrinstalacoes.lynxems.com.br/',
            instagram: 'https://www.instagram.com/flrinstalacoes/',
            instagramHandle: '@flrinstalacoes',
            badge: 'Engenharia & Kits Pré-Fabricados',
            isDarkLogo: true,
            theme: {
                cardBorder: 'border-amber-200/90 hover:border-amber-500 hover:shadow-2xl hover:shadow-amber-500/15 ring-1 ring-amber-500/20',
                topAccent: 'bg-gradient-to-r from-amber-500 via-[#0e4582] to-amber-600',
                logoBg: 'bg-gradient-to-b from-[#0a2342] via-[#0e4582] to-[#0a2342] border-amber-400/40 group-hover:border-amber-400 group-hover:shadow-[0_0_22px_rgba(245,158,11,0.25)]',
                badgeClass: 'bg-amber-50 border-amber-200 text-amber-900 font-extrabold',
                titleHover: 'group-hover:text-amber-600',
                checkColor: 'text-amber-500',
                btnClass: 'bg-amber-50/80 hover:bg-amber-500 border-amber-300 hover:border-amber-500 text-amber-950 hover:text-white',
                btnIcon: 'text-amber-600 group-hover/btn:text-white',
                instaBtn: 'bg-gradient-to-r from-[#0e4582] via-amber-600 to-amber-500 hover:from-[#0a2342] hover:to-amber-600 hover:shadow-amber-500/25'
            },
            highlights: [
                'Kits elétricos e hidráulicos pré-montados plug & play',
                'Compatibilização técnica BIM e normas NBR 5410 / NBR 5626',
                'Redução comprovada de até 40% em mão de obra no canteiro'
            ]
        }
    ];

    // Extended 3x array for seamless infinite loop (15 items)
    const extendedClients = [...clients, ...clients, ...clients];

    // Carousel state: start at index 5 (first client of middle set)
    const [currentIndex, setCurrentIndex] = useState(5);
    const [isTransitioning, setIsTransitioning] = useState(true);
    const [isCarouselPaused, setIsCarouselPaused] = useState(false);

    // Helper to get visible count based on window size
    const getVisibleCount = () => {
        if (typeof window === 'undefined') return 3;
        if (window.innerWidth < 640) return 1;
        if (window.innerWidth < 1024) return 2;
        return 3;
    };

    // Responsive visible count: Desktop 3, Tablet 2, Mobile 1
    const [visibleCount, setVisibleCount] = useState(getVisibleCount);
    const touchStartRef = useRef(0);
    const touchCurrentRef = useRef(0);

    useEffect(() => {
        const handleResize = () => {
            setVisibleCount(getVisibleCount());
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleNext = () => {
        setIsTransitioning(true);
        setCurrentIndex(prev => prev + 1);
    };

    const handlePrev = () => {
        setIsTransitioning(true);
        setCurrentIndex(prev => prev - 1);
    };

    // Invisible jump to center set when reaching boundary sets
    const handleTransitionEnd = () => {
        if (currentIndex >= 10) {
            setIsTransitioning(false);
            setCurrentIndex(currentIndex - 5);
        } else if (currentIndex < 5) {
            setIsTransitioning(false);
            setCurrentIndex(currentIndex + 5);
        }
    };

    // Continuous auto-play loop (3.5s per transition, pauses on hover/touch)
    useEffect(() => {
        if (isCarouselPaused) return;

        const interval = setInterval(() => {
            handleNext();
        }, 3500);

        return () => clearInterval(interval);
    }, [isCarouselPaused, currentIndex]);

    // Active client index in range 0..4
    const activeClientIndex = ((currentIndex % 5) + 5) % 5;

    const goToClient = (targetIndex) => {
        let diff = targetIndex - activeClientIndex;
        if (diff > 2) diff -= 5;
        if (diff < -2) diff += 5;
        setIsTransitioning(true);
        setCurrentIndex(prev => prev + diff);
    };

    const modules = [
        {
            id: 'pcp',
            title: 'PCP & Chão de Fábrica',
            category: 'Planejamento e Controle de Produção',
            desc: 'Monitoramento contínuo de Ordens de Produção (OPs) e alocação de postos de trabalho. Apontamentos em tempo real de corte, dobra, solda, pintura e montagem.',
            image: pcpImage,
            badge: 'Tempo Real & OEE',
            stats: 'OEE > 88%',
            highlights: [
                'Geração e apontamento dinâmico de OPs com código de barras',
                'Balanceamento de carga máquina e sequenciamento com fila de prioridades',
                'Controle de refugo, retrabalho e tempos de parada em tempo real',
                'Visualização gráfica de ocupação dos postos de trabalho'
            ]
        },
        {
            id: 'erp',
            title: 'Estrutura de Projetos & Gestão de OPs',
            category: 'Engenharia de Produto, BOM & Integração ERP',
            desc: 'Módulo especializado na gestão técnica de estruturas de produto (BOM), roteiros de fabricação e liberação de OPs, desenhado para se integrar harmoniosamente ao seu ERP corporativo (TOTVS, Sankhya, Omie e outros).',
            image: erpOrdersImage,
            badge: 'Integração com ERPs',
            stats: 'TOTVS • Omie • Sankhya',
            highlights: [
                'Sincronização com pedidos e demandas do seu ERP corporativo',
                'Explosão rápida de árvores de produto e materiais de engenharia',
                'Liberação técnica automatizada de OPs vinculadas a projetos',
                'Preserva a integridade e a rotina fiscal do seu sistema de gestão'
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
            desc: 'Gestão completa do Sistema de Gestão da Qualidade industrial estruturado em parceria com a SIM Consultoria (17 anos de excelência). Controle rigoroso de caixas de ferramentas (Toolbox), calibração de instrumentos, termos de responsabilidade e auditorias.',
            image: sgqQualityImage,
            badge: 'Parceria SIM Consultoria',
            stats: '17 Anos de Excelência',
            highlights: [
                'Metodologia homologada e apoiada pela SIM Consultoria (17 anos de história)',
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
        <div className="min-h-screen bg-[#F9F8F3] font-sans overflow-x-hidden text-[#32423D]">
            {/* Header / Navbar */}
            <nav className="fixed w-full z-50 bg-[#F9F8F3]/95 backdrop-blur-md border-b border-[#6F7170]/20 shadow-xs transition-all">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-20 items-center">
                        {/* Brand Identity & Co-Branding Lockup (Clean, spacious, zero repetition) */}
                        <div className="flex items-center gap-3 sm:gap-4">
                            {/* Single Official Lynx SM Vector Brandmark */}
                            <a href="#" className="flex items-center group" title="Lynx SM">
                                <img 
                                    src={lynxSublogoForest} 
                                    alt="Lynx SM" 
                                    className="h-8 sm:h-9 w-auto object-contain transition-transform group-hover:scale-105" 
                                />
                            </a>

                            <span className="text-[#6F7170]/30 font-light text-lg select-none">|</span>

                            {/* Product Brand: SINCO Suite */}
                            <div className="flex items-center gap-2">
                                <span className="text-xl sm:text-2xl font-black tracking-tight text-[#32423D]">
                                    SINCO
                                </span>
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#425750] text-white tracking-wider shadow-2xs">
                                    Suite
                                </span>
                            </div>

                            {/* Strategic Partner Co-branding: SIM Consultoria (Visible on large screens) */}
                            <div className="hidden 2xl:flex items-center gap-2 pl-3 border-l border-[#6F7170]/20">
                                <span className="text-[#6F7170]/50 text-xs font-bold">✕</span>
                                <a 
                                    href="https://www.instagram.com/sim.consultoria/" 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-white hover:bg-slate-50 border border-[#6F7170]/25 hover:border-[#425750] shadow-2xs group transition-all"
                                    title="SIM Consultoria - 17 Anos de Excelência em SGQ"
                                >
                                    <img 
                                        src={simLogo} 
                                        alt="SIM Consultoria" 
                                        className="h-5 w-auto object-contain" 
                                    />
                                    <span className="text-[11px] font-extrabold text-[#556460] group-hover:text-[#32423D] transition-colors">
                                        SIM Consultoria
                                    </span>
                                    <span className="text-[9px] font-bold text-[#425750] bg-[#425750]/10 px-1.5 py-0.5 rounded-full">
                                        17 Anos
                                    </span>
                                </a>
                            </div>
                        </div>
                        
                        {/* Desktop Navigation Links (Clean, uniform text links with generous breathing room) */}
                        <div className="hidden xl:flex items-center gap-7">
                            <a href="#modulos" className="text-sm font-semibold text-[#32423D] hover:text-[#425750] transition-colors">
                                Módulos
                            </a>
                            <a href="#clientes" className="text-sm font-semibold text-[#32423D] hover:text-[#425750] transition-colors flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5 text-[#425750]" />
                                <span>Clientes</span>
                            </a>
                            <a href="#parceria-sgq" className="text-sm font-semibold text-[#32423D] hover:text-[#425750] transition-colors flex items-center gap-1.5">
                                <Award className="w-3.5 h-3.5 text-[#425750]" />
                                <span>Aliança SGQ</span>
                            </a>
                            <a href="#plataforma" className="text-sm font-semibold text-[#32423D] hover:text-[#425750] transition-colors">
                                Tecnologia 4.0
                            </a>
                            <a href="#contato" className="text-sm font-semibold text-[#32423D] hover:text-[#425750] transition-colors">
                                Contato
                            </a>
                        </div>

                        {/* CTA Button and Responsive Hamburger Toggle */}
                        <div className="flex items-center gap-3">
                            <Link 
                                to="/login" 
                                className="hidden sm:flex items-center gap-2 bg-[#425750] hover:bg-[#32423D] text-white px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-md shadow-[#32423D]/20 hover:shadow-lg transform hover:-translate-y-0.5 border border-[#425750]"
                            >
                                <span>Acessar SINCO</span>
                                <ArrowRight className="w-4 h-4" />
                            </Link>

                            {/* Responsive Hamburger Toggle for Tablets and Mobile */}
                            <button
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                className="xl:hidden p-2.5 rounded-xl text-[#32423D] hover:text-[#425750] hover:bg-[#EAE8E0] transition-colors border border-[#6F7170]/30"
                                aria-label="Abrir Menu de Navegação"
                            >
                                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Navigation Dropdown Drawer */}
                {mobileMenuOpen && (
                    <div className="lg:hidden bg-[#F9F8F3]/98 backdrop-blur-xl border-b border-[#6F7170]/25 px-4 pt-3 pb-6 space-y-3 shadow-xl animate-in slide-in-from-top duration-200">
                        <div className="flex flex-col space-y-2">
                            <a 
                                href="#modulos" 
                                onClick={() => setMobileMenuOpen(false)}
                                className="px-3 py-2 rounded-lg text-sm font-semibold text-[#32423D] hover:bg-[#EAE8E0]"
                            >
                                Módulos Industriais
                            </a>
                            <a 
                                href="#clientes" 
                                onClick={() => setMobileMenuOpen(false)}
                                className="px-3 py-2 rounded-lg text-sm font-semibold text-[#32423D] hover:bg-[#EAE8E0] flex items-center justify-between"
                            >
                                <span>Principais Clientes</span>
                                <span className="text-[11px] bg-[#425750]/15 text-[#425750] font-bold px-2 py-0.5 rounded-full">5 Indústrias</span>
                            </a>
                            <a 
                                href="#parceria-sgq" 
                                onClick={() => setMobileMenuOpen(false)}
                                className="px-3 py-2 rounded-lg text-sm font-semibold text-[#425750] bg-[#425750]/10 flex items-center justify-between"
                            >
                                <span>Parceria Lynx EMS & SIM Consultoria</span>
                                <Award className="w-4 h-4 text-[#425750]" />
                            </a>
                            <a 
                                href="#plataforma" 
                                onClick={() => setMobileMenuOpen(false)}
                                className="px-3 py-2 rounded-lg text-sm font-semibold text-[#32423D] hover:bg-[#EAE8E0]"
                            >
                                Arquitetura 4.0
                            </a>
                            <a 
                                href="#portal-cliente" 
                                onClick={() => setMobileMenuOpen(false)}
                                className="px-3 py-2 rounded-lg text-sm font-semibold text-[#32423D] hover:bg-[#EAE8E0]"
                            >
                                Canal do Cliente
                            </a>
                            <a 
                                href="#contato" 
                                onClick={() => setMobileMenuOpen(false)}
                                className="px-3 py-2 rounded-lg text-sm font-semibold text-[#32423D] hover:bg-[#EAE8E0]"
                            >
                                Dados Corporativos & Contato
                            </a>
                            <Link 
                                to="/login" 
                                onClick={() => setMobileMenuOpen(false)}
                                className="w-full flex items-center justify-center gap-2 bg-[#425750] hover:bg-[#32423D] text-white p-3 rounded-xl font-bold text-sm shadow-md transition-all"
                            >
                                <span>Acessar SINCO Suite</span>
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                    </div>
                )}
            </nav>

            {/* Hero Section */}
            <section className="relative pt-32 pb-24 lg:pt-44 lg:pb-36 overflow-hidden bg-gradient-to-b from-[#1E2825] via-[#2D3C37] to-[#1E2825] text-white">
                <div className="absolute inset-0 z-0">
                    <img
                        src={heroBanner}
                        alt="SINCO Smart Factory Hero"
                        className="w-full h-full object-cover opacity-20 filter brightness-90 contrast-125"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-[#1E2825]/80 via-[#2D3C37]/90 to-[#1E2825]" />
                </div>

                {/* Ambient glowing orbs */}
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-[#425750]/30 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute bottom-10 right-10 w-[400px] h-[250px] bg-[#E0E800]/10 rounded-full blur-[100px] pointer-events-none" />

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="text-center max-w-4xl mx-auto">
                        <div className="inline-flex flex-wrap items-center justify-center gap-2 px-4 py-2 rounded-full bg-[#425750]/40 border border-[#6F7170]/40 text-[#F9F8F3] text-xs font-bold uppercase tracking-wider mb-8 backdrop-blur-md shadow-inner">
                            <Sparkles className="w-3.5 h-3.5 text-[#E0E800] animate-pulse" />
                            <span>Lynx SM</span>
                            <span className="text-[#E0E800] font-black">✕</span>
                            <span>SIM Consultoria (17 Anos)</span>
                            <span className="text-[#6F7170] hidden sm:inline">•</span>
                            <span className="text-[#F9F8F3] hidden sm:inline font-semibold">Engenharia, PCP Dinâmico e SGQ Integrados ao seu ERP</span>
                        </div>

                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.15] mb-8">
                            A Inteligência Especializada para <br className="hidden sm:inline" />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F9F8F3] via-white to-[#E0E800]">
                                Chão de Fábrica e Estrutura de Projetos
                            </span>
                        </h1>

                        <p className="text-lg sm:text-xl text-[#D8DCDA] mb-10 leading-relaxed max-w-3xl mx-auto font-normal">
                            Desenvolvido pela <strong>Lynx SM</strong> em parceria estratégica com a <strong>SIM Consultoria</strong> (17 anos de excelência em SGQ), o <strong>SINCO</strong> é a suíte de alta precisão que atua no coração da sua manufatura. Conectando-se de forma nativa e transparente ao ERP que a sua indústria já utiliza — como <strong>TOTVS</strong>, <strong>Omie</strong>, <strong>Sankhya</strong> e outros —, o SINCO assume o controle técnico de <strong>estrutura de projetos (BOM)</strong>, <strong>apontamentos de produção em tempo real</strong>, <strong>metrologia</strong> e <strong>qualidade fabril</strong>, potencializando sua operação sem alterar a rotina fiscal ou contábil já consolidada na sua empresa.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
                            <Link 
                                to="/login" 
                                className="w-full sm:w-auto flex items-center justify-center gap-3 bg-[#425750] hover:bg-[#32423D] text-white px-8 py-4 rounded-xl font-bold text-base transition-all shadow-xl shadow-[#1E2825]/50 hover:shadow-2xl border border-[#425750] transform hover:-translate-y-0.5"
                            >
                                Iniciar Sessão na Plataforma
                                <ArrowRight className="w-5 h-5 text-[#E0E800]" />
                            </Link>
                            <a 
                                href="#modulos" 
                                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#32423D]/70 hover:bg-[#32423D] text-[#F9F8F3] border border-[#6F7170]/50 px-8 py-4 rounded-xl font-semibold text-base transition-all hover:border-[#F9F8F3]/50 backdrop-blur-sm"
                            >
                                Conhecer Módulos do Sistema
                            </a>
                        </div>

                        {/* Top Key Metrics Banner */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 rounded-2xl bg-[#23302C]/80 border border-[#6F7170]/30 backdrop-blur-md shadow-2xl text-left">
                            <div className="border-r border-[#6F7170]/30 pr-4 last:border-none">
                                <div className="text-2xl sm:text-3xl font-black text-[#E0E800] tracking-tight">100%</div>
                                <div className="text-xs text-[#C2C5C3] font-medium mt-1">Integrável com TOTVS, Omie e Sankhya</div>
                            </div>
                            <div className="border-r border-[#6F7170]/30 pr-4 last:border-none">
                                <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">BOM & OPs</div>
                                <div className="text-xs text-[#C2C5C3] font-medium mt-1">Estrutura de Projetos Multinível</div>
                            </div>
                            <div className="border-r border-[#6F7170]/30 pr-4 last:border-none">
                                <div className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight">Tempo Real</div>
                                <div className="text-xs text-[#C2C5C3] font-medium mt-1">PCP Dinâmico & Rastreabilidade SGQ</div>
                            </div>
                            <div>
                                <div className="text-2xl sm:text-3xl font-black text-[#F9F8F3] tracking-tight">Zero</div>
                                <div className="text-xs text-[#C2C5C3] font-medium mt-1">Conflito com seu ERP Fiscal Atual</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Showcase Section: Live Dashboard Mockup */}
            <section id="plataforma" className="py-20 bg-[#283632] text-white relative border-y border-[#6F7170]/25">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-3xl mx-auto mb-12">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#425750]/30 border border-[#6F7170]/40 text-[#E0E800] text-xs font-bold uppercase tracking-wider mb-4">
                            <LayoutDashboard className="w-3.5 h-3.5" />
                            Painel de Controle Centralizado
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-4">
                            Visão 360° da sua Operação Fabril
                        </h2>
                        <p className="text-[#C2C5C3] text-base leading-relaxed">
                            Do pipeline de vendas até a última solda na linha de montagem: acompanhe indicadores de produtividade, gargalos e disponibilidade de estoque em tempo real.
                        </p>
                    </div>

                    <div className="relative rounded-2xl p-2 sm:p-4 bg-gradient-to-b from-[#23302C] to-[#1E2825] border border-[#6F7170]/40 shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 bg-[#1E2825] border-b border-[#6F7170]/25 rounded-t-xl">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500" />
                                <div className="w-3 h-3 rounded-full bg-amber-500" />
                                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                                <span className="ml-3 text-xs font-mono text-[#C2C5C3]">sinco.lynxems.com.br — SINCO Industrial Suite v4.2</span>
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
                            <div className="absolute inset-0 bg-gradient-to-t from-[#1E2825]/80 via-transparent to-transparent pointer-events-none" />
                        </div>
                    </div>
                </div>
            </section>

            {/* Core Modules Grid (Cards with High-Res Images) */}
            <section id="modulos" className="py-24 bg-[#F9F8F3]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#425750]/10 border border-[#425750]/25 text-[#425750] text-xs font-bold uppercase tracking-wider mb-4">
                            <Layers className="w-3.5 h-3.5" />
                            Arquitetura Modular SINCO
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-[#32423D] tracking-tight mb-4">
                            Módulos Industriais Especializados
                        </h2>
                        <p className="text-[#556460] text-base sm:text-lg leading-relaxed">
                            Projetados pela <strong>Lynx EMS Sistemas</strong> com rigor de engenharia mecânica, eletrônica e software para proporcionar máxima eficiência fabril.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {modules.map((m) => (
                            <div 
                                key={m.id}
                                className="bg-white rounded-2xl border border-[#6F7170]/20 overflow-hidden shadow-xs hover:shadow-xl hover:border-[#425750] transition-all duration-300 flex flex-col group"
                            >
                                <div className="h-52 w-full overflow-hidden relative">
                                    <img 
                                        src={m.image} 
                                        alt={m.title} 
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 filter brightness-95" 
                                    />
                                    <div className="absolute top-3 left-3 bg-[#23302C]/90 backdrop-blur-md text-[#F9F8F3] px-3 py-1 rounded-full text-xs font-bold tracking-wide border border-[#6F7170]/40">
                                        {m.badge}
                                    </div>
                                    <div className="absolute bottom-3 right-3 bg-[#425750] text-white px-2.5 py-0.5 rounded-md text-xs font-semibold shadow-xs">
                                        {m.stats}
                                    </div>
                                </div>

                                <div className="p-6 flex-1 flex flex-col justify-between">
                                    <div>
                                        <p className="text-xs font-bold text-[#425750] uppercase tracking-wider mb-1">
                                            {m.category}
                                        </p>
                                        <h3 className="text-xl font-bold text-[#32423D] mb-3 group-hover:text-[#425750] transition-colors">
                                            {m.title}
                                        </h3>
                                        <p className="text-[#556460] text-sm leading-relaxed mb-5">
                                            {m.desc}
                                        </p>

                                        <ul className="space-y-2 mb-6 border-t border-slate-100 pt-4">
                                            {m.highlights.map((h, i) => (
                                                <li key={i} className="flex items-start gap-2 text-xs text-[#32423D] font-medium">
                                                    <CheckCircle2 className="w-4 h-4 text-[#425750] flex-shrink-0 mt-0.5" />
                                                    <span>{h}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <Link 
                                        to="/login"
                                        className="inline-flex items-center justify-between w-full py-2.5 px-4 bg-[#F9F8F3] hover:bg-[#425750]/10 border border-[#6F7170]/30 hover:border-[#425750] rounded-xl text-xs font-bold text-[#32423D] hover:text-[#425750] transition-all shadow-xs"
                                    >
                                        <span>Acessar Módulo</span>
                                        <ChevronRight className="w-4 h-4 text-[#425750]" />
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Interactive Module Highlight Section */}
            <section className="py-20 bg-[#F0EFE9] border-y border-[#6F7170]/20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="bg-white rounded-3xl p-6 sm:p-10 border border-[#6F7170]/25 shadow-xl overflow-hidden">
                        <div className="flex flex-wrap gap-2 pb-6 border-b border-slate-200 mb-8">
                            {modules.map((m) => (
                                <button
                                    key={m.id}
                                    onClick={() => setActiveTab(m.id)}
                                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                                        activeTab === m.id
                                            ? 'bg-[#425750] text-white shadow-md'
                                            : 'bg-[#F9F8F3] text-[#32423D] hover:bg-[#EAE8E0] hover:text-[#23302C]'
                                    }`}
                                >
                                    {m.title.split('&')[0]}
                                </button>
                            ))}
                        </div>

                        {modules.filter(m => m.id === activeTab).map((curr) => (
                            <div key={curr.id} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                                <div className="lg:col-span-5 space-y-4">
                                    <span className="inline-block px-3 py-1 rounded-full bg-[#425750]/15 text-[#425750] text-xs font-bold uppercase tracking-wider border border-[#425750]/20">
                                        {curr.badge}
                                    </span>
                                    <h3 className="text-2xl sm:text-3xl font-black text-[#32423D]">
                                        {curr.title}
                                    </h3>
                                    <p className="text-[#556460] text-sm sm:text-base leading-relaxed">
                                        {curr.desc}
                                    </p>

                                    <div className="space-y-3 pt-2">
                                        {curr.highlights.map((item, idx) => (
                                            <div key={idx} className="flex items-center gap-3 p-2.5 rounded-lg bg-[#F9F8F3] border border-[#6F7170]/15">
                                                <div className="w-6 h-6 rounded-md bg-[#425750] text-white flex items-center justify-center font-bold text-xs">
                                                    {idx + 1}
                                                </div>
                                                <span className="text-xs sm:text-sm font-semibold text-[#32423D]">{item}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="pt-4">
                                        <Link 
                                            to="/login"
                                            className="inline-flex items-center gap-2 bg-[#32423D] hover:bg-[#425750] text-white px-6 py-3 rounded-xl font-bold text-sm shadow-md transition-all"
                                        >
                                            Explorar {curr.title.split('&')[0]}
                                            <ArrowRight className="w-4 h-4 text-[#E0E800]" />
                                        </Link>
                                    </div>
                                </div>

                                <div className="lg:col-span-7 rounded-2xl overflow-hidden border border-[#6F7170]/20 shadow-lg">
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

            {/* Principais Clientes & Casos de Sucesso (Web: Max 3 Cards, Infinite Continuous Loop) */}
            <section id="clientes" className="py-20 sm:py-24 bg-[#F4F3ED] border-b border-[#6F7170]/20 overflow-hidden">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
                        <div className="max-w-3xl">
                            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#425750]/10 border border-[#425750]/25 text-[#425750] text-xs font-bold uppercase tracking-wider mb-4 shadow-2xs">
                                <Building2 className="w-4 h-4 text-[#425750]" />
                                Principais Clientes & Ecossistema Produtivo
                            </div>
                            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#32423D] tracking-tight mb-3">
                                Grandes Indústrias que Confiam no Ecossistema SINCO
                            </h2>
                            <p className="text-[#556460] text-sm sm:text-base leading-relaxed">
                                De subestações elétricas de alta potência a caldeiraria de alta precisão, kits pré-fabricados e cozinhas profissionais: tecnologia <strong>Lynx EMS</strong> e conformidade <strong>SIM Consultoria</strong> nas plantas mais exigentes do país.
                            </p>
                        </div>

                        {/* Carousel Action Controls */}
                        <div className="flex items-center gap-3 self-start md:self-end">
                            <div className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 bg-white rounded-xl border border-[#6F7170]/30 text-xs font-bold text-[#32423D] shadow-2xs">
                                <Smartphone className="w-3.5 h-3.5 text-[#425750]" />
                                <span>Cliente {activeClientIndex + 1} de {clients.length}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handlePrev}
                                    className="p-2.5 rounded-xl bg-white hover:bg-[#425750]/10 border border-[#6F7170]/30 hover:border-[#425750] text-[#32423D] hover:text-[#425750] shadow-2xs transition-all active:scale-95"
                                    title="Cliente Anterior"
                                    aria-label="Cliente Anterior"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={handleNext}
                                    className="p-2.5 rounded-xl bg-white hover:bg-[#425750]/10 border border-[#6F7170]/30 hover:border-[#425750] text-[#32423D] hover:text-[#425750] shadow-2xs transition-all active:scale-95"
                                    title="Próximo Cliente"
                                    aria-label="Próximo Cliente"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Infinite Continuous Loop Track (Max 3 on Web, 2 on Tablet, 1 on Mobile) */}
                    <div 
                        className="relative overflow-hidden w-full -mx-3"
                        onMouseEnter={() => setIsCarouselPaused(true)}
                        onMouseLeave={() => setIsCarouselPaused(false)}
                        onTouchStart={(e) => { 
                            touchStartRef.current = e.touches[0].clientX; 
                            setIsCarouselPaused(true); 
                        }}
                        onTouchMove={(e) => { 
                            touchCurrentRef.current = e.touches[0].clientX; 
                        }}
                        onTouchEnd={() => {
                            setIsCarouselPaused(false);
                            const diff = touchStartRef.current - touchCurrentRef.current;
                            if (Math.abs(diff) > 40) {
                                if (diff > 0) handleNext();
                                else handlePrev();
                            }
                        }}
                    >
                        <div 
                            className="flex"
                            onTransitionEnd={handleTransitionEnd}
                            style={{
                                width: `${(extendedClients.length * 100) / visibleCount}%`,
                                transform: `translateX(-${(currentIndex * 100) / extendedClients.length}%)`,
                                transition: isTransitioning ? 'transform 650ms cubic-bezier(0.25, 1, 0.5, 1)' : 'none'
                            }}
                        >
                            {extendedClients.map((c, idx) => (
                                <div 
                                    key={`${c.id}-${idx}`}
                                    style={{ width: `${100 / extendedClients.length}%` }}
                                    className="px-3 flex-shrink-0 box-border"
                                >
                                    <div className={`h-full bg-white rounded-2xl border shadow-sm transition-all duration-300 flex flex-col justify-between overflow-hidden group ${c.theme.cardBorder}`}>
                                        {/* Brand Accent Top Line */}
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
                                                    {c.highlights.map((h, i) => (
                                                        <li key={i} className="flex items-start gap-2 text-[11px] text-slate-700 font-medium">
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
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Pagination Dot Controls */}
                    <div className="flex items-center justify-center gap-2 mt-6">
                        {clients.map((c, idx) => (
                            <button
                                key={c.id}
                                onClick={() => goToClient(idx)}
                                className={`transition-all duration-300 rounded-full ${
                                    activeClientIndex === idx 
                                        ? 'w-8 h-2.5 bg-[#425750] shadow-sm ring-2 ring-[#425750]/30' 
                                        : 'w-2.5 h-2.5 bg-[#6F7170]/40 hover:bg-[#6F7170]'
                                }`}
                                aria-label={`Ir para cliente ${c.name}`}
                                title={c.name}
                            />
                        ))}
                    </div>

                    {/* Auto-Loop Status Indicator */}
                    <div className="flex items-center justify-center gap-2 mt-3 text-xs font-semibold text-[#6F7170] flex-wrap">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#6F7170]/25 shadow-2xs text-[#32423D]">
                            <span className={`w-2 h-2 rounded-full ${isCarouselPaused ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`} />
                            <span>{isCarouselPaused ? 'Carrossel em Pausa (Mouse/Toque)' : 'Loop Contínuo Ativo (Máximo 3 Cards no Web)'}</span>
                        </span>
                        <span className="hidden sm:inline text-[#6F7170]/50">•</span>
                        <span className="hidden sm:inline text-[#556460]">Destaque: {clients[activeClientIndex]?.name}</span>
                    </div>
                </div>
            </section>

            {/* Parceria Estratégica em Gestão da Qualidade (Lynx EMS + SIM Consultoria) */}
            <section id="parceria-sgq" className="py-24 bg-gradient-to-br from-[#1E2825] via-[#2A3934] to-[#1E2825] text-white relative overflow-hidden border-b border-[#6F7170]/30">
                {/* Background Ambient Glows */}
                <div className="absolute top-0 right-1/4 w-[500px] h-[300px] bg-[#425750]/20 rounded-full blur-[140px] pointer-events-none" />
                <div className="absolute bottom-0 left-10 w-[400px] h-[250px] bg-[#E0E800]/10 rounded-full blur-[120px] pointer-events-none" />

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                        <div className="lg:col-span-7 space-y-6">
                            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#425750]/30 border border-[#6F7170]/40 text-[#F9F8F3] text-xs font-bold uppercase tracking-wider backdrop-blur-sm">
                                <Award className="w-4 h-4 text-[#E0E800]" />
                                Aliança Estratégica Oficial: Lynx EMS & SIM Consultoria
                            </div>

                            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[1.15]">
                                Tecnologia Industrial 4.0 aliada à <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-[#F9F8F3] to-[#E0E800]">
                                    SIM Consultoria (17 Anos de Excelência)
                                </span>
                            </h2>

                            {/* Official Quote & Bio */}
                            <div className="relative pl-6 border-l-2 border-[#E0E800]/70 my-6 bg-[#23302C]/60 p-5 rounded-r-2xl border-y border-r border-[#6F7170]/40 backdrop-blur-sm">
                                <p className="text-base sm:text-lg text-[#F9F8F3] font-normal leading-relaxed italic">
                                    "Há 17 anos, a Sim Consultoria nasceu com o propósito de transformar ideias em resultados, levando inovação, dedicação e compromisso para cada cliente. Nossa trajetória é marcada pela busca constante da excelência, sempre pautada em valores como ética, responsabilidade e profissionalismo."
                                </p>
                                <span className="block mt-3 text-xs font-bold uppercase tracking-wider text-[#E0E800] not-italic">
                                    — Manifesto Oficial SIM Consultoria
                                </span>
                            </div>

                            <p className="text-[#D8DCDA] text-sm sm:text-base leading-relaxed font-normal">
                                Nessa parceria contínua, a <strong>Lynx EMS Sistemas</strong> desenvolve a infraestrutura digital e inteligência de software, enquanto a <strong>SIM Consultoria</strong> valida metodologias, implementa diretrizes normativas ISO e garante rigor metrológico absoluto para que cada ordem de produção do <strong>SINCO Suite</strong> nasça em conformidade total.
                            </p>

                            <div className="flex flex-wrap items-center gap-4 pt-2">
                                <a 
                                    href="https://www.instagram.com/sim.consultoria/" 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="inline-flex items-center gap-2.5 bg-[#425750] hover:bg-[#32423D] text-white px-6 py-3.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-[#1E2825]/40 hover:shadow-xl transform hover:-translate-y-0.5 border border-[#425750]"
                                >
                                    <span>Conhecer a SIM Consultoria (@sim.consultoria)</span>
                                    <ExternalLink className="w-4 h-4 text-[#E0E800]" />
                                </a>

                                <a 
                                    href="#modulos" 
                                    className="inline-flex items-center gap-2 bg-[#32423D]/70 hover:bg-[#32423D] text-[#F9F8F3] border border-[#6F7170]/40 px-6 py-3.5 rounded-xl font-semibold text-sm transition-all hover:border-[#F9F8F3]/50"
                                >
                                    Explorar Módulos da Suíte
                                    <ChevronRight className="w-4 h-4" />
                                </a>
                            </div>
                        </div>

                        {/* Co-Branding Card on Right */}
                        <div className="lg:col-span-5">
                            <div className="bg-gradient-to-b from-[#23302C]/95 to-[#1E2825]/95 border border-[#6F7170]/40 rounded-3xl p-8 shadow-2xl backdrop-blur-md relative">
                                <div className="flex items-center justify-between pb-6 mb-6 border-b border-[#6F7170]/30">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-white p-2 rounded-2xl shadow-md border border-slate-200/50">
                                            <img 
                                                src={simLogo} 
                                                alt="SIM Consultoria" 
                                                className="h-14 w-14 object-contain rounded-xl" 
                                            />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#E0E800] block">
                                                Aliança de Qualidade
                                            </span>
                                            <h3 className="text-xl font-black text-white">SIM Consultoria</h3>
                                            <span className="text-xs text-[#C2C5C3] font-medium">Parceira Estratégica Lynx EMS</span>
                                        </div>
                                    </div>
                                    <div className="px-3 py-1.5 rounded-xl bg-[#425750]/40 border border-[#425750]/60 text-[#F9F8F3] text-xs font-bold text-center">
                                        17 Anos de <br /> Excelência
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="p-4 rounded-xl bg-[#1E2825]/60 border border-[#6F7170]/30 flex items-start gap-3.5">
                                        <div className="w-8 h-8 rounded-lg bg-[#425750]/30 border border-[#425750]/50 flex items-center justify-center text-[#E0E800] flex-shrink-0 mt-0.5">
                                            <CheckCircle2 className="w-4 h-4 text-[#E0E800]" />
                                        </div>
                                        <div>
                                            <h4 className="text-white font-bold text-sm">Metodologia Homologada</h4>
                                            <p className="text-[#C2C5C3] text-xs mt-0.5 leading-relaxed">
                                                Processos fabris modelados segundo as melhores práticas normativas de qualidade industrial.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-xl bg-[#1E2825]/60 border border-[#6F7170]/30 flex items-start gap-3.5">
                                        <div className="w-8 h-8 rounded-lg bg-[#425750]/30 border border-[#425750]/50 flex items-center justify-center text-[#E0E800] flex-shrink-0 mt-0.5">
                                            <ShieldCheck className="w-4 h-4 text-[#E0E800]" />
                                        </div>
                                        <div>
                                            <h4 className="text-white font-bold text-sm">Auditoria Contínua & RNCs</h4>
                                            <p className="text-[#C2C5C3] text-xs mt-0.5 leading-relaxed">
                                                Tratamento de causa raiz com ciclo PDCA integrado ao chão de fábrica e à engenharia.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-xl bg-[#1E2825]/60 border border-[#6F7170]/30 flex items-start gap-3.5">
                                        <div className="w-8 h-8 rounded-lg bg-[#425750]/30 border border-[#425750]/50 flex items-center justify-center text-[#E0E800] flex-shrink-0 mt-0.5">
                                            <Target className="w-4 h-4 text-[#E0E800]" />
                                        </div>
                                        <div>
                                            <h4 className="text-white font-bold text-sm">Foco em Resultados & Ética</h4>
                                            <p className="text-[#C2C5C3] text-xs mt-0.5 leading-relaxed">
                                                Transformação de conceitos normativos em produtividade real, conformidade e redução de perdas.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 pt-5 border-t border-[#6F7170]/30 flex items-center justify-between text-xs">
                                    <span className="text-[#C2C5C3]">Instagram Oficial:</span>
                                    <a 
                                        href="https://www.instagram.com/sim.consultoria/" 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="text-[#E0E800] hover:underline font-bold inline-flex items-center gap-1.5"
                                    >
                                        @sim.consultoria <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Canal do Cliente Section (Featuring Real SINCO Mobile Screen) */}
            <section id="portal-cliente" className="py-24 bg-[#F9F8F3]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="bg-gradient-to-br from-[#1E2825] via-[#2A3934] to-[#1E2825] rounded-3xl p-8 md:p-14 text-white shadow-2xl overflow-hidden relative border border-[#6F7170]/30">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
                            <div className="lg:col-span-7">
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#425750]/40 text-[#E0E800] text-xs font-bold uppercase tracking-wider mb-6 border border-[#6F7170]/40">
                                    <MonitorSmartphone className="w-4 h-4 text-[#E0E800]" />
                                    Transparência Total de Fabricação & Mobile Nativo
                                </div>
                                
                                <h2 className="text-3xl sm:text-4xl font-extrabold mb-6 leading-tight">
                                    Canal do Cliente & Operação no Celular: <br />
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-[#F9F8F3] to-[#E0E800]">
                                        SINCO Mobile & Web Conectados
                                    </span>
                                </h2>
                                
                                <p className="text-[#D8DCDA] text-base sm:text-lg mb-8 leading-relaxed">
                                    Projetado especificamente para visualização no computador, tablet e celular. Conceda aos seus clientes acesso seguro e em tempo real à esteira produtiva de seus pedidos, eliminando 90% das consultas por status.
                                </p>
                                
                                <div className="space-y-4">
                                    {[
                                        { icon: Activity, title: 'Telemetria de Etapas no Celular', desc: 'Acompanhamento do status de corte, dobra, solda, pintura e embalagem na palma da mão.' },
                                        { icon: Bell, title: 'Notificações Instantâneas de Faturamento', desc: 'Alertas automáticos de liberação de pedidos, romaneios e notas fiscais geradas.' },
                                        { icon: Box, title: 'Download de Dossiês & Laudos SGQ', desc: 'Acesso imediato aos certificados de qualidade da SIM Consultoria e relatórios rastreáveis.' }
                                    ].map((f, idx) => (
                                        <div key={idx} className="flex items-start gap-4 p-3.5 rounded-xl bg-[#23302C]/70 border border-[#6F7170]/30 backdrop-blur-sm">
                                            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#425750]/40 border border-[#425750]/60 flex items-center justify-center text-[#E0E800] mt-0.5">
                                                <f.icon className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h4 className="text-white font-bold text-sm">{f.title}</h4>
                                                <p className="text-[#C2C5C3] text-xs mt-0.5 leading-relaxed">{f.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="lg:col-span-5 flex justify-center">
                                <div className="relative max-w-[320px] rounded-3xl p-3 bg-gradient-to-b from-[#32423D] to-[#1E2825] border-2 border-[#6F7170]/50 shadow-2xl">
                                    <div className="rounded-2xl overflow-hidden border border-[#6F7170]/30 shadow-inner">
                                        <img 
                                            src={sincoCelularImg} 
                                            alt="SINCO Mobile em Ação" 
                                            className="w-full h-auto object-cover filter contrast-105"
                                        />
                                    </div>
                                    <div className="text-center pt-3 pb-1">
                                        <span className="text-[11px] font-mono text-[#C2C5C3] font-semibold">
                                            SINCO Mobile — Interface Responsiva de Chão de Fábrica
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Technical Differentials */}
            <section id="diferenciais" className="py-20 bg-[#F4F3ED]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <h2 className="text-3xl font-extrabold text-[#32423D] tracking-tight mb-4">
                            Por que Escolher o SINCO da Lynx EMS Sistemas?
                        </h2>
                        <p className="text-[#556460] text-base">
                            Construído especificamente para os desafios da indústria metalmecânica e manufatura sob encomenda.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="p-8 rounded-2xl bg-white border border-[#6F7170]/20 shadow-xs hover:shadow-md transition-shadow">
                            <div className="w-12 h-12 rounded-xl bg-[#425750]/10 text-[#425750] flex items-center justify-center font-bold mb-6 border border-[#425750]/20">
                                <Database className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-bold text-[#32423D] mb-2">Integração Fluida com seu ERP</h3>
                            <p className="text-[#556460] text-sm leading-relaxed">
                                Comunicação transparente e aberta com TOTVS, Omie, Sankhya e outros. O SINCO potencializa seu chão de fábrica e estrutura de projetos sem mexer na sua retaguarda fiscal e contábil.
                            </p>
                        </div>

                        <div className="p-8 rounded-2xl bg-white border border-[#6F7170]/20 shadow-xs hover:shadow-md transition-shadow">
                            <div className="w-12 h-12 rounded-xl bg-[#425750]/10 text-[#425750] flex items-center justify-center font-bold mb-6 border border-[#425750]/20">
                                <Zap className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-bold text-[#32423D] mb-2">Performance & Reatividade</h3>
                            <p className="text-[#556460] text-sm leading-relaxed">
                                Consultas em milissegundos sobre milhões de registros. Telas modernas, intuitivas e responsivas criadas para operadores de chão de fábrica e diretores corporativos.
                            </p>
                        </div>

                        <div className="p-8 rounded-2xl bg-white border border-[#6F7170]/20 shadow-xs hover:shadow-md transition-shadow">
                            <div className="w-12 h-12 rounded-xl bg-[#425750]/10 text-[#425750] flex items-center justify-center font-bold mb-6 border border-[#425750]/20">
                                <ShieldCheck className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-bold text-[#32423D] mb-2">Validação Industrial Estrita</h3>
                            <p className="text-[#556460] text-sm leading-relaxed">
                                Verificação automática de integridade referencial, bloqueio de saldos insuficientes, cálculo preciso de BOM e validação cadastral Módulo 11 de CNPJ e CPF.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Corporate Information, Contact & Footer */}
            <footer id="contato" className="bg-[#1E2825] text-[#C2C5C3] py-16 border-t border-[#6F7170]/30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Top Institutional Contact Card */}
                    <div className="bg-[#24312D] border border-[#6F7170]/40 rounded-3xl p-6 sm:p-10 mb-14 shadow-xl">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                            <div className="lg:col-span-7 space-y-3">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#425750]/40 border border-[#6F7170]/40 text-[#E0E800] text-xs font-bold uppercase tracking-wider">
                                    <Building className="w-3.5 h-3.5" />
                                    Dados Corporativos & Contato Direto
                                </div>
                                <h3 className="text-2xl sm:text-3xl font-black text-white">
                                    LYNX SOLUÇÕES E SISTEMAS LTDA - ME
                                </h3>
                                <p className="text-sm text-[#D8DCDA] leading-relaxed">
                                    Especialistas em desenvolvimento de software e inteligência de processos para a indústria nacional. Fundada em <strong>28/04/2021</strong> em Belo Horizonte / MG, com mais de 5 anos de sólida atuação fabril.
                                </p>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs font-medium text-[#F9F8F3]">
                                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#1E2825]/60 border border-[#6F7170]/30">
                                        <Building className="w-4 h-4 text-[#E0E800] flex-shrink-0" />
                                        <span>CNPJ: <strong>41.738.681/0001-77</strong></span>
                                    </div>
                                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#1E2825]/60 border border-[#6F7170]/30">
                                        <MapPin className="w-4 h-4 text-[#E0E800] flex-shrink-0" />
                                        <span>Sede: <strong>Belo Horizonte — MG</strong></span>
                                    </div>
                                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#1E2825]/60 border border-[#6F7170]/30">
                                        <Calendar className="w-4 h-4 text-[#E0E800] flex-shrink-0" />
                                        <span>Fundação: <strong>28/04/2021 (5+ anos)</strong></span>
                                    </div>
                                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#1E2825]/60 border border-[#6F7170]/30">
                                        <ShieldCheck className="w-4 h-4 text-[#E0E800] flex-shrink-0" />
                                        <span>Razão: <strong>EMS Soluções e Sistemas</strong></span>
                                    </div>
                                </div>
                            </div>

                            <div className="lg:col-span-5 bg-[#1E2825] p-6 rounded-2xl border border-[#6F7170]/40 space-y-4">
                                <h4 className="text-white text-sm font-bold uppercase tracking-wider">
                                    Fale Diretamente com Nossa Equipe
                                </h4>

                                <a 
                                    href="mailto:edson@lynxems.com.br" 
                                    className="flex items-center justify-between p-3.5 rounded-xl bg-[#24312D] hover:bg-[#32423D] border border-[#6F7170]/40 text-[#F9F8F3] hover:text-white transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-[#425750] text-white flex items-center justify-center">
                                            <Mail className="w-4 h-4 text-[#E0E800]" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-[#C2C5C3] uppercase tracking-wider block font-bold">E-mail Corporativo</span>
                                            <span className="text-sm font-bold">edson@lynxems.com.br</span>
                                        </div>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-[#C2C5C3] group-hover:text-white group-hover:translate-x-1 transition-all" />
                                </a>

                                <a 
                                    href="https://wa.me/5531995574906" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-between p-3.5 rounded-xl bg-[#24312D] hover:bg-[#32423D] border border-[#6F7170]/40 text-[#F9F8F3] hover:text-white transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-emerald-700 text-white flex items-center justify-center">
                                            <Phone className="w-4 h-4 text-white" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-[#C2C5C3] uppercase tracking-wider block font-bold">Telefone / WhatsApp</span>
                                            <span className="text-sm font-bold">(31) 99557-4906</span>
                                        </div>
                                    </div>
                                    <ExternalLink className="w-4 h-4 text-[#C2C5C3] group-hover:text-white transition-all" />
                                </a>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-10 pb-12 border-b border-[#6F7170]/30">
                        <div className="md:col-span-2 space-y-4">
                            <div className="flex items-center gap-3">
                                <img 
                                    src={lynxIconSnow} 
                                    alt="Lynx SM Icon" 
                                    className="h-10 w-10 rounded-xl object-contain p-1 bg-[#24312D] border border-[#6F7170]/40" 
                                />
                                <div>
                                    <img 
                                        src={lynxLogoSnow} 
                                        alt="Lynx SM" 
                                        className="h-6 w-auto object-contain" 
                                    />
                                    <span className="text-[11px] text-[#C2C5C3] font-medium block">
                                        SINCO Industrial Suite — Lynx EMS Sistemas
                                    </span>
                                </div>
                            </div>
                            <p className="text-xs text-[#C2C5C3] max-w-md leading-relaxed">
                                Plataforma integrada de alta performance para manufatura moderna. Conectando engenharia, PCP, qualidade e logística sob uma arquitetura digital inteligente.
                            </p>
                            <div className="text-[11px] text-[#C2C5C3] font-mono">
                                Lynx EMS Sistemas — Soluções Tecnológicas Industriais
                            </div>
                        </div>

                        {/* Co-Branding Partner SIM Consultoria */}
                        <div className="bg-[#24312D] p-5 rounded-2xl border border-[#6F7170]/40 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-3 mb-3">
                                    <img 
                                        src={simLogo} 
                                        alt="SIM Consultoria" 
                                        className="h-10 w-10 rounded-xl object-contain bg-white p-1 border border-slate-700 shadow-sm" 
                                    />
                                    <div>
                                        <span className="text-[10px] uppercase tracking-wider text-[#E0E800] font-bold block">
                                            Parceiro em Qualidade
                                        </span>
                                        <h5 className="text-white font-extrabold text-sm leading-tight">SIM Consultoria</h5>
                                        <span className="text-[11px] text-[#C2C5C3] font-medium">17 Anos de História</span>
                                    </div>
                                </div>
                                <p className="text-xs text-[#C2C5C3] leading-relaxed mb-4">
                                    Especialista em Gestão da Qualidade, transformando conceitos normativos em resultados reais.
                                </p>
                            </div>
                            <a 
                                href="https://www.instagram.com/sim.consultoria/" 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="inline-flex items-center justify-between px-3 py-2 rounded-xl bg-[#425750]/30 hover:bg-[#425750]/50 border border-[#425750]/50 text-[#F9F8F3] hover:text-white text-xs font-bold transition-all"
                            >
                                <span>@sim.consultoria</span>
                                <ExternalLink className="w-3.5 h-3.5 text-[#E0E800]" />
                            </a>
                        </div>

                        <div>
                            <h4 className="text-white text-xs font-bold uppercase tracking-wider mb-4">
                                Módulos Principais
                            </h4>
                            <ul className="space-y-2.5 text-xs text-[#C2C5C3]">
                                <li><a href="#modulos" className="hover:text-white transition-colors">PCP & Chão de Fábrica</a></li>
                                <li><a href="#modulos" className="hover:text-white transition-colors">SINCO ERP Nativo</a></li>
                                <li><a href="#modulos" className="hover:text-white transition-colors">Engenharia & BOM</a></li>
                                <li><a href="#parceria-sgq" className="hover:text-[#E0E800] transition-colors">Qualidade Total SGQ (SIM)</a></li>
                                <li><a href="#modulos" className="hover:text-white transition-colors">IA Hermes & OCR</a></li>
                                <li><a href="#modulos" className="hover:text-white transition-colors">Logística & VMI</a></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="text-white text-xs font-bold uppercase tracking-wider mb-4">
                                Acesso Rápido
                            </h4>
                            <ul className="space-y-2.5 text-xs text-[#C2C5C3]">
                                <li><Link to="/login" className="hover:text-white transition-colors font-bold text-[#E0E800]">Acessar Sistema</Link></li>
                                <li><a href="#clientes" className="hover:text-white transition-colors">Principais Clientes</a></li>
                                <li><a href="#portal-cliente" className="hover:text-white transition-colors">Canal do Cliente</a></li>
                                <li><a href="#parceria-sgq" className="hover:text-white transition-colors">Parceria SGQ</a></li>
                                <li><a href="#plataforma" className="hover:text-white transition-colors">Visão da Plataforma</a></li>
                                <li><a href="#contato" className="hover:text-white transition-colors">Dados Corporativos</a></li>
                            </ul>
                        </div>
                    </div>

                    <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#6F7170]">
                        <p>© {new Date().getFullYear()} LYNX SOLUÇÕES E SISTEMAS LTDA - ME. Todos os direitos reservados.</p>
                        <p className="font-mono text-[#C2C5C3]">SINCO Industrial Suite — Versão 4.2 Protheus-Decoupled</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
