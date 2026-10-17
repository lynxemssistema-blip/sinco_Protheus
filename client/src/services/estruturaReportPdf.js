import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import api from './api';
import { 
  getCompanyShortName, 
  getCompanyLegalName, 
  getCompanyCnpjCityLine, 
  getCompanyAddressLine,
  getCompanyLogoBase64,
  loadCompanyBranding 
} from './companyBranding';

// ─── Paleta Oficial Lynx Forest Green ──────────────────────────────────────────
const C = {
  lynxForest:  [66,  87,  80],  // #425750 - Cor predominante oficial Lynx
  lynxDark:    [44,  59,  54],  // #2c3b36 - Tom escuro executivo
  lynxLight:   [236, 244, 241], // #ecf4f1 - Tint suave para Nível 1 e fundos
  lynxAccent:  [80, 105,  96],  // #506960 - Subtítulos e detalhes
  lynxBorder:  [185, 205, 198], // Bordas refinadas
  white:       [255, 255, 255],
  altRow:      [248, 250, 249],
  lightGray:   [243, 245, 244],
  darkText:    [28,   38,  34],
  midText:     [65,   80,  75],
  mutedText:   [115, 130, 125],
  border:      [200, 212, 208],
  red:         [220,  38,  38],
  green:       [22,  163,  74],
  amber:       [217, 119,   6],
  opRow:       [254, 250, 238],
  opText:      [115,  80,  15],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtQtd = (v) =>
  parseFloat(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 });

const fmtDate = () => new Date().toLocaleDateString('pt-BR');
const fmtTime = () =>
  new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const tipoLabel = (t) => {
  switch ((t || '').toUpperCase().trim()) {
    case 'PA': return 'PA — Produto Acabado';
    case 'PI': return 'PI — Produto Intermediário';
    case 'MP': return 'MP — Matéria-Prima';
    case 'ME': return 'ME — Material de Embalagem';
    case 'MC': return 'MC — Material de Consumo';
    case 'PR': return 'PR — Processo';
    default:   return t || '—';
  }
};

const rowStyle = (nivel) => {
  switch (nivel) {
    case 0:  return { fill: C.lynxForest, text: C.white,    bold: true };
    case 1:  return { fill: C.lynxLight,  text: C.darkText, bold: false };
    case 2:  return { fill: C.lightGray,  text: C.darkText, bold: false };
    default: return { fill: C.white,      text: C.darkText, bold: false };
  }
};

// ─── Cabeçalho Executivo (todas as páginas) — landscape ──────────────────────
function drawPageHeader(doc, root, PW, ML, MR, dateStr, timeStr, customTitle = 'RELAÇÃO SIMPLIFICADA DAS ESTRUTURAS — MATR225Cus') {
  const MW = PW - ML - MR;

  // 1. Barra de Topo Executiva (Verde Lynx)
  const headerBarH = 22;
  doc.setFillColor(...C.lynxDark);
  doc.rect(ML, 7, MW, headerBarH, 'F');

  // Área Branca do Logotipo (esquerda da barra)
  const logoBoxW = 28;
  const logoBoxH = headerBarH - 2; // 20mm
  doc.setFillColor(...C.white);
  doc.roundedRect(ML + 1, 8, logoBoxW, logoBoxH, 1, 1, 'F');

  const logoBase64 = getCompanyLogoBase64();
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', ML + 2, 9, logoBoxW - 2, logoBoxH - 2, undefined, 'FAST');
    } catch (e) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...C.lynxForest);
      doc.text(getCompanyShortName(), ML + 4, 19);
    }
  }

  // 2. Dados da Empresa Ativa (ao lado do logo)
  const textLeftX = ML + logoBoxW + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...C.white);
  const legalName = getCompanyLegalName();
  doc.text(legalName, textLeftX, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(215, 230, 225);
  const cnpjCity = getCompanyCnpjCityLine();
  const addressLine = getCompanyAddressLine();
  if (cnpjCity) {
    doc.text(cnpjCity, textLeftX, 18);
  }
  if (addressLine) {
    doc.text(addressLine, textLeftX, 23);
  }

  // 3. Título e Metadados do Relatório (canto direito da barra)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...C.white);
  doc.text(customTitle, PW - MR - 4, 13, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(215, 230, 225);
  doc.text('SINCO Suite  ·  Engenharia de Produto', PW - MR - 4, 18, { align: 'right' });
  doc.text(`Emissão: ${dateStr} às ${timeStr}`, PW - MR - 4, 23, { align: 'right' });

  // 4. Cartão de Informações do Produto Pai (y = 30 a 41 mm)
  const prodCardY = 30;
  const prodCardH = 11;
  doc.setFillColor(...C.lynxLight);
  doc.rect(ML, prodCardY, MW, prodCardH, 'F');
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.rect(ML, prodCardY, MW, prodCardH);

  const colW = MW / 4;
  [1, 2, 3].forEach((n) => doc.line(ML + colW * n, prodCardY, ML + colW * n, prodCardY + prodCardH));

  const field = (x, y, label, value, maxChars = 38) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(...C.lynxAccent);
    doc.text(label, x, y);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(...C.darkText);
    const v = String(value || '—');
    doc.text(v.length > maxChars ? v.substring(0, maxChars) + '…' : v, x, y + 4.5);
  };

  field(ML + 3,            prodCardY + 3.5, 'CÓDIGO INTERNO', root.codigo, 32);
  field(ML + colW + 3,     prodCardY + 3.5, 'DESCRIÇÃO DO PRODUTO', root.descricao, 48);
  field(ML + colW * 2 + 3, prodCardY + 3.5, 'TIPO DE ITEM', tipoLabel(root.tipo_produto), 34);
  field(ML + colW * 3 + 3, prodCardY + 3.5, 'REVISÃO DE ENGENHARIA', root.rev_metalfisa || root.revisao || '00', 20);
}

// ─── Rodapé ───────────────────────────────────────────────────────────────────
function drawFooter(doc, pageNum, totalPages, PW, ML, MR, PH, dateStr, timeStr, customTitle = 'Relação Simplificada das Estruturas') {
  doc.setPage(pageNum);
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.line(ML, PH - 10, PW - MR, PH - 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.mutedText);
  const companyShort = getCompanyShortName();
  doc.text(`${companyShort}  ·  SINCO Suite — ${customTitle}`, ML, PH - 6);
  doc.text(`Emitido: ${dateStr} às ${timeStr}`, PW / 2, PH - 6, { align: 'center' });
  doc.text(`Folha ${pageNum} de ${totalPages}`, PW - MR, PH - 6, { align: 'right' });
}

// ─── Helper: carimbo de liberação (desenhado em cada página) ─────────────────
function drawStamp(doc, carimbo, PW, PH, MR) {
  if (!carimbo || !carimbo.ativo) return;

  const W  = 95;
  let H  = 30; // Altura base
  let currentDetailY = 22.5;

  let obsLines = [];
  if (carimbo.observacao) {
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      obsLines = doc.splitTextToSize(`Obs: ${carimbo.observacao}`, W - 8);
      H += (obsLines.length * 3) + 4; // Ajusta a altura da caixa
  }

  const x  = PW - MR - W;
  const y  = PH - 12 - H;

  // Fundo branco semitransparente
  doc.setFillColor(255, 255, 255);
  doc.rect(x, y, W, H, 'F');

  // Borda vermelha dupla
  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(0.8);
  doc.rect(x, y, W, H);
  doc.setLineWidth(0.3);
  doc.rect(x + 1.2, y + 1.2, W - 2.4, H - 2.4);

  // Título
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(220, 38, 38);
  doc.text('LIBERADO PARA FABRICAÇÃO', x + W / 2, y + 7.5, { align: 'center' });

  // Linha separadora
  doc.setLineWidth(0.3);
  doc.line(x + 2, y + 9.5, x + W - 2, y + 9.5);

  // Detalhes
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(220, 38, 38);
  doc.text(`Data: ${carimbo.data}`, x + 4, y + 13.5);
  doc.text(`Responsável: ${(carimbo.usuario || '').toUpperCase()}`, x + 4, y + 18);

  if (carimbo.pedido) {
    const pedStr = `Pedido: ${carimbo.pedido}${carimbo.item ? '  /  Item: ' + carimbo.item : ''}`;
    doc.text(pedStr, x + 4, y + currentDetailY);
    currentDetailY += 4.5;
  }

  // Código de Liberação único
  if (carimbo.codigo_liberacao) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(`Liberação nº: ${carimbo.codigo_liberacao}`, x + 4, y + currentDetailY);
    currentDetailY += 4.5;
  }
  
  // Observação
  if (obsLines.length > 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(220, 38, 38);
    doc.text(obsLines, x + 4, y + currentDetailY);
  }
}

// ─── Helper: próximo Y ou nova página ────────────────────────────────────────
function nextSectionStart(doc, PH, ML, MR, root, PW, dateStr, timeStr, title, minSpace = 55) {
  const lastY = doc.lastAutoTable ? doc.lastAutoTable.finalY : null;
  if (lastY && (PH - 14 - lastY) >= minSpace) {
    return { y: lastY + 10, newPage: false };
  }
  doc.addPage();
  drawPageHeader(doc, root, PW, ML, MR, dateStr, timeStr, title);
  return { y: 44, newPage: true };
}

// ─── Helper: tabela de restrições (reutilizada em ambos os modos) ─────────────
function drawRestrictionsTable(doc, structure, root, PW, ML, MR, dateStr, timeStr, title, levelFilter) {
  const itensCom = structure.filter((i) => i.is_restricted && (levelFilter == null || i.nivel <= levelFilter));
  if (itensCom.length === 0) return;

  const PH = doc.internal.pageSize.getHeight();
  const { y: titleY } = nextSectionStart(doc, PH, ML, MR, root, PW, dateStr, timeStr, title);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.lynxForest);
  doc.text('RESUMO DE RESTRIÇÕES DA ESTRUTURA', ML, titleY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.mutedText);
  doc.text(`Total de itens com restrição: ${itensCom.length} de ${structure.length} componentes`, ML, titleY + 5);

  doc.setFillColor(...C.lightGray);
  doc.roundedRect(PW - MR - 100, titleY - 1, 100, 11, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...C.red);
  doc.text('■', PW - MR - 97, titleY + 4.5);
  doc.setTextColor(...C.darkText);
  doc.text('Bloqueio Cadastro (SB1)', PW - MR - 92, titleY + 4.5);
  doc.setTextColor(180, 60, 180);
  doc.text('■', PW - MR - 97, titleY + 8.5);
  doc.setTextColor(...C.darkText);
  doc.text('Restrição Engenharia (SZ0)', PW - MR - 92, titleY + 8.5);

  let seqR = 1;
  const restricRows = itensCom.map((item) => {
    const fontes = [];
    if (item.restri_sb1) fontes.push('Bloqueio Cadastro (SB1 = ' + item.restri_sb1 + ')');
    if (item.restri_sz0) fontes.push('Restrição Engenharia (SZ0 = P)');
    const refs = item.referencias && item.referencias.length > 0 ? item.referencias : [];
    const desenhoRef = refs.length > 0
      ? refs.map((r) => r.desenho).filter(Boolean).join(' / ')
      : '—';
    return {
      sb1: !!item.restri_sb1,
      sz0: !!item.restri_sz0,
      data: [
        String(seqR++).padStart(3, '0'),
        String(item.nivel || 0).padStart(2, '0'),
        (item.tipo_produto || '—').toUpperCase().trim(),
        item.codigo || '—',
        item.descricao || '—',
        item.rev_metalfisa || item.revisao || '00',
        desenhoRef,
        fontes.join('\n') || '—',
        item.restricao_sz0_desc || '—',
        'Ativo',
        dateStr,
      ],
    };
  });

  autoTable(doc, {
    startY: titleY + 14,
    head: [['#', 'NÍV', 'TP', 'CÓDIGO', 'DESCRIÇÃO', 'REVISÃO', 'DESENHO / REF.', 'ORIGEM DA RESTRIÇÃO', 'DESCRIÇÃO DA RESTRIÇÃO', 'STATUS', 'DATA EMISSÃO']],
    body: restricRows.map((r) => r.data),
    theme: 'grid',
    styles:     { fontSize: 7, cellPadding: 1.5, textColor: C.darkText, font: 'helvetica' },
    headStyles: { fillColor: C.lynxForest, textColor: C.white, fontStyle: 'bold', fontSize: 7, font: 'helvetica' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 8 },
      2: { halign: 'center', cellWidth: 8 },
      3: { halign: 'left',   cellWidth: 28 },
      4: { halign: 'left',   overflow: 'linebreak' },
      5: { halign: 'center', cellWidth: 16 },
      6: { halign: 'left',   cellWidth: 28 },
      7: { halign: 'left',   overflow: 'linebreak', cellWidth: 36 },
      8: { halign: 'left',   overflow: 'linebreak', cellWidth: 46 },
      9: { halign: 'center', cellWidth: 14 },
      10: { halign: 'center', cellWidth: 20 },
    },
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      const row = restricRows[data.row.index];
      if (!row) return;
      if (row.sb1 && !row.sz0) {
        data.cell.styles.fillColor = [255, 235, 235];
        if (data.column.index === 7) { data.cell.styles.textColor = C.red; data.cell.styles.fontStyle = 'bold'; }
      }
      if (row.sz0 && !row.sb1) {
        data.cell.styles.fillColor = [245, 230, 255];
        if (data.column.index === 7) { data.cell.styles.textColor = [160, 40, 180]; data.cell.styles.fontStyle = 'bold'; }
      }
      if (row.sb1 && row.sz0) {
        data.cell.styles.fillColor = [255, 240, 220];
        if (data.column.index === 7) { data.cell.styles.textColor = C.amber; data.cell.styles.fontStyle = 'bold'; }
      }
      if (data.column.index === 9) {
        data.cell.styles.textColor = C.red;
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.font      = 'helvetica';
      }
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) drawPageHeader(doc, root, PW, ML, MR, dateStr, timeStr, title);
    },
    margin: { left: ML, right: MR, top: 43, bottom: 14 },
  });
}

// ─── Helper: tabela detalhada de registros SZ0 ────────────────────────────────
function drawSZ0DetailsTable(doc, sz0Records, root, PW, ML, MR, dateStr, timeStr, title) {
  const approvedRecords = sz0Records.filter(r => r.status === 'A');
  if (!approvedRecords || approvedRecords.length === 0) return;

  const PH = doc.internal.pageSize.getHeight();
  const { y: titleY } = nextSectionStart(doc, PH, ML, MR, root, PW, dateStr, timeStr, title);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.lynxForest);
  doc.text(`RESTRIÇÕES DE ENGENHARIA APROVADAS (SZ0) — ${root.codigo}`, ML, titleY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.mutedText);
  doc.text(`Total de registros aprovados: ${approvedRecords.length}`, ML, titleY + 5);

  const sz0Rows = approvedRecords.map((r) => {
    const statusLabel = 'Aprovado';
    const dtFormatted = r.dt_ultima_alt ? r.dt_ultima_alt.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1') : '—';
    return {
      statusCode: r.status,
      data: [
        r.item || '—',
        statusLabel,
        r.resumo || '—',
        r.restricao || '—',
        r.revisao || '—',
        r.responsavel || '—',
        `${dtFormatted} ${r.hr_ultima_alt || ''}`.trim()
      ]
    };
  });

  autoTable(doc, {
    startY: titleY + 10,
    head: [['ITEM', 'STATUS', 'RESUMO', 'DESCRIÇÃO DA RESTRIÇÃO', 'REVISÃO', 'RESPONSÁVEL', 'ÚLT. ALTERAÇÃO']],
    body: sz0Rows.map(r => r.data),
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.5, textColor: C.darkText, font: 'helvetica' },
    headStyles: { fillColor: C.lynxForest, textColor: C.white, fontStyle: 'bold', fontSize: 7, font: 'helvetica' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 15 },
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'left', cellWidth: 45 },
      3: { halign: 'left', overflow: 'linebreak' },
      4: { halign: 'center', cellWidth: 15 },
      5: { halign: 'left', cellWidth: 40 },
      6: { halign: 'center', cellWidth: 30 }
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) drawPageHeader(doc, root, PW, ML, MR, dateStr, timeStr, title);
    },
    margin: { left: ML, right: MR, top: 43, bottom: 14 },
  });
}

// ─── Exportação principal ─────────────────────────────────────────────────────
export const generateEstruturaReport = async (structure, routesMap, options = {}) => {
  if (!structure || structure.length === 0) return;

  // Garante que o perfil e branding da empresa ativa estejam carregados
  try {
    await loadCompanyBranding();
  } catch (e) {
    console.warn('[PDF] Falha ao carregar branding da empresa:', e);
  }

  const { 
    title = 'RELAÇÃO SIMPLIFICADA DAS ESTRUTURAS — MATR225Cus', 
    footerTitle = 'Relação Simplificada das Estruturas', 
    isNivel1 = false, 
    includeSubLevelRestrictions = false,
    sz0Records = [],
    productStatuses = {},
    carimbo = null,
    returnBytes = false
  } = options;

  const doc     = new jsPDF('landscape', 'mm', 'a4');
  const PW      = doc.internal.pageSize.getWidth();
  const PH      = doc.internal.pageSize.getHeight();
  const ML      = 10;
  const MR      = 10;
  const dateStr = fmtDate();
  const timeStr = fmtTime();
  const root    = structure[0] || {};

  if (isNivel1) {
    const nivel1Items = structure.filter((i) => i.nivel === 1);
    drawPageHeader(doc, root, PW, ML, MR, dateStr, timeStr, title);

    let seq = 1;
    const matRows = nivel1Items.map((item) => {
      const refs = item.referencias && item.referencias.length > 0 ? item.referencias : [];
      const desenhoRef = refs.map((r) => r.desenho).filter(Boolean).join(' / ') || '—';
      return {
        nivel: item.nivel,
        isRestricted: item.is_restricted,
        data: [
          String(seq++).padStart(3, '0'),
          (item.tipo_produto || 'MP').toUpperCase().trim(),
          item.codigo || '—',
          item.descricao || '—',
          fmtQtd(item.qtd_necessaria),
          item.unidade || '—',
          item.rev_metalfisa || item.revisao || '00',
          desenhoRef,
          item.is_restricted ? 'R' : '',
          productStatuses[(item.codigo || '').trim()] || 'NORMAL'
        ],
      };
    });

    autoTable(doc, {
      startY: 43,
      head: [['ITEM', 'TP', 'CÓDIGO', 'DESCRIÇÃO', 'QTDE. NECESSÁRIA', 'UM', 'REVISÃO', 'DESENHO / REF.', 'RESTR.', 'STATUS ENG.']],
      body: matRows.map((r) => r.data),
      theme: 'grid',
      styles:     { fontSize: 7, cellPadding: 1.4, textColor: C.darkText, font: 'helvetica' },
      headStyles: { fillColor: C.lynxForest, textColor: C.white, fontStyle: 'bold', fontSize: 7, font: 'helvetica' },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },
        1: { halign: 'center', cellWidth: 10 },
        2: { halign: 'left',   cellWidth: 36 },
        3: { halign: 'left',   overflow: 'linebreak' },
        4: { halign: 'right',  cellWidth: 26 },
        5: { halign: 'center', cellWidth: 12 },
        6: { halign: 'center', cellWidth: 18 },
        7: { halign: 'left',   cellWidth: 32 },
        8: { halign: 'center', cellWidth: 14 },
        9: { halign: 'center', cellWidth: 22 },
      },
      didParseCell: (data) => {
        if (data.section !== 'body') return;
        const row = matRows[data.row.index];
        if (!row) return;
        data.cell.styles.fillColor = C.lynxLight;
        data.cell.styles.textColor = C.darkText;
        if (data.column.index === 8 && data.cell.raw === 'R') {
          data.cell.styles.textColor = C.red;
          data.cell.styles.fontStyle = 'bold';
        }
      },
      didDrawPage: (data) => {
        if (data.pageNumber > 1) drawPageHeader(doc, root, PW, ML, MR, dateStr, timeStr, title);
      },
      margin: { left: ML, right: MR, top: 43, bottom: 14 },
    });

    const rootOps = routesMap[(root.codigo || '').trim()] || [];
    if (rootOps.length > 0) {
      const { y: opTitleY } = nextSectionStart(doc, PH, ML, MR, root, PW, dateStr, timeStr, title);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...C.lynxForest);
      doc.text('OPERAÇÕES DE FABRICAÇÃO — PRODUTO PAI', ML, opTitleY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...C.mutedText);
      doc.text(`Roteiro de fabricação de ${root.codigo} — ${root.descricao || ''}`, ML, opTitleY + 5);

      const opRows = rootOps.map((op, idx) => [
        String(idx + 1).padStart(3, '0'),
        op.operacao || '—',
        (op.descricao || '').trim(),
        op.tempo_padrao ? parseFloat(op.tempo_padrao).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '0',
        (op.recurso || '').trim(),
        (op.departamento || '').trim(),
        (op.ferramenta || '').trim(),
      ]);

      autoTable(doc, {
        startY: opTitleY + 12,
        head: [['SEQ', 'OPERAÇÃO', 'DESCRIÇÃO DA OPERAÇÃO', 'TEMPO PADRÃO (MIN)', 'RECURSO', 'DEPARTAMENTO', 'FERRAMENTA']],
        body: opRows,
        theme: 'grid',
        styles:     { fontSize: 7, cellPadding: 1.5, textColor: C.darkText, font: 'helvetica' },
        headStyles: { fillColor: C.lynxDark, textColor: C.white, fontStyle: 'bold', fontSize: 7, font: 'helvetica' },
        columnStyles: {
          0: { halign: 'center', cellWidth: 14 },
          1: { halign: 'center', cellWidth: 22 },
          2: { halign: 'left',   overflow: 'linebreak' },
          3: { halign: 'right',  cellWidth: 30 },
          4: { halign: 'center', cellWidth: 28 },
          5: { halign: 'center', cellWidth: 28 },
          6: { halign: 'left',   cellWidth: 36 },
        },
        didParseCell: (data) => {
          if (data.section !== 'body') return;
          data.cell.styles.fillColor = C.opRow;
          data.cell.styles.textColor = C.opText;
          if (data.column.index === 1) { data.cell.styles.fontStyle = 'bold'; data.cell.styles.textColor = C.lynxForest; }
          if (data.column.index === 0) { data.cell.styles.fontStyle = 'bold'; }
        },
        didDrawPage: (data) => {
          if (data.pageNumber > 1) drawPageHeader(doc, root, PW, ML, MR, dateStr, timeStr, title);
        },
        margin: { left: ML, right: MR, top: 43, bottom: 14 },
      });
    }

    const rootRefs = root.referencias && root.referencias.length > 0 ? root.referencias : [];
    if (rootRefs.length > 0) {
      const { y: sz1TitleY } = nextSectionStart(doc, PH, ML, MR, root, PW, dateStr, timeStr, title);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...C.lynxForest);
      doc.text('REFERÊNCIAS TÉCNICAS E DESENHOS DE ENGENHARIA', ML, sz1TitleY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...C.mutedText);
      doc.text(`${rootRefs.length} referência(s) registrada(s) para o produto ${root.codigo}`, ML, sz1TitleY + 5);

      let seqSz = 1;
      const sz1Rows = rootRefs.map((r) => [
        String(seqSz++).padStart(3, '0'),
        r.desenho || '—',
        r.revisao || r.rev_cliente || '00',
        root.codigo || '—',
        root.descricao || '—',
        dateStr,
      ]);

      autoTable(doc, {
        startY: sz1TitleY + 12,
        head: [['#', 'DESENHO / REF. TÉCNICA', 'REVISÃO', 'CÓDIGO INTERNO', 'DESCRIÇÃO', 'DATA EMISSÃO']],
        body: sz1Rows,
        theme: 'grid',
        styles:     { fontSize: 7, cellPadding: 1.5, textColor: C.darkText, font: 'helvetica' },
        headStyles: { fillColor: C.lynxForest, textColor: C.white, fontStyle: 'bold', fontSize: 7, font: 'helvetica' },
        columnStyles: {
          0: { halign: 'center', cellWidth: 12 },
          1: { halign: 'left',   cellWidth: 50 },
          2: { halign: 'center', cellWidth: 20 },
          3: { halign: 'left',   cellWidth: 40 },
          4: { halign: 'left',   overflow: 'linebreak' },
          5: { halign: 'center', cellWidth: 25 },
        },
        didParseCell: (data) => {
          if (data.section !== 'body') return;
          data.cell.styles.fillColor = data.row.index % 2 === 0 ? C.white : C.altRow;
          if (data.column.index === 1) { data.cell.styles.fontStyle = 'bold'; data.cell.styles.textColor = C.lynxDark; }
          if (data.column.index === 2) { data.cell.styles.fontStyle = 'bold'; }
        },
        didDrawPage: (data) => {
          if (data.pageNumber > 1) drawPageHeader(doc, root, PW, ML, MR, dateStr, timeStr, title);
        },
        margin: { left: ML, right: MR, top: 43, bottom: 14 },
      });
    }

    if (sz0Records && sz0Records.length > 0) {
      drawSZ0DetailsTable(doc, sz0Records, root, PW, ML, MR, dateStr, timeStr, title);
    }

    const restrictionLevelFilter = includeSubLevelRestrictions ? null : 0;
    drawRestrictionsTable(doc, structure, root, PW, ML, MR, dateStr, timeStr, title, restrictionLevelFilter);
  } else {
    // MODO COMPLETO
    drawPageHeader(doc, root, PW, ML, MR, dateStr, timeStr, title);
    const allRows = [];
    let seq = 1;
    structure.forEach((item) => {
      const nivel = item.nivel || 0;
      const nivelStr = String(nivel).padStart(2, '0');
      const indent = '  '.repeat(nivel);
      const refs = item.referencias && item.referencias.length > 0 ? item.referencias : [];
      const desenhoRef = refs.map((r) => r.desenho).filter(Boolean).join(' / ') || '—';
      allRows.push({
        type: 'component',
        nivel,
        data: [
          String(seq++).padStart(3, '0'),
          (item.tipo_produto || 'MP').toUpperCase().trim(),
          nivelStr,
          indent + (item.codigo || '—'),
          indent + (item.descricao || '—'),
          fmtQtd(item.qtd_necessaria),
          item.unidade || '—',
          item.rev_metalfisa || item.revisao || '00',
          desenhoRef,
          item.is_restricted ? 'R' : '',
          productStatuses[(item.codigo || '').trim()] || 'NORMAL'
        ],
      });
      const k = (item.codigo || '').trim();
      const ops = routesMap[k] || [];
      ops.forEach((op) => {
        allRows.push({
          type: 'operation',
          nivel,
          data: [
            String(seq++).padStart(3, '0'), 
            'PR', 
            nivelStr + '+', 
            indent + '  ' + (op.operacao || '—'), 
            indent + '  ' + (op.descricao || '—').trim(), 
            op.tempo_padrao ? parseFloat(op.tempo_padrao).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '0', 
            'MIN', 
            (op.recurso || '').trim(), 
            (op.departamento || '').trim(), 
            '', 
            ''
          ],
        });
      });
    });

    autoTable(doc, {
      startY: 43,
      head: [['ITEM', 'TP', 'NÍVEL', 'CÓDIGO', 'DESCRIÇÃO', 'QTDE. NECESSÁRIA', 'UM', 'REVISÃO', 'DESENHO / REF.', 'RESTR.', 'STATUS ENG.']],
      body: allRows.map((r) => r.data),
      theme: 'grid',
      styles:     { fontSize: 7, cellPadding: 1.4, textColor: C.darkText, font: 'helvetica' },
      headStyles: { fillColor: C.lynxForest, textColor: C.white, fontStyle: 'bold', fontSize: 7, font: 'helvetica' },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },
        1: { halign: 'center', cellWidth: 10 },
        2: { halign: 'center', cellWidth: 12 },
        3: { halign: 'left',   cellWidth: 34 },
        4: { halign: 'left',   overflow: 'linebreak' },
        5: { halign: 'right',  cellWidth: 26 },
        6: { halign: 'center', cellWidth: 12 },
        7: { halign: 'center', cellWidth: 18 },
        8: { halign: 'left',   cellWidth: 30 },
        9: { halign: 'center', cellWidth: 14 },
        10: { halign: 'center', cellWidth: 22 },
      },
      didParseCell: (data) => {
        if (data.section !== 'body') return;
        const row = allRows[data.row.index];
        if (!row) return;
        if (row.type === 'operation') {
          data.cell.styles.fillColor = C.opRow;
          data.cell.styles.textColor = C.opText;
          data.cell.styles.fontStyle = 'italic';
          data.cell.styles.fontSize = 6.5;
        } else {
          const s = rowStyle(row.nivel);
          data.cell.styles.fillColor = s.fill;
          data.cell.styles.textColor = s.text;
          if (s.bold) data.cell.styles.fontStyle = 'bold';
        }
      },
      didDrawPage: (data) => {
        if (data.pageNumber > 1) drawPageHeader(doc, root, PW, ML, MR, dateStr, timeStr, title);
      },
      margin: { left: ML, right: MR, top: 43, bottom: 14 },
    });

    if (options.sz0Records && options.sz0Records.length > 0) {
      drawSZ0DetailsTable(doc, options.sz0Records, root, PW, ML, MR, dateStr, timeStr, title);
    }

    drawRestrictionsTable(doc, structure, root, PW, ML, MR, dateStr, timeStr, title, null);
  }

  // Draw footer and stamp on all doc pages
  const totalPtPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPtPages; i++) {
    drawFooter(doc, i, totalPtPages, PW, ML, MR, PH, dateStr, timeStr, footerTitle);
    if (carimbo && carimbo.ativo) {
      doc.setPage(i);
      drawStamp(doc, carimbo, PW, PH, MR);
    }
  }

  const fichaPdfBytes = doc.output('arraybuffer');
  let finalPdfBytes = fichaPdfBytes;

  // Merge external drawings ONLY if explicitly requested via options.includeDrawings
  if (options.includeDrawings) {
    try {
      const mergedDoc = await PDFDocument.create();
      const fichaDoc = await PDFDocument.load(fichaPdfBytes);
      const font = await mergedDoc.embedFont(StandardFonts.HelveticaBold);

      // Merge logic
      let targetDocs = [];
      if (root && root.codigo) {
        try {
          const resp = await api.get(`/docs/${encodeURIComponent(root.codigo.trim())}`);
          const productDocs = resp.data || [];
          targetDocs = productDocs
            .filter(d => ['Desenho', 'Gabarito'].includes(d.tipo))
            .sort((a, b) => {
              if (a.tipo === 'Desenho' && b.tipo !== 'Desenho') return -1;
              if (a.tipo !== 'Desenho' && b.tipo === 'Desenho') return 1;
              if (a.tipo === 'Gabarito' && b.tipo !== 'Gabarito') return -1;
              if (a.tipo !== 'Gabarito' && b.tipo === 'Gabarito') return 1;
              return 0;
            });
        } catch (e) {
          console.warn('Falha ao buscar lista de documentos do produto', e);
        }
      }

      if (isNivel1) {
        const fichaPages = await mergedDoc.copyPages(fichaDoc, fichaDoc.getPageIndices());
        fichaPages.forEach(p => mergedDoc.addPage(p));
        
        for (const docObj of targetDocs) {
          try {
            const resp = await api.get('/docs/view', { params: { path: docObj.url_arquivo }, responseType: 'arraybuffer' });
            const drawDoc = await PDFDocument.load(resp.data);
            const drawPages = await mergedDoc.copyPages(drawDoc, drawDoc.getPageIndices());
            drawPages.forEach(p => mergedDoc.addPage(p));
          } catch (e) { console.warn(`Falha no documento ${docObj.tipo}`, e); }
        }
      } else {
        for (const docObj of targetDocs) {
          try {
            const resp = await api.get('/docs/view', { params: { path: docObj.url_arquivo }, responseType: 'arraybuffer' });
            const drawDoc = await PDFDocument.load(resp.data);
            const drawPages = await mergedDoc.copyPages(drawDoc, drawDoc.getPageIndices());
            drawPages.forEach(p => mergedDoc.addPage(p));
          } catch (e) { console.warn(`Falha no documento ${docObj.tipo}`, e); }
        }
        const fichaPages = await mergedDoc.copyPages(fichaDoc, fichaDoc.getPageIndices());
        fichaPages.forEach(p => mergedDoc.addPage(p));
      }

      // Overlay code on ALL pages
      if (carimbo && carimbo.codigo_liberacao) {
        const codeText = `Liberação nº: ${carimbo.codigo_liberacao}`;
        const pages = mergedDoc.getPages();
        pages.forEach(page => {
          const { width, height } = page.getSize();
          page.drawText(codeText, {
            x: width - 180,
            y: 15,
            size: 10,
            font,
            color: rgb(0.86, 0.15, 0.15),
          });
        });
      }
      finalPdfBytes = await mergedDoc.save();
    } catch (err) {
      console.error('Erro merge/overlay:', err);
    }
  } else if (carimbo && carimbo.codigo_liberacao) {
    // Aplica o carimbo de liberação apenas nas páginas da própria estrutura (sem anexar PDFs externos)
    try {
      const mergedDoc = await PDFDocument.load(fichaPdfBytes);
      const font = await mergedDoc.embedFont(StandardFonts.HelveticaBold);
      const codeText = `Liberação nº: ${carimbo.codigo_liberacao}`;
      const pages = mergedDoc.getPages();
      pages.forEach(page => {
        const { width, height } = page.getSize();
        page.drawText(codeText, {
          x: width - 180,
          y: 15,
          size: 10,
          font,
          color: rgb(0.86, 0.15, 0.15),
        });
      });
      finalPdfBytes = await mergedDoc.save();
    } catch (err) {
      console.error('Erro overlay carimbo na ficha:', err);
    }
  }

  const fileName = `${isNivel1 ? 'EstruturaN1' : 'Estrutura'}_${(root.codigo || 'produto').trim()}_${dateStr.replace(/\//g, '-')}.pdf`;
  if (returnBytes) return { bytes: finalPdfBytes, fileName };

  const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
