# Portal do Cliente B2B - Product Requirements Document (PRD)

## 1. Visão Geral e Entendimento do Projeto (Overview)
O objetivo deste projeto é expandir o sistema interno da Metalfisa (que já engloba PCP, VMI, Apontamentos e Romaneios via integração Protheus) transformando-o em uma **plataforma Multi-Tenant B2B**. Isso permitirá que os clientes da Metalfisa acessem um portal exclusivo (White-Label) para visualizar em tempo real o status de seus pedidos, acessar romaneios e interagir com o módulo VMI, sem ter acesso ou visualização dos dados internos da fábrica ou de outros clientes.

Conforme solicitado, será introduzido o conceito de `cliente_id` na estrutura de usuários, além de perfis específicos (Cliente Master e Cliente Padrão), e a capacidade de personalização visual ("Branding"), suportando o **logotipo da empresa cliente** e a **foto de perfil do usuário**.

### Project Type
**WEB** (React Frontend + Node.js Backend)

## 2. Escopo e Funcionalidades (Requirements)

### 2.1 Gestão de Usuários e Perfis (Backend & Frontend)
- **Tabela de Usuários / BD:** Adicionar colunas `cliente_id` (CNPJ ou Código ERP), `avatar_url` (Foto do usuário) e `logo_url` (Logotipo do Cliente, pode ser herdado/vinculado à empresa).
- **Hierarquia:**
  - `Master Metalfisa`: Controle total do sistema interno.
  - `Cliente Master`: Pode criar/editar novos usuários (`Cliente Padrão`) vinculados estritamente ao seu próprio `cliente_id`. A tela de cadastro incluirá interface para foto/avatar e logotipo.
  - `Cliente Padrão`: Acesso apenas de visualização ("read-only") para faturamento, pedidos e módulos liberados.

### 2.2 Portal White-Label (Frontend)
- **Roteamento Isolado:** Criar rota raiz protegida (Ex: `/portal/*`) com um layout próprio (`ClientPortalLayout`), eliminando o menu complexo do sistema interno.
- **Personalização Visual:** O Header ou as páginas internas do portal do cliente carregarão o logotipo do cliente logado, enquanto o perfil exibirá a foto de avatar.
- **Dashboard "Meus Pedidos" (MVP):** Lista simplificada de pedidos, utilizando consumo de API filtrado de forma segura e elegante.

### 2.3 Isolamento de Dados / Segurança (Backend)
- **Middleware JWT:** Injetar o `cliente_id` e uma flag `is_cliente` no Payload do token JWT.
- **Filtro Automático de Queries:** Todo *controller* exposto na rota de portal (`/api/portal/`) deve **obrigatoriamente** extrair o `cliente_id` apenas do Token validado para forçar a cláusula restrictiva na Query (`WHERE id = ?`), não aceitando CNPJ ou IDs advindos do Client-side (URL/Payload) como garantia.

---

## 3. Análise de Risco (Risk Assessment)

Para garantir que **nenhum fluxo vital do sistema atual da Metalfisa quebre**, elaboramos a matriz de riscos e estratégias de mitigação abaixo:

| Risco (Risk) | Impacto | Estratégia de Mitigação (Mitigation) |
|---|---|---|
| **Vazamento de Dados (IDOR / Cross-Tenant)** | Crítico | O filtro de `cliente_id` dependente do servidor. O backend deve **sempre** extrair o `cliente_id` direto do Token JWT para montar as blocos das consultas Protheus/MySql. Nunca confiar no Input do Frontend. |
| **Quebra de Permissões Internas (Metalfisa)** | Alto | A lógica da fábrica e Engenharia utiliza a tabela `app_user_permissions`. Usuários externos ignorarão essa tabela e rodarão com um Middleware de rota (`requireClientDomain`) para impedir mistura do modelo de roles antigo. |
| **Erros de Roteamento no React (404/Branco)** | Médio | Não misturaremos os layouts. O `App.jsx` fará um 'Split' em duas arquiteturas de tela principais: `isCliente === true` força o roteamento para os fragmentos do `<ClientPortalLayout>`. |
| **Sobrecarga de Requisições no Protheus** | Médio | Requisições concorrentes de vários clientes lendo Pedidos pode gargalar o Protheus. Exigirá APIs e endpoints restritos a projeções vitais apenas. |
| **Corrompimento da Tabela `users`** | Médio | Criar um script de migração formal para fazer `ALTER TABLE`, inserindo `cliente_id`, `avatar_url`, `logo_url` como dados `NULLABLE`. Isso mantém as queries antigas 100% íntegras sem alterar `INSERTs` do sistema antigo. |

---

## 4. Success Criteria
- [ ] O banco de dados suporta `cliente_id`, `avatar_url` e `logo_url` sem impactar dados legados.
- [ ] Um usuário tipo "Cliente Master" loga e a tela renderiza o menu White-Label (com a sua foto de avatar e logotipo da empresa).
- [ ] "Cliente Master" consegue cadastrar um "Cliente Padrão" da própria empresa. O backend chumba o `cliente_id` forçado.
- [ ] O sistema PCP/Engenharia interno continua operando perfeitamente normal.

---

## 5. Task Breakdown (Plan Phase)

### Phase 1: Banco de Dados e Segurança (Backend)
- **Task 1.1:** Gerar e aplicar schema migration adicionando `cliente_id`, `logo_url`, `avatar_url` na tabela base de `users` do app do Painel.
  - *Agent*: `backend-specialist` | *Skill*: `database-design`
- **Task 1.2:** Modificar a geração do Token no Controller existente (`routes/auth.js` / login) introduzindo a checagem no sign() se é perfil de Cliente para embutir as novas variáveis.
  - *Agent*: `backend-specialist` | *Skill*: `nodejs-best-practices`
- **Task 1.3:** Criar middleware `requireClientAuth` e roteadores em `/api/portal/*`.
  - *Agent*: `backend-specialist` | *Skill*: `api-patterns`

### Phase 2: Core Frontend B2B
- **Task 2.1:** Configurar rotas isoladas no `.jsx` principal de React e montar o componente base `<ClientPortalLayout>` com header otimizado.
  - *Agent*: `frontend-specialist` | *Skill*: `react-best-practices`
- **Task 2.2:** Elaborar tela de Login (ou aproveitamento dinâmico do atual) que decida se despacha para `/` ou para `/portal/`.
  - *Agent*: `frontend-specialist`

### Phase 3: Gestão Visual e Funcionalidade (CRUD de Clientes)
- **Task 3.1:** Elaborar no Frontend e Backend o formulário de "Novo Usuário" por parte do Cliente Master, habilitando `input[type="file"]` para Avatar e Logotipo. Implementar serviço de uploader no node (`multer` / diskStorage) ou URLs remotas.
  - *Agent*: `frontend-specialist` & `backend-specialist`
- **Task 3.2:** View "Meus Pedidos" renderizando table.

---

## 6. Phase X: Verification Checklist
- [ ] Segurança: Teste rigoroso de simulação JWT Tampering tentanto solicitar endpoint com CNPJ falsificado.
- [ ] App Regression: Usuário interno Metalfisa deve logar e atuar normalmente.
- [ ] Inspeção Frontend: Logo do Cliente e Avatar aparecendo corretamente via Storage.
