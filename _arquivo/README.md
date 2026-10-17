# _arquivo

Scripts avulsos (correções pontuais, migrações já aplicadas, diagnósticos e rascunhos) que estavam soltos na raiz do projeto e na raiz de `server/`.

Nenhum deles é carregado pelo app, pelos inicializadores (`.bat`/`.vbs`), pelo PM2 (`ecosystem.config.js`) ou pelos scripts de deploy. Isso foi verificado pelo grafo de `require` a partir de `server/index.js`, `print-agent.js` e `print-bridge.js`, e por busca do nome de cada arquivo em todo o restante do repositório.

- `raiz/`: vieram da raiz do projeto.
- `server/`: vieram de `server/` e usam caminhos relativos a essa pasta (`./services/...`). Para rodar um deles de novo, mova-o de volta para `server/`.

Depois de algumas semanas sem que nada aqui faça falta, a pasta pode ser apagada. O histórico continua no git (tag `pre-sanitizacao`).
