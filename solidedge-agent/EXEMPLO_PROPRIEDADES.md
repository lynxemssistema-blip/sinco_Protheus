# 🔍 Exemplo de Propriedades Lidas do SolidEdge

**Arquivo:** `MT5-19895.psm`  
**Data do Teste:** 2026-02-10 15:45

---

## 📄 Informações Básicas

```json
{
  "fileName": "MT5-19895.psm",
  "fullPath": "C:\\Users\\adm\\Downloads\\CONJUNTO PARA TESTE\\CONJUNTO PARA TESTE\\ENGETRON TESTE\\ENGETRON TESTE\\MT5-19895.psm",
  "type": "4",
  "readOnly": false
}
```

---

## 📝 Summary Properties (Propriedades de Resumo)

```json
{
  "title": "GAVETA DE BAT. RACK MODULAR",
  "subject": "",
  "author": "lucas",
  "keywords": "",
  "comments": "NA"
}
```

**Campos Disponíveis:**
- **Title**: Título do documento
- **Author**: Autor do documento
- **Subject**: Assunto
- **Keywords**: Palavras-chave
- **Comments**: Comentários

---

## 🔧 Custom Properties (Propriedades Personalizadas)

```json
{
  "SummaryInformation": null,
  "ExtendedSummaryInformation": null,
  "DocumentSummaryInformation": null,
  "Custom": null,
  "ProjectInformation": null,
  "VersionHistory": null,
  "MechanicalModeling": null
}
```

**Nota:** Os conjuntos de propriedades existem mas estãonulos. Isso significa que o documento não tem propriedades customizadas definidas, ou precisamos acessá-las de forma diferente.

---

## ⚙️ Physical Properties (Propriedades Físicas)

**Status:** Não disponível para este arquivo

**Possíveis Razões:**
1. Arquivo é do tipo Part (.psm) sem modelo 3D
2. Propriedades de massa não foram calculadas
3. Requer Assembly (.asm) para algumas propriedades

---

## 🎯 Propriedades Acessíveis pelo Agent

### ✅ O Que Está Funcionando:

1. **Informações Básicas**
   - Nome do arquivo
   - Caminho completo
   - Tipo de arquivo
   - Status de somente leitura

2. **Summary Properties**
   - Título
   - Autor
   - Assunto
   - Palavras-chave
   - Comentários

3. **Estrutura de Propriedades**
   - Detecta conjuntos de propriedades disponíveis
   - Pronto para expandir leitura de custom properties

### 📋 Próximos Passos Possíveis:

Para acessar custom properties específicas, precisamos:
1. Identificar quais propriedades customizadas existem no arquivo
2. Acessar via `Properties("Custom").Item("NomeDaPropriedade")`
3. Implementar leitura de cada propriedade individualmente

---

## 💡 Como Usar

### Endpoint:
```
GET http://localhost:8080/api/solidedge/active-document
```

### Resposta Completa:
```json
{
  "basic": { ... },
  "properties": { ... },
  "summary": { ... },
  "physical": { ... },
  "material": null
}
```

### Integração com Backend:
```
GET http://192.168.1.169:3001/api/sinco/active-document
```

**O servidor detecta automaticamente o IP do cliente e conecta ao Agent local!**

---

**Status:** ✅ Leitura de propriedades funcionando
**Agent PID:** 22776  
**Porta:** 8080
