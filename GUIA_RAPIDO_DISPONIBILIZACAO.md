# 🚀 Guia Rápido - Disponibilizar Sistema MetalFisa PCP

## ⚡ Início Rápido (3 Passos)

### 1️⃣ Iniciar o Servidor

**Duplo clique em:** `INICIAR_SISTEMA.bat`

✅ Isso irá:
- Configurar acesso automático à rede
- Iniciar servidor na porta 3001
- Disponibilizar sistema em: `http://192.168.1.184:3001`

> ⚠️ **IMPORTANTE:** Mantenha a janela aberta! Fechar = servidor para.

---

### 2️⃣ Verificar se Está Funcionando

Abra seu navegador e acesse:
```
http://192.168.1.184:3001
```

Se carregar a tela de login ✅ está funcionando!

---

### 3️⃣ Avisar os Usuários

Escolha uma opção:

**Opção A - Email:**
- Copie conteúdo do arquivo: `EMAIL_USUARIOS.txt`
- Envie para todos os usuários

**Opção B - Script de Notificação:**
- Execute: `NOVA_VERSAO.bat` (nova versão disponível)
- OU: `ATUALIZACAO_OBRIGATORIA.bat` (atualização obrigatória)

---

## 🔍 Verificações Rápidas

### ✅ Servidor está rodando?
```powershell
netstat -ano | findstr :3001
```
Se aparecer resultado = servidor ativo ✅

### ✅ Endereço de acesso correto?
```
http://192.168.1.184:3001
```

### ✅ Build do cliente atualizado?
A pasta existe: `client\dist` ✅

---

## 🛠️ Solução Rápida de Problemas

| Problema | Solução Rápida |
|----------|----------------|
| **Sistema não abre** | Limpar cache: CTRL + SHIFT + R |
| **Servidor não inicia** | Verificar se porta 3001 já está em uso |
| **Erro de rede** | Executar como Admin: `CONFIGURAR_ACESSO_REDE.bat` |
| **Página em branco** | Verificar se `client\dist` existe e tem arquivos |

---

## 📞 O que os Usuários Devem Fazer

### 1. Acessar:
```
http://192.168.1.184:3001
```

### 2. Limpar cache (IMPORTANTE!):
```
CTRL + SHIFT + R
```
ou
```
CTRL + F5
```

### 3. Fazer login com suas credenciais

---

## 📊 Monitoramento

### Logs em Tempo Real
Observe a janela do servidor. Cada acesso aparece assim:
```
📡 [2026-01-17T...] GET / from 192.168.1.XXX
```

### Parar o Servidor
Feche a janela do prompt ou pressione CTRL+C

### Reiniciar o Servidor
Execute novamente: `INICIAR_SISTEMA.bat`

---

## 📚 Documentação Completa

Para mais detalhes, consulte:
- `implementation_plan.md` - Guia completo de disponibilização
- `VERSAO_PRODUCAO.md` - Notas da versão atual
- `task.md` - Checklist de tarefas

---

## 🔧 SolidEdge Agent (Para Usuários de Engenharia)

### Quem Precisa do Agent?

Apenas usuários que trabalham com **SolidEdge** (Engenharia/Projetos) precisam instalar o Agent.

### Como Distribuir:

**Opção 1 - Copiar para Rede:**
```cmd
Execute: COPIAR_AGENT_PARA_REDE.bat
```
Isso copiará o Agent para: `\\192.168.1.253\Engenharia\MetalFisa\solidedge-agent`

**Opção 2 - Distribuir ZIP:**
- Compacte a pasta `solidedge-agent` em ZIP
- Envie por email ou compartilhe na rede

### Notificar Usuários:

- Copie o conteúdo de: `EMAIL_USUARIOS_AGENT.txt`
- Envie para usuários da Engenharia
- Anexe ou indique o guia: `GUIA_INSTALACAO_AGENT.md`

### O que os Usuários Devem Fazer:

1. Copiar pasta do Agent para `C:\MetalFisa\solidedge-agent`
2. Executar `INSTALAR_AGENT.bat`
3. Executar `CONFIGURAR_FIREWALL_AGENT.bat` (como Admin)
4. Criar atalho de `INICIAR_AGENT.bat` na área de trabalho

### Como Usar Diariamente:

1. Abrir SolidEdge
2. Executar `INICIAR_AGENT.bat`
3. Manter janela aberta
4. Acessar sistema normalmente

---

## ✅ Checklist Final

Antes de disponibilizar:
- [ ] Executei `INICIAR_SISTEMA.bat`
- [ ] Janela do servidor está aberta
- [ ] Testei acesso local: `http://localhost:3001`
- [ ] Testei acesso na rede: `http://192.168.1.184:3001`
- [ ] Sistema carregou com sucesso
- [ ] Avisei os usuários web
- [ ] (Se aplicável) Copiei Agent para rede: `COPIAR_AGENT_PARA_REDE.bat`
- [ ] (Se aplicável) Avisei usuários de Engenharia sobre Agent

**Pronto!** 🎉 Sistema disponível para todos na rede!

---

**Endereço de Acesso:** `http://192.168.1.184:3001`
