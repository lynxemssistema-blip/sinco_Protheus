# 🔧 Guia de Instalação - SolidEdge Agent

> **Para usuários de Engenharia/Projetos que trabalham com SolidEdge**

## ❓ O Que é o SolidEdge Agent?

É um programa pequeno que conecta o SolidEdge ao sistema web MetalFisa, permitindo:
- Importar dados do desenho ativo automaticamente
- Exportar DXF/PDF direto do sistema web
- Sincronizar informações entre SolidEdge e o banco de dados

## 📋 Pré-requisitos

Antes de instalar, certifique-se de ter:

- ✅ **SolidEdge** instalado e funcionando
- ✅ **Python 3.8 ou superior** instalado ([Download aqui](https://www.python.org/downloads/))
  - ⚠️ **IMPORTANTE:** Ao instalar Python, marque a opção **"Add Python to PATH"**

## 🚀 Instalação (Passo a Passo)

### 1️⃣ Copiar Arquivos

Escolha uma das opções:

**Opção A - Da Rede:**
```
Acesse: \\192.168.1.253\Engenharia\MetalFisa\solidedge-agent
Copie toda a pasta para: C:\MetalFisa\solidedge-agent
```

**Opção B - ZIP fornecido:**
- Extraia o arquivo `solidedge-agent.zip`
- Coloque em: `C:\MetalFisa\solidedge-agent`

---

### 2️⃣ Instalar Dependências

1. Abra a pasta: `C:\MetalFisa\solidedge-agent`
2. **Duplo clique** em: `INSTALAR_AGENT.bat`
3. Aguarde a instalação (pode levar 1-2 minutos)
4. Se aparecer **"INSTALACAO CONCLUIDA"** ✅ prossiga

---

### 3️⃣ Configurar Firewall (IMPORTANTE!)

Para que o servidor se conecte ao seu Agent:

1. **Duplo clique** em: `CONFIGURAR_FIREWALL_AGENT.bat`
2. Clique **"Sim"** quando pedir permissão de administrador
3. Aguarde aparecer **"Regra criada com sucesso"**

---

### 4️⃣ Criar Atalho (Opcional, mas Recomendado)

1. Clique direito em: `INICIAR_AGENT.bat`
2. **Enviar para → Área de trabalho (criar atalho)**
3. Renomeie o atalho para: `SolidEdge Agent`

---

## ▶️ Como Usar Diariamente

### Sequência Correta:

1. **Abra o SolidEdge** primeiro
2. **Execute:** `INICIAR_AGENT.bat` (ou o atalho criado)
3. Uma janela preta aparecerá. **NÃO FECHE** ela!
4. Acesse o sistema web normalmente: `http://192.168.1.169:3001`

### ⚠️ Importante:
- Mantenha a janela do Agent **sempre aberta** enquanto estiver usando SolidEdge
- Se fechar, basta executar novamente `INICIAR_AGENT.bat`
- Você verá mensagens na janela sempre que o sistema web se conectar

---

## ✅ Testar se Está Funcionando

### Teste 1: Agent Local
Abra o navegador **no seu computador** e acesse:
```
http://localhost:8080/api/solidedge/status
```

**Resultado esperado:**
```json
{
  "isRunning": true,
  "version": "...",
  "status": "online"
}
```

---

### Teste 2: Integração Completa

1. Abra um desenho no SolidEdge
2. Mantenha o Agent rodando (janela preta aberta)
3. Acesse o sistema web: `http://192.168.1.169:3001`
4. Vá para: **SINCO → Controle de Engenharia**
5. Clique em: **"Obter Documento Ativo"**
6. **Resultado esperado:** Dados do desenho aparecem automaticamente

---

## 🐛 Solução de Problemas

| Problema | Solução |
|----------|---------|
| **"Python não encontrado"** | Instale Python e marque "Add to PATH". Reinicie o PC. |
| **"SolidEdge not running"** | Abra o SolidEdge antes de iniciar o Agent |
| **"Porta 8080 já em uso"** | Feche outros programas ou reinicie o PC |
| **Sistema web não conecta** | Execute `CONFIGURAR_FIREWALL_AGENT.bat` como Admin |
| **Erro ao instalar dependências** | Execute Prompt de Comando como Admin e rode: `pip install -r requirements.txt` |

---

## 📞 Suporte

Se continuar com problemas:

1. **Tire print** da mensagem de erro
2. **Verifique** se seguiu todos os passos
3. **Contate TI** com os seguintes dados:
   - Mensagem de erro (print)
   - Versão do Python (`python --version` no Prompt)
   - Versão do SolidEdge

---

## 🔄 Atualização Futura

Quando houver atualizações do Agent:

1. **Feche** o Agent (feche a janela preta)
2. **Substitua** os arquivos antigos pelos novos
3. **Execute** `INSTALAR_AGENT.bat` novamente
4. **Reinicie** o Agent

---

**Sistema:** MetalFisa PCP  
**Versão:** 2026.02  
**Suporte:** TI MetalFisa
