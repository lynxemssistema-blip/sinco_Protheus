# Guia de Conexão em Rede - MetalFisa Anty

Este guia orienta como liberar o acesso ao sistema para outros computadores na rede local.

## 1. Pré-requisitos
- O computador onde o sistema está rodando (Servidor) deve ter o Node.js instalado.
- O computador deve estar conectado à rede local (Wi-Fi ou Cabo).

## 2. Liberar Porta no Firewall
Para que outros computadores acessem o sistema, você precisa liberar a porta **3001** no Firewall do Windows.

### Passo a passo:
1. Pressione a tecla `Windows` e digite **PowerShell**.
2. Clique com o botão direito em "Windows PowerShell" e selecione **Executar como Administrador**.
3. Copie e cole o seguinte comando e pressione `Enter`:

```powershell
New-NetFirewallRule -DisplayName "MetalFisa Anty Server" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow
```

## 3. Descobrir o IP do Servidor
Para acessar o sistema de outro computador, você precisa saber o Endereço IP do servidor.

1. No PowerShell, digite: `ipconfig`
2. Procure por **Endereço IPv4** (Geralmente começa com `192.168...` ou `10...`).
   - **Seu IP detectado:** `192.168.1.169`

## 4. Como Acessar
Nos outros computadores ou celulares conectados à mesma rede:

1. Abra o navegador (Chrome, Edge, Firefox).
2. Digite o endereço IP seguido da porta **3001**.
   - Link: `http://192.168.1.169:3001`

## 5. Testando
- Se o sistema carregar, tudo está correto!
- Se não carregar:
  - Verifique se o servidor está rodando (`node server/index.js`).
  - Verifique se digitou o IP correto.
  - Verifique se o Firewall não está bloqueando o Node.js.

---
**Observação Técnica:**
O sistema foi configurado para usar caminhos relativos na API, então o frontend (React) funcionará automaticamente ao acessar pela porta 3001, sem necessidade de configurar IPs no código.
