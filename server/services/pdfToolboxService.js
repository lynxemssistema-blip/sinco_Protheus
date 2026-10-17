const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const mysqlPool = require('./mysqlService');
const path = require('path');
const fs = require('fs').promises;

const generateToolboxReport = async (toolboxId, { usuarioGerador } = {}) => {
    // 1. Fetch Toolbox Data
    const [toolboxRows] = await mysqlPool.execute(
        `SELECT t.*, u.NomeCompleto as owner_name, d.Nome as department_name 
         FROM sgq_toolboxes t
         LEFT JOIN app_usuarios u ON t.owner_id = u.idUsuario
         LEFT JOIN app_departamentos d ON t.department_id = d.idDepartamento
         WHERE t.id = ?`,
        [toolboxId]
    );

    if (toolboxRows.length === 0) {
        throw new Error('Caixa de ferramentas não encontrada.');
    }
    const toolbox = toolboxRows[0];

    // 2. Fetch Assets in Toolbox
    const [assets] = await mysqlPool.execute(
        `SELECT a.patrimonio, a.name, a.model, a.serial_number, a.requires_calibration, t.quantity as assigned_quantity, t.assigned_at
         FROM sgq_assets a
         JOIN sgq_asset_toolbox t ON a.id = t.asset_id
         WHERE t.toolbox_id = ?
         ORDER BY a.name ASC`,
        [toolboxId]
    );

    // 3. Create PDF
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const drawPageHeader = async (page) => {
        const { width, height } = page.getSize();
        const marginX = 30;
        const topY = height - 40;

        const drawT = (text, x, y, size = 10, isBold = false, color = rgb(0,0,0)) => {
            page.drawText(text !== null && text !== undefined ? String(text) : '', { x, y, size, font: isBold ? fontBold : font, color });
        };

        // Header Box
        page.drawRectangle({ x: marginX, y: topY - 80, width: width - (marginX * 2), height: 80, borderColor: rgb(0,0,0), borderWidth: 1 });
        
        const col2X = marginX + 150;
        const col3X = width - marginX - 180;
        page.drawLine({ start: { x: col2X, y: topY }, end: { x: col2X, y: topY - 80 }, thickness: 1 });
        page.drawLine({ start: { x: col3X, y: topY }, end: { x: col3X, y: topY - 80 }, thickness: 1 });

        // Logo
        try {
            const logoRelPath = path.join(__dirname, '../public/metalfisa-logo.png');
            const logoBytes = await fs.readFile(logoRelPath);
            const pngImage = await pdfDoc.embedPng(logoBytes);
            const scaleFactor = 50 / pngImage.height;
            const pngDims = pngImage.scale(scaleFactor);
            page.drawImage(pngImage, {
                x: marginX + 20,
                y: topY - 65,
                width: pngDims.width,
                height: pngDims.height
            });
        } catch (e) {
            drawT('LYNX', marginX + 20, topY - 45, 14, true);
        }

        drawT('TERMO DE RESPONSABILIDADE', col2X + 20, topY - 35, 14, true);
        drawT('CAIXA DE FERRAMENTAS', col2X + 40, topY - 55, 12, true);

        drawT(`ID Caixa: ${toolbox.id}`, col3X + 20, topY - 30, 12, true);
        drawT(`Emissão: ${new Date().toLocaleDateString('pt-BR')}`, col3X + 20, topY - 50, 10);
        
        // Info Box
        const infoY = topY - 140;
        page.drawRectangle({ x: marginX, y: infoY, width: width - (marginX * 2), height: 50, borderColor: rgb(0,0,0), borderWidth: 1 });
        
        drawT(`Caixa: ${toolbox.name}`, marginX + 10, infoY + 30, 10, true);
        drawT(`Responsável: ${toolbox.owner_name || 'Nenhum'}`, marginX + 10, infoY + 15, 10);
        drawT(`Departamento: ${toolbox.department_name || 'Nenhum'}`, marginX + 250, infoY + 15, 10);
        drawT(`Criada em: ${new Date(toolbox.created_at).toLocaleDateString('pt-BR')}`, marginX + 400, infoY + 15, 10);

        return { marginX, startY: infoY - 30, width, drawT };
    };

    let page = pdfDoc.addPage([595.28, 841.89]); // A4 Portrait
    let { marginX, startY, width, drawT } = await drawPageHeader(page);

    // Table Header
    page.drawRectangle({ x: marginX, y: startY, width: width - (marginX * 2), height: 20, borderColor: rgb(0,0,0), borderWidth: 1, color: rgb(0.9,0.9,0.9) });
    drawT('Qtd', marginX + 5, startY + 6, 9, true);
    drawT('Patrimônio', marginX + 35, startY + 6, 9, true);
    drawT('Ferramenta / Descrição', marginX + 120, startY + 6, 9, true);
    drawT('Modelo / Serial', marginX + 320, startY + 6, 9, true);
    drawT('Data Atribuição', marginX + 460, startY + 6, 9, true);

    let y = startY - 20;

    for (const a of assets) {
        if (y < 120) { // Keep space for signature
            page = pdfDoc.addPage([595.28, 841.89]);
            const headerResult = await drawPageHeader(page);
            startY = headerResult.startY;
            y = startY - 20;
            
            page.drawRectangle({ x: marginX, y: startY, width: width - (marginX * 2), height: 20, borderColor: rgb(0,0,0), borderWidth: 1, color: rgb(0.9,0.9,0.9) });
            drawT('Qtd', marginX + 5, startY + 6, 9, true);
            drawT('Patrimônio', marginX + 35, startY + 6, 9, true);
            drawT('Ferramenta / Descrição', marginX + 120, startY + 6, 9, true);
            drawT('Modelo / Serial', marginX + 320, startY + 6, 9, true);
            drawT('Data Atribuição', marginX + 460, startY + 6, 9, true);
        }

        page.drawLine({ start: { x: marginX, y }, end: { x: width - marginX, y }, thickness: 1, color: rgb(0.8,0.8,0.8) });
        
        drawT(String(a.assigned_quantity), marginX + 5, y + 6, 9);
        drawT(a.patrimonio || '-', marginX + 35, y + 6, 9);
        drawT(a.name ? a.name.substring(0, 40) : '-', marginX + 120, y + 6, 9);
        drawT(`${a.model || '-'}${a.serial_number ? ' | SN:'+a.serial_number : ''}`.substring(0, 30), marginX + 320, y + 6, 8);
        drawT(new Date(a.assigned_at).toLocaleDateString('pt-BR'), marginX + 460, y + 6, 9);

        y -= 20;
    }

    // Signature Area
    const sigY = y - 50;
    if (sigY < 60) {
        page = pdfDoc.addPage([595.28, 841.89]);
        const headerResult = await drawPageHeader(page);
        y = headerResult.startY - 50;
    } else {
        y = sigY;
    }

    drawT('Declaro ter recebido os equipamentos acima relacionados em perfeitas condições de uso,', marginX, y, 9);
    drawT('comprometendo-me a zelar pela sua conservação e devolvê-los quando solicitado.', marginX, y - 12, 9);

    page.drawLine({ start: { x: marginX + 50, y: y - 60 }, end: { x: marginX + 250, y: y - 60 }, thickness: 1 });
    page.drawLine({ start: { x: marginX + 300, y: y - 60 }, end: { x: marginX + 500, y: y - 60 }, thickness: 1 });

    drawT(`Responsável: ${toolbox.owner_name || '__________________________'}`, marginX + 70, y - 75, 9);
    drawT(`Almoxarifado / Gestão de Ativos`, marginX + 320, y - 75, 9);

    const finalPdfBytes = await pdfDoc.save();
    return Buffer.from(finalPdfBytes);
};

module.exports = { generateToolboxReport };
