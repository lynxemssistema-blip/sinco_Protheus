import React from 'react';
import { ShieldCheck, Target, Users, Zap, LayoutDashboard, Clock } from 'lucide-react';

const LynxPresentation = () => {
    const features = [
        {
            icon: <LayoutDashboard className="w-8 h-8 text-emerald-500" />,
            title: "Portal Exclusivo",
            description: "Acesse todos os seus projetos, pedidos e romaneios em um único lugar, com interface intuitiva e fácil navegação."
        },
        {
            icon: <Clock className="w-8 h-8 text-emerald-500" />,
            title: "Acompanhamento em Tempo Real",
            description: "Acompanhe o status das suas ordens de produção e previsões de entrega com atualizações precisas."
        },
        {
            icon: <ShieldCheck className="w-8 h-8 text-emerald-500" />,
            title: "Qualidade Garantida",
            description: "Acesso a relatórios de qualidade, certificados e não-conformidades de forma transparente e ágil."
        },
        {
            icon: <Users className="w-8 h-8 text-emerald-500" />,
            title: "Comunicação Direta",
            description: "Interaja diretamente com nossa equipe, acompanhe notas e histórico de solicitações sem complicação."
        }
    ];

    return (
        <div className="flex flex-col items-center justify-center min-h-[75vh] p-8">
            <div className="text-center space-y-6 max-w-4xl w-full">
                <div className="inline-flex items-center justify-center p-3 bg-emerald-50 rounded-2xl mb-4 shadow-sm border border-emerald-100">
                    <img 
                        src="/app-logo.png" 
                        alt="Lynx Logo" 
                        className="h-16 object-contain"
                        onError={(e) => {
                            e.target.onerror = null; 
                            e.target.style.display = 'none';
                        }}
                    />
                </div>
                
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900">
                    Bem-vindo ao Portal <span className="text-emerald-700 bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-700">Lynx</span>
                </h1>
                
                <p className="text-lg md:text-xl text-slate-600 leading-relaxed max-w-3xl mx-auto">
                    Desenvolvemos este espaço para oferecer total transparência e controle sobre suas demandas. 
                    Utilize o menu lateral para acessar seus projetos, romaneios e pedidos.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12 pt-8 border-t border-slate-100">
                    {features.map((feature, idx) => (
                        <div key={idx} className="flex flex-col items-center text-center p-6 bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow duration-300">
                            <div className="w-16 h-16 bg-slate-50 rounded-xl flex items-center justify-center mb-4">
                                {feature.icon}
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">{feature.title}</h3>
                            <p className="text-slate-500 leading-relaxed">{feature.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default LynxPresentation;
