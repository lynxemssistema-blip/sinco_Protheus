# SINCO Suite | Lynx EMS

Sistema integrado de gestão industrial (PCP, produção, engenharia/BOM, faturamento, romaneios, SGQ, RH/SST, portaria, compras, manutenção e portal do cliente) da **Lynx EMS**.

## Stack
- **Frontend:** React + Vite + Tailwind CSS (`client/`)
- **Backend:** Node.js + Express 5 + Socket.io (`server/`)
- **Banco de dados:** MySQL `u494795077_SINCO` (Hostinger) — único banco permitido
- **Produção:** https://lynxems.com.br (PM2)

## Desenvolvimento
```bash
npm run dev:all        # sobe API e frontend
cd server && npm test  # testes unitários
cd client && npm run build
```

## Publicação
1. `cd client && npm run build`
2. `powershell ./sync-deployment.ps1` (sincroniza `linux-deployment/`)
3. Deploy via workflow `/publicacao-sinco` (SSH/SCP para a Hostinger)

## Estrutura
| Pasta | Conteúdo |
|---|---|
| `client/src/pages` | Páginas por módulo (lazy-loaded) |
| `server/routes` | Rotas da API por domínio |
| `server/services` | Regras de negócio, e-mail, WhatsApp, PDFs |
| `server/migrations` | Migrações de schema |
| `scripts/` | Utilitários de manutenção |
| `tests/` | Testes unitários |
| `_arquivo_morto/` | Arquivos legados (ignorado pelo git e fora do deploy) |

---
**Lynx EMS - 2026**
