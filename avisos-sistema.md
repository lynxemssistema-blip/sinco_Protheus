# Sistema de Avisos e Comunicação Instantânea

## Goal
Implementar um sistema de avisos flutuantes entre os usuários, com histórico completo no banco de dados, visualização (Caixa de Entrada) no menu "Sistema", e que não bloqueie o uso da aplicação.

## Tasks

### Backend (Banco de Dados e API)
- [ ] Task 1: Criar tabela `sistema_avisos` no Postgres (`CREATE TABLE sistema_avisos (id SERIAL PRIMARY KEY, remetente_id INT, destinatario_id INT, mensagem TEXT, lido BOOLEAN DEFAULT false, concluido BOOLEAN DEFAULT false, data_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP, data_conclusao TIMESTAMP, resposta_de_aviso_id INT);`). Modificar o script inicial se necessário, ou rodar a query na rota, e mapear os IDs de usuários para a tabela `usuarios`.
- [ ] Task 2: Criar rota do backend `server/routes/avisos.js` com os endpoints: `POST /api/avisos` (enviar), `GET /api/avisos/nao-concluidos` (listar popups), `PUT /api/avisos/:id/concluir` (marcar concluído), `GET /api/avisos/historico` (caixa de entrada global).
- [ ] Task 3: Importar a rota `/api/avisos` em `server/index.js`.

### Frontend (Componentes e Contextos)
- [ ] Task 4: Criar o componente `FloatingAvisos.jsx` em `client/src/components/`, que usará polling (`setInterval` a cada 30 segundos) chamando `/api/avisos/nao-concluidos` e renderizando os modais no canto inferior direito, usando portal ou posição fixa (z-index alto).
- [ ] Task 5: Inserir `<FloatingAvisos />` no `DefaultLayout.jsx` (ou onde for o shell principal logado) para garantir que seja renderizado em qualquer tela sem bloqueá-la.

### Frontend (Página e Menu)
- [ ] Task 6: Criar a tela completa `client/src/pages/AvisosHistorico.jsx` com duas abas: "Nova Mensagem" e "Histórico Completo", mostrando origem, destino, timestamps, status e texto do aviso.
- [ ] Task 7: Adicionar o link "/avisos" ao Sidebar (menu principal "Sistema"), apontando para `AvisosHistorico.jsx`. Adicionar também a rota no componente de rotas principal.

## Done When
- [ ] Os usuários puderem ver mensagens pop-up empilhadas ou isoladas no canto da tela.
- [ ] Os usuários puderem responder ou concluir um aviso do modal.
- [ ] Mensagens concluídas não voltam a aparecer.
- [ ] Histórico completo e pesquisa estiverem salvos permanentemente no banco Postgres.
- [ ] O menu "Avisos" aparecer debaixo do grupo "Sistema" no sidebar.
