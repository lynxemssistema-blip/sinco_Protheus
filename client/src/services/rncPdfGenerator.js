import jsPDFLib from 'jspdf';
const jsPDF = jsPDFLib.jsPDF || jsPDFLib;
import autoTable from 'jspdf-autotable';
import { logoBase64 } from './metalfisaLogoBase64';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import api from './api';
import { getCompanyShortName } from './companyBranding';
import { downloadBlob } from '../utils/downloadHelper';

const drawRncStampOnPage = (page, rnc, helveticaFont, helveticaBoldFont) => {
    const { width, height } = page.getSize();
    const minSide = Math.min(width, height);
    const scale = Math.max(1, minSide / 595);

    const W = 150 * scale;
    const H = 75 * scale;
    const padding = 6 * scale;
    const fontSize = 7 * scale;
    const titleFontSize = 9 * scale;
    const lineHeight = 9.5 * scale;

    const x = width - W - 10 * scale;
    const y = 10 * scale;

    // Fundo branco sólido para cobrir o desenho atrás do carimbo
    page.drawRectangle({
        x,
        y,
        width: W,
        height: H,
        color: rgb(1, 1, 1),
        borderColor: rgb(0.8, 0.1, 0.1),
        borderWidth: 1.5 * scale,
    });

    // Borda interna preta fina
    page.drawRectangle({
        x: x + 1.5 * scale,
        y: y + 1.5 * scale,
        width: W - 3 * scale,
        height: H - 3 * scale,
        borderColor: rgb(0.1, 0.1, 0.1),
        borderWidth: 0.5 * scale,
    });

    let currY = y + H - padding - titleFontSize;

    // Título do Carimbo
    page.drawText('RNC - PRODUTO NÃO CONFORME', {
        x: x + padding,
        y: currY,
        size: titleFontSize,
        font: helveticaBoldFont,
        color: rgb(0.8, 0.1, 0.1),
    });

    currY -= lineHeight;

    // Linha divisória
    page.drawLine({
        start: { x: x + padding, y: currY + 2 * scale },
        end: { x: x + W - padding, y: currY + 2 * scale },
        thickness: 0.5 * scale,
        color: rgb(0.8, 0.1, 0.1),
    });

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;
            return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
        } catch(e) {
            return dateStr;
        }
    };

    const limitLength = (str, len) => {
        if (!str) return '-';
        return str.length > len ? str.substring(0, len) + '...' : str;
    };

    // Dados da RNC
    const lines = [
        `RNC ID: #${rnc.id} | Status: ${rnc.status || 'ABERTO'}`,
        `Abertura: ${formatDate(rnc.data_criacao)} | OP: ${rnc.op || '-'}-${rnc.item_op || '-'}(${rnc.sequen_op || '-'})`,
        `Produto: ${rnc.produto || '-'}`,
        `Prazo Limite: ${formatDate(rnc.data_limite)}`,
        `Recurso/Setor: ${limitLength(rnc.recurso_inconformidade || '-', 25)}`,
        `Descrição: ${limitLength(rnc.observacao || '-', 38)}`
    ];

    for (const line of lines) {
        page.drawText(line, {
            x: x + padding,
            y: currY,
            size: fontSize,
            font: helveticaFont,
            color: rgb(0.1, 0.1, 0.1),
        });
        currY -= lineHeight;
    }
};

export const generateRNCPdf = async (rncs, filters, currentUser) => {
    try {
        const doc = new jsPDF('portrait', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const ML = 14;
        const MR = 14;

        // --- CABEÇALHO PADRÃO ---
        const drawHeader = (pageDoc, currentY) => {
            let hY = currentY || 5;
            const usableW = pageWidth - ML - MR;
            const hH = 15;

            // Box and lines
            pageDoc.setDrawColor(30, 58, 95);
            pageDoc.setLineWidth(0.3);
            pageDoc.rect(ML, hY, usableW, hH);

            const col1 = ML + 45;   // logo | logo name
            const col2 = ML + 130;  // title | info

            pageDoc.setLineWidth(0.2);
            [col1, col2].forEach(x => pageDoc.line(x, hY, x, hY + hH));

            // Logo Image
            try {
                if (logoBase64) {
                    pageDoc.addImage(logoBase64, 'PNG', ML + 2, hY + 1, 38, 13);
                } else {
                    pageDoc.setFontSize(13);
                    pageDoc.setFont('helvetica', 'bold');
                    pageDoc.setTextColor(30, 58, 95);
                    pageDoc.text(getCompanyShortName(), ML + 4, hY + 9);
                }
            } catch (e) {
                pageDoc.setFontSize(13);
                pageDoc.setFont('helvetica', 'bold');
                pageDoc.setTextColor(30, 58, 95);
                pageDoc.text(getCompanyShortName(), ML + 4, hY + 9);
            }

            pageDoc.setTextColor(0, 0, 0);
            pageDoc.setFontSize(12);
            pageDoc.setFont('helvetica', 'bold');
            pageDoc.text('Relatório de Não Conformidades', col1 + 5, hY + 9);

            pageDoc.setFontSize(8);
            pageDoc.setFont('helvetica', 'normal');
            pageDoc.text(`Data/Hora: ${new Date().toLocaleString('pt-BR')}`, col2 + 5, hY + 6);
            pageDoc.text(`Usuário: ${currentUser?.nome || 'Sistema'}`, col2 + 5, hY + 11);

            return hY + hH + 5;
        };

        const HEADER_H = 25;

        const onDidDrawPage = (data) => {
            if (data.pageNumber > 1) {
                drawHeader(doc, 5);
            }
        };

        let startY = drawHeader(doc, 5);

        // --- FILTROS ---
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        let filterText = [];
        if (filters?.status) filterText.push(`Status: ${filters.status}`);

        doc.text(`Filtros Ativos: ${filterText.length > 0 ? filterText.join(' | ') : 'Todos os Registros'}`, ML, startY + 2);
        startY += 8;

        const tableHead = [['ID', 'Status', 'Origem', 'Defeito / Recurso', 'Tratativa / Obs']];
        const colStyles = {
            0: { cellWidth: 15 },
            1: { cellWidth: 25 },
            2: { cellWidth: 40 },
            3: { cellWidth: 45 },
            4: { cellWidth: 55 }
        };

        const mapRow = (row) => {
            const dataCriacao = new Date(row.data_criacao).toLocaleString('pt-BR');
            let origem = `Abertura:\nEm: ${dataCriacao}\nPor: ${row.criado_por || 'Sistema'}\n\n`;
            origem += `OP: ${row.op}-${row.item_op} (${row.sequen_op})\nPV: ${row.pedido || 'N/A'}\nProduto OP: ${row.produto || ''}`;

            try {
                let parsed = row.f097_dados ? JSON.parse(row.f097_dados) : {};
                if (typeof parsed === 'string') {
                    parsed = JSON.parse(parsed);
                }
                const f097 = parsed && typeof parsed === 'object' ? parsed : {};
                const reg = f097.registro || {};
                
                if (reg.is_produto_pai === true) {
                    origem += `\nHierarquia: Produto Pai (Item de Faturamento)`;
                } else if (reg.is_produto_pai === false) {
                    origem += `\nHierarquia: Item Filho\nProd. Pai: ${reg.produto_pai || 'N/A'}`;
                }
            } catch (e) {}

            let tratativa = `Problema:\n${row.observacao || '-'}\n\n`;
            if (row.tratativa_resposta) {
                tratativa += `Soluções / Histórico:\n${row.tratativa_resposta}`;
            } else {
                tratativa += 'Tratativa: Aguardando solução.';
            }

            return [
                `#${row.id}`,
                row.status || '-',
                origem,
                `${row.nc_descricao || 'Outro'}\nRecurso: ${row.recurso_inconformidade}`,
                tratativa
            ];
        };

        const tableBody = rncs.map(mapRow);

        autoTable(doc, {
            startY: startY,
            head: tableHead,
            body: tableBody,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2, valign: 'middle' },
            headStyles: { fillColor: [30, 58, 95], textColor: 255 },
            columnStyles: colStyles,
            margin: { left: ML, right: MR, top: HEADER_H, bottom: 20 },
            didDrawPage: onDidDrawPage,
        });

        // --- FOOTER PAGINATION ---
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(150, 150, 150);
            doc.text(`Página ${i} de ${pageCount}`, pageWidth - MR, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
            doc.text(`Gerado via Lynx App`, ML, doc.internal.pageSize.getHeight() - 10);
        }

        doc.save(`relatorio_rncs_${new Date().getTime()}.pdf`);
    } catch (err) {
        console.error('Erro ao gerar relatório com formatação padrão', err);
        throw err;
    }
};

export const generateSingleRNCPdf = async (rnc, options = {}) => {
    try {
        const doc = new jsPDF('portrait', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const ML = 14;
        const MR = 14;
        const usableW = pageWidth - ML - MR;

        let currentY = 10;

        // HEADER (similar to F097-22)
        doc.setDrawColor(30, 58, 95);
        doc.setLineWidth(0.3);
        doc.rect(ML, currentY, usableW, 20);

        // Logo Image
        try {
            if (logoBase64) {
                doc.addImage(logoBase64, 'PNG', ML + 2, currentY + 2, 45, 15);
            } else {
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(30, 58, 95);
                doc.text(getCompanyShortName(), ML + 5, currentY + 12);
            }
        } catch (e) {}

        doc.line(ML + 50, currentY, ML + 50, currentY + 20);

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('F 097-22 - REGISTRO DE NÃO CONFORMIDADE', ML + 55, currentY + 9);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`RNC ID: #${rnc.id}  |  Status: ${rnc.status}`, ML + 55, currentY + 16);

        currentY += 25;

        // PARSER DATA
        let parsed = rnc.f097_dados ? JSON.parse(rnc.f097_dados) : {};
        if (typeof parsed === 'string') {
            parsed = JSON.parse(parsed);
        }
        const f097 = parsed && typeof parsed === 'object' ? parsed : {};
        const reg = f097.registro || {};
        const trat = f097.tratativa || {};

        // SECTION: 1. IDENTIFICAÇÃO E DESCRIÇÃO DA RNC
        autoTable(doc, {
            startY: currentY,
            theme: 'grid',
            headStyles: { fillColor: [200, 200, 200], textColor: 0, fontStyle: 'bold', halign: 'center' },
            styles: { fontSize: 9, cellPadding: 2, textColor: 0 },
            body: [
                [{ content: '1. IDENTIFICAÇÃO E DESCRIÇÃO DA NÃO CONFORMIDADE', colSpan: 4, styles: { fillColor: [230, 230, 230], fontStyle: 'bold' } }],
                ['Data Abertura:', new Date(rnc.data_criacao).toLocaleString('pt-BR'), 'Prazo Limite:', rnc.data_limite ? new Date(rnc.data_limite).toLocaleDateString('pt-BR') : 'Não Definido'],
                ['Aberto por:', rnc.criado_por || 'Sistema', 'Pedido / PV:', rnc.pedido || '-'],
                ['OP:', `${rnc.op || '-'}-${rnc.item_op || '-'} (${rnc.sequen_op || '-'})`, 'Hierarquia:', reg.is_produto_pai === true ? 'Produto Pai (Faturamento)' : (reg.is_produto_pai === false ? 'Item Filho (Componente)' : 'Não Definido')],
                ['Produto OP:', rnc.produto || '-', 'Produto Pai (PV):', reg.produto_pai || (reg.is_produto_pai ? rnc.produto : 'N/A')],
                ['Cliente / Fornec.:', { content: rnc.cliente || '-', colSpan: 3 }],
                ['Origem RNC:', reg.origem || '-', 'Resp. Qualidade:', reg.responsavel_qualidade || '-'],
                ['Local Detecção:', reg.local_deteccao || '-', 'Qtd Não Conforme:', reg.qtd_nao_conforme || '-'],
                ['Setor Envolvido:', reg.setor_envolvido || rnc.recurso_inconformidade || '-', 'Setor Origem:', reg.setor_origem || '-'],
                ['Defeito / Probl.:', { content: rnc.nc_descricao || '-', colSpan: 3 }],
                [{ content: `Descrição Detalhada:\n${rnc.observacao || '-'}`, colSpan: 4, styles: { minCellHeight: 20 } }]
            ]
        });

        currentY = doc.lastAutoTable.finalY + 5;

        // SECTION: 2. DISPOSIÇÃO DO PRODUTO E 3. INVESTIGAÇÃO 5W2H
        autoTable(doc, {
            startY: currentY,
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 2, textColor: 0 },
            body: [
                [{ content: '2. DISPOSIÇÃO DO PRODUTO', colSpan: 2, styles: { fillColor: [230, 230, 230], fontStyle: 'bold' } },
                 { content: '3. INVESTIGAÇÃO DAS CAUSAS (5W2H)', colSpan: 2, styles: { fillColor: [230, 230, 230], fontStyle: 'bold' } }],
                ['Retrabalho:', trat.disposicao_retrabalho ? 'X Sim' : 'Não', 'O Quê (Problema):', trat.w2h_o_que || '-'],
                ['Nova Peça:', trat.disposicao_nova_peca ? 'X Sim' : 'Não', 'Por Quê (Causa):', trat.w2h_por_que || '-'],
                [{ content: '', colSpan: 2, rowSpan: 5 }, 'Onde (Local):', trat.w2h_onde || '-'],
                ['Quando:', trat.w2h_quando || '-'],
                ['Quem (Resp.):', trat.w2h_quem || '-'],
                ['Quantidade:', trat.w2h_quantidade || '-'],
                ['Frequência:', trat.w2h_frequencia || '-']
            ]
        });

        currentY = doc.lastAutoTable.finalY + 5;

        // SECTION: 4. VERIFICAÇÃO DA EFICÁCIA DA AÇÃO CORRETIVA E HISTÓRICO
        autoTable(doc, {
            startY: currentY,
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 2, textColor: 0 },
            body: [
                [{ content: '4. VERIFICAÇÃO DA EFICÁCIA DA AÇÃO', colSpan: 4, styles: { fillColor: [230, 230, 230], fontStyle: 'bold' } }],
                ['Ações Foram Implementadas?', trat.efic_acoes_implementadas || '-', 'Corrigiram o Problema?', trat.efic_corrigiram || '-'],
                ['Houve Reincidência?', trat.efic_reincidencia || '-', 'Conclusão Final:', trat.efic_conclusao || '-'],
                [{ content: '5. HISTÓRICO E TRATATIVAS REGISTRADAS', colSpan: 4, styles: { fillColor: [230, 230, 230], fontStyle: 'bold' } }],
                [{ content: rnc.tratativa_resposta || 'Nenhuma tratativa registrada.', colSpan: 4, styles: { minCellHeight: 25 } }]
            ]
        });

        currentY = doc.lastAutoTable.finalY + 10;
        
        let fotosRegistro = [];
        try { fotosRegistro = rnc.fotos_registro ? JSON.parse(rnc.fotos_registro) : (rnc.imagem_evidencia ? [rnc.imagem_evidencia] : []); } catch(e){}
        
        let fotosTrat = [];
        try { fotosTrat = rnc.fotos_tratativa ? JSON.parse(rnc.fotos_tratativa) : []; } catch(e){}
        
        const todasFotos = [...fotosRegistro.map(f => ({src: f, label: 'Evidência (Abertura)'})), ...fotosTrat.map(f => ({src: f, label: 'Evidência (Solução)'}))];

        if (todasFotos.length > 0) {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('ANEXO: EVIDÊNCIAS FOTOGRÁFICAS', ML, currentY);
            currentY += 5;

            const photoWidth = 50;
            const photoHeight = 50;
            const maxCols = 3;
            let colIndex = 0;

            for (const foto of todasFotos) {
                if (!foto.src || typeof foto.src !== 'string' || !foto.src.startsWith('data:image')) continue;
                
                if (currentY + photoHeight > doc.internal.pageSize.getHeight() - 15) {
                    doc.addPage();
                    currentY = 15;
                    colIndex = 0;
                }

                const posX = ML + (colIndex * (photoWidth + 5));
                try {
                    doc.addImage(foto.src, 'JPEG', posX, currentY, photoWidth, photoHeight);
                    doc.setFontSize(7);
                    doc.text(foto.label, posX, currentY + photoHeight + 3);
                } catch(e) {
                    console.error('Erro ao renderizar imagem', e);
                }

                colIndex++;
                if (colIndex >= maxCols) {
                    colIndex = 0;
                    currentY += photoHeight + 10;
                }
            }
        }

        const f097Bytes = doc.output('arraybuffer');
        let finalPdfBytes = f097Bytes;

        let drawingPath = rnc.primeiro_arquivo;
        if (!drawingPath && rnc.produto) {
            try {
                const docsResult = await api.get(`/docs/${encodeURIComponent(rnc.produto)}`);
                const drawing = docsResult.data.find(d => (d.tipo === 'Desenho' || (d.titulo && d.titulo.toLowerCase().includes('desenho'))) && d.url_arquivo && d.url_arquivo.toLowerCase().endsWith('.pdf'));
                if (drawing) {
                    drawingPath = drawing.url_arquivo;
                }
            } catch (err) {
                console.warn('Erro ao buscar desenho alternativo:', err);
            }
        }

        if (drawingPath) {
            try {
                const mergedDoc = await PDFDocument.create();
                
                // Carregar o PDF principal da RNC (F 097-22)
                const f097Doc = await PDFDocument.load(f097Bytes);
                const f097Pages = await mergedDoc.copyPages(f097Doc, f097Doc.getPageIndices());
                f097Pages.forEach(p => mergedDoc.addPage(p));
                
                // Carregar o desenho do produto
                const resp = await api.get('/docs/view', { params: { path: drawingPath }, responseType: 'arraybuffer' });
                const drawDoc = await PDFDocument.load(resp.data, { ignoreEncryption: true });
                
                const copiedPages = await mergedDoc.copyPages(drawDoc, drawDoc.getPageIndices());
                
                const helveticaFont = await mergedDoc.embedFont(StandardFonts.Helvetica);
                const helveticaBoldFont = await mergedDoc.embedFont(StandardFonts.HelveticaBold);
                
                for (const page of copiedPages) {
                    mergedDoc.addPage(page);
                    // Aplicar carimbo no canto inferior direito do desenho
                    drawRncStampOnPage(page, rnc, helveticaFont, helveticaBoldFont);
                }
                
                finalPdfBytes = await mergedDoc.save({ useObjectStreams: false });
            } catch (err) {
                console.error('Erro ao anexar desenho ao PDF F 097-22:', err);
            }
        }

        if (options.returnBytes) {
            return { bytes: finalPdfBytes, fileName: `F097-22_RNC_${rnc.id}.pdf` };
        }

        const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
        const fileName = `F097-22_RNC_${rnc.id}.pdf`;
        downloadBlob(blob, fileName, 'application/pdf');
    } catch (err) {
        console.error('Erro ao gerar RNC individual PDF', err);
        throw err;
    }
};
