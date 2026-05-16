import jsPDFLib from 'jspdf';
const jsPDF = jsPDFLib.jsPDF || jsPDFLib;
import autoTable from 'jspdf-autotable';
import { logoBase64 } from './metalfisaLogoBase64';

export const generateRNCPdf = async (rncs, filters, currentUser) => {
    try {
        const doc = new jsPDF('portrait', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const ML = 14;
        const MR = 14;

        // --- CABEÇALHO PADRÃO ---
        const drawHeader = (pageDoc, currentY) => {
            let hY = currentY || 5;
            const usableW = pageWidth - ML - MR;
            const hH = 15;

            // Box and lines
            pageDoc.setDrawColor(30, 58, 95);
            pageDoc.setLineWidth(0.3);
            pageDoc.rect(ML, hY, usableW, hH);

            const col1 = ML + 45;   // logo | logo name
            const col2 = ML + 130;  // title | info

            pageDoc.setLineWidth(0.2);
            [col1, col2].forEach(x => pageDoc.line(x, hY, x, hY + hH));

            // Logo Image
            try {
                if (logoBase64) {
                    pageDoc.addImage(logoBase64, 'PNG', ML + 2, hY + 1, 38, 13);
                } else {
                    pageDoc.setFontSize(13);
                    pageDoc.setFont('helvetica', 'bold');
                    pageDoc.setTextColor(30, 58, 95);
                    pageDoc.text('METALFISA', ML + 4, hY + 9);
                }
            } catch (e) {
                pageDoc.setFontSize(13);
                pageDoc.setFont('helvetica', 'bold');
                pageDoc.setTextColor(30, 58, 95);
                pageDoc.text('METALFISA', ML + 4, hY + 9);
            }

            pageDoc.setTextColor(0, 0, 0);
            pageDoc.setFontSize(12);
            pageDoc.setFont('helvetica', 'bold');
            pageDoc.text('Relatório de Não Conformidades', col1 + 5, hY + 9);

            pageDoc.setFontSize(8);
            pageDoc.setFont('helvetica', 'normal');
            pageDoc.text(`Data/Hora: ${new Date().toLocaleString('pt-BR')}`, col2 + 5, hY + 6);
            pageDoc.text(`Usuário: ${currentUser?.nome || 'Sistema'}`, col2 + 5, hY + 11);

            return hY + hH + 5;
        };

        const HEADER_H = 25;

        const onDidDrawPage = (data) => {
            if (data.pageNumber > 1) {
                drawHeader(doc, 5);
            }
        };

        let startY = drawHeader(doc, 5);

        // --- FILTROS ---
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        let filterText = [];
        if (filters?.status) filterText.push(`Status: ${filters.status}`);

        doc.text(`Filtros Ativos: ${filterText.length > 0 ? filterText.join(' | ') : 'Todos os Registros'}`, ML, startY + 2);
        startY += 8;

        const tableHead = [['ID', 'Status', 'Origem', 'Defeito / Recurso', 'Tratativa / Obs']];
        const colStyles = {
            0: { cellWidth: 15 },
            1: { cellWidth: 25 },
            2: { cellWidth: 40 },
            3: { cellWidth: 45 },
            4: { cellWidth: 55 }
        };

        const mapRow = (row) => {
            const dataCriacao = new Date(row.data_criacao).toLocaleString('pt-BR');
            let origem = `Abertura:\nEm: ${dataCriacao}\nPor: ${row.criado_por || 'Sistema'}\n\n`;
            origem += `OP: ${row.op}-${row.item_op} (${row.sequen_op})\nPV: ${row.pedido || 'N/A'}\nProduto OP: ${row.produto || ''}`;

            try {
                const f097 = row.f097_dados ? JSON.parse(row.f097_dados) : {};
                const reg = f097.registro || {};
                
                if (reg.is_produto_pai === true) {
                    origem += `\nHierarquia: Produto Pai (Item de Faturamento)`;
                } else if (reg.is_produto_pai === false) {
                    origem += `\nHierarquia: Item Filho\nProd. Pai: ${reg.produto_pai || 'N/A'}`;
                }
            } catch (e) {}

            let tratativa = `Problema:\n${row.observacao || '-'}\n\n`;
            if (row.tratativa_resposta) {
                tratativa += `Soluções / Histórico:\n${row.tratativa_resposta}`;
            } else {
                tratativa += 'Tratativa: Aguardando solução.';
            }

            return [
                `#${row.id}`,
                row.status || '-',
                origem,
                `${row.nc_descricao || 'Outro'}\nRecurso: ${row.recurso_inconformidade}`,
                tratativa
            ];
        };

        const tableBody = rncs.map(mapRow);

        autoTable(doc, {
            startY: startY,
            head: tableHead,
            body: tableBody,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2, valign: 'middle' },
            headStyles: { fillColor: [30, 58, 95], textColor: 255 },
            columnStyles: colStyles,
            margin: { left: ML, right: MR, top: HEADER_H, bottom: 20 },
            didDrawPage: onDidDrawPage,
        });

        // --- FOOTER PAGINATION ---
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(150, 150, 150);
            doc.text(`Página ${i} de ${pageCount}`, pageWidth - MR, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
            doc.text(`Gerado via MetalFisa App`, ML, doc.internal.pageSize.getHeight() - 10);
        }

        doc.save(`relatorio_rncs_${new Date().getTime()}.pdf`);
    } catch (err) {
        console.error('Erro ao gerar relatório com formatação padrão', err);
        throw err;
    }
};

export const generateSingleRNCPdf = async (rnc) => {
    try {
        const doc = new jsPDF('portrait', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const ML = 14;
        const MR = 14;
        const usableW = pageWidth - ML - MR;

        let currentY = 10;

        // HEADER (similar to F097-22)
        doc.setDrawColor(30, 58, 95);
        doc.setLineWidth(0.3);
        doc.rect(ML, currentY, usableW, 20);

        // Logo Image
        try {
            if (logoBase64) {
                doc.addImage(logoBase64, 'PNG', ML + 2, currentY + 2, 45, 15);
            } else {
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(30, 58, 95);
                doc.text('METALFISA', ML + 5, currentY + 12);
            }
        } catch (e) {}

        doc.line(ML + 50, currentY, ML + 50, currentY + 20);

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('F 097-22 - REGISTRO DE NÃO CONFORMIDADE', ML + 55, currentY + 9);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`RNC ID: #${rnc.id}  |  Status: ${rnc.status}`, ML + 55, currentY + 16);

        currentY += 25;

        // PARSER DATA
        const f097 = rnc.f097_dados ? JSON.parse(rnc.f097_dados) : {};
        const reg = f097.registro || {};
        const trat = f097.tratativa || {};

        // SECTION: 1. IDENTIFICAÇÃO E DESCRIÇÃO DA RNC
        autoTable(doc, {
            startY: currentY,
            theme: 'grid',
            headStyles: { fillColor: [200, 200, 200], textColor: 0, fontStyle: 'bold', halign: 'center' },
            styles: { fontSize: 9, cellPadding: 2, textColor: 0 },
            body: [
                [{ content: '1. IDENTIFICAÇÃO E DESCRIÇÃO DA NÃO CONFORMIDADE', colSpan: 4, styles: { fillColor: [230, 230, 230], fontStyle: 'bold' } }],
                ['Data Abertura:', new Date(rnc.data_criacao).toLocaleString('pt-BR'), 'Aberto por:', rnc.criado_por || 'Sistema'],
                ['OP:', `${rnc.op || '-'}-${rnc.item_op || '-'} (${rnc.sequen_op || '-'})`, 'Pedido / PV:', rnc.pedido || '-'],
                ['Produto OP:', rnc.produto || '-', 'Hierarquia:', reg.is_produto_pai === true ? 'Produto Pai (Faturamento)' : (reg.is_produto_pai === false ? 'Item Filho (Componente)' : 'Não Definido')],
                ['Produto Pai (PV):', { content: reg.produto_pai || (reg.is_produto_pai ? rnc.produto : 'N/A'), colSpan: 3 }],
                ['Cliente / Fornec.:', { content: rnc.cliente || '-', colSpan: 3 }],
                ['Origem RNC:', reg.origem || '-', 'Resp. Qualidade:', reg.responsavel_qualidade || '-'],
                ['Local Detecção:', reg.local_deteccao || '-', 'Qtd Não Conforme:', reg.qtd_nao_conforme || '-'],
                ['Setor Envolvido:', reg.setor_envolvido || rnc.recurso_inconformidade || '-', 'Setor Origem:', reg.setor_origem || '-'],
                ['Defeito / Probl.:', { content: rnc.nc_descricao || '-', colSpan: 3 }],
                [{ content: `Descrição Detalhada:\n${rnc.observacao || '-'}`, colSpan: 4, styles: { minCellHeight: 20 } }]
            ]
        });

        currentY = doc.lastAutoTable.finalY + 5;

        // SECTION: 2. DISPOSIÇÃO DO PRODUTO E 3. INVESTIGAÇÃO 5W2H
        autoTable(doc, {
            startY: currentY,
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 2, textColor: 0 },
            body: [
                [{ content: '2. DISPOSIÇÃO DO PRODUTO', colSpan: 2, styles: { fillColor: [230, 230, 230], fontStyle: 'bold' } },
                 { content: '3. INVESTIGAÇÃO DAS CAUSAS (5W2H)', colSpan: 2, styles: { fillColor: [230, 230, 230], fontStyle: 'bold' } }],
                ['Retrabalho:', trat.disposicao_retrabalho ? 'X Sim' : 'Não', 'O Quê (Problema):', trat.w2h_o_que || '-'],
                ['Nova Peça:', trat.disposicao_nova_peca ? 'X Sim' : 'Não', 'Por Quê (Causa):', trat.w2h_por_que || '-'],
                [{ content: '', colSpan: 2, rowSpan: 5 }, 'Onde (Local):', trat.w2h_onde || '-'],
                ['Quando:', trat.w2h_quando || '-'],
                ['Quem (Resp.):', trat.w2h_quem || '-'],
                ['Quantidade:', trat.w2h_quantidade || '-'],
                ['Frequência:', trat.w2h_frequencia || '-']
            ]
        });

        currentY = doc.lastAutoTable.finalY + 5;

        // SECTION: 4. VERIFICAÇÃO DA EFICÁCIA DA AÇÃO CORRETIVA E HISTÓRICO
        autoTable(doc, {
            startY: currentY,
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 2, textColor: 0 },
            body: [
                [{ content: '4. VERIFICAÇÃO DA EFICÁCIA DA AÇÃO', colSpan: 4, styles: { fillColor: [230, 230, 230], fontStyle: 'bold' } }],
                ['Ações Foram Implementadas?', trat.efic_acoes_implementadas || '-', 'Corrigiram o Problema?', trat.efic_corrigiram || '-'],
                ['Houve Reincidência?', trat.efic_reincidencia || '-', 'Conclusão Final:', trat.efic_conclusao || '-'],
                [{ content: '5. HISTÓRICO E TRATATIVAS REGISTRADAS', colSpan: 4, styles: { fillColor: [230, 230, 230], fontStyle: 'bold' } }],
                [{ content: rnc.tratativa_resposta || 'Nenhuma tratativa registrada.', colSpan: 4, styles: { minCellHeight: 25 } }]
            ]
        });

        currentY = doc.lastAutoTable.finalY + 10;
        
        let fotosRegistro = [];
        try { fotosRegistro = rnc.fotos_registro ? JSON.parse(rnc.fotos_registro) : (rnc.imagem_evidencia ? [rnc.imagem_evidencia] : []); } catch(e){}
        
        let fotosTrat = [];
        try { fotosTrat = rnc.fotos_tratativa ? JSON.parse(rnc.fotos_tratativa) : []; } catch(e){}
        
        const todasFotos = [...fotosRegistro.map(f => ({src: f, label: 'Evidência (Abertura)'})), ...fotosTrat.map(f => ({src: f, label: 'Evidência (Solução)'}))];

        if (todasFotos.length > 0) {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('ANEXO: EVIDÊNCIAS FOTOGRÁFICAS', ML, currentY);
            currentY += 5;

            const photoWidth = 50;
            const photoHeight = 50;
            const maxCols = 3;
            let colIndex = 0;

            for (const foto of todasFotos) {
                if (!foto.src || typeof foto.src !== 'string' || !foto.src.startsWith('data:image')) continue;
                
                if (currentY + photoHeight > doc.internal.pageSize.getHeight() - 15) {
                    doc.addPage();
                    currentY = 15;
                    colIndex = 0;
                }

                const posX = ML + (colIndex * (photoWidth + 5));
                try {
                    doc.addImage(foto.src, 'JPEG', posX, currentY, photoWidth, photoHeight);
                    doc.setFontSize(7);
                    doc.text(foto.label, posX, currentY + photoHeight + 3);
                } catch(e) {
                    console.error('Erro ao renderizar imagem', e);
                }

                colIndex++;
                if (colIndex >= maxCols) {
                    colIndex = 0;
                    currentY += photoHeight + 10;
                }
            }
        }

        doc.save(`F097-22_RNC_${rnc.id}.pdf`);
    } catch (err) {
        console.error('Erro ao gerar RNC individual PDF', err);
        throw err;
    }
};
