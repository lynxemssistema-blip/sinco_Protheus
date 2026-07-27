import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { getFileUrl } from './api';
import { toast } from 'react-toastify';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateMergedDrawingsPdf = async (structure, rootCode, productStatuses = {}) => {
    if (!structure || structure.length === 0) {
        toast.warning("A estrutura está vazia.");
        return;
    }

    const toastId = toast.loading(`Preparando download dos desenhos para ${rootCode}...`);

    try {
        const mergedPdf = await PDFDocument.create();
        
        // Find items that have attached files.
        const itemsWithFiles = structure.filter(item => item.tem_arquivos && item.primeiro_arquivo);

        if (itemsWithFiles.length === 0) {
            toast.update(toastId, { render: "Nenhum desenho (anexo) encontrado nesta estrutura.", type: "warning", isLoading: false, autoClose: 4000 });
            return;
        }

        let processed = 0;
        let successCount = 0;
        const total = itemsWithFiles.length;

        for (const item of itemsWithFiles) {
            try {
                const url = getFileUrl(`/api/docs/view?path=${encodeURIComponent(item.primeiro_arquivo)}`);
                const response = await fetch(url);
                
                if (!response.ok) {
                    console.warn(`Arquivo não encontrado para ${item.codigo}: ${response.status}`);
                    continue; 
                }

                const arrayBuffer = await response.arrayBuffer();
                
                const pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
                const helveticaFont = await pdf.embedFont(StandardFonts.HelveticaBold);
                
                const pages = pdf.getPages();
                const qtd = parseFloat(item.qtd_necessaria || 0);
                const qtdFormatada = qtd % 1 === 0 ? qtd.toString() : qtd.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
                const status = productStatuses[item.codigo] || 'NORMAL';
                const statusText = status !== 'NORMAL' ? ` - STATUS ENG: ${status}` : '';
                const text = `QTD: ${qtdFormatada}${statusText}`;

                // 10mm ~ 28.34 points font size
                const fontSize = 28;

                // Adjust color based on status
                let textColor = rgb(0.85, 0.1, 0.1); // Bright Red (default / NOVO / NORMAL)
                if (status === 'REVISAO') {
                    textColor = rgb(0.9, 0.6, 0.0); // Orange/Yellow
                } else if (status === 'NOVO') {
                    textColor = rgb(0.1, 0.6, 0.1); // Green
                }

                for (const page of pages) {
                    const { width, height } = page.getSize();
                    // Origin (0,0) is bottom-left
                    page.drawText(text, {
                        x: 30,
                        y: height - 40,
                        size: fontSize,
                        font: helveticaFont,
                        color: textColor,
                    });
                }
                
                const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                copiedPages.forEach(p => mergedPdf.addPage(p));
                successCount++;

            } catch (err) {
                console.error(`Erro ao processar PDF do item ${item.codigo}:`, err);
            }

            processed++;
            // Update the toast directly 
            toast.update(toastId, { render: `Processando desenhos: ${processed}/${total}...` });
        }

        if (successCount === 0) {
            toast.update(toastId, { render: "Nenhum PDF de desenho pôde ser carregado, gerando apenas o resumo.", type: "warning", isLoading: false, autoClose: 4000 });
        } else {
            toast.update(toastId, { render: "Gerando páginas de resumo...", type: "info" });
        }
        
        // --- GERAR PÁGINAS DE RESUMO (jsPDF) ---
        const doc = new jsPDF('p', 'pt', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const marginX = 40;

        doc.setFontSize(16);
        doc.text(`Resumo da Estrutura: ${rootCode}`, marginX, 50);

        // 1. Materiais Aglutinados
        const materiaisMap = new Map();
        structure.forEach(item => {
            const code = item.codigo?.trim();
            if (!code) return;
            
            const currentQtd = parseFloat(item.qtd_necessaria || 0);
            
            if (materiaisMap.has(code)) {
                materiaisMap.get(code).qtd += currentQtd;
            } else {
                materiaisMap.set(code, {
                    codigo: code,
                    descricao: item.descricao?.trim() || '',
                    unidade: item.unidade?.trim() || '',
                    qtd: currentQtd
                });
            }
        });

        const BOM = Array.from(materiaisMap.values())
            .sort((a, b) => a.descricao.localeCompare(b.descricao));
            
        doc.setFontSize(12);
        doc.text('Lista de Materiais (Aglutinada)', marginX, 80);
        
        autoTable(doc, {
            startY: 90,
            head: [['Código', 'Descrição', 'UN', 'Qtde Total']],
            body: BOM.map(m => [
                m.codigo, 
                m.descricao, 
                m.unidade, 
                m.qtd % 1 === 0 ? m.qtd.toString() : m.qtd.toLocaleString('pt-BR', { maximumFractionDigits: 4 })
            ]),
            styles: { fontSize: 9 },
            headStyles: { fillColor: [41, 128, 185] }, 
            margin: { left: marginX, right: marginX }
        });

        let finalY = doc.lastAutoTable.finalY || 100;
        
        // Verifica se precisa de uma nova página para o título da próxima tabela
        if (finalY > doc.internal.pageSize.getHeight() - 100) {
            doc.addPage();
            finalY = 50;
        } else {
            finalY += 40;
        }

        doc.setFontSize(12);
        doc.text('Todos os Documentos da Estrutura', marginX, finalY);

        const docs = structure.map(item => {
            const status = productStatuses[item.codigo] || 'NORMAL';
            return [
                item.nivel.toString(),
                item.codigo,
                item.descricao?.trim() || '',
                (item.tem_arquivos && item.primeiro_arquivo) ? 'SIM' : 'NÃO',
                status
            ];
        });

        autoTable(doc, {
            startY: finalY + 15,
            head: [['Nível', 'Código', 'Descrição', 'Acompanha PDF?', 'Status Eng.']],
            body: docs,
            styles: { fontSize: 9 },
            headStyles: { fillColor: [41, 128, 185] },
            margin: { left: marginX, right: marginX }
        });

        // Converter o PDF do resumo para buffer e fazer o merge usando pdf-lib
        const summaryBuffer = doc.output('arraybuffer');
        const summaryPdfDoc = await PDFDocument.load(summaryBuffer, { ignoreEncryption: true });
        const summaryPages = await mergedPdf.copyPages(summaryPdfDoc, summaryPdfDoc.getPageIndices());
        summaryPages.forEach(p => mergedPdf.addPage(p));
        // --- FIM PÁGINAS DE RESUMO ---

        toast.update(toastId, { render: "Finalizando arquivo final, aguarde...", type: "info" });
        
        // Save merged PDF and trigger download
        const pdfBytes = await mergedPdf.save({ useObjectStreams: false });
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const urlBlob = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = urlBlob;
        link.download = `Desenhos_Estrutura_${rootCode}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Cleanup after a moment
        setTimeout(() => URL.revokeObjectURL(urlBlob), 500);

        toast.update(toastId, { render: `PDF com ${successCount} desenhos gerado com sucesso!`, type: "success", isLoading: false, autoClose: 5000 });

    } catch (error) {
        console.error("Erro fatal ao gerar PDF de desenhos:", error);
        toast.update(toastId, { render: "Ocorreu um erro ao montar o PDF final.", type: "error", isLoading: false, autoClose: 4000 });
    }
};
