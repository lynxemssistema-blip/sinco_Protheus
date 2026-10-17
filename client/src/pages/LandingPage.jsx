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
    MessageCircle,
    Download,
    FileText,
    Presentation,
    FileCheck,
    GitBranch,
    HelpCircle,
    Maximize2
} from 'lucide-react';

import flowchartImg from '../assets/fluxograma_processo_sinco.jpg';

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
            id: 'lynx',
            name: 'Lynx',
            segment: 'Metalmecânica & Corte Laser CNC',
            desc: 'Caldeiraria fina de ponta, corte a laser CNC de alta velocidade, conformação robotizada e solda certificada com controle operacional 100% digital via SINCO.',
            logo: metalfisaLogo,
            link: 'https://lynxems.com.br/',
            instagram: 'https://www.instagram.com/lynxems/',
            instagramHandle: '@lynxems',
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
            category: 'Gestão de Equipamentos (Manutenção e Calibração)',
            partner: 'SIM Consultoria',
            partnerLogo: simLogo,
            partnerLink: 'https://www.instagram.com/sim.consultoria/',
            desc: 'Gestão completa do Sistema de Gestão da Qualidade industrial estruturado em parceria com a SIM Consultoria (18 anos de excelência). Atendimento rigoroso aos requisitos das Normas ISO 9001, ISO 14001 e ISO 45001, análise de riscos organizacionais, gestão documental e inspeções de processo.',
            image: sgqQualityImage,
            badge: 'Parceria SIM Consultoria',
            stats: '18 Anos de Excelência',
            highlights: [
                'Atendimento e cumprimento dos requisitos segundo as Normas ISO 9001, ISO 14001 e ISO 45001',
                'Inspeções de Qualidade junto ao processo da operação (chão de fábrica) em etapas importantes',
                'Gestão de equipamentos (manutenção e calibração periódica)',
                'Análise de riscos operacionais e estratégicos na gestão organizacional',
                'Análise do direcionamento estratégico da organização',
                'Gestão documental de procedimentos, instruções de trabalho, registros, etc.',
                'Gestão de Objetivos do Sistema de Gestão, Metas e Indicadores',
                'Gestão de mudanças e tratativa sistemática de RNCs com causa raiz',
                'Metodologia homologada e apoiada pela SIM Consultoria (18 anos de história)'
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
            title: 'Logística & Expedição',
            category: 'Cadeia de Suprimentos & Expedição Ágil',
            desc: 'Gestão estratégica de estoque, conferência digital de expedição, montagem de romaneios inteligentes e emissão de listas de carga rastreáveis.',
            image: logisticsVmiImage,
            badge: 'Expedição Conectada',
            stats: 'Zero Divergência',
            highlights: [
                'Monitoramento em tempo real dos fluxos de expedição e entregas em carteira',
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
                        {/* Brand Identity & Co-Branding Lockup (Lynx & SIM em Destaque) */}
                        <div className="flex items-center gap-2.5 sm:gap-3.5">
                            {/* Official Lynx Brandmark */}
                            <a href="#" className="flex items-center group" title="Lynx EMS Sistemas">
                                <img 
                                    src={lynxLogoForest} 
                                    alt="Lynx EMS" 
                                    className="h-8 sm:h-9 w-auto object-contain transition-transform group-hover:scale-105 drop-shadow-2xs" 
                                />
                            </a>

                            {/* Aliança Connector */}
                            <span className="text-[#6F7170]/40 font-bold text-xs sm:text-sm select-none">✕</span>

                            {/* Strategic Partner: SIM Consultoria (Visível e com destaque em desktop e tablet) */}
                            <a 
                                href="https://www.instagram.com/sim.consultoria/" 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-[#425750] shadow-xs group transition-all" 
                                title="SIM Consultoria - 18 Anos de Excelência em SGQ"
                            >
                                <img 
                                    src={simLogo} 
                                    alt="SIM Consultoria" 
                                    className="h-6 sm:h-7 w-auto object-contain" 
                                />
                                <div className="hidden sm:flex flex-col text-left">
                                    <span className="text-[10px] font-black text-[#32423D] leading-tight">
                                        SIM Consultoria
                                    </span>
                                    <span className="text-[8px] font-bold text-[#425750] tracking-wider uppercase">
                                        18 Anos SGQ
                                    </span>
                                </div>
                            </a>

                            <span className="hidden lg:inline text-[#6F7170]/30 font-light text-lg select-none">|</span>

                            {/* Product Brand: SINCO Suite */}
                            <div className="hidden lg:flex items-center gap-1.5">
                                <span className="text-xl font-black tracking-tight text-[#32423D]">
                                    SINCO
                                </span>
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-[#425750] text-white tracking-wider shadow-2xs">
                                    Suite
                                </span>
                            </div>
                        </div>
                        
                        {/* Desktop Navigation Links (Clean, uniform text links with generous breathing room) */}
                        <div className="hidden xl:flex items-center gap-6">
                            <a href="#modulos" className="text-sm font-semibold text-[#32423D] hover:text-[#425750] transition-colors">
                                Módulos
                            </a>
                            <Link 
                                to="/ajuda?tab=fluxograma" 
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-xs font-black text-amber-950 transition-all shadow-2xs group hover:scale-105"
                                title="A Verdade do Processo: Fluxograma Operacional"
                            >
                                <GitBranch className="w-3.5 h-3.5 text-amber-600 group-hover:rotate-12 transition-transform" />
                                <span>Fluxograma do Processo</span>
                                <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[9px] font-black uppercase tracking-wider">
                                    Verdade do App
                                </span>
                            </Link>
                            <a href="#clientes" className="text-sm font-semibold text-[#32423D] hover:text-[#425750] transition-colors flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5 text-[#425750]" />
                                <span>Clientes</span>
                            </a>
                            <a href="#parceria-sgq" className="text-sm font-semibold text-[#32423D] hover:text-[#425750] transition-colors flex items-center gap-1.5">
                                <Award className="w-3.5 h-3.5 text-[#425750]" />
                                <span>Aliança SGQ</span>
                            </a>
                            <a href="#dossie-apresentacao" className="text-sm font-semibold text-[#32423D] hover:text-[#425750] transition-colors flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-[#425750]" />
                                <span>Dossiê & Normas</span>
                            </a>
                            <Link to="/ajuda" className="text-sm font-semibold text-[#32423D] hover:text-[#425750] transition-colors flex items-center gap-1">
                                <HelpCircle className="w-3.5 h-3.5 text-[#425750]" />
                                <span>Ajuda</span>
                            </Link>
                        </div>

                        {/* CTA Button and Responsive Hamburger Toggle */}
                        <div className="flex items-center gap-2.5 sm:gap-3">
                            <Link 
                                to="/login?mode=register&tab=empresa" 
                                className="hidden md:flex items-center gap-2 bg-[#EAE8E0] hover:bg-white text-[#1E2825] px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all border border-[#6F7170]/40 shadow-xs hover:shadow-md transform hover:-translate-y-0.5 group"
                                title="Cadastrar sua empresa com 14 dias de teste grátis"
                            >
                                <Building2 className="w-4 h-4 text-[#425750] group-hover:scale-110 transition-transform" />
                                <span>Cadastrar Empresa</span>
                                <span className="bg-[#425750] text-[#E0E800] text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md tracking-wider">
                                    Grátis
                                </span>
                            </Link>

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
                        {/* Co-Branding Mobile Header em Destaque */}
                        <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 shadow-2xs mb-2">
                            <img src={lynxLogoForest} alt="Lynx EMS" className="h-7 w-auto object-contain" />
                            <span className="text-slate-400 font-bold text-xs">✕</span>
                            <div className="flex items-center gap-2">
                                <img src={simLogo} alt="SIM Consultoria" className="h-6 w-auto object-contain" />
                                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md">
                                    18 Anos
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-col space-y-2">
                            <Link 
                                to="/ajuda?tab=fluxograma" 
                                onClick={() => setMobileMenuOpen(false)}
                                className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-500/10 border border-amber-500/40 text-amber-950 font-black text-sm flex items-center justify-between shadow-xs"
                            >
                                <span className="flex items-center gap-2">
                                    <GitBranch className="w-4 h-4 text-amber-600" />
                                    Fluxograma do Processo (Verdade do App)
                                </span>
                                <span className="text-[10px] bg-amber-500 text-white font-black px-2 py-0.5 rounded-full uppercase">
                                    11 Etapas
                                </span>
                            </Link>
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
                                href="#dossie-apresentacao" 
                                onClick={() => setMobileMenuOpen(false)}
                                className="px-3 py-2 rounded-lg text-sm font-semibold text-[#32423D] hover:bg-[#EAE8E0] flex items-center justify-between"
                            >
                                <span className="flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-[#425750]" />
                                    Dossiê Técnico (PDF & PPTX)
                                </span>
                                <span className="text-[10px] bg-[#E0E800] text-[#1E2825] font-black px-2 py-0.5 rounded-full">14 Slides</span>
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
                                to="/login?mode=register&tab=empresa" 
                                onClick={() => setMobileMenuOpen(false)}
                                className="w-full flex items-center justify-center gap-2.5 bg-[#EAE8E0] hover:bg-white text-[#1E2825] p-3 rounded-xl font-black text-sm shadow-xs border border-[#6F7170]/40 transition-all"
                            >
                                <Building2 className="w-4 h-4 text-[#425750]" />
                                <span>Cadastrar Nova Empresa (14 Dias Grátis)</span>
                            </Link>

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
                        {/* Executive Co-Branding Master Showcase: Lynx & SIM com Alto Destaque */}
                        <div className="inline-flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 px-5 py-3.5 sm:px-8 sm:py-4 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl mb-8 transition-all hover:border-emerald-400/50">
                            {/* Logotipo Oficial Lynx EMS */}
                            <div className="flex items-center gap-2.5 sm:gap-3">
                                <img 
                                    src={lynxLogoSnow} 
                                    alt="Lynx EMS Sistemas" 
                                    className="h-8 sm:h-10 w-auto object-contain drop-shadow-md" 
                                />
                                <span className="hidden md:inline-block text-[11px] font-bold uppercase tracking-wider text-slate-300 border-l border-white/20 pl-3">
                                    Tecnologia & Sistemas
                                </span>
                            </div>

                            {/* Interconexão Visual */}
                            <div className="flex items-center gap-2 text-emerald-400 font-black text-sm">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-white/60">✕</span>
                            </div>

                            {/* Logotipo Oficial SIM Consultoria */}
                            <a 
                                href="https://www.instagram.com/sim.consultoria/" 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="flex items-center gap-3 bg-white px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl shadow-lg border border-slate-200 hover:scale-102 transition-transform"
                                title="Conhecer a SIM Consultoria"
                            >
                                <img 
                                    src={simLogo} 
                                    alt="SIM Consultoria" 
                                    className="h-7 sm:h-9 w-auto object-contain" 
                                />
                                <div className="text-left border-l border-slate-200 pl-2.5">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 block">
                                        Aliança Estratégica
                                    </span>
                                    <span className="text-xs font-bold text-slate-800 block leading-none mt-0.5">
                                        18 Anos em SGQ Fabril
                                    </span>
                                </div>
                            </a>
                        </div>

                        <div className="flex justify-center mb-6">
                            <Link 
                                to="/ajuda?tab=fluxograma" 
                                className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/20 via-amber-400/30 to-emerald-500/20 border border-amber-400/40 text-amber-300 text-xs sm:text-sm font-extrabold hover:scale-105 transition-all shadow-lg shadow-amber-950/40 group"
                            >
                                <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                                <span>A Verdade do Processo Industrial: Veja o Fluxograma Real (11 Etapas)</span>
                                <ArrowRight className="w-4 h-4 text-amber-400 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </div>

                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.15] mb-8">
                            A Inteligência Especializada para <br className="hidden sm:inline" />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F9F8F3] via-white to-[#E0E800]">
                                Chão de Fábrica e Estrutura de Projetos
                            </span>
                        </h1>

                        <p className="text-lg sm:text-xl text-[#D8DCDA] mb-10 leading-relaxed max-w-3xl mx-auto font-normal">
                            Desenvolvido pela <strong>Lynx SM</strong> em parceria estratégica com a <strong>SIM Consultoria</strong> (18 anos de excelência em SGQ), o <strong>SINCO</strong> é a suíte de alta precisão que atua no coração da sua manufatura. Conectando-se de forma nativa e transparente ao ERP que a sua indústria já utiliza — como <strong>TOTVS</strong>, <strong>Omie</strong>, <strong>Sankhya</strong> e outros —, o SINCO assume o controle técnico de <strong>estrutura de projetos (BOM)</strong>, <strong>apontamentos de produção em tempo real</strong>, <strong>gestão de equipamentos e calibração</strong> e <strong>qualidade fabril</strong>, potencializando sua operação sem alterar a rotina fiscal ou contábil já consolidada na sua empresa.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
                            <Link 
                                to="/login?mode=register&tab=empresa" 
                                className="w-full sm:w-auto flex items-center justify-center gap-3 bg-[#E0E800] hover:bg-[#c8cf00] text-[#1E2825] px-8 py-4 rounded-xl font-black text-base transition-all shadow-xl shadow-black/30 hover:shadow-2xl border border-[#E0E800] transform hover:-translate-y-0.5 group"
                            >
                                <Building2 className="w-5 h-5 text-[#1E2825] group-hover:scale-110 transition-transform" />
                                <span>Cadastrar Nova Empresa</span>
                                <span className="bg-[#1E2825] text-[#E0E800] text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ml-1">
                                    14 Dias Grátis
                                </span>
                            </Link>
                            <Link 
                                to="/ajuda?tab=fluxograma" 
                                className="w-full sm:w-auto flex items-center justify-center gap-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 px-7 py-4 rounded-xl font-black text-base transition-all shadow-xl shadow-amber-950/30 hover:shadow-2xl border border-amber-400/60 transform hover:-translate-y-0.5"
                            >
                                <GitBranch className="w-5 h-5 text-slate-950" />
                                <span>Ver Fluxograma do Processo</span>
                            </Link>
                            <Link 
                                to="/login" 
                                className="w-full sm:w-auto flex items-center justify-center gap-3 bg-[#425750] hover:bg-[#32423D] text-white px-8 py-4 rounded-xl font-bold text-base transition-all shadow-xl shadow-[#1E2825]/50 hover:shadow-2xl border border-[#425750] transform hover:-translate-y-0.5"
                            >
                                Iniciar Sessão
                                <ArrowRight className="w-5 h-5 text-[#E0E800]" />
                            </Link>
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

            {/* ── SEÇÃO DE DESTAQUE: A VERDADE DO PROCESSO INDUSTRIAL (FLUXOGRAMA & MATRIZ) ── */}
            <section id="fluxo-processo" className="py-20 sm:py-24 bg-gradient-to-b from-[#18221F] via-[#202C27] to-[#18221F] text-white relative overflow-hidden border-y border-[#6F7170]/30">
                <div className="absolute top-0 right-1/4 w-[500px] h-[300px] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />
                <div className="absolute bottom-0 left-1/4 w-[500px] h-[300px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-black uppercase tracking-wider mb-4 shadow-sm">
                            <Sparkles className="w-4 h-4 text-amber-400" />
                            A Verdade do Processo Fabril SINCO
                        </div>
                        <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight mb-5">
                            Do Tenant ao Faturamento: <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-white to-emerald-400">
                                A Arquitetura Real de Execução
                            </span>
                        </h2>
                        <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
                            No SINCO, nada é isolado ou fictício. Cada módulo é rigorosamente dependente do anterior em uma cadeia sincronizada de <strong>11 etapas reais</strong>: da parametrização básica ao apontamento em tablets e emissão da NF-e.
                        </p>
                    </div>

                    {/* 4 Blocos de Fases do Processo */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                        <div className="bg-slate-900/80 rounded-2xl p-6 border border-blue-500/30 shadow-xl flex flex-col justify-between hover:border-blue-400 transition-all group">
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <span className="px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 text-[11px] font-black uppercase tracking-wider border border-blue-500/30">
                                        Fase 01
                                    </span>
                                    <Building2 className="w-6 h-6 text-blue-400 group-hover:scale-110 transition-transform" />
                                </div>
                                <h3 className="text-lg font-bold text-white mb-2">Fundação & Governança</h3>
                                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                                    Isolamento estrito multi-tenant (IdEmpresa), perfis de acesso RBAC de chão de fábrica e armazéns/unidades de medida.
                                </p>
                            </div>
                            <div className="text-[11px] font-semibold text-blue-300 bg-blue-950/60 p-2.5 rounded-xl border border-blue-800/40">
                                Passos 01 ao 03 · Base do Banco
                            </div>
                        </div>

                        <div className="bg-slate-900/80 rounded-2xl p-6 border border-emerald-500/30 shadow-xl flex flex-col justify-between hover:border-emerald-400 transition-all group">
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-[11px] font-black uppercase tracking-wider border border-emerald-500/30">
                                        Fase 02
                                    </span>
                                    <Cpu className="w-6 h-6 text-emerald-400 group-hover:scale-110 transition-transform" />
                                </div>
                                <h3 className="text-lg font-bold text-white mb-2">Engenharia & Recursos</h3>
                                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                                    Cadastro de máquinas e bancadas, catálogo de matérias-primas (chapas/perfis), explosão da árvore BOM e roteiros sequenciais.
                                </p>
                            </div>
                            <div className="text-[11px] font-semibold text-emerald-300 bg-emerald-950/60 p-2.5 rounded-xl border border-emerald-800/40">
                                Passos 04 ao 07 · Engenharia & Rota
                            </div>
                        </div>

                        <div className="bg-slate-900/80 rounded-2xl p-6 border border-amber-500/30 shadow-xl flex flex-col justify-between hover:border-amber-400 transition-all group">
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 text-[11px] font-black uppercase tracking-wider border border-amber-500/30">
                                        Fase 03
                                    </span>
                                    <Calendar className="w-6 h-6 text-amber-400 group-hover:scale-110 transition-transform" />
                                </div>
                                <h3 className="text-lg font-bold text-white mb-2">Demanda & PCP</h3>
                                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                                    Carteira de pedidos de venda com prazos acordados, geração de OPs, balanceamento de Carga Máquina e Gantt fabril.
                                </p>
                            </div>
                            <div className="text-[11px] font-semibold text-amber-300 bg-amber-950/60 p-2.5 rounded-xl border border-amber-800/40">
                                Passos 08 e 09 · Planejamento PCP
                            </div>
                        </div>

                        <div className="bg-slate-900/80 rounded-2xl p-6 border border-teal-500/30 shadow-xl flex flex-col justify-between hover:border-teal-400 transition-all group">
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <span className="px-2.5 py-1 rounded-lg bg-teal-500/20 text-teal-300 text-[11px] font-black uppercase tracking-wider border border-teal-500/30">
                                        Fase 04
                                    </span>
                                    <Truck className="w-6 h-6 text-teal-400 group-hover:scale-110 transition-transform" />
                                </div>
                                <h3 className="text-lg font-bold text-white mb-2">Chão de Fábrica & NF-e</h3>
                                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                                    Apontamento vertical por operadores em tablets, gestão de qualidade SGQ/RNCs, montagem de romaneios de carga e auditoria de faturamento.
                                </p>
                            </div>
                            <div className="text-[11px] font-semibold text-teal-300 bg-teal-950/60 p-2.5 rounded-xl border border-teal-800/40">
                                Passos 10 e 11 · MES & Expedição
                            </div>
                        </div>
                    </div>

                    {/* Banner Interativo com Preview do Diagrama Visual e Ação */}
                    <div className="bg-slate-900/90 rounded-3xl p-6 sm:p-10 border border-amber-500/30 shadow-2xl relative overflow-hidden flex flex-col lg:flex-row items-center justify-between gap-8">
                        <div className="max-w-2xl">
                            <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-amber-400 mb-2">
                                <GitBranch className="w-4 h-4 text-amber-400" />
                                Central de Ajuda & Matriz de Dependências
                            </div>
                            <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-3">
                                Explore o Fluxograma Interativo em Alta Definição
                            </h3>
                            <p className="text-slate-300 text-sm leading-relaxed mb-6">
                                Na Central de Ajuda você tem acesso ao diagrama visual completo com zoom, matriz de impacto (o que acontece se você pular um passo), tabelas de dados reais associadas e botões diretos para cada tela do sistema.
                            </p>
                            <div className="flex flex-wrap items-center gap-3">
                                <Link
                                    to="/ajuda?tab=fluxograma"
                                    className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-sm shadow-xl shadow-amber-950/40 hover:shadow-2xl transition-all transform hover:-translate-y-0.5"
                                >
                                    <GitBranch className="w-4 h-4 text-slate-950" />
                                    <span>Acessar Fluxograma do Processo</span>
                                    <ArrowRight className="w-4 h-4 text-slate-950" />
                                </Link>
                                <Link
                                    to="/ajuda"
                                    className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 text-slate-200 hover:text-white font-bold text-sm transition-all"
                                >
                                    <HelpCircle className="w-4 h-4 text-slate-400" />
                                    <span>Central de Ajuda Completa</span>
                                </Link>
                            </div>
                        </div>

                        {/* Thumbnail clicável do Diagrama */}
                        <Link 
                            to="/ajuda?tab=fluxograma" 
                            className="relative group rounded-2xl overflow-hidden border-2 border-amber-500/40 shadow-2xl max-w-md w-full hover:border-amber-400 transition-all transform hover:scale-[1.02]"
                            title="Clique para abrir o Fluxograma em tamanho real"
                        >
                            <img 
                                src={flowchartImg} 
                                alt="Fluxograma Operacional do Processo SINCO" 
                                className="w-full h-auto object-cover max-h-64 filter brightness-90 group-hover:brightness-100 transition-all" 
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent flex items-end p-4">
                                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-black shadow-lg">
                                    <Maximize2 className="w-3.5 h-3.5" />
                                    Abrir Diagrama Interativo
                                </span>
                            </div>
                        </Link>
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
                                    SIM Consultoria (18 Anos de Excelência)
                                </span>
                            </h2>

                            {/* Official Quote & Bio */}
                            <div className="relative pl-6 border-l-2 border-[#E0E800]/70 my-6 bg-[#23302C]/60 p-5 rounded-r-2xl border-y border-r border-[#6F7170]/40 backdrop-blur-sm">
                                <p className="text-base sm:text-lg text-[#F9F8F3] font-normal leading-relaxed italic">
                                    "Há 18 anos, a Sim Consultoria nasceu com o propósito de transformar ideias em resultados, levando inovação, dedicação e compromisso para cada cliente. Nossa trajetória é marcada pela busca constante da excelência, sempre pautada em valores como ética, responsabilidade e profissionalismo."
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
                                        18 Anos de <br /> Excelência
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

            {/* Dossiê Técnico & Apresentação Executiva Oficial (PDF & PPTX Download) */}
            <section id="dossie-apresentacao" className="py-20 sm:py-24 bg-gradient-to-b from-[#151D1A] via-[#1E2825] to-[#151D1A] text-white relative overflow-hidden border-b border-[#6F7170]/30">
                {/* Background Ambient Glows */}
                <div className="absolute top-1/4 left-10 w-[500px] h-[350px] bg-[#425750]/20 rounded-full blur-[140px] pointer-events-none" />
                <div className="absolute bottom-10 right-10 w-[450px] h-[300px] bg-[#E0E800]/10 rounded-full blur-[130px] pointer-events-none" />

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="text-center max-w-4xl mx-auto mb-14">
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#425750]/40 border border-[#E0E800]/30 text-[#E0E800] text-xs font-bold uppercase tracking-wider mb-5 backdrop-blur-sm shadow-sm">
                            <FileCheck className="w-4 h-4 text-[#E0E800]" />
                            Dossiê Técnico Executivo & Diretrizes Normativas Oficiais
                        </div>

                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[1.15] mb-5">
                            Apresentação Técnica Completa: <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-[#F9F8F3] to-[#E0E800]">
                                SINCO Suite & SIM Consultoria (18 Anos)
                            </span>
                        </h2>

                        <p className="text-[#C6CFCB] text-sm sm:text-base lg:text-lg leading-relaxed max-w-3xl mx-auto font-normal">
                            Baixe o material institucional técnico (14 slides widescreen 16:9) estruturado segundo as normas internacionais <strong>ISO 9001</strong>, <strong>ISO 14001</strong>, <strong>ISO 45001</strong> e <strong>ABNT NBR ISO 37000</strong>. Disponível para download gratuito e imediato nos formatos <strong>PDF de Alta Resolução</strong> e <strong>PowerPoint (.pptx editável)</strong>.
                        </p>

                        {/* Normative Badges Grid */}
                        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 mt-8">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#24312D] border border-[#E0E800]/40 text-[#E0E800] text-xs font-mono font-bold">
                                ★ ISO 9001:2015 (Qualidade)
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#24312D] border border-emerald-500/40 text-emerald-400 text-xs font-mono font-bold">
                                ★ ISO 14001:2015 (Meio Ambiente)
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#24312D] border border-sky-500/40 text-sky-400 text-xs font-mono font-bold">
                                ★ ISO 45001:2018 (Saúde & Segurança)
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#24312D] border border-[#E0E800]/50 text-white text-xs font-mono font-bold shadow-xs">
                                ★ ABNT NBR ISO 37000:2021 (Governança)
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#24312D] border border-[#6F7170]/40 text-[#D8DCDA] text-xs font-medium">
                                Riscos (ISO 31000/FMEA)
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#24312D] border border-[#6F7170]/40 text-[#D8DCDA] text-xs font-medium">
                                Gestão de Mudanças (MOC)
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#24312D] border border-[#6F7170]/40 text-[#D8DCDA] text-xs font-medium">
                                Gestão Documental (7.5)
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#24312D] border border-[#6F7170]/40 text-[#D8DCDA] text-xs font-medium">
                                Inspeções Fabris & RNC 5W2H
                            </span>
                        </div>
                    </div>

                    {/* 2 Main Download Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-14">
                        {/* Card PDF */}
                        <div className="bg-gradient-to-b from-[#24312D] to-[#1E2825] border-2 border-[#E0E800]/40 hover:border-[#E0E800] rounded-3xl p-7 sm:p-8 shadow-2xl transition-all duration-300 flex flex-col justify-between group">
                            <div>
                                <div className="flex items-center justify-between gap-4 mb-6">
                                    <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 group-hover:scale-105 transition-transform shadow-inner">
                                        <FileText className="w-7 h-7 text-red-400" />
                                    </div>
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-[#E0E800]/15 text-[#E0E800] border border-[#E0E800]/30 font-mono">
                                        PDF 16:9 • Ultra HD
                                    </span>
                                </div>

                                <h3 className="text-xl sm:text-2xl font-black text-white mb-2 group-hover:text-[#E0E800] transition-colors">
                                    Apresentação Executiva (PDF)
                                </h3>

                                <p className="text-xs sm:text-sm text-[#C6CFCB] leading-relaxed mb-6">
                                    Documento técnico oficial em alta resolução pronto para impressão executiva, auditorias e envio formal para diretorias industriais e comitês de SGQ.
                                </p>

                                <ul className="space-y-2 mb-8 border-t border-[#6F7170]/30 pt-4 text-xs text-[#D8DCDA]">
                                    <li className="flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-[#E0E800] flex-shrink-0" />
                                        <span><strong>14 Slides Completos:</strong> Arquitetura, Chão de Fábrica, PCP, BOM e SGQ</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-[#E0E800] flex-shrink-0" />
                                        <span><strong>Normas Detalhadas:</strong> ISO 9001, ISO 14001, ISO 45001 e NBR 37000</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-[#E0E800] flex-shrink-0" />
                                        <span><strong>Tamanho:</strong> ~7.6 MB • Visualização nítida em qualquer dispositivo</span>
                                    </li>
                                </ul>
                            </div>

                            <div className="space-y-3">
                                <a 
                                    href="/SINCO_Apresentacao_Executiva_Lynx_SIM.pdf"
                                    download="SINCO_Apresentacao_Executiva_Lynx_SIM.pdf"
                                    className="w-full inline-flex items-center justify-center gap-2.5 bg-[#E0E800] hover:bg-[#c8d200] text-[#1E2825] font-black text-sm px-6 py-3.5 rounded-xl transition-all shadow-lg shadow-[#E0E800]/20 hover:shadow-xl hover:shadow-[#E0E800]/30 transform active:scale-98"
                                >
                                    <Download className="w-4 h-4 text-[#1E2825]" />
                                    <span>Baixar Apresentação em PDF</span>
                                </a>

                                <a 
                                    href="/SINCO_Apresentacao_Executiva_Lynx_SIM.pdf"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full inline-flex items-center justify-center gap-2 bg-[#2E3D37] hover:bg-[#384A43] text-white font-semibold text-xs px-4 py-2.5 rounded-xl border border-[#6F7170]/40 transition-colors"
                                >
                                    <span>Visualizar no Navegador</span>
                                    <ExternalLink className="w-3.5 h-3.5 text-[#C6CFCB]" />
                                </a>
                            </div>
                        </div>

                        {/* Card PPTX */}
                        <div className="bg-gradient-to-b from-[#24312D] to-[#1E2825] border-2 border-emerald-500/40 hover:border-emerald-400 rounded-3xl p-7 sm:p-8 shadow-2xl transition-all duration-300 flex flex-col justify-between group">
                            <div>
                                <div className="flex items-center justify-between gap-4 mb-6">
                                    <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 group-hover:scale-105 transition-transform shadow-inner">
                                        <Presentation className="w-7 h-7 text-orange-400" />
                                    </div>
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono">
                                        PPTX 16:9 • 100% Editável
                                    </span>
                                </div>

                                <h3 className="text-xl sm:text-2xl font-black text-white mb-2 group-hover:text-emerald-400 transition-colors">
                                    Apresentação PowerPoint (.pptx)
                                </h3>

                                <p className="text-xs sm:text-sm text-[#C6CFCB] leading-relaxed mb-6">
                                    Apresentação em slides editáveis desenvolvida com identidade visual industrial oficial, perfeita para reuniões de conselho, investidores e treinamentos de chão de fábrica.
                                </p>

                                <ul className="space-y-2 mb-8 border-t border-[#6F7170]/30 pt-4 text-xs text-[#D8DCDA]">
                                    <li className="flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                        <span><strong>14 Slides Editáveis:</strong> Textos, cartões, dados técnicos e métricas</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                        <span><strong>Compatibilidade Total:</strong> Microsoft PowerPoint, Google Slides e Keynote</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                        <span><strong>Tamanho:</strong> ~4.3 MB • Imagens integradas e diagramação profissional</span>
                                    </li>
                                </ul>
                            </div>

                            <div className="space-y-3">
                                <a 
                                    href="/SINCO_Apresentacao_Executiva_Lynx_SIM.pptx"
                                    download="SINCO_Apresentacao_Executiva_Lynx_SIM.pptx"
                                    className="w-full inline-flex items-center justify-center gap-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm px-6 py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:shadow-emerald-500/30 transform active:scale-98"
                                >
                                    <Download className="w-4 h-4 text-white" />
                                    <span>Baixar Apresentação (.pptx)</span>
                                </a>

                                <div className="text-center">
                                    <span className="text-[11px] text-[#A0A8A4] font-medium">
                                        Arquivo aberto para customização da sua marca e equipe
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Breakdown Bar (14 Slides Map) */}
                    <div className="bg-[#1E2825]/90 border border-[#6F7170]/40 rounded-2xl p-6 backdrop-blur-md">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-[#6F7170]/30">
                            <span className="text-xs font-bold uppercase tracking-wider text-[#E0E800] flex items-center gap-2">
                                <Layers className="w-4 h-4" />
                                Conteúdo Programático dos 14 Slides do Dossiê
                            </span>
                            <span className="text-xs font-mono text-[#A0A8A4]">
                                Lynx EMS Sistemas ✕ SIM Consultoria (18 Anos)
                            </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 text-[11px] text-[#C6CFCB]">
                            <div className="p-2 rounded-lg bg-[#24312D]/80 border border-[#6F7170]/20"><strong className="text-white block font-mono text-[10px] text-[#E0E800]">SLIDE 01</strong> Capa Executiva</div>
                            <div className="p-2 rounded-lg bg-[#24312D]/80 border border-[#6F7170]/20"><strong className="text-white block font-mono text-[10px] text-[#E0E800]">SLIDE 02</strong> ERP vs SINCO</div>
                            <div className="p-2 rounded-lg bg-[#24312D]/80 border border-[#6F7170]/20"><strong className="text-white block font-mono text-[10px] text-[#E0E800]">SLIDE 03</strong> Cockpit 360° OEE</div>
                            <div className="p-2 rounded-lg bg-[#24312D]/80 border border-[#6F7170]/20"><strong className="text-white block font-mono text-[10px] text-[#E0E800]">SLIDE 04</strong> PCP no Posto</div>
                            <div className="p-2 rounded-lg bg-[#24312D]/80 border border-[#6F7170]/20"><strong className="text-white block font-mono text-[10px] text-[#E0E800]">SLIDE 05</strong> Engenharia & BOM</div>
                            <div className="p-2 rounded-lg bg-[#24312D]/80 border border-[#6F7170]/20"><strong className="text-white block font-mono text-[10px] text-[#E0E800]">SLIDE 06</strong> NBR ISO 37000</div>
                            <div className="p-2 rounded-lg bg-[#24312D]/80 border border-[#6F7170]/20"><strong className="text-white block font-mono text-[10px] text-[#E0E800]">SLIDE 07</strong> ISO 9001/14001/45001</div>
                            <div className="p-2 rounded-lg bg-[#24312D]/80 border border-[#6F7170]/20"><strong className="text-white block font-mono text-[10px] text-[#E0E800]">SLIDE 08</strong> Riscos & Mudança</div>
                            <div className="p-2 rounded-lg bg-[#24312D]/80 border border-[#6F7170]/20"><strong className="text-white block font-mono text-[10px] text-[#E0E800]">SLIDE 09</strong> Gestão Documental</div>
                            <div className="p-2 rounded-lg bg-[#24312D]/80 border border-[#6F7170]/20"><strong className="text-white block font-mono text-[10px] text-[#E0E800]">SLIDE 10</strong> Inspeções Fabris</div>
                            <div className="p-2 rounded-lg bg-[#24312D]/80 border border-[#6F7170]/20"><strong className="text-white block font-mono text-[10px] text-[#E0E800]">SLIDE 11</strong> IA Hermes OCR</div>
                            <div className="p-2 rounded-lg bg-[#24312D]/80 border border-[#6F7170]/20"><strong className="text-white block font-mono text-[10px] text-[#E0E800]">SLIDE 12</strong> Logística & Expedição</div>
                            <div className="p-2 rounded-lg bg-[#24312D]/80 border border-[#6F7170]/20"><strong className="text-white block font-mono text-[10px] text-[#E0E800]">SLIDE 13</strong> Clientes Reais</div>
                            <div className="p-2 rounded-lg bg-[#24312D]/80 border border-[#6F7170]/20"><strong className="text-white block font-mono text-[10px] text-[#E0E800]">SLIDE 14</strong> Demonstração</div>
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
                                        <span className="text-[11px] text-[#C2C5C3] font-medium">18 Anos de História</span>
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
                                <li><a href="#dossie-apresentacao" className="hover:text-[#E0E800] transition-colors font-bold flex items-center gap-1.5"><Download className="w-3.5 h-3.5 text-[#E0E800]" /> Dossiê Técnico (PDF & PPTX)</a></li>
                                <li><a href="#modulos" className="hover:text-white transition-colors">IA Hermes & OCR</a></li>
                                <li><a href="#modulos" className="hover:text-white transition-colors">Logística & Expedição</a></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="text-white text-xs font-bold uppercase tracking-wider mb-4">
                                Acesso Rápido
                            </h4>
                            <ul className="space-y-2.5 text-xs text-[#C2C5C3]">
                                <li><Link to="/ajuda?tab=fluxograma" className="hover:text-amber-300 transition-colors font-black text-amber-400 flex items-center gap-1.5"><GitBranch className="w-3.5 h-3.5 text-amber-400" /> Fluxograma do Processo</Link></li>
                                <li><Link to="/ajuda" className="hover:text-white transition-colors flex items-center gap-1.5"><HelpCircle className="w-3.5 h-3.5 text-[#E0E800]" /> Central de Ajuda & Guia</Link></li>
                                <li><Link to="/login" className="hover:text-white transition-colors font-bold text-[#E0E800]">Acessar Sistema</Link></li>
                                <li><a href="#dossie-apresentacao" className="hover:text-white transition-colors">Baixar Apresentação</a></li>
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
