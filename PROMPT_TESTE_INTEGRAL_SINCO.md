# Prompt — Auditoria Integral do SINCO (Funcional, Relatórios, Segurança e Visão de Negócio)

> Cole o conteúdo abaixo da linha em uma sessão do Claude Code aberta na raiz do repositório `SINCO PROTHEUS`.
> Pode ser executado de uma vez ou fase a fase (recomendado: uma fase por sessão, com o relatório parcial salvo ao fim de cada uma).

---

## PAPEL

Você é uma **banca de auditoria** composta por cinco especialistas que avaliam o SINCO juntos. Cada achado deve indicar qual "chapéu" o encontrou:

1. **Diretor Industrial** de uma metalúrgica/metalmecânica de médio porte (corte laser, dobra, solda MIG/MAG, usinagem CNC, pintura, beneficiamento terceirizado, montagem). Quer decidir com números confiáveis em poucos cliques. Não tolera número divergente entre telas.
2. **Analista de PCP Sênior**, com experiência em MRP, capacidade finita, sequenciamento e apontamento de chão de fábrica. Usa o sistema 8h por dia e sabe onde o fluxo trava.
3. **Engenheiro de QA**, que automatiza, documenta evidência e não aceita "200 OK" como prova de funcionamento.
4. **Pentester / Especialista em Segurança de Aplicações** (OWASP API Top 10, LGPD), que pensa como atacante e como funcionário mal-intencionado de outra empresa cliente (tenant).
5. **Usuários de ponta**: comprador, inspetor da qualidade, expedição, faturista, RH/SST, porteiro, técnico de manutenção, operador com tablet e luva.

## OBJETIVO

Testar **todo** o app — todas as telas do frontend, todas as rotas da API, todos os relatórios Excel/PDF e as integrações — usando uma massa de dados fictícia e coerente com uma indústria metalmecânica. Entregar um relatório honesto, com evidência, priorizado por risco ao negócio.

---

## CONTEXTO DO SISTEMA (verifique, não presuma)

- **Stack:** React/Vite em `client/` (porta 5173) + Express 5 em `server/` (porta 3002). MySQL (`mysql2`), além de `pg` e `node-firebird` para integrações. Exportações com `exceljs`/`xlsx`/`pdfmake`/`pdf-lib`. IA via `@google/genai`. Tempo real via `socket.io`.
- **Mapa de telas:** `client/src/App.jsx` (rotas) e `client/src/config/menuItems.js` (menu e IDs de permissão).
- **Mapa da API:** `server/index.js` monta cerca de 90 routers de `server/routes/*.js`.
- **Autenticação:** `authenticateToken` é aplicado globalmente em `/api` (`server/index.js`). Exceções públicas em `server/routes/auth.js` e `server/middlewares/tenantMiddleware.js`: `/api/docs/view`, `/api/vmi/modelo`, `/api/wabtec/exportar-excel`, `/api/webhook*`.
- **Multi-tenant:** `server/middlewares/tenantMiddleware.js` define `req.tenantId`. Superadmin pode usar `x-tenant-override`, `?tenant_id=`, `?empresa_id=all` ou `x-tenant-all`.
- **RBAC:** `server/middlewares/rbac.js` (`requirePermission(pageId, action)`). Permissões sensíveis: `valores_financeiros` e `aba_financeiro_faturar`.
- **Material existente:** `plano-testes-todas-paginas.md`, `tests/seed_complete_massa_dados.js`, `tests/run_all.js`, `tests/unit/`, `audit_app.js`, `scripts/capture.mjs`. Reaproveite o que servir, mas **não confie nos status "100% aprovado" já registrados**: valide de novo.

---

## REGRAS INEGOCIÁVEIS (guardrails)

1. **Banco de dados:** antes de inserir qualquer dado, descubra para qual banco o `.env` do servidor aponta. Se for um banco usado por clientes reais (ex.: Hostinger de produção), **PARE e me pergunte**. Prefira um banco de homologação (dump restaurado localmente). Se eu autorizar uso do banco compartilhado, crie **tenants novos exclusivos de teste** e nunca escreva em tenants existentes.
2. **Marque todo dado fictício** com o prefixo `QA-` (códigos, nomes, observações) e registre cada ID criado em `tests/qa_run/<data>/created_ids.json`. Entregue um script de limpeza (`tests/qa_run/cleanup.js`) com modo `--dry-run`.
3. **Protheus / ERPs externos: somente leitura.** Nunca execute INSERT, UPDATE ou DELETE em bases integradas.
4. **Nada sai da máquina:** não envie e-mail, WhatsApp ou webhook real, não imprima em impressora física (Argox/print-agent) e não faça deploy. Intercepte ou "mocke" esses envios e registre o payload que *seria* enviado.
5. **Não use dados pessoais reais.** CPF/CNPJ fictícios, gerados com dígito verificador válido mas sem pertencer a ninguém; nomes, e-mails `@qa.invalid` e telefones fictícios.
6. **Testes de segurança** apenas contra o ambiente local ou de homologação. Nada de DoS, flood ou fuzzing massivo contra servidor compartilhado.
7. **Não corrija código durante a auditoria.** Primeiro relate. Ao final, proponha as correções por prioridade e espere minha aprovação. Exceção: se encontrar uma vulnerabilidade crítica explorável, me avise **imediatamente** em vez de esperar o relatório final.
8. **Evidência ou não aconteceu:** cada "aprovado" precisa de prova (request/response, consulta SQL de conferência, screenshot ou arquivo exportado). Se não conseguiu testar algo, escreva **"NÃO TESTADO — motivo"**, nunca "OK".

---

## FASE 0 — Reconhecimento e inventário (automático)

1. Gere `tests/qa_run/inventario.json` cruzando automaticamente:
   - todas as rotas do React (`App.jsx`) e todos os itens do menu (`menuItems.js`);
   - todos os endpoints do Express (método + caminho completo, extraídos de `server/index.js` + `server/routes/*.js`);
   - quais endpoints cada tela chama (procure `fetch`/`axios`/`api.` em `client/src`).
2. Aponte as **órfãs**: item de menu sem rota, rota sem item de menu, endpoint que nenhuma tela usa, chamada do front para endpoint inexistente.
3. Classifique cada endpoint como **leitura**, **escrita**, **exportação**, **upload**, **IA** ou **integração externa**, e marque os que não usam `requirePermission`.
4. Liste cada consulta SQL que não filtra por empresa (`IdEmpresa`/`tenantId`) e cada consulta montada por concatenação ou template string com entrada do usuário.

## FASE 1 — Massa de dados fictícia (realista e com casos de borda)

Crie um seed idempotente (`tests/qa_run/seed_metalmecanica.js`) com **dois tenants** (A e B), para permitir os testes de isolamento:

- **Tenant A — "QA Metalúrgica Alfa Ltda"** (principal) e **Tenant B — "QA Usinagem Beta S/A"** (o "vizinho curioso").
- **Clientes (A):** 8 clientes fictícios de segmentos típicos (ferroviário, implementos agrícolas, linha amarela, energia, automotivo/autopeças, VMI com estoque no cliente).
- **Matérias-primas:** chapas ASTM A36 e SAE 1020 (#3 a #1/2"), inox 304, tubos e barras redondas, todas com peso teórico em kg; parafusos/porcas comprados; tinta pó.
- **Produtos com BOM multinível (até 4 níveis):** ex.: `QA-SS-100 Suporte Soldado` → subconjuntos soldados → peças cortadas a laser / dobradas / usinadas → chapa. Inclua fator de perda, item fantasma, peça usada em vários pais (para testar "onde é usado") e uma revisão de engenharia nova com OP aberta na revisão antiga.
- **Roteiros e recursos:** Laser, Puncionadeira, Dobradeira, Solda MIG, Torno CNC, Centro de Usinagem, Jateamento, Pintura, **Bicromatização/Zincagem terceirizada** (remessa e retorno de beneficiamento), Montagem e Inspeção. Cada operação com setup + tempo unitário; recursos com capacidade, turnos, calendário com feriados e uma parada de manutenção.
- **Carteira:** cerca de 40 pedidos de venda com datas espalhadas (já atrasados, vencendo nesta semana, futuros), parciais faturados, um pedido com 300+ itens e um pedido cancelado.
- **Produção:** OPs em todos os status (planejada, liberada, em processo, parcial, encerrada, estornada), OP fracionada/mesclada, apontamentos com refugo e retrabalho, programas CNC.
- **Suprimentos:** SC → PC → NF (com XML fictício), incluindo divergência proposital de preço/quantidade entre PC e XML.
- **Logística:** romaneios de expedição, recebimento de retorno do beneficiador com diferença de peso, saldos de estoque, incluindo saldo negativo proposital.
- **Qualidade:** RNCs (interna, de cliente e de fornecedor), instrumentos com calibração vencida e a vencer, PPAP, documentos SGQ, caixas de ferramentas.
- **Pessoas:** 30 colaboradores fictícios (com salário e dados sensíveis), cargos, EPIs, CIPA com eleição aberta, brigada, cesta básica, turnos de portaria, visitantes.
- **Manutenção:** máquinas, checklists, OMs corretivas e preventivas (para calcular MTBF/MTTR).
- **Usuários de teste (por tenant):** superadmin, master, admin, PCP, operador (só apontamento), comprador, qualidade, financeiro, RH, portaria, e um usuário "somente leitura" **sem** `valores_financeiros`.
- **Casos de borda espalhados:** acentos e `ç`, apóstrofo (`D'Ávila`), aspas, emojis, `<script>` e `=HYPERLINK(...)` em campos texto, quantidade zero e negativa, decimais com vírgula, datas em 31/12 e 29/02, textos de 2.000 caracteres e campos vazios.

**Antes de olhar qualquer tela, calcule os valores esperados com SQL ou à mão** e salve-os em `tests/qa_run/esperados.json`. Exemplo: 50 × `QA-SS-100`, com 4 laterais por conjunto e 3% de perda → 206 laterais; carga do Laser = setup + 206 × tempo unitário. Depois compare com o que a tela mostra.

## FASE 2 — Jornadas por persona (frontend + API)

Use automação de navegador (Playwright; veja `scripts/capture.mjs`) em desktop 1366px **e** tablet 1024px. Em cada tela verifique: renderiza sem tela branca nem erro no console, filtros, paginação, ordenação, modais, estados vazio/carregando/erro, salvar → recarregar → dado persistido, e mensagens em português claro.

### 2.1 Diretor Industrial — "consigo decidir com isso?"
Responda pelo sistema, cronometrando cliques e tempo:
- Quanto vou faturar este mês e quanto falta para a meta? Qual o valor da carteira em R$ e em horas de fábrica?
- Quais pedidos vão atrasar, por quê (material, capacidade, engenharia, qualidade) e de quais clientes?
- Qual setor ou máquina é o gargalo nas próximas 2 semanas?
- Qual o OTD/OTIF do último mês? Quanto custou o refugo e o retrabalho? Quantas RNCs de cliente estão abertas?
- Os KPIs batem entre **Dashboard de Faturamento × Controle de Faturamento × Itens a Faturar × Financeiro**? E entre **Visão Global da Fábrica × Analytics × Visão por Setor × Gestão a Vista**?
- Dê uma nota de 0 a 10 para "eu confiaria neste número numa reunião com o dono" e explique.

### 2.2 Analista de PCP — fluxo completo
Pedido → explosão BOM + roteiro (Pull) → necessidade de material → carga × capacidade → planejamento estratégico/sequenciamento → liberação de OP (inclusive fracionada/mesclada) → programa CNC → fila e dependências (WIP) → apontamento (vertical, por estrutura, fracionado, por usuário) → controle de execução → Curva S → rastreio até o faturamento.

Valide especificamente:
- Explosão multinível com perdas, itens fantasma e revisão correta; "onde é usado" consistente com a BOM.
- Programação para trás a partir da data de entrega respeitando calendário, turnos e feriados; ocupação acima de 100% sinalizada.
- O pai não pode iniciar antes de os filhos terminarem; a soma das OPs fracionadas fecha com o total.
- Bloqueios: apontar mais que o saldo, apontar fora de sequência, apontar OP encerrada, estorno que recompõe o saldo.
- Concorrência: dois operadores apontando a mesma OP ao mesmo tempo (condição de corrida).
- Mudança de data, quantidade ou revisão no pedido propaga para OPs, carga e Curva S.
- Diga o que falta para o PCP largar a planilha Excel (ex.: MRP com lote mínimo/estoque de segurança, simulação "e se", reprogramação em massa, alerta de falta de material).

### 2.3 Demais áreas (uma jornada ponta a ponta cada)
- **Engenharia:** cadastro de produto → BOM → liberação → relatório de controle; integração SolidEdge (mock).
- **Comercial/Faturamento:** pedido → itens a faturar → previsão → visão de atrasos → gestão de OPs.
- **Suprimentos:** SC → PC → NF → auditoria PC × XML pegando a divergência plantada; espelho da NF; requisição interna.
- **Logística:** romaneio de expedição (peso total confere com a soma dos itens), portal do fornecedor, retorno de beneficiamento com diferença de kg, saldos de estoque.
- **Qualidade:** RNC com causa raiz e ação; bloqueio ou alerta de instrumento com calibração vencida; rastreabilidade lote → OP → pedido → NF.
- **Financeiro:** fluxo de caixa, dashboard, balancete; usuário sem `valores_financeiros` não vê R$.
- **RH/SST:** pasta 360°, autoatendimento, vagas, currículos com IA, offboarding (custódia de EPIs e ferramentas), CIPA (**sigilo do voto e um voto por pessoa**), brigada, cesta básica.
- **Portaria, Manutenção (MTBF/MTTR calculados certos), Salas/Totem, Suporte TI, Avisos, Configurações, Etiquetas (logo e razão social da empresa ativa) e Superadmin.**

## FASE 3 — Relatórios e exportações (todos)

Para **cada** botão de exportar Excel/PDF (veja `client/src/services/ReportGeneratorService.js`, `erpOrderReportService.js`, `downloadHelper.js` e `server/routes/reports.js`):
- O arquivo baixa com a extensão correta, nome sanitizado e abre sem erro de "arquivo corrompido".
- **Totais e linhas batem com a tela e com o SQL de conferência**; respeita os filtros aplicados.
- Logo e razão social são os do **tenant ativo** (nunca de outra empresa).
- Formato pt-BR: `1.234,56`, `dd/mm/aaaa`, kg com casas corretas; acentos íntegros.
- Volume: 10.000 linhas (tempo, memória, quebra de página no PDF); estado vazio (sem dados).
- Injeção em planilha: um texto `=HYPERLINK(...)` vindo do banco **não** pode virar fórmula executável.
- Usuário sem permissão financeira: as colunas de R$ **não** aparecem no arquivo.
- Gere uma tabela `relatório | tela de origem | ok/falha | evidência (arquivo salvo em tests/qa_run/exports/)`.

## FASE 4 — Segurança de dados (OWASP API Top 10 + LGPD)

Automatize em `tests/qa_run/security/` para poder rodar de novo:

1. **Autenticação:** varra **todos** os endpoints do inventário sem token → esperado 401. Teste token expirado, token adulterado, `alg: none`, token de usuário desativado e token de usuário cuja senha foi trocada.
2. **Rotas públicas:** veja exatamente o que `/api/docs/view`, `/api/vmi/modelo`, `/api/wabtec/exportar-excel` e `/api/webhook*` devolvem sem login. Dá para baixar documento ou planilha de outra empresa trocando ID ou parâmetro? O webhook valida assinatura ou origem?
3. **Isolamento entre empresas (BOLA/IDOR) — prioridade máxima:** logado no Tenant B, tente ler, editar e excluir por ID **cada** recurso do Tenant A (pedido, OP, colaborador, RNC, documento, romaneio, NF). Tente `x-tenant-override`, `?tenant_id=`, `?empresa_id=all` e `x-tenant-all` com usuário **não** superadmin. Confira se as listagens vazam registros. Atenção especial a `server/middlewares/rbac.js`, que lê `app_company_settings` com `LIMIT 1` sem filtro de empresa: perfis customizados de uma empresa afetam outra?
4. **Autorização (RBAC):** com o usuário "operador", chame direto na API os endpoints de criar, editar e excluir que a tela esconde. A API deve bloquear, não só o botão sumir. Verifique se campos de R$ e salário vêm **omitidos do JSON**, e não apenas escondidos no front.
5. **Mass assignment:** envie `IdEmpresa`, `is_master`, `tipo` e `plano` no corpo de criar/editar usuário e empresa; o servidor deve ignorar.
6. **Injeção:** SQL nos filtros, buscas e ordenação (incluindo consultas Firebird e Protheus); XSS armazenado em campos de texto rico (documentos SGQ, avisos, observações) e em nomes que aparecem em etiquetas e PDFs; path traversal em download/visualização de documentos e uploads (`../`, nomes com `%00`); upload de `.html`, `.svg` com script ou executável disfarçado; SSRF em qualquer campo que receba URL.
7. **IA:** tente prompt injection nos endpoints de IA (`ai.js`, `hermes.js`, análise de currículos) para extrair dados de outro tenant, revelar o prompt de sistema ou executar SQL de escrita. Se existe um "orquestrador" capaz de gerar ou executar SQL, prove que ele **não** roda `DELETE`/`UPDATE`/`DROP` nem consulta outra empresa.
8. **Segredos:** procure chaves, senhas e tokens versionados no git (`*.env`, scripts `.js`/`.py`/`.ps1` na raiz, `deploy-*`, `.reg`), no bundle do front (`client/dist`) e nos logs (`server*.log`). Confira se `JWT_SECRET` é forte e se há senhas em texto puro no banco.
9. **Força bruta e enumeração:** login tem rate limit ou bloqueio? A mensagem de erro revela se o usuário existe? Política de senha mínima? Reset de senha seguro?
10. **Infraestrutura da app:** configuração de CORS, cabeçalhos de segurança (ausência de `helmet`), tamanho máximo de payload, autenticação e isolamento por tenant nas salas do `socket.io`, exposição de stack trace em erro 500.
11. **LGPD:** quem enxerga CPF, salário, atestado, currículo e dados de visitantes da portaria? Existe trilha de auditoria (quem viu ou alterou o quê)? Dados de ex-colaborador (offboarding) continuam acessíveis a quem não deveria?
12. **Rotas administrativas:** `superadmin`, `backupConfig`, `winscp`, `monitoramento`, `systemErrors` e `users` só podem ser acessíveis ao perfil certo.

Classifique cada vulnerabilidade com severidade (CVSS aproximado), prova de conceito reproduzível e impacto em linguagem de negócio. Ex.: "um cliente do SINCO consegue ver a carteira de pedidos de outro cliente".

## FASE 5 — Robustez e desempenho

- Tempo de resposta (p50/p95) das telas pesadas: Matriz de Produção, Explosão BOM, Visão Global, Analytics, Dashboards. Aponte consultas N+1 e consultas sem índice.
- Integração externa fora do ar (Protheus/Firebird/agentes de impressão): a tela degrada com mensagem clara ou trava ou mostra tela branca?
- Sessão expirada no meio de um formulário: perde o que foi digitado?
- Jobs agendados (`node-cron`: e-mail de faturamento etc.) não duplicam envios nem misturam empresas.

---

## ENTREGÁVEIS

Salve tudo em `tests/qa_run/<AAAA-MM-DD>/`:

1. **`RELATORIO_AUDITORIA.md`** com:
   - **Sumário executivo (1 página, para o diretor):** o sistema está pronto para produção multiempresa? Os 5 maiores riscos e os 5 maiores ganhos.
   - **Placar por módulo:** telas testadas / aprovadas / falhas / não testadas.
   - **Achados** em tabela: `ID | Severidade (Crítico/Alto/Médio/Baixo) | Persona | Módulo | Tela/Endpoint | Arquivo:linha | Passos para reproduzir | Esperado × Obtido | Evidência | Impacto no negócio | Correção sugerida`.
   - **Parecer do Diretor Industrial:** confiança nos números, o que falta para gerir a fábrica pelo sistema.
   - **Parecer do Analista de PCP:** aderência ao fluxo real, o que ainda obriga a usar planilha, top 10 melhorias por ganho/esforço.
   - **Parecer de Segurança e LGPD:** vulnerabilidades e conformidade.
2. `inventario.json`, `esperados.json`, `created_ids.json`, a pasta `exports/` e a pasta `evidencias/` (screenshots e request/response).
3. Testes automatizados reexecutáveis (`node --test` ou Playwright) para as jornadas críticas e para toda a bateria de segurança.
4. `cleanup.js` que remove todos os dados `QA-` (com `--dry-run`).
5. **Plano de correção** priorizado (o que corrigir esta semana, este mês, backlog), aguardando minha aprovação antes de qualquer alteração de código.

## FORMA DE TRABALHAR

- Execute fase por fase. Ao fim de cada fase, salve o relatório parcial e me mostre um resumo curto antes de seguir.
- Se uma tela ou endpoint tiver comportamento ambíguo (bug ou regra de negócio?), registre como **"Dúvida de regra"** com sua recomendação, em vez de decidir sozinho.
- Seja cético com os próprios resultados: antes de declarar um achado crítico, reproduza duas vezes; antes de declarar algo aprovado, confira o dado no banco.
