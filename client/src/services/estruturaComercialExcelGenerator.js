import ExcelJS from 'exceljs';
import { downloadBlob } from '../utils/downloadHelper';
import { 
    getCompanyLegalName, 
    getCompanyShortName, 
    getCompanyCnpjCityLine, 
    getCompanyAddressLine 
} from './companyBranding';

const CUSTO_TIPOS = ['MP', 'MC', 'EM'];

/**
 * Converte qualquer valor de data para o formato padrão brasileiro (DD/MM/AAAA)
 */
const formatarDataBR = (val) => {
    if (!val) return '';
    const s = String(val).trim();
    if (!s) return '';
    // Formato Protheus YYYYMMDD (8 dígitos numéricos)
    if (/^\d{8}$/.test(s)) {
        return `${s.substring(6, 8)}/${s.substring(4, 6)}/${s.substring(0, 4)}`;
    }
    // Formato ISO YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        const parts = s.substring(0, 10).split('-');
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    // Se for objeto Date ou timestamp válido
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
        const dia = String(d.getDate()).padStart(2, '0');
        const mes = String(d.getMonth() + 1).padStart(2, '0');
        const ano = d.getFullYear();
        return `${dia}/${mes}/${ano}`;
    }
    return s;
};

/**
 * Paleta corporativa oficial MetalFisa
 */
const COLORS = {
    NAVY: 'FF1E3A5F',
    BLUE: 'FF2563EB',
    DARK_HEADER: 'FF1E293B',
    SLATE_LIGHT: 'FFF1F5F9',
    SLATE_BORDER: 'FFE2E8F0',
    ZEBRA: 'FFF8FAFC',
    WHITE: 'FFFFFFFF',
    GREEN_LIGHT: 'FFDCFCE7',
    GREEN_TEXT: 'FF166534',
    AMBER_LIGHT: 'FFFEF3C7',
    AMBER_TEXT: 'FF92400E',
    TOTAL_BG: 'FFE2E8F0',
    CARD_BG: 'FFF8FAFC'
};

const BORDERS = {
    thin: {
        top: { style: 'thin', color: { argb: COLORS.SLATE_BORDER } },
        left: { style: 'thin', color: { argb: COLORS.SLATE_BORDER } },
        bottom: { style: 'thin', color: { argb: COLORS.SLATE_BORDER } },
        right: { style: 'thin', color: { argb: COLORS.SLATE_BORDER } }
    },
    topDoubleBottom: {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: COLORS.SLATE_BORDER } },
        bottom: { style: 'double', color: { argb: 'FF1E293B' } },
        right: { style: 'thin', color: { argb: COLORS.SLATE_BORDER } }
    },
    card: {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    }
};

/**
 * Gera e dispara o download do Relatório Comercial de Custos do Produto em Excel (Padrão MetalFisa).
 * 
 * @param {Object} params
 * @param {string} params.codigo - Código do produto pai
 * @param {string} params.descricao - Descrição do produto pai
 * @param {Array} params.structure - Lista completa explodida da estrutura
 * @param {Object} params.routes - Mapa de roteiros { [itemCodigo]: [operacoes] }
 * @param {Object} params.productStatuses - Mapa de status de engenharia { [itemCodigo]: 'NORMAL' | 'NOVO' | ... }
 * @param {string} params.userName - Nome do usuário emitente
 */
export const exportEstruturaComercialExcel = async ({
    codigo,
    descricao = '',
    structure = [],
    routes = {},
    productStatuses = {},
    userName = 'Usuário do Sistema'
}) => {
    if (!structure || structure.length === 0) {
        throw new Error('Nenhum dado de estrutura disponível para exportação.');
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = `${getCompanyLegalName()} - SINCO Suite`;
    wb.created = new Date();

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    // Data sempre no formato brasileiro DD/MM/AAAA HH:mm
    const dataHoraStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const fileTimestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;

    // Item Pai (nível 0 ou primeiro item)
    const itemPai = structure.find(i => i.nivel === 0) || structure[0] || {};
    const ncmPai = itemPai.ncm || '';
    const descPai = descricao || itemPai.descricao || '';
    const statusPai = productStatuses[codigo] || itemPai.status || 'NORMAL';
    const precoVendaCadastrado = parseFloat(itemPai.preco_venda || 0);
    const precoVendaUltimoPV = parseFloat(itemPai.ultimo_preco_pv || 0);
    const custoStandardPai = parseFloat(itemPai.custo_standard || 0);
    const ultimoPedidoNum = itemPai.ultimo_pedido_pv ? String(itemPai.ultimo_pedido_pv).trim() : '';
    const ultimoPedidoDataBR = formatarDataBR(itemPai.ultimo_pv_data);

    // Pedido simbólico / sem custo registrado no Protheus (ex.: remessas a R$ 0,01)
    const pedidoSimbNum = itemPai.pedido_simbolico_num ? String(itemPai.pedido_simbolico_num).trim() : '';
    const pedidoSimbDataBR = formatarDataBR(itemPai.pedido_simbolico_data);

    // Validação estrita de preço de venda comercial (ignora valores simbólicos <= 0.01)
    const temPVComercial = precoVendaUltimoPV > 0.01;
    const temTabelaComercial = precoVendaCadastrado > 0.01;
    const precoVendaEfetivo = temPVComercial ? precoVendaUltimoPV : (temTabelaComercial ? precoVendaCadastrado : 0);

    let origemPrecoVenda = '';
    if (temPVComercial) {
        origemPrecoVenda = `Último Pedido Comercial (Nº ${ultimoPedidoNum}${ultimoPedidoDataBR ? ' - ' + ultimoPedidoDataBR : ''})`;
    } else if (temTabelaComercial) {
        origemPrecoVenda = 'Tabela de Venda Protheus (B1_PRV1)';
    } else if (pedidoSimbNum) {
        origemPrecoVenda = `Sem venda comercial avulsa (Pedido Nº ${pedidoSimbNum} foi remessa sem custo a R$ 0,01)`;
    } else {
        origemPrecoVenda = 'Sem Preço de Venda Comercial no ERP (Item Fabricado / Subconjunto)';
    }

    // Função estrita de validação de matéria-prima e componentes diretos.
    // Garante que PI (Produto Intermediário / Subconjunto) e PA (Produto Acabado / Pai)
    // sejam TOTALMENTE DESCONSIDERADOS do custo de materiais diretos para não gerar
    // duplicidade, pois seus custos de mão de obra já entram na Aba de Roteiro e seus
    // componentes filhos são explodidos individualmente.
    const isMaterialCusto = (item) => {
        if (!item || item.nivel === 0) return false;
        const tipo = (item.tipo_produto || item.tipo || '').trim().toUpperCase();
        if (tipo === 'PA' || tipo === 'PI') return false;
        if (item.eh_item_custo === true) return true;
        if (item.eh_item_custo === false) return false;
        if (CUSTO_TIPOS.includes(tipo)) return true;
        const p = (item.codigo || '').trim().substring(0, 3).toUpperCase();
        if (['MTC', 'MTA', 'MTI', 'MMP', 'MTT', 'MTU', 'MTB', 'MPT', 'MST'].includes(p)) return true;
        return false;
    };

    // Definição Oficial dos Grupos de Materiais MetalFisa para o Comercial
    const GROUP_DEFS = [
        {
            id: 'MTC',
            sigla: 'MTC',
            nome: 'Chapas',
            descricao: 'Chapas de Aço Carbono, Galvanizadas, Inox e Alumínio',
            regra: 'Prefixo MTC- / Grupo MTC',
            bannerBg: 'FFE2E8F0',
            bannerText: 'FF1E293B',
            accent: 'FF2563EB',
            test: (p, g) => p === 'MTC' || g === 'MTC'
        },
        {
            id: 'ACESSORIOS',
            sigla: 'MTA / MTI / MMP',
            nome: 'Acessórios & Fixação',
            descricao: 'Parafusos, Porcas, Arruelas, Rebites e Componentes de Montagem',
            regra: 'Prefixos MTA-, MTI-, MMP-',
            bannerBg: 'FFFEF3C7',
            bannerText: 'FF92400E',
            accent: 'FFD97706',
            test: (p, g) => ['MTA', 'MTI', 'MMP'].includes(p) || ['MTA', 'MTI', 'MMP'].includes(g)
        },
        {
            id: 'MTT',
            sigla: 'MTT',
            nome: 'Tintas & Acabamento',
            descricao: 'Tintas Líquidas, Pós Eletrostáticos, Solventes e Catalisadores',
            regra: 'Prefixo MTT- / Grupo MTT',
            bannerBg: 'FFFEE2E2',
            bannerText: 'FF991B1B',
            accent: 'FFDC2626',
            test: (p, g) => p === 'MTT' || g === 'MTT'
        },
        {
            id: 'TUBOS_BARRAS',
            sigla: 'MTU / MTB',
            nome: 'Tubos e Barras',
            descricao: 'Tubos Redondos, Quadrados, Retangulares, Barras e Perfis',
            regra: 'Prefixos MTU-, MTB-',
            bannerBg: 'FFE0E7FF',
            bannerText: 'FF3730A3',
            accent: 'FF4F46E5',
            test: (p, g) => ['MTU', 'MTB'].includes(p) || ['MTU', 'MTB'].includes(g)
        },
        {
            id: 'MPT',
            sigla: 'MPT',
            nome: 'Usinados / Externos',
            descricao: 'Peças Usinadas, Peças Prontas Externas e Componentes Mecânicos',
            regra: 'Prefixo MPT- / Grupo MPT',
            bannerBg: 'FFE0F2FE',
            bannerText: 'FF075985',
            accent: 'FF0284C7',
            test: (p, g) => p === 'MPT' || g === 'MPT'
        },
        {
            id: 'MST',
            sigla: 'MST',
            nome: 'Serviços de Terceiros',
            descricao: 'Tratamentos Térmicos, Galvanização, Pintura Externa e Beneficiamentos',
            regra: 'Prefixo MST- / Grupo MST',
            bannerBg: 'FFF1F5F9',
            bannerText: 'FF334155',
            accent: 'FF475569',
            test: (p, g) => p === 'MST' || g === 'MST'
        },
        {
            id: 'OUTROS',
            sigla: 'OUTROS',
            nome: 'Outros Materiais / Diversos',
            descricao: 'Demais matérias-primas e componentes diretos de compras',
            regra: 'Demais itens diretos (MP/MC/EM)',
            bannerBg: 'FFF8FAFC',
            bannerText: 'FF64748B',
            accent: 'FF64748B',
            test: () => true
        }
    ];

    const classifyItem = (item) => {
        const cod = (item.codigo || '').trim().toUpperCase();
        const grp = (item.grupo || '').trim().toUpperCase();
        const p = cod.substring(0, 3);
        for (const g of GROUP_DEFS) {
            if (g.test(p, grp)) return g.id;
        }
        return 'OUTROS';
    };

    // 1. Cálculos de Custos Totais
    const custoMateriais = structure.reduce((acc, item) => {
        if (!isMaterialCusto(item)) return acc;
        const qtd = parseFloat(item.qtd_necessaria) || 0;
        const preco = parseFloat(item.preco_efetivo != null ? item.preco_efetivo : item.preco_padrao) || 0;
        return acc + (qtd * preco);
    }, 0);

    let custoRecursos = 0;
    structure.forEach(item => {
        const key = item.codigo?.trim();
        const route = routes[key];
        if (Array.isArray(route)) {
            const qtdItem = parseFloat(item.qtd_necessaria || 1);
            const itemCost = route.reduce((sum, op) => sum + (parseFloat(op.custo_total_op) || 0), 0);
            custoRecursos += (itemCost * qtdItem);
        }
    });

    const custoTotalGeral = custoMateriais + custoRecursos;
    const margemBrutaValor = precoVendaEfetivo > 0 ? (precoVendaEfetivo - custoTotalGeral) : 0;
    const margemBrutaPercent = precoVendaEfetivo > 0 ? ((margemBrutaValor / precoVendaEfetivo) * 100) : 0;

    // =========================================================================
    // ABA 1: RESUMO COMERCIAL & MATERIAIS (BOM DE CUSTOS)
    // =========================================================================
    const ws1 = wb.addWorksheet('Resumo Comercial & Materiais', {
        views: [{ state: 'frozen', xSplit: 0, ySplit: 12, activeCell: 'A13', showGridLines: true }]
    });

    // --- TÍTULO PRINCIPAL ---
    ws1.mergeCells('A1:M1');
    const titleRow = ws1.getCell('A1');
    titleRow.value = `${getCompanyLegalName()} — RELATÓRIO COMERCIAL DE FORMAÇÃO DE CUSTOS & PRECIFICAÇÃO`;
    titleRow.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: COLORS.WHITE } };
    titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.NAVY } };
    titleRow.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws1.getRow(1).height = 32;

    // --- SUBTÍTULO ---
    ws1.mergeCells('A2:M2');
    const subTitleRow = ws1.getCell('A2');
    const subParts1 = [
        getCompanyCnpjCityLine(),
        getCompanyAddressLine(),
        'Visão Comercial: Estrutura Explodida, NCM, Preço de Venda e Margem Bruta'
    ].filter(Boolean);
    subTitleRow.value = subParts1.join('  |  ');
    subTitleRow.font = { name: 'Segoe UI', size: 9.5, italic: false, color: { argb: 'FF334155' } };
    subTitleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.SLATE_LIGHT } };
    subTitleRow.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws1.getRow(2).height = 20;

    // Linha 3 vazia (espaçador)
    ws1.getRow(3).height = 8;

    // --- BLOCO DE IDENTIFICAÇÃO DO PRODUTO (Linhas 4 a 6) ---
    // Linha 4: Produto Principal, NCM e Status Eng.
    ws1.mergeCells('A4:G4');
    ws1.getCell('A4').value = `PRODUTO PRINCIPAL: ${codigo} - ${descPai}`;
    ws1.getCell('A4').font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF0F172A' } };
    ws1.getCell('A4').alignment = { vertical: 'middle' };

    ws1.mergeCells('H4:J4');
    ws1.getCell('H4').value = `NCM: ${ncmPai || 'Não informado'}`;
    ws1.getCell('H4').font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1E3A5F' } };
    ws1.getCell('H4').alignment = { vertical: 'middle' };

    ws1.mergeCells('K4:M4');
    ws1.getCell('K4').value = `STATUS ENG: ${statusPai}`;
    ws1.getCell('K4').font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: statusPai === 'NOVO' ? COLORS.GREEN_TEXT : 'FF1E293B' } };
    ws1.getCell('K4').alignment = { vertical: 'middle', horizontal: 'center' };

    // Linha 5: Detalhes de Preço do ERP Protheus (B1_PRV1, SC6010, B1_CUSTD)
    ws1.mergeCells('A5:D5');
    ws1.getCell('A5').value = `Preço Tabela (B1_PRV1): ${precoVendaCadastrado > 0.01 ? precoVendaCadastrado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00'}`;
    ws1.getCell('A5').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF334155' } };
    ws1.getCell('A5').alignment = { vertical: 'middle' };

    ws1.mergeCells('E5:I5');
    let textoPV = 'Nenhum pedido de venda comercial';
    if (temPVComercial) {
        textoPV = `Último Pedido Comercial: Nº ${ultimoPedidoNum} | ${precoVendaUltimoPV.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (${ultimoPedidoDataBR ? 'Entrega: ' + ultimoPedidoDataBR : 'Sem data'})`;
    } else if (pedidoSimbNum) {
        textoPV = `Último Pedido: Nº ${pedidoSimbNum} (Remessa sem custo / Simbólico R$ 0,01)`;
    }
    ws1.getCell('E5').value = textoPV;
    ws1.getCell('E5').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: temPVComercial ? 'FF0284C7' : 'FF64748B' } };
    ws1.getCell('E5').alignment = { vertical: 'middle' };

    ws1.mergeCells('J5:M5');
    ws1.getCell('J5').value = `Custo Standard (B1_CUSTD): ${custoStandardPai > 0 ? custoStandardPai.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00'}`;
    ws1.getCell('J5').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF475569' } };
    ws1.getCell('J5').alignment = { vertical: 'middle' };

    // Linha 6: Auditoria, Usuário e Referência do Cálculo
    ws1.mergeCells('A6:F6');
    ws1.getCell('A6').value = `Data de Emissão: ${dataHoraStr}  |  Emitido por: ${userName}`;
    ws1.getCell('A6').font = { name: 'Segoe UI', size: 9, color: { argb: 'FF64748B' } };
    ws1.getCell('A6').alignment = { vertical: 'middle' };

    ws1.mergeCells('G6:M6');
    ws1.getCell('G6').value = `Base Preço no Relatório: ${origemPrecoVenda}  |  Itens na Estrutura: ${structure.length}`;
    ws1.getCell('G6').font = { name: 'Segoe UI', size: 9, color: { argb: 'FF64748B' } };
    ws1.getCell('G6').alignment = { vertical: 'middle' };

    ws1.getRow(4).height = 22;
    ws1.getRow(5).height = 20;
    ws1.getRow(6).height = 18;
    ws1.getRow(7).height = 8; // Linha 7 vazia espaçadora

    // --- CARDS DE RESUMO FINANCEIRO / KPIS COM VALOR DE VENDA (Linhas 8 a 10) ---
    // Card 1: Materiais (A-B)
    ws1.mergeCells('A8:B8');
    ws1.getCell('A8').value = 'CUSTO MATERIAIS DIRETOS';
    ws1.getCell('A8').font = { name: 'Segoe UI', size: 8, bold: true, color: { argb: 'FF15803D' } };
    ws1.getCell('A8').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.GREEN_LIGHT } };
    ws1.getCell('A8').alignment = { horizontal: 'center', vertical: 'middle' };

    ws1.mergeCells('A9:B10');
    const cellKpiMat = ws1.getCell('A9');
    cellKpiMat.value = custoMateriais;
    cellKpiMat.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FF14532D' } };
    cellKpiMat.numFmt = '"R$"\\ #,##0.00';
    cellKpiMat.alignment = { horizontal: 'center', vertical: 'middle' };
    cellKpiMat.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.WHITE } };

    // Card 2: Recursos / Mão de Obra (C-D)
    ws1.mergeCells('C8:D8');
    ws1.getCell('C8').value = 'MÃO DE OBRA & RECURSOS';
    ws1.getCell('C8').font = { name: 'Segoe UI', size: 8, bold: true, color: { argb: 'FF1D4ED8' } };
    ws1.getCell('C8').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
    ws1.getCell('C8').alignment = { horizontal: 'center', vertical: 'middle' };

    ws1.mergeCells('C9:D10');
    const cellKpiRec = ws1.getCell('C9');
    cellKpiRec.value = custoRecursos;
    cellKpiRec.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FF1E40AF' } };
    cellKpiRec.numFmt = '"R$"\\ #,##0.00';
    cellKpiRec.alignment = { horizontal: 'center', vertical: 'middle' };
    cellKpiRec.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.WHITE } };

    // Card 3: Custo Total de Fabricação (E-G)
    ws1.mergeCells('E8:G8');
    ws1.getCell('E8').value = 'CUSTO TOTAL FABRICAÇÃO';
    ws1.getCell('E8').font = { name: 'Segoe UI', size: 8, bold: true, color: { argb: COLORS.WHITE } };
    ws1.getCell('E8').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.NAVY } };
    ws1.getCell('E8').alignment = { horizontal: 'center', vertical: 'middle' };

    ws1.mergeCells('E9:G10');
    const cellKpiTot = ws1.getCell('E9');
    cellKpiTot.value = custoTotalGeral;
    cellKpiTot.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: COLORS.NAVY } };
    cellKpiTot.numFmt = '"R$"\\ #,##0.00';
    cellKpiTot.alignment = { horizontal: 'center', vertical: 'middle' };
    cellKpiTot.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.SLATE_LIGHT } };

    // Card 4: Preço de Venda Unitário do Produto Pai (H-J)
    ws1.mergeCells('H8:J8');
    ws1.getCell('H8').value = 'PREÇO DE VENDA UNITÁRIO';
    ws1.getCell('H8').font = { name: 'Segoe UI', size: 8, bold: true, color: { argb: 'FF0369A1' } };
    ws1.getCell('H8').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
    ws1.getCell('H8').alignment = { horizontal: 'center', vertical: 'middle' };

    ws1.mergeCells('H9:J10');
    const cellKpiPrc = ws1.getCell('H9');
    if (precoVendaEfetivo > 0) {
        cellKpiPrc.value = precoVendaEfetivo;
        cellKpiPrc.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FF0284C7' } };
        cellKpiPrc.numFmt = '"R$"\\ #,##0.00';
    } else {
        cellKpiPrc.value = 'NÃO CADASTRADO';
        cellKpiPrc.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF64748B' } };
    }
    cellKpiPrc.alignment = { horizontal: 'center', vertical: 'middle' };
    cellKpiPrc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.WHITE } };

    // Card 5: Margem Bruta Comercial (K-M)
    ws1.mergeCells('K8:M8');
    const cellKpiMargemLabel = ws1.getCell('K8');
    ws1.mergeCells('K9:M10');
    const cellKpiMargem = ws1.getCell('K9');

    if (precoVendaEfetivo > 0) {
        const isMargemPositiva = margemBrutaValor >= 0;
        cellKpiMargemLabel.value = `MARGEM BRUTA ESTIMADA (${margemBrutaPercent.toFixed(1)}%)`;
        cellKpiMargemLabel.font = { name: 'Segoe UI', size: 8, bold: true, color: { argb: isMargemPositiva ? COLORS.GREEN_TEXT : 'FFB91C1C' } };
        cellKpiMargemLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isMargemPositiva ? COLORS.GREEN_LIGHT : 'FFFEE2E2' } };

        cellKpiMargem.value = margemBrutaValor;
        cellKpiMargem.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: isMargemPositiva ? COLORS.GREEN_TEXT : 'FFB91C1C' } };
        cellKpiMargem.numFmt = '"R$"\\ #,##0.00';
    } else {
        cellKpiMargemLabel.value = 'MARGEM BRUTA ESTIMADA';
        cellKpiMargemLabel.font = { name: 'Segoe UI', size: 8, bold: true, color: { argb: 'FF64748B' } };
        cellKpiMargemLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.SLATE_LIGHT } };

        cellKpiMargem.value = 'SEM PREÇO DE VENDA';
        cellKpiMargem.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF64748B' } };
    }
    cellKpiMargemLabel.alignment = { horizontal: 'center', vertical: 'middle' };
    cellKpiMargem.alignment = { horizontal: 'center', vertical: 'middle' };
    cellKpiMargem.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.WHITE } };

    // Bordas de todas as células dos 5 cards (colunas A a M)
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'].forEach(col => {
        [8, 9, 10].forEach(row => {
            ws1.getCell(`${col}${row}`).border = BORDERS.thin;
        });
    });

    ws1.getRow(8).height = 18;
    ws1.getRow(9).height = 18;
    ws1.getRow(10).height = 18;
    ws1.getRow(11).height = 10; // Espaçador linha 11

    // --- CABEÇALHO DA TABELA DE MATERIAIS (Linha 12) ---
    const headersMat = [
        { key: 'nivel', label: 'Nível', width: 8, align: 'center' },
        { key: 'codigo', label: 'Código do Item', width: 22, align: 'left' },
        { key: 'descricao', label: 'Descrição do Material', width: 38, align: 'left' },
        { key: 'ncm', label: 'NCM', width: 14, align: 'center' },
        { key: 'tipo', label: 'Tipo', width: 8, align: 'center' },
        { key: 'um', label: 'UM', width: 6, align: 'center' },
        { key: 'qtd', label: 'Qtd. Necessária', width: 15, align: 'right' },
        { key: 'custo_std', label: 'Custo Standard (R$)', width: 17, align: 'right' },
        { key: 'custo_unit', label: 'Custo / Preço Unit. (R$)', width: 19, align: 'right' },
        { key: 'custo_total', label: 'Custo Total (R$)', width: 18, align: 'right' },
        { key: 'eh_custo', label: 'Tipo de Custo', width: 17, align: 'center' },
        { key: 'referencia', label: 'Ref. Cliente / Desenho', width: 24, align: 'left' },
        { key: 'status_eng', label: 'Status Eng.', width: 14, align: 'center' }
    ];

    const headerRowMat = ws1.getRow(12);
    headerRowMat.height = 28;
    headersMat.forEach((h, idx) => {
        const cell = headerRowMat.getCell(idx + 1);
        cell.value = h.label;
        cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLORS.WHITE } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.DARK_HEADER } };
        cell.alignment = { vertical: 'middle', horizontal: h.align, wrapText: true };
        cell.border = BORDERS.thin;
    });

    // --- LINHAS DE MATERIAIS (A partir da Linha 13) ---
    let startRowMat = 13;
    structure.forEach((item, index) => {
        const row = ws1.getRow(startRowMat + index);
        row.height = 20;

        const isNivel0 = item.nivel === 0;
        const isCusto = isMaterialCusto(item);
        const qtd = parseFloat(item.qtd_necessaria) || 0;
        const precoUnit = parseFloat(item.preco_efetivo != null ? item.preco_efetivo : item.preco_padrao) || 0;
        const custoStdItem = parseFloat(item.custo_standard) || 0;
        const custoTotal = qtd * precoUnit;
        const statusItem = productStatuses[item.codigo] || item.status || 'NORMAL';

        // Desenho / referências
        let refs = '';
        if (item.referencias && Array.isArray(item.referencias) && item.referencias.length > 0) {
            refs = item.referencias.map(r => r.desenho).filter(Boolean).join(', ');
        } else if (item.rev_metalfisa || item.rev_cliente || item.revisao) {
            refs = [(item.rev_metalfisa || item.revisao) && `Rev: ${item.rev_metalfisa || item.revisao}`, item.rev_cliente && `Rev. Cliente: ${item.rev_cliente}`].filter(Boolean).join(' | ');
        }

        const isZebra = index % 2 === 1;
        let rowFillColor = isZebra ? COLORS.ZEBRA : COLORS.WHITE;
        if (isNivel0) {
            rowFillColor = 'FFE0F2FE'; // destaque azul claro para pai
        } else if (isCusto) {
            rowFillColor = 'FFF0FDF4'; // leve verde para item de custo direto
        }

        const currentFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowFillColor } };

        // Col 1: Nível
        const c1 = row.getCell(1);
        c1.value = item.nivel;
        c1.alignment = { horizontal: 'center', vertical: 'middle' };
        c1.font = { name: 'Segoe UI', size: 9, bold: isNivel0 };

        // Col 2: Código
        const c2 = row.getCell(2);
        c2.value = item.codigo;
        c2.alignment = { horizontal: 'left', vertical: 'middle' };
        c2.font = { name: 'Consolas', size: 9, bold: isNivel0 };

        // Col 3: Descrição (com indentação visual por nível)
        const c3 = row.getCell(3);
        const indentSpaces = '   '.repeat(Math.max(0, item.nivel || 0));
        c3.value = `${indentSpaces}${item.descricao || '(Sem Descrição)'}`;
        c3.alignment = { horizontal: 'left', vertical: 'middle' };
        c3.font = { name: 'Segoe UI', size: 9, bold: isNivel0, color: { argb: isNivel0 ? 'FF1E40AF' : 'FF0F172A' } };

        // Col 4: NCM
        const c4 = row.getCell(4);
        c4.value = item.ncm || (isNivel0 ? ncmPai : '-') || '-';
        c4.alignment = { horizontal: 'center', vertical: 'middle' };
        c4.font = { name: 'Consolas', size: 9, color: { argb: 'FF475569' } };

        // Col 5: Tipo
        const c5 = row.getCell(5);
        c5.value = (item.tipo_produto || item.tipo || '-').toUpperCase();
        c5.alignment = { horizontal: 'center', vertical: 'middle' };
        c5.font = { name: 'Segoe UI', size: 9, bold: isCusto, color: { argb: isCusto ? COLORS.GREEN_TEXT : 'FF475569' } };

        // Col 6: UM
        const c6 = row.getCell(6);
        c6.value = item.unidade || 'UN';
        c6.alignment = { horizontal: 'center', vertical: 'middle' };
        c6.font = { name: 'Segoe UI', size: 9 };

        // Col 7: Qtd. Necessária
        const c7 = row.getCell(7);
        c7.value = qtd;
        c7.numFmt = '#,##0.0000';
        c7.alignment = { horizontal: 'right', vertical: 'middle' };
        c7.font = { name: 'Segoe UI', size: 9, bold: isNivel0 };

        // Col 8: Custo Standard (B1_CUSTD)
        const c8 = row.getCell(8);
        if (custoStdItem > 0) {
            c8.value = custoStdItem;
            c8.numFmt = '"R$"\\ #,##0.00';
            c8.alignment = { horizontal: 'right', vertical: 'middle' };
        } else {
            c8.value = '-';
            c8.alignment = { horizontal: 'center', vertical: 'middle' };
        }
        c8.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF475569' } };

        // Col 9: Custo / Preço Unitário
        // Para Nível 0: Exibe o Preço de Venda Unitário praticado (ou Custo Standard se não houver venda)
        // Para Componentes: Exibe o Custo Unitário de Aquisição (B1_UPRC / Preço Efetivo)
        const c9 = row.getCell(9);
        if (isNivel0) {
            if (precoVendaEfetivo > 0) {
                c9.value = precoVendaEfetivo;
                c9.numFmt = '"R$"\\ #,##0.00';
                c9.alignment = { horizontal: 'right', vertical: 'middle' };
            } else if (custoStandardPai > 0) {
                c9.value = custoStandardPai;
                c9.numFmt = '"R$"\\ #,##0.00';
                c9.alignment = { horizontal: 'right', vertical: 'middle' };
            } else {
                c9.value = '-';
                c9.alignment = { horizontal: 'center', vertical: 'middle' };
            }
            c9.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF0284C7' } };
        } else if (isCusto) {
            c9.value = precoUnit;
            c9.numFmt = '"R$"\\ #,##0.00';
            c9.alignment = { horizontal: 'right', vertical: 'middle' };
            c9.font = { name: 'Segoe UI', size: 9, bold: item.preco_override != null, color: { argb: item.preco_override != null ? COLORS.AMBER_TEXT : 'FF0F172A' } };
        } else {
            // Subconjunto intermediário
            c9.value = item.preco_efetivo > 0 ? item.preco_efetivo : (custoStdItem > 0 ? custoStdItem : '-');
            if (typeof c9.value === 'number') {
                c9.numFmt = '"R$"\\ #,##0.00';
                c9.alignment = { horizontal: 'right', vertical: 'middle' };
            } else {
                c9.alignment = { horizontal: 'center', vertical: 'middle' };
            }
            c9.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF64748B' } };
        }

        // Col 10: Custo Total
        // Para Nível 0: Exibe o Custo Total Industrial Apurado (Materiais + Mão de Obra)
        // Para Componentes de Custo: Formula Qtd * Custo Unitário
        // Para Subconjuntos: '-' (para não duplicar com os componentes explodidos abaixo)
        const c10 = row.getCell(10);
        if (isNivel0) {
            c10.value = custoTotalGeral;
            c10.numFmt = '"R$"\\ #,##0.00';
            c10.alignment = { horizontal: 'right', vertical: 'middle' };
            c10.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLORS.NAVY } };
        } else if (isCusto) {
            const rowNum = startRowMat + index;
            c10.value = { formula: `G${rowNum}*I${rowNum}`, result: custoTotal };
            c10.numFmt = '"R$"\\ #,##0.00';
            c10.alignment = { horizontal: 'right', vertical: 'middle' };
            c10.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLORS.GREEN_TEXT } };
        } else {
            c10.value = '-';
            c10.alignment = { horizontal: 'center', vertical: 'middle' };
            c10.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF94A3B8' } };
        }

        // Col 11: Tipo de Custo
        const c11 = row.getCell(11);
        if (isNivel0) {
            c11.value = 'PRODUTO PAI (PA)';
            c11.alignment = { horizontal: 'center', vertical: 'middle' };
            c11.font = { name: 'Segoe UI', size: 8, bold: true, color: { argb: 'FF1E40AF' } };
        } else {
            c11.value = isCusto ? 'SIM (MP/MC)' : 'NÃO (Subconjunto)';
            c11.alignment = { horizontal: 'center', vertical: 'middle' };
            c11.font = { name: 'Segoe UI', size: 8, bold: isCusto, color: { argb: isCusto ? COLORS.GREEN_TEXT : 'FF94A3B8' } };
        }

        // Col 12: Referência
        const c12 = row.getCell(12);
        c12.value = refs || '-';
        c12.alignment = { horizontal: 'left', vertical: 'middle' };
        c12.font = { name: 'Segoe UI', size: 9 };

        // Col 13: Status Eng
        const c13 = row.getCell(13);
        c13.value = statusItem;
        c13.alignment = { horizontal: 'center', vertical: 'middle' };
        c13.font = { name: 'Segoe UI', size: 8, bold: true };

        for (let colIdx = 1; colIdx <= 13; colIdx++) {
            const cell = row.getCell(colIdx);
            cell.fill = currentFill;
            cell.border = BORDERS.thin;
        }
    });

    // --- LINHA TOTALIZADORA DE MATERIAIS ---
    const endRowMat = startRowMat + structure.length - 1;
    const totalRowIndexMat = endRowMat + 1;
    const totalRowMat = ws1.getRow(totalRowIndexMat);
    totalRowMat.height = 24;

    ws1.mergeCells(`A${totalRowIndexMat}:I${totalRowIndexMat}`);
    const labelTotMat = totalRowMat.getCell(1);
    labelTotMat.value = 'TOTAL CUSTO DE MATERIAIS DIRETOS (Soma das Peças-Folha MP/MC/EM):';
    labelTotMat.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF14532D' } };
    labelTotMat.alignment = { horizontal: 'right', vertical: 'middle' };

    const valTotMat = totalRowMat.getCell(10);
    valTotMat.value = custoMateriais;
    valTotMat.numFmt = '"R$"\\ #,##0.00';
    valTotMat.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF14532D' } };
    valTotMat.alignment = { horizontal: 'right', vertical: 'middle' };

    ws1.mergeCells(`K${totalRowIndexMat}:M${totalRowIndexMat}`);

    for (let c = 1; c <= 13; c++) {
        const cell = totalRowMat.getCell(c);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.GREEN_LIGHT } };
        cell.border = BORDERS.topDoubleBottom;
    }

    // Auto-ajuste de larguras de colunas da Aba 1
    headersMat.forEach((h, idx) => {
        ws1.getColumn(idx + 1).width = h.width;
    });

    // =========================================================================
    // ABA 2: CUSTOS POR GRUPO DE MATERIAL (VISÃO COMERCIAL EXECUTIVA & ANALÍTICA)
    // =========================================================================
    const ws2 = wb.addWorksheet('Custos por Grupo de Material', {
        views: [{ state: 'frozen', xSplit: 0, ySplit: 6, activeCell: 'A7', showGridLines: true }]
    });

    // Filtra estritamente itens de custo direto (sem PA, sem PI, sem nível 0)
    const leafMaterials = structure.filter(isMaterialCusto);

    // Agrupamento consolidado por código único de material para que nenhum item
    // se repita no relatório analítico, somando as quantidades consumidas na estrutura
    const consolidatedMap = {};
    leafMaterials.forEach(item => {
        const key = (item.codigo || '').trim();
        if (!key) return;

        const qtd = parseFloat(item.qtd_necessaria) || 0;
        const preco = parseFloat(item.preco_efetivo != null ? item.preco_efetivo : item.preco_padrao) || 0;
        const custo = qtd * preco;

        if (!consolidatedMap[key]) {
            let refs = '';
            if (item.referencias && Array.isArray(item.referencias) && item.referencias.length > 0) {
                refs = item.referencias.map(r => r.desenho).filter(Boolean).join(', ');
            } else if (item.rev_metalfisa || item.rev_cliente || item.revisao) {
                refs = [(item.rev_metalfisa || item.revisao) && `Rev: ${item.rev_metalfisa || item.revisao}`, item.rev_cliente && `Rev. Cliente: ${item.rev_cliente}`].filter(Boolean).join(' | ');
            }

            consolidatedMap[key] = {
                codigo: key,
                descricao: item.descricao || '(Sem Descrição)',
                ncm: item.ncm || '-',
                unidade: item.unidade || 'UN',
                tipo_produto: (item.tipo_produto || item.tipo || '-').toUpperCase(),
                grupo: item.grupo || '',
                preco_unitario: preco,
                preco_override: item.preco_override,
                qtd_total: 0,
                custo_total: 0,
                referencia: refs || '-',
                groupId: classifyItem(item),
                minNivel: item.nivel
            };
        } else {
            if (item.nivel < consolidatedMap[key].minNivel) {
                consolidatedMap[key].minNivel = item.nivel;
            }
        }

        consolidatedMap[key].qtd_total += qtd;
        consolidatedMap[key].custo_total += custo;
    });

    const uniqueMaterialsList = Object.values(consolidatedMap);

    // Mapeamento por grupo
    const groupsSummary = GROUP_DEFS.map(gDef => {
        const items = uniqueMaterialsList.filter(m => m.groupId === gDef.id);
        const totalQtd = items.reduce((sum, i) => sum + i.qtd_total, 0);
        const totalCusto = items.reduce((sum, i) => sum + i.custo_total, 0);
        return {
            ...gDef,
            items: items.sort((a, b) => a.codigo.localeCompare(b.codigo)),
            totalQtd,
            totalCusto,
            itensCount: items.length
        };
    });

    // --- TÍTULO PRINCIPAL ABA 2 ---
    ws2.mergeCells('A1:I1');
    const titleRowGroup = ws2.getCell('A1');
    titleRowGroup.value = `${getCompanyLegalName()} — RESUMO GERENCIAL DE CUSTOS POR FAMÍLIA DE MATERIAL`;
    titleRowGroup.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: COLORS.WHITE } };
    titleRowGroup.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.NAVY } };
    titleRowGroup.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws2.getRow(1).height = 32;

    // --- SUBTÍTULO ABA 2 ---
    ws2.mergeCells('A2:I2');
    const subTitleRowGroup = ws2.getCell('A2');
    const subParts2 = [
        getCompanyCnpjCityLine(),
        'Visão Comercial Estratégica: Agrupamento de Matérias-Primas e Componentes (Exclui Subconjuntos PI/PA)'
    ].filter(Boolean);
    subTitleRowGroup.value = subParts2.join('  |  ');
    subTitleRowGroup.font = { name: 'Segoe UI', size: 9.5, italic: false, color: { argb: 'FF334155' } };
    subTitleRowGroup.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.SLATE_LIGHT } };
    subTitleRowGroup.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws2.getRow(2).height = 20;

    // Linha 3: Espaçador
    ws2.getRow(3).height = 8;

    // --- BLOCO DE IDENTIFICAÇÃO DO PRODUTO (Linhas 4 e 5) ---
    ws2.mergeCells('A4:D4');
    ws2.getCell('A4').value = `PRODUTO PRINCIPAL: ${codigo} - ${descPai}`;
    ws2.getCell('A4').font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF0F172A' } };
    ws2.getCell('A4').alignment = { vertical: 'middle' };

    ws2.mergeCells('E4:G4');
    ws2.getCell('E4').value = `PREÇO DE VENDA UNITÁRIO: ${precoVendaEfetivo > 0 ? precoVendaEfetivo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Não cadastrado'}`;
    ws2.getCell('E4').font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0284C7' } };
    ws2.getCell('E4').alignment = { vertical: 'middle' };

    ws2.mergeCells('H4:I4');
    ws2.getCell('H4').value = `STATUS ENG: ${statusPai}`;
    ws2.getCell('H4').font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: statusPai === 'NOVO' ? COLORS.GREEN_TEXT : 'FF1E293B' } };
    ws2.getCell('H4').alignment = { vertical: 'middle', horizontal: 'center' };

    ws2.mergeCells('A5:D5');
    ws2.getCell('A5').value = `Data de Emissão: ${dataHoraStr}  |  Emitido por: ${userName}`;
    ws2.getCell('A5').font = { name: 'Segoe UI', size: 9, color: { argb: 'FF64748B' } };
    ws2.getCell('A5').alignment = { vertical: 'middle' };

    ws2.mergeCells('E5:G5');
    ws2.getCell('E5').value = `CUSTO TOTAL MATERIAIS DIRETOS: ${custoMateriais.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
    ws2.getCell('E5').font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF15803D' } };
    ws2.getCell('E5').alignment = { vertical: 'middle' };

    ws2.mergeCells('H5:I5');
    ws2.getCell('H5').value = `Itens Consolidados: ${uniqueMaterialsList.length} componentes únicos`;
    ws2.getCell('H5').font = { name: 'Segoe UI', size: 9, color: { argb: 'FF64748B' } };
    ws2.getCell('H5').alignment = { vertical: 'middle', horizontal: 'center' };

    ws2.getRow(4).height = 22;
    ws2.getRow(5).height = 20;
    ws2.getRow(6).height = 8; // Linha 6 espaçador

    // --- SEÇÃO 1: RESUMO EXECUTIVO SINTÉTICO (Linhas 7 a N) ---
    ws2.mergeCells('A7:I7');
    const sec1Title = ws2.getCell('A7');
    sec1Title.value = '1. RESUMO EXECUTIVO CONSOLIDADO POR FAMÍLIA DE MATERIAL';
    sec1Title.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.WHITE } };
    sec1Title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.DARK_HEADER } };
    sec1Title.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws2.getRow(7).height = 24;

    const headersGroupSintetico = [
        { label: 'Cód. Grupo', width: 16, align: 'center' },
        { label: 'Família de Componentes', width: 30, align: 'left' },
        { label: 'Regra de Cadastro Protheus', width: 28, align: 'left' },
        { label: 'Qtd. Itens Distintos', width: 18, align: 'center' },
        { label: 'Consumo Total', width: 18, align: 'right' },
        { label: 'Custo Total Acumulado (R$)', width: 24, align: 'right' },
        { label: '% Custo Materiais', width: 18, align: 'right' },
        { label: '% Preço Venda', width: 16, align: 'right' },
        { label: 'Impacto Financeiro', width: 18, align: 'center' }
    ];

    const headerRowGroupSin = ws2.getRow(8);
    headerRowGroupSin.height = 26;
    headersGroupSintetico.forEach((h, idx) => {
        const cell = headerRowGroupSin.getCell(idx + 1);
        cell.value = h.label;
        cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLORS.WHITE } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
        cell.alignment = { vertical: 'middle', horizontal: h.align, wrapText: true };
        cell.border = BORDERS.thin;
    });

    const startRowSin = 9;
    const activeGroups = groupsSummary.filter(g => g.id !== 'OUTROS' || g.itensCount > 0);
    const lastRowSin = startRowSin + activeGroups.length - 1;
    const totalRowIndexSin = lastRowSin + 1;

    activeGroups.forEach((g, gIdx) => {
        const rowNum = startRowSin + gIdx;
        const row = ws2.getRow(rowNum);
        row.height = 21;

        const isZebra = gIdx % 2 === 1;
        const fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isZebra ? COLORS.ZEBRA : COLORS.WHITE } };

        // Col 1: Sigla
        const c1 = row.getCell(1);
        c1.value = g.sigla;
        c1.alignment = { horizontal: 'center', vertical: 'middle' };
        c1.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: g.accent } };

        // Col 2: Nome
        const c2 = row.getCell(2);
        c2.value = g.nome;
        c2.alignment = { horizontal: 'left', vertical: 'middle' };
        c2.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF0F172A' } };

        // Col 3: Regra
        const c3 = row.getCell(3);
        c3.value = g.regra;
        c3.alignment = { horizontal: 'left', vertical: 'middle' };
        c3.font = { name: 'Segoe UI', size: 8, color: { argb: 'FF64748B' } };

        // Col 4: Qtd Itens
        const c4 = row.getCell(4);
        c4.value = g.itensCount;
        c4.numFmt = '#,##0';
        c4.alignment = { horizontal: 'center', vertical: 'middle' };
        c4.font = { name: 'Segoe UI', size: 9, bold: g.itensCount > 0 };

        // Col 5: Consumo Total
        const c5 = row.getCell(5);
        c5.value = g.totalQtd;
        c5.numFmt = '#,##0.0000';
        c5.alignment = { horizontal: 'right', vertical: 'middle' };
        c5.font = { name: 'Segoe UI', size: 9 };

        // Col 6: Custo Total Acumulado
        const c6 = row.getCell(6);
        c6.value = g.totalCusto;
        c6.numFmt = '"R$"\\ #,##0.00';
        c6.alignment = { horizontal: 'right', vertical: 'middle' };
        c6.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: g.totalCusto > 0 ? COLORS.NAVY : 'FF94A3B8' } };

        // Col 7: % Custo Materiais
        const c7 = row.getCell(7);
        const percMatResult = custoMateriais > 0 ? (g.totalCusto / custoMateriais) : 0;
        c7.value = { formula: `F${rowNum}/$F$${totalRowIndexSin}`, result: percMatResult };
        c7.numFmt = '0.0%';
        c7.alignment = { horizontal: 'right', vertical: 'middle' };
        c7.font = { name: 'Segoe UI', size: 9, bold: percMatResult > 0.1 };

        // Col 8: % Preço Venda
        const c8 = row.getCell(8);
        if (precoVendaEfetivo > 0) {
            const percPVResult = g.totalCusto / precoVendaEfetivo;
            c8.value = { formula: `F${rowNum}/${precoVendaEfetivo}`, result: percPVResult };
            c8.numFmt = '0.0%';
            c8.alignment = { horizontal: 'right', vertical: 'middle' };
            c8.font = { name: 'Segoe UI', size: 9 };
        } else {
            c8.value = '-';
            c8.alignment = { horizontal: 'center', vertical: 'middle' };
            c8.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF94A3B8' } };
        }

        // Col 9: Impacto Financeiro
        const c9 = row.getCell(9);
        if (percMatResult >= 0.25) {
            c9.value = 'ALTO IMPACTO';
            c9.font = { name: 'Segoe UI', size: 8, bold: true, color: { argb: COLORS.AMBER_TEXT } };
        } else if (percMatResult >= 0.08) {
            c9.value = 'MÉDIO IMPACTO';
            c9.font = { name: 'Segoe UI', size: 8, bold: true, color: { argb: 'FF0284C7' } };
        } else if (percMatResult > 0) {
            c9.value = 'BAIXO IMPACTO';
            c9.font = { name: 'Segoe UI', size: 8, color: { argb: 'FF475569' } };
        } else {
            c9.value = '-';
            c9.font = { name: 'Segoe UI', size: 8, color: { argb: 'FF94A3B8' } };
        }
        c9.alignment = { horizontal: 'center', vertical: 'middle' };

        for (let colIdx = 1; colIdx <= 9; colIdx++) {
            const cell = row.getCell(colIdx);
            cell.fill = fill;
            cell.border = BORDERS.thin;
        }
    });

    // Linha Totalizadora do Resumo Sintético
    const totalRowSin = ws2.getRow(totalRowIndexSin);
    totalRowSin.height = 24;

    ws2.mergeCells(`A${totalRowIndexSin}:C${totalRowIndexSin}`);
    const lblTotSin = totalRowSin.getCell(1);
    lblTotSin.value = 'TOTAL GERAL DE MATERIAIS DIRETOS (SOMA DAS FAMÍLIAS):';
    lblTotSin.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF14532D' } };
    lblTotSin.alignment = { horizontal: 'right', vertical: 'middle' };

    const cTotD = totalRowSin.getCell(4);
    cTotD.value = { formula: `SUM(D${startRowSin}:D${lastRowSin})`, result: uniqueMaterialsList.length };
    cTotD.numFmt = '#,##0';
    cTotD.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF14532D' } };
    cTotD.alignment = { horizontal: 'center', vertical: 'middle' };

    const cTotE = totalRowSin.getCell(5);
    cTotE.value = { formula: `SUM(E${startRowSin}:E${lastRowSin})`, result: activeGroups.reduce((s, g) => s + g.totalQtd, 0) };
    cTotE.numFmt = '#,##0.0000';
    cTotE.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF14532D' } };
    cTotE.alignment = { horizontal: 'right', vertical: 'middle' };

    const cTotF = totalRowSin.getCell(6);
    cTotF.value = { formula: `SUM(F${startRowSin}:F${lastRowSin})`, result: custoMateriais };
    cTotF.numFmt = '"R$"\\ #,##0.00';
    cTotF.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF14532D' } };
    cTotF.alignment = { horizontal: 'right', vertical: 'middle' };

    const cTotG = totalRowSin.getCell(7);
    cTotG.value = { formula: `SUM(G${startRowSin}:G${lastRowSin})`, result: 1.0 };
    cTotG.numFmt = '0.0%';
    cTotG.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF14532D' } };
    cTotG.alignment = { horizontal: 'right', vertical: 'middle' };

    const cTotH = totalRowSin.getCell(8);
    if (precoVendaEfetivo > 0) {
        cTotH.value = { formula: `F${totalRowIndexSin}/${precoVendaEfetivo}`, result: (custoMateriais / precoVendaEfetivo) };
        cTotH.numFmt = '0.0%';
    } else {
        cTotH.value = '-';
    }
    cTotH.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF14532D' } };
    cTotH.alignment = { horizontal: 'right', vertical: 'middle' };

    const cTotI = totalRowSin.getCell(9);
    cTotI.value = '100.0%';
    cTotI.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF14532D' } };
    cTotI.alignment = { horizontal: 'center', vertical: 'middle' };

    for (let c = 1; c <= 9; c++) {
        const cell = totalRowSin.getCell(c);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.GREEN_LIGHT } };
        cell.border = BORDERS.topDoubleBottom;
    }

    // Linha espaçadora após o resumo
    let currentRowGroup = totalRowIndexSin + 1;
    ws2.getRow(currentRowGroup).height = 14;
    currentRowGroup++;

    // --- SEÇÃO 2: DETALHAMENTO ANALÍTICO POR FAMÍLIA (Linhas seguintes) ---
    ws2.mergeCells(`A${currentRowGroup}:I${currentRowGroup}`);
    const sec2Title = ws2.getCell(`A${currentRowGroup}`);
    sec2Title.value = '2. DETALHAMENTO ANALÍTICO DE COMPONENTES POR FAMÍLIA (CONSOLIDADO POR ITEM - SEM DUPLICIDADES)';
    sec2Title.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.WHITE } };
    sec2Title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.DARK_HEADER } };
    sec2Title.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws2.getRow(currentRowGroup).height = 24;
    currentRowGroup++;

    const headersGroupAnalitico = [
        { label: 'Nível Ref.', width: 12, align: 'center' },
        { label: 'Código Protheus', width: 22, align: 'left' },
        { label: 'Descrição do Componente', width: 38, align: 'left' },
        { label: 'NCM', width: 14, align: 'center' },
        { label: 'UM', width: 8, align: 'center' },
        { label: 'Qtd. Acumulada', width: 18, align: 'right' },
        { label: 'Custo Unit. (R$)', width: 18, align: 'right' },
        { label: 'Custo Total (R$)', width: 22, align: 'right' },
        { label: 'Ref. / Desenho', width: 24, align: 'left' }
    ];

    // Itera grupos que possuem itens cadastrados
    activeGroups.filter(g => g.itensCount > 0).forEach(g => {
        // Banner do Grupo
        ws2.mergeCells(`A${currentRowGroup}:I${currentRowGroup}`);
        const groupBanner = ws2.getCell(`A${currentRowGroup}`);
        const percGrupo = custoMateriais > 0 ? ((g.totalCusto / custoMateriais) * 100).toFixed(1) : '0.0';
        groupBanner.value = `▶ FAMÍLIA ${g.sigla}: ${g.nome.toUpperCase()}  —  (${g.itensCount} itens distintos | Consumo: ${g.totalQtd.toLocaleString('pt-BR')} | Custo: ${g.totalCusto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} | ${percGrupo}% dos Materiais)`;
        groupBanner.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: g.bannerText } };
        groupBanner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: g.bannerBg } };
        groupBanner.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        ws2.getRow(currentRowGroup).height = 22;
        currentRowGroup++;

        // Cabeçalho da sub-tabela
        const subHeaderRow = ws2.getRow(currentRowGroup);
        subHeaderRow.height = 22;
        headersGroupAnalitico.forEach((h, idx) => {
            const cell = subHeaderRow.getCell(idx + 1);
            cell.value = h.label;
            cell.font = { name: 'Segoe UI', size: 8, bold: true, color: { argb: COLORS.WHITE } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };
            cell.alignment = { vertical: 'middle', horizontal: h.align, wrapText: true };
            cell.border = BORDERS.thin;
        });
        currentRowGroup++;

        const startItemRow = currentRowGroup;

        // Linhas de itens
        g.items.forEach((item, itemIdx) => {
            const itemRow = ws2.getRow(currentRowGroup);
            itemRow.height = 20;

            const isZebra = itemIdx % 2 === 1;
            const fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isZebra ? COLORS.ZEBRA : COLORS.WHITE } };

            // 1. Nível
            const ci1 = itemRow.getCell(1);
            ci1.value = item.minNivel;
            ci1.alignment = { horizontal: 'center', vertical: 'middle' };
            ci1.font = { name: 'Segoe UI', size: 8 };

            // 2. Código
            const ci2 = itemRow.getCell(2);
            ci2.value = item.codigo;
            ci2.alignment = { horizontal: 'left', vertical: 'middle' };
            ci2.font = { name: 'Consolas', size: 9, bold: true, color: { argb: 'FF0F172A' } };

            // 3. Descrição
            const ci3 = itemRow.getCell(3);
            ci3.value = item.descricao;
            ci3.alignment = { horizontal: 'left', vertical: 'middle' };
            ci3.font = { name: 'Segoe UI', size: 9 };

            // 4. NCM
            const ci4 = itemRow.getCell(4);
            ci4.value = item.ncm;
            ci4.alignment = { horizontal: 'center', vertical: 'middle' };
            ci4.font = { name: 'Consolas', size: 8, color: { argb: 'FF475569' } };

            // 5. UM
            const ci5 = itemRow.getCell(5);
            ci5.value = item.unidade;
            ci5.alignment = { horizontal: 'center', vertical: 'middle' };
            ci5.font = { name: 'Segoe UI', size: 9 };

            // 6. Qtd Acumulada
            const ci6 = itemRow.getCell(6);
            ci6.value = item.qtd_total;
            ci6.numFmt = '#,##0.0000';
            ci6.alignment = { horizontal: 'right', vertical: 'middle' };
            ci6.font = { name: 'Segoe UI', size: 9 };

            // 7. Custo Unitário
            const ci7 = itemRow.getCell(7);
            ci7.value = item.preco_unitario;
            ci7.numFmt = '"R$"\\ #,##0.00';
            ci7.alignment = { horizontal: 'right', vertical: 'middle' };
            ci7.font = {
                name: 'Segoe UI',
                size: 9,
                bold: item.preco_override != null,
                color: { argb: item.preco_override != null ? COLORS.AMBER_TEXT : 'FF0F172A' }
            };

            // 8. Custo Total (Fórmula Excel Qtd * Preço)
            const ci8 = itemRow.getCell(8);
            ci8.value = { formula: `F${currentRowGroup}*G${currentRowGroup}`, result: item.custo_total };
            ci8.numFmt = '"R$"\\ #,##0.00';
            ci8.alignment = { horizontal: 'right', vertical: 'middle' };
            ci8.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF166534' } };

            // 9. Referência / Desenho
            const ci9 = itemRow.getCell(9);
            ci9.value = item.referencia;
            ci9.alignment = { horizontal: 'left', vertical: 'middle' };
            ci9.font = { name: 'Segoe UI', size: 8, color: { argb: 'FF475569' } };

            for (let c = 1; c <= 9; c++) {
                const cell = itemRow.getCell(c);
                cell.fill = fill;
                cell.border = BORDERS.thin;
            }
            currentRowGroup++;
        });

        const endItemRow = currentRowGroup - 1;

        // Subtotal da Família
        const subTotalRow = ws2.getRow(currentRowGroup);
        subTotalRow.height = 22;

        ws2.mergeCells(`A${currentRowGroup}:E${currentRowGroup}`);
        const lblSub = subTotalRow.getCell(1);
        lblSub.value = `SUBTOTAL ${g.nome.toUpperCase()} (${g.itensCount} itens):`;
        lblSub.font = { name: 'Segoe UI', size: 8, bold: true, color: { argb: g.accent } };
        lblSub.alignment = { horizontal: 'right', vertical: 'middle' };

        const cSubQtd = subTotalRow.getCell(6);
        cSubQtd.value = { formula: `SUM(F${startItemRow}:F${endItemRow})`, result: g.totalQtd };
        cSubQtd.numFmt = '#,##0.0000';
        cSubQtd.font = { name: 'Segoe UI', size: 8, bold: true, color: { argb: g.accent } };
        cSubQtd.alignment = { horizontal: 'right', vertical: 'middle' };

        const cSubEmpty = subTotalRow.getCell(7);
        cSubEmpty.value = '-';
        cSubEmpty.alignment = { horizontal: 'center', vertical: 'middle' };
        cSubEmpty.font = { name: 'Segoe UI', size: 8, color: { argb: 'FF94A3B8' } };

        const cSubCusto = subTotalRow.getCell(8);
        cSubCusto.value = { formula: `SUM(H${startItemRow}:H${endItemRow})`, result: g.totalCusto };
        cSubCusto.numFmt = '"R$"\\ #,##0.00';
        cSubCusto.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: g.accent } };
        cSubCusto.alignment = { horizontal: 'right', vertical: 'middle' };

        const cSubPerc = subTotalRow.getCell(9);
        cSubPerc.value = `${percGrupo}% dos Materiais`;
        cSubPerc.font = { name: 'Segoe UI', size: 8, bold: true, color: { argb: g.accent } };
        cSubPerc.alignment = { horizontal: 'center', vertical: 'middle' };

        for (let c = 1; c <= 9; c++) {
            const cell = subTotalRow.getCell(c);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.SLATE_LIGHT } };
            cell.border = BORDERS.thin;
        }
        currentRowGroup++;

        // Espaçador entre famílias
        ws2.getRow(currentRowGroup).height = 10;
        currentRowGroup++;
    });

    // Auto-ajuste de larguras de colunas da Aba 2
    headersGroupSintetico.forEach((h, idx) => {
        ws2.getColumn(idx + 1).width = h.width;
    });

    // =========================================================================
    // ABA 3: ROTEIRO OPERACIONAL & RECURSOS (MÃO DE OBRA)
    // =========================================================================
    const ws3 = wb.addWorksheet('Roteiro & Mão de Obra', {
        views: [{ state: 'frozen', xSplit: 0, ySplit: 6, activeCell: 'A7', showGridLines: true }]
    });

    // Título Aba 3
    ws3.mergeCells('A1:L1');
    const titleRow3 = ws3.getCell('A1');
    titleRow3.value = `${getCompanyLegalName()} — ROTEIRO OPERACIONAL E CUSTOS DE RECURSOS / MÃO DE OBRA`;
    titleRow3.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: COLORS.WHITE } };
    titleRow3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    titleRow3.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws3.getRow(1).height = 32;

    // Subtítulo Aba 3
    ws3.mergeCells('A2:L2');
    const subTitleRow3 = ws3.getCell('A2');
    const subParts3 = [
        getCompanyCnpjCityLine(),
        `Detalhamento de Operações, Tempos Padrão e Taxas Horárias para o Produto: ${codigo} - ${descPai}`
    ].filter(Boolean);
    subTitleRow3.value = subParts3.join('  |  ');
    subTitleRow3.font = { name: 'Segoe UI', size: 9.5, italic: false, color: { argb: 'FF334155' } };
    subTitleRow3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.SLATE_LIGHT } };
    subTitleRow3.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws3.getRow(2).height = 20;

    // Resumo Linha 4
    ws3.mergeCells('A4:F4');
    ws3.getCell('A4').value = `Total Mão de Obra / Recursos Apurado: ${custoRecursos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
    ws3.getCell('A4').font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF1E40AF' } };
    ws3.getCell('A4').alignment = { vertical: 'middle' };

    ws3.mergeCells('G4:L4');
    ws3.getCell('G4').value = `Data de Emissão: ${dataHoraStr}  |  Emitido por: ${userName}`;
    ws3.getCell('G4').font = { name: 'Segoe UI', size: 9, color: { argb: 'FF64748B' } };
    ws3.getCell('G4').alignment = { vertical: 'middle' };
    ws3.getRow(4).height = 20;
    ws3.getRow(5).height = 8; // Linha 5 vazia

    // Cabeçalho da Tabela de Roteiros (Linha 6)
    const headersRot = [
        { label: 'Código Peça', width: 22, align: 'left' },
        { label: 'Descrição da Peça', width: 32, align: 'left' },
        { label: 'Qtd. Estrutura', width: 14, align: 'right' },
        { label: 'Operação', width: 12, align: 'center' },
        { label: 'Descrição da Operação', width: 30, align: 'left' },
        { label: 'Recurso / Máquina', width: 18, align: 'center' },
        { label: 'Departamento', width: 16, align: 'center' },
        { label: 'Tempo Setup (min)', width: 16, align: 'right' },
        { label: 'Tempo Padrão (min)', width: 16, align: 'right' },
        { label: 'Taxa Setup (R$/min)', width: 17, align: 'right' },
        { label: 'Taxa Padrão (R$/min)', width: 17, align: 'right' },
        { label: 'Custo Total Operação (R$)', width: 20, align: 'right' }
    ];

    const headerRowRot = ws3.getRow(6);
    headerRowRot.height = 28;
    headersRot.forEach((h, idx) => {
        const cell = headerRowRot.getCell(idx + 1);
        cell.value = h.label;
        cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLORS.WHITE } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.DARK_HEADER } };
        cell.alignment = { vertical: 'middle', horizontal: h.align, wrapText: true };
        cell.border = BORDERS.thin;
    });

    // Linhas de Operações (A partir da Linha 7)
    let startRowRot = 7;
    let totalOperacoes = 0;

    structure.forEach(item => {
        const key = item.codigo?.trim();
        const route = routes[key];
        const qtdItem = parseFloat(item.qtd_necessaria) || 1;

        if (Array.isArray(route) && route.length > 0) {
            route.forEach((op, opIdx) => {
                const row = ws3.getRow(startRowRot + totalOperacoes);
                row.height = 20;

                const setupMin = parseFloat(op.tempo_setup || 0);
                const padraoMin = parseFloat(op.tempo_padrao || 0);
                const taxaSetup = parseFloat(op.taxa_setup_min || 0);
                const taxaPadrao = parseFloat(op.taxa_padrao_min || 0);
                const custoOpUnit = (setupMin * taxaSetup) + (padraoMin * taxaPadrao);
                const custoOpTotalEstrutura = (parseFloat(op.custo_total_op) || custoOpUnit) * qtdItem;

                const isZebra = totalOperacoes % 2 === 1;
                const fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isZebra ? COLORS.ZEBRA : COLORS.WHITE } };

                // 1. Código
                const c1 = row.getCell(1);
                c1.value = item.codigo;
                c1.font = { name: 'Consolas', size: 9, bold: opIdx === 0 };

                // 2. Descrição
                const c2 = row.getCell(2);
                c2.value = item.descricao;
                c2.font = { name: 'Segoe UI', size: 9 };

                // 3. Qtd
                const c3 = row.getCell(3);
                c3.value = qtdItem;
                c3.numFmt = '#,##0.0000';
                c3.alignment = { horizontal: 'right', vertical: 'middle' };

                // 4. Operação
                const c4 = row.getCell(4);
                c4.value = op.operacao || String(op.g2_operac || '-');
                c4.alignment = { horizontal: 'center', vertical: 'middle' };
                c4.font = { name: 'Consolas', size: 9, bold: true };

                // 5. Descrição Operação
                const c5 = row.getCell(5);
                c5.value = op.descricao || op.h1_descri || '-';

                // 6. Recurso
                const c6 = row.getCell(6);
                c6.value = op.recurso || op.g2_recurso || '-';
                c6.alignment = { horizontal: 'center', vertical: 'middle' };
                c6.font = { name: 'Consolas', size: 9, bold: true, color: { argb: 'FF1E40AF' } };

                // 7. Depto
                const c7 = row.getCell(7);
                c7.value = op.departamento || op.g2_depto || '-';
                c7.alignment = { horizontal: 'center', vertical: 'middle' };

                // 8. Setup min
                const c8 = row.getCell(8);
                c8.value = setupMin;
                c8.numFmt = '#,##0.00';
                c8.alignment = { horizontal: 'right', vertical: 'middle' };

                // 9. Padrão min
                const c9 = row.getCell(9);
                c9.value = padraoMin;
                c9.numFmt = '#,##0.00';
                c9.alignment = { horizontal: 'right', vertical: 'middle' };

                // 10. Taxa Setup
                const c10 = row.getCell(10);
                c10.value = taxaSetup;
                c10.numFmt = '"R$"\\ #,##0.00';
                c10.alignment = { horizontal: 'right', vertical: 'middle' };

                // 11. Taxa Padrão
                const c11 = row.getCell(11);
                c11.value = taxaPadrao;
                c11.numFmt = '"R$"\\ #,##0.00';
                c11.alignment = { horizontal: 'right', vertical: 'middle' };

                // 12. Custo Total Op
                const c12 = row.getCell(12);
                c12.value = custoOpTotalEstrutura;
                c12.numFmt = '"R$"\\ #,##0.00';
                c12.alignment = { horizontal: 'right', vertical: 'middle' };
                c12.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF1E40AF' } };

                for (let c = 1; c <= 12; c++) {
                    const cell = row.getCell(c);
                    cell.fill = fill;
                    cell.border = BORDERS.thin;
                }

                totalOperacoes++;
            });
        }
    });

    if (totalOperacoes === 0) {
        const emptyRow = ws3.getRow(startRowRot);
        ws3.mergeCells(`A${startRowRot}:L${startRowRot}`);
        emptyRow.getCell(1).value = 'Nenhum roteiro ou operação produtiva encontrada para os itens desta estrutura.';
        emptyRow.getCell(1).font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF94A3B8' } };
        emptyRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        emptyRow.height = 30;
    } else {
        // Linha Totalizadora de Roteiro
        const totalRowIndexRot = startRowRot + totalOperacoes;
        const totalRowRot = ws3.getRow(totalRowIndexRot);
        totalRowRot.height = 24;

        ws3.mergeCells(`A${totalRowIndexRot}:K${totalRowIndexRot}`);
        const labelTotRot = totalRowRot.getCell(1);
        labelTotRot.value = 'TOTAL GERAL DE RECURSOS / MÃO DE OBRA DA ESTRUTURA:';
        labelTotRot.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF1E40AF' } };
        labelTotRot.alignment = { horizontal: 'right', vertical: 'middle' };

        const valTotRot = totalRowRot.getCell(12);
        const firstOpRow = startRowRot;
        const lastOpRow = startRowRot + totalOperacoes - 1;
        valTotRot.value = { formula: `SUM(L${firstOpRow}:L${lastOpRow})`, result: custoRecursos };
        valTotRot.numFmt = '"R$"\\ #,##0.00';
        valTotRot.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1E40AF' } };
        valTotRot.alignment = { horizontal: 'right', vertical: 'middle' };

        for (let c = 1; c <= 12; c++) {
            const cell = totalRowRot.getCell(c);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
            cell.border = BORDERS.topDoubleBottom;
        }
    }

    // Auto-ajuste de larguras de colunas da Aba 3
    headersRot.forEach((h, idx) => {
        ws3.getColumn(idx + 1).width = h.width;
    });

    // Download do arquivo Excel
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `Relatorio_Comercial_Custos_${codigo}_${fileTimestamp}.xlsx`;
    downloadBlob(blob, fileName);
    return true;
};
