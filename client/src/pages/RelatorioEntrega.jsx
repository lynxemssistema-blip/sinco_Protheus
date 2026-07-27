import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    FileText, Download, CheckCircle2, Package, Zap, Link2,
    Clock, Shield, Users, Database, Server, GitBranch,
    Printer, ChevronDown, ChevronUp, Bot, Settings,
    Factory, Truck, BarChart3, HelpCircle, Wrench, Star,
    Building2, Globe, Cpu, RefreshCcw, AlertTriangle, Mail,
    PenLine, KeyRound, Eye, EyeOff, XCircle, BadgeCheck, Lock, Sparkles
} from 'lucide-react';
import api from '../services/api';

// ─── Constantes de dados ────────────────────────────────────────────────────
const DELIVERY_DATE = 'Julho de 2026';
const SYSTEM_VERSION = 'v2026.1';

const NOVIDADES_REVISOES = [
    { label: 'Relatório de Liberações de Engenharia', status: 'Revisado', desc: 'Layout otimizado com scroll interno nas tabelas (sticky headers) e integração da exportação para Excel.', date: '27/07/2026', color: 'blue' },
    { label: 'Exportação PDF Padronizada', status: 'Inclusão', desc: 'Estrutura centralizada de PDF com a logo da Metalfisa, cabeçalho formatado e grid layout padronizado para Engenharia, Estruturas e PCP.', date: '27/07/2026', color: 'indigo' },
    { label: 'Correção de API Tracking', status: 'Resolvido', desc: 'Correção do erro interno (500) no comparativo de Planejado vs. Apontado na comunicação com PostgreSQL.', date: '27/07/2026', color: 'emerald' },
    { label: 'Ajuste de UI/UX em Tabelas', status: 'Revisado', desc: 'Remoção de rolagem dupla (double-scroll) e limitação de altura responsiva, garantindo melhor usabilidade.', date: '27/07/2026', color: 'amber' },
];

const MODULOS = [
    { id: 1, nome: 'Autenticação e Segurança', desc: 'Login JWT, recuperação de senha por WhatsApp/e-mail, auto-cadastro, RBAC por página com 4 ações', icon: Shield, color: 'slate' },
    { id: 2, nome: 'Dashboard — Meu Canal', desc: 'KPIs de produção por setor, relatório automatizado por e-mail e WhatsApp às 06h e 15h', icon: BarChart3, color: 'blue' },
    { id: 3, nome: 'Gestão de Pedidos', desc: 'Tabela mestra de pedidos integrada ao Protheus (SC5/SC6), filtros avançados, Drawer de detalhes, exportação Excel', icon: Package, color: 'indigo' },
    { id: 4, nome: 'PCP — Planejamento e Controle', desc: '11 sub-módulos: Planejador Avançado, Apontamento Vertical, Matrix, Curva S, Programas NCN, Conferência e mais', icon: Factory, color: 'amber' },
    { id: 5, nome: 'Produção e Apontamentos', desc: 'Controle de OPs, apontamentos em tempo real via Socket.io, Analytics, Macro Modal de Produção', icon: Zap, color: 'orange' },
    { id: 6, nome: 'SINCO — Engenharia', desc: 'Integração SolidEdge em tempo real via WebSocket, OS, BOM, Matrix, Materiais, Apontamento de OS', icon: GitBranch, color: 'cyan' },
    { id: 7, nome: 'Engenharia (Geral)', desc: 'Pedidos de engenharia, BOM Generator, Estrutura de Produto, Onde Usado, Análise 3D com OCR', icon: Cpu, color: 'teal' },
    { id: 8, nome: 'SGQ — Gestão da Qualidade', desc: 'Ativos, RNCs (fluxo completo), Documentos com editor rico, Calibrações, Treinamentos, PPAPs, Processos', icon: CheckCircle2, color: 'emerald' },
    { id: 9, nome: 'VMI — Vendor Managed Inventory', desc: 'Forecast, pedidos automatizados, estratégia de reposição, histórico de movimentações', icon: RefreshCcw, color: 'violet' },
    { id: 10, nome: 'Faturamento e Comercial', desc: 'Itens a faturar, controle de NFs, dashboard gerencial, histórico de solicitações, painel financeiro', icon: FileText, color: 'blue' },
    { id: 11, nome: 'Financeiro', desc: 'Dashboard, fluxo de caixa, plano de contas, balancete dinâmico por período', icon: BarChart3, color: 'green' },
    { id: 12, nome: 'Logística e Romaneios', desc: 'Romaneios com QR Code, recebimentos, portal do fornecedor, formulário completo com upload de fotos', icon: Truck, color: 'red' },
    { id: 13, nome: 'Suprimentos e Compras', desc: 'SCs, PCs, rastreamento SC→NF, saldo de materiais, auditoria de pedidos', icon: Package, color: 'orange' },
    { id: 14, nome: 'Manutenção de Equipamentos', desc: 'Máquinas, checklists de inspeção, ordens de manutenção (corretiva/preventiva), fichas técnicas', icon: Wrench, color: 'slate' },
    { id: 15, nome: 'RH — Recursos Humanos', desc: 'Vagas, análise de currículos com IA Gemini (extração automática de dados), offboarding com checklist', icon: Users, color: 'pink' },
    { id: 16, nome: 'Wabtec — Módulo Dedicado', desc: 'Escopo de fornecimento, estrutura de produto, datas de solicitação — módulo exclusivo para o cliente Wabtec', icon: Building2, color: 'slate' },
    { id: 17, nome: 'Hermes — Assistente IA Geral', desc: 'Chat em linguagem natural, feed proativo de notificações, monitoramento contínuo de anomalias', icon: Bot, color: 'blue' },
    { id: 18, nome: 'PCPMetal — IA Especializada PCP', desc: 'Engine FCS (Factory Capacity Simulation), simulação de capacidade, cache de ocupação de recursos', icon: Cpu, color: 'indigo' },
    { id: 19, nome: 'Etiquetas e Impressão Industrial', desc: 'Print Agent PPLB/EPL2 instalável, etiquetas de produto, romaneio e pré-lista de faturamento', icon: Printer, color: 'amber' },
    { id: 20, nome: 'WhatsApp e Comunicação', desc: 'Bot de suporte com IA, relatórios automáticos diários, log completo de mensagens, Evolution API', icon: Mail, color: 'emerald' },
    { id: 21, nome: 'Configurações e Administração', desc: 'Gestão de usuários, permissões granulares por página, perfis customizáveis, monitoramento do sistema', icon: Settings, color: 'slate' },
    { id: 22, nome: 'Sistema de Ajuda Contextual', desc: 'Ajuda por rota integrada ao SGQ — POPs do SGQ aparecem automaticamente nas telas relacionadas', icon: HelpCircle, color: 'teal' },
    { id: 23, nome: 'Painel de Produção (TV)', desc: 'Painel público para chão de fábrica, atualizações em tempo real via Socket.io, sem necessidade de login', icon: Globe, color: 'blue' },
    { id: 24, nome: 'Avisos e Comunicados', desc: 'Mural digital com imagens, áudios, avisos flutuantes persistentes em todas as telas do sistema', icon: AlertTriangle, color: 'yellow' },
    { id: 25, nome: 'Calendário de Atividades', desc: 'Calendário integrado com avisos, reuniões e eventos, vinculado ao sistema de notificações', icon: Clock, color: 'violet' },
];

const INTEGRACOES = [
    { nome: 'Protheus / TOTVS', tipo: 'Leitura via PostgreSQL', desc: 'SC5010, SC6010, SC2010, SB1010, SG2010, SF2010, SA5010, SH6010 e outras', status: 'Operacional', color: 'blue' },
    { nome: 'SolidEdge (CAD)', tipo: 'WebSocket em tempo real', desc: 'Agente Windows detecta desenho ativo e envia ao ERP instantaneamente via Socket.io', status: 'Operacional', color: 'cyan' },
    { nome: 'Google Gemini AI', tipo: 'API de Inteligência Artificial', desc: 'Análise de currículos, chat Hermes, análise PCP, diagnóstico automático de erros 500', status: 'Operacional', color: 'indigo' },
    { nome: 'WhatsApp (Evolution API)', tipo: 'Mensagens automáticas', desc: 'Recuperação de senha, relatórios de KPI, resumos diários com IA para grupos monitorados', status: 'Operacional', color: 'emerald' },
    { nome: 'E-mail Corporativo (SMTP)', tipo: 'smtp.task.com.br | Porta 587', desc: 'Meu Canal, recuperação de senha, envio de RNCs, avisos automáticos — sincometal@metalfisa.com.br', status: 'Operacional', color: 'orange' },
    { nome: 'Impressoras Industriais', tipo: 'PPLB / EPL2 (Zebra)', desc: 'Print Agent local instalável nas estações Windows — etiquetas de produto, romaneio e pré-lista', status: 'Operacional', color: 'slate' },
];

const AUTOMACOES = [
    { horario: '06:00 (dias úteis)', nome: 'Meu Canal — Manhã', desc: 'E-mail + WhatsApp com KPIs de produção para cada responsável de setor' },
    { horario: '15:00 (dias úteis)', nome: 'Meu Canal — Tarde', desc: 'Atualização dos KPIs de produção — relatório completo por setor' },
    { horario: '15:00 (dias úteis)', nome: 'Relatório WhatsApp com IA', desc: 'Resumo de produção gerado por IA enviado aos grupos WhatsApp monitorados' },
    { horario: 'Contínuo', nome: 'Alertas SGQ', desc: 'Calibrações vencendo, treinamentos atrasados, notificações automáticas de qualidade' },
    { horario: 'Configurável', nome: 'Automações de Faturamento', desc: 'Atualizações de status e notificações de pendências de faturamento' },
    { horario: 'Contínuo', nome: 'Hermes — Monitor Proativo', desc: 'Detecção de anomalias de produção e alertas em tempo real via Socket.io' },
];

const METRICAS = [
    { label: 'Rotas / Páginas', value: '~90', icon: Globe },
    { label: 'Módulos Funcionais', value: '25', icon: Package },
    { label: 'Arquivos de Rota API', value: '72', icon: Server },
    { label: 'Componentes React', value: '67+', icon: Cpu },
    { label: 'Integrações Externas', value: '6', icon: Link2 },
    { label: 'Automações (Cron Jobs)', value: '6', icon: Zap },
    { label: 'Canais de Comunicação', value: '3', icon: Mail },
    { label: 'Diretórios de Upload', value: '8', icon: Database },
];

const AMBIENTES = [
    { label: 'Intranet (Rede Local)', url: 'http://192.168.1.77:3001', status: 'Operacional' },
    { label: 'Módulo SINCO', url: 'https://sincometal.metalfisa.com.br', status: 'Operacional' },
    { label: 'Painel TV (Público)', url: '/painel-producao', status: 'Operacional' },
];

const COLOR_MAP = {
    slate:  { bg: 'bg-slate-100',  text: 'text-slate-700',  ring: 'ring-slate-200',  dot: 'bg-slate-400' },
    blue:   { bg: 'bg-blue-50',    text: 'text-blue-700',   ring: 'ring-blue-200',   dot: 'bg-blue-500' },
    indigo: { bg: 'bg-indigo-50',  text: 'text-indigo-700', ring: 'ring-indigo-200', dot: 'bg-indigo-500' },
    amber:  { bg: 'bg-amber-50',   text: 'text-amber-700',  ring: 'ring-amber-200',  dot: 'bg-amber-500' },
    orange: { bg: 'bg-orange-50',  text: 'text-orange-700', ring: 'ring-orange-200', dot: 'bg-orange-500' },
    cyan:   { bg: 'bg-cyan-50',    text: 'text-cyan-700',   ring: 'ring-cyan-200',   dot: 'bg-cyan-500' },
    teal:   { bg: 'bg-teal-50',    text: 'text-teal-700',   ring: 'ring-teal-200',   dot: 'bg-teal-500' },
    emerald:{ bg: 'bg-emerald-50', text: 'text-emerald-700',ring: 'ring-emerald-200',dot: 'bg-emerald-500' },
    violet: { bg: 'bg-violet-50',  text: 'text-violet-700', ring: 'ring-violet-200', dot: 'bg-violet-500' },
    green:  { bg: 'bg-green-50',   text: 'text-green-700',  ring: 'ring-green-200',  dot: 'bg-green-500' },
    red:    { bg: 'bg-red-50',     text: 'text-red-700',    ring: 'ring-red-200',    dot: 'bg-red-500' },
    pink:   { bg: 'bg-pink-50',    text: 'text-pink-700',   ring: 'ring-pink-200',   dot: 'bg-pink-500' },
    yellow: { bg: 'bg-yellow-50',  text: 'text-yellow-700', ring: 'ring-yellow-200', dot: 'bg-yellow-500' },
};

function getColor(c) { return COLOR_MAP[c] || COLOR_MAP.slate; }

// ─── Sub-componentes ─────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, subtitle }) {
    return (
        <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
                <h2 className="text-lg font-bold text-slate-800 leading-tight">{title}</h2>
                {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
            </div>
        </div>
    );
}

function StatusBadge({ label = 'Operacional' }) {
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold ring-1 ring-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {label}
        </span>
    );
}

function ModuloCard({ mod }) {
    const c = getColor(mod.color);
    const Icon = mod.icon;
    return (
        <div className={`flex items-start gap-3 p-3.5 rounded-xl ring-1 ${c.ring} ${c.bg} group hover:shadow-md transition-all duration-200`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${c.bg}`}>
                <Icon className={`w-4 h-4 ${c.text}`} />
            </div>
            <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-sm font-bold ${c.text} leading-tight`}>{mod.nome}</p>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                </div>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{mod.desc}</p>
            </div>
        </div>
    );
}

function CollapseSection({ title, icon: Icon, children, defaultOpen = false }) {
    const [open, setOpen] = useState(defaultOpen);

    // Refs (not state) so the print handlers always read the latest value
    // without needing to resubscribe — avoids stale closures across re-renders.
    const openRef = useRef(open);
    const preprintOpenRef = useRef(open);
    useEffect(() => { openRef.current = open; }, [open]);

    // Force every section fully open for the duration of printing/PDF export,
    // regardless of what the user had toggled on screen, then restore it after.
    useEffect(() => {
        const handleBeforePrint = () => {
            preprintOpenRef.current = openRef.current;
            setOpen(true);
        };
        const handleAfterPrint = () => {
            setOpen(preprintOpenRef.current);
        };
        window.addEventListener('beforeprint', handleBeforePrint);
        window.addEventListener('afterprint', handleAfterPrint);
        return () => {
            window.removeEventListener('beforeprint', handleBeforePrint);
            window.removeEventListener('afterprint', handleAfterPrint);
        };
    }, []);

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:shadow-none print:border-slate-300">
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-900 rounded-xl flex items-center justify-center">
                        <Icon className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-bold text-slate-800">{title}</span>
                </div>
                <span className="print:hidden">
                    {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </span>
            </button>
            {/* Print always shows full content, forced open above */}
            <div className={`${open ? 'block' : 'hidden'} print:block px-6 pb-6`}>
                {children}
            </div>
        </div>
    );
}

// ─── Electronic Signature Modal ──────────────────────────────────────────────────
function ElectronicSignatureModal({ role, party, onConfirm, onClose }) {
    const [loginVal, setLoginVal] = useState('');
    const [senha, setSenha] = useState('');
    const [showPwd, setShowPwd] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSign = async (e) => {
        e.preventDefault();
        if (!loginVal.trim() || !senha.trim()) { setError('Preencha o usuário e a senha.'); return; }
        setLoading(true); setError('');
        try {
            const res = await api.post('/auth/login', { login: loginVal.trim(), senha });
            const { user } = res.data;
            onConfirm({
                nome: user.NomeUsuario || user.nome || loginVal,
                login: user.Usuario || user.login || loginVal,
                cargo: user.Cargo || user.cargo || '',
                timestamp: new Date().toLocaleString('pt-BR'),
                iso: new Date().toISOString(),
            });
        } catch (err) {
            setError(err.response?.data?.error || 'Usuário ou senha incorretos.');
        } finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm no-print">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                            <PenLine className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-white font-black text-sm">Assinatura Eletrônica</p>
                            <p className="text-slate-400 text-xs">{party} — {role}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <XCircle className="w-5 h-5" />
                    </button>
                </div>
                <div className="mx-6 mt-4 mb-0 p-3 rounded-xl bg-amber-50 ring-1 ring-amber-200 flex items-start gap-2">
                    <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 leading-relaxed">
                        Insira suas credenciais de acesso ao sistema. Seus dados serão registrados como assinante deste documento.
                    </p>
                </div>
                <form onSubmit={handleSign} className="px-6 py-5 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Usuário</label>
                        <input autoFocus type="text" value={loginVal} onChange={e => setLoginVal(e.target.value)}
                            placeholder="Seu login do sistema"
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Senha</label>
                        <div className="relative">
                            <input type={showPwd ? 'text' : 'password'} value={senha} onChange={e => setSenha(e.target.value)}
                                placeholder="••••••••"
                                className="w-full px-3 py-2.5 pr-10 rounded-xl border border-slate-200 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                            />
                            <button type="button" onClick={() => setShowPwd(v => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                    {error && (
                        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-50 ring-1 ring-red-200">
                            <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                            <p className="text-xs text-red-700 font-semibold">{error}</p>
                        </div>
                    )}
                    <div className="flex gap-2 pt-1">
                        <button type="button" onClick={onClose}
                            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                            Cancelar
                        </button>
                        <button type="submit" disabled={loading}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-bold transition-colors">
                            {loading
                                ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                : <PenLine className="w-4 h-4" />}
                            {loading ? 'Verificando...' : 'Assinar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Signature Block ────────────────────────────────────────────────────────
function SignatureBlock({ label, organization, role, signatureData, onClickSign, locked }) {
    const isSigned = !!signatureData;
    return (
        <div className={`p-5 rounded-xl ring-1 space-y-4 transition-all ${
            isSigned
                ? locked
                    ? 'bg-emerald-50 ring-emerald-300 shadow-sm shadow-emerald-100'
                    : 'bg-emerald-50 ring-emerald-200'
                : locked
                    ? 'bg-slate-100 ring-slate-300 opacity-60'
                    : 'bg-slate-50 ring-slate-200'
        }`}>
            {/* Party header */}
            <div className="flex items-start justify-between gap-2">
                <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
                    <p className="text-base font-black text-slate-800">{organization}</p>
                    <p className="text-sm text-slate-600">{role}</p>
                </div>
                {isSigned && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 shrink-0">
                        <Lock className="w-3 h-3 text-slate-300" />
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Bloqueado</span>
                    </div>
                )}
            </div>

            <div className="border-t border-slate-300 pt-4 space-y-3">
                {isSigned ? (
                    <>
                        <div className="flex items-start gap-2">
                            <BadgeCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-black text-slate-800">{signatureData.nome}</p>
                                {signatureData.cargo && <p className="text-xs text-slate-500">{signatureData.cargo}</p>}
                                <p className="text-xs text-slate-400 font-mono mt-0.5">@{signatureData.login}</p>
                            </div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-emerald-100/60 ring-1 ring-emerald-200">
                            <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Assinado eletronicamente em</p>
                            <p className="text-xs text-emerald-800 font-semibold mt-0.5">{signatureData.timestamp}</p>
                        </div>
                        <p className="text-[9px] text-slate-400 font-mono break-all">
                            sig:{btoa(`${signatureData.login}|${signatureData.iso}`).substring(0, 40)}…
                        </p>
                    </>
                ) : locked ? (
                    // Unsigned but process already closed by other party signing (should not reach here normally)
                    <div className="flex flex-col items-center justify-center gap-2 py-6">
                        <Lock className="w-6 h-6 text-slate-300" />
                        <span className="text-xs font-semibold text-slate-400">Processo encerrado</span>
                    </div>
                ) : (
                    <button onClick={onClickSign}
                        className="w-full group flex flex-col items-center justify-center gap-2 py-6 rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/50 transition-all no-print">
                        <PenLine className="w-6 h-6 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                        <span className="text-xs font-semibold text-slate-400 group-hover:text-emerald-600 transition-colors">
                            Clique para assinar eletronicamente
                        </span>
                    </button>
                )}
            </div>
        </div>
    );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function RelatorioEntrega({ embedded = false }) {
    const reportRef = useRef(null);
    const [signFornecedor, setSignFornecedor] = useState(null);
    const [signCliente, setSignCliente] = useState(null);
    const [signModal, setSignModal] = useState(null);

    // Process is permanently closed once BOTH parties have signed
    const isClosed = !!(signFornecedor && signCliente);

    const handleConfirmSign = useCallback((side, data) => {
        if (side === 'fornecedor') setSignFornecedor(data);
        else setSignCliente(data);
        setSignModal(null);
    }, []);

    // Block modal if process is already closed
    const handleOpenModal = useCallback((side) => {
        if (isClosed) return;
        setSignModal(side);
    }, [isClosed]);

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className={embedded ? 'bg-gray-50' : 'min-h-screen bg-gray-50'}>

            {/* ── Signature Modal ── */}
            {signModal && (
                <ElectronicSignatureModal
                    role={signModal === 'fornecedor' ? 'Responsável Técnico' : 'Responsável pelo Recebimento'}
                    party={signModal === 'fornecedor' ? 'LynxEMS Sistemas' : 'Metalfisa Indústria'}
                    onConfirm={(data) => handleConfirmSign(signModal, data)}
                    onClose={() => setSignModal(null)}
                />
            )}

            {/* ── Print CSS injetado dinamicamente ── */}
            <style>{`
                @media print {
                    @page { size: A4; margin: 15mm 12mm; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .print\\:hidden { display: none !important; }
                    .print\\:block  { display: block  !important; }
                    .print\\:shadow-none { box-shadow: none !important; }
                    .print\\:border-slate-300 { border-color: #cbd5e1 !important; }
                    .no-print { display: none !important; }
                }
            `}</style>

            <div ref={reportRef} className="max-w-5xl mx-auto px-4 py-6 space-y-6">

                {/* ═══ HEADER ════════════════════════════════════════════════════ */}
                <div className="bg-slate-900 rounded-2xl p-8 text-white relative overflow-hidden print:shadow-none">
                    {/* Background decoration */}
                    <div className="absolute inset-0 opacity-10"
                        style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #6366f1 0%, transparent 50%), radial-gradient(circle at 10% 80%, #3b82f6 0%, transparent 50%)' }} />

                    <div className="relative z-10">
                        <div className="flex items-start justify-between flex-wrap gap-4">
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="px-3 py-1 bg-white/10 backdrop-blur-sm rounded-full text-xs font-semibold text-white/80 ring-1 ring-white/20">
                                        MARCO DE ENTREGA OFICIAL
                                    </span>
                                    <span className="px-3 py-1 bg-emerald-500/20 backdrop-blur-sm rounded-full text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
                                        SISTEMA OPERACIONAL
                                    </span>
                                </div>
                                <h1 className="text-3xl font-black text-white leading-tight">
                                    Relatório de Entrega
                                </h1>
                                <p className="text-xl font-semibold text-blue-200 mt-1">
                                    MetalFisa ERP — Sistema Integrado de Gestão Industrial
                                </p>
                            </div>
                            <button
                                onClick={handlePrint}
                                className="flex items-center gap-2 px-5 py-2.5 bg-white text-slate-900 rounded-xl font-semibold text-sm hover:bg-blue-50 transition-colors shadow-lg no-print shrink-0"
                            >
                                <Download className="w-4 h-4" />
                                Exportar PDF
                            </button>
                        </div>

                        {/* Meta info grid */}
                        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                                { label: 'Cliente', value: 'Metalfisa Indústria' },
                                { label: 'Fornecedor', value: 'LynxEMS Sistemas' },
                                { label: 'Data de Entrega', value: DELIVERY_DATE },
                                { label: 'Versão', value: SYSTEM_VERSION },
                            ].map(({ label, value }) => (
                                <div key={label} className="bg-white/10 backdrop-blur-sm rounded-xl p-3 ring-1 ring-white/10">
                                    <p className="text-xs text-white/60 font-medium">{label}</p>
                                    <p className="text-sm font-bold text-white mt-0.5">{value}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ═══ SUMÁRIO EXECUTIVO ════════════════════════════════════════ */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 print:shadow-none">
                    <SectionHeader icon={Star} title="Sumário Executivo" />
                    <p className="text-sm text-slate-600 leading-relaxed">
                        Este documento certifica a entrega do <strong>MetalFisa ERP</strong>, sistema integrado de gestão industrial
                        desenvolvido sob medida para a Metalfisa. O sistema cobre todo o ciclo operacional da empresa — desde
                        a entrada de pedidos até a expedição — integrando PCP, Produção, Engenharia, Qualidade, Logística,
                        Financeiro e RH em uma única plataforma web.
                    </p>
                    <p className="text-sm text-slate-600 leading-relaxed mt-3">
                        A entrega contempla um sistema <strong>totalmente operacional</strong>, com integrações ativas ao ERP Protheus (TOTVS),
                        sistema CAD SolidEdge, Inteligência Artificial (Google Gemini), WhatsApp e impressoras industriais.
                        O sistema está disponível na rede interna e externamente via internet com certificado SSL.
                    </p>
                </div>

                {/* ═══ AMBIENTES ════════════════════════════════════════════════ */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 print:shadow-none">
                    <SectionHeader icon={Globe} title="Ambientes de Acesso" subtitle="URLs de acesso ao sistema em produção" />
                    <div className="grid sm:grid-cols-2 gap-3">
                        {AMBIENTES.map(a => (
                            <div key={a.label} className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 ring-1 ring-slate-200">
                                <div>
                                    <p className="text-sm font-semibold text-slate-800">{a.label}</p>
                                    <p className="text-xs text-slate-500 mt-0.5 font-mono">{a.url}</p>
                                </div>
                                <StatusBadge />
                            </div>
                        ))}
                    </div>
                </div>

                {/* ═══ MÉTRICAS ════════════════════════════════════════════════ */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 print:shadow-none">
                    <SectionHeader icon={BarChart3} title="Métricas do Sistema" subtitle="Dimensionamento técnico do que foi desenvolvido e entregue" />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {METRICAS.map(m => {
                            const Icon = m.icon;
                            return (
                                <div key={m.label} className="flex flex-col items-center text-center p-4 rounded-xl bg-slate-50 ring-1 ring-slate-200 hover:bg-blue-50 hover:ring-blue-200 transition-all">
                                    <Icon className="w-5 h-5 text-blue-600 mb-2" />
                                    <span className="text-2xl font-black text-slate-900">{m.value}</span>
                                    <span className="text-xs text-slate-500 mt-0.5 leading-tight text-center">{m.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ═══ MÓDULOS ENTREGUES ═══════════════════════════════════════ */}
                {/* ✨ ÚLTIMAS INCLUSÕES E REVISÕES ✨ */}
                <CollapseSection title={`Últimas Inclusões e Revisões (${NOVIDADES_REVISOES.length})`} icon={Sparkles} defaultOpen={true}>
                    <div className="mt-2 grid sm:grid-cols-2 gap-3">
                        {NOVIDADES_REVISOES.map(rev => {
                            const c = getColor(rev.color);
                            return (
                                <div key={rev.label} className={`flex flex-col p-4 rounded-xl ring-1 ${c.ring} ${c.bg} transition-all hover:shadow-md`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold text-white shadow-sm ${rev.status === 'Inclusão' ? 'bg-indigo-500' : rev.status === 'Resolvido' ? 'bg-emerald-500' : 'bg-blue-500'}`}>
                                                {rev.status}
                                            </span>
                                            <span className="text-xs font-mono text-slate-500 bg-white/50 px-2 py-0.5 rounded-md">{rev.date}</span>
                                        </div>
                                    </div>
                                    <p className={`text-sm font-bold ${c.text}`}>{rev.label}</p>
                                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{rev.desc}</p>
                                </div>
                            );
                        })}
                    </div>
                </CollapseSection>

                <CollapseSection title={`Módulos Entregues (${MODULOS.length})`} icon={Package} defaultOpen={true}>
                    <div className="mt-2 grid sm:grid-cols-2 gap-3">
                        {MODULOS.map(mod => (
                            <ModuloCard key={mod.id} mod={mod} />
                        ))}
                    </div>
                    <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-emerald-50 ring-1 ring-emerald-200">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <p className="text-xs font-semibold text-emerald-700">
                            Todos os {MODULOS.length} módulos entregues, testados e operacionais em ambiente de produção.
                        </p>
                    </div>
                </CollapseSection>

                {/* ═══ INTEGRAÇÕES ════════════════════════════════════════════ */}
                <CollapseSection title={`Integrações Ativas (${INTEGRACOES.length})`} icon={Link2} defaultOpen={true}>
                    <div className="mt-2 space-y-3">
                        {INTEGRACOES.map(intg => {
                            const c = getColor(intg.color);
                            return (
                                <div key={intg.nome} className={`p-4 rounded-xl ring-1 ${c.ring} ${c.bg}`}>
                                    <div className="flex items-start justify-between gap-3 flex-wrap">
                                        <div>
                                            <p className={`text-sm font-bold ${c.text}`}>{intg.nome}</p>
                                            <p className={`text-xs font-medium opacity-70 ${c.text} mt-0.5`}>{intg.tipo}</p>
                                        </div>
                                        <StatusBadge />
                                    </div>
                                    <p className="text-xs text-slate-600 mt-2 leading-relaxed">{intg.desc}</p>
                                </div>
                            );
                        })}
                    </div>
                </CollapseSection>

                {/* ═══ AUTOMAÇÕES ═════════════════════════════════════════════ */}
                <CollapseSection title={`Automações Agendadas (${AUTOMACOES.length})`} icon={Zap} defaultOpen={true}>
                    <div className="mt-2 space-y-2">
                        {AUTOMACOES.map(auto => (
                            <div key={auto.nome} className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 ring-1 ring-slate-200">
                                <div className="px-2 py-1 rounded-lg bg-blue-600 text-white text-xs font-bold whitespace-nowrap shrink-0">
                                    {auto.horario}
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-slate-800">{auto.nome}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">{auto.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-slate-500 mt-3 italic">
                        * Todas as automações respeitam o calendário de dias úteis e feriados configurados no sistema.
                    </p>
                </CollapseSection>

                {/* ═══ SEGURANÇA ══════════════════════════════════════════════ */}
                <CollapseSection title="Segurança Implementada" icon={Shield} defaultOpen={false}>
                    <div className="mt-2 grid sm:grid-cols-2 gap-3">
                        {[
                            { label: 'Autenticação', desc: 'JWT com expiração de 8 horas por sessão' },
                            { label: 'Senhas', desc: 'bcrypt com 10 rounds de hash — sem senhas em texto claro' },
                            { label: 'Autorização (RBAC)', desc: 'Controle granular por página: can_view, can_create, can_edit, can_delete' },
                            { label: 'CORS', desc: 'Lista branca de origens — apenas domínios autorizados' },
                            { label: 'Upload de Arquivos', desc: 'Validação de tipo e tamanho de arquivo em todas as rotas' },
                            { label: 'Path Traversal', desc: 'Proteção contra acesso a arquivos fora do diretório permitido' },
                            { label: 'AI Error Tracker', desc: 'Middleware de IA analisa automaticamente todos os erros 500' },
                            { label: 'Compressão HTTP', desc: 'Gzip ativo em todas as rotas — redução de tráfego' },
                        ].map(item => (
                            <div key={item.label} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 ring-1 ring-slate-200">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CollapseSection>

                {/* ═══ PERFIS DE USUÁRIO ══════════════════════════════════════ */}
                <CollapseSection title="Perfis de Usuário e Controle de Acesso" icon={Users} defaultOpen={false}>
                    <div className="mt-2 space-y-2">
                        {[
                            { perfil: 'Super Admin (SA)', nivel: 'Total', desc: 'Acesso irrestrito a todos os módulos e configurações', color: 'indigo' },
                            { perfil: 'Admin (A)', nivel: 'Total', desc: 'Acesso completo a todos os módulos', color: 'blue' },
                            { perfil: 'Perfis Customizados (isAdmin)', nivel: 'Total', desc: 'Acesso total configurável — definido pelo administrador', color: 'cyan' },
                            { perfil: 'Perfis Customizados (Operacional)', nivel: 'Parcial', desc: 'Acesso específico por módulo e ação — totalmente configurável', color: 'teal' },
                            { perfil: 'Básico', nivel: 'Mínimo', desc: 'Visualização limitada — para usuários em análise ou sem perfil específico', color: 'slate' },
                            { perfil: 'Fornecedor', nivel: 'Restrito', desc: 'Acesso exclusivo ao Portal de Romaneios', color: 'orange' },
                        ].map(item => {
                            const c = getColor(item.color);
                            return (
                                <div key={item.perfil} className={`flex items-center gap-3 p-3.5 rounded-xl ring-1 ${c.ring} ${c.bg}`}>
                                    <div className={`w-2 h-2 rounded-full ${c.dot} shrink-0`} />
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-bold ${c.text}`}>{item.perfil}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                                    </div>
                                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${c.bg} ${c.text} ring-1 ${c.ring}`}>
                                        {item.nivel}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                    <p className="text-xs text-slate-500 mt-3 italic">
                        * Novos perfis podem ser criados pelo administrador sem necessidade de desenvolvimento adicional.
                    </p>
                </CollapseSection>

                {/* ═══ INFRAESTRUTURA ═════════════════════════════════════════ */}
                <CollapseSection title="Infraestrutura e Operação" icon={Server} defaultOpen={false}>
                    <div className="mt-2 grid sm:grid-cols-2 gap-3">
                        {[
                            { label: 'Servidor', value: 'Linux — IP 192.168.1.77' },
                            { label: 'Gerenciador de Processos', value: 'PM2 — restart automático' },
                            { label: 'Porta de Serviço', value: '3001 (interno) | 443 HTTPS (externo)' },
                            { label: 'Script de Deploy', value: 'sync-deployment.ps1 (PowerShell)' },
                            { label: 'Health Check', value: 'Endpoint /health ativo' },
                            { label: 'Pool de Conexões MySQL', value: '15 conexões / fila de 200 req.' },
                            { label: 'Retry Automático', value: 'ECONNRESET, ETIMEDOUT e outros' },
                            { label: 'Monitoramento de Erros', value: 'AI Error Tracker (Gemini)' },
                        ].map(item => (
                            <div key={item.label} className="p-3 rounded-xl bg-slate-50 ring-1 ring-slate-200">
                                <p className="text-xs text-slate-500 font-medium">{item.label}</p>
                                <p className="text-sm font-bold text-slate-800 mt-0.5">{item.value}</p>
                            </div>
                        ))}
                    </div>
                </CollapseSection>

                {/* ═══ ASSINATURA ══════════════════════════════════════════════ */}
                <div className={`rounded-2xl shadow-sm border p-6 print:shadow-none ${
                    isClosed
                        ? 'bg-slate-900 border-slate-700'
                        : 'bg-white border-slate-200'
                }`}>
                    <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                        <SectionHeader
                            icon={isClosed ? Lock : FileText}
                            title="Aceite de Entrega"
                            subtitle={isClosed
                                ? 'Processo finalizado e permanentemente bloqueado'
                                : 'Assinatura eletrônica das partes responsáveis pelo projeto'}
                        />
                        {isClosed && (
                            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500 text-white text-xs font-black uppercase tracking-widest shadow-sm no-print">
                                <Lock className="w-3.5 h-3.5" />
                                Entrega Selada
                            </span>
                        )}
                    </div>

                    {/* Sealed banner */}
                    {isClosed && (
                        <div className="mb-5 p-4 rounded-2xl bg-emerald-500/10 ring-2 ring-emerald-500/40 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                                <Lock className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-sm font-black text-emerald-300 uppercase tracking-wider">Processo Bloqueado Permanentemente</p>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    Ambas as partes assinaram eletronicamente. Este documento não pode mais ser alterado.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Status bar (partial signing) */}
                    {!isClosed && (signFornecedor || signCliente) && (
                        <div className="mb-4 p-3 rounded-xl bg-emerald-50 ring-1 ring-emerald-200 flex items-center gap-2">
                            <BadgeCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                            <p className="text-xs font-semibold text-emerald-700">
                                {signFornecedor && signCliente
                                    ? 'Documento assinado por ambas as partes — aceite de entrega concluído.'
                                    : signFornecedor
                                    ? 'Aguardando assinatura do Cliente.'
                                    : 'Aguardando assinatura do Fornecedor.'}
                            </p>
                        </div>
                    )}

                    <div className="grid sm:grid-cols-2 gap-6 mt-2">
                        <SignatureBlock
                            label="Fornecedor"
                            organization="LynxEMS Sistemas"
                            role="Time de Desenvolvimento"
                            signatureData={signFornecedor}
                            onClickSign={() => setSignModal('fornecedor')}
                        />
                        <SignatureBlock
                            label="Cliente"
                            organization="Metalfisa Indústria"
                            role="Responsável pelo Recebimento"
                            signatureData={signCliente}
                            onClickSign={() => setSignModal('cliente')}
                        />
                    </div>

                    {/* Rodapé */}
                    <div className="mt-5 p-3 rounded-xl bg-blue-50 ring-1 ring-blue-200 text-center">
                        <p className="text-xs text-blue-700">
                            <strong>MetalFisa ERP</strong> · {SYSTEM_VERSION} · Entrega: {DELIVERY_DATE} ·
                            Desenvolvido por <strong>LynxEMS Sistemas</strong>
                        </p>
                    </div>
                </div>

                {/* Botão PDF flutuante (mobile) */}
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 no-print sm:hidden">
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-2xl font-semibold text-sm shadow-2xl hover:bg-blue-700 transition-colors"
                    >
                        <Download className="w-4 h-4" />
                        Exportar PDF
                    </button>
                </div>

            </div>
        </div>
    );
}
