import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { logoBase64 } from './metalfisaLogoBase64';
import { getCompanyLegalName, getCompanyShortName, getCompanyAddressCnpjLine, getCompanyTagline } from './companyBranding';

export const generateDemandaMesPdf = ({
    items = [],
    mesesDemanda = [],
    totais = {},
    filterStatus = 'ALL',
    filterMonth = 'ALL',
    sheetName = 'LYNX'
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
        else if (filterStatus === 'COM_FATURAMENTO') subtitleText = 'RELATÓRIO DE ITENS COM HISTÓRICO DE FATURAMENTO';
        else if (filterStatus === 'FATURADO_TOTAL') subtitleText = 'RELATÓRIO DE ITENS 100% FATURADOS (ENTREGUES)';

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
            const col2 = ML + 130;
            const col3 = ML + 195;
            doc.setLineWidth(0.2);
            [col1, col2, col3].forEach(x => doc.line(x, hY, x, hY + hH));

            // 1. Logo Lynx
            if (logoBase64) {
                doc.addImage(logoBase64, 'PNG', ML + 3, hY + 1.5, 40, 13);
            } else {
                doc.setFontSize(13);
                doc.setFont('helvetica', 'bold');
                doc.text(getCompanyShortName(), ML + 4, hY + 6);
                doc.setFontSize(5.5);
                doc.setFont('helvetica', 'normal');
                doc.text(getCompanyTagline(), ML + 4, hY + 10);
            }

            // 2. Dados da Empresa
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'bold');
            doc.text(getCompanyLegalName(), col1 + 3, hY + 5);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.text(getCompanyAddressCnpjLine(), col1 + 3, hY + 9);
            doc.text(`Módulo VMI / PCP Protheus · Planilha: ${sheetName}`, col1 + 3, hY + 13);

            // 3. Emissão e Resumo
            doc.setFontSize(6);
            doc.setFont('helvetica', 'bold');
            doc.text('EMISSÃO:', col2 + 2, hY + 4.5);
            doc.setFont('helvetica', 'normal');
            doc.text(new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), col2 + 18, hY + 4.5);
            
            doc.setFont('helvetica', 'bold');
            doc.text('ITENS / FAT.:', col2 + 2, hY + 8.5);
            doc.setFont('helvetica', 'normal');
            doc.text(`${items.length} itens · Fat: ${(totais.totalFaturadoGeral || 0).toLocaleString('pt-BR')} un`, col2 + 18, hY + 8.5);

            doc.setFont('helvetica', 'bold');
            doc.text('SALDO GERAL:', col2 + 2, hY + 13);
            doc.setFont('helvetica', 'normal');
            doc.text(`${(totais.totalSaldoGeral || 0).toLocaleString('pt-BR')} un`, col2 + 22, hY + 13);

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

        const getMonthKeyFromDate = (dt) => {
            if (!dt || dt === 'Sem Data') return null;
            try {
                const d = new Date(dt);
                if (isNaN(d.getTime())) return null;
                const m = d.getUTCMonth() + 1;
                const y = d.getUTCFullYear();
                const mNames = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                return `${mNames[m] || m}/${y}`;
            } catch (e) {
                return null;
            }
        };

        const matchMonthYear = (dateStr, monthLabel) => {
            if (dateStr === 'Sem Data' && monthLabel === 'Sem Data') return true;
            if (!dateStr || !monthLabel) return false;
            const fcMonth = getMonthKeyFromDate(dateStr);
            if (!fcMonth) return false;
            const cleanLabel = monthLabel.replace(/^DEM\.\s*/i, '').trim().toLowerCase();
            return fcMonth.toLowerCase() === cleanLabel;
        };

        const getPcpItemsForMonth = (item, monthLabel) => {
            if (!item?.pedidos) return [];
            const result = [];
            for (const p of item.pedidos) {
                for (const fc of (p.previsoes_pcp || [])) {
                    if (matchMonthYear(fc.data_pcp, monthLabel)) {
                        result.push({
                            pedido: p.pedido_metal,
                            item: p.item_pedido,
                            nfs: p.nfs || [],
                        });
                    }
                }
            }
            return result;
        };

        // Montar Colunas da Tabela
        const tableColumns = [
            'Ref. Cliente',
            'Cód. Lynx',
            'Descrição do Item',
            'Status',
            ...mesesDemanda.map(m => `Dem. ${m}`),
            'Tot. Demanda',
            'Qtd Faturada',
            'Saldo Faturar'
        ];

        // Montar Linhas da Tabela
        const tableRows = items.map(item => {

            let statusLabel = 'SEM SALDO';
            if (item.possui_saldo) statusLabel = 'COM SALDO';
            if (item.totalmente_faturado) statusLabel = 'FATURADO';

            const row = [
                item.ref_cliente || '-',
                item.codigo_metalfisa || '-',
                item.descricao || '-',
                statusLabel,
                ...mesesDemanda.map(m => {
                    const demVal = item.demandas && item.demandas[m] ? Number(item.demandas[m]).toLocaleString('pt-BR') : '-';
                    let cellText = demVal !== '-' ? `${demVal} un` : '-';
                    
                    const pcpItems = getPcpItemsForMonth(item, m);
                    let nfLines = [];
                    pcpItems.forEach(pcp => {
                        if (pcp.nfs && pcp.nfs.length > 0) {
                            pcp.nfs.forEach(nf => {
                                nfLines.push(`NF ${nf.nota} (${nf.emissao})`);
                            });
                        }
                    });
                    
                    nfLines = [...new Set(nfLines)];
                    if (nfLines.length > 0) {
                        cellText += `\n${nfLines.join('\n')}`;
                    }
                    
                    return cellText;
                }),
                Number(item.total_demanda || 0).toLocaleString('pt-BR'),
                Number(item.total_faturado || 0).toLocaleString('pt-BR'),
                Number(item.total_saldo_faturar || 0).toLocaleString('pt-BR')
            ];
            return row;
        });

        // Configuração de Estilo das Colunas
        const colStyles = {
            0: { halign: 'left', cellWidth: 24, fontStyle: 'bold' },
            1: { halign: 'left', cellWidth: 24 },
            2: { halign: 'left' }, // auto width
            3: { halign: 'center', cellWidth: 18 },
            // Colunas de meses (alinhadas à direita)
        };

        const startMonthIdx = 4;
        mesesDemanda.forEach((_, idx) => {
            colStyles[startMonthIdx + idx] = { halign: 'right', cellWidth: 14 };
        });

        const totalDemandaIdx = startMonthIdx + mesesDemanda.length;
        const qtdFaturadaIdx = totalDemandaIdx + 1;
        const saldoFaturarIdx = qtdFaturadaIdx + 1;

        colStyles[totalDemandaIdx] = { halign: 'right', cellWidth: 18, fontStyle: 'bold' };
        colStyles[qtdFaturadaIdx] = { halign: 'right', cellWidth: 18, fontStyle: 'bold' };
        colStyles[saldoFaturarIdx] = { halign: 'right', cellWidth: 18, fontStyle: 'bold' };

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
                fillColor: [30, 41, 59], // Slate 800 Lynx
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
                    // Coluna de Status (verde ou âmbar ou azul)
                    if (data.column.index === 3) {
                        if (data.cell.raw === 'COM SALDO') {
                            data.cell.styles.textColor = [16, 122, 68];
                            data.cell.styles.fontStyle = 'bold';
                        } else if (data.cell.raw === 'FATURADO') {
                            data.cell.styles.textColor = [2, 132, 199];
                            data.cell.styles.fontStyle = 'bold';
                        } else {
                            data.cell.styles.textColor = [180, 83, 9];
                            data.cell.styles.fontStyle = 'bold';
                        }
                    }
                    // Destaque Qtd Faturada
                    if (data.column.index === qtdFaturadaIdx) {
                        data.cell.styles.textColor = [2, 132, 199];
                    }
                    // Destaque Saldo a Faturar
                    if (data.column.index === saldoFaturarIdx) {
                        data.cell.styles.textColor = [15, 23, 42];
                    }
                }
            },
            didDrawPage: (data) => {
                // Rodapé padrão Lynx
                const str = `Página ${data.pageNumber} de ${doc.internal.getNumberOfPages()}`;
                doc.setFontSize(6.5);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(100);
                doc.text(str, pageWidth - MR, pageHeight - 5, { align: 'right' });
                doc.text('Lynx PCP / VMI - Documento Gerado Automaticamente', ML, pageHeight - 5);
            }
        });

        // Nome descritivo do arquivo PDF
        let fileNameFilter = 'TODOS';
        if (filterStatus === 'SEM_SALDO') fileNameFilter = 'SEM_SALDO';
        if (filterStatus === 'COM_SALDO') fileNameFilter = 'COM_SALDO';
        if (filterStatus === 'SOBRA_SALDO') fileNameFilter = 'SALDO_EXCEDENTE';
        if (filterStatus === 'FALTA_SALDO') fileNameFilter = 'SALDO_INSUFICIENTE';
        if (filterStatus === 'FORA_PLANILHA') fileNameFilter = 'FORA_PLANILHA';
        if (filterStatus === 'COM_FATURAMENTO') fileNameFilter = 'COM_FATURAMENTO';
        if (filterStatus === 'FATURADO_TOTAL') fileNameFilter = 'FATURADO_TOTAL';

        const safeDate = new Date().toISOString().slice(0, 10);
        doc.save(`Demanda_Mes_${fileNameFilter}_${safeDate}.pdf`);

        return true;
    } catch (err) {
        console.error('Erro ao gerar PDF de Demanda Mês:', err);
        throw err;
    }
};
