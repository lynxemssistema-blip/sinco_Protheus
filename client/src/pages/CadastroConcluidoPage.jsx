import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    CheckCircle2, 
    Sparkles, 
    ArrowRight, 
    ShieldCheck, 
    Building2, 
    Users, 
    Gauge, 
    MessageSquare, 
    ExternalLink 
} from 'lucide-react';
import lynxLogoSnow from '../assets/brand-lynx/LOGOTIPO SNOW.svg';

export default function CadastroConcluidoPage() {
    const navigate = useNavigate();

    useEffect(() => {
        // Evita que a página seja indexada por buscadores para não gerar conversões falsas
        const m = document.createElement('meta');
        m.name = 'robots';
        m.content = 'noindex, nofollow';
        document.head.appendChild(m);
        return () => m.remove();
    }, []);

    const handleAcessarPainel = () => {
        const token = localStorage.getItem('@Lynx:token');
        if (token) {
            navigate('/visao-geral');
        } else {
            navigate('/login');
        }
    };

    return (
        <div className="min-h-screen bg-[#0F1614] text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-slate-950 font-sans">
            {/* Topbar minimalista com branding Lynx EMS */}
            <header className="w-full border-b border-white/10 bg-[#0F1614]/80 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-xl font-black tracking-tight text-white">
                            SINCO
                        </span>
                        <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 tracking-widest">
                            Suite 4.0
                        </span>
                        <span className="text-white/20 text-xs">|</span>
                        <img 
                            src={lynxLogoSnow} 
                            alt="Lynx EMS" 
                            className="h-4 w-auto object-contain opacity-80" 
                        />
                    </div>

                    <button
                        onClick={() => navigate('/')}
                        className="text-xs font-semibold text-slate-400 hover:text-white transition flex items-center gap-1.5"
                    >
                        Página Inicial
                        <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                </div>
            </header>

            {/* Conteúdo Principal de Conversão */}
            <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-12 flex flex-col items-center justify-center text-center">
                {/* Badge e Ícone Animado de Sucesso */}
                <div className="relative mb-6">
                    <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-2xl shadow-emerald-500/30 animate-pulse">
                        <CheckCircle2 className="w-12 h-12 text-slate-950 stroke-[2.5]" />
                    </div>
                    <div className="absolute -top-2 -right-2 bg-emerald-400 text-slate-950 p-1.5 rounded-full shadow-lg">
                        <Sparkles className="w-4 h-4 fill-current" />
                    </div>
                </div>

                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-widest mb-4">
                    <ShieldCheck className="w-4 h-4" />
                    Cadastro Concluído com Sucesso
                </div>

                <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white mb-4 max-w-2xl">
                    Sua empresa está pronta para a indústria 4.0!
                </h1>

                <p className="text-slate-300 text-base sm:text-lg max-w-xl mb-8 leading-relaxed">
                    Parabéns! Sua conta Master e sua organização foram configuradas com 
                    <strong className="text-emerald-400"> 14 dias de teste gratuito</strong> sem qualquer compromisso.
                </p>

                {/* Cards com Próximos Passos */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full mb-10 text-left">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-emerald-500/40 transition-all">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
                            <Gauge className="w-5 h-5" />
                        </div>
                        <h2 className="text-sm font-bold text-white mb-1">Acesso Imediato</h2>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Módulos de PCP, Produção, Ordens de Serviço e Faturamento já liberados.
                        </p>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-emerald-500/40 transition-all">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
                            <Users className="w-5 h-5" />
                        </div>
                        <h2 className="text-sm font-bold text-white mb-1">Convide sua Equipe</h2>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Crie acessos para operadores, engenheiros e financeiro pelo seu painel Master.
                        </p>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-emerald-500/40 transition-all">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
                            <Building2 className="w-5 h-5" />
                        </div>
                        <h2 className="text-sm font-bold text-white mb-1">Suporte na Implantação</h2>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Nossa equipe de consultores industriais está à disposição para guiar seus testes.
                        </p>
                    </div>
                </div>

                {/* Ações Primárias */}
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                    <button
                        onClick={handleAcessarPainel}
                        className="w-full sm:w-auto px-8 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm tracking-wide shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 group cursor-pointer"
                    >
                        <span>Acessar Meu Painel Agora</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>

                    <a
                        href="https://wa.me/5511999999999?text=Ol%C3%A1!%20Acabei%20de%20cadastrar%20minha%20empresa%20no%20SINCO%20Lynx%20EMS%20e%20gostaria%20de%20suporte%20na%20implanta%C3%A7%C3%A3o."
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full sm:w-auto px-6 py-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-slate-200 font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                        <MessageSquare className="w-4 h-4 text-emerald-400" />
                        <span>Falar com Especialista</span>
                    </a>
                </div>
            </main>

            {/* Rodapé institucional */}
            <footer className="w-full border-t border-white/10 py-6 text-center text-xs text-slate-500">
                <p>© {new Date().getFullYear()} Lynx EMS & SIM Consultoria. Todos os direitos reservados.</p>
            </footer>
        </div>
    );
}
