# 🚀 Sistema MetalFisa PCP - Guia de Acesso

## 📍 Como Acessar

Abra seu navegador e acesse:
```
http://192.168.1.169:3001
```

**Navegadores suportados:**
- Google Chrome (recomendado)
- Microsoft Edge
- Firefox

## 📋 Requisitos

- Estar conectado à rede local (LAN)
- Ter credenciais de acesso ao sistema

## 🔧 Módulo SINCO (Integração com SolidEdge)

### Para Usuários de Engenharia

O módulo SINCO permite integração direta com SolidEdge. Para usar este módulo:

1. **Pré-requisito:** Ter SolidEdge instalado e aberto em sua máquina
2. **Ação:** O agente SolidEdge deve estar rodando **localmente em sua máquina**
3. **Localização do Agent:** `\\192.168.1.253\Engenharia\MetalFisa\solidedge-agent`

### Como Iniciar o Agente SolidEdge (Se Necessário)

1. Navegue até: `\\192.168.1.253\Engenharia\MetalFisa\solidedge-agent`
2. Execute o arquivo: `INICIAR_AGENT.bat`
3. Uma janela deve abrir confirmando que o agent está rodando
4. Mantenha esta janela aberta enquanto usar o módulo SINCO

**Importante:** O agent só é necessário se você for usar o módulo SINCO. Para outras funcionalidades do sistema, não é necessário.

## ❓ Suporte

Em caso de problemas:
- Verifique sua conexão de rede
- Confirme se o servidor está ativo (verifique com o administrador)
- Para problemas de acesso ao SINCO, verifique se o SolidEdge Agent está rodando

---

**Sistema disponibilizado em:** 2026-02-11
**Status:** ✅ Operacional
