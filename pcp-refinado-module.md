# Plano de Implementação: Módulo PCP Refinado e Gestão de Capacidade

## 1. Gestão de Módulos (Ativação/Desativação)
**Arquivo Principal:** `client/src/pages/Settings.jsx` e `server/routes/company.js`
- Adicionar o controle (toggle) "PCP Refinado" na aba de Módulos/Geral.
- Mapear a variável `module_pcp_refinado_active` no `general_config` da tabela `app_company_settings`.
- Restringir a alteração apenas para usuários Super Admin (SA).

## 2. Menu Lateral Dinâmico
**Arquivo Principal:** `client/src/components/Sidebar.jsx` (ou onde o menu é renderizado, ex: `menuItems.js`)
- Criar a nova seção "PCP Refinado" no menu vertical.
- Essa seção só deve ser renderizada se `general_config.module_pcp_refinado_active` for `true`.
- Dentro dessa seção, teremos as telas:
  - **Cadastro de Capacidade e Tempos** (Nova Tela)
  - **Planejamento de Capacidade (Ocupação)** (Nova Tela ou Visão)

## 3. Estrutura de Banco de Dados (Capacidade)
**Tabela:** `app_recursos_capacidade`
- `recurso_codigo` (VARCHAR) - Chave Estrangeira ligada à `sh1010`
- `tempo_padrao_minutos` (INT/DECIMAL) - Peso/Tempo por operação
- `capacidade_diaria_minutos` (INT) - Tempo disponível por dia (ex: 480)

## 4. Cadastro de Capacidades (Nova Tela)
**Arquivo:** `client/src/pages/pcp-refinado/CapacidadeRecursos.jsx`
- Grid carregando os recursos da `sh1010`.
- Inputs inline para o usuário definir o tempo padrão e a capacidade diária de cada recurso.
- Botão para salvar (Upsert na tabela `app_recursos_capacidade`).

## 5. Cálculo de Taxa de Ocupação (CRP)
**Onde:** Nas telas de Planejamento (Vertical ou Avançado)
- Calcular `(Soma das Quantidades * Tempo Padrão) / Capacidade Diária`.
- Exibir visualmente o % de ocupação por dia por recurso.
