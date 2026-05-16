# 🚀 Relatório Profundo de Auditoria do App

Análise técnica em todo o projeto MetalFisa (Client & Server) para identificar peso morto, TODOs esquecidos, lixo de código e arquivos soltos.

## ⚠️ 1. Arquivos com maior concentração de TODOs e FIXMEs
| Arquivo | Qtd |
|---|---|
| client\src\pages\financeiro\DashboardFinanceiro.jsx | 7 |
| client\src\pages\ConferenciaPage.jsx | 3 |
| client\src\pages\ProductionControl.jsx | 2 |
| client\src\pages\sinco\IndApontamentoPage.jsx | 2 |
| client\src\config\helpContent.js | 1 |
| client\src\pages\pcp\CurvaSPedido.jsx | 1 |
| client\src\pages\vmi\DemandaVMIMapeamentoPage.jsx | 1 |
| client\src\pages\vmi\VMIPedidosMapeamentoPage.jsx | 1 |
| client\src\services\productionControlPdfGenerator.js | 1 |
| server\routes\production.js | 1 |
| server\routes\sinco_apontamento.js | 1 |
| server\routes\vmiPedidos.js | 1 |
| server\services\pcpmetal\orchestrator.js | 1 |
| server\test_all_filters.js | 1 |

## 🗑️ 2. Lixo de Código (Blocos comentados // const, // function)
| Arquivo | Blocos Inativos (Aprox) |
|---|---|
| server\routes\reports.js | 3 |

## 👻 3. Componentes/Arquivos Potencialmente Órfãos (Não Importados)
| Arquivo (Top 50) | Status |
|---|---|
| client\src\components\GanttChart.jsx | Órfão |
| client\src\components\GanttQuickPlanModal.jsx | Órfão |
| client\src\components\OrderItemNotesModal.jsx | Órfão |
| client\src\components\OrdersTable.jsx | Órfão |
| client\src\pages\admin\ProtheusStudyChat.jsx | Órfão |
| client\src\pages\AvisosHistorico.jsx | Órfão |
| client\src\pages\BOMGenerator.jsx | Órfão |
| client\src\pages\comercial\DashboardFaturamento.jsx | Órfão |
| client\src\pages\ConferenciaPage.jsx | Órfão |
| client\src\pages\ControleFaturamento.jsx | Órfão |
| client\src\pages\EngineeringControlReport.jsx | Órfão |
| client\src\pages\EngineeringOrdersPage.jsx | Órfão |
| client\src\pages\EngineeringReleaseReport.jsx | Órfão |
| client\src\pages\FaturamentoPainel.jsx | Órfão |
| client\src\pages\FaturamentoSolicitacoesHistorico.jsx | Órfão |
| client\src\pages\financeiro\Balancete.jsx | Órfão |
| client\src\pages\financeiro\DashboardFinanceiro.jsx | Órfão |
| client\src\pages\financeiro\FluxoCaixa.jsx | Órfão |
| client\src\pages\gerencial\VisaoGerencialAtrasos.jsx | Órfão |
| client\src\pages\gerencial\VisaoGerencialProdutos.jsx | Órfão |
| client\src\pages\GestaoOPsPage.jsx | Órfão |
| client\src\pages\HelpCenter.jsx | Órfão |
| client\src\pages\InternalRequestsPage.jsx | Órfão |
| client\src\pages\ItensAFaturar.jsx | Órfão |
| client\src\pages\Login.jsx | Órfão |
| client\src\pages\manutencao\Atividades.jsx | Órfão |
| client\src\pages\manutencao\Checklists.jsx | Órfão |
| client\src\pages\manutencao\Dashboard.jsx | Órfão |
| client\src\pages\manutencao\GestaoMateriais.jsx | Órfão |
| client\src\pages\manutencao\Maquinas.jsx | Órfão |
| client\src\pages\manutencao\Ordens.jsx | Órfão |
| client\src\pages\manutencao\Tecnicos.jsx | Órfão |
| client\src\pages\MaterialManagementPage.jsx | Órfão |
| client\src\pages\MeuCanal.jsx | Órfão |
| client\src\pages\pcp\ApontamentoPorUsuarioOpPage.jsx | Órfão |
| client\src\pages\pcp\PlanejamentoEstruturaRouting.jsx | Órfão |
| client\src\pages\pcp\SetoresCadastro.jsx | Órfão |
| client\src\pages\pcp\SetoresRecursos.jsx | Órfão |
| client\src\pages\pcp\VisaoSetores.jsx | Órfão |
| client\src\pages\PlanoContas.jsx | Órfão |
| client\src\pages\PPAPsBuscarProduto.jsx | Órfão |
| client\src\pages\ProductCatalog.jsx | Órfão |
| client\src\pages\production\TrackingEvolution.jsx | Órfão |
| client\src\pages\ProductionAnalytics.jsx | Órfão |
| client\src\pages\ProductionControl.jsx | Órfão |
| client\src\pages\ProductionEvolution.jsx | Órfão |
| client\src\pages\ProductionGanttPlanning.jsx | Órfão |
| client\src\pages\ProductionMatrixPage.jsx | Órfão |
| client\src\pages\ProductionOrders.jsx | Órfão |
| client\src\pages\ProductionOrdersByOp.jsx | Órfão |
