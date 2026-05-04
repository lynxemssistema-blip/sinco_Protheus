import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Settings as SettingsIcon, Menu, Package, Factory, Truck, LogOut, BarChart, Calendar, FileText, Building2, HelpCircle } from 'lucide-react';
import { FilterProvider } from './contexts/FilterContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TimerProvider } from './contexts/TimerContext';
import { useHelp } from './contexts/HelpContext';
import { HelpProvider } from './contexts/HelpProvider';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Core components (eagerly loaded — used on every page)
import Sidebar from './components/Sidebar';
import FloatingAvisos from './components/FloatingAvisos';
import GlobalTimerWidget from './components/GlobalTimerWidget';
import HelpDrawer from './components/HelpDrawer';
import EmailBlockerModal from './components/EmailBlockerModal';

// Lazy-loaded pages (code splitting — each becomes a separate chunk)
const OrdersTable = React.lazy(() => import('./components/OrdersTable'));
const VisaoGerencialAtrasos = React.lazy(() => import('./pages/gerencial/VisaoGerencialAtrasos'));
const VisaoGerencialProdutos = React.lazy(() => import('./pages/gerencial/VisaoGerencialProdutos'));
const ProductStructure = React.lazy(() => import('./pages/ProductStructure'));
const ProductionOrders = React.lazy(() => import('./pages/ProductionOrders'));
const ProductionOrdersByOp = React.lazy(() => import('./pages/ProductionOrdersByOp'));
const ProductCatalog = React.lazy(() => import('./pages/ProductCatalog'));
const Romaneios = React.lazy(() => import('./pages/Romaneios'));
const RecebimentoRomaneios = React.lazy(() => import('./pages/RecebimentoRomaneios'));
const BOMGenerator = React.lazy(() => import('./pages/BOMGenerator'));
const Login = React.lazy(() => import('./pages/Login'));
const Settings = React.lazy(() => import('./pages/Settings'));
const ProductionControl = React.lazy(() => import('./pages/ProductionControl'));
const ProductionAnalytics = React.lazy(() => import('./pages/ProductionAnalytics'));
const ProductionMatrixPage = React.lazy(() => import('./pages/ProductionMatrixPage'));
const VerticalAppointmentPage = React.lazy(() => import('./pages/VerticalAppointmentPage'));
const ConferenciaPage = React.lazy(() => import('./pages/ConferenciaPage'));
const EngineeringOrdersPage = React.lazy(() => import('./pages/EngineeringOrdersPage'));
const ProductionGanttPlanning = React.lazy(() => import('./pages/ProductionGanttPlanning'));
const StockBalances = React.lazy(() => import('./pages/StockBalances'));
const PurchaseRequests = React.lazy(() => import('./pages/PurchaseRequests'));
const PurchaseOrdersWithClientPO = React.lazy(() => import('./pages/PurchaseOrdersWithClientPO'));
const PurchaseFlowToInvoice = React.lazy(() => import('./pages/PurchaseFlowToInvoice'));
const Reports = React.lazy(() => import('./pages/Reports'));
const SGQDashboard = React.lazy(() => import('./pages/SGQDashboard'));
const SGQTraining = React.lazy(() => import('./pages/SGQTraining'));
const SGQDocuments = React.lazy(() => import('./pages/SGQDocuments'));
const MapeamentoProcessos = React.lazy(() => import('./pages/sgq/MapeamentoProcessos'));
const CargosFuncoes = React.lazy(() => import('./pages/sgq/CargosFuncoes'));
const CurriculosAnalyzer = React.lazy(() => import('./pages/rh/CurriculosAnalyzer'));
const VagasManager = React.lazy(() => import('./pages/rh/VagasManager'));
const HelpCenter = React.lazy(() => import('./pages/HelpCenter'));
const MaterialManagementPage = React.lazy(() => import('./pages/MaterialManagementPage'));
const WhereUsedPage = React.lazy(() => import('./pages/WhereUsedPage'));
const ServiceOrdersPage = React.lazy(() => import('./pages/sinco/ServiceOrdersPage'));
const ServiceOrderProductionAppointmentPage = React.lazy(() => import('./pages/sinco/ServiceOrderProductionAppointmentPage'));
const ServiceOrderProductionMatrixPage = React.lazy(() => import('./pages/sinco/ServiceOrderProductionMatrixPage'));
const ServiceOrderMaterialsPage = React.lazy(() => import('./pages/sinco/ServiceOrderMaterialsPage'));
const SINCOActiveDrawing = React.lazy(() => import('./pages/SINCO/SINCOActiveDrawing'));
const TrackingEvolution = React.lazy(() => import('./pages/production/TrackingEvolution'));
const SINCOFormularioPrincipal = React.lazy(() => import('./pages/sinco/SINCOFormularioPrincipal'));
const DashboardFinanceiro = React.lazy(() => import('./pages/financeiro/DashboardFinanceiro'));
const ProductionEvolution = React.lazy(() => import('./pages/ProductionEvolution'));
const InternalRequestsPage = React.lazy(() => import('./pages/InternalRequestsPage'));
const SincoApontamentoPorUsuarioPage = React.lazy(() => import('./pages/sinco/SincoApontamentoPorUsuarioPage'));
const ApontamentoPorUsuarioOpPage = React.lazy(() => import('./pages/pcp/ApontamentoPorUsuarioOpPage'));
const IndPcpReleasePage = React.lazy(() => import('./pages/sinco/IndPcpReleasePage'));
const IndFactoryFloorPage = React.lazy(() => import('./pages/sinco/IndFactoryFloorPage'));
const IndApontamentoPage = React.lazy(() => import('./pages/sinco/IndApontamentoPage'));
const AvisosHistorico = React.lazy(() => import('./pages/AvisosHistorico'));
const SINCOProductStructure = React.lazy(() => import('./pages/sinco/SINCOProductStructure'));
const VMIUploadPage = React.lazy(() => import('./pages/vmi/VMIUploadPage'));
const VMIDashboardPage = React.lazy(() => import('./pages/vmi/VMIDashboardPage'));
const VMIEstrategiaPage = React.lazy(() => import('./pages/vmi/VMIEstrategiaPage'));
const VMIHistoricoPage = React.lazy(() => import('./pages/vmi/VMIHistoricoPage'));
const DemandaVMIContainer = React.lazy(() => import('./pages/vmi/DemandaVMIContainer'));
const VMIPedidosContainer = React.lazy(() => import('./pages/vmi/VMIPedidosContainer'));
const SWorks = React.lazy(() => import('./pages/SWorks'));
const ProtheusStudyChat = React.lazy(() => import('./pages/admin/ProtheusStudyChat'));
const ItensAFaturar = React.lazy(() => import('./pages/ItensAFaturar'));
const GestaoOPsPage = React.lazy(() => import('./pages/GestaoOPsPage'));
const FaturamentoSolicitacoesHistorico = React.lazy(() => import('./pages/FaturamentoSolicitacoesHistorico'));
const FaturamentoPainel = React.lazy(() => import('./pages/FaturamentoPainel'));
const ControleFaturamento = React.lazy(() => import('./pages/ControleFaturamento'));
const DashboardFaturamento = React.lazy(() => import('./pages/comercial/DashboardFaturamento'));
const FluxoCaixa = React.lazy(() => import('./pages/financeiro/FluxoCaixa'));
const ProtheusOverview = React.lazy(() => import('./pages/protheus/ProtheusOverview'));
const EngineeringReleaseReport = React.lazy(() => import('./pages/EngineeringReleaseReport'));
const PlanejamentoEstruturaRouting = React.lazy(() => import('./pages/pcp/PlanejamentoEstruturaRouting'));
const EngineeringControlReport = React.lazy(() => import('./pages/EngineeringControlReport'));
const SetoresCadastro = React.lazy(() => import('./pages/pcp/SetoresCadastro'));
const SetoresRecursos = React.lazy(() => import('./pages/pcp/SetoresRecursos'));
const VisaoSetores = React.lazy(() => import('./pages/pcp/VisaoSetores'));
const CurvaSPedido = React.lazy(() => import('./pages/pcp/CurvaSPedido'));

const PlanoContas = React.lazy(() => import('./pages/PlanoContas'));
const Balancete = React.lazy(() => import('./pages/financeiro/Balancete'));
const PPAPsBuscarProduto = React.lazy(() => import('./pages/PPAPsBuscarProduto'));
const MeuCanal = React.lazy(() => import('./pages/MeuCanal'));

import { MENU_GROUPS } from './config/menuItems';

// Build path → pageId mapping from MENU_GROUPS
const PATH_TO_PAGE_ID = {};
MENU_GROUPS.forEach(group => {
    group.items.forEach(item => {
        PATH_TO_PAGE_ID[item.path] = item.id;
    });
});

// Private Route Component with permission guard
const PrivateRoute = () => {
    const { signed, loading, user, hasPermission, isAdmin } = useAuth();
    const location = useLocation();

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
    }

    if (!signed) return <Navigate to="/login" />;

    // Find pageId for current path
    const pageId = PATH_TO_PAGE_ID[location.pathname];

    // If there's a mapped page and user is NOT admin,    // Check permissions
    if (pageId && pageId !== 'protheus-estudo' && !isAdmin && !hasPermission(pageId, 'view')) {
        // allow basic access fallback if no specific page found?     
        return (
            <Layout>
                <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v.01M12 9v2m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800">Acesso Negado</h2>
                    <p className="text-slate-500 mt-2 max-w-md">Você não tem permissão para acessar esta página. Solicite ao administrador que libere o acesso.</p>
                </div>
            </Layout>
        );
    }

    return <Outlet />;
};

// MÓDULO DE MANUTENÇÃO
const ManutencaoDashboard = React.lazy(() => import('./pages/manutencao/Dashboard'));
const ManutencaoMaquinas = React.lazy(() => import('./pages/manutencao/Maquinas'));
const ManutencaoChecklists = React.lazy(() => import('./pages/manutencao/Checklists'));
const ManutencaoOrdens = React.lazy(() => import('./pages/manutencao/Ordens'));
const ManutencaoTecnicos = React.lazy(() => import('./pages/manutencao/Tecnicos'));
const ManutencaoAtividades = React.lazy(() => import('./pages/manutencao/Atividades'));
const GestaoMateriais = React.lazy(() => import('./pages/manutencao/GestaoMateriais'));

const Layout = ({ children, fullWidth = true }) => {
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
    const { toggleHelp, isOpen, isPinned } = useHelp();
    const location = useLocation();

    // Check if we are on mobile to pass to Sidebar
    const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);

    React.useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Auto-close sidebar on mobile when navigating
    React.useEffect(() => {
        if (isMobile && isSidebarOpen) {
            setIsSidebarOpen(false);
        }
    }, [location.pathname, isMobile]);

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-900 flex print:block">

            <Sidebar
                isOpen={isSidebarOpen}
                setIsOpen={setIsSidebarOpen}
                isMobile={isMobile}
            />

            {/* Main Content */}
            <main className={`flex-1 flex flex-col h-screen overflow-hidden w-full transition-all duration-300 relative ${isOpen && isPinned && !isMobile ? 'pr-[420px]' : ''}`}>
                <EmailBlockerModal />
                <FloatingAvisos />
                <HelpDrawer />

                {/* Topbar Mobile */}
                <header className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between sticky top-0 z-30 print:hidden">
                    <h1 className="text-lg font-bold text-slate-900">MetalFisa PCP</h1>
                    <button
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        onClick={() => setIsSidebarOpen(true)}
                    >
                        <Menu className="h-6 w-6" />
                    </button>
                </header>

                {/* Scrollable Area */}
                <div className="flex-1 overflow-auto p-2 md:p-4 w-full print:overflow-visible print:h-auto print:p-0">
                    <div className={`${fullWidth ? 'w-full' : 'max-w-7xl mx-auto'} space-y-6`}>
                        {children}
                    </div>
                </div>

                {/* Floating Help Button — visible on every page */}
                <button
                    onClick={toggleHelp}
                    title="Ajuda desta tela"
                    aria-label="Abrir ajuda contextual"
                    className="fixed bottom-6 right-6 z-[990] w-12 h-12 rounded-full bg-slate-900 text-white shadow-2xl hover:bg-blue-600 flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 print:hidden"
                >
                    <HelpCircle className="h-5 w-5" />
                </button>
            </main>
        </div>
    );
};

function App() {
    return (
        <AuthProvider>
            <FilterProvider>
                <TimerProvider>
                    <HelpProvider>
                        <BrowserRouter>
                            <Suspense fallback={
                                <div className="min-h-screen flex items-center justify-center bg-gray-50">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                                        <span className="text-sm text-gray-500 font-medium">Carregando...</span>
                                    </div>
                                </div>
                            }>
                                <Routes>
                                    <Route path="/login" element={<Login />} />

                                    <Route element={<PrivateRoute />}>
                                        <Route path="/manutencao/maquinas" element={<Layout><ManutencaoMaquinas /></Layout>} />
                                        <Route path="/manutencao/checklists" element={<Layout><ManutencaoChecklists /></Layout>} />
                                        <Route path="/manutencao/ordens" element={<Layout><ManutencaoOrdens /></Layout>} />
                                        <Route path="/manutencao/tecnicos" element={<Layout><ManutencaoTecnicos /></Layout>} />
                                        <Route path="/" element={
                                            <Layout fullWidth={true}>
                                                <MeuCanal />
                                            </Layout>
                                        } />
                                        <Route path="/visao-geral" element={
                                            <Layout fullWidth={true}>
                                                <OrdersTable />
                                            </Layout>
                                        } />
                                        <Route path="/comercial/gestao-ops" element={
                                            <Layout fullWidth={true}>
                                                <GestaoOPsPage />
                                            </Layout>
                                        } />
                                        {/* Visões Gerenciais */}
                                        <Route path="/comercial/atrasos" element={
                                            <Layout fullWidth={true}>
                                                <VisaoGerencialAtrasos />
                                            </Layout>
                                        } />
                                        <Route path="/pcp/visao-fabrica" element={
                                            <Layout fullWidth={true}>
                                                <VisaoGerencialProdutos />
                                            </Layout>
                                        } />
                                        <Route path="/produtos" element={
                                            <Layout>
                                                <ProductCatalog />
                                            </Layout>
                                        } />
                                        <Route path="/producao" element={
                                            <Layout>
                                                <ProductionOrders />
                                            </Layout>
                                        } />
                                        <Route path="/producao/op" element={
                                            <Layout>
                                                <ProductionOrdersByOp />
                                            </Layout>
                                        } />
                                        <Route path="/estrutura/:codigo" element={
                                            <Layout>
                                                <ProductStructure />
                                            </Layout>
                                        } />
                                        <Route path="/bom-generator" element={
                                            <Layout>
                                                <BOMGenerator />
                                            </Layout>
                                        } />
                                        <Route path="/rh/vagas" element={
                                            <Layout fullWidth={true}>
                                                <VagasManager />
                                            </Layout>
                                        } />
                                        <Route path="/rh/curriculos" element={
                                            <Layout fullWidth={true}>
                                                <CurriculosAnalyzer />
                                            </Layout>
                                        } />
                                        <Route path="/engenharia/pedidos" element={
                                            <Layout fullWidth={true}>
                                                <EngineeringOrdersPage />
                                            </Layout>
                                        } />
                                        <Route path="/engenharia/relatorio-liberacao" element={
                                            <Layout fullWidth={true}>
                                                <EngineeringReleaseReport />
                                            </Layout>
                                        } />
                                        <Route path="/engenharia/relatorio-controle" element={
                                            <Layout fullWidth={true}>
                                                <EngineeringControlReport />
                                            </Layout>
                                        } />
                                        <Route path="/bom/:codigo" element={
                                            <Layout>
                                                <BOMGenerator />
                                            </Layout>
                                        } />
                                        <Route path="/romaneios" element={
                                            <Layout>
                                                <Romaneios />
                                            </Layout>
                                        } />
                                        <Route path="/recebimentos" element={
                                            <Layout>
                                                <RecebimentoRomaneios />
                                            </Layout>
                                        } />
                                        <Route path="/saldo-materiais" element={
                                            <Layout>
                                                <StockBalances />
                                            </Layout>
                                        } />
                                        <Route path="/solicitacoes-compras" element={
                                            <Layout>
                                                <PurchaseRequests />
                                            </Layout>
                                        } />
                                        <Route path="/pedidos-compras-pv" element={
                                            <Layout>
                                                <PurchaseOrdersWithClientPO />
                                            </Layout>
                                        } />
                                        <Route path="/fluxo-compras-nf" element={
                                            <Layout>
                                                <PurchaseFlowToInvoice />
                                            </Layout>
                                        } />
                                        <Route path="/suprimentos/requisicoes" element={
                                            <Layout>
                                                <InternalRequestsPage />
                                            </Layout>
                                        } />
                                        <Route path="/controle-producao" element={
                                            <Layout fullWidth={true}>
                                                <ProductionControl />
                                            </Layout>
                                        } />
                                        <Route path="/producao-matrix" element={
                                            <Layout fullWidth={true}>
                                                <ProductionMatrixPage />
                                            </Layout>
                                        } />
                                        <Route path="/pcp/apontamento-vertical" element={
                                            <Layout fullWidth={true}>
                                                <VerticalAppointmentPage />
                                            </Layout>
                                        } />
                                        <Route path="/pcp/conferencia" element={
                                            <Layout>
                                                <ConferenciaPage />
                                            </Layout>
                                        } />
                                        <Route path="/visao-producao" element={
                                            <Layout>
                                                <ProductionAnalytics />
                                            </Layout>
                                        } />
                                        <Route path="/pcp/evolucao-apontamento" element={
                                            <Layout fullWidth={true}>
                                                <TrackingEvolution />
                                            </Layout>
                                        } />
                                        <Route path="/analytics/evolucao" element={
                                            <Layout fullWidth={true}>
                                                <ProductionEvolution />
                                            </Layout>
                                        } />
                                        <Route path="/planejamento-gantt" element={
                                            <Layout>
                                                <ProductionGanttPlanning />
                                            </Layout>
                                        } />
                                        <Route path="/configuracoes" element={
                                            <Layout>
                                                <Settings />
                                            </Layout>
                                        } />
                                        <Route path="/producao/relatorios" element={
                                            <Layout>
                                                <Reports />
                                            </Layout>
                                        } />
                                        <Route path="/relatorios" element={
                                            <Layout>
                                                <Reports />
                                            </Layout>
                                        } />
                                        <Route path="/sgq" element={
                                            <Layout>
                                                <SGQDashboard />
                                            </Layout>
                                        } />
                                        <Route path="/sgq/mapeamento-processos" element={
                                            <Layout fullWidth={true}>
                                                <MapeamentoProcessos />
                                            </Layout>
                                        } />
                                        <Route path="/sgq/cargos-funcoes" element={
                                            <Layout fullWidth={true}>
                                                <CargosFuncoes />
                                            </Layout>
                                        } />
                                        <Route path="/sgq/documentos" element={
                                            <SGQDocuments />
                                        } />
                                        <Route path="/sgq/nao-conformidades" element={
                                            <Layout>
                                                <div className="p-8 text-center text-gray-500">Módulo em desenvolvimento: Não Conformidades</div>
                                            </Layout>
                                        } />
                                        <Route path="/sgq/treinamento" element={
                                            <Layout>
                                                <SGQTraining />
                                            </Layout>
                                        } />
                                        <Route path="/sgq/auditorias" element={
                                            <Layout>
                                                <div className="p-8 text-center text-gray-500">Módulo em desenvolvimento: Auditorias</div>
                                            </Layout>
                                        } />
                                        <Route path="/sgq/calibracoes" element={
                                            <Layout>
                                                <div className="p-8 text-center text-gray-500">Módulo em desenvolvimento: Calibrações</div>
                                            </Layout>
                                        } />
                                        <Route path="/sgq/indicadores" element={
                                            <Layout>
                                                <div className="p-8 text-center text-gray-500">Módulo em desenvolvimento: Indicadores</div>
                                            </Layout>
                                        } />
                                        <Route path="/ajuda" element={
                                            <Layout>
                                                <HelpCenter />
                                            </Layout>
                                        } />
                                        <Route path="/avisos" element={
                                            <Layout>
                                                <AvisosHistorico />
                                            </Layout>
                                        } />

                                        {/* Itens Faturar - Comercial/Vendas */}
                                        <Route path="/vendas/itens-faturar" element={
                                            <Layout fullWidth={true}>
                                                <Suspense fallback={<div className="p-8 text-center text-gray-500">Carregando itens a faturar...</div>}>
                                                    <ItensAFaturar />
                                                </Suspense>
                                            </Layout>
                                        } />

                                        {/* Dashboard Gerencial de Faturamento */}
                                        <Route path="/comercial/dashboard-faturamento" element={
                                            <Layout fullWidth={true}>
                                                <Suspense fallback={<div className="p-8 text-center text-gray-500">Carregando dashboard...</div>}>
                                                    <DashboardFaturamento />
                                                </Suspense>
                                            </Layout>
                                        } />

                                        {/* Controle de Faturamento Comercial */}
                                        <Route path="/comercial/faturamento" element={
                                            <Layout fullWidth={true}>
                                                <Suspense fallback={<div className="p-8 text-center text-gray-500">Carregando painel de acompanhamento...</div>}>
                                                    <ControleFaturamento />
                                                </Suspense>
                                            </Layout>
                                        } />

                                        <Route path="/vendas/faturamento-historico" element={
                                            <Layout fullWidth={true}>
                                                <Suspense fallback={<div className="p-8 text-center text-gray-500">Carregando histórico...</div>}>
                                                    <FaturamentoSolicitacoesHistorico />
                                                </Suspense>
                                            </Layout>
                                        } />

                                        {/* Financeiro / Faturamento */}
                                        <Route path="/financeiro/dashboard" element={
                                            <Layout fullWidth={true}>
                                                <Suspense fallback={<div className="p-8 flex-col items-center justify-center min-h-screen text-center flex"><div className="h-8 w-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /><div className="mt-4 text-slate-500">Carregando Módulo Financeiro...</div></div>}>
                                                    <DashboardFinanceiro />
                                                </Suspense>
                                            </Layout>
                                        } />
                                        <Route path="/financeiro/fluxo-caixa" element={
                                            <Layout fullWidth={true}>
                                                <Suspense fallback={<div className="p-8 text-center text-gray-500">Carregando fluxo de caixa...</div>}>
                                                    <FluxoCaixa />
                                                </Suspense>
                                            </Layout>
                                        } />
                                        <Route path="/financeiro/faturamento" element={
                                            <Layout fullWidth={true}>
                                                <Suspense fallback={<div className="p-8 text-center text-gray-500">Carregando painel financeiro...</div>}>
                                                    <FaturamentoPainel />
                                                </Suspense>
                                            </Layout>
                                        } />
                                        <Route path="/financeiro/plano-contas" element={
                                            <Layout fullWidth={true}>
                                                <Suspense fallback={<div className="p-8 text-center text-gray-500">Carregando plano de contas...</div>}>
                                                    <PlanoContas />
                                                </Suspense>
                                            </Layout>
                                        } />
                                        <Route path="/financeiro/balancete" element={
                                            <Layout fullWidth={true}>
                                                <Suspense fallback={<div className="p-8 text-center text-gray-500">Carregando balancete dinâmico...</div>}>
                                                    <Balancete />
                                                </Suspense>
                                            </Layout>
                                        } />
                                        <Route path="/admin/protheus-estudo" element={
                                            <Layout fullWidth={true}>
                                                <ProtheusStudyChat />
                                            </Layout>
                                        } />
                                        <Route path="/pcp/gestao-materiais" element={<MaterialManagementPage />} />
                                        <Route path="/pcp/onde-usado" element={<WhereUsedPage />} />

                                        {/* Sinco Routs */}
                                        <Route path="/engenharia/sinco/os" element={
                                            <Layout>
                                                <ServiceOrdersPage />
                                            </Layout>
                                        } />
                                        <Route path="/engenharia/sinco/estrutura" element={
                                            <Layout fullWidth={true}>
                                                <SINCOProductStructure />
                                            </Layout>
                                        } />
                                        <Route path="/engenharia/sinco/apontamento" element={
                                            <Layout fullWidth={true}>
                                                <ServiceOrderProductionAppointmentPage />
                                            </Layout>
                                        } />
                                        <Route path="/engenharia/sinco/apontamento-matrix" element={
                                            <Layout fullWidth={true}>
                                                <ServiceOrderProductionMatrixPage />
                                            </Layout>
                                        } />
                                        <Route path="/engenharia/sinco/materiais" element={
                                            <Layout fullWidth={true}>
                                                <ServiceOrderMaterialsPage />
                                            </Layout>
                                        } />
                                        <Route path="/sinco/desenho-ativo" element={
                                            <Layout>
                                                <SINCOActiveDrawing />
                                            </Layout>
                                        } />
                                        <Route path="/engenharia/sinco/formulario" element={
                                            <Layout fullWidth={true}>
                                                <SINCOFormularioPrincipal />
                                            </Layout>
                                        } />
                                        <Route path="/pcp/apontamento-por-usuario" element={
                                            <Layout fullWidth={true}>
                                                <SincoApontamentoPorUsuarioPage />
                                            </Layout>
                                        } />
                                        <Route path="/pcp/extrato-op" element={
                                            <Layout fullWidth={true}>
                                                <ApontamentoPorUsuarioOpPage />
                                            </Layout>
                                        } />
                                        <Route path="/pcp/planejamento-estrutura-routing" element={
                                            <Layout fullWidth={true}>
                                                <PlanejamentoEstruturaRouting />
                                            </Layout>
                                        } />
                                        <Route path="/sworks" element={
                                            <Layout fullWidth={true}>
                                                <SWorks />
                                            </Layout>
                                        } />

                                        {/* VMI Routes */}
                                        <Route path="/vmi/forecast" element={
                                            <Layout fullWidth={true}>
                                                <DemandaVMIContainer />
                                            </Layout>
                                        } />
                                        <Route path="/vmi/pedido" element={
                                            <Layout fullWidth={true}>
                                                <VMIPedidosContainer />
                                            </Layout>
                                        } />
                                        <Route path="/vmi/leitura" element={
                                            <Layout fullWidth={true}>
                                                <VMIUploadPage />
                                            </Layout>
                                        } />
                                        <Route path="/vmi/dashboard" element={
                                            <Layout fullWidth={true}>
                                                <VMIDashboardPage />
                                            </Layout>
                                        } />
                                        <Route path="/vmi/estrategia" element={
                                            <Layout fullWidth={true}>
                                                <VMIEstrategiaPage />
                                            </Layout>
                                        } />
                                        <Route path="/vmi/historico" element={
                                            <Layout fullWidth={true}>
                                                <VMIHistoricoPage />
                                            </Layout>
                                        } />

                                        {/* Modulo Independente Fracionamento */}
                                        <Route path="/ind-pcp-release" element={
                                            <Layout fullWidth={true}>
                                                <IndPcpReleasePage />
                                            </Layout>
                                        } />
                                        <Route path="/ind-factory-floor" element={
                                            <Layout fullWidth={true}>
                                                <IndFactoryFloorPage />
                                            </Layout>
                                        } />
                                        <Route path="/ind-apontamento" element={
                                            <Layout fullWidth={true}>
                                                <IndApontamentoPage />
                                            </Layout>
                                        } />

                                        {/* Protheus Forms */}
                                        <Route path="/protheus" element={
                                            <Layout>
                                                <ProtheusOverview />
                                            </Layout>
                                        } />
                                        {/* PCP Setor — Cadastro, Recursos e Visão Gerencial */}
                                        <Route path="/pcp/setores" element={
                                            <Layout fullWidth={true}>
                                                <SetoresCadastro />
                                            </Layout>
                                        } />
                                        <Route path="/pcp/setores/recursos" element={
                                            <Layout fullWidth={true}>
                                                <SetoresRecursos />
                                            </Layout>
                                        } />
                                        <Route path="/pcp/visao-setores" element={
                                            <Layout fullWidth={true}>
                                                <VisaoSetores />
                                            </Layout>
                                        } />
                                        <Route path="/pcp/curva-s" element={
                                            <Layout fullWidth={true}>
                                                <CurvaSPedido />
                                            </Layout>
                                        } />
                                        {/* PPAPs Routes */}
                                        <Route path="/ppaps/buscar-produto" element={
                                            <Layout fullWidth={true}>
                                                <PPAPsBuscarProduto />
                                            </Layout>
                                        } />

                                        {/* MÓDULO DE MANUTENÇÃO */}
                                        <Route path="/manutencao/dashboard" element={
                                            <Layout fullWidth={true}>
                                                <ManutencaoDashboard />
                                            </Layout>
                                        } />
                                        <Route path="/manutencao/maquinas" element={
                                            <Layout fullWidth={true}>
                                                <ManutencaoMaquinas />
                                            </Layout>
                                        } />
                                        <Route path="/manutencao/checklists" element={
                                            <Layout fullWidth={true}>
                                                <ManutencaoChecklists />
                                            </Layout>
                                        } />
                                        <Route path="/manutencao/ordens" element={
                                            <Layout fullWidth={true}>
                                                <ManutencaoOrdens />
                                            </Layout>
                                        } />
                                        <Route path="/manutencao/atividades" element={
                                            <Layout fullWidth={true}>
                                                <ManutencaoAtividades />
                                            </Layout>
                                        } />
                                        <Route path="/manutencao/materiais" element={
                                            <Layout fullWidth={true}>
                                                <GestaoMateriais />
                                            </Layout>
                                        } />
                                    </Route>

                                </Routes>
                            </Suspense>
                        </BrowserRouter>
                    </HelpProvider>
                </TimerProvider>
            </FilterProvider>
            <ToastContainer
                position="bottom-right"
                autoClose={4000}
                hideProgressBar={false}
                newestOnTop
                closeOnClick
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="colored"
            />
        </AuthProvider>
    )
}

export default App;
