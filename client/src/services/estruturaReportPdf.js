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
function drawPageHeader(doc, root, PW, ML, MR, dateStr, timeStr) {
  const MW = PW - ML - MR;

  // Barra azul
  doc.setFillColor(...C.darkBlue);
  doc.rect(ML, 8, MW, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...C.white);
  doc.text('METALFISA', ML + 4, 14);
  doc.text('RELAÇÃO SIMPLIFICADA DAS ESTRUTURAS — MATR225Cus', PW / 2, 14, { align: 'center' });

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
function drawFooter(doc, pageNum, totalPages, PW, ML, MR, PH, dateStr, timeStr) {
  doc.setPage(pageNum);
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.line(ML, PH - 12, PW - MR, PH - 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.mutedText);
  doc.text('MetalFisa  ·  MATR225Cus — Relação Simplificada das Estruturas', ML, PH - 8);
  doc.text(`Emitido: ${dateStr}  ${timeStr}`, PW / 2, PH - 8, { align: 'center' });
  doc.text(`Folha ${pageNum} de ${totalPages}`, PW - MR, PH - 8, { align: 'right' });
}

// ─── Exportação principal ─────────────────────────────────────────────────────
export const generateEstruturaReport = async (structure, routesMap) => {
  if (!structure || structure.length === 0) return;

  // A4 LANDSCAPE
  const doc     = new jsPDF('landscape', 'mm', 'a4');
  const PW      = doc.internal.pageSize.getWidth();   // 297
  const PH      = doc.internal.pageSize.getHeight();  // 210
  const ML      = 10;
  const MR      = 10;
  const dateStr = fmtDate();
  const timeStr = fmtTime();
  const root    = structure[0] || {};

  drawPageHeader(doc, root, PW, ML, MR, dateStr, timeStr);

  // ── Monta linhas: componentes + operações (PR) inline ──────────────────────
  // Colunas SIGA MATR225Cus:
  //  0: ITEM   1: TP   2: NÍVEL   3: CÓDIGO   4: DESCRIÇÃO
  //  5: QTDE.NECESSARIA   6: UM   7: Rv Metalfisa
  //  8: Cod Prod Cliente   9: Rv Cliente   10: Restrição

  const allRows = [];
  let seq = 1;

  structure.forEach((item) => {
    const nivel    = item.nivel || 0;
    const nivelStr = String(nivel).padStart(2, '0');
    const indent   = '  '.repeat(nivel);

    // Ref. cliente (primeiro desenho da lista de referências)
    const codCli = item.referencias && item.referencias.length > 0
      ? item.referencias.map((r) => r.desenho).filter(Boolean).join(' / ')
      : '';
    const revCli = item.referencias && item.referencias.length > 0
      ? (item.referencias[0].rev_cliente || item.referencias[0].revisao || '')
      : '';

    // Linha do componente
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

    // Operações do roteiro como linhas PR inline
    const k   = (item.codigo || '').trim();
    const ops = routesMap[k] || [];
    ops.forEach((op) => {
      allRows.push({
        type:  'operation',
        nivel,
        data: [
          String(seq).padStart(3, '0'),
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
      seq++;
    });
  });

  // ── Tabela ─────────────────────────────────────────────────────────────────
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
      4:  { halign: 'left',   overflow: 'linebreak' },   // flexível
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
        if (data.column.index === 1) {
          // "PR" em destaque
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = C.amber;
        }
        if (data.column.index === 3) {
          // código da operação
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = C.midBlue;
        }
      } else {
        // linha de componente
        const s = rowStyle(row.nivel);
        data.cell.styles.fillColor = s.fill;
        data.cell.styles.textColor = s.text;
        if (s.bold) data.cell.styles.fontStyle = 'bold';
        if (row.nivel >= 3 && data.row.index % 2 === 1) {
          data.cell.styles.fillColor = C.altRow;
        }
        if (data.column.index === 10 && data.cell.raw === 'R') {
          data.cell.styles.textColor = C.red;
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        drawPageHeader(doc, root, PW, ML, MR, dateStr, timeStr);
      }
    },
    margin: { left: ML, right: MR, top: 40, bottom: 15 },
  });

  // ════════════════════════════════════════════════════════════════════════════
  // PÁGINA FINAL — RESUMO DE RESTRIÇÕES
  // ════════════════════════════════════════════════════════════════════════════
  const itensCom = structure.filter((i) => i.is_restricted);

  if (itensCom.length > 0) {
    doc.addPage();
    drawPageHeader(doc, root, PW, ML, MR, dateStr, timeStr);

    // Título da seção
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...C.darkBlue);
    doc.text('RESUMO DE RESTRIÇÕES DA ESTRUTURA', ML, 44);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C.mutedText);
    doc.text(
      `Total de itens com restrição: ${itensCom.length} de ${structure.length} componentes`,
      ML, 49
    );

    // Legenda
    doc.setFillColor(...C.lightGray);
    doc.roundedRect(PW - MR - 100, 40, 100, 11, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...C.red);
    doc.text('■', PW - MR - 97, 45.5);
    doc.setTextColor(...C.darkText);
    doc.text('Bloqueio Cadastro (SB1)', PW - MR - 92, 45.5);
    doc.setTextColor(180, 60, 180);
    doc.text('■', PW - MR - 97, 49.5);
    doc.setTextColor(...C.darkText);
    doc.text('Restrição Engenharia (SZ0)', PW - MR - 92, 49.5);

    let seqR = 1;
    const restricRows = itensCom.map((item) => {
      const fontes = [];
      if (item.restri_sb1) fontes.push('Bloqueio Cadastro (SB1 = ' + item.restri_sb1 + ')');
      if (item.restri_sz0) fontes.push('Restrição Engenharia (SZ0 = P)');

      const codCli = item.referencias && item.referencias.length > 0
        ? item.referencias.map((r) => r.desenho).filter(Boolean).join(' / ')
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
      startY: 52,
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

        // Linha SB1 (bloqueio cadastro) → fundo vermelho claro
        if (row.sb1 && !row.sz0) {
          data.cell.styles.fillColor = [255, 235, 235];
          if (data.column.index === 7) {
            data.cell.styles.textColor = C.red;
            data.cell.styles.fontStyle = 'bold';
          }
        }
        // Linha SZ0 (restrição engenharia) → fundo roxo claro
        if (row.sz0 && !row.sb1) {
          data.cell.styles.fillColor = [245, 230, 255];
          if (data.column.index === 7) {
            data.cell.styles.textColor = [160, 40, 180];
            data.cell.styles.fontStyle = 'bold';
          }
        }
        // Ambos → fundo laranja claro
        if (row.sb1 && row.sz0) {
          data.cell.styles.fillColor = [255, 240, 220];
          if (data.column.index === 7) {
            data.cell.styles.textColor = C.amber;
            data.cell.styles.fontStyle = 'bold';
          }
        }
        // Coluna Status sempre em destaque
        if (data.column.index === 8) {
          data.cell.styles.textColor  = C.red;
          data.cell.styles.fontStyle  = 'bold';
          data.cell.styles.font       = 'helvetica';
        }
      },
      didDrawPage: (data) => {
        if (data.pageNumber > 1) {
          drawPageHeader(doc, root, PW, ML, MR, dateStr, timeStr);
        }
      },
      margin: { left: ML, right: MR, top: 40, bottom: 15 },
    });
  }

  // ── Rodapé em todas as páginas ─────────────────────────────────────────────
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    drawFooter(doc, i, totalPages, PW, ML, MR, PH, dateStr, timeStr);
  }

  // ── Merge: desenho do produto pai como primeira página ─────────────────────
  const fichaPdfBytes = doc.output('arraybuffer');
  let finalPdfBytes   = fichaPdfBytes;

  if (root.tem_arquivos && root.primeiro_arquivo) {
    try {
      const resp = await api.get('/docs/view', {
        params:       { path: root.primeiro_arquivo },
        responseType: 'arraybuffer',
      });
      const mergedDoc    = await PDFDocument.create();
      const drawingDoc   = await PDFDocument.load(resp.data);
      const drawingPages = await mergedDoc.copyPages(drawingDoc, drawingDoc.getPageIndices());
      drawingPages.forEach((p) => mergedDoc.addPage(p));
      const fichaDoc   = await PDFDocument.load(fichaPdfBytes);
      const fichaPages = await mergedDoc.copyPages(fichaDoc, fichaDoc.getPageIndices());
      fichaPages.forEach((p) => mergedDoc.addPage(p));
      finalPdfBytes = await mergedDoc.save();
    } catch (err) {
      console.warn('Não foi possível anexar o desenho do produto pai.', err);
    }
  }

  // Download
  const fileName = `Estrutura_${(root.codigo || 'produto').trim()}_${dateStr.replace(/\//g, '-')}.pdf`;
  const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
  const link = document.createElement('a');
  link.href  = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
