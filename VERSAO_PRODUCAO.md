# 🎉 NOVA VERSÃO EM PRODUÇÃO - MetalFisa PCP

**Data**: 12/05/2026  
**Servidor**: http://192.168.1.77:3001

---

## ✅ NOVIDADES DESTA VERSÃO

### 🚀 Configuração de Apontamento Multi-Operação
Adicionado um controle nas Configurações do Sistema para habilitar/desabilitar o apontamento em massa de operações pendentes.

- ✅ **Controle Global**: Nova chave de ativação na aba "Geral" das Configurações do Sistema.
- ✅ **Bloqueio no Chão de Fábrica**: Se desativado, o modal de apontamento esconde o roteiro completo e obriga o apontamento exclusivo da operação atual.
- ✅ **Melhoria Visual**: Feedback visual (aviso em amarelo) informando aos operadores quando o modo Multi-Operação foi desativado pela diretoria.

---

## 📢 COMO ATUALIZAR PARA VER A NOVA VERSÃO

### ⚠️ IMPORTANTE: Limpar Cache do Navegador

Os usuários precisam **forçar a atualização** para ver a nova versão:

### Opção 1️⃣ - Rápida (Recomendada)

1. Acesse: `http://192.168.1.77:3001`
2. Pressione: **CTRL + SHIFT + R** (ou **CTRL + F5**)
3. Pronto! A nova versão será carregada

### Opção 2️⃣ - Completa (se a Opção 1 não funcionar)

1. Pressione: **CTRL + SHIFT + DELETE**
2. Marque: "Imagens e arquivos em cache"
3. Clique: "Limpar dados"
4. Recarregue a página (F5)

---

## 📞 SUPORTE

Em caso de problemas:

1. ✅ Certifique-se de que limpou o cache do navegador
2. ✅ Verifique se o servidor está rodando
3. ✅ Teste o acesso ao compartilhamento de rede manualmente

**Endereço do sistema**: http://192.168.1.77:3001

---

**Versão**: 1.5.0 (Configuração de Apontamento Multi-Operação)  
**Build**: 12/05/2026 07:40

**Comando de Publicação no servidor**
scp -o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedKeyTypes=+ssh-rsa -r ./linux-deployment/* sinco@192.168.1.77:/var/www/metalfisa/

**Comando para Reiniciar o servidor**
ssh -o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedKeyTypes=+ssh-rsa sinco@192.168.1.77 "cd /var/www/metalfisa/server && npm install && pm2 restart all"


