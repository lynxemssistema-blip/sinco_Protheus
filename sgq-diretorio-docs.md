# Plano: Escaneamento de Diretório e IA Multidocumento no SGQ

Este plano define a implementação para permitir que o usuário aponte uma pasta local do servidor contendo vários arquivos do SGQ (PDF, Word) e use o Assistente de IA de forma flexível para reescrever procedimentos por setor direto no editor de texto.

- **Tipo do Projeto:** WEB (React Frontend + Node.js Backend)

## Critérios de Sucesso
- [x] Escanear com sucesso pastas de rede/locais do Windows e listar arquivos DOCX e PDF.
- [x] Interface gráfica flexível com checkboxes na barra lateral do Assistente de IA.
- [x] IA capaz de processar os arquivos selecionados como contexto e gerar respostas baseadas neles.
- [x] Inserção direta ou substituição fácil no SunEditor do navegador.
- [x] Agente de IA com poder de execução total na UI (alterar setores, carregar textos, preencher cabeçalho e salvar no banco MySQL de forma autônoma via comandos estruturados em JSON).

## Estrutura de Arquivos
- Modificar: `server/routes/ai.js` (Novas rotas de escaneamento de pasta e parse de múltiplos arquivos + Modo JSON estruturado)
- Modificar: `client/src/pages/sgq/Documentos.jsx` (Ajustes de UI no painel de Assistente de IA + Execução de Ações + ref para SunEditor)

## Cronograma de Tarefas

### Tarefa 1: Backend - Rotas e Leitura de Arquivos
- **Agente:** backend-specialist
- **Habilidades:** nodejs-best-practices, api-patterns
- **Entrada:** Caminho de pasta e array de arquivos selecionados.
- **Saída:** Endpoint `/scan-folder` e `/document-assist` atualizado para ler arquivos dinamicamente.
- **Verificação:** Testar endpoints via requisição HTTP/Postman.

### Tarefa 2: Frontend - Interface do Diretório e Seleção de Arquivos
- **Agente:** frontend-specialist
- **Habilidades:** react-best-practices, frontend-design
- **Entrada:** API de escaneamento e assistente.
- **Saída:** Input de caminho de pasta persistido, lista de checkboxes e envio de dados para a API.
- **Verificação:** Interagir visualmente, carregar arquivos da pasta de testes e selecionar arquivos desejados.

## Fase X: Verificação Final
- [x] Executar build de produção do frontend (`npm run build`).
- [x] Verificar integridade do sincronismo com `sync-deployment.ps1`.
- [x] Verificar conformidade de design (sem cores proibidas).

## ✅ PHASE X COMPLETE
- Lint: ✅ Pass
- Security: ✅ No critical issues
- Build: ✅ Success
- Date: 2026-06-19
