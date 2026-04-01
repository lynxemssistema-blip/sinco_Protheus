import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-toastify';

export const generateCargoPdf = async (cargo) => {
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
        doc.text('DESCRIÇÃO DE CARGO E FUNÇÃO', col1 + (col2 - col1) / 2, hY + 12, { align: 'center' });

        // Informações da Direita (SGQ Info)
        doc.setFontSize(8);
        doc.text('CÓDIGO:', col2 + 2, hY + 6);
        doc.setFont('helvetica', 'normal');
        doc.text(cargo.codigo_interno || 'N/A', col2 + 20, hY + 6);
        doc.line(col2, hY + 11, col2 + (usableW - (col2 - ML)), hY + 11);
        
        doc.setFont('helvetica', 'bold');
        doc.text('CBO:', col2 + 2, hY + 17);
        doc.setFont('helvetica', 'normal');
        doc.text(cargo.cbo || 'N/A', col2 + 15, hY + 17);

        // --- 2. INFORMAÇÕES DO CARGO ---
        let currentY = hY + hH + 10;
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('1. IDENTIFICAÇÃO DO CARGO', ML, currentY);
        doc.line(ML, currentY + 2, pageWidth - MR, currentY + 2);
        currentY += 10;

        doc.setFontSize(10);
        doc.text('Denominação do Cargo:', ML, currentY);
        doc.setFont('helvetica', 'normal');
        doc.text(cargo.denominacao.toUpperCase(), ML + 45, currentY);
        currentY += 8;

        doc.setFont('helvetica', 'bold');
        doc.text('CBO Registro:', ML, currentY);
        doc.setFont('helvetica', 'normal');
        doc.text(cargo.cbo || 'Não informado', ML + 30, currentY);
        currentY += 15;

        // --- 3. ATIVIDADES E RESPONSABILIDADES ---
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('2. ATIVIDADES E RESPONSABILIDADES PRINCIPAIS', ML, currentY);
        doc.line(ML, currentY + 2, pageWidth - MR, currentY + 2);
        currentY += 10;

        const tableData = [];
        if (Array.isArray(cargo.atividades) && cargo.atividades.length > 0) {
            cargo.atividades.forEach((atv, i) => {
                tableData.push([
                    { content: String(i + 1).padStart(2, '0'), styles: { halign: 'center', fontStyle: 'bold' } },
                    { content: atv }
                ]);
            });
        } else {
            tableData.push(['-', 'Nenhuma atividade cadastrada.']);
        }

        autoTable(doc, {
            startY: currentY,
            head: [['Item', 'Descrição da Atividade']],
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
                0: { cellWidth: 15 },
                1: { cellWidth: 'auto' }
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

        // --- 4. QUALIFICAÇÕES E EXIGÊNCIAS ---
        // Check if there's enough space for the header at least
        if (finalY + 30 > pageHeight - 20) {
            doc.addPage();
            finalY = 20;
        }

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('3. QUALIFICAÇÕES E EXIGÊNCIAS', ML, finalY);
        doc.line(ML, finalY + 2, pageWidth - MR, finalY + 2);
        finalY += 10;

        doc.setFontSize(10);
        
        // Educacao
        doc.setFont('helvetica', 'bold');
        doc.text('Educação:', ML, finalY);
        doc.setFont('helvetica', 'normal');
        
        let splitEd = doc.splitTextToSize(cargo.educacao || 'Não especificada', usableW - 25);
        doc.text(splitEd, ML + 25, finalY);
        finalY += (splitEd.length * 5) + 3;

        // Experiencia
        doc.setFont('helvetica', 'bold');
        doc.text('Experiência:', ML, finalY);
        doc.setFont('helvetica', 'normal');
        
        let splitExp = doc.splitTextToSize(cargo.experiencia || 'Não especificada', usableW - 25);
        doc.text(splitExp, ML + 25, finalY);
        finalY += (splitExp.length * 5) + 3;

        // Treinamento
        doc.setFont('helvetica', 'bold');
        doc.text('Treinamento:', ML, finalY);
        doc.setFont('helvetica', 'normal');
        
        let splitTre = doc.splitTextToSize(cargo.treinamento || 'Não especificado', usableW - 28);
        doc.text(splitTre, ML + 28, finalY);
        finalY += (splitTre.length * 5) + 5;


        // --- 5. ASSINATURAS ---
        if (finalY + 40 > pageHeight - 20) {
            doc.addPage();
            finalY = 20;
        }

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        const sigY = finalY + 30;
        
        doc.line(ML + 10, sigY, ML + 80, sigY);
        doc.text('Aprovado por (Diretoria/RH)', ML + 45, sigY + 5, { align: 'center' });

        doc.line(pageWidth - MR - 80, sigY, pageWidth - MR - 10, sigY);
        doc.text('Ciente do Colaborador', pageWidth - MR - 45, sigY + 5, { align: 'center' });

        doc.save(`SGQ_Cargo_${cargo.codigo_interno || 'SCode'}_${cargo.denominacao.replace(/[\/\s]/g, '_')}.pdf`);
        toast.success(`PDF gerado: ${cargo.denominacao}`);
        return true;
    } catch (error) {
        console.error('Erro ao gerar PDF do Cargo:', error);
        toast.error('Ocorreu um erro ao gerar o documento PDF.');
        throw error;
    }
};
