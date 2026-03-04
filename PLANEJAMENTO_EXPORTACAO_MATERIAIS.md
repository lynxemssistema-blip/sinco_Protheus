# 📋 Planejamento Detalhado: Módulo de Exportação de Materiais (PCP)

## 1. Visão Geral
Criar uma interface simplificada dentro da página de "Pedidos de Venda" para permitir a seleção em massa de itens e a exportação de suas listas de materiais (BOM), destacando visualmente produtos que ainda pendem de cadastro de engenharia.

## 2. Arquitetura da Solução

### A. Backend (Node.js API)
Precisaremos de dois novos endpoints principais.

#### 1. Listagem de Itens para Filtro (`GET /api/pcp/pedidos-pendentes`)
*   **Objetivo:** Listar itens de pedidos de venda em aberto.
*   **Lógica SQL (Conceitual):**
    *   Buscar itens de pedido de venda (ex: tabela `SC6` no Protheus ou `pedidos_itens` no local).
    *   Fazer `LEFT JOIN` com a tabela de estrutura (ex: `SG1` ou `estrutura_produtos`) para verificar se o produto pai (`C6_PRODUTO`) existe como pai na estrutura.
    *   **Coluna Calculada:** `tem_estrutura` (Boolean). Se houver registro na tabela de estrutura, é `true`, senão `false`.
*   **Filtros Suportados:**
    *   Data de Entrega (`C6_ENTREG`).
    *   Cliente (`A1_NOME`).
    *   Número do Pedido (`C6_NUM`).
    *   Status Estrutura (`Com` / `Sem`).

#### 2. Geração do Excel (`POST /api/pcp/exportar-materiais`)
*   **Input:** Array de IDs de produtos ou Pedidos+Itens selecionados.
*   **Processamento:**
    1.  Para cada produto selecionado, explodir a árvore de estrutura (BOM) recursivamente até chegar nas matérias-primas (nível mais baixo ou itens comprados).
    2.  Multiplicar a quantidade da estrutura pela quantidade do pedido de venda.
    3.  Agrupar (Sumarizar) por código de matéria-prima.
    4.  Gerar arquivo Excel usando biblioteca `exceljs` ou `xlsx`.
*   **Output:** Arquivo `.xlsx` para download.

### B. Frontend (React)
Uma nova aba na tela de "Pedidos de Venda".

#### Componentes:
1.  **`MaterialsExportTab`**: Container principal.
2.  **`FilterBar`**: Inputs para Data, Cliente, Pedido e Select para "Status Estrutura".
3.  **`MaterialsGrid`**: Tabela com checkboxes.
    *   Colunas: Checkbox, Data Entrega, Pedido, Cliente, Cód. Produto, Descrição, Qtde, Unid, **Status Eng (Ícone)**.
    *   Estilo condicional: Linha vermelha clara se `tem_estrutura === false`.
4.  **`ExportFloatingBar`**: Barra fixa no rodapé que aparece quando há itens selecionados, contendo o botão "Gerar Lista de Materiais".

---

## 3. Requisitos de Dados e Integração

Para que a funcionalidade funcione perfeitamente, a página de Pedidos deve fornecer ou buscar os seguintes dados:

### A. Dados Essenciais (Query SQL)
| Campo | Tipo | Origem | Descrição |
|:---|:---|:---|:---|
| `pedido` | String | SC6.C6_NUM | Número do Pedido de Venda |
| `item` | String | SC6.C6_ITEM | Item do Pedido |
| `cliente` | String | SA1.A1_NOME | Nome do Cliente |
| `produto` | String | SC6.C6_PRODUTO | Código do Produto Acabado |
| `descricao` | String | SB1.B1_DESC | Descrição do Produto |
| `quantidade` | Number | SC6.C6_QTDVEN | Quantidade Vendida |
| `data_entrega` | Date | SC6.C6_ENTREG | Data de Entrega Prevista |
| `tem_estrutura` | Boolean | SG1 (Join) | **CRÍTICO:** Define se pinta de vermelho ou não |

## 4. Passo a Passo de Implantação

### Fase 1: Backend (API e Banco de Dados)

1.  **Mapeamento de Dados (SQL):**
    *   Identificar as tabelas corretas no PostgreSQL (Protheus) ou MySQL (Local).
    *   *Ação:* Criar a query que retorna: `Pedido`, `Item`, `Produto`, `Descricao`, `Quantidade`, `DataEntrega`, `TemEstrutura`.

2.  **Rota de Listagem:**
    *   Criar arquivo `server/routes/pcpMaterials.js`.
    *   Implementar `router.get('/orders', ...)` com a query acima e filtros.

3.  **Lógica de Explosão de Materiais:**
    *   Implementar função recursiva `getBillOfMaterials(produtoId, quantidade)`.
    *   Esta função deve buscar os filhos na tabela de estrutura. Se um filho tiver estrutura, chama a função novamente. Se for comprado/matéria-prima, adiciona à lista final.

4.  **Rota de Exportação:**
    *   Implementar `router.post('/export', ...)` que recebe os itens, chama a lógica de explosão, consolida e retorna o Excel.

### Fase 2: Frontend (Interface)

5.  **Criar a Aba:**
    *   No componente `SalesOrdersPage` (ou similar), adicionar a nova aba "Exportação Materiais".

6.  **Implementar Filtros e Tabela:**
    *   Criar o estado para armazenar os filtros.
    *   Consumir a rota `GET /api/pcp/pedidos-pendentes`.
    *   Renderizar a tabela. **Importante:** Adicionar indicador visual (ex: ⚠️) para itens sem estrutura.

7.  **Implementar Seleção e Exportação:**
    *   Adicionar lógica de "Selecionar Todos" e seleção individual.
    *   Ao clicar em "Exportar", enviar os dados para `POST /api/pcp/exportar-materiais` e forçar o download do blob retornado.

### Fase 3: Testes e Validação

8.  **Teste de Estrutura:**
    *   Verificar se um produto novo (sem desenho) aparece como "Sem Estrutura".
    *   Cadastrar a estrutura e verificar se o status muda na hora.

9.  **Teste de Cálculo:**
    *   Pegar um produto com estrutura conhecida (ex: 1 Eixo usa 10kg de Aço).
    *   Selecionar um pedido de 5 Eixos.
    *   O Excel deve mostrar 50kg de Aço.

---

## 5. Exemplo de Query (Conceitual - PostgreSQL/Protheus)

```sql
SELECT 
    SC6.C6_NUM AS pedido,
    SC6.C6_ITEM AS item,
    SC6.C6_PRODUTO AS produto,
    SB1.B1_DESC AS descricao,
    SC6.C6_QTDVEN AS quantidade,
    SC6.C6_ENTREG AS data_entrega,
    CASE 
        WHEN EXISTS (SELECT 1 FROM SG1010 SG1 WHERE SG1.G1_COD = SC6.C6_PRODUTO AND SG1.D_E_L_E_T_ = '') THEN true 
        ELSE false 
    END AS tem_estrutura
FROM 
    SC6010 SC6
    INNER JOIN SB1010 SB1 ON SB1.B1_COD = SC6.C6_PRODUTO
WHERE 
    SC6.C6_BLQ <> 'R' -- Apenas itens não bloqueados/residuais
    AND SC6.D_E_L_E_T_ = ''
```