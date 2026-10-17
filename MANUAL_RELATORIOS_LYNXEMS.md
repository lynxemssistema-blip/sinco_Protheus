# MANUAL DO MOTOR CENTRAL DE RELATÓRIOS LYNXEMS (PDF & EXCEL)
<!-- // FEAT (IA): Motor Relatorios Lynxems -->

## 1. Visão Geral e Arquitetura

O **Motor Central de Relatórios Lynxems** (`ReportGeneratorService`) é o padrão corporativo oficial do sistema **SINCO PROTHEUS** para geração e exportação de relatórios em formatos **Excel (.xlsx)** e **PDF (.pdf)**.

### Pilares da Arquitetura:
1. **Multi-Tenant Dinâmico (Empresa Ativa)**:
   - Os relatórios **NUNCA** utilizam dados fixos (hardcoded).
   - O cabeçalho captura em tempo de execução os dados da empresa ativa vinculada à sessão do usuário (`razao_social`, `nome_fantasia`, `cnpj`, endereço completo e logotipo em base64 via `companyBranding.js` / `/api/company`).
2. **Identidade Visual e Branding Lynxems**:
   - **Paleta Corporativa**: Navy/Slate Escuro (`#0F172A`), Azul Técnico Primário (`#0284C7`), Linhas Zebradas Suaves (`#F8FAFC`), Linhas de Borda (`#E2E8F0`).
   - **Rodapé Padronizado Obrigatório**: `"Desenvolvido por Lynxems"`.
   - **Paginação Completa**: `"Página X de Y"` (cálculo de 2 passos no PDF).
3. **Excel Corporativo Rico (`exceljs`)**:
   - Cabeçalho institucional mesclado nas primeiras 4 linhas com dados da empresa ativa e título do relatório.
   - Linha de cabeçalho das colunas com fundo `#0F172A`, fonte branca negrito e centralização vertical.
   - Auto-filtro nativo habilitado em todas as colunas.
   - Auto-ajuste dinâmico da largura das colunas com margem de segurança.
   - Formatação automática de tipos: Moeda (R$ #,##0.00), Decimais, Datas (DD/MM/AAAA) e alinhamentos.
4. **PDF Vetorial e Tipográfico (`jspdf` + `jspdf-autotable`)**:
   - Cabeçalho dinâmico com logo institucional (se disponível), razão social, CNPJ e data/hora de emissão.
   - Tabelas com linhas zebradas, quebra de página automática e cabeçalhos repetidos por página.
   - Rodapé com numeração total e carimbo de autenticidade Lynxems.

---

## 2. Estrutura de Arquivos

```
client/src/
├── services/
│   └── ReportGeneratorService.js   # Serviço singleton central da fábrica de relatórios
└── components/
    └── ReportExportButtons.jsx     # Componente pronto com botões elegantes (Excel + PDF)
```

---

## 3. Guia Rápido: Como Usar em Novas Telas

### Passo 1: Importar o Serviço e o Componente

Na página de listagem ou relatório que você estiver construindo:

```jsx
// FEAT (IA): Motor Relatorios Lynxems
import { ReportGeneratorService } from '../../services/ReportGeneratorService';
import ReportExportButtons from '../../components/ReportExportButtons';
```

---

### Passo 2: Definir as Colunas e os Manipuladores de Exportação

Defina as colunas informando `header`, `key`, `width` e opcionalmente `align` ou `type` (`currency`, `decimal`, `date`):

```jsx
// FEAT (IA): Motor Relatorios Lynxems
const handleExportExcel = async () => {
    const columns = [
        { header: 'Código', key: 'codigo', width: 12, align: 'center' },
        { header: 'Descrição', key: 'descricao', width: 40, align: 'left' },
        { header: 'Categoria', key: 'categoria', width: 20, align: 'left' },
        { header: 'Preço Venda', key: 'preco_venda', width: 16, align: 'right', type: 'currency' },
        { header: 'Saldo Atual', key: 'saldo', width: 14, align: 'right', type: 'decimal' },
        { header: 'Status', key: 'status', width: 12, align: 'center' }
    ];

    // Os dados podem ser a lista filtrada visível na tela
    const data = listaFiltrada.map(item => ({
        codigo: item.codigo,
        descricao: item.descricao,
        categoria: item.categoria || 'Geral',
        preco_venda: Number(item.preco_venda || 0),
        saldo: Number(item.saldo || 0),
        status: item.ativo ? 'ATIVO' : 'INATIVO'
    }));

    await ReportGeneratorService.exportExcel({
        title: 'Relatório Geral de Produtos',
        subtitle: `Posição Atual - Total de ${data.length} item(ns)`,
        columns,
        data,
        fileName: `relatorio_produtos_${new Date().toISOString().slice(0, 10)}.xlsx`
    });
};

const handleExportPdf = async () => {
    const columns = [
        { header: 'Código', key: 'codigo', width: 15, align: 'center' },
        { header: 'Descrição', key: 'descricao', width: 45, align: 'left' },
        { header: 'Categoria', key: 'categoria', width: 25, align: 'left' },
        { header: 'Preço Venda', key: 'preco_venda', width: 20, align: 'right' },
        { header: 'Saldo', key: 'saldo', width: 15, align: 'right' }
    ];

    const data = listaFiltrada.map(item => ({
        codigo: item.codigo,
        descricao: item.descricao,
        categoria: item.categoria || 'Geral',
        preco_venda: Number(item.preco_venda || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        saldo: Number(item.saldo || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
    }));

    await ReportGeneratorService.exportPdf({
        title: 'Relatório Geral de Produtos',
        subtitle: `Posição Atual - Total de ${data.length} item(ns)`,
        columns,
        data,
        orientation: 'portrait', // ou 'landscape'
        fileName: `relatorio_produtos_${new Date().toISOString().slice(0, 10)}.pdf`
    });
};
```

---

### Passo 3: Adicionar os Botões no Cabeçalho da Tela

Insira o componente `<ReportExportButtons />` na barra de ações da tela:

```jsx
<div className="flex items-center gap-3">
    {/* FEAT (IA): Motor Relatorios Lynxems */}
    <ReportExportButtons
        onExportExcel={handleExportExcel}
        onExportPdf={handleExportPdf}
        disabled={loading || listaFiltrada.length === 0}
    />

    <button
        onClick={handleNovoRegistro}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold"
    >
        Novo Registro
    </button>
</div>
```

---

## 4. Referência de Propriedades das Colunas

| Propriedade | Tipo | Descrição | Exemplo |
| :--- | :--- | :--- | :--- |
| `header` | `string` | Nome exibido no cabeçalho da tabela | `'Razão Social'` |
| `key` | `string` | Chave correspondente no objeto de dados | `'razao_social'` |
| `width` | `number` | Largura sugerida (caracteres no Excel, mm aproximados no PDF) | `30` |
| `align` | `string` | Alinhamento horizontal: `'left'`, `'center'`, `'right'` | `'right'` |
| `type` | `string` | (Opcional Excel) `'currency'`, `'decimal'`, `'date'` | `'currency'` |

---

## 5. Opções de Configuração do `ReportGeneratorService`

### `ReportGeneratorService.exportExcel(options)`
- `title` *(string)*: Título principal do relatório (exibido na linha mesclada do cabeçalho).
- `subtitle` *(string, opcional)*: Subtítulo descritivo ou filtros aplicados.
- `sheetName` *(string, opcional)*: Nome da aba da planilha (padrão: `'Relatório'`).
- `columns` *(Array)*: Definição de colunas.
- `data` *(Array)*: Matriz de objetos com os valores a serem impressos.
- `fileName` *(string, opcional)*: Nome do arquivo baixado (padrão: `relatorio.xlsx`).
- `company` *(Object, opcional)*: Override manual dos dados da empresa ativa (caso omitido, resolve automaticamente da sessão).

### `ReportGeneratorService.exportPdf(options)`
- `title` *(string)*: Título do relatório.
- `subtitle` *(string, opcional)*: Subtítulo ou filtros aplicados.
- `columns` *(Array)*: Definição de colunas.
- `data` *(Array)*: Matriz de objetos com os valores.
- `orientation` *(string, opcional)*: `'portrait'` (vertical) ou `'landscape'` (horizontal). Padrão: `'portrait'`.
- `fileName` *(string, opcional)*: Nome do arquivo baixado (padrão: `relatorio.pdf`).
- `company` *(Object, opcional)*: Override manual dos dados da empresa ativa (caso omitido, resolve automaticamente da sessão).

---

## 6. Provas de Conceito (POC) Implementadas no Sistema

O motor já está 100% ativo e operando em produção nas seguintes telas de referência:
1. **Cadastro de Produtos ERP**: [client/src/pages/erp/ErpProdutosPage.jsx](file:///c:/Users/lynx/Documents/SINCO%20PROTHEUS/client/src/pages/erp/ErpProdutosPage.jsx)
2. **Cadastro de Clientes ERP**: [client/src/pages/erp/ErpClientesPage.jsx](file:///c:/Users/lynx/Documents/SINCO%20PROTHEUS/client/src/pages/erp/ErpClientesPage.jsx)

Ambas as telas realizam exportação completa tanto em Excel quanto em PDF com isolamento dinâmico do tenant e estética visual Lynxems.
