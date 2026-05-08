# 🎉 NOVA VERSÃO EM PRODUÇÃO - MetalFisa PCP

**Data**: 08/05/2026  
**Servidor**: http://192.168.1.77:3001

---

## ✅ NOVIDADES DESTA VERSÃO

### 🚀 Melhorias de Estabilidade Visual (Filtros de Pedido e OPs)

Fizemos ajustes cruciais nas telas de **Pedidos de Venda** e **Gestão de OPs por Lote** para melhorar o feedback visual ao usuário:

- ✅ **Fim da Tela Congelada ("Nada Acontece")**: Resolvemos um problema na tela de Pedidos de Venda onde o indicador "Buscando..." desaparecia instantaneamente ao recarregar filtros simultâneos. Agora o sistema sempre vai exibir corretamente quando estiver processando dados grandes.
- ✅ **Feedback na Gestão de OPs**: Adicionamos o indicador visual explícito "Buscando..." com o ícone giratório na tela de *Gestão de OPs por Lote*, garantindo padronização e garantindo que os usuários saibam quando o sistema está em atividade.

### 🖨️ Integração de Impressão na Visão Plana (Lista Plana)

- ✅ **Impressão Múltipla na Visão de Itens**: Agora é possível imprimir e gerar atas diretamente das linhas da visão "Lista Plana" (Flat) no módulo de Engenharia/PCP, assim como já funcionava na visão agrupada.
- ✅ **Múltiplos Formatos Atendidos**: Geração de Ata Viva, PDF de OP, espelho de planejamento e Excel diretamente da lista plana.

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

**Versão**: 1.3.14 (Estabilidade Visual & Impressão Lista Plana)  
**Build**: 08/05/2026 12:00

**Comando de Publicação no servidor**
scp -o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedKeyTypes=+ssh-rsa -r ./linux-deployment/* sinco@192.168.1.77:/var/www/metalfisa/

**Comando para Reiniciar o servidor**
ssh -o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedKeyTypes=+ssh-rsa sinco@192.168.1.77 "cd /var/www/metalfisa/server && npm install && pm2 restart all"


