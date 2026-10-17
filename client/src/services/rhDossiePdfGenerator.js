import jsPDF from 'jspdf';
import 'jspdf-autotable';

/**
 * Gerador de PDF: Dossiê Funcional 360° do Colaborador
 */
export function gerarDossieColaboradorPdf(dados = {}) {
    const { usuario, detalhes, ocorrencias = [], atestados = [], faltas = [], avaliacoes = [], uniformes = [] } = dados;

    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const dataEmissao = new Date().toLocaleDateString('pt-BR');

    // Header
    doc.setFillColor(30, 41, 59);
    doc.rect(14, 12, 182, 16, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('DOSSIÊ FUNCIONAL 360° DO COLABORADOR', 105, 22, { align: 'center' });

    // Informações Básicas
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('1. DADOS CADASTRAIS & CONTRATUAIS', 14, 35);

    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 38, 182, 28, 2, 2, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`Nome: ${usuario?.NomeCompleto || '-'}`, 18, 45);
    doc.text(`Setor / Função: ${usuario?.Setor || '-'} - ${usuario?.Funcao || '-'}`, 18, 51);
    doc.text(`E-mail: ${usuario?.email || '-'}`, 18, 57);
    doc.text(`Contato: ${usuario?.whatsapp || usuario?.telefone || '-'}`, 18, 63);

    doc.text(`Regime: ${detalhes?.regime_contratacao || 'CLT'}`, 115, 45);
    doc.text(`CPF/CNPJ: ${detalhes?.cpf_cnpj || '-'}`, 115, 51);
    doc.text(`Admissão: ${detalhes?.data_admissao ? new Date(detalhes.data_admissao).toLocaleDateString('pt-BR') : '-'}`, 115, 57);
    doc.text(`Status: ${(detalhes?.status_funcional || 'ativo').toUpperCase()}`, 115, 63);

    let startY = 72;

    // 2. Ocorrências / Diário de Bordo
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`2. DIÁRIO DE OCORRÊNCIAS (${ocorrencias.length})`, 14, startY);

    const ocorrenciasBody = ocorrencias.map((o, idx) => [
        idx + 1,
        o.data_ocorrencia ? new Date(o.data_ocorrencia).toLocaleDateString('pt-BR') : '-',
        o.tipo?.toUpperCase() || 'FEEDBACK',
        o.titulo || '-',
        o.registrado_por_nome || 'RH'
    ]);

    doc.autoTable({
        startY: startY + 3,
        head: [['#', 'Data', 'Tipo', 'Título / Resumo', 'Registrado Por']],
        body: ocorrenciasBody.length > 0 ? ocorrenciasBody : [['-', '-', '-', 'Nenhuma ocorrência registrada', '-']],
        theme: 'grid',
        headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontSize: 7.5 },
        bodyStyles: { fontSize: 7.5 },
        styles: { cellPadding: 2 }
    });

    startY = doc.lastAutoTable.finalY + 8;

    // 3. Atestados Médicos
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`3. ATESTADOS MÉDICOS (${atestados.length})`, 14, startY);

    const atestadosBody = atestados.map((a, idx) => [
        idx + 1,
        a.data_inicio ? new Date(a.data_inicio).toLocaleDateString('pt-BR') : '-',
        `${a.dias_afastamento || 1} dias`,
        a.data_retorno ? new Date(a.data_retorno).toLocaleDateString('pt-BR') : '-',
        a.cid10 || '-',
        a.medico_nome || '-',
        a.abona_falta ? 'Sim (Abonado)' : 'Não'
    ]);

    doc.autoTable({
        startY: startY + 3,
        head: [['#', 'Início', 'Duração', 'Retorno', 'CID-10', 'Médico / CRM', 'Abona Falta?']],
        body: atestadosBody.length > 0 ? atestadosBody : [['-', '-', '-', '-', 'Nenhum atestado registrado', '-', '-']],
        theme: 'grid',
        headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontSize: 7.5 },
        bodyStyles: { fontSize: 7.5 },
        styles: { cellPadding: 2 }
    });

    startY = doc.lastAutoTable.finalY + 8;

    // 4. Avaliações de Desempenho 360°
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`4. AVALIAÇÕES DE DESEMPENHO 360° (${avaliacoes.length})`, 14, startY);

    const avaliacoesBody = avaliacoes.map((av, idx) => [
        idx + 1,
        av.data_avaliacao ? new Date(av.data_avaliacao).toLocaleDateString('pt-BR') : '-',
        av.avaliador_nome || 'Gestor',
        av.nota_comprometimento || '-',
        av.nota_pontualidade || '-',
        av.nota_qualidade_trabalho || '-',
        av.nota_conservacao_uniforme_5s || '-',
        `${av.media_geral || '0.0'} / 5.0`
    ]);

    doc.autoTable({
        startY: startY + 3,
        head: [['#', 'Data', 'Avaliador', 'Comprom.', 'Pontual.', 'Qualidade', '5S/EPI', 'Média Geral']],
        body: avaliacoesBody.length > 0 ? avaliacoesBody : [['-', '-', '-', '-', 'Nenhuma avaliação registrada', '-', '-', '-']],
        theme: 'grid',
        headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontSize: 7.5 },
        bodyStyles: { fontSize: 7.5 },
        styles: { cellPadding: 2 }
    });

    // Rodapé
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(`Dossiê Funcional • Emitido em ${dataEmissao} • Página ${i} de ${totalPages}`, 105, 290, { align: 'center' });
    }

    doc.save(`Dossie_360_${usuario?.NomeCompleto?.replace(/\s+/g, '_') || 'colaborador'}.pdf`);
}
