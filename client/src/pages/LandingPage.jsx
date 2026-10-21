import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
    ArrowRight, 
    ShieldCheck, 
    Cpu, 
    Zap, 
    Activity, 
    CheckCircle2, 
    Layers, 
    Truck, 
    Sparkles, 
    Award, 
    ExternalLink, 
    Building2, 
    Menu, 
    X, 
    FileText, 
    GitBranch, 
    HelpCircle, 
    AlertTriangle,
    ClipboardList,
    Smartphone,
    Download,
    Factory,
    Crosshair,
    Maximize2
} from 'lucide-react';

// Brand Assets - Official Lynx SM & SIM Consultoria
import lynxLogoSnow from '../assets/brand-lynx/LOGOTIPO SNOW.svg';
import lynxLogoForest from '../assets/brand-lynx/LOGOTIPO FOREST.svg';
import simLogo from '../assets/sim-consultoria-logo.png';
import sincoCelularImg from '../assets/brand-lynx/SINCO- CELULAR 01.png';

// Section Graphic Assets
import heroBanner from '../assets/sinco-hero-banner.jpg';
import dashboardMockup from '../assets/sinco-dashboard-mockup.jpg';
import geralDoGalpaoImg from '../assets/geral-do-galpao.jpg';

// Client Logos
import amcLogo from '../assets/client-amc-logo.png';
import mettaLogo from '../assets/client-metta-logo.png';
import alfatecLogo from '../assets/client-alfatec-logo.png';
import metalfisaLogo from '../assets/metalfisa-logo.png';
import flrLogo from '../assets/client-flr-logo.png';

export default function LandingPage() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [photoModalOpen, setPhotoModalOpen] = useState(false);

    // Clientes reais do ecossistema SINCO
    const clients = [
        {
            name: 'AMC Soluções em Energia',
            segment: 'Subestações até 500kV & Eletrocentros',
            desc: 'Soluções completas de alta tensão, skids móveis e cubículos Schneider Electric SM6 integrados.',
            logo: amcLogo,
            link: 'https://amcsolucoes.com.br/sm6/'
        },
        {
            name: 'Metta Indústria',
            segment: 'Soluções Elétricas & Painéis MT',
            desc: 'Painéis elétricos industriais certificados de baixa e média tensão para usinas e plantas industriais.',
            logo: mettaLogo,
            link: 'https://metta.ind.br/'
        },
        {
            name: 'Alfatec Cozinhas Profissionais',
            segment: 'Aço Inox & Foodservice Industrial',
            desc: 'Manufatura de equipamentos profissionais em aço inox para redes de hotéis, hospitais e gastronomia.',
            logo: alfatecLogo,
            link: 'https://www.alfatecozinhas.com.br/'
        },
        {
            name: 'Lynx',
            segment: 'Metalmecânica & Corte Laser CNC',
            desc: 'Caldeiraria fina, corte a laser CNC de alta velocidade, conformação robotizada e solda certificada.',
            logo: metalfisaLogo,
            link: 'https://lynxems.com.br/'
        },
        {
            name: 'FLR Instalações',
            segment: 'Engenharia Elétrica & Chicotes Pré-Fabricados',
            desc: 'Kits pré-fabricados sob medida para grandes obras residenciais e industriais, padrão NBR 5410/5626.',
            logo: flrLogo,
            link: 'https://flrinstalacoes.lynxems.com.br/'
        }
    ];

    return (
        <div className="min-h-screen bg-[#0F1614] font-sans overflow-x-hidden text-slate-100 selection:bg-emerald-500 selection:text-slate-950">
            {/* ══════════════════════════════════════════════════════════════
                NAVBAR COMPACTA & ELEGANTE
            ══════════════════════════════════════════════════════════════ */}
            <nav className="fixed w-full z-50 bg-[#0F1614]/90 backdrop-blur-md border-b border-white/10 transition-all">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-18 items-center">
                        {/* Identidade Visual Co-Branded: SINCO + Lynx + SIM */}
                        <div className="flex items-center gap-3">
                            <a href="#" className="flex items-center gap-2 group">
                                <span className="text-xl sm:text-2xl font-black tracking-tight text-white group-hover:text-emerald-400 transition-colors">
                                    SINCO
                                </span>
                                <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 tracking-widest">
                                    Suite 4.0
                                </span>
                            </a>

                            <div className="hidden sm:flex items-center gap-2.5 pl-3 border-l border-white/15">
                                <img 
                                    src={lynxLogoSnow} 
                                    alt="Lynx EMS Sistemas" 
                                    className="h-5 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity" 
                                    title="Desenvolvido por Lynx EMS"
                                />
                                <span className="text-white/30 text-xs font-light">✕</span>
                                <a 
                                    href="https://www.instagram.com/sim.consultoria/" 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="flex items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity"
                                    title="SIM Consultoria - 18 Anos em SGQ Fabril"
                                >
                                    <img 
                                        src={simLogo} 
                                        alt="SIM Consultoria" 
                                        className="h-5 w-auto object-contain" 
                                    />
                                    <span className="hidden md:inline text-[9px] font-semibold text-emerald-400 uppercase tracking-wider">
                                        18 Anos SGQ
                                    </span>
                                </a>
                            </div>
                        </div>

                        {/* Links de Navegação Rápidos */}
                        <div className="hidden lg:flex items-center gap-7 text-xs font-semibold text-slate-300">
                            <a href="#dores" className="hover:text-emerald-400 transition-colors">
                                As 3 Dores da Indústria
                            </a>
                            <a href="#fluxo" className="hover:text-emerald-400 transition-colors">
                                Como Funciona
                            </a>
                            <a href="#qualidade-sgq" className="hover:text-emerald-400 transition-colors">
                                Qualidade & SGQ
                            </a>
                            <a href="#clientes" className="hover:text-emerald-400 transition-colors">
                                Clientes
                            </a>
                            <Link 
                                to="/ajuda?tab=fluxograma" 
                                className="inline-flex items-center gap-1.5 text-amber-300 hover:text-amber-200 transition-colors font-bold"
                            >
                                <GitBranch className="w-3.5 h-3.5 text-amber-400" />
                                Fluxo 11 Etapas
                            </Link>
                        </div>

                        {/* Botões de Ação */}
                        <div className="hidden sm:flex items-center gap-3">
                            <Link 
                                to="/ajuda" 
                                className="text-xs font-semibold text-slate-300 hover:text-white px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5"
                            >
                                <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                                Central de Ajuda
                            </Link>
                            <Link 
                                to="/login" 
                                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl transition-all shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/30 flex items-center gap-1.5"
                            >
                                <span>Acessar Sistema</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                        </div>

                        {/* Mobile Menu Trigger */}
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="lg:hidden p-2 text-slate-300 hover:text-white focus:outline-none"
                            aria-label="Abrir Menu"
                        >
                            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                    </div>
                </div>

                {/* Mobile Menu Drawer */}
                {mobileMenuOpen && (
                    <div className="lg:hidden bg-[#141E1B] border-b border-white/10 px-4 py-5 space-y-3 animate-fadeIn">
                        <a 
                            href="#dores" 
                            onClick={() => setMobileMenuOpen(false)}
                            className="block text-sm font-semibold text-slate-200 py-2 border-b border-white/5"
                        >
                            As 3 Dores da Indústria
                        </a>
                        <a 
                            href="#fluxo" 
                            onClick={() => setMobileMenuOpen(false)}
                            className="block text-sm font-semibold text-slate-200 py-2 border-b border-white/5"
                        >
                            Como Funciona na Prática
                        </a>
                        <a 
                            href="#qualidade-sgq" 
                            onClick={() => setMobileMenuOpen(false)}
                            className="block text-sm font-semibold text-slate-200 py-2 border-b border-white/5"
                        >
                            Qualidade Total & SGQ (SIM)
                        </a>
                        <a 
                            href="#clientes" 
                            onClick={() => setMobileMenuOpen(false)}
                            className="block text-sm font-semibold text-slate-200 py-2 border-b border-white/5"
                        >
                            Clientes Reais
                        </a>
                        <Link 
                            to="/ajuda?tab=fluxograma" 
                            onClick={() => setMobileMenuOpen(false)}
                            className="block text-sm font-bold text-amber-300 py-2"
                        >
                            Fluxograma de Processos (11 Etapas)
                        </Link>
                        <div className="pt-2 flex flex-col gap-2">
                            <Link 
                                to="/login" 
                                onClick={() => setMobileMenuOpen(false)}
                                className="w-full text-center bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm py-3 rounded-xl shadow-lg"
                            >
                                Acessar SINCO Suite
                            </Link>
                        </div>
                    </div>
                )}
            </nav>

            {/* ══════════════════════════════════════════════════════════════
                HERO SECTION — DIRETO À DOR DO EMPRESÁRIO INDUSTRIAL
            ══════════════════════════════════════════════════════════════ */}
            <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 overflow-hidden bg-gradient-to-b from-[#0F1614] via-[#16221E] to-[#0F1614]">
                {/* Background visual accents — Planta Industrial Real */}
                <div className="absolute inset-0 z-0 pointer-events-none">
                    <img 
                        src={geralDoGalpaoImg} 
                        alt="SINCO Industrial Background" 
                        className="w-full h-full object-cover opacity-20 filter brightness-70 contrast-125 saturate-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-[#0F1614] via-[#16221E]/90 to-[#0F1614]" />
                </div>
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />
                <div className="absolute bottom-10 right-10 w-[400px] h-[250px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="text-center max-w-4xl mx-auto">
                        {/* Badge de Destaque */}
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-black uppercase tracking-wider mb-6 shadow-sm">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                            O Fim do Caos Operacional no Chão de Fábrica
                        </div>

                        {/* Título Principal */}
                        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.12] mb-6">
                            Elimine o papel, o caos de desenhos desatualizados e as perdas na sua indústria.
                        </h1>

                        {/* Subtítulo Objetivo */}
                        <p className="text-base sm:text-lg lg:text-xl text-slate-300 mb-9 leading-relaxed max-w-3xl mx-auto font-normal">
                            O <strong>SINCO</strong> é a suíte de manufatura desenvolvida pela <strong>Lynx EMS</strong> em parceria com a <strong>SIM Consultoria</strong> (18 anos em SGQ) para resolver o que realmente tira a margem da sua empresa: <span className="text-white font-semibold">apontamentos em tempo real na bancada</span>, <span className="text-white font-semibold">carimbo digital que impede a fabricação de versões antigas de projeto</span> e <span className="text-white font-semibold">rastreabilidade total para auditorias</span>.
                        </p>

                        {/* Botões de Ação Principais */}
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
                            <Link 
                                to="/login" 
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-8 py-4 rounded-xl font-black text-sm sm:text-base transition-all shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/30 transform hover:-translate-y-0.5 group"
                            >
                                <span>Acessar o Sistema</span>
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </Link>

                            <Link 
                                to="/ajuda?tab=fluxograma" 
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white px-7 py-4 rounded-xl font-bold text-sm sm:text-base transition-all border border-white/15 backdrop-blur-md"
                            >
                                <GitBranch className="w-4 h-4 text-amber-400" />
                                <span>Ver Fluxo Real do Processo</span>
                            </Link>

                            <Link 
                                to="/login?mode=register&tab=empresa" 
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#1A2522] hover:bg-[#23332F] text-emerald-300 px-6 py-4 rounded-xl font-bold text-sm border border-emerald-500/30 transition-all"
                            >
                                <Building2 className="w-4 h-4" />
                                <span>Cadastrar Empresa</span>
                            </Link>
                        </div>

                        {/* Barra de 4 Pilares Rápidos */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 p-5 rounded-2xl bg-[#141E1B]/80 border border-white/10 backdrop-blur-md shadow-2xl text-left">
                            <div className="p-3 border-r border-white/10 last:border-none">
                                <span className="block text-xl sm:text-2xl font-black text-emerald-400 tracking-tight">Sem Papel</span>
                                <span className="text-[11px] sm:text-xs text-slate-400 font-medium leading-tight block mt-0.5">
                                    Apontamento direto no tablet/celular por código de barras.
                                </span>
                            </div>
                            <div className="p-3 border-r border-white/10 last:border-none">
                                <span className="block text-xl sm:text-2xl font-black text-amber-400 tracking-tight">Zero Sucata</span>
                                <span className="text-[11px] sm:text-xs text-slate-400 font-medium leading-tight block mt-0.5">
                                    Carimbo digital bloqueia projetos e revisões antigas na máquina.
                                </span>
                            </div>
                            <div className="p-3 border-r border-white/10 last:border-none">
                                <span className="block text-xl sm:text-2xl font-black text-sky-400 tracking-tight">SGQ & Rastreio</span>
                                <span className="text-[11px] sm:text-xs text-slate-400 font-medium leading-tight block mt-0.5">
                                    Conformidade ISO 9001 e histórico de lote da matéria à NF.
                                </span>
                            </div>
                            <div className="p-3">
                                <span className="block text-xl sm:text-2xl font-black text-white tracking-tight">Tempo Real</span>
                                <span className="text-[11px] sm:text-xs text-slate-400 font-medium leading-tight block mt-0.5">
                                    Visão do chão de fábrica minuto a minuto, sem esperar o fim do dia.
                                </span>
                            </div>
                        </div>

                        {/* ──────────────────────────────────────────────────────
                            MOLDURA INDUSTRIAL DETALHISTA — VISTA GERAL DO GALPÃO
                        ────────────────────────────────────────────────────── */}
                        <div className="relative max-w-5xl mx-auto mt-12 sm:mt-14 text-left">
                            <div className="relative rounded-2xl p-2 sm:p-3 bg-gradient-to-b from-white/15 via-[#16221E]/95 to-black/60 border border-white/15 shadow-[0_25px_60px_rgba(0,0,0,0.65)] backdrop-blur-xl ring-1 ring-black/40">
                                
                                {/* Parafusos / Rebites Allen nos 4 cantos da moldura */}
                                <div className="absolute top-2.5 left-2.5 w-2.5 h-2.5 rounded-full bg-slate-700 border border-white/30 shadow-inner flex items-center justify-center pointer-events-none">
                                    <div className="w-1 h-1 rounded-sm bg-black/70" />
                                </div>
                                <div className="absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full bg-slate-700 border border-white/30 shadow-inner flex items-center justify-center pointer-events-none">
                                    <div className="w-1 h-1 rounded-sm bg-black/70" />
                                </div>
                                <div className="absolute bottom-2.5 left-2.5 w-2.5 h-2.5 rounded-full bg-slate-700 border border-white/30 shadow-inner flex items-center justify-center pointer-events-none">
                                    <div className="w-1 h-1 rounded-sm bg-black/70" />
                                </div>
                                <div className="absolute bottom-2.5 right-2.5 w-2.5 h-2.5 rounded-full bg-slate-700 border border-white/30 shadow-inner flex items-center justify-center pointer-events-none">
                                    <div className="w-1 h-1 rounded-sm bg-black/70" />
                                </div>

                                {/* Barra Superior da Moldura Industrial */}
                                <div className="flex items-center justify-between px-3 py-1.5 mb-2 bg-[#0F1614]/80 rounded-lg border border-white/5 text-[10px] sm:text-xs">
                                    <div className="flex items-center gap-2 text-slate-300 font-semibold tracking-wide">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                        </span>
                                        <span className="text-emerald-400 font-black tracking-wider uppercase">Chão de Fábrica Operacional</span>
                                        <span className="text-white/20 hidden sm:inline">|</span>
                                        <span className="text-slate-400 font-normal hidden sm:inline">Vista Panorâmica da Planta Industrial</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[10px]">
                                        <Crosshair className="w-3 h-3 text-emerald-400" />
                                        <span className="text-slate-300 font-bold uppercase tracking-wider hidden sm:inline">Centros CNC & Caldeiraria</span>
                                    </div>
                                </div>

                                {/* Canvas da Imagem com Tratamento Visual e Moldura Interna */}
                                <div 
                                    onClick={() => setPhotoModalOpen(true)}
                                    className="relative rounded-xl overflow-hidden border border-black/50 shadow-inner group bg-black/40 cursor-pointer"
                                    title="Clique para ampliar a vista do chão de fábrica"
                                >
                                    <img 
                                        src={geralDoGalpaoImg} 
                                        alt="Visão Geral do Galpão Industrial SINCO" 
                                        className="w-full h-56 sm:h-72 md:h-84 lg:h-96 object-cover object-center filter contrast-[1.04] brightness-[0.96] group-hover:scale-[1.02] transition-transform duration-700 ease-out"
                                        loading="eager"
                                    />
                                    
                                    {/* Vinheta sutil e degradê inferior para elegância discreta */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#0F1614]/85 via-transparent to-black/20 pointer-events-none" />

                                    {/* Hover Overlay com Botão de Ampliação */}
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                        <div className="px-4 py-2 rounded-xl bg-black/85 backdrop-blur-md border border-white/20 text-xs font-bold text-white flex items-center gap-2 shadow-2xl transform translate-y-2 group-hover:translate-y-0 transition-transform">
                                            <Maximize2 className="w-4 h-4 text-emerald-400" />
                                            <span>Ampliar Visão da Fábrica (Alta Resolução)</span>
                                        </div>
                                    </div>

                                    {/* Retículos sutis de engenharia nos cantos */}
                                    <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-black/60 backdrop-blur-md border border-white/10 text-[9px] font-mono text-slate-300 uppercase tracking-wider pointer-events-none">
                                        SEC-01 // FABRICAÇÃO & MONTAGEM
                                    </div>
                                    <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-emerald-500/30 text-[10px] font-mono text-emerald-300 font-bold flex items-center gap-1.5 pointer-events-none">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                        SINCO 4.0 INTEGRATED SHOPFLOOR
                                    </div>
                                </div>

                                {/* Barra de Rodapé Técnico da Moldura */}
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-3 pt-2.5 pb-0.5 text-[11px] text-slate-400">
                                    <div className="flex items-center gap-2">
                                        <Factory className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                        <span className="text-slate-300 text-xs font-medium">
                                            Instalações fabris em operação — Postos de corte laser CNC, usinagem e montagem conectados em tempo real.
                                        </span>
                                    </div>
                                    <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider shrink-0 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                        Planta Ativa
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                AS 3 GRANDES DORES QUE O SISTEMA RESOLVE (O CORAÇÃO DA PÁGINA)
            ══════════════════════════════════════════════════════════════ */}
            <section id="dores" className="py-20 bg-[#121B18] border-y border-white/10 relative">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-bold uppercase tracking-wider mb-4">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                            O Que Tira a Margem da Indústria
                        </div>
                        <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
                            As 3 Dores Críticas do Chão de Fábrica — Resolvidas na Raiz
                        </h2>
                        <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                            A maioria dos sistemas tradicionais foca em cadastros burocráticos. O SINCO atua diretamente onde o dinheiro da indústria é ganho ou perdido: <strong>na máquina, no posto de trabalho e na qualidade final</strong>.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Dor 1: Fim do Papel */}
                        <div className="bg-[#182420] rounded-2xl p-7 border border-white/10 hover:border-emerald-500/50 shadow-xl transition-all flex flex-col justify-between group">
                            <div>
                                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold mb-6 group-hover:scale-105 transition-transform">
                                    <ClipboardList className="w-6 h-6" />
                                </div>
                                <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400 block mb-2">
                                    Dor 01 · Chão de Fábrica
                                </span>
                                <h3 className="text-xl font-bold text-white mb-3">
                                    Fim das Pranchetas e Fichas Rasuradas
                                </h3>

                                <div className="p-3 rounded-xl bg-red-950/30 border border-red-800/30 text-xs text-red-200 mb-4 leading-relaxed">
                                    <strong>O Problema:</strong> Fichas de papel perdem-se, o operador rasura quantidades, o apontamento só é digitado no dia seguinte e ninguém sabe se o pedido atrasou até o cliente ligar cobrando.
                                </div>

                                <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/30 text-xs text-emerald-200 leading-relaxed">
                                    <strong>A Solução SINCO:</strong> Apontamento vertical direto no posto (corte, dobra, solda, pintura) por código de barras em tablets ou celulares. Saldo de OP, tempo de ciclo e setup calculados na hora.
                                </div>
                            </div>

                            <ul className="space-y-2 mt-6 pt-5 border-t border-white/10 text-xs text-slate-300 font-medium">
                                <li className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <span>Apontamento em segundos com leitor de código</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <span>Fila de prioridades clara por posto de trabalho</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <span>Elimina 100% da redigitação de planilhas</span>
                                </li>
                            </ul>
                        </div>

                        {/* Dor 2: Caos de Revisões */}
                        <div className="bg-[#182420] rounded-2xl p-7 border border-white/10 hover:border-emerald-500/50 shadow-xl transition-all flex flex-col justify-between group">
                            <div>
                                <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center font-bold mb-6 group-hover:scale-105 transition-transform">
                                    <FileText className="w-6 h-6" />
                                </div>
                                <span className="text-[11px] font-extrabold uppercase tracking-wider text-red-400 block mb-2">
                                    Dor 02 · Engenharia & Risco
                                </span>
                                <h3 className="text-xl font-bold text-white mb-3">
                                    Fim do Prejuízo por Desenho Desatualizado
                                </h3>

                                <div className="p-3 rounded-xl bg-red-950/30 border border-red-800/30 text-xs text-red-200 mb-4 leading-relaxed">
                                    <strong>O Problema:</strong> O cliente muda uma furação ou espessura. A engenharia gera a Rev. 02, mas a fábrica corta 300 peças na Rev. 01 impressa na semana passada. Prejuízo direto de matéria-prima e horas-máquina.
                                </div>

                                <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/30 text-xs text-emerald-200 leading-relaxed">
                                    <strong>A Solução SINCO:</strong> Ficha de processo e desenhos com <em>Carimbo Digital</em> e QR Code. Quando a engenharia homologa nova versão, os postos de trabalho travam automaticamente a revisão antiga.
                                </div>
                            </div>

                            <ul className="space-y-2 mt-6 pt-5 border-t border-white/10 text-xs text-slate-300 font-medium">
                                <li className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <span>Carimbo digital com responsável técnico e data</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <span>QR Code direto no desenho para verificação na fábrica</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <span>Zero peças produzidas na revisão errada</span>
                                </li>
                            </ul>
                        </div>

                        {/* Dor 3: Qualidade SGQ e Normas */}
                        <div className="bg-[#182420] rounded-2xl p-7 border border-white/10 hover:border-emerald-500/50 shadow-xl transition-all flex flex-col justify-between group">
                            <div>
                                <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center font-bold mb-6 group-hover:scale-105 transition-transform">
                                    <ShieldCheck className="w-6 h-6" />
                                </div>
                                <span className="text-[11px] font-extrabold uppercase tracking-wider text-sky-400 block mb-2">
                                    Dor 03 · Qualidade & Auditoria
                                </span>
                                <h3 className="text-xl font-bold text-white mb-3">
                                    Atendimento Real aos Requisitos de Qualidade
                                </h3>

                                <div className="p-3 rounded-xl bg-red-950/30 border border-red-800/30 text-xs text-red-200 mb-4 leading-relaxed">
                                    <strong>O Problema:</strong> Clientes corporativos exigem laudos e certificados. Auditorias da ISO geram estresse porque documentos, calibrações de instrumentos e tratativas de RNC estão espalhadas em pastas isoladas.
                                </div>

                                <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/30 text-xs text-emerald-200 leading-relaxed">
                                    <strong>A Solução SINCO:</strong> Sistema validado pela <strong>SIM Consultoria</strong> (18 anos de SGQ). Inspeção em chão de fábrica, controle de calibração, procedimentos POP/IT centralizados e RNCs com 5 Porquês e 5W2H.
                                </div>
                            </div>

                            <ul className="space-y-2 mt-6 pt-5 border-t border-white/10 text-xs text-slate-300 font-medium">
                                <li className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <span>Conformidade com ISO 9001, 14001 e 45001</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <span>RNCs tratadas na esteira com análise de causa raiz</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <span>Rastreabilidade completa de lote de matéria-prima</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                COMO FUNCIONA NA PRÁTICA — O FLUXO EM 4 PASSOS
            ══════════════════════════════════════════════════════════════ */}
            <section id="fluxo" className="py-20 bg-[#0F1614] relative">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-4">
                            <Layers className="w-3.5 h-3.5 text-emerald-400" />
                            A Esteira de Fabricação
                        </div>
                        <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
                            Como o SINCO Opera na Prática do Dia a Dia
                        </h2>
                        <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                            Um fluxo contínuo onde uma etapa valida a outra, eliminando brechas para erro humano ou esquecimento.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Passo 1 */}
                        <div className="bg-[#15201C] p-6 rounded-2xl border border-white/10 relative">
                            <span className="text-3xl font-black text-emerald-500/40 font-mono block mb-2">01</span>
                            <h4 className="text-base font-bold text-white mb-2">Orçamento & Pedido</h4>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Emissão ágil de orçamentos no <strong>SINCO ERP Nativo</strong> ou sincronização direta com a carteira do seu ERP fiscal (TOTVS, Omie, Sankhya).
                            </p>
                        </div>

                        {/* Passo 2 */}
                        <div className="bg-[#15201C] p-6 rounded-2xl border border-white/10 relative">
                            <span className="text-3xl font-black text-amber-500/40 font-mono block mb-2">02</span>
                            <h4 className="text-base font-bold text-white mb-2">Engenharia & Carimbo</h4>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Explosão da árvore BOM multinível, roteiros mecânicos (solda, corte, dobra) e liberação com <strong>Carimbo Digital</strong> e controle de revisão.
                            </p>
                        </div>

                        {/* Passo 3 */}
                        <div className="bg-[#15201C] p-6 rounded-2xl border border-white/10 relative">
                            <span className="text-3xl font-black text-sky-500/40 font-mono block mb-2">03</span>
                            <h4 className="text-base font-bold text-white mb-2">Apontamento nos Postos</h4>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Fila vertical de trabalho em tablets na fábrica. Operador lê o código de barras, registra setups, início, pausas e conclusão sem papel.
                            </p>
                        </div>

                        {/* Passo 4 */}
                        <div className="bg-[#15201C] p-6 rounded-2xl border border-white/10 relative">
                            <span className="text-3xl font-black text-emerald-400/40 font-mono block mb-2">04</span>
                            <h4 className="text-base font-bold text-white mb-2">Qualidade & Romaneio</h4>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Inspeção de qualidade em processo e final (SGQ), geração automática de romaneios de embarque e liberação para faturamento.
                            </p>
                        </div>
                    </div>

                    <div className="mt-12 text-center">
                        <Link 
                            to="/ajuda?tab=fluxograma" 
                            className="inline-flex items-center gap-2 text-xs font-bold text-amber-300 hover:text-amber-200 underline decoration-amber-400/40 underline-offset-4"
                        >
                            <span>Deseja ver o diagrama completo de 11 etapas do processo com todas as tabelas? Clique aqui</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                BLOCO DE QUALIDADE: ALIANÇA COM A SIM CONSULTORIA (18 ANOS)
            ══════════════════════════════════════════════════════════════ */}
            <section id="qualidade-sgq" className="py-16 bg-[#141F1B] border-y border-white/10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="bg-gradient-to-r from-[#182622] via-[#20332E] to-[#182622] rounded-3xl p-8 sm:p-12 border border-emerald-500/30 shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-8">
                        <div className="max-w-2xl">
                            <div className="flex items-center gap-3 mb-4">
                                <img 
                                    src={simLogo} 
                                    alt="SIM Consultoria" 
                                    className="h-9 w-auto object-contain bg-white px-2 py-1 rounded-lg" 
                                />
                                <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                                    Aliança Estratégica · 18 Anos em SGQ Fabril
                                </span>
                            </div>

                            <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-3">
                                Sistema Desenvolvido com Quem Respira Qualidade Industrial
                            </h3>

                            <p className="text-slate-300 text-sm leading-relaxed mb-5">
                                O SINCO não foi inventado por desenvolvedores de software isolados. Toda a arquitetura de processos, formulários de não-conformidade (RNC), inspeções e procedimentos foi desenhada em conjunto com os especialistas da <strong>SIM Consultoria</strong>, atendendo com rigor aos requisitos das normas <strong>ISO 9001</strong>, <strong>ISO 14001</strong> e <strong>ISO 45001</strong>.
                            </p>

                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[11px] font-mono px-3 py-1 rounded-md bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-bold">
                                    ★ ISO 9001:2015
                                </span>
                                <span className="text-[11px] font-mono px-3 py-1 rounded-md bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-bold">
                                    ★ ISO 14001:2015
                                </span>
                                <span className="text-[11px] font-mono px-3 py-1 rounded-md bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-bold">
                                    ★ ISO 45001:2018
                                </span>
                                <span className="text-[11px] font-mono px-3 py-1 rounded-md bg-white/5 border border-white/20 text-slate-300">
                                    Tratativa 5W2H e 5 Porquês
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0 w-full sm:w-auto">
                            <a 
                                href="https://www.instagram.com/sim.consultoria/" 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-6 py-3.5 rounded-xl font-black text-xs transition-all shadow-lg"
                            >
                                <span>Conhecer a SIM Consultoria</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            <a 
                                href="/SINCO_Apresentacao_Executiva_Lynx_SIM.pdf"
                                download="SINCO_Apresentacao_Executiva_Lynx_SIM.pdf"
                                className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white px-6 py-3 rounded-xl font-bold text-xs border border-white/20 transition-colors"
                            >
                                <Download className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Baixar Apresentação Técnica (PDF)</span>
                            </a>
                        </div>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                PROVA SOCIAL: CLIENTES INDUSTRIAIS REAIS
            ══════════════════════════════════════════════════════════════ */}
            <section id="clientes" className="py-20 bg-[#0F1614] relative">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-2xl mx-auto mb-12">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 block mb-2">
                            Casos de Uso Reais
                        </span>
                        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                            Indústrias que Confiam na Suíte SINCO
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        {clients.map((c, i) => (
                            <a 
                                key={i}
                                href={c.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-[#15201C] p-5 rounded-2xl border border-white/10 hover:border-emerald-500/40 transition-all flex flex-col justify-between group"
                            >
                                <div>
                                    <div className="h-12 flex items-center justify-start mb-4">
                                        <img 
                                            src={c.logo} 
                                            alt={c.name} 
                                            className="max-h-8 max-w-[120px] object-contain filter brightness-90 group-hover:brightness-100 transition-all" 
                                        />
                                    </div>
                                    <h4 className="text-xs font-bold text-white mb-1 group-hover:text-emerald-400 transition-colors">
                                        {c.name}
                                    </h4>
                                    <p className="text-[10px] text-emerald-400 font-semibold mb-2">
                                        {c.segment}
                                    </p>
                                    <p className="text-[11px] text-slate-400 leading-relaxed">
                                        {c.desc}
                                    </p>
                                </div>
                                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500 group-hover:text-slate-300">
                                    <span>Visitar site</span>
                                    <ExternalLink className="w-3 h-3" />
                                </div>
                            </a>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                CALL TO ACTION FINAL & RODAPÉ CONCISO
            ══════════════════════════════════════════════════════════════ */}
            <footer className="bg-[#0A0F0E] text-slate-400 py-14 border-t border-white/10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-10 border-b border-white/10">
                        <div>
                            <h3 className="text-xl sm:text-2xl font-black text-white mb-1">
                                Pronto para tirar as pranchetas do chão de fábrica?
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-400">
                                Tenha controle estrito de revisões de projetos, qualidade e apontamento em tempo real.
                            </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                            <Link 
                                to="/ajuda" 
                                className="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-bold border border-white/15 transition-all"
                            >
                                Central de Ajuda
                            </Link>
                            <Link 
                                to="/login" 
                                className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition-all shadow-lg shadow-emerald-500/20"
                            >
                                Acessar Sistema
                            </Link>
                        </div>
                    </div>

                    <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
                        <div className="flex items-center gap-3">
                            <img src={lynxLogoSnow} alt="Lynx EMS" className="h-4 w-auto opacity-70" />
                            <span>© {new Date().getFullYear()} SINCO Industrial Suite · Desenvolvido por Lynx EMS Sistemas</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <Link to="/ajuda" className="hover:text-slate-300 transition-colors">Ajuda & POPs</Link>
                            <Link to="/ajuda?tab=fluxograma" className="hover:text-slate-300 transition-colors">Fluxograma 11 Etapas</Link>
                            <Link to="/login" className="hover:text-slate-300 transition-colors">Login</Link>
                        </div>
                    </div>
                </div>
            </footer>

            {/* ══════════════════════════════════════════════════════════════
                MODAL EM ALTA RESOLUÇÃO — VISTA GERAL DO GALPÃO INDUSTRIAL
            ══════════════════════════════════════════════════════════════ */}
            {photoModalOpen && (
                <div 
                    className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fadeIn"
                    onClick={() => setPhotoModalOpen(false)}
                >
                    <div 
                        className="relative max-w-6xl w-full bg-[#121B18] border border-white/20 rounded-2xl shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header do Modal */}
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-[#0F1614]">
                            <div className="flex items-center gap-2.5">
                                <Factory className="w-5 h-5 text-emerald-400" />
                                <div>
                                    <h3 className="text-sm font-black text-white tracking-wide">
                                        Planta Industrial — Visão Geral do Galpão
                                    </h3>
                                    <p className="text-[11px] text-slate-400">
                                        Operação real com apontamentos e rastreabilidade digital SINCO
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setPhotoModalOpen(false)}
                                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                                title="Fechar"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Imagem em Resolução Integral */}
                        <div className="relative bg-black flex items-center justify-center max-h-[80vh] overflow-hidden">
                            <img 
                                src={geralDoGalpaoImg} 
                                alt="Visão Geral do Galpão Industrial Completa" 
                                className="w-full h-auto max-h-[78vh] object-contain"
                            />
                        </div>

                        {/* Rodapé com Detalhes */}
                        <div className="px-5 py-3 bg-[#0F1614] border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-300">
                            <span>
                                Linha de corte CNC, máquinas de conformação, estamparia e postos de montagem integrados em tempo real.
                            </span>
                            <span className="font-mono text-[11px] text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20 font-bold">
                                LYNX EMS • INDÚSTRIA 4.0
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
