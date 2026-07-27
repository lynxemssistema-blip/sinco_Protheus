import jsPDFLib from 'jspdf';
const jsPDF = jsPDFLib.jsPDF || jsPDFLib;
import autoTable from 'jspdf-autotable';
import { logoBase64 } from './metalfisaLogoBase64';
import { toast } from 'react-toastify';

// Helper para converter URL em Base64
const getBase64ImageFromUrl = async (url) => {
    try {
        const absoluteUrl = url.startsWith('http') ? url : (window.location.origin + url);
        const res = await fetch(absoluteUrl);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const blob = await res.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.error('Erro ao converter imagem para base64:', e);
        return null;
    }
};

// Helper para obter proporções reais da imagem
const getImageDimensions = (base64Str) => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            resolve({ width: img.width, height: img.height });
        };
        img.onerror = () => {
            resolve({ width: 0, height: 0 });
        };
        img.src = base64Str;
    });
};

export const generateChecklistPdf = async (checklist, targetRow, currentUser, includeParent = true) => {
    try {
        const doc = new jsPDF('landscape', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
        const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
        const ML = 14;
        const MR = 14;
        const usableW = pageWidth - ML - MR; // 269mm

        // --- CABEÇALHO PADRÃO ---
        const drawHeader = (pageDoc, currentY, pageNumber) => {
            let hY = currentY || 5;
            const hH = 16;

            // Box principal do Header
            pageDoc.setDrawColor(30, 58, 95);
            pageDoc.setLineWidth(0.3);
            pageDoc.rect(ML, hY, usableW, hH);

            const col1 = ML + 55;  // Linha da logo (69mm)
            const col2 = ML + 185; // Linha do título (199mm)

            pageDoc.setLineWidth(0.2);
            pageDoc.line(col1, hY, col1, hY + hH);
            pageDoc.line(col2, hY, col2, hY + hH);

            // Logotipo
            try {
                if (logoBase64) {
                    pageDoc.addImage(logoBase64, 'PNG', ML + 6, hY + 1.5, 36, 13);
                } else {
                    pageDoc.setFontSize(12);
                    pageDoc.setFont('helvetica', 'bold');
                    pageDoc.setTextColor(30, 58, 95);
                    pageDoc.text('METALFISA', ML + 10, hY + 10);
                }
            } catch (e) {
                pageDoc.setFontSize(12);
                pageDoc.setFont('helvetica', 'bold');
                pageDoc.setTextColor(30, 58, 95);
                pageDoc.text('METALFISA', ML + 10, hY + 10);
            }

            // Título
            pageDoc.setTextColor(30, 58, 95);
            pageDoc.setFontSize(12);
            pageDoc.setFont('helvetica', 'bold');
            pageDoc.text('Checklist de Montagem de Conjuntos', col1 + 6, hY + 8);

            pageDoc.setFontSize(8.5);
            pageDoc.setFont('helvetica', 'normal');
            pageDoc.setTextColor(80, 80, 80);
            if (includeParent) {
                pageDoc.text(`OP: ${targetRow.op}-${targetRow.item_op}`, col1 + 6, hY + 13);
            } else {
                pageDoc.text('Relatório Avulso de Componentes', col1 + 6, hY + 13);
            }

            // Metadados do relatório
            pageDoc.setFontSize(7.5);
            pageDoc.setTextColor(50, 50, 50);
            pageDoc.text(`Data/Hora Impressão: ${new Date().toLocaleString('pt-BR')}`, col2 + 4, hY + 6);
            pageDoc.text(`Operador: ${currentUser?.nome || 'Sistema'}`, col2 + 4, hY + 10);
            pageDoc.text(`Pág: ${pageNumber}`, col2 + 4, hY + 14);

            return hY + hH + 6;
        };

        // Primeira página
        let y = drawHeader(doc, 5, 1);

        // --- SEÇÃO DE DETALHES DO CHECKLIST ---
        doc.setDrawColor(220, 225, 230);
        doc.setFillColor(245, 247, 250);
        doc.rect(ML, y, usableW, 26, 'F');
        doc.rect(ML, y, usableW, 26, 'S');

        doc.setTextColor(30, 58, 95);
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        
        doc.text('INFORMAÇÕES GERAIS', ML + 4, y + 5);

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');

        // Formatação da data informada
        let dataFmt = '-';
        if (checklist.data_finalizado) {
            const d = new Date(checklist.data_finalizado);
            dataFmt = d.toLocaleString('pt-BR');
        }

        if (includeParent) {
            // Linha 1 de Informações (Landscape Spacing)
            doc.text(`OP: ${targetRow.op}-${targetRow.item_op} (Seq: ${targetRow.sequen_op || '001'})`, ML + 4, y + 11);
            doc.text(`Produto: ${targetRow.produto}`, ML + 90, y + 11);
            doc.text(`Qtd. Conjuntos: ${checklist.qtd_conjuntos || 1}`, ML + 195, y + 11);

            // Linha 2 de Informações
            doc.text(`Descrição: ${targetRow.desc_produto}`, ML + 4, y + 17);
            doc.text(`Data Finalização: ${dataFmt}`, ML + 195, y + 17);

            // Linha 3 de Informações (Status e Usuário)
            const isFinalized = checklist.status === 'FINALIZADO';
            doc.setFont('helvetica', 'bold');
            doc.text('Status:', ML + 4, y + 23);
            doc.setTextColor(isFinalized ? 16 : 217, isFinalized ? 124 : 119, isFinalized ? 65 : 6); // verde vs laranja
            doc.text(checklist.status || 'RASCUNHO', ML + 15, y + 23);
            
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'normal');
            doc.text(`Registro Realizado em: ${checklist.real_datetime ? new Date(checklist.real_datetime).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR')}`, ML + 90, y + 23);
        } else {
            // Linha 1 de Informações sem dados do pai
            doc.text(`Qtd. Conjuntos: ${checklist.qtd_conjuntos || 1}`, ML + 4, y + 11);
            doc.text(`Data Finalização: ${dataFmt}`, ML + 90, y + 11);

            const isFinalized = checklist.status === 'FINALIZADO';
            doc.setFont('helvetica', 'bold');
            doc.text('Status:', ML + 195, y + 11);
            doc.setTextColor(isFinalized ? 16 : 217, isFinalized ? 124 : 119, isFinalized ? 65 : 6); // verde vs laranja
            doc.text(checklist.status || 'RASCUNHO', ML + 206, y + 11);

            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'normal');
            doc.text(`Registro Realizado em: ${checklist.real_datetime ? new Date(checklist.real_datetime).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR')}`, ML + 4, y + 18);
        }

        y += 32;

        // --- TABELA DE ITENS DO CHECKLIST ---
        const tableHead = [['Montado', 'Código', 'Descrição', 'Qtd Pedida', 'Qtd Feita', 'Observação Individual', 'Foto?']];
        const tableRows = (checklist.itens || []).map(item => {
            const checkSymbol = item.montado ? '[X] SIM' : '[ ] NÃO';
            const pedida = (parseFloat(item.qtd_necessaria || 1) * (parseFloat(targetRow.qtd_op) || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
            const feita = parseFloat(item.qtd_montada || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
            return [
                checkSymbol,
                item.codigo_componente || '',
                item.descricao_componente || '',
                pedida,
                feita,
                item.observacao || '',
                item.foto_url ? 'Sim' : 'Não'
            ];
        });

        autoTable(doc, {
            startY: y,
            head: tableHead,
            body: tableRows,
            theme: 'grid',
            headStyles: {
                fillColor: [30, 58, 95],
                textColor: [255, 255, 255],
                fontSize: 8,
                halign: 'left',
                fontStyle: 'bold'
            },
            bodyStyles: {
                fontSize: 7.5,
                textColor: [30, 30, 30]
            },
            columnStyles: {
                0: { cellWidth: 25, fontStyle: 'bold', textColor: [16, 124, 65] }, // verde para o SIM
                1: { cellWidth: 40, fontStyle: 'bold' },
                2: { cellWidth: 85 },
                3: { cellWidth: 22, halign: 'right' },
                4: { cellWidth: 22, halign: 'right' },
                5: { cellWidth: 60 },
                6: { cellWidth: 15, halign: 'center' }
            },
            margin: { top: 28, left: ML, right: MR }, // top margin garante que páginas subsequentes não sobreponham o header
            didParseCell: (data) => {
                if (data.column.index === 0 && data.cell.text[0] === '[ ] NÃO') {
                    data.cell.styles.textColor = [185, 28, 28]; // Vermelho para o Não montado
                }
            },
            didDrawPage: (data) => {
                if (data.pageNumber > 1) {
                    drawHeader(doc, 5, data.pageNumber);
                }
            }
        });

        // Nota Geral
        let finalY = doc.lastAutoTable.finalY + 8;
        
        // Verifica se cabe na página atual (Landscape), senão quebra página
        if (finalY + 25 > 200) {
            doc.addPage();
            drawHeader(doc, 5, doc.internal.getNumberOfPages());
            finalY = 28;
        }

        doc.setDrawColor(200, 200, 200);
        doc.setFillColor(252, 252, 252);
        doc.rect(ML, finalY, usableW, 20, 'F');
        doc.rect(ML, finalY, usableW, 20, 'S');

        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 58, 95);
        doc.text('OBSERVAÇÕES / NOTAS GERAIS DO CHECKLIST', ML + 4, finalY + 5);

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50, 50, 50);
        
        const splitNote = doc.splitTextToSize(checklist.observacao_geral || 'Nenhuma observação geral informada.', usableW - 8);
        doc.text(splitNote, ML + 4, finalY + 10);

        // --- ANEXO FOTOGRÁFICO ---
        const itemsWithPhotos = (checklist.itens || []).filter(i => i.foto_url);
        const hasParentPhoto = !!checklist.foto_url_pai;
        
        if (hasParentPhoto || itemsWithPhotos.length > 0) {
            let photoPageNum = doc.internal.getNumberOfPages();

            // 1. Renderizar foto do produto pai se existir
            if (hasParentPhoto) {
                const base64 = await getBase64ImageFromUrl(checklist.foto_url_pai);
                if (base64) {
                    doc.addPage();
                    photoPageNum++;
                    drawHeader(doc, 5, photoPageNum);

                    // Título do Anexo
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(30, 58, 95);
                    doc.text('ANEXO FOTOGRÁFICO - PRODUTO PAI (GERAL)', ML, 28);
                    
                    doc.setFontSize(8.5);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(80, 80, 80);
                    doc.text(`Código: ${targetRow.produto} - Descrição: ${targetRow.desc_produto || ''}`, ML, 32);

                    if (checklist.observacao_geral) {
                        doc.setFont('helvetica', 'italic');
                        doc.text(`Nota Geral: ${checklist.observacao_geral}`, ML, 36);
                    }

                    // Calcular dimensões proporcionais para Landscape
                    const dims = await getImageDimensions(base64);
                    let imgW = 180;
                    let imgH = 135;
                    if (dims.width > 0 && dims.height > 0) {
                        const ratio = dims.width / dims.height;
                        if (ratio > 1.33) {
                            imgW = 180;
                            imgH = 180 / ratio;
                        } else {
                            imgH = 135;
                            imgW = 135 * ratio;
                        }
                    }

                    const startX = ML + (usableW - imgW) / 2;
                    const startY = 42;

                    try {
                        doc.addImage(base64, 'JPEG', startX, startY, imgW, imgH);
                    } catch (err) {
                        console.error('Erro ao desenhar foto do pai no PDF:', err);
                        doc.text('Falha ao renderizar a imagem anexada do produto pai.', ML, startY + 10);
                    }
                }
            }

            // 2. Renderizar fotos dos componentes
            for (const item of itemsWithPhotos) {
                const base64 = await getBase64ImageFromUrl(item.foto_url);
                if (base64) {
                    doc.addPage();
                    photoPageNum++;
                    drawHeader(doc, 5, photoPageNum);

                    // Título do Anexo
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(30, 58, 95);
                    doc.text(`Anexo Fotográfico - Componente: ${item.codigo_componente}`, ML, 28);
                    
                    doc.setFontSize(8.5);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(80, 80, 80);
                    doc.text(item.descricao_componente || '', ML, 32);

                    if (item.observacao) {
                        doc.setFont('helvetica', 'italic');
                        doc.text(`Nota: ${item.observacao}`, ML, 36);
                    }

                    // Calcular dimensões
                    const dims = await getImageDimensions(base64);
                    let imgW = 180;
                    let imgH = 135;
                    if (dims.width > 0 && dims.height > 0) {
                        const ratio = dims.width / dims.height;
                        if (ratio > 1.33) {
                            imgW = 180;
                            imgH = 180 / ratio;
                        } else {
                            imgH = 135;
                            imgW = 135 * ratio;
                        }
                    }

                    const startX = ML + (usableW - imgW) / 2;
                    const startY = 42;

                    try {
                        doc.addImage(base64, 'JPEG', startX, startY, imgW, imgH);
                    } catch (err) {
                        console.error('Erro ao desenhar imagem no PDF:', err);
                        doc.text('Falha ao renderizar a imagem anexada.', ML, startY + 10);
                    }
                }
            }
        }

        // Salvar documento
        doc.save(`Checklist_OP_${targetRow.op}_${targetRow.item_op}.pdf`);
        toast.success('Relatório PDF gerado e baixado!');
    } catch (e) {
        console.error('Erro ao gerar PDF do checklist:', e);
        toast.error('Erro ao gerar relatório PDF.');
    }
};
