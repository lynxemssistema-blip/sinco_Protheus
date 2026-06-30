# 🎉 NOVA VERSÃO EM PRODUÇÃO - MetalFisa PCP

**Data**: 27/06/2026  
**Servidor**: http://192.168.1.77:3001

---

## ✅ NOVIDADES DESTA VERSÃO — v1.6.0

### 🖨️ Sistema de Impressão de Etiquetas PPLB (NOVO!)
Implementação completa do motor de impressão industrial para etiquetas de identificação de produto, integrado diretamente com a página de Itens a Faturar.

- ✅ **Motor PPLB/EPL2**: Comunicação RAW direta com impressoras Argox, Zebra, Elgin, Datamax, Honeywell e Godex.
- ✅ **WYSIWYG Designer**: Editor visual de etiqueta em Canvas (600x440 dots = 75x55mm / 203 DPI) com Live Preview em tempo real.
- ✅ **Suporte a Couchê com Ribbon**: Comandos `OT` (Transferência Térmica) e `Q440,24` (Gap) configurados automaticamente.
- ✅ **Upload de Logo**: Processamento automático de PNG/JPG para bitmap 1-bit (GW command) pronto para impressão.
- ✅ **Campos Dinâmicos**: Configuração de linhas de texto com fonte, tamanho, negrito e posição (X/Y). Campos suportados: Pedido (Sistema), Pedido (Cliente), Produto, Descrição, Quantidade, Data de Entrega, Data de Emissão, Desenho (Cliente), Item.
- ✅ **Ocultar Campos**: Botão de olho (👁) para habilitar/desabilitar campos sem perder a configuração.
- ✅ **Modo USB e TCP**: Suporte a impressora USB local (via Print Bridge) e impressora de rede (TCP/IP direto na porta 9100).
- ✅ **Print Bridge**: Script `print-bridge.js` que cria um servidor TCP na porta 9100 e redireciona os bytes PPLB para a impressora USB compartilhada (`ArgoxUSB`).
- ✅ **Teste de Impressão**: Botão de imprimir teste direto do Designer, convertendo o Canvas para bitmap 1-bit via `sharp` e enviando via RAW.
- ✅ **Configuração Automática**: Botão de download de script `.bat` para configurar a impressora USB em qualquer computador da rede.
- ✅ **Ajuda Manual Integrada**: Modal com passo-a-passo detalhado de como instalar a impressora manualmente no Windows.

### 📊 Exportação de Materiais por Recurso (PCP)
Melhoria na separação de materiais na exportação para Excel da aba "Visão Geral".

- ✅ **Separação por Recurso de Solda**: Materiais de produtos com operação `MO0020` (Solda) são exportados em aba separada no Excel.
- ✅ **Agrupamento por Conjunto**: Parafusos e outros itens que acompanham peças soldadas são automaticamente agrupados na aba de solda.

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

## 🖨️ CONFIGURAÇÃO DA IMPRESSORA USB (NOVO)

Para habilitar impressão USB no computador local, execute o **Print Bridge**:

```bash
node print-bridge.js
```

O script fica em `C:\Users\lynx\Documents\MetalFisa Anty\print-bridge.js`.  
Ele cria um servidor TCP na porta 9100 que redireciona para a impressora `ArgoxUSB` (driver: **Argox OS-214 plus PPLB**).

---

## 📞 SUPORTE

Em caso de problemas:

1. ✅ Certifique-se de que limpou o cache do navegador
2. ✅ Verifique se o servidor está rodando
3. ✅ Teste o acesso ao compartilhamento de rede manualmente

**Endereço do sistema**: http://192.168.1.77:3001

---

**Versão**: 1.6.0 (Sistema de Impressão de Etiquetas PPLB + Exportação por Recurso)  
**Build**: 27/06/2026 18:48

**Comando de Publicação no servidor**
scp -o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedKeyTypes=+ssh-rsa -r ./linux-deployment/* sinco@192.168.1.77:/var/www/metalfisa/


**Comando para Reiniciar o servidor**
ssh -o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedKeyTypes=+ssh-rsa sinco@192.168.1.77 "cd /var/www/metalfisa/server && npm install && pm2 restart all"




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

**Versão**: 1.5.1 (Estabilização Fila-Dependências e Ajuda Contextual)  
**Build**: 15/05/2026 10:18

**Comando de Publicação no servidor**
scp -o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedKeyTypes=+ssh-rsa -r ./linux-deployment/* sinco@192.168.1.77:/var/www/metalfisa/


**Comando para Reiniciar o servidor**
ssh -o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedKeyTypes=+ssh-rsa sinco@192.168.1.77 "cd /var/www/metalfisa/server && npm install && pm2 restart all"


