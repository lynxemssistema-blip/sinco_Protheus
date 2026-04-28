import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

// Reusing safe date format from modal
const safeDate = (dateVal) => {
    if (!dateVal) return new Date();
    if (dateVal instanceof Date) return new Date(dateVal.getFullYear(), dateVal.getMonth(), dateVal.getDate(), 12, 0, 0);
    const str = String(dateVal);
    const ymd = str.split('T')[0];
    if (ymd.length === 10) return new Date(ymd + 'T12:00:00');
    return new Date(dateVal);
};

const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = safeDate(dateStr);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${day}/${m}/${y}`;
};

export const generateGanttPDF = async (opData, orderedGroups, operationPlans, ganttElement = null) => {
    try {
        const doc = new jsPDF('l', 'mm', 'a4'); // Landscape A4 = 297 × 210 mm

        const pageWidth  = doc.internal.pageSize.getWidth();  // 297
        const pageHeight = doc.internal.pageSize.getHeight(); // 210
        const ML = 10; // margem esquerda
        const MR = 10; // margem direita
        const usableW = pageWidth - ML - MR; // 277 mm

        // ── 1. CABEÇALHO ──────────────────────────────────────────────────────
        const hY = 8;
        const hH = 16;
        
        const drawHeader = (titleText) => {
            doc.setDrawColor(0);
            doc.setLineWidth(0.3);
            doc.rect(ML, hY, usableW, hH);

            // Divisórias verticais
            const col1 = ML + 52;   // logo → empresa
            const col2 = ML + 165;  // empresa → info central
            const col3 = ML + 222;  // info central → nº pedido
            doc.setLineWidth(0.2);
            [col1, col2, col3].forEach(x => doc.line(x, hY, x, hY + hH));

            // ── Bloco LOGO
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.text('METALFISA', ML + 4, hY + 6);
            doc.setFontSize(5.5);
            doc.setFont('helvetica', 'normal');
            doc.text('Transformando metais em excelência', ML + 4, hY + 10);

            // ── Bloco EMPRESA
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'bold');
            doc.text('METALFISA METALURGICA LTDA', col1 + 3, hY + 5.5);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.text('R. Américo Santiago Piacenza, 516  —  CNPJ: 23.881.592/0001-01', col1 + 3, hY + 9.5);
            doc.text('PCP - Planejamento e Controle de Produção', col1 + 3, hY + 13.5);

            // ── Bloco INFO CENTRAL
            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'bold');
            doc.text('EMISSÃO:', col2 + 3, hY + 5.5);
            doc.setFont('helvetica', 'normal');
            doc.text(formatDate(new Date()), col2 + 20, hY + 5.5);

            const opNumber = opData?.op || opData?.c2_num || 'N/A';
            
            // ── Bloco Nº PEDIDO / OP
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text(titleText, col3 + (usableW - (col3 - ML)) / 2, hY + 5.5, { align: 'center' });
            doc.setFontSize(8);
            doc.text(`OP: ${opNumber}`, col3 + (usableW - (col3 - ML)) / 2, hY + 10.5, { align: 'center' });
            
            return opNumber;
        };

        const opNumber = drawHeader('PLANEJAMENTO SEQUENCIAL');
        
        // ── 2. CAIXA CLIENTE / PRODUTO ─────────────────────────────────────────
        const cliY = hY + hH + 2;
        const cliH = 8;
        
        const drawProductBox = () => {
            doc.setLineWidth(0.3);
            doc.rect(ML, cliY, usableW, cliH);

            doc.setFontSize(5.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(100, 100, 100);
            doc.text('PRODUTO / PEÇA', ML + 2, cliY + 3);
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            
            const productName = opData?.desc_produto || opData?.produto || 'MÚLTIPLOS ITENS';
            const clientName = opData?.nome_cliente || opData?.cliente || '';
            const prodClientText = clientName ? `${productName}  |  Cliente: ${clientName}` : productName;
            
            doc.text(prodClientText, ML + 2, cliY + 6.5);
        };
        
        drawProductBox();

        // ── 3. TABELA DE GANTT ────────────────────────────────────────────────
        const tableStartY = cliY + cliH + 4;

        const tableColumns = [
            '#',             // 0
            'Código Recurso',// 1
            'Recurso / Operação (Agrupado)', // 2
            'Início Planejado',// 3
            'Fim Planejado',   // 4
            'Dias Úteis'       // 5
        ];

        // Filtra apenas grupos selecionados
        const validGroups = orderedGroups.filter(g => operationPlans[g.code]?.selected);

        const tableRows = validGroups.map((group, index) => {
            const plan = operationPlans[group.code] || {};
            
            return [
                (index + 1).toString(),
                group.code,
                group.desc,
                formatDate(plan.start),
                formatDate(plan.end),
                `${plan.duracao || 0} d`
            ];
        });

        autoTable(doc, {
            startY: tableStartY,
            head: [tableColumns],
            body: tableRows,
            theme: 'grid',
            headStyles: {
                fillColor: [30, 30, 30],
                textColor: [255, 255, 255],
                lineColor: [0, 0, 0],
                lineWidth: 0.2,
                fontSize: 7,
                fontStyle: 'bold',
                halign: 'center',
                valign: 'middle',
                cellPadding: 1.5,
            },
            bodyStyles: {
                lineColor: [180, 180, 180],
                lineWidth: 0.1,
                fontSize: 7,
                textColor: [0, 0, 0],
                cellPadding: 1.5,
            },
            alternateRowStyles: {
                fillColor: [248, 249, 250],
            },
            columnStyles: {
                0: { halign: 'center', cellWidth: 10 },
                1: { halign: 'center', cellWidth: 35 },
                2: { halign: 'left',   cellWidth: 'auto' },
                3: { halign: 'center', cellWidth: 35 },
                4: { halign: 'center', cellWidth: 35 },
                5: { halign: 'center', cellWidth: 25 },
            },
            margin: { top: 8, left: ML, right: MR, bottom: 20 },
            didDrawPage: (data) => {
                const pgStr = `Pág. ${doc.internal.getCurrentPageInfo().pageNumber}`;
                doc.setFontSize(6);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(120, 120, 120);
                doc.text(pgStr, pageWidth - MR, pageHeight - 5, { align: 'right' });
                doc.setTextColor(0, 0, 0);
            },
        });

        // ── 4. DESENHO DO GANTT EM NOVA PÁGINA (OPCIONAL) ─────────────────────────
        if (ganttElement) {
            try {
                // Temporarily expand element to capture everything without scrollbars
                const originalOverflow = ganttElement.style.overflow;
                const originalHeight = ganttElement.style.height;
                ganttElement.style.overflow = 'visible';
                ganttElement.style.height = 'max-content';

                // Captura o HTML do Gantt Renderizado
                const canvas = await html2canvas(ganttElement, {
                    scale: 2, // Maior resolução
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    windowWidth: ganttElement.scrollWidth,
                    windowHeight: ganttElement.scrollHeight
                });

                // Restore styles
                ganttElement.style.overflow = originalOverflow;
                ganttElement.style.height = originalHeight;
                
                const imgData = canvas.toDataURL('image/png');
                
                // Adiciona uma nova página em paisagem
                doc.addPage('a4', 'l');
                
                // Re-desenha cabeçalho
                drawHeader('GRÁFICO GANTT VISUAL');
                drawProductBox();
                
                // Dimensões para acomodar a imagem
                const imgProps = doc.getImageProperties(imgData);
                const pdfWidth = usableW;
                const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                
                const startY = cliY + cliH + 4;
                const maxAvailableHeight = pageHeight - startY - 15; // margin bottom

                let finalWidth = pdfWidth;
                let finalHeight = pdfHeight;
                
                // Fit à altura se necessário (pra não sair cortado)
                if (pdfHeight > maxAvailableHeight) {
                    finalHeight = maxAvailableHeight;
                    finalWidth = (imgProps.width * finalHeight) / imgProps.height;
                }

                const xOffset = ML + (usableW - finalWidth) / 2;

                doc.addImage(imgData, 'PNG', xOffset, startY, finalWidth, finalHeight);

                // Rodapé da página extra
                const pgStr2 = `Pág. ${doc.internal.getCurrentPageInfo().pageNumber}`;
                doc.setFontSize(6);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(120, 120, 120);
                doc.text(pgStr2, pageWidth - MR, pageHeight - 5, { align: 'right' });
                doc.setTextColor(0, 0, 0);

            } catch (err) {
                console.error("Erro ao gerar imagem com html2canvas: ", err);
            }
        }

        doc.save(`Gantt_Sequencial_OP_${opNumber}.pdf`);
        return true;
    } catch (error) {
        console.error('Erro ao gerar PDF do Gantt:', error);
        throw error;
    }
};
