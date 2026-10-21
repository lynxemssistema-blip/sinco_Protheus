import jsPDF from 'jspdf';
import 'jspdf-autotable';

/**
 * Gerador de PDF Oficial: Ficha de Controle e Entrega de EPI (Norma NR-06)
 */
export function gerarFichaEpiPdf(colaborador, ficha, entregas = [], empresa = null) {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const empresaNome = empresa?.nome || empresa?.RazaoSocial || 'Lynx EMS';
    const agora = new Date().toLocaleDateString('pt-BR');

    // Cabeçalho da Empresa
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(14, 12, 182, 18, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(empresaNome.toUpperCase(), 105, 19, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('FICHA DE CONTROLE E ENTREGA DE EQUIPAMENTO DE PROTEÇÃO INDIVIDUAL (EPI) - NR-06', 105, 26, { align: 'center' });

    // Dados do Colaborador
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('1. DADOS DO COLABORADOR', 14, 38);

    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 41, 182, 22, 2, 2, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Nome: ${colaborador?.NomeCompleto || '-'}`, 18, 48);
    doc.text(`Setor: ${colaborador?.Setor || '-'}`, 18, 54);
    doc.text(`Função: ${colaborador?.Funcao || '-'}`, 18, 60);

    doc.text(`Matrícula/ID: #${colaborador?.idUsuario || '-'}`, 120, 48);
    doc.text(`Data Abertura da Ficha: ${ficha?.data_abertura ? new Date(ficha.data_abertura).toLocaleDateString('pt-BR') : agora}`, 120, 54);
    doc.text(`Status: ${ficha?.status === 'ativo' ? 'EM ATIVIDADE' : 'ENCERRADO'}`, 120, 60);

    // Termo de Responsabilidade (NR-06)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('2. TERMO DE COMPROMISSO E DECLARAÇÃO DE RECEBIMENTO (PORTARIA NR-06)', 14, 71);

    const termoTexto = 
        'Declaro ter recebido da empresa, gratuitamente, os Equipamentos de Proteção Individual (EPIs) abaixo relacionados, ' +
        'em perfeito estado de conservação e funcionamento, adequados ao risco de minha atividade. Comprometo-me a usá-los ' +
        'apenas para as finalidades a que se destinam, responsabilizando-me pela guarda e conservação, e a comunicar qualquer ' +
        'alteração que os torne impróprios para uso, estando ciente das disposições da NR-06 da Portaria 3.214/78 do MTE.';

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    const splitTermo = doc.splitTextToSize(termoTexto, 182);
    doc.text(splitTermo, 14, 76);

    // Tabela de Entregas
    const tableBody = entregas.map((e, index) => [
        index + 1,
        e.data_entrega ? new Date(e.data_entrega).toLocaleDateString('pt-BR') : '-',
        e.ca_numero || '-',
        e.epi_nome || e.produto_codigo || '-',
        `${parseFloat(e.quantidade || 1)} ${e.unidade || 'UN'}`,
        e.motivo ? e.motivo.toUpperCase() : 'PERIÓDICO',
        e.previsao_troca ? new Date(e.previsao_troca).toLocaleDateString('pt-BR') : '-',
        e.termo_aceite_digital ? 'ACEITE DIGITAL (OK)' : '___________________'
    ]);

    doc.autoTable({
        startY: 92,
        head: [['#', 'Data Entrega', 'Nº CA', 'Descrição do EPI', 'Qtd', 'Motivo', 'Prev. Troca', 'Assinatura / Aceite']],
        body: tableBody.length > 0 ? tableBody : [['-', '-', '-', 'Nenhum EPI entregue registrado.', '-', '-', '-', '-']],
        theme: 'grid',
        headStyles: {
            fillColor: [30, 41, 59],
            textColor: [255, 255, 255],
            fontSize: 7.5,
            halign: 'center',
            fontStyle: 'bold'
        },
        bodyStyles: {
            fontSize: 7.5,
            textColor: [30, 41, 59],
            halign: 'center'
        },
        columnStyles: {
            3: { halign: 'left', cellWidth: 50 },
            7: { cellWidth: 38 }
        },
        styles: {
            overflow: 'linebreak',
            cellPadding: 2
        }
    });

    const finalY = doc.lastAutoTable.finalY + 15;

    // Assinaturas se couber na página, senão nova página
    if (finalY < 250) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);

        doc.line(20, finalY + 15, 85, finalY + 15);
        doc.text('Assinatura do Colaborador', 52.5, finalY + 20, { align: 'center' });

        doc.line(115, finalY + 15, 180, finalY + 15);
        doc.text('Responsável pela Entrega (SST/RH)', 147.5, finalY + 20, { align: 'center' });
    }

    doc.save(`Ficha_EPI_NR06_${colaborador?.NomeCompleto?.replace(/\s+/g, '_') || 'colaborador'}.pdf`);
}
