# 📑 Relatório de Entrega & Homologação em Produção
## Módulo: Gestão de OPs por Lote (LPF), Fracionamento de OPs & Liberação Irreversível
**Sistema:** SINCO / MetalFisa Indústria Metalúrgica  
**Versão Homologada:** `3.8.0-PROD`  
**Servidor de Produção:** `192.168.1.77:3001`  
**Data da Homologação:** 28 de Agosto de 2026  
**Status:** 🟢 **100% Homologado e em Produção**

---

## 📑 1. RESUMO EXECUTIVO DA ENTREGA

Este documento formaliza a entrega e homologação em produção do módulo de **Gestão de OPs por Lote**, **Fracionamento de OPs**, **Aglutinação Fabril**, **Controle por Saldo a Faturar** e **Liberação Irreversível com Carimbo da Qualidade**.

O módulo atende com precisão às necessidades operacionais de PCP, Engenharia e Chão de Fábrica da Metalfisa, integrando os dados em tempo real do **ERP Protheus (PostgreSQL)** com a inteligência de planejamento do **SINCO (MySQL)**.

```mermaid
mindmap
  root((SINCO Módulo LPF))
    Soberania Saldo Fat
      c6_qtdven - c6_qtdent
      Prevenção Superprodução
      Histórico NFs Parciais
      Status ENTREGUE
    Fracionamento OP Split
      Sublotes AA, AB, AC...
      OPs Únicas Rastreáveis
      Validação Soma Estrita
      Unificação Flexível
    Lotes Aglutinados LPF
      Código Único LPF-XXXXXX
      Aglutinação Multi-Cliente
      Agrupamento por Chapa e MTC
      Plano de Corte Integrado
    Liberação Irreversível
      Opção B Manual
      Opção C Auto Corte
      Trava Permanente
      Carimbo Qualidade Consolidado
    Planilha Mestra Excel
      Aba 1 Índice & Links
      Aba 2 Itens Aglutinados
      Aba 3 BOM Recursivo
      Aba 4 Consolid. Materiais
```

---

## 2. ARQUITETURA DE DADOS & INTEGRAÇÃO HÍBRIDA

O fluxo de dados transita entre o banco corporativo Protheus e o banco de inteligência fabril SINCO:

```mermaid
flowchart TD
    subgraph ERP_PROTHEUS [ERP Protheus PostgreSQL]
        SC5[SC5010: Pedidos de Venda]
        SC6[SC6010: Itens do Pedido & Saldo Faturar]
        SC2[SC2010: Ordens de Produção ERP]
        SB1[SB1010: Produtos, Pesos e Dimensões]
        SG1[SG1010: Estrutura Recursiva BOM]
        SG2[SG2010: Roteiro e Operações de Máquina]
        SF2[SF2010 / SD2010: Faturamentos e NFs]
    end

    subgraph SINCO_API [SINCO Backend Node.js Service]
        RoutesPedidos[server/routes/pedidos.js]
        RoutesReleases[server/routes/pcp_releases.js]
        RoutesCorte[server/routes/corte.js]
        ExplosionEngine[Recursive BOM Explosion Engine]
    end

    subgraph SINCO_DB [SINCO MySQL Database]
        TB_FC[app_pcp_delivery_forecasts\n- Previsões & Frações AA/AB\n- Quantidade Fracionada\n- Data PCP & LPF_Codigo]
        TB_LPF[app_lpf_lots\n- Código LPF / Status\n- Trava Irreversível]
        TB_NOTES[app_sales_order_item_notes\n- Liberação de Desenhos e Engenharia]
        TB_HELP[app_sgq_processos\n- Base de Ajuda e SGQ]
    end

    subgraph CLIENT_VITE [Frontend React Single Page Application]
        GestaoOPsPage[GestaoOPsPage.jsx - Cockpit Principal]
        SplitModal[SplitOPModal.jsx - Partição de OPs]
        ExcelGen[masterSheetExportGenerator.js]
        PdfGen[loteWithDrawingsPdfGenerator.js]
        HelpSys[HelpContext / helpContent.js]
    end

    SC6 -->|c6_qtdven - c6_qtdent| RoutesPedidos
    SF2 -->|Notas Fiscais Parciais| RoutesPedidos
    SG1 -->|Estrutura de Peças| ExplosionEngine
    SG2 -->|Roteiros Laser/Dobra/Solda| ExplosionEngine

    RoutesPedidos <--> TB_FC
    RoutesReleases <--> TB_LPF
    RoutesPedidos <--> TB_NOTES

    SINCO_API <--> CLIENT_VITE
```

---

## 3. ESPECIFICAÇÃO DAS REGRAS DE NEGÓCIO

### 3.1. Regra Soberana de Saldo a Faturar
$$\text{Saldo a Faturar} = \text{GREATEST}(C6\_QTDVEN - C6\_QTDENT, 0)$$

- **Prevenção de Desperdício:** Itens com faturamentos parciais no ERP utilizam **estritamente o saldo pendente restante** como quantidade máxima para programação PCP, corte de chapas e fracionamento.
- **Conclusão de Itens:** Saldo zero ($C6\_QTDVEN \le C6\_QTDENT$) marca o item como **`ENTREGUE`**, desabilitando novas ações produtivas.

### 3.2. Fracionamento de OPs (Split AA, AB, AC...)
- O total distribuído entre as frações deve ser **$100\%$ idêntico ao Saldo a Faturar**.
- O sistema atribui sufixos alfabéticos (`AA`, `AB`, `AC`...) e gera códigos de OP específicos (ex: `00461809AA`).
- Cada fração herda sua própria **Data de Entrega PCP** e quantidade fracionada.

### 3.3. Aglutinação em Lote LPF (`LPF-XXXXXX`)
- Permite agrupar itens de diferentes pedidos e clientes que compartilham a mesma matéria-prima (MTC) e espessura de chapa.
- Exibe o cabeçalho consolidado com o total de peças do lote e data de entrega sincronizada.

### 3.4. Liberação Irreversível (Opções B e C)
- **Opção B (Manual):** Acionada pelo botão `[Liberar Produção / Aglutinar]`.
- **Opção C (Automática ao gerar Corte):** Ao abrir o `CorteForecastModal` a partir do lote e salvar a estratégia de corte.
- **Trava de Integridade:** Após liberado, o lote recebe a badge `🟢 LIBERADO P/ FABRICAÇÃO` e entra em modo permanente (proibido desmembrar, excluir ou reverter).

---

## 4. FLUXOGRAMAS OPERACIONAIS E ARQUITETURA DE PROCESSOS

### 🔄 Fluxograma 1: Ciclo de Vida do Pedido e Saldo a Faturar
```mermaid
flowchart TD
    Start([Novo Pedido de Venda SC5/SC6]) --> CheckInvoiced{Houve Faturamento Parcial via NF?}
    
    CheckInvoiced -- Sim --> CalcSaldo[Saldo Fat = C6_QTDVEN - C6_QTDENT]
    CheckInvoiced -- Não --> FullSaldo[Saldo Fat = C6_QTDVEN]
    
    CalcSaldo --> CheckZero{Saldo Fat <= 0?}
    CheckZero -- Sim --> MarkDone[Badge: ENTREGUE\nBloqueia Novas Ações]
    CheckZero -- Não --> ShowActive[Linha Ativa na Gestão de OPs]
    FullSaldo --> ShowActive
    
    ShowActive --> UserDecision{Operação Desejada}
    UserDecision -- Fracionar Entrega --> OpenSplit[Abrir Modal Split OP]
    UserDecision -- Agrupar em Lote --> GroupLPF[Selecionar e Criar Lote LPF]
    UserDecision -- Programar Data --> SetDatePCP[Definir Data Entrega PCP]
```

---

### ✂️ Fluxograma 2: Fracionamento de OPs (Split AA, AB, AC...)
```mermaid
flowchart TD
    StartSplit[Item Selecionado com Saldo Pendente] --> OpenModal[Abrir SplitOPModal.jsx]
    OpenModal --> GetSaldo[Obter Saldo a Faturar como Base Total]
    GetSaldo --> AutoSplit2[Dividir Inicialmente em 2 Frações: AA e AB]
    
    AutoSplit2 --> CheckNeedsMore{Necessita de Frações AC, AD...?}
    CheckNeedsMore -- Sim --> AddFraction[Adicionar Nova Fração]
    AddFraction --> SetQtdDate[Definir Quantidade e Data PCP de Cada Fração]
    CheckNeedsMore -- Não --> SetQtdDate
    
    SetQtdDate --> ValidateSum{Soma das Frações == Saldo a Faturar?}
    
    ValidateSum -- Não --> ShowDiffAlert[Bloquear e Exibir Diferença de Saldo]
    ShowDiffAlert --> SetQtdDate
    
    ValidateSum -- Sim --> SubmitSplit[POST /api/pedidos/split-op]
    SubmitSplit --> PersistMySQL[Gravar em app_pcp_delivery_forecasts]
    PersistMySQL --> GenDiscreteOps[Gerar OPs: 00461809AA, 00461809AB...]
    GenDiscreteOps --> RefreshFlat[Atualizar Linhas na Grade Flat View]
```

---

### 📦 Fluxograma 3: Agrupamento em Lote LPF e Aglutinação de Peças
```mermaid
flowchart TD
    CheckGrid[Marcar Checkboxes das OPs / Frações Desejadas] --> ClickManageLot[Clicar em: Gerenciar Lote / Agrupar]
    ClickManageLot --> CheckExisting{Inserir em Lote Existente ou Novo?}
    
    CheckExisting -- Novo Lote --> GenCode[Gerar Código Único: LPF-XXXXXX]
    CheckExisting -- Lote Existente --> PickCode[Selecionar Código LPF Existente]
    
    GenCode --> BindItems[Vincular Itens ao LPF em app_pcp_delivery_forecasts]
    PickCode --> BindItems
    
    BindItems --> RenderGroup[Renderizar Acordeon Esmeralda do Lote LPF]
    RenderGroup --> ShowTotals[Exibir Total Consolidado de Peças e Data PCP]
```

---

### 🔒 Fluxograma 4: Liberação Irreversível & Carimbo da Qualidade nos Desenhos
```mermaid
flowchart TD
    GroupedLot[Lote LPF Agrupado na Grade] --> ReleaseMethod{Método de Liberação}
    
    ReleaseMethod -- Opção B: Manual --> ClickLiberar[Botão: Liberar Produção / Aglutinar]
    ClickLiberar --> ConfirmModal[Modal de Confirmação com Aviso de Irreversibilidade]
    ConfirmModal --> ExecRelease[POST /api/pcp-releases/batch]
    
    ReleaseMethod -- Opção C: Auto Corte --> OpenCorte[Botão: Gerar Plano de Corte]
    OpenCorte --> SaveCorteStrat[Salvar Estratégia de Aproveitamento no CorteForecastModal]
    SaveCorteStrat --> AutoTriggerRelease[POST /api/corte com lpfCodigo]
    
    ExecRelease --> LockStatus[Status = LIBERADO P/ FABRICAÇÃO]
    AutoTriggerRelease --> LockStatus
    
    LockStatus --> FreezeLot[Trava Irreversível Ativada no Banco de Dados]
    FreezeLot --> GenerateDrawings[Gerar PDFs dos Desenhos Técnicos]
    GenerateDrawings --> ApplyQualityStamp[Estampar Carimbo Oficial da Qualidade\n- Lote LPF-XXXXXX\n- Quantidade TOTAL Somada do Lote\n- Roteiro de Máquinas Laser/Dobra/Solda]
    ApplyQualityStamp --> FinalDelivery([Envio Oficial às Máquinas do Chão de Fábrica])
```

---

### 📊 Fluxograma 5: Geração da Planilha Mestra Excel com Índice
```mermaid
flowchart TD
    ClickExport[Clicar no Botão: Planilha Mestra] --> TriggerAsync[Disparar masterSheetExportGenerator.js]
    TriggerAsync --> FetchExplosion[Buscar Explosão Recursiva BOM de Todos os Itens Filtrados]
    FetchExplosion --> InitWorkbook[Instanciar Workbook ExcelJS]
    
    InitWorkbook --> CreateTab1[Aba 1: 1. Índice & Resumo Lote\n- Metadados Consolidados\n- Links Diretos para Itens]
    InitWorkbook --> CreateTab2[Aba 2: 2. Itens Aglutinados\n- Pedidos, OPs, Clientes e Datas PCP]
    InitWorkbook --> CreateTab3[Aba 3: 3. Estrutura Linear BOM\n- Subconjuntos e Matérias-Primas MTC]
    InitWorkbook --> CreateTab4[Aba 4: 4. Consolid. Peças Materiais\n- Soma Geral de Peças por Chapa/Espessura]
    
    CreateTab1 & CreateTab2 & CreateTab3 & CreateTab4 --> FormatStyles[Aplicar Cores Institucionais, Bordas e Larguras]
    FormatStyles --> GenerateBuffer[Gerar Buffer Binário .xlsx]
    GenerateBuffer --> TriggerSafeDownload[Disparar Download Seguro com revokeObjectURL diferido]
    TriggerSafeDownload --> ReadyExcel([Arquivo Excel Disponível para PCP e Diretoria])
```

---

## 5. MATRIZ DE COMPONENTES E ARQUIVOS ATUALIZADOS

| Arquivo / Componente | Camada | Principais Implementações Realizadas |
| :--- | :--- | :--- |
| [`GestaoOPsPage.jsx`](file:///c:/Users/lynx/Documents/MetalFisa%20Anty/client/src/pages/GestaoOPsPage.jsx) | Frontend SPA | Cockpit principal, visualização Flat, cálculo de `visual_qtd` estritamente com `order.qtd_faturar`, remoção da coluna duplicada `Qtd. PCP`, agrupamento LPF. |
| [`SplitOPModal.jsx`](file:///c:/Users/lynx/Documents/MetalFisa%20Anty/client/src/components/SplitOPModal.jsx) | Frontend SPA | Modal de fracionamento de OPs (AA, AB, AC...), cálculo de `totalQtd` com base soberana no `qtd_faturar`, validação de soma exata e unificação. |
| [`helpContent.js`](file:///c:/Users/lynx/Documents/MetalFisa%20Anty/client/src/config/helpContent.js) | Frontend SPA | Documentação completa de ajuda contextual para `/comercial/gestao-ops` e `/gestao-ops` com 5 abas temáticas. |
| [`masterSheetExportGenerator.js`](file:///c:/Users/lynx/Documents/MetalFisa%20Anty/client/src/services/masterSheetExportGenerator.js) | Service | Geração assíncrona da Planilha Mestra com download seguro compatível com HTTP/HTTPS local. |
| [`loteExcelGenerator.js`](file:///c:/Users/lynx/Documents/MetalFisa%20Anty/client/src/services/loteExcelGenerator.js) | Service | Aba 1 com Índice e Resumo Mestre; ajuste do limite de 31 caracteres na aba 4 (`4. Consolid. Peças Materiais`). |
| [`loteWithDrawingsPdfGenerator.js`](file:///c:/Users/lynx/Documents/MetalFisa%20Anty/client/src/services/loteWithDrawingsPdfGenerator.js) | Service | Capa com Índice Geral e estampa de Carimbo da Qualidade contendo quantidades consolidadas nos desenhos técnicos. |
| [`server/routes/pedidos.js`](file:///c:/Users/lynx/Documents/MetalFisa%20Anty/server/routes/pedidos.js) | Backend API | Endpoints `/split-op`, `/pedidos/flat`, cálculo em tempo real de `qtd_faturar` ($c6\_qtdven - c6\_qtdent$) e histórico de NFs. |
| [`server/routes/pcp_releases.js`](file:///c:/Users/lynx/Documents/MetalFisa%20Anty/server/routes/pcp_releases.js) | Backend API | Endpoint `/liberar` de Lote LPF, trava irreversível e bloqueio 403 contra exclusão de lotes liberados. |
| [`server/routes/webhook_suporte.js`](file:///c:/Users/lynx/Documents/MetalFisa%20Anty/server/routes/webhook_suporte.js) | Backend API | Fallback seguro para leitura de `helpContent.js` prevenindo erros de console no servidor. |

---

## 6. LOG DE HOMOLOGAÇÃO E AMBIENTE DE PRODUÇÃO

### 🛠️ Configurações do Servidor de Produção (`192.168.1.77`):
1. **Node.js Heap Memory:** PM2 configurado com `--max-old-space-size=4096` (4 GB de memória RAM dedicada), eliminando qualquer risco de erro *Out Of Memory* em exportações massivas de relatórios.
2. **Build de Produção:** Compilado via Vite (`npm run build`) com $100\%$ de sucesso em 31.69s.
3. **Sincronização:** `powershell ./sync-deployment.ps1` executado, atualizando a pasta `linux-deployment/`.
4. **Status do Processo PM2:** Processo `metalfisa_producao` reiniciado com sucesso (`pid: 266573`, `status: online`).

---

**Homologado e Entregue por:**  
*Equipe de Engenharia de Software & Inteligência Fabril Metalfisa*  
*Data: 28/08/2026*
