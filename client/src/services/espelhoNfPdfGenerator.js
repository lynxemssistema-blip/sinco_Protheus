import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { logoBase64 } from './metalfisaLogoBase64';
import { getCompanyLegalName, getCompanyShortName, getCompanyCnpjIeLine, getCompanyAddressLine, getCompanyTagline } from './companyBranding';

const fmtQtd = (v) => parseFloat(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
const fmtMoeda = (v) => {
    const n = parseFloat(v || 0);
    return n > 0 ? `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';
};

const formatChaveNFe = (chave) => {
    if (!chave) return '-';
    const c = String(chave).replace(/\D/g, '');
    if (c.length !== 44) return chave;
    return c.replace(/(\d{4})/g, '$1 ').trim();
};

export const generateEspelhoNfPdf = (nf, includeValues = true, currentUser = null) => {
    try {
        if (!nf) {
            alert('Dados da Nota Fiscal não fornecidos para geração do PDF.');
            return;
        }

        const doc = new jsPDF('portrait', 'mm', 'a4');
        const pageWidth  = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const ML = 10;
        const MR = 10;
        const usableW = pageWidth - ML - MR;

        // --- 1. CABEÇALHO DO DOCUMENTO ---
        const hY = 8;
        const hH = 22;
        doc.setDrawColor(30, 58, 95);
        doc.setLineWidth(0.4);
        doc.rect(ML, hY, usableW, hH);

        const col1 = ML + 48;
        const col2 = ML + 130;
        doc.setLineWidth(0.2);
        doc.line(col1, hY, col1, hY + hH);
        doc.line(col2, hY, col2, hY + hH);

        // Logo Lynx
        if (logoBase64) {
            doc.addImage(logoBase64, 'PNG', ML + 3, hY + 3, 42, 16);
        } else {
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 58, 95);
            doc.text(getCompanyShortName(), ML + 4, hY + 8);
            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100);
            doc.text(getCompanyTagline(), ML + 4, hY + 14);
        }

        // Dados da Empresa Emissora
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 58, 95);
        doc.text(getCompanyLegalName(), col1 + 4, hY + 5.5);

        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);
        doc.text(getCompanyCnpjIeLine(), col1 + 4, hY + 9.5);
        doc.text(getCompanyAddressLine(), col1 + 4, hY + 13.5);
        doc.text('Contagem - MG  |  CEP: 32010-080  |  Tel: (31) 3352-1600', col1 + 4, hY + 17.5);

        // Identificação do Espelho de NF
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 58, 95);
        doc.text('ESPELHO DE NOTA FISCAL', col2 + 4, hY + 5.5);

        doc.setFontSize(7.5);
        doc.setTextColor(0, 0, 0);
        doc.text('NF / SÉRIE:', col2 + 4, hY + 10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 58, 95);
        doc.text(`${nf.doc} ${nf.serie ? `(Série ${nf.serie})` : ''}`, col2 + 23, hY + 10);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text('EMISSÃO:', col2 + 4, hY + 14.5);
        doc.setFont('helvetica', 'bold');
        doc.text(nf.emissao || '-', col2 + 23, hY + 14.5);

        doc.setFont('helvetica', 'normal');
        doc.text('TIPO OP.:', col2 + 4, hY + 19);
        doc.setFont('helvetica', 'bold');
        doc.text(nf.tipo_descricao || nf.tipo || 'Faturamento', col2 + 23, hY + 19);

        let curY = hY + hH + 3;

        // --- 2. CHAVE DE ACESSO NF-e ---
        doc.setDrawColor(200, 200, 200);
        doc.setFillColor(248, 250, 252);
        doc.rect(ML, curY, usableW, 8.5, 'FD');

        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 116, 139);
        doc.text('CHAVE DE ACESSO DA NF-E (AUTORIZADA NA SEFAZ)', ML + 3, curY + 3.2);

        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(formatChaveNFe(nf.chvnfe), ML + 3, curY + 6.8);

        curY += 11.5;

        // --- 3. DADOS DO DESTINATÁRIO / CLIENTE ---
        doc.setDrawColor(200, 200, 200);
        doc.setFillColor(255, 255, 255);
        doc.rect(ML, curY, usableW, 17, 'D');

        doc.setFillColor(241, 245, 249);
        doc.rect(ML, curY, usableW, 4.5, 'F');
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 58, 95);
        doc.text('DADOS DO DESTINATÁRIO / CLIENTE', ML + 3, curY + 3.2);

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(nf.cliente_nome || 'Cliente não identificado', ML + 3, curY + 8.5);

        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(70, 70, 70);
        const cnpjStr = nf.cliente_cnpj ? `CNPJ/CPF: ${nf.cliente_cnpj}` : `Cód. Cliente: ${nf.cliente_cod || '-'}`;
        const locStr = [nf.cliente_municipio, nf.cliente_uf].filter(Boolean).join(' - ');
        doc.text(`${cnpjStr}   |   Loja: ${nf.cliente_loja || '01'}   |   Localidade: ${locStr || '-'}`, ML + 3, curY + 12.5);
        if (nf.transp) {
            doc.text(`Transportadora: ${nf.transp}`, ML + 3, curY + 15.5);
        }

        curY += 20;

        // --- 4. TABELA DE ITENS DA NF ---
        const itens = Array.isArray(nf.itens) ? nf.itens : [];

        let tableColumns = [];
        let colStyles = {};

        if (includeValues) {
            tableColumns = ['Item', 'Pedido - PV', 'Código', 'Descrição do Produto', 'UM', 'Qtd', 'Preço Unit.', 'Valor Total', 'CFOP/TES', 'Peso (kg)'];
            colStyles = {
                0: { halign: 'center', cellWidth: 10 },
                1: { halign: 'center', cellWidth: 20 },
                2: { halign: 'left',   cellWidth: 24, fontStyle: 'bold', textColor: [30, 58, 95] },
                3: { halign: 'left',   cellWidth: 'auto' },
                4: { halign: 'center', cellWidth: 9 },
                5: { halign: 'right',  cellWidth: 15, fontStyle: 'bold' },
                6: { halign: 'right',  cellWidth: 18 },
                7: { halign: 'right',  cellWidth: 20, fontStyle: 'bold', textColor: [4, 120, 87] },
                8: { halign: 'center', cellWidth: 18 },
                9: { halign: 'right',  cellWidth: 16 }
            };
        } else {
            tableColumns = ['Item', 'Pedido - PV', 'Código', 'Descrição do Produto', 'UM', 'Qtd', 'CFOP/TES', 'Peso (kg)'];
            colStyles = {
                0: { halign: 'center', cellWidth: 12 },
                1: { halign: 'center', cellWidth: 24 },
                2: { halign: 'left',   cellWidth: 28, fontStyle: 'bold', textColor: [30, 58, 95] },
                3: { halign: 'left',   cellWidth: 'auto' },
                4: { halign: 'center', cellWidth: 12 },
                5: { halign: 'right',  cellWidth: 18, fontStyle: 'bold' },
                6: { halign: 'center', cellWidth: 22 },
                7: { halign: 'right',  cellWidth: 20 }
            };
        }

        const tableRows = itens.map((it) => {
            const pedItem = it.pedido ? `${it.pedido}-${it.itempv || '01'}` : '-';
            const cfopTes = [it.cfop, it.tes].filter(Boolean).join(' / ') || '-';
            const peso = parseFloat(it.peso || 0) > 0 ? parseFloat(it.peso).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '-';

            if (includeValues) {
                return [
                    it.item,
                    pedItem,
                    it.codigo,
                    it.descricao || '-',
                    it.um || 'UN',
                    fmtQtd(it.quantidade),
                    fmtMoeda(it.preco_unitario),
                    fmtMoeda(it.valor_total),
                    cfopTes,
                    peso
                ];
            } else {
                return [
                    it.item,
                    pedItem,
                    it.codigo,
                    it.descricao || '-',
                    it.um || 'UN',
                    fmtQtd(it.quantidade),
                    cfopTes,
                    peso
                ];
            }
        });

        if (tableRows.length === 0) {
            tableRows.push([{
                content: 'Nenhum item registrado para esta Nota Fiscal.',
                colSpan: tableColumns.length,
                styles: { halign: 'center', fontStyle: 'italic', textColor: [120, 120, 120] }
            }]);
        }

        autoTable(doc, {
            startY: curY,
            head: [tableColumns],
            body: tableRows,
            theme: 'grid',
            headStyles: {
                fillColor: [30, 58, 95],
                textColor: [255, 255, 255],
                lineColor: [30, 58, 95],
                lineWidth: 0.2,
                fontSize: 6.5,
                fontStyle: 'bold',
                halign: 'center',
                valign: 'middle',
                cellPadding: 1.8
            },
            bodyStyles: {
                lineColor: [220, 226, 230],
                lineWidth: 0.15,
                fontSize: 6.5,
                textColor: [15, 23, 42],
                cellPadding: 1.8
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252]
            },
            columnStyles: colStyles,
            margin: { top: 20, left: ML, right: MR, bottom: 25 }
        });

        // --- 5. QUADRO DE TOTAIS ---
        let finalY = doc.lastAutoTable.finalY + 4;
        if (finalY > pageHeight - 32) {
            doc.addPage();
            finalY = 15;
        }

        const totalPecas = itens.reduce((acc, it) => acc + (parseFloat(it.quantidade) || 0), 0);
        const totalPeso = itens.reduce((acc, it) => acc + (parseFloat(it.peso) || 0), 0);
        const totalValor = includeValues ? (parseFloat(nf.valor_total || 0)) : null;

        const boxH = 14;
        doc.setDrawColor(200, 200, 200);
        doc.setFillColor(248, 250, 252);
        doc.rect(ML, finalY, usableW, boxH, 'FD');

        const cardW = usableW / (includeValues ? 4 : 3);

        // Card 1: Quantidade de Itens
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 116, 139);
        doc.text('TOTAL DE ITENS', ML + 4, finalY + 4.5);
        doc.setFontSize(9);
        doc.setTextColor(30, 58, 95);
        doc.text(`${itens.length} item(ns)`, ML + 4, finalY + 10.5);

        // Card 2: Total de Peças
        const x2 = ML + cardW;
        doc.line(x2, finalY, x2, finalY + boxH);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 116, 139);
        doc.text('TOTAL DE PEÇAS (VOLUME)', x2 + 4, finalY + 4.5);
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text(`${totalPecas.toLocaleString('pt-BR')} un.`, x2 + 4, finalY + 10.5);

        // Card 3: Peso Total
        const x3 = ML + cardW * 2;
        doc.line(x3, finalY, x3, finalY + boxH);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 116, 139);
        doc.text('PESO LÍQUIDO / BRUTO TOTAL', x3 + 4, finalY + 4.5);
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text(totalPeso > 0 ? `${totalPeso.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg` : '-', x3 + 4, finalY + 10.5);

        // Card 4: Valor Total da NF
        if (includeValues) {
            const x4 = ML + cardW * 3;
            doc.line(x4, finalY, x4, finalY + boxH);
            doc.setFontSize(6);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(4, 120, 87);
            doc.text('VALOR TOTAL DA NOTA FISCAL', x4 + 4, finalY + 4.5);
            doc.setFontSize(10);
            doc.setTextColor(4, 120, 87);
            doc.text(totalValor > 0 ? `R$ ${totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'R$ 0,00', x4 + 4, finalY + 10.5);
        }

        // --- 6. RODAPÉ E NUMERAÇÃO DE PÁGINAS ---
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(6);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(120, 120, 120);
            
            const emissor = currentUser?.nome ? ` | Solicitado por: ${currentUser.nome}` : '';
            const dataGeracao = new Date().toLocaleString('pt-BR');
            doc.text(`Espelho de NF gerado pelo App Lynx em ${dataGeracao}${emissor}`, ML, pageHeight - 6);
            doc.text(`Pág. ${i} de ${pageCount}`, pageWidth - MR, pageHeight - 6, { align: 'right' });
        }

        const fileName = `Espelho_NF_${nf.doc}_${nf.serie || '1'}.pdf`;
        doc.save(fileName);
        return true;
    } catch (error) {
        console.error('Erro ao gerar Espelho da NF em PDF:', error);
        alert('Erro ao gerar Espelho da NF em PDF: ' + error.message);
        throw error;
    }
};

export default generateEspelhoNfPdf;
