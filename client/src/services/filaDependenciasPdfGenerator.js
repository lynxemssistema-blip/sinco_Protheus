import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const formatDateBR = (dateStr) => {
    if (!dateStr) return '-';
    if (dateStr.length === 8) {
        return `${dateStr.substring(6,8)}/${dateStr.substring(4,6)}/${dateStr.substring(0,4)}`;
    }
    const d = new Date(dateStr);
    if(isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
};

export const generateFilaDependenciasPdf = async (activeTab, recurso, dataFim, dataList) => {
    try {
        const doc = new jsPDF('landscape', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const ML = 10;
        const MR = 10;
        const HEADER_H = 35;
        let startY = HEADER_H;

        const drawHeader = (docInstance) => {
            const logoWidth = 25;
            docInstance.setFontSize(16);
            docInstance.setFont('helvetica', 'bold');
            docInstance.setTextColor(30, 58, 95);
            docInstance.text('MetalFisa', ML + logoWidth + 5, 18);

            docInstance.setFontSize(14);
            docInstance.setFont('helvetica', 'bold');
            docInstance.setTextColor(0, 0, 0);
            
            const title = `FILA DE DEPENDÊNCIAS - ${recurso || 'TODOS'}`;
            docInstance.text(title, ML + logoWidth + 5, 25);

            docInstance.setFontSize(11);
            if (activeTab === 'inbound') {
                docInstance.setTextColor(185, 28, 28); // text-red-700
                docInstance.text('ENTRADA (ESTÃO DEVENDO)', ML + logoWidth + 5, 31);
            } else {
                docInstance.setTextColor(180, 83, 9); // text-amber-700
                docInstance.text('SAÍDA (ESTOU DEVENDO)', ML + logoWidth + 5, 31);
            }

            docInstance.setFontSize(9);
            docInstance.setTextColor(100, 100, 100);
            docInstance.text(`Data Limite Planej.: ${dataFim}`, pageWidth - MR - 50, 18);
            docInstance.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, pageWidth - MR - 50, 24);
            
            docInstance.setDrawColor(200, 200, 200);
            docInstance.line(ML, 35, pageWidth - MR, 35);
            return 40;
        };

        const onDidDrawPage = (dataObj) => {
            drawHeader(doc);
        };

        startY = drawHeader(doc);

        const tableHead = [[
            'PEDIDO', 
            'CLIENTE', 
            'O.P.', 
            'PRODUTO', 
            'STATUS', 
            'QTD PEND.', 
            'PERÍODO PLAN.', 
            'APONT.', 
            activeTab === 'inbound' ? 'ORIGEM' : 'DESTINO'
        ]];

        const tableBody = dataList.map(op => {
            // Status calculations (simplified for text)
            let stText = 'Aguardando';
            const now = new Date();
            const parseD = (dStr) => dStr && dStr.length === 8 ? new Date(`${dStr.substring(0,4)}-${dStr.substring(4,6)}-${dStr.substring(6,8)}T12:00:00`) : null;
            const start = parseD(op.data_planejada);
            const end = parseD(op.data_fim_planejada);
            const done = Math.round(op.qtd_pendente || 0) <= 0 || Number(op.qtd_apontada) >= Number(op.qtd_total);
            const started = Number(op.qtd_apontada) > 0;

            if (done) stText = 'Concluída';
            else if (end && now > end) stText = 'Atrasada (Entrega)';
            else if (start && now > start && !started) stText = 'Atrasada (Início)';
            else if (started) stText = 'Em Andamento';
            else if (start && end) stText = 'Planejada';

            const codProd = (op.cod_produto || '').trim();
            const descProd = (op.desc_produto || '').substring(0, 30);
            const opStr = `${op.op}\nItem ${op.item_op} Seq ${op.sequen}`;
            const pedStr = op.pedido_venda ? `${op.pedido_venda} / ${op.item_pv}` : 'ESTOQUE';
            const clienteStr = op.pedido_venda ? (op.nome_cliente || '').substring(0, 20) : '-';
            const origDestStr = `${op.recurso_referencia}\n${(op.desc_recurso_referencia || '').substring(0, 20)}`;

            return [
                pedStr,
                clienteStr,
                opStr,
                `${codProd}\n${descProd}`,
                stText,
                Math.round(op.qtd_pendente || 0).toString(),
                `${formatDateBR(op.data_planejada)}\n${formatDateBR(op.data_fim_planejada)}`,
                `${Math.round(op.qtd_apontada || 0)} de ${Math.round(op.qtd_total || 0)}`,
                origDestStr
            ];
        });

        if (tableBody.length === 0) {
            tableBody.push([{ content: 'Nenhuma ordem encontrada para os filtros aplicados.', colSpan: 9, styles: { halign: 'center', textColor: [150,150,150] } }]);
        }

        autoTable(doc, {
            startY: startY,
            head: tableHead,
            body: tableBody,
            theme: 'grid',
            styles: { fontSize: 7, cellPadding: 2, valign: 'middle' },
            headStyles: { fillColor: [240, 244, 248], textColor: [50, 70, 90], fontStyle: 'bold' },
            columnStyles: {
                0: { cellWidth: 20 },
                1: { cellWidth: 35 },
                2: { cellWidth: 25, fontStyle: 'bold' },
                3: { cellWidth: 50 },
                4: { cellWidth: 25 },
                5: { cellWidth: 15, halign: 'right', fontStyle: 'bold', textColor: [220, 38, 38] },
                6: { cellWidth: 25 },
                7: { cellWidth: 25, halign: 'center' },
                8: { cellWidth: 35 }
            },
            margin: { left: ML, right: MR, top: HEADER_H + 10, bottom: 15 },
            didDrawPage: onDidDrawPage
        });

        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(150, 150, 150);
            doc.text(`Página ${i} de ${pageCount}`, pageWidth - MR, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
            doc.text(`Gerado via MetalFisa App`, ML, doc.internal.pageSize.getHeight() - 8);
        }

        doc.save(`Fila_Dependencias_${recurso || 'Todos'}_${activeTab}_${new Date().getTime()}.pdf`);
    } catch (err) {
        console.error('Erro ao gerar PDF da fila de dependências', err);
        throw err;
    }
};
