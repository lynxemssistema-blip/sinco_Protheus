import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PDFDocument } from 'pdf-lib';
import api from './api';

// ─── Paleta ──────────────────────────────────────────────────────────────────
const C = {
  darkBlue:  [30,  64, 120],
  lightBlue: [219, 234, 254],
  lightGray: [243, 244, 246],
  altRow:    [249, 250, 251],
  white:     [255, 255, 255],
  darkText:  [30,  41,  59],
  midText:   [71,  85, 105],
  mutedText: [148, 163, 184],
  border:    [203, 213, 225],
  red:       [220,  38,  38],
  green:     [22,  163,  74],
  amber:     [217, 119,   6],
  midBlue:   [59,  130, 246],
  opRow:     [255, 248, 220],
  opText:    [110,  70,  10],
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
    case 0:  return { fill: C.darkBlue,  text: C.white,    bold: true };
    case 1:  return { fill: C.lightBlue, text: C.darkText, bold: false };
    case 2:  return { fill: C.lightGray, text: C.darkText, bold: false };
    default: return { fill: C.white,     text: C.darkText, bold: false };
  }
};

// ─── Cabeçalho (todas as páginas) — landscape ────────────────────────────────
function drawPageHeader(doc, root, PW, ML, MR, dateStr, timeStr, customTitle = 'RELAÇÃO SIMPLIFICADA DAS ESTRUTURAS — MATR225Cus') {
  const MW = PW - ML - MR;

  // Barra azul
  doc.setFillColor(...C.darkBlue);
  doc.rect(ML, 8, MW, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...C.white);
  doc.text('METALFISA', ML + 4, 14);
  doc.text(customTitle, PW / 2, 14, { align: 'center' });

  // Caixa de dados do produto — 4 seções
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.rect(ML, 18, MW, 16);
  const col = MW / 4;
  [1, 2, 3].forEach((n) => doc.line(ML + col * n, 18, ML + col * n, 34));

  doc.setFontSize(7.5);
  const field = (x, y, label, value, maxChars = 34) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.midText);
    doc.text(label, x, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.darkText);
    const v = String(value || '—');
    doc.text(v.length > maxChars ? v.substring(0, maxChars) + '…' : v, x, y + 4);
  };

  const p = 3;
  field(ML + p,           21, 'Código', root.codigo, 34);
  field(ML + col + p,     21, 'Descrição', root.descricao, 38);
  field(ML + col * 2 + p, 21, 'Tipo', tipoLabel(root.tipo_produto), 32);
  field(ML + col * 3 + p, 21, 'Revisão MF', root.rev_metalfisa, 20);

  doc.setFillColor(...C.lightGray);
  doc.rect(ML, 34, MW, 5.5, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.mutedText);
  doc.text(`SIGA/MATR225Cus/v.12   ·   Grupo: GRUPO METALFISA / Filial: METALFISA MATRIZ   ·   Emissão: ${dateStr}  ${timeStr}`, ML + 3, 38.2);
}

// ─── Rodapé ───────────────────────────────────────────────────────────────────
function drawFooter(doc, pageNum, totalPages, PW, ML, MR, PH, dateStr, timeStr, customTitle = 'Relação Simplificada das Estruturas') {
  doc.setPage(pageNum);
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.line(ML, PH - 12, PW - MR, PH - 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.mutedText);
  doc.text(`MetalFisa  ·  MATR225Cus — ${customTitle}`, ML, PH - 8);
  doc.text(`Emitido: ${dateStr}  ${timeStr}`, PW / 2, PH - 8, { align: 'center' });
  doc.text(`Folha ${pageNum} de ${totalPages}`, PW - MR, PH - 8, { align: 'right' });
}

// ─── Helper: carimbo de liberação (desenhado em cada página) ─────────────────
function drawStamp(doc, carimbo, PW, PH, MR) {
  if (!carimbo || !carimbo.ativo) return;

  const W  = 95;
  const H  = carimbo.pedido ? 26 : 22;
  const x  = PW - MR - W;
  const y  = PH - 14 - H;

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
  doc.setFontSize(14);          // ≈ 5mm
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
    doc.text(pedStr, x + 4, y + 22.5);
  }
}

// ─── Helper: próximo Y ou nova página ────────────────────────────────────────
function nextSectionStart(doc, PH, ML, MR, root, PW, dateStr, timeStr, title, minSpace = 55) {
  const lastY = doc.lastAutoTable ? doc.lastAutoTable.finalY : null;
  if (lastY && (PH - 15 - lastY) >= minSpace) {
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
  doc.setTextColor(...C.darkBlue);
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
    const codCli = refs.length > 0
      ? refs.map((r) => [r.desenho, r.rev_cliente || r.revisao].filter(Boolean).join(' Rv:')).filter(Boolean).join(' / ')
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
        item.rev_metalfisa || '—',
        codCli,
        fontes.join('\n') || '—',
        'Ativo',
        dateStr,
      ],
    };
  });

  autoTable(doc, {
    startY: titleY + 14,
    head: [['#', 'Nív', 'TP', 'Código', 'Descrição', 'Rv MF', 'Cod Prod Cliente', 'Origem da Restrição', 'Status', 'Data Emissão']],
    body: restricRows.map((r) => r.data),
    theme: 'grid',
    styles:     { fontSize: 7, cellPadding: 1.5, textColor: C.darkText, font: 'courier' },
    headStyles: { fillColor: C.darkBlue, textColor: C.white, fontStyle: 'bold', fontSize: 7, font: 'helvetica' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      1: { halign: 'center', cellWidth: 10 },
      2: { halign: 'center', cellWidth: 10 },
      3: { halign: 'left',   cellWidth: 32 },
      4: { halign: 'left',   overflow: 'linebreak' },
      5: { halign: 'center', cellWidth: 14 },
      6: { halign: 'left',   cellWidth: 32 },
      7: { halign: 'left',   overflow: 'linebreak', cellWidth: 55 },
      8: { halign: 'center', cellWidth: 16 },
      9: { halign: 'center', cellWidth: 22 },
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
      if (data.column.index === 8) {
        data.cell.styles.textColor = C.red;
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.font      = 'helvetica';
      }
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) drawPageHeader(doc, root, PW, ML, MR, dateStr, timeStr, title);
    },
    margin: { left: ML, right: MR, top: 40, bottom: 15 },
  });
}

// ─── Exportação principal ─────────────────────────────────────────────────────
export const generateEstruturaReport = async (structure, routesMap, options = {}) => {
  if (!structure || structure.length === 0) return;

  const title      = options.title      || 'RELAÇÃO SIMPLIFICADA DAS ESTRUTURAS — MATR225Cus';
  const footerTitle = options.footerTitle || 'Relação Simplificada das Estruturas';
  const isNivel1   = options.isNivel1 === true;
  const carimbo    = options.carimbo   || null;   // { ativo, data, usuario, pedido, item }
  const returnBytes = options.returnBytes === true;

  const doc     = new jsPDF('landscape', 'mm', 'a4');
  const PW      = doc.internal.pageSize.getWidth();
  const PH      = doc.internal.pageSize.getHeight();
  const ML      = 10;
  const MR      = 10;
  const dateStr = fmtDate();
  const timeStr = fmtTime();
  const root    = structure[0] || {};

  // ══════════════════════════════════════════════════════════════════════════
  // MODO NÍVEL 1 — nova sequência: materiais → ops pai → fichas N1 → restrições → desenho
  // ══════════════════════════════════════════════════════════════════════════
  if (isNivel1) {
    const nivel1Items = structure.filter((i) => i.nivel === 1);

    // ── Seção 1+2: Cabeçalho (produto pai) + Tabela de Materiais ─────────────
    drawPageHeader(doc, root, PW, ML, MR, dateStr, timeStr, title);

    let seq = 1;
    const matRows = nivel1Items.map((item) => {
      const codCli = item.referencias && item.referencias.length > 0
        ? item.referencias.map((r) => r.desenho).filter(Boolean).join(' / ')
        : '';
      const revCli = item.referencias && item.referencias.length > 0
        ? (item.referencias[0].rev_cliente || item.referencias[0].revisao || '')
        : '';
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
          item.rev_metalfisa || '',
          codCli,
          revCli,
          item.is_restricted ? 'R' : '',
        ],
      };
    });

    autoTable(doc, {
      startY: 41,
      head: [['ITEM', 'TP', 'CÓDIGO', 'DESCRIÇÃO', 'QTDE.NECESSÁRIA', 'UM', 'Rv MF', 'Cód Prod Cliente', 'Rv Cliente', 'Restr.']],
      body: matRows.map((r) => r.data),
      theme: 'grid',
      styles:     { fontSize: 7, cellPadding: 1.4, textColor: C.darkText, font: 'courier' },
      headStyles: { fillColor: C.darkBlue, textColor: C.white, fontStyle: 'bold', fontSize: 7, font: 'helvetica' },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },
        1: { halign: 'center', cellWidth: 10 },
        2: { halign: 'left',   cellWidth: 34 },
        3: { halign: 'left',   overflow: 'linebreak' },
        4: { halign: 'right',  cellWidth: 26 },
        5: { halign: 'center', cellWidth: 12 },
        6: { halign: 'center', cellWidth: 18 },
        7: { halign: 'left',   cellWidth: 32 },
        8: { halign: 'center', cellWidth: 16 },
        9: { halign: 'center', cellWidth: 14 },
      },
      didParseCell: (data) => {
        if (data.section !== 'body') return;
        const row = matRows[data.row.index];
        if (!row) return;
        data.cell.styles.fillColor = C.lightBlue;
        data.cell.styles.textColor = C.darkText;
        if (data.column.index === 9 && data.cell.raw === 'R') {
          data.cell.styles.textColor = C.red;
          data.cell.styles.fontStyle = 'bold';
        }
      },
      didDrawPage: (data) => {
        if (data.pageNumber > 1) drawPageHeader(doc, root, PW, ML, MR, dateStr, timeStr, title);
      },
      margin: { left: ML, right: MR, top: 40, bottom: 15 },
    });

    // ── Seção 3: Operações do Produto Pai ────────────────────────────────────
    const rootOps = routesMap[(root.codigo || '').trim()] || [];
    if (rootOps.length > 0) {
      const { y: opTitleY } = nextSectionStart(doc, PH, ML, MR, root, PW, dateStr, timeStr, title);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...C.darkBlue);
      doc.text('OPERAÇÕES DE FABRICAÇÃO — PRODUTO PAI', ML, opTitleY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...C.mutedText);
      doc.text(`Roteiro de fabricação de ${root.codigo} — ${root.descricao || ''}`, ML, opTitleY + 5);

      const opRows = rootOps.map((op, idx) => [
        String(idx + 1).padStart(3, '0'),
        op.operacao || '—',
        (op.descricao || '').trim(),
        op.tempo_padrao
          ? parseFloat(op.tempo_padrao).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
          : '0',
        (op.recurso || '').trim(),
        (op.departamento || '').trim(),
        (op.ferramenta || '').trim(),
      ]);

      autoTable(doc, {
        startY: opTitleY + 14,
        head: [['SEQ', 'OPERAÇÃO', 'DESCRIÇÃO DA OPERAÇÃO', 'TEMPO PADRÃO (MIN)', 'RECURSO', 'DEPARTAMENTO', 'FERRAMENTA']],
        body: opRows,
        theme: 'grid',
        styles:     { fontSize: 7, cellPadding: 1.5, textColor: C.darkText, font: 'courier' },
        headStyles: { fillColor: C.darkBlue, textColor: C.white, fontStyle: 'bold', fontSize: 7, font: 'helvetica' },
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
          if (data.column.index === 1) { data.cell.styles.fontStyle = 'bold'; data.cell.styles.textColor = C.midBlue; }
          if (data.column.index === 0) { data.cell.styles.fontStyle = 'bold'; }
        },
        didDrawPage: (data) => {
          if (data.pageNumber > 1) drawPageHeader(doc, root, PW, ML, MR, dateStr, timeStr, title);
        },
        margin: { left: ML, right: MR, top: 40, bottom: 15 },
      });
    }

    // ── Seção 4: Histórico de Referências do Produto Pai (SZ1) ───────────────
    const rootRefs = root.referencias && root.referencias.length > 0 ? root.referencias : [];
    if (rootRefs.length > 0) {
      const { y: sz1TitleY } = nextSectionStart(doc, PH, ML, MR, root, PW, dateStr, timeStr, title);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...C.darkBlue);
      doc.text('REFERÊNCIAS DO PRODUTO PAI — HISTÓRICO SZ1', ML, sz1TitleY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...C.mutedText);
      doc.text(`${rootRefs.length} referência(s) registrada(s) para o produto ${root.codigo}`, ML, sz1TitleY + 5);

      let seqSz = 1;
      const sz1Rows = rootRefs.map((r) => [
        String(seqSz++).padStart(3, '0'),
        r.desenho || '—',
        r.cliente || '—',
        r.rev_cliente || r.revisao || '—',
        root.rev_metalfisa || '—',
        root.codigo || '—',
        root.descricao || '—',
        dateStr,
      ]);

      autoTable(doc, {
        startY: sz1TitleY + 14,
        head: [['#', 'Cód. Produto Cliente', 'Cliente', 'Rv Cliente', 'Rv MF', 'Código MF', 'Descrição', 'Emissão']],
        body: sz1Rows,
        theme: 'grid',
        styles:     { fontSize: 7, cellPadding: 1.5, textColor: C.darkText, font: 'courier' },
        headStyles: { fillColor: C.darkBlue, textColor: C.white, fontStyle: 'bold', fontSize: 7, font: 'helvetica' },
        columnStyles: {
          0: { halign: 'center', cellWidth: 12 },
          1: { halign: 'left',   cellWidth: 48 },
          2: { halign: 'left',   overflow: 'linebreak' },
          3: { halign: 'center', cellWidth: 20 },
          4: { halign: 'center', cellWidth: 20 },
          5: { halign: 'left',   cellWidth: 36 },
          6: { halign: 'left',   overflow: 'linebreak', cellWidth: 60 },
          7: { halign: 'center', cellWidth: 22 },
        },
        didParseCell: (data) => {
          if (data.section !== 'body') return;
          data.cell.styles.fillColor = data.row.index % 2 === 0 ? C.white : C.altRow;
          if (data.column.index === 1) { data.cell.styles.fontStyle = 'bold'; data.cell.styles.textColor = C.midBlue; }
          if (data.column.index === 3) { data.cell.styles.fontStyle = 'bold'; }
        },
        didDrawPage: (data) => {
          if (data.pageNumber > 1) drawPageHeader(doc, root, PW, ML, MR, dateStr, timeStr, title);
        },
        margin: { left: ML, right: MR, top: 40, bottom: 15 },
      });
    }

    // ── Seção 5: Restrições (nível 0 e 1) ────────────────────────────────────
    drawRestrictionsTable(doc, structure, root, PW, ML, MR, dateStr, timeStr, title, 1);

    // ── Rodapés + Carimbo (todas as páginas) ─────────────────────────────────
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      drawFooter(doc, i, totalPages, PW, ML, MR, PH, dateStr, timeStr, footerTitle);
      if (carimbo && carimbo.ativo) {
        doc.setPage(i);
        drawStamp(doc, carimbo, PW, PH, MR);
      }
    }

    // ── Seção 6: Desenho de conjunto do produto pai (ao final) ────────────────
    const fichaPdfBytes = doc.output('arraybuffer');
    let finalPdfBytes   = fichaPdfBytes;

    if (root.tem_arquivos && root.primeiro_arquivo) {
      try {
        const resp = await api.get('/docs/view', {
          params: { path: root.primeiro_arquivo }, responseType: 'arraybuffer',
        });
        const mergedDoc    = await PDFDocument.create();
        const fichaDoc     = await PDFDocument.load(fichaPdfBytes);
        const drawingDoc   = await PDFDocument.load(resp.data);
        const fichaPages   = await mergedDoc.copyPages(fichaDoc,   fichaDoc.getPageIndices());
        const drawingPages = await mergedDoc.copyPages(drawingDoc, drawingDoc.getPageIndices());
        fichaPages.forEach((p)   => mergedDoc.addPage(p));
        drawingPages.forEach((p) => mergedDoc.addPage(p));
        finalPdfBytes = await mergedDoc.save();
      } catch (err) {
        console.warn('Não foi possível anexar o desenho do produto pai.', err);
      }
    }

    const fileName = `EstruturaN1_${(root.codigo || 'produto').trim()}_${dateStr.replace(/\//g, '-')}.pdf`;

    if (returnBytes) {
      return { bytes: finalPdfBytes, fileName };
    }

    const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href  = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MODO COMPLETO (não-Nível1) — lógica original inalterada
  // ══════════════════════════════════════════════════════════════════════════
  drawPageHeader(doc, root, PW, ML, MR, dateStr, timeStr, title);

  const allRows = [];
  let seq = 1;

  structure.forEach((item) => {
    const nivel    = item.nivel || 0;
    const nivelStr = String(nivel).padStart(2, '0');
    const indent   = '  '.repeat(nivel);

    const codCli = item.referencias && item.referencias.length > 0
      ? item.referencias.map((r) => r.desenho).filter(Boolean).join(' / ')
      : '';
    const revCli = item.referencias && item.referencias.length > 0
      ? (item.referencias[0].rev_cliente || item.referencias[0].revisao || '')
      : '';

    allRows.push({
      type:  'component',
      nivel,
      data: [
        String(seq).padStart(3, '0'),
        (item.tipo_produto || 'MP').toUpperCase().trim(),
        nivelStr,
        indent + (item.codigo || '—'),
        indent + (item.descricao || '—'),
        fmtQtd(item.qtd_necessaria),
        item.unidade || '—',
        item.rev_metalfisa || '',
        codCli,
        revCli,
        item.is_restricted ? 'R' : '',
      ],
    });
    seq++;

    const k   = (item.codigo || '').trim();
    const ops = routesMap[k] || [];
    ops.forEach((op) => {
      allRows.push({
        type:  'operation',
        nivel,
        data: [
          String(seq++).padStart(3, '0'),
          'PR',
          nivelStr + '+',
          indent + '  ' + (op.operacao || '—'),
          indent + '  ' + (op.descricao || '—').trim(),
          op.tempo_padrao
            ? parseFloat(op.tempo_padrao).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
            : '0',
          'MIN',
          (op.recurso || '').trim(),
          (op.departamento || '').trim(),
          '',
          '',
        ],
      });
    });
  });

  autoTable(doc, {
    startY: 41,
    head: [['ITEM', 'TP', 'NÍVEL', 'CÓDIGO', 'DESCRIÇÃO', 'QTDE.NECESSARIA', 'UM', 'Rv Metalfisa', 'Cod Prod Cliente', 'Rv Cliente', 'Restrição']],
    body: allRows.map((r) => r.data),
    theme: 'grid',
    styles:     { fontSize: 7, cellPadding: 1.4, textColor: C.darkText, font: 'courier' },
    headStyles: { fillColor: C.darkBlue, textColor: C.white, fontStyle: 'bold', fontSize: 7, font: 'helvetica' },
    columnStyles: {
      0:  { halign: 'center', cellWidth: 12 },
      1:  { halign: 'center', cellWidth: 10 },
      2:  { halign: 'center', cellWidth: 12 },
      3:  { halign: 'left',   cellWidth: 32 },
      4:  { halign: 'left',   overflow: 'linebreak' },
      5:  { halign: 'right',  cellWidth: 24 },
      6:  { halign: 'center', cellWidth: 12 },
      7:  { halign: 'center', cellWidth: 18 },
      8:  { halign: 'left',   cellWidth: 30 },
      9:  { halign: 'center', cellWidth: 16 },
      10: { halign: 'center', cellWidth: 16 },
    },
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      const row = allRows[data.row.index];
      if (!row) return;
      if (row.type === 'operation') {
        data.cell.styles.fillColor  = C.opRow;
        data.cell.styles.textColor  = C.opText;
        data.cell.styles.fontStyle  = 'italic';
        data.cell.styles.fontSize   = 6.5;
        if (data.column.index === 1) { data.cell.styles.fontStyle = 'bold'; data.cell.styles.textColor = C.amber; }
        if (data.column.index === 3) { data.cell.styles.fontStyle = 'bold'; data.cell.styles.textColor = C.midBlue; }
      } else {
        const s = rowStyle(row.nivel);
        data.cell.styles.fillColor = s.fill;
        data.cell.styles.textColor = s.text;
        if (s.bold) data.cell.styles.fontStyle = 'bold';
        if (row.nivel >= 3 && data.row.index % 2 === 1) data.cell.styles.fillColor = C.altRow;
        if (data.column.index === 10 && data.cell.raw === 'R') {
          data.cell.styles.textColor = C.red;
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) drawPageHeader(doc, root, PW, ML, MR, dateStr, timeStr, title);
    },
    margin: { left: ML, right: MR, top: 40, bottom: 15 },
  });

  drawRestrictionsTable(doc, structure, root, PW, ML, MR, dateStr, timeStr, title, null);

  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    drawFooter(doc, i, totalPages, PW, ML, MR, PH, dateStr, timeStr, footerTitle);
    if (carimbo && carimbo.ativo) {
      doc.setPage(i);
      drawStamp(doc, carimbo, PW, PH, MR);
    }
  }

  // Modo completo: Desenho primeiro → Tabela depois
  const fichaPdfBytes = doc.output('arraybuffer');
  let finalPdfBytes   = fichaPdfBytes;

  if (root.tem_arquivos && root.primeiro_arquivo) {
    try {
      const resp = await api.get('/docs/view', {
        params: { path: root.primeiro_arquivo }, responseType: 'arraybuffer',
      });
      const mergedDoc    = await PDFDocument.create();
      const drawingDoc   = await PDFDocument.load(resp.data);
      const fichaDoc     = await PDFDocument.load(fichaPdfBytes);
      const drawingPages = await mergedDoc.copyPages(drawingDoc, drawingDoc.getPageIndices());
      const fichaPages   = await mergedDoc.copyPages(fichaDoc,   fichaDoc.getPageIndices());
      drawingPages.forEach((p) => mergedDoc.addPage(p));
      fichaPages.forEach((p)   => mergedDoc.addPage(p));
      finalPdfBytes = await mergedDoc.save();
    } catch (err) {
      console.warn('Não foi possível anexar o desenho do produto pai.', err);
    }
  }

  const fileName = `Estrutura_${(root.codigo || 'produto').trim()}_${dateStr.replace(/\//g, '-')}.pdf`;

  if (returnBytes) {
    return { bytes: finalPdfBytes, fileName };
  }

  const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
  const link = document.createElement('a');
  link.href  = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
