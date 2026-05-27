import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-toastify';

export const generateToolboxPdf = async (toolbox, assets, returnedAssets, responsavelNome) => {
    try {
        const doc = new jsPDF('p', 'mm', 'a4'); // Portrait A4
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const ML = 15; // Left margin
        const MR = 15; // Right margin
        const usableW = pageWidth - ML - MR;

        // --- 1. CABEÇALHO ISO/SGQ ---
        const hY = 15;
        const hH = 22;
        doc.setDrawColor(0);
        doc.setLineWidth(0.4);
        doc.rect(ML, hY, usableW, hH);

        // Grid do Cabeçalho
        const col1 = ML + 45; // Fim da Logo
        const col2 = ML + 140; // Inicio Info Código/Revisão
        doc.setLineWidth(0.2);
        doc.line(col1, hY, col1, hY + hH);
        doc.line(col2, hY, col2, hY + hH);

        // Texto Logo e Empresa
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('METALFISA', ML + 6, hY + 9);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.text('Transformando metais em excelência', ML + 2, hY + 13);
        doc.text('METALFISA METALURGICA LTDA', ML + 5, hY + 17);

        // Título Central
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('TERMO DE RESPONSABILIDADE', col1 + (col2 - col1) / 2, hY + 9, { align: 'center' });
        doc.text('CAIXA DE FERRAMENTAS', col1 + (col2 - col1) / 2, hY + 16, { align: 'center' });

        // Informações da Direita (SGQ Info)
        doc.setFontSize(8);
        doc.text('CÓDIGO:', col2 + 2, hY + 6);
        doc.setFont('helvetica', 'normal');
        doc.text(toolbox.name || 'N/A', col2 + 20, hY + 6);
        doc.line(col2, hY + 11, col2 + (usableW - (col2 - ML)), hY + 11);
        
        doc.setFont('helvetica', 'bold');
        doc.text('DATA:', col2 + 2, hY + 17);
        doc.setFont('helvetica', 'normal');
        doc.text(new Date().toLocaleDateString('pt-BR'), col2 + 15, hY + 17);

        // --- 2. INFORMAÇÕES DA CAIXA E COLABORADOR ---
        let currentY = hY + hH + 10;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Responsável pela Custódia:', ML, currentY);
        doc.setFont('helvetica', 'normal');
        doc.text(responsavelNome || 'Não atribuído', ML + 48, currentY);
        
        currentY += 8;
        doc.setFont('helvetica', 'bold');
        doc.text('Identificação da Caixa:', ML, currentY);
        doc.setFont('helvetica', 'normal');
        doc.text(toolbox.name || '', ML + 42, currentY);
        
        currentY += 12;

        // --- 3. TERMO DE COMPROMISSO ---
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const termo = "Declaro ter recebido da METALFISA METALÚRGICA LTDA as ferramentas e instrumentos de medição listados abaixo, em perfeitas condições de uso e funcionamento. Comprometo-me a zelar pela sua conservação e correta utilização técnica, responsabilizando-me integralmente por eventuais perdas, extravios ou danos causados por mau uso ou negligência. Concordo também em apresentá-los sempre que solicitado para inspeção ou calibração.";
        
        const splitTermo = doc.splitTextToSize(termo, usableW);
        doc.text(splitTermo, ML, currentY);
        currentY += (splitTermo.length * 4) + 8;

        // --- 4. LISTA DE ATIVOS ---
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Relação de Ativos / Ferramentas', ML, currentY);
        currentY += 4;

        const tableData = [];
        if (Array.isArray(assets) && assets.length > 0) {
            assets.forEach((a, i) => {
                tableData.push([
                    { content: String(i + 1).padStart(2, '0'), styles: { halign: 'center' } },
                    { content: a.assigned_quantity || 1, styles: { halign: 'center' } },
                    { content: a.patrimonio || a.serial_number || '-' },
                    { content: a.name },
                    { content: a.model || '-' },
                    { content: new Date(a.assigned_at).toLocaleDateString('pt-BR') }
                ]);
            });
        } else {
            tableData.push([{ content: 'Nenhum ativo vinculado a esta caixa.', colSpan: 5, styles: { halign: 'center' } }]);
        }

        autoTable(doc, {
            startY: currentY,
            head: [['Nº', 'Qtd', 'Patrimônio/Série', 'Descrição da Ferramenta/Instrumento', 'Modelo', 'Data de Inclusão']],
            body: tableData,
            theme: 'grid',
            headStyles: {
                fillColor: [240, 240, 240],
                textColor: [0, 0, 0],
                fontStyle: 'bold',
                lineColor: [100, 100, 100],
                lineWidth: 0.1,
            },
            bodyStyles: {
                fontSize: 9,
                textColor: [40, 40, 40],
                lineColor: [200, 200, 200],
                lineWidth: 0.1,
                cellPadding: 4,
            },
            columnStyles: {
                0: { cellWidth: 10 },
                1: { cellWidth: 15 },
                2: { cellWidth: 35 },
                3: { cellWidth: 'auto' },
                4: { cellWidth: 35 },
                5: { cellWidth: 30 }
            },
            margin: { left: ML, right: MR },
            didDrawPage: (data) => {
                // Footer na paginação SGQ
                const pgStr = `Página ${doc.internal.getCurrentPageInfo().pageNumber}`;
                doc.setFontSize(7);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(100, 100, 100);
                
                const footerY = pageHeight - 10;
                doc.text('Documento Original MetalFisa - Sistema SGQ ' + new Date().getFullYear(), ML, footerY);
                doc.text(pgStr, pageWidth - MR, footerY, { align: 'right' });
                doc.setTextColor(0, 0, 0);
            }
        });

        let finalY = doc.lastAutoTable.finalY + 15;

        // --- 5. HISTÓRICO DE DEVOLUÇÕES ---
        if (returnedAssets && returnedAssets.length > 0) {
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text('Histórico de Devoluções', ML, finalY);
            finalY += 4;

            const returnedData = returnedAssets.map((r, i) => [
                { content: String(i + 1).padStart(2, '0'), styles: { halign: 'center' } },
                { content: r.returned_quantity || 1, styles: { halign: 'center' } },
                { content: r.patrimonio || r.serial_number || '-' },
                { content: r.name },
                { content: new Date(r.returned_at).toLocaleDateString('pt-BR') }
            ]);

            autoTable(doc, {
                startY: finalY,
                head: [['Nº', 'Qtd', 'Patrimônio/Série', 'Descrição da Ferramenta', 'Data da Devolução']],
                body: returnedData,
                theme: 'grid',
                headStyles: {
                    fillColor: [255, 240, 240], // Light red header for returns
                    textColor: [150, 0, 0],
                    fontStyle: 'bold',
                    lineColor: [200, 150, 150],
                    lineWidth: 0.1,
                },
                bodyStyles: {
                    fontSize: 8,
                    textColor: [80, 80, 80],
                    lineColor: [200, 200, 200],
                    lineWidth: 0.1,
                    cellPadding: 3,
                },
                columnStyles: {
                    0: { cellWidth: 10 },
                    1: { cellWidth: 15 },
                    2: { cellWidth: 35 },
                    3: { cellWidth: 'auto' },
                    4: { cellWidth: 35 }
                },
                margin: { left: ML, right: MR }
            });

            finalY = doc.lastAutoTable.finalY + 25;
        } else {
            finalY += 10;
        }

        // --- 6. ASSINATURAS ---
        if (finalY + 30 > pageHeight - 20) {
            doc.addPage();
            finalY = 30;
        }

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        
        doc.line(ML + 10, finalY, ML + 80, finalY);
        doc.text('Assinatura do Colaborador (Responsável)', ML + 45, finalY + 5, { align: 'center' });
        doc.text(`Nome: ${responsavelNome}`, ML + 45, finalY + 9, { align: 'center' });

        doc.line(pageWidth - MR - 80, finalY, pageWidth - MR - 10, finalY);
        doc.text('Responsável pela Entrega (SGQ/Almoxarifado)', pageWidth - MR - 45, finalY + 5, { align: 'center' });
        doc.text('Data: _____/_____/_______', pageWidth - MR - 45, finalY + 9, { align: 'center' });

        doc.save(`Termo_Caixa_${toolbox.name.replace(/[\/\s]/g, '_')}.pdf`);
        toast.success(`Relatório gerado: ${toolbox.name}`);
        return true;
    } catch (error) {
        console.error('Erro ao gerar PDF da Caixa:', error);
        toast.error('Ocorreu um erro ao gerar o documento PDF.');
        throw error;
    }
};
