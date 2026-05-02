# Planejamento: Monitoramento do Sistema

## 1. Visão Geral
Criar uma nova aba de "Monitoramento" na página de Configurações (`Settings.jsx`) para fornecer dados de observabilidade do sistema. Para não afetar a performance da produção, as métricas serão agregadas em memória e gravadas no banco de dados a cada 1 hora.

## 2. Solução e Arquitetura

### 2.1 Backend (Node.js)
1. **Banco de Dados (MySQL)**:
   - Criar uma nova tabela chamada `system_metrics` no MySQL.
   - Colunas: `id`, `timestamp` (hora da captura), `active_users`, `mysql_query_count`, `sql_server_query_count`, `cpu_usage`, `memory_usage`, `uptime`.

2. **Interceptadores (Em Memória)**:
   - Modificar os arquivos de conexão de banco (`server/config/database.js` / `server/routes/protheus.js`) para incrementar duas variáveis globais em memória: `totalMysqlQueries` e `totalSqlServerQueries`.

3. **Coletor Agendado (Cron Job)**:
   - Usar `setInterval` (rodando a cada 60 minutos) no servidor principal.
   - O job vai:
     1. Contar os tokens ativos na memória (usuários logados).
     2. Pegar os contadores de queries (e depois zerar para a próxima hora).
     3. Capturar o uso de CPU e RAM usando o módulo nativo `os` do Node.
     4. Inserir esses dados na tabela `system_metrics`.

4. **API Endpoints**:
   - `GET /api/monitoramento`: Retorna os dados das últimas 24h ou 7 dias ordenados por hora.

### 2.2 Frontend (React)
1. **Página**:
   - Atualizar `client/src/pages/Settings.jsx` para incluir uma nova tab ("Monitoramento").
2. **Componente**:
   - Criar `client/src/components/MonitoringDashboard.jsx`.
   - Utilizar a biblioteca de gráficos (ex: Recharts, ou outra que já exista no projeto) para exibir as linhas de histórico e contadores.

## 3. Fases de Implementação

- [ ] **Fase 1**: Criar o script SQL de migração para a tabela `system_metrics` e aplicar no MySQL.
- [ ] **Fase 2**: Configurar os contadores em memória e a função de captura (Node `os`) no Backend.
- [ ] **Fase 3**: Criar o loop de 1 hora (`setInterval`) para gravar no MySQL e a rota `GET /api/monitoramento`.
- [ ] **Fase 4**: Criar o componente React `MonitoringDashboard.jsx` com os gráficos.
- [ ] **Fase 5**: Plugar o componente na página de Configurações e testar o fluxo.
