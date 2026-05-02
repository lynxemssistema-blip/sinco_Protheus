# 🎉 NOVA VERSÃO EM PRODUÇÃO - MetalFisa PCP

**Data**: 17/01/2026  
**Servidor**: http://192.168.1.169:3001

---

## ✅ NOVIDADES DESTA VERSÃO

### 🎨 Cores nos Pedidos de Venda

Agora a lista de pedidos possui identificação visual por cores:

- 🟢 **VERDE (Aberto)**: Pedidos liberados sem OP aberta.
- 🟡 **AMARELO (Liberado)**: Pedidos com OP aberta (Liberado PC).
- 🔴 **Vermelho (Faturado)**: Pedidos 100% faturados agora são **ocultos** automaticamente da lista para facilitar a visualização do que está pendente.

### 🚀 Importação em Massa de Documentos - CORRIGIDO

Agora você pode usar **drives mapeados** (Q:, Z:, etc.) na importação em massa!

**Exemplo:**
- Digite: `Q:\desenhos\PHILLIPS\VMI`
- O sistema automaticamente converte para o caminho de rede correto
- Todos os arquivos PDF serão vinculados aos produtos

**Melhorias:**
- ✅ Suporte completo a pastas de rede mapeadas
- ✅ Conversão automática de drives (Q:, Z:) para caminhos UNC
- ✅ Mensagens de erro mais claras e específicas
- ✅ Processamento recursivo em subpastas

---

## 📢 COMO ATUALIZAR PARA VER A NOVA VERSÃO

### ⚠️ IMPORTANTE: Limpar Cache do Navegador

Os usuários precisam **forçar a atualização** para ver a nova versão:

### Opção 1️⃣ - Rápida (Recomendada)

1. Acesse: `http://192.168.1.169:3001`
2. Pressione: **CTRL + SHIFT + R** (ou **CTRL + F5**)
3. Pronto! A nova versão será carregada

### Opção 2️⃣ - Completa (se a Opção 1 não funcionar)

1. Pressione: **CTRL + SHIFT + DELETE**
2. Marque: "Imagens e arquivos em cache"
3. Clique: "Limpar dados"
4. Recarregue a página (F5)

---

## 🎯 COMO USAR A IMPORTAÇÃO EM MASSA

### Passo a Passo:

1. **Acesse o sistema**: http://192.168.1.169:3001
2. **Navegue**: Catálogo de Produtos → Documentos (ícone 📄)
3. **Clique**: "Importação em Massa"
4. **Informe o caminho**: Ex: `Q:\desenhos\PHILLIPS\VMI`
5. **Marque** (opcional): "Atualizar vínculos existentes"
6. **Clique**: "Iniciar Importação"

### Como Funciona:

O sistema irá:
- Varrer a pasta informada (incluindo subpastas)
- Buscar todos os arquivos PDF
- Vincular automaticamente ao produto pelo nome do arquivo
  - Exemplo: `XA100.pdf` será vinculado ao produto **XA100**

### Formatos de Caminho Aceitos:

✅ **Drive mapeado**: `Q:\desenhos\PHILLIPS\VMI`  
✅ **Caminho UNC**: `\\192.168.1.253\Engenharia\desenhos\PHILLIPS\VMI`  
✅ **Caminho local**: `C:\Arquivos\Documentos`

---

## 🔧 PARA ADMINISTRADORES

### Iniciar o Servidor:

Execute o arquivo: **`INICIAR_SISTEMA.bat`**

Este script:
- Configura acesso automático ao compartilhamento de rede
- Inicia o servidor na porta 3001
- Disponibiliza o sistema para todos na rede

### Configurações de Rede:

**Servidor**: 192.168.1.169:3001  
**Compartilhamento**: \\192.168.1.253\Engenharia  
**Credenciais**: Configuradas automaticamente no script

### Mapeamento de Drives:

O sistema converte automaticamente:
- `Q:\` → `\\192.168.1.253\Engenharia\`

Para adicionar outros drives, edite:  
`server/config/driveMapping.js`

---

## 📞 SUPORTE

Em caso de problemas:

1. ✅ Certifique-se de que limpou o cache do navegador
2. ✅ Verifique se o servidor está rodando (janela aberta)
3. ✅ Teste o acesso ao compartilhamento de rede manualmente

**Endereço do sistema**: http://192.168.1.169:3001

---

**Versão**: 1.3.11 (Status Firme/Prevista OP e Autopreenchimento PCP)  
**Build**: 01/05/2026 15:31

**Comando de Publicação no servidor**
scp -o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedKeyTypes=+ssh-rsa -r ./linux-deployment/* sinco@192.168.1.77:/var/www/metalfisa/


**Comando para Reiniciar o servidor**
ssh -o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedKeyTypes=+ssh-rsa sinco@192.168.1.77 "cd /var/www/metalfisa/server && npm install && pm2 restart all"


