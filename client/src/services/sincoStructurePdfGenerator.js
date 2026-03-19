import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PDFDocument } from 'pdf-lib';
import api from './api';

const fmtQtd = (v) => parseFloat(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 });

const generateSincoStructurePdf = async (structure, user) => {
    if (!structure || !structure.tree) return;

    const doc = new jsPDF('portrait', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();

    // ── 1. CABEÇALHO PADRÃO PROTHEUS (MATR225Cus/v.12) ──
    const ML = 10;
    const MR = 10;
    const pageWidthMinusMargins = pageWidth - ML - MR;
    
    // Header Texts
    doc.setFont('courier', 'normal'); // Monospaced font typical of legacy reports
    doc.setFontSize(8);
    
    const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = new Date().toLocaleDateString('pt-BR');
    
    // Left side
    doc.text('SIGA/MATR225Cus/v.12', ML, 10);
    doc.text(`Hora...: ${timeStr} - Grupo de empresa: GRUPO METALFISA / Filial: METALFISA MATRIZ`, ML, 14);
    
    // Center title
    doc.setFontSize(10);
    doc.text('Relação Simplificada das Estruturas', pageWidth / 2, 10, { align: 'center' });
    
    // Right side
    doc.setFontSize(8);
    doc.text('Folha...: 1', pageWidth - MR, 10, { align: 'right' });
    doc.text(`DT.Ref.: ${dateStr}`, pageWidth - MR, 14, { align: 'right' });
    doc.text(`Emissão: ${dateStr}`, pageWidth - MR, 18, { align: 'right' });

    // ── 2. DADOS DO PRODUTO PAI ──
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    
    // Logo Metalfisa at the very top (optional per user request, but simple text)
    doc.text('ENGETRON ENG ELET IN', (pageWidth / 4) * 3, 10, { align: 'center' }); // Just referencing the image style, replacing later with actual client if needed, or static.
    
    let yOffset = 25;

    // --- 3. STRUCTURE TREE (MATR225 TABLE STYLE) ---
    const tableData = [];
    const rootPData = structure.protheusData || {};
    
    // We add the root product first (Level 00) as in the image
    const rootDesc = structure.tree.find(i => i.CodMatFabricante === structure.rootCode)?.DescResumo || '—';
    const rootUnidade = structure.tree.find(i => i.CodMatFabricante === structure.rootCode)?.Unidade || 'UN';
    
    tableData.push([
        '001',             // ITEM (Sequential)
        'PA',              // TP (Tipo: PA = Produto Acabado)
        '00',              // NIVEL
        structure.rootCode,// CODIGO
        rootDesc,          // DESCRICAO
        fmtQtd(1),        // QTDE.NECESSARIA
        rootUnidade,       // UM
        rootPData.revisao || '', // Rv Metalfisa
        rootPData.desenho_cliente || '', // Cod Prod Cliente
        rootPData.rev_cliente || '',     // Rv Cliente
        ''                 // Restrição
    ]);

    let seqItem = 2; // Start from 002

    structure.tree.forEach(item => {
        // Main Item Row
        const nivelNum = parseInt(item.nivel);
        const nivelStr = nivelNum < 10 ? `0${nivelNum}` : `${nivelNum}`;
        const isPI = nivelNum > 0 && item.materiais && item.materiais.length > 0;
        
        // Indent code and description like in Protheus
        const indentCode = "  ".repeat(nivelNum) + item.CodMatFabricante;
        const indentDesc = "  ".repeat(nivelNum) + (item.DescResumo || '');

        tableData.push([
            seqItem.toString().padStart(3, '0'),
            isPI ? 'PI' : 'MP',  // Simplified TP 
            nivelStr,
            indentCode,
            indentDesc,
            item.QtdeTotal ? fmtQtd(item.QtdeTotal) : '0',
            item.Unidade || 'UN',
            '', // Rv Metalfisa (sub-items might need fetching if required, left blank as in image)
            '', // Cod Prod Cliente
            '', // Rv Cliente
            ''  // Restrição
        ]);
        seqItem++;

        // Processos are usually not in this specific Protheus report, but we'll include them as PR 
        if (item.processos && item.processos.length > 0) {
            item.processos.forEach(proc => {
                tableData.push([
                    seqItem.toString().padStart(3, '0'),
                    'PR',
                    nivelStr + '+',
                    "  ".repeat(nivelNum + 1) + (proc.processName || proc.processCode || 'OP'),
                    "  ".repeat(nivelNum + 1) + 'PROCESSO DE FABRICAÇÃO',
                    proc.timeMin ? `${parseFloat(proc.timeMin)}` : '0',
                    'MIN',
                    '', '', '', ''
                ]);
                seqItem++;
            });
        }

        // Materiais
        if (item.materiais && item.materiais.length > 0) {
            item.materiais.forEach(mat => {
                tableData.push([
                    seqItem.toString().padStart(3, '0'),
                    'MP',
                    (nivelNum + 1) < 10 ? `0${nivelNum + 1}` : `${nivelNum + 1}`,
                    "  ".repeat(nivelNum + 1) + (mat.materialCode || 'S/COD'),
                    "  ".repeat(nivelNum + 1) + (mat.materialDescDetal || mat.materialDesc || '—'),
                    fmtQtd(mat.quantity),
                    mat.unidade || 'UN',
                    '', '', '', '' // Usually blank for raw materials
                ]);
                seqItem++;
            });
        }
    });

    autoTable(doc, {
        startY: yOffset,
        head: [['ITEM', 'TP', 'NIVEL', 'CODIGO', 'DESCRICAO', 'QTDE.NECESSARIA', 'UM', 'Rv Metalfisa', 'Cod Prod Cliente', 'Rv Cliente', 'Restrição']],
        body: tableData,
        theme: 'plain', // Very important to match the image: no grid lines, just plain text
        styles: { 
            fontSize: 7, 
            cellPadding: 1, 
            font: 'courier', // Monospaced for that legacy look
            textColor: [0, 0, 0] 
        },
        headStyles: { 
            fontStyle: 'bold', 
            textColor: [0, 0, 0] 
        },
        margin: { top: 10, left: ML, right: MR, bottom: 20 },
        // Draw a top line and bottom line for the header just like Protheus usually does
        didDrawPage: function (data) {
            // Re-apply the page number logic to match Protheus "Folha...: X" at the top instead of bottom
            doc.setFontSize(8);
            doc.setFont('courier', 'normal');
            doc.text(`Folha...: ${doc.internal.getCurrentPageInfo().pageNumber}`, pageWidth - MR, 10, { align: 'right' });
            
            // Header lines
            doc.setLineWidth(0.1);
            doc.line(ML, data.cursor.y, pageWidth - MR, data.cursor.y);
        }
    });

    // --- 4. REVISIONS SUMMARY ---
    if (structure.revisionsSummary && structure.revisionsSummary.length > 0) {
        doc.addPage();
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text("Resumo de Revisões e Restrições", pageWidth / 2, 20, { align: 'center' });
        
        const revTableData = structure.revisionsSummary.map(r => [
            r.codigo,
            r.descricao,
            r.revisao_mf,
            r.revisao_cli,
            r.desenho_cli,
            r.status
        ]);
        
        autoTable(doc, {
            startY: 30,
            head: [['Código', 'Descrição', 'Rev MF', 'Rev Cli', 'Des. Cliente', 'Status']],
            body: revTableData,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold' },
            didParseCell: function(data) {
                if (data.section === 'body' && data.column.index === 5) {
                    if (data.cell.raw !== 'Normal') {
                        data.cell.styles.textColor = [200, 0, 0];
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
            },
            margin: { top: 10, left: 10, right: 10, bottom: 20 }
        });
    }

    // Add page numbers at the bottom right
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`Página ${i} de ${pageCount}`, pageWidth - 20, doc.internal.pageSize.getHeight() - 10);
        doc.text(`MetalFisa - Emitido por: ${user?.nome || user?.login || 'Usuário'}`, 10, doc.internal.pageSize.getHeight() - 10);
    }

    // Convert Ficha to bytes for merging
    const fichaPdfBytes = doc.output('arraybuffer');
    
    // --- 5. FETCH ROOT DRAWING & MERGE ---
    let finalPdfBytes = fichaPdfBytes;
    
    const rootItem = structure.tree.find(i => i.CodMatFabricante === structure.rootCode);
    if (rootItem && rootItem.hasPdfFile && rootItem.pdfPath) {
        try {
            // Fetch root drawing from backend
            const response = await api.get('/sinco/docs/view', {
                params: { path: rootItem.pdfPath },
                responseType: 'arraybuffer'
            });
            const rootPdfBytes = response.data;
            
            // Merge using pdf-lib
            const mergedPdf = await PDFDocument.create();
            
            // Prepend Root Drawing
            const rootDoc = await PDFDocument.load(rootPdfBytes);
            const copiedRootPages = await mergedPdf.copyPages(rootDoc, rootDoc.getPageIndices());
            copiedRootPages.forEach(page => mergedPdf.addPage(page));

            // Append Generated Ficha
            const fichaDoc = await PDFDocument.load(fichaPdfBytes);
            const copiedFichaPages = await mergedPdf.copyPages(fichaDoc, fichaDoc.getPageIndices());
            copiedFichaPages.forEach(page => mergedPdf.addPage(page));

            finalPdfBytes = await mergedPdf.save();
        } catch (err) {
            console.error('⚠️ Falha ao mesclar desenho com a Ficha Técnica:', err);
            // Fallback to Ficha only
        }
    }

    // Download routine
    const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = `Ficha_Tecnica_${structure.rootCode}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export { generateSincoStructurePdf };

export default generateSincoStructurePdf;
