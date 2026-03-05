import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Settings as SettingsIcon, Menu, Package, Factory, Truck, LogOut, BarChart, Calendar, FileText, Building2, HelpCircle } from 'lucide-react';
import { FilterProvider } from './contexts/FilterContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TimerProvider } from './contexts/TimerContext';
import { HelpProvider, useHelp } from './contexts/HelpContext';

// Core components (eagerly loaded — used on every page)
import Sidebar from './components/Sidebar';
import FloatingAvisos from './components/FloatingAvisos';
import GlobalTimerWidget from './components/GlobalTimerWidget';
import HelpDrawer from './components/HelpDrawer';

// Lazy-loaded pages (code splitting — each becomes a separate chunk)
const OrdersTable = React.lazy(() => import('./components/OrdersTable'));
const ProductStructure = React.lazy(() => import('./pages/ProductStructure'));
const ProductionOrders = React.lazy(() => import('./pages/ProductionOrders'));
const ProductionOrdersByOp = React.lazy(() => import('./pages/ProductionOrdersByOp'));
const ProductCatalog = React.lazy(() => import('./pages/ProductCatalog'));
const Romaneios = React.lazy(() => import('./pages/Romaneios'));
const BOMGenerator = React.lazy(() => import('./pages/BOMGenerator'));
const Login = React.lazy(() => import('./pages/Login'));
const Settings = React.lazy(() => import('./pages/Settings'));
const ProductionControl = React.lazy(() => import('./pages/ProductionControl'));
const ProductionAnalytics = React.lazy(() => import('./pages/ProductionAnalytics'));
const ProductionMatrixPage = React.lazy(() => import('./pages/ProductionMatrixPage'));
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
const HelpCenter = React.lazy(() => import('./pages/HelpCenter'));
const MaterialManagementPage = React.lazy(() => import('./pages/MaterialManagementPage'));
const WhereUsedPage = React.lazy(() => import('./pages/WhereUsedPage'));
const ServiceOrdersPage = React.lazy(() => import('./pages/sinco/ServiceOrdersPage'));
const ServiceOrderProductionAppointmentPage = React.lazy(() => import('./pages/sinco/ServiceOrderProductionAppointmentPage'));
const ServiceOrderProductionMatrixPage = React.lazy(() => import('./pages/sinco/ServiceOrderProductionMatrixPage'));
const ServiceOrderMaterialsPage = React.lazy(() => import('./pages/sinco/ServiceOrderMaterialsPage'));
const SINCOActiveDrawing = React.lazy(() => import('./pages/SINCO/SINCOActiveDrawing'));
const TrackingEvolution = React.lazy(() => import('./pages/production/TrackingEvolution'));
const ProductionEvolution = React.lazy(() => import('./pages/ProductionEvolution'));
const InternalRequestsPage = React.lazy(() => import('./pages/InternalRequestsPage'));
const SincoApontamentoPorUsuarioPage = React.lazy(() => import('./pages/sinco/SincoApontamentoPorUsuarioPage'));
const ApontamentoPorUsuarioOpPage = React.lazy(() => import('./pages/pcp/ApontamentoPorUsuarioOpPage'));
const AvisosHistorico = React.lazy(() => import('./pages/AvisosHistorico'));
const SINCOProductStructure = React.lazy(() => import('./pages/sinco/SINCOProductStructure'));
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
    const { signed, loading, user, hasPermission } = useAuth();
    const location = useLocation();

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
    }

    if (!signed) return <Navigate to="/login" />;

    // Find pageId for current path
    const pageId = PATH_TO_PAGE_ID[location.pathname];

    // If there's a mapped page and user is NOT admin, check permission
    if (pageId && user?.tipo !== 'A' && !hasPermission(pageId, 'view')) {
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

// Layout Component
const Layout = ({ children, fullWidth = true }) => {
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
    const { toggleHelp } = useHelp();

    // Check if we are on mobile to pass to Sidebar
    const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);

    React.useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-900 flex print:block">

            <Sidebar
                isOpen={isSidebarOpen}
                setIsOpen={setIsSidebarOpen}
                isMobile={isMobile}
            />

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden w-full transition-all duration-300 relative">
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
                                        <Route path="/" element={
                                            <Layout fullWidth={true}>
                                                <OrdersTable />
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
                                        <Route path="/engenharia/pedidos" element={
                                            <Layout fullWidth={true}>
                                                <EngineeringOrdersPage />
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
                                        <Route path="/pcp/apontamento-por-usuario" element={
                                            <Layout fullWidth={true}>
                                                <SincoApontamentoPorUsuarioPage />
                                            </Layout>
                                        } />
                                        <Route path="/pcp/apontamento-por-usuario-op" element={
                                            <Layout fullWidth={true}>
                                                <ApontamentoPorUsuarioOpPage />
                                            </Layout>
                                        } />
                                    </Route>
                                </Routes>
                            </Suspense>
                        </BrowserRouter>
                    </HelpProvider>
                </TimerProvider>
            </FilterProvider>
        </AuthProvider>
    )
}

export default App;
