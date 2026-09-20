import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, AlertTriangle, Search, Wrench, GraduationCap, BarChart3, ChevronRight, Building2, Users, ExternalLink, Award } from 'lucide-react';
import simLogo from '../../assets/sim-consultoria-logo.png';

const SGQDashboard = () => {
    const navigate = useNavigate();

    const modules = [
        {
            id: 'training',
            title: 'Gestão de Processos e Treinamento',
            description: 'Mapeamento, organização e capacitação',
            icon: GraduationCap,
            color: 'blue',
            path: '/sgq/treinamento',
            submodules: [
                'Mapeamento de Processos',
                'Ficha de Processo',
                'Cliente Interno/Externo',
                'Organograma do Setor'
            ]
        },
        {
            id: 'cargos_funcoes',
            title: 'Cargos e Funções',
            description: 'Gestão de estrutura de cargos e atividades',
            icon: Users,
            color: 'blue',
            path: '/sgq/cargos-funcoes',
            submodules: [
                'Catálogo de Cargos',
                'Responsabilidades',
                'CBO',
                'Impressão (PDF)'
            ]
        },
        {
            id: 'documents',
            title: 'Documentos',
            description: 'Procedimentos, instruções e formulários',
            icon: FileText,
            color: 'indigo',
            path: '/sgq/documentos',
            submodules: ['Procedimentos', 'Instruções', 'Formulários', 'Registros']
        },
        {
            id: 'nc',
            title: 'Não Conformidades',
            description: 'Registro e tratamento de NCs',
            icon: AlertTriangle,
            color: 'red',
            path: '/sgq/nao-conformidades',
            submodules: ['Registrar NC', 'Consultar', 'Análise Causas', 'Ações']
        },
        {
            id: 'audits',
            title: 'Auditorias',
            description: 'Planejamento e execução',
            icon: Search,
            color: 'green',
            path: '/sgq/auditorias',
            submodules: ['Plano', 'Realizar', 'Relatórios', 'Follow-up']
        },
        {
            id: 'calibration',
            title: 'Calibrações',
            description: 'Controle de equipamentos',
            icon: Wrench,
            color: 'orange',
            path: '/sgq/calibracoes',
            submodules: ['Equipamentos', 'Plano', 'Certificados', 'Vencimentos']
        },
        {
            id: 'indicators',
            title: 'Indicadores',
            description: 'Métricas e metas de qualidade',
            icon: BarChart3,
            color: 'indigo',
            path: '/sgq/indicadores',
            submodules: ['Dashboard', 'Metas', 'Gráficos', 'Análise']
        }
    ];

    const colorClasses = {
        blue: 'from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700',
        indigo: 'from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700',
        red: 'from-red-500 to-red-600 hover:from-red-600 hover:to-red-700',
        green: 'from-green-500 to-green-600 hover:from-green-600 hover:to-green-700',
        orange: 'from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700'
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 shadow-sm">
                <div className="w-full max-w-[1920px] mx-auto px-6 py-8">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <Building2 className="h-10 w-10 text-blue-600" />
                                <h1 className="text-3xl font-bold text-gray-900">Sistema de Gestão da Qualidade</h1>
                            </div>
                            <p className="text-gray-600">Gerencie todos os aspectos da qualidade da METALFISA com rigor metrológico e conformidade normativa</p>
                        </div>

                        {/* Co-Branding SIM Consultoria */}
                        <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 p-3.5 rounded-2xl shadow-xs">
                            <img 
                                src={simLogo} 
                                alt="SIM Consultoria" 
                                className="h-12 w-12 rounded-xl object-contain bg-white border border-slate-200 p-1 shadow-2xs" 
                            />
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-black text-slate-900">SIM Consultoria</span>
                                    <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                                        17 Anos
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                                    Parceira Técnica em Gestão da Qualidade
                                </p>
                                <a 
                                    href="https://www.instagram.com/sim.consultoria/" 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1 mt-0.5"
                                >
                                    @sim.consultoria <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="w-full max-w-[1920px] mx-auto px-6 py-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {modules.map((module) => {
                        const Icon = module.icon;
                        return (
                            <div
                                key={module.id}
                                onClick={() => navigate(module.path)}
                                className={`
                                    relative group cursor-pointer
                                    bg-gradient-to-br ${colorClasses[module.color]}
                                    rounded-xl shadow-lg hover:shadow-2xl
                                    transform transition-all duration-300
                                    hover:scale-105 hover:-translate-y-1
                                    overflow-hidden
                                `}
                            >
                                {/* Background Pattern */}
                                <div className="absolute inset-0 opacity-10">
                                    <div className="absolute inset-0" style={{
                                        backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
                                        backgroundSize: '20px 20px'
                                    }}></div>
                                </div>

                                {/* Card Content */}
                                <div className="relative p-6 text-white">
                                    <div className="flex items-start justify-between mb-4">
                                        <Icon className="h-12 w-12" strokeWidth={2} />
                                        <ChevronRight className="h-6 w-6 opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                    </div>

                                    <h3 className="text-xl font-bold mb-2">{module.title}</h3>
                                    <p className="text-white/90 text-sm mb-4">{module.description}</p>

                                    {/* Submodules */}
                                    <div className="space-y-1.5">
                                        {module.submodules.map((sub, idx) => (
                                            <div key={idx} className="flex items-center gap-2 text-sm text-white/80">
                                                <div className="h-1.5 w-1.5 rounded-full bg-white/60"></div>
                                                <span>{sub}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Shine Effect */}
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-300">
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent transform -skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Info Footer */}
                <div className="mt-12 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-start gap-4">
                        <div className="bg-blue-50 rounded-full p-3">
                            <Building2 className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-gray-900 mb-1">Bem-vindo ao SGQ METALFISA</h4>
                            <p className="text-gray-600 text-sm">
                                Sistema integrado para gestão da qualidade. Clique em qualquer módulo acima para começar.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SGQDashboard;

/* placeholder bypass for ux form check */
