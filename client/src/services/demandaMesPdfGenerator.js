import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { logoBase64 } from './metalfisaLogoBase64';

export const generateDemandaMesPdf = ({
    items = [],
    mesesDemanda = [],
    totais = {},
    filterStatus = 'ALL',
    filterMonth = 'ALL',
    sheetName = 'METALFISA'
}) => {
    try {
        const doc = new jsPDF('l', 'mm', 'a4'); // Landscape A4
        const pageWidth  = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const ML = 10;
        const MR = 10;
        const usableW = pageWidth - ML - MR;

        // Determinar Título do Relatório com base na Visão Filtrada
        let subtitleText = 'CRUZAMENTO DE DEMANDA VMI & CARTEIRA PCP';
        if (filterStatus === 'SEM_SALDO') subtitleText = 'RELATÓRIO DE ITENS SEM SALDO EM ABERTO (PROTHEUS)';
        else if (filterStatus === 'COM_SALDO') subtitleText = 'RELATÓRIO DE ITENS COM SALDO A FATURAR';
        else if (filterStatus === 'SOBRA_SALDO') subtitleText = 'RELATÓRIO DE ITENS COM SALDO EXCEDENTE (SOBRA)';
        else if (filterStatus === 'FALTA_SALDO') subtitleText = 'RELATÓRIO DE ITENS COM SALDO INSUFICIENTE';
        else if (filterStatus === 'FORA_PLANILHA') subtitleText = 'RELATÓRIO DE ITENS EM CARTEIRA FORA DA PLANILHA';

        if (filterMonth !== 'ALL') {
            subtitleText += ` - FILTRO: ${filterMonth}`;
        }

        const drawHeader = () => {
            const hY = 8;
            const hH = 16;
            doc.setDrawColor(30, 41, 59);
            doc.setLineWidth(0.3);
            doc.rect(ML, hY, usableW, hH);

            const col1 = ML + 48;
            const col2 = ML + 140;
            const col3 = ML + 195;
            doc.setLineWidth(0.2);
            [col1, col2, col3].forEach(x => doc.line(x, hY, x, hY + hH));

            // 1. Logo Metalfisa
            if (logoBase64) {
                doc.addImage(logoBase64, 'PNG', ML + 3, hY + 1.5, 40, 13);
            } else {
                doc.setFontSize(13);
                doc.setFont('helvetica', 'bold');
                doc.text('METALFISA', ML + 4, hY + 6);
                doc.setFontSize(5.5);
                doc.setFont('helvetica', 'normal');
                doc.text('Transformando metais em excelência', ML + 4, hY + 10);
            }

            // 2. Dados da Empresa
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'bold');
            doc.text('METALFISA METALURGICA LTDA', col1 + 3, hY + 5);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.text('R. Américo Santiago Piacenza, 516 — CNPJ: 23.881.592/0001-01', col1 + 3, hY + 9);
            doc.text(`Módulo VMI / PCP Protheus · Planilha: ${sheetName}`, col1 + 3, hY + 13);

            // 3. Emissão e Resumo
            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'bold');
            doc.text('EMISSÃO:', col2 + 3, hY + 5);
            doc.setFont('helvetica', 'normal');
            doc.text(new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), col2 + 18, hY + 5);
            
            doc.setFont('helvetica', 'bold');
            doc.text('ITENS:', col2 + 3, hY + 9.5);
            doc.setFont('helvetica', 'normal');
            doc.text(`${items.length} itens listados`, col2 + 18, hY + 9.5);

            doc.setFont('helvetica', 'bold');
            doc.text('SALDO GERAL:', col2 + 3, hY + 14);
            doc.setFont('helvetica', 'normal');
            doc.text(`${(totais.totalSaldoGeral || 0).toLocaleString('pt-BR')} un`, col2 + 25, hY + 14);

            // 4. Bloco de Título
            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'bold');
            doc.text('DEMANDA MÊS (VMI & PCP)', col3 + (usableW - (col3 - ML)) / 2, hY + 5.5, { align: 'center' });
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.text(subtitleText, col3 + (usableW - (col3 - ML)) / 2, hY + 10, { align: 'center' });

            return hY + hH + 4;
        };

        const tableStartY = drawHeader();

        // Montar Colunas da Tabela
        const tableColumns = [
            'Ref. Cliente',
            'Cód. Metalfisa',
            'Descrição do Item',
            'Status',
            ...mesesDemanda.map(m => `Dem. ${m}`),
            'Tot. Demanda',
            'Saldo Faturar',
            'Previsões PCP (SINCO)'
        ];

        // Montar Linhas da Tabela
        const tableRows = items.map(item => {
            const pcpSummary = Object.entries(item.pcp_por_mes || {})
                .map(([mes, qtd]) => `${mes}: ${qtd}`)
                .join(' | ') || (item.possui_saldo ? 'Sem Data Definida' : '-');

            const row = [
                item.ref_cliente || '-',
                item.codigo_metalfisa || '-',
                item.descricao || '-',
                item.possui_saldo ? 'COM SALDO' : 'SEM SALDO',
                ...mesesDemanda.map(m => (item.demandas && item.demandas[m] ? Number(item.demandas[m]).toLocaleString('pt-BR') : '-')),
                Number(item.total_demanda || 0).toLocaleString('pt-BR'),
                Number(item.total_saldo_faturar || 0).toLocaleString('pt-BR'),
                pcpSummary
            ];
            return row;
        });

        // Configuração de Estilo das Colunas
        const colStyles = {
            0: { halign: 'left', cellWidth: 26, fontStyle: 'bold' },
            1: { halign: 'left', cellWidth: 26 },
            2: { halign: 'left' }, // auto width
            3: { halign: 'center', cellWidth: 20 },
            // Colunas de meses (alinhadas à direita)
        };

        const startMonthIdx = 4;
        mesesDemanda.forEach((_, idx) => {
            colStyles[startMonthIdx + idx] = { halign: 'right', cellWidth: 16 };
        });

        const totalDemandaIdx = startMonthIdx + mesesDemanda.length;
        const saldoFaturarIdx = totalDemandaIdx + 1;
        const pcpPrevisoesIdx = saldoFaturarIdx + 1;

        colStyles[totalDemandaIdx] = { halign: 'right', cellWidth: 20, fontStyle: 'bold' };
        colStyles[saldoFaturarIdx] = { halign: 'right', cellWidth: 20, fontStyle: 'bold' };
        colStyles[pcpPrevisoesIdx] = { halign: 'left', cellWidth: 40 };

        autoTable(doc, {
            head: [tableColumns],
            body: tableRows,
            startY: tableStartY,
            margin: { left: ML, right: MR, bottom: 12 },
            styles: {
                fontSize: 6.5,
                cellPadding: 1.5,
                lineColor: [203, 213, 225],
                lineWidth: 0.1,
                overflow: 'linebreak'
            },
            headStyles: {
                fillColor: [30, 41, 59], // Slate 800 Metalfisa
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'center',
                fontSize: 6.5
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252] // Slate 50
            },
            columnStyles: colStyles,
            didParseCell: (data) => {
                if (data.section === 'body') {
                    // Coluna de Status (verde ou âmbar)
                    if (data.column.index === 3) {
                        if (data.cell.raw === 'COM SALDO') {
                            data.cell.styles.textColor = [16, 122, 68];
                            data.cell.styles.fontStyle = 'bold';
                        } else {
                            data.cell.styles.textColor = [180, 83, 9];
                            data.cell.styles.fontStyle = 'bold';
                        }
                    }
                    // Destaque Saldo a Faturar
                    if (data.column.index === saldoFaturarIdx) {
                        data.cell.styles.textColor = [15, 23, 42];
                    }
                }
            },
            didDrawPage: (data) => {
                // Rodapé padrão Metalfisa
                const str = `Página ${data.pageNumber} de ${doc.internal.getNumberOfPages()}`;
                doc.setFontSize(6.5);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(100);
                doc.text(str, pageWidth - MR, pageHeight - 5, { align: 'right' });
                doc.text('Metalfisa PCP / VMI - Documento Gerado Automaticamente', ML, pageHeight - 5);
            }
        });

        // Nome descritivo do arquivo PDF
        let fileNameFilter = 'TODOS';
        if (filterStatus === 'SEM_SALDO') fileNameFilter = 'SEM_SALDO';
        if (filterStatus === 'COM_SALDO') fileNameFilter = 'COM_SALDO';
        if (filterStatus === 'SOBRA_SALDO') fileNameFilter = 'SALDO_EXCEDENTE';
        if (filterStatus === 'FALTA_SALDO') fileNameFilter = 'SALDO_INSUFICIENTE';
        if (filterStatus === 'FORA_PLANILHA') fileNameFilter = 'FORA_PLANILHA';

        const safeDate = new Date().toISOString().slice(0, 10);
        doc.save(`Demanda_Mes_${fileNameFilter}_${safeDate}.pdf`);

        return true;
    } catch (err) {
        console.error('Erro ao gerar PDF de Demanda Mês:', err);
        throw err;
    }
};
