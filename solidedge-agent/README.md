# 🔧 SolidEdge Agent - MetalFisa

Agent Python minimalista para integração do SolidEdge com o sistema web MetalFisa.

## 📋 Pré-requisitos

1. **Python 3.8+** instalado ([Download](https://www.python.org/downloads/))
   - ⚠️ Marcar "Add Python to PATH" durante instalação
2. **SolidEdge** instalado e funcionando
3. **Windows** (necessário para COM Interop)

## 🚀 Instalação

### Opção 1: Instalação Rápida (Recomendada)

1. Execute: `INSTALAR_AGENT.bat`
2. Aguarde instalação das dependências
3. Pronto!

### Opção 2: Instalação Manual

```bash
pip install -r requirements.txt
```

## ▶️ Como Usar

1. **Abra o SolidEdge** primeiro
2. Execute: `INICIAR_AGENT.bat`
3. Mantenha a janela aberta
4. Acesse o sistema web normalmente

## ✅ Testar Conexão

Abra no navegador do computador onde o Agent está rodando:
```
http://localhost:8080/api/solidedge/status
```

Se aparecer `"isRunning": true`, está funcionando!

## 🔌 Endpoints Disponíveis

- `GET /api/solidedge/status` - Verifica se SolidEdge está rodando
- `GET /api/solidedge/active-document` - Obtém dados do desenho ativo
- `POST /api/solidedge/export-dxf` - Exporta para DXF
- `POST /api/solidedge/export-pdf` - Exporta para PDF

## 🐛 Problemas Comuns

### "Python não encontrado"
- Instale Python e marque "Add to PATH"
- Reinicie o computador após instalação

### "SolidEdge not running"
- Certifique-se de que o SolidEdge está aberto
- Tente abrir um desenho antes de iniciar o Agent

### "Porta 8080 já em uso"
- Verifique se não há outro Agent rodando
- Feche programas que possam usar a porta 8080

## 📦 Distribuição

Para distribuir para outros computadores:

1. Copie toda a pasta `solidedge-agent`
2. No outro PC, execute `INSTALAR_AGENT.bat`
3. Pronto!

## 🔐 Segurança

O Agent roda **apenas localmente** na máquina do engenheiro. O sistema web se conecta ao IP da máquina automaticamente.

---

**MetalFisa** © 2026
