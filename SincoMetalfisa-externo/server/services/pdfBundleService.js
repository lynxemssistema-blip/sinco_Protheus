const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const mysqlPool = require('./mysqlService');
const fs = require('fs').promises;
const path = require('path');

function normalizeFilePath(filePath) {
    if (!filePath) return filePath;
    let normalized = filePath.trim();
    normalized = normalized.replace(/^Q:[\/\\]/i, '\\\\192.168.1.253\\Engenharia\\');
    if (process.platform !== 'win32') {
        normalized = normalized.replace(/\\/g, '/');
        normalized = normalized.replace(/^\/\/192\.168\.1\.253\/Engenharia\//i, '/mnt/engenharia/');
    }
    return normalized;
}

const generateRomaneioBundle = async (romaneioId, { usuarioGerador } = {}) => {
    // 1. Fetch Romaneio Header
    const [romRows] = await mysqlPool.execute(
        `SELECT id, cliente_nome, status, data_liberacao, data_previsao_retorno,
        peso_total, area_pintura_total, usuario, created_at, fotos, motorista_nome, 
        veiculo_placa, veiculo_modelo, motorista_cnh_validade, motorista_cnh
        FROM app_romaneios WHERE id = ?`,
        [romaneioId]
    );
    if (!romRows.length) throw new Error('Romaneio não encontrado');
    const rom = romRows[0];

    // 2. Fetch Romaneio Items
    const [itens] = await mysqlPool.execute(
        `SELECT r.pedido as op_numero, r.item_pedido as item_producao, r.quantidade,
         r.codigo_produto as codigo, r.descricao_produto as descricao, r.comentario,
         r.peso_unitario as item_peso_unitario
         FROM app_romaneio_items r
         WHERE r.romaneio_id = ?`,
        [romaneioId]
    );

    // 2.5 Fetch Linked NFs
    const [nfs] = await mysqlPool.execute(
        `SELECT tipo_nf, nf_numero, nf_serie FROM app_romaneios_nfs WHERE romaneio_id = ? ORDER BY created_at ASC`,
        [romaneioId]
    );

    // 3. Create Root Document
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // --- DRAW COVER PAGE (A4 LANDSCAPE) ---
    // Clonando Layout do RomaneioPrint.jsx original
    let cover = pdfDoc.addPage([841.89, 595.28]); 
    const { width, height } = cover.getSize();
    
    const drawT = (text, x, y, size = 10, isBold = false, color = rgb(0,0,0)) => {
        cover.drawText(text !== null && text !== undefined ? String(text) : '', { x, y, size, font: isBold ? fontBold : font, color });
    };

    const marginX = 30;
    const topY = height - 40;
    
    // Header Outer Box
    cover.drawRectangle({ x: marginX, y: topY - 80, width: width - (marginX * 2), height: 80, borderColor: rgb(0,0,0), borderWidth: 1 });
    
    // Vertical Separators
    const col2X = marginX + 180;
    const col3X = width - marginX - 180;
    cover.drawLine({ start: { x: col2X, y: topY }, end: { x: col2X, y: topY - 80 }, thickness: 1 });
    cover.drawLine({ start: { x: col3X, y: topY }, end: { x: col3X, y: topY - 80 }, thickness: 1 });

    // HEADER TEXT: LOGO
    const logoRelPath = path.join(__dirname, '../public/metalfisa-logo.png');
    try {
        const logoImageBytes = await fs.readFile(logoRelPath);
        const pngImage = await pdfDoc.embedPng(logoImageBytes);
        const scaleFactor = 50 / pngImage.height;
        const pngDims = pngImage.scale(scaleFactor);
        cover.drawImage(pngImage, {
            x: marginX + 35,
            y: topY - 65, 
            width: pngDims.width,
            height: pngDims.height,
        });
    } catch(e) { }

    // Titulo Central
    drawT('ROMANEIO DE ENTREGA CLIENTE', col2X + 90, topY - 45, 14, true);
    
    // Dados da Direita
    drawT(`Nº ${rom.id}`, col3X + 50, topY - 30, 16, true);
    drawT(`Rev: ${rom.current_revision || 1}`, col3X + 70, topY - 50, 10);
    drawT(`Emissão: ${new Date().toLocaleDateString('pt-BR')}`, col3X + 50, topY - 65, 9);
    
    // Box Emitente / Autoria
    const emitY = topY - 110;
    cover.drawRectangle({ x: marginX, y: emitY, width: width - (marginX * 2), height: 30, borderColor: rgb(0,0,0), borderWidth: 1 });
    
    const agora = new Date();
    const dtGeracaoPdf = `${agora.toLocaleDateString('pt-BR')} ${agora.toLocaleTimeString('pt-BR')}`;

    drawT('DADOS DA EMISSÃO / CONTROLE INTERNO', marginX + 10, emitY + 21, 8, true);
    drawT(`Elaborado por: ${rom.usuario || 'Sistema'}   |   PDF gerado por: ${usuarioGerador || 'Sistema'}   em: ${dtGeracaoPdf}`, marginX + 10, emitY + 12, 8);

    let dtEmissao = rom.data_liberacao || rom.created_at || new Date();
    let dtPrev = rom.data_previsao_retorno ? new Date(rom.data_previsao_retorno + 'T12:00:00Z').toLocaleDateString('pt-BR') : 'Não estipulada';
    drawT(`Emissão: ${new Date(dtEmissao).toLocaleDateString('pt-BR')}   |   Previsão de Retorno: ${dtPrev}`, marginX + 10, emitY + 3, 8);

    // Box Transportador e Cliente
    const colCliW = (width - marginX*2)/2;
    const trY = emitY - 50;
    cover.drawRectangle({ x: marginX, y: trY, width: width - (marginX * 2), height: 50, borderColor: rgb(0,0,0), borderWidth: 1 });
    cover.drawLine({ start: { x: marginX + colCliW, y: trY + 50 }, end: { x: marginX + colCliW, y: trY }, thickness: 1 });
    
    drawT('DESTINATÁRIO / CLIENTE', marginX + 10, trY + 40, 8, true);
    drawT(`${rom.cliente_nome}`, marginX + 10, trY + 30, 9);
    drawT('Verificar endereço de entrega padrão do cadastro.', marginX + 10, trY + 20, 8);
    
    drawT('TRANSPORTE E RETORNO', marginX + colCliW + 10, trY + 40, 8, true);
    drawT(`Motorista: ${rom.motorista_nome || '---'}   Placa: ${rom.veiculo_placa || '---'}`, marginX + colCliW + 10, trY + 28, 9);
    const nfStr = nfs.length > 0
        ? nfs.map(n => `${(n.tipo_nf || '').toUpperCase()}: ${(n.nf_numero || '').replace(/^0+/, '')}${n.nf_serie ? '-' + n.nf_serie : ''}`).join('   ')
        : 'Nenhuma NF vinculada';
    drawT(`NFs: ${nfStr}`, marginX + colCliW + 10, trY + 15, 8);

    // --- PRE-FETCH DRAWINGS TO CLASSIFY ---
    const comPdf = [];
    const semPdf = [];
    
    for (let i = 0; i < itens.length; i++) {
        const item = itens[i];
        // Peso: prioriza campo direto do item, senão busca em produtos_docs
        item.peso_unitario = Number(item.item_peso_unitario || 0);

        if (!item.codigo) {
            semPdf.push(item);
            continue;
        }
        const [docs] = await mysqlPool.execute(
            `SELECT url_arquivo, peso_kg FROM produtos_docs
             WHERE TRIM(produto_codigo) = ?
             ORDER BY CASE WHEN url_arquivo LIKE '%.pdf%' THEN 0 ELSE 1 END, created_at DESC LIMIT 1`,
            [(item.codigo || '').trim()]
        );
        if (docs.length > 0) {
            // Sempre pega o peso se não tiver no item
            if (!item.peso_unitario && docs[0].peso_kg) {
                item.peso_unitario = Number(docs[0].peso_kg);
            }
            const urlArq = (docs[0].url_arquivo || '').toLowerCase();
            if (urlArq.includes('.pdf')) {
                item.docPath = normalizeFilePath(docs[0].url_arquivo);
                item.item_index = i + 1;
                comPdf.push(item);
            } else {
                semPdf.push(item);
            }
        } else {
            semPdf.push(item);
        }
    }

    // Draw Items Table Header
    let tbY = trY - 30;
    
    if (nfs && nfs.length > 0) {
        const nfText = nfs.map(n => `${(n.tipo_nf||'').toUpperCase()}: ${n.nf_numero}${n.nf_serie ? '-' + n.nf_serie : ''}`).join('   |   ');
        cover.drawRectangle({ x: marginX, y: trY - 22, width: width - (marginX * 2), height: 18, borderColor: rgb(0,0,0), borderWidth: 1, color: rgb(0.95,0.98,1) });
        
        const labelStr = 'NOTAS FISCAIS VINCULADAS:   ';
        const textWidth = fontBold.widthOfTextAtSize(labelStr, 8) + font.widthOfTextAtSize(nfText, 8);
        const startX = marginX + ((width - marginX * 2) / 2) - (textWidth / 2);

        drawT(labelStr, startX, trY - 16, 8, true);
        drawT(nfText, startX + fontBold.widthOfTextAtSize(labelStr, 8), trY - 16, 8, false);
        tbY -= 24;
    }

    cover.drawRectangle({ x: marginX, y: tbY, width: width - (marginX * 2), height: 20, borderColor: rgb(0,0,0), borderWidth: 1, color: rgb(0.9,0.9,0.9) });
    drawT('It', marginX + 5, tbY + 6, 8, true);
    drawT('Código', marginX + 30, tbY + 6, 8, true);
    drawT('Pedido', marginX + 110, tbY + 6, 8, true);
    drawT('Descrição', marginX + 180, tbY + 6, 8, true);
    drawT('Obs.', marginX + 380, tbY + 6, 8, true);
    drawT('Qtd Env', marginX + 500, tbY + 6, 8, true);
    drawT('PDF', marginX + 560, tbY + 6, 8, true);
    drawT('Peso Un', marginX + 620, tbY + 6, 8, true);
    drawT('Peso Tot', marginX + 690, tbY + 6, 8, true);
    
    // Romaneio ID on all report pages (top right)
    const drawPageNum = (page) => {
        const { width: pW, height: pH } = page.getSize();
        page.drawText(`Romaneio: #${rom.id}`, { x: pW - 120, y: pH - 25, size: 10, font: fontBold, color: rgb(0.5, 0.5, 0.5) });
    };
    drawPageNum(cover);

    let y = tbY - 20;

    // Draw Items Table Lines
    let tPeso = 0;
    let tQtd = 0;
    for (let i=0; i<itens.length; i++) {
        const item = itens[i];
        if (y < 80) {
            cover = pdfDoc.addPage([841.89, 595.28]);
            drawPageNum(cover);
            y = height - 50;
        }
        cover.drawLine({ start: { x: marginX, y }, end: { x: width - marginX, y }, thickness: 1 });
        drawT(String(i+1), marginX + 5, y + 6, 8);
        drawT(item.codigo || '-', marginX + 30, y + 6, 8);
        const ped = item.op_numero ? item.op_numero + (item.item_producao ? '/' + item.item_producao : '') : '-';
        drawT(ped, marginX + 110, y + 6, 8);
        const desc = item.descricao ? item.descricao.substring(0, 48) : '-';
        drawT(desc, marginX + 180, y + 6, 8);
        
        const obs = item.comentario ? item.comentario.substring(0, 25) : '';
        drawT(obs, marginX + 380, y + 6, 8);

        drawT(String(item.quantidade), marginX + 500, y + 6, 8);
        if (item.docPath) {
            cover.drawText('SIM', { x: marginX + 560, y: y + 6, size: 8, font: fontBold, color: rgb(0, 0.5, 0) });
        } else {
            cover.drawText('NAO', { x: marginX + 560, y: y + 6, size: 8, font: fontBold, color: rgb(0.7, 0.1, 0.1) });
        }
        const pu = Number(item.peso_unitario || 0);
        const pq = Number(item.quantidade || 0);
        tQtd += pq;
        tPeso += (pu*pq);
        drawT(pu.toFixed(3), marginX + 620, y + 6, 8);
        drawT((pu*pq).toFixed(3), marginX + 690, y + 6, 8);
        y -= 20;
    }
    
    // Totals Line
    cover.drawRectangle({ x: marginX, y: y, width: width - (marginX * 2), height: 20, borderColor: rgb(0,0,0), borderWidth: 1, color: rgb(0.95,0.95,0.95) });
    drawT('TOTAIS:', marginX + 440, y + 6, 8, true);
    drawT(String(tQtd), marginX + 500, y + 6, 8, true);
    drawT(tPeso.toFixed(3), marginX + 690, y + 6, 8, true);

    // (PDF summary section removed — column in table now indicates per item)
    
    // --- MERGE APPEND DRAWINGS ---
    for (const item of comPdf) {
        if (!item.docPath) continue;
        try {
            const pdfBuffer = await fs.readFile(item.docPath);
            const srcDoc = await PDFDocument.load(pdfBuffer);
            const pages = await pdfDoc.copyPages(srcDoc, srcDoc.getPageIndices());
            
            for (const p of pages) {
                const { width: pW, height: pH } = p.getSize();
                const statusStr = rom.status?.toUpperCase() || 'ABERTO';
                const dtRetorno = rom.data_previsao_retorno ? new Date(rom.data_previsao_retorno + 'T12:00:00Z').toLocaleDateString('pt-BR') : 'Não estipulada';
                
                // --- MULTILINE STAMP (Size 6) ---
                const lines = [
                    `Item ${item.item_index || '?'} | Romaneio: #${rom.id} | Status: ${statusStr}`,
                    `Projeto(OP): ${item.op_numero || 'Avulso'} | Qtd: ${item.quantidade}`,
                    `Retorno: ${dtRetorno}`
                ];
                
                const fontSize = 6;
                const lineHeight = 8;
                const boxPadding = 5;
                
                // Calculate box width based on longest line
                const maxLineWidth = Math.max(...lines.map(line => fontBold.widthOfTextAtSize(line, fontSize)));
                
                const boxWidth = maxLineWidth + (boxPadding * 2);
                const boxHeight = (lines.length * lineHeight) + (boxPadding * 2);
                const startX = 20;
                const startY = pH - 20 - boxHeight;

                // White Background Box
                p.drawRectangle({
                    x: startX,
                    y: startY,
                    width: boxWidth,
                    height: boxHeight,
                    color: rgb(1, 1, 1),
                    opacity: 0.9
                });

                // Draw Text Lines
                lines.forEach((line, idx) => {
                    p.drawText(line, {
                        x: startX + boxPadding,
                        y: startY + boxHeight - boxPadding - (idx + 1) * lineHeight + 2,
                        size: fontSize,
                        color: rgb(1, 0, 0),
                        font: fontBold
                    });
                });

                pdfDoc.addPage(p);
            }
        } catch (err) {
            console.error(`Erro ao mesclar PDF: ${item.docPath}`, err.message);
        }
    }

    // --- DRAW PHOTOS IN REMAINING SPACE ON THE SAME PAGE ---
    let fotos = [];
    try { fotos = JSON.parse(rom.fotos || '[]'); } catch (_) {}
    if (Array.isArray(fotos) && fotos.length > 0) {
        const photosPerRow = 5;
        const photoAreaTop = y - 10;        // just below totals row
        const photoAreaBottom = 20;         // bottom margin
        const availableH = photoAreaTop - photoAreaBottom;
        const availableW = width - marginX * 2;

        const rows = Math.ceil(fotos.length / photosPerRow);
        const photoW = Math.floor((availableW - (photosPerRow - 1) * 4) / photosPerRow);
        const photoH = Math.floor((availableH - 18 - (rows - 1) * 4) / rows); // 18 for label

        // Label
        cover.drawText('FOTOS DO ROMANEIO', {
            x: marginX, y: photoAreaTop - 12,
            size: 8, font: fontBold, color: rgb(0.2, 0.2, 0.2)
        });

        for (let fi = 0; fi < fotos.length; fi++) {
            const fotoUrl = fotos[fi];
            const fotoFilename = fotoUrl.replace(/^.*\/uploads\/romaneios\//, '');
            const fotoPath = path.join(__dirname, '..', 'uploads', 'romaneios', fotoFilename);
            try {
                const imgBytes = await fs.readFile(fotoPath);
                let img;
                const lc = fotoFilename.toLowerCase();
                if (lc.endsWith('.png')) {
                    img = await pdfDoc.embedPng(imgBytes);
                } else {
                    img = await pdfDoc.embedJpg(imgBytes);
                }
                const col = fi % photosPerRow;
                const rowIdx = Math.floor(fi / photosPerRow);
                const imgX = marginX + col * (photoW + 4);
                const imgY = photoAreaTop - 18 - (rowIdx + 1) * (photoH + 4) + 4;
                const scaled = img.scaleToFit(photoW, photoH);
                cover.drawImage(img, {
                    x: imgX + (photoW - scaled.width) / 2,
                    y: imgY + (photoH - scaled.height) / 2,
                    width: scaled.width,
                    height: scaled.height
                });
            } catch (e) {
                console.error(`Erro ao embutir foto: ${fotoPath}`, e.message);
            }
        }
    }

    const finalPdfBytes = await pdfDoc.save();
    return Buffer.from(finalPdfBytes);
};

module.exports = { generateRomaneioBundle };
