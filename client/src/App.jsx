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
import GlobalConfirmProvider from './components/GlobalConfirm';

// Core components (eagerly loaded — used on every page)
import Sidebar from './components/Sidebar';
import FloatingAvisos from './components/FloatingAvisos';
import GlobalTimerWidget from './components/GlobalTimerWidget';
import HelpDrawer from './components/HelpDrawer';
import EmailBlockerModal from './components/EmailBlockerModal';
import HermesFeed from './components/HermesFeed';
import PCPMetalDrawer from './components/PCPMetalDrawer';
import TenantTopBar from './components/TenantTopBar';

const GestaoColaboradores = React.lazy(() => import('./pages/empresa/GestaoColaboradores'));
const SuperadminEmpresas = React.lazy(() => import('./pages/admin/SuperadminEmpresas'));

// Módulos Corporativos (100% MySQL)
const SalasReuniaoCentral = React.lazy(() => import('./pages/reunioes/SalasReuniaoCentral'));
const TotemPortaModal = React.lazy(() => import('./pages/reunioes/TotemPortaModal'));
const SSTCentral = React.lazy(() => import('./pages/sst/SSTCentral'));
const SSTCestaBasica = React.lazy(() => import('./pages/sst/SSTCestaBasica'));
const PastaColaborador = React.lazy(() => import('./pages/rh/PastaColaborador'));
const PortalColaborador = React.lazy(() => import('./pages/rh/PortalColaborador'));
const SuporteCentral = React.lazy(() => import('./pages/suporte/SuporteCentral'));

// Lazy-loaded pages (code splitting — each becomes a separate chunk)
const OrdersTable = React.lazy(() => import('./components/OrdersTable'));
const VisaoGerencialAtrasos = React.lazy(() => import('./pages/gerencial/VisaoGerencialAtrasos'));
const VisaoGerencialProdutos = React.lazy(() => import('./pages/gerencial/VisaoGerencialProdutos'));
const ProductStructure = React.lazy(() => import('./pages/ProductStructure'));
const ProductionOrdersByOp = React.lazy(() => import('./pages/ProductionOrdersByOp'));
const ProductCatalog = React.lazy(() => import('./pages/ProductCatalog'));
const MSMetalProductStructure = React.lazy(() => import('./pages/msmetal/MSMetalProductStructure'));
const Romaneios = React.lazy(() => import('./pages/Romaneios'));
const RecebimentoRomaneios = React.lazy(() => import('./pages/RecebimentoRomaneios'));
const FornecedorPortal = React.lazy(() => import('./pages/logistica/FornecedorPortal'));
const FornecedorRomaneioDetalhes = React.lazy(() => import('./pages/logistica/FornecedorRomaneioDetalhes'));
const BOMGenerator = React.lazy(() => import('./pages/BOMGenerator'));
const Login = React.lazy(() => import('./pages/Login'));
const Settings = React.lazy(() => import('./pages/Settings'));
const ProductionControl = React.lazy(() => import('./pages/ProductionControl'));
const ProductionAnalytics = React.lazy(() => import('./pages/ProductionAnalytics'));
const ProductionMatrixPage = React.lazy(() => import('./pages/ProductionMatrixPage'));
const BOMAppointmentPage   = React.lazy(() => import('./pages/BOMAppointmentPage'));
const VerticalAppointmentPage = React.lazy(() => import('./pages/VerticalAppointmentPage'));
const EngineeringOrdersPage = React.lazy(() => import('./pages/EngineeringOrdersPage'));
const ProductionGanttPlanning = React.lazy(() => import('./pages/ProductionGanttPlanning'));
const StockBalances = React.lazy(() => import('./pages/StockBalances'));
const PurchaseRequests = React.lazy(() => import('./pages/PurchaseRequests'));
const PurchaseOrdersWithClientPO = React.lazy(() => import('./pages/PurchaseOrdersWithClientPO'));
const PurchaseFlowToInvoice = React.lazy(() => import('./pages/PurchaseFlowToInvoice'));
const Reports = React.lazy(() => import('./pages/Reports'));
const SGQDashboard = React.lazy(() => import('./pages/sgq/Dashboard'));
const SGQAtivos = React.lazy(() => import('./pages/sgq/GestaoAtivos'));
const SGQCaixas = React.lazy(() => import('./pages/sgq/CaixasFerramenta'));
const SGQRomaneios = React.lazy(() => import('./pages/sgq/Romaneios'));
const SGQTraining = React.lazy(() => import('./pages/sgq/Treinamentos'));
const SGQDocuments = React.lazy(() => import('./pages/sgq/Documentos'));
const MapeamentoProcessos = React.lazy(() => import('./pages/sgq/MapeamentoProcessos'));
const CargosFuncoes = React.lazy(() => import('./pages/sgq/CargosFuncoes'));
const ControleCalibracao = React.lazy(() => import('./pages/sgq/ControleCalibracao'));
const NaoConformidades = React.lazy(() => import('./pages/sgq/NaoConformidades'));
const GestaoRNCs = React.lazy(() => import('./pages/sgq/GestaoRNCs'));
const CurriculosAnalyzer = React.lazy(() => import('./pages/rh/CurriculosAnalyzer'));
const VagasManager = React.lazy(() => import('./pages/rh/VagasManager'));
const OffboardingRH = React.lazy(() => import('./pages/rh/OffboardingRH'));
const HelpCenter = React.lazy(() => import('./pages/HelpCenter'));
const NovasFuncionalidades = React.lazy(() => import('./pages/NovasFuncionalidades'));
const MaterialManagementPage = React.lazy(() => import('./pages/MaterialManagementPage'));
const WhereUsedPage = React.lazy(() => import('./pages/WhereUsedPage'));
const SINCOFormularioPrincipal = React.lazy(() => import('./pages/sinco/SINCOFormularioPrincipal'));
const SolidEdeg_Estrutura_Produto = React.lazy(() => import('./pages/sinco/SolidEdeg_Estrutura_Produto'));
const DashboardFinanceiro = React.lazy(() => import('./pages/financeiro/DashboardFinanceiro'));
const ProductionEvolution = React.lazy(() => import('./pages/ProductionEvolution'));
const InternalRequestsPage = React.lazy(() => import('./pages/InternalRequestsPage'));
const ApontamentoPorUsuarioOpPage = React.lazy(() => import('./pages/pcp/ApontamentoPorUsuarioOpPage'));
const IndPcpReleasePage = React.lazy(() => import('./pages/sinco/IndPcpReleasePage'));
const IndFactoryFloorPage = React.lazy(() => import('./pages/sinco/IndFactoryFloorPage'));
const IndApontamentoPage = React.lazy(() => import('./pages/sinco/IndApontamentoPage'));
const AvisosHistorico = React.lazy(() => import('./pages/AvisosHistorico'));


const ItensAFaturar = React.lazy(() => import('./pages/ItensAFaturar'));
const GestaoOPsPage = React.lazy(() => import('./pages/GestaoOPsPage'));
const FaturamentoSolicitacoesHistorico = React.lazy(() => import('./pages/FaturamentoSolicitacoesHistorico'));
const FaturamentoPainel = React.lazy(() => import('./pages/FaturamentoPainel'));
const ErpProdutosPage = React.lazy(() => import('./pages/erp/ErpProdutosPage'));
const CadastrosBasicosPage = React.lazy(() => import('./pages/cadastros/CadastrosBasicosPage'));
const ErpPedidosPage = React.lazy(() => import('./pages/erp/ErpPedidosPage'));
const ErpClientesPage = React.lazy(() => import('./pages/erp/ErpClientesPage'));
const ErpProducaoPage = React.lazy(() => import('./pages/erp/ErpProducaoPage'));
const ControleFaturamento = React.lazy(() => import('./pages/ControleFaturamento'));
const DashboardFaturamento = React.lazy(() => import('./pages/comercial/DashboardFaturamento'));
const FluxoCaixa = React.lazy(() => import('./pages/financeiro/FluxoCaixa'));
const EngineeringReleaseReport = React.lazy(() => import('./pages/EngineeringReleaseReport'));
const PlanejamentoEstruturaRouting = React.lazy(() => import('./pages/pcp/PlanejamentoEstruturaRouting'));
const EngineeringControlReport = React.lazy(() => import('./pages/EngineeringControlReport'));
const PlanejamentoAvancado = React.lazy(() => import('./pages/pcp/PlanejamentoAvancado'));
const SetoresCadastro = React.lazy(() => import('./pages/pcp/SetoresCadastro'));
const RecursosCadastro = React.lazy(() => import('./pages/pcp/RecursosCadastro'));
const SetoresRecursos = React.lazy(() => import('./pages/pcp/SetoresRecursos'));
const VisaoSetores = React.lazy(() => import('./pages/pcp/VisaoSetores'));
const CurvaSPedido = React.lazy(() => import('./pages/pcp/CurvaSPedido'));
const PcpFilaDependencias = React.lazy(() => import('./pages/pcp/PcpFilaDependencias'));
const ControleExecucao = React.lazy(() => import('./pages/pcp/ControleExecucao'));
const ProgramasNCN = React.lazy(() => import('./pages/pcp/ProgramasNCN'));
const MontagemSolicitacoes = React.lazy(() => import('./pages/pcp/MontagemSolicitacoes'));
const TesteOCR = React.lazy(() => import('./pages/TesteOCR'));

const PlanoContas = React.lazy(() => import('./pages/PlanoContas'));
const Balancete = React.lazy(() => import('./pages/financeiro/Balancete'));
const PPAPsBuscarProduto = React.lazy(() => import('./pages/PPAPsBuscarProduto'));
const MeuCanal = React.lazy(() => import('./pages/MeuCanal'));

const Analise3DPage = React.lazy(() => import('./pages/Analise3DPage'));
const CapacidadeRecursos = React.lazy(() => import('./pages/pcp-refinado/CapacidadeRecursos'));
const TaxaOcupacao = React.lazy(() => import('./pages/pcp-refinado/TaxaOcupacao'));
const RastreabilidadePCP = React.lazy(() => import('./pages/pcp-refinado/RastreabilidadePCP'));
const TVDashboard = React.lazy(() => import('./pages/TVDashboard'));
const CalendarioAtividades = React.lazy(() => import('./pages/CalendarioAtividades'));
const PropostaComercialSuperAdmin = React.lazy(() => import('./pages/admin/PropostaComercialSuperAdmin'));
const PortariaGuaritaPage = React.lazy(() => import('./pages/portaria/PortariaGuaritaPage'));
const PortariaGerencialPage = React.lazy(() => import('./pages/portaria/PortariaGerencialPage'));
const PortariaTurnosPage = React.lazy(() => import('./pages/portaria/PortariaTurnosPage'));
const CIPACentralPage = React.lazy(() => import('./pages/sst/cipa/CIPACentralPage'));
const CIPAUrnaTotemPage = React.lazy(() => import('./pages/sst/cipa/CIPAUrnaTotemPage'));
const BrigadaCentralPage = React.lazy(() => import('./pages/sst/brigada/BrigadaCentralPage'));
const BrigadaInspecaoRapidaPage = React.lazy(() => import('./pages/sst/brigada/BrigadaInspecaoRapidaPage'));


import { MENU_GROUPS } from './config/menuItems';

// Build path → pageId mapping from MENU_GROUPS
const PATH_TO_PAGE_ID = {};
MENU_GROUPS.forEach(group => {
    group.items.forEach(item => {
        PATH_TO_PAGE_ID[item.path] = item.id;
    });
});

// Private Route Component with permission guard
const EspelhoNFViewer = React.lazy(() => import('./pages/suprimentos/EspelhoNFViewer'));
const AuditoriaPC = React.lazy(() => import('./pages/suprimentos/AuditoriaPC'));
import LynxPresentation from './components/LynxPresentation';

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
    if (pageId && pageId !== 'ajuda' && !isAdmin && !hasPermission(pageId, 'view')) {
        const isClient = user?.tipo === 'E' || user?.tipoExterno === 'cliente' || !!user?.idCliente;

        // allow basic access fallback if no specific page found?     
        return (
            <Layout>
                {isClient ? (
                    <LynxPresentation />
                ) : (
                    <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v.01M12 9v2m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800">Acesso Negado</h2>
                        <p className="text-slate-500 mt-2 max-w-md">Você não tem permissão para acessar esta página. Solicite ao administrador que libere o acesso.</p>
                    </div>
                )}
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
    const [isHermesChatOpen, setIsHermesChatOpen] = React.useState(false);
    const { toggleHelp, isOpen, isPinned } = useHelp();
    const location = useLocation();
    const isPortalCliente = location.pathname.startsWith('/portal-cliente');

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
                <TenantTopBar />
                <EmailBlockerModal />
                {!isPortalCliente && <FloatingAvisos />}
                <HelpDrawer />
                {!isPortalCliente && <HermesFeed />}
                {!isPortalCliente && <PCPMetalDrawer isOpen={isHermesChatOpen} onClose={() => setIsHermesChatOpen(false)} />}

                {!isPortalCliente && (
                    <button
                        onClick={() => setIsHermesChatOpen(!isHermesChatOpen)}
                        title="Conversar com o Agente Hermes"
                        className="fixed bottom-[150px] right-6 z-[990] w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-xl transition-all duration-300 flex items-center justify-center print:hidden"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/></svg>
                    </button>
                )}

                {/* Topbar Mobile */}
                <header className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between sticky top-0 z-30 print:hidden">
                    <h1 className="text-lg font-bold text-slate-900">Lynx PCP</h1>
                    <button
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        onClick={() => setIsSidebarOpen(true)}
                    >
                        <Menu className="h-6 w-6" />
                    </button>
                </header>

                {/* Scrollable Area */}
                <div className="flex-1 overflow-auto p-1 md:p-2 w-full print:overflow-visible print:h-auto print:p-0">
                    <div className={`${fullWidth ? 'w-full' : 'max-w-7xl mx-auto'} space-y-2 sm:space-y-3`}>
                        {children}
                    </div>
                </div>

                {/* Floating Help Button — visible on pages except Portal Cliente */}
                {!isPortalCliente && (
                    <button
                        onClick={toggleHelp}
                        title="Ajuda desta tela"
                        aria-label="Abrir ajuda contextual"
                        className="fixed bottom-6 right-6 z-[990] w-12 h-12 rounded-full bg-slate-900 text-white shadow-2xl hover:bg-blue-600 flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 print:hidden"
                    >
                        <HelpCircle className="h-5 w-5" />
                    </button>
                )}
            </main>
        </div>
    );
};

const LandingPage = React.lazy(() => import('./pages/LandingPage'));
const PortalCliente = React.lazy(() => import('./pages/PortalCliente'));

const HelpRoute = () => {
    const { user, loading } = useAuth();
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
        );
    }
    if (user) {
        return (
            <Layout>
                <HelpCenter />
            </Layout>
        );
    }
    return <HelpCenter isPublic={true} />;
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
                                    <Route path="/" element={<LandingPage />} />
                                    <Route path="/login" element={<Login />} />
                                    <Route path="/painel-producao" element={<Navigate to="/visao-geral" replace />} />
                                    <Route path="/ajuda" element={<HelpRoute />} />

                                    <Route element={<PrivateRoute />}>
                                        <Route path="/empresa/colaboradores" element={<Layout><GestaoColaboradores /></Layout>} />
                                        <Route path="/admin/super-empresas" element={<Layout><SuperadminEmpresas /></Layout>} />
                                        <Route path="/admin/proposta-comercial" element={<Layout fullWidth={true}><PropostaComercialSuperAdmin /></Layout>} />
                                        <Route path="/manutencao/maquinas" element={<Layout><ManutencaoMaquinas /></Layout>} />
                                        <Route path="/manutencao/checklists" element={<Layout><ManutencaoChecklists /></Layout>} />
                                        <Route path="/manutencao/ordens" element={<Layout><ManutencaoOrdens /></Layout>} />
                                        <Route path="/manutencao/tecnicos" element={<Layout><ManutencaoTecnicos /></Layout>} />
                                        <Route path="/dashboard" element={<Navigate to="/visao-geral" replace />} />
                                        <Route path="/visao-geral" element={
                                            <Layout fullWidth={true}>
                                                <OrdersTable />
                                            </Layout>
                                        } />
                                        <Route path="/portal-cliente" element={<Navigate to="/visao-geral" replace />} />
                                        <Route path="/portal-cliente/tablet" element={<Navigate to="/visao-geral" replace />} />
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
                                        {/* SINCO ERP Nativo */}
                                        <Route path="/erp/produtos" element={
                                            <Layout fullWidth={true}>
                                                <ErpProdutosPage />
                                            </Layout>
                                        } />
                                        <Route path="/cadastros/basicos" element={
                                            <Layout fullWidth={true}>
                                                <CadastrosBasicosPage />
                                            </Layout>
                                        } />
                                        <Route path="/cadastros/prefixos" element={
                                            <Layout fullWidth={true}>
                                                <CadastrosBasicosPage />
                                            </Layout>
                                        } />
                                        <Route path="/cadastros/tipos-produto" element={
                                            <Layout fullWidth={true}>
                                                <CadastrosBasicosPage />
                                            </Layout>
                                        } />
                                        <Route path="/cadastros/unidades-medida" element={
                                            <Layout fullWidth={true}>
                                                <CadastrosBasicosPage />
                                            </Layout>
                                        } />
                                        <Route path="/cadastros/armazens" element={
                                            <Layout fullWidth={true}>
                                                <CadastrosBasicosPage />
                                            </Layout>
                                        } />
                                        <Route path="/erp/pedidos" element={
                                            <Layout fullWidth={true}>
                                                <ErpPedidosPage />
                                            </Layout>
                                        } />
                                        <Route path="/erp/clientes" element={
                                            <Layout fullWidth={true}>
                                                <ErpClientesPage />
                                            </Layout>
                                        } />
                                        <Route path="/erp/producao" element={
                                            <Layout fullWidth={true}>
                                                <ErpProducaoPage />
                                            </Layout>
                                        } />

                                        <Route path="/produtos" element={
                                            <Layout>
                                                <ProductCatalog />
                                            </Layout>
                                        } />
                                        <Route path="/engenharia/msmetal/produtos" element={<Navigate to="/produtos" replace />} />
                                        <Route path="/engenharia/msmetal/estrutura/:id" element={
                                            <Layout fullWidth={true}>
                                                <MSMetalProductStructure />
                                            </Layout>
                                        } />
                                        <Route path="/producao" element={<Navigate to="/visao-geral" replace />} />
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
                                        <Route path="/rh/offboarding" element={
                                            <Layout fullWidth={true}>
                                                <OffboardingRH />
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
                                        <Route path="/fornecedor/romaneios" element={
                                            <Layout>
                                                <FornecedorPortal />
                                            </Layout>
                                        } />
                                        <Route path="/fornecedor/romaneio/:id" element={
                                            <Layout>
                                                <FornecedorRomaneioDetalhes />
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
                                        <Route path="/suprimentos/espelho-nf" element={
                                            <Layout>
                                                <EspelhoNFViewer />
                                            </Layout>
                                        } />
                                        <Route path="/auditoria-pc" element={
                                            <Layout>
                                                <AuditoriaPC />
                                            </Layout>
                                        } />
                                        <Route path="/controle-producao" element={
                                            <Layout fullWidth={true}>
                                                <ProductionControl />
                                            </Layout>
                                        } />
                                        <Route path="/pcp/planejador-avancado" element={
                                            <Layout fullWidth={true}>
                                                <PlanejamentoAvancado />
                                            </Layout>
                                        } />
                                        <Route path="/producao-matrix" element={
                                            <Layout fullWidth={true}>
                                                <ProductionMatrixPage />
                                            </Layout>
                                        } />
                                        <Route path="/pcp/apontamento-estrutura" element={
                                            <Layout fullWidth={true}>
                                                <BOMAppointmentPage />
                                            </Layout>
                                        } />
                                        <Route path="/pcp/apontamento-vertical" element={
                                            <Layout fullWidth={true}>
                                                <VerticalAppointmentPage />
                                            </Layout>
                                        } />
                                        <Route path="/pcp/conferencia" element={<Navigate to="/visao-geral" replace />} />
                                        <Route path="/visao-producao" element={
                                            <Layout>
                                                <ProductionAnalytics />
                                            </Layout>
                                        } />
                                        <Route path="/pcp/analytics" element={
                                            <Layout fullWidth={true}>
                                                <ProductionAnalytics />
                                            </Layout>
                                        } />
                                        <Route path="/pcp/evolucao-apontamento" element={<Navigate to="/visao-geral" replace />} />
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

                                        <Route path="/pcp-refinado/rastreabilidade" element={
                                            <Layout fullWidth={true}>
                                                <RastreabilidadePCP />
                                            </Layout>
                                        } />
                                        <Route path="/producao/relatorios" element={<Navigate to="/visao-geral" replace />} />
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
                                        <Route path="/sgq/ativos" element={
                                            <Layout fullWidth={true}>
                                                <SGQAtivos />
                                            </Layout>
                                        } />
                                        <Route path="/sgq/caixas" element={
                                            <Layout fullWidth={true}>
                                                <SGQCaixas />
                                            </Layout>
                                        } />
                                        <Route path="/sgq/romaneios" element={
                                            <Layout fullWidth={true}>
                                                <SGQRomaneios />
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
                                            <Layout fullWidth={true}>
                                                <NaoConformidades />
                                            </Layout>
                                        } />
                                        <Route path="/sgq/gestao-rncs" element={
                                            <Layout fullWidth={true}>
                                                <GestaoRNCs />
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
                                            <Layout fullWidth={true}>
                                                <ControleCalibracao />
                                            </Layout>
                                        } />
                                        <Route path="/sgq/indicadores" element={
                                            <Layout>
                                                <div className="p-8 text-center text-gray-500">Módulo em desenvolvimento: Indicadores</div>
                                            </Layout>
                                        } />
                                        <Route path="/novas-funcionalidades" element={
                                            <Layout>
                                                <NovasFuncionalidades />
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
                                        <Route path="/pcp/gestao-materiais" element={<MaterialManagementPage />} />
                                        <Route path="/pcp/onde-usado" element={<WhereUsedPage />} />


                                        <Route path="/engenharia/sinco/formulario" element={
                                            <Layout fullWidth={true}>
                                                <SINCOFormularioPrincipal />
                                            </Layout>
                                        } />
                                        <Route path="/engenharia/sinco/estrutura-completa" element={
                                            <Layout fullWidth={true}>
                                                <SolidEdeg_Estrutura_Produto />
                                            </Layout>
                                        } />
                                        <Route path="/pcp/extrato-op" element={
                                            <Layout fullWidth={true}>
                                                <ApontamentoPorUsuarioOpPage />
                                            </Layout>
                                        } />
                                        <Route path="/pcp/apontamento-por-usuario-op" element={
                                            <Layout fullWidth={true}>
                                                <ApontamentoPorUsuarioOpPage />
                                            </Layout>
                                        } />
                                        <Route path="/pcp/planejamento-estrutura-routing" element={
                                            <Layout fullWidth={true}>
                                                <PlanejamentoEstruturaRouting />
                                            </Layout>
                                        } />



                                        {/* Calendário de Atividades Route */}
                                        <Route path="/calendario-atividades" element={<Navigate to="/visao-geral" replace />} />

                                        {/* Analise 3D Route */}
                                        <Route path="/analise-3d" element={<Navigate to="/visao-geral" replace />} />

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

                                        {/* PCP Setor — Cadastro, Recursos e Visão Gerencial */}
                                        <Route path="/pcp/setores" element={
                                            <Layout fullWidth={true}>
                                                <SetoresCadastro />
                                            </Layout>
                                        } />
                                        <Route path="/pcp/recursos" element={
                                            <Layout fullWidth={true}>
                                                <RecursosCadastro />
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
                                        <Route path="/pcp/fila-dependencias" element={
                                            <Layout fullWidth={true}>
                                                <PcpFilaDependencias />
                                            </Layout>
                                        } />
                                        <Route path="/pcp/controle-execucao" element={
                                            <Layout fullWidth={true}>
                                                <ControleExecucao />
                                            </Layout>
                                        } />
                                        <Route path="/pcp/programas-ncn" element={
                                            <Layout>
                                                <ProgramasNCN />
                                            </Layout>
                                        } />
                                        <Route path="/pcp/montagem-solicitacoes" element={
                                            <Layout>
                                                <MontagemSolicitacoes />
                                            </Layout>
                                        } />
                                        <Route path="/teste-ocr" element={<TesteOCR />} />
                                        {/* PCP Refinado Routes */}
                                        <Route path="/pcp-refinado/capacidade" element={
                                            <Layout fullWidth={true}>
                                                <CapacidadeRecursos />
                                            </Layout>
                                        } />
                                        <Route path="/pcp-refinado/ocupacao" element={
                                            <Layout fullWidth={true}>
                                                <TaxaOcupacao />
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

                                        {/* MÓDULO EXCLUSIVO SUPERADMIN: PROPOSTA COMERCIAL */}
                                        <Route path="/admin/proposta-comercial" element={
                                            <Layout fullWidth={true}>
                                                <Suspense fallback={<div className="p-8 text-center text-slate-500 font-semibold">Carregando Proposta Comercial...</div>}>
                                                    <PropostaComercialSuperAdmin />
                                                </Suspense>
                                            </Layout>
                                        } />

                                        {/* SUÍTE CORPORATIVA 100% MYSQL */}
                                        <Route path="/salas" element={
                                            <Layout fullWidth={true}>
                                                <SalasReuniaoCentral />
                                            </Layout>
                                        } />
                                        <Route path="/salas-reuniao" element={
                                            <Layout fullWidth={true}>
                                                <SalasReuniaoCentral />
                                            </Layout>
                                        } />
                                        <Route path="/salas/totem/:salaId" element={<TotemPortaModal />} />

                                        <Route path="/sst" element={
                                            <Layout fullWidth={true}>
                                                <SSTCentral />
                                            </Layout>
                                        } />
                                        <Route path="/sst/cesta-basica" element={
                                            <Layout fullWidth={true}>
                                                <SSTCestaBasica />
                                            </Layout>
                                        } />

                                        {/* MÓDULO SST - CIPA & ELEIÇÃO (NR-05) */}
                                        <Route path="/sst/cipa" element={
                                            <Layout fullWidth={true}>
                                                <CIPACentralPage />
                                            </Layout>
                                        } />
                                        <Route path="/sst/cipa/urna" element={
                                            <CIPAUrnaTotemPage />
                                        } />

                                        {/* MÓDULO SST - BRIGADA DE INCÊNDIO & EMERGÊNCIAS (NR-23 / NBR 14276) */}
                                        <Route path="/sst/brigada" element={
                                            <Layout fullWidth={true}>
                                                <BrigadaCentralPage />
                                            </Layout>
                                        } />
                                        <Route path="/sst/brigada/inspecao" element={
                                            <Layout fullWidth={true}>
                                                <BrigadaInspecaoRapidaPage />
                                            </Layout>
                                        } />
                                        <Route path="/sst/brigada/inspecao-rapida" element={
                                            <Layout fullWidth={true}>
                                                <BrigadaInspecaoRapidaPage />
                                            </Layout>
                                        } />

                                        {/* MÓDULO DE PORTARIA & CONTROLE DE ACESSO */}
                                        <Route path="/portaria" element={<Navigate to="/portaria/guarita" replace />} />
                                        <Route path="/portaria/guarita" element={
                                            <Layout fullWidth={true}>
                                                <PortariaGuaritaPage />
                                            </Layout>
                                        } />
                                        <Route path="/portaria/gerencial" element={
                                            <Layout fullWidth={true}>
                                                <PortariaGerencialPage />
                                            </Layout>
                                        } />
                                        <Route path="/portaria/turnos" element={
                                            <Layout fullWidth={true}>
                                                <PortariaTurnosPage />
                                            </Layout>
                                        } />

                                        <Route path="/rh/pasta-colaborador" element={
                                            <Layout fullWidth={true}>
                                                <PastaColaborador />
                                            </Layout>
                                        } />
                                        <Route path="/rh/portal-colaborador" element={<PortalColaborador />} />

                                        <Route path="/suporte" element={
                                            <Layout fullWidth={true}>
                                                <SuporteCentral />
                                            </Layout>
                                        } />

                                    </Route>

                                </Routes>
                            </Suspense>
                        </BrowserRouter>
                    </HelpProvider>
                </TimerProvider>
            </FilterProvider>
            <GlobalConfirmProvider />
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
