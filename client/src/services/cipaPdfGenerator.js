import jsPDFLib from 'jspdf';
const jsPDF = jsPDFLib.jsPDF || jsPDFLib;
import autoTable from 'jspdf-autotable';
import { logoBase64 } from './metalfisaLogoBase64';
import { getCompanyLegalName, getCompanyCnpjCityLine } from './companyBranding';

// Helper de Cabeçalho Corporativo Lynx EMS
const drawHeader = (doc, title, subtitle) => {
    const ML = 14;
    const MR = 196;
    const contentWidth = MR - ML;
    let currentY = 14;

    try {
        if (logoBase64) {
            doc.addImage(logoBase64, 'PNG', ML, currentY, 38, 13);
        }
    } catch (e) {
        console.warn('Erro ao renderizar logo no PDF:', e);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 58, 95); // Azul Marinho Lynx EMS
    doc.text(getCompanyLegalName(), 56, currentY + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(getCompanyCnpjCityLine(), 56, currentY + 8.5);
    doc.text('Módulo de Segurança do Trabalho (SST)  |  CIPA - NR-05 e Lei 14.457/2022', 56, currentY + 12.5);

    currentY += 17;
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.line(ML, currentY, MR, currentY);

    currentY += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(title.toUpperCase(), contentWidth / 2 + ML, currentY, { align: 'center' });

    if (subtitle) {
        currentY += 4.5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(subtitle, contentWidth / 2 + ML, currentY, { align: 'center' });
    }

    return currentY + 6;
};

// Helper de Rodapé
const drawFooter = (doc, pageText = 'Documento Gerado Eletronicamente') => {
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.line(14, 285, 196, 285);
        doc.text(`${pageText} — Autenticação Eletrônica Lynx EMS`, 14, 289);
        doc.text(`Página ${i} de ${pageCount}`, 196, 289, { align: 'right' });
    }
};

/**
 * 1. EDITAL DE CONVOCAÇÃO DA ELEIÇÃO DA CIPA
 */
export const generateEditalCipaPdf = (data) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const { gestao, cronograma = [], comissao = [] } = data;

    let y = drawHeader(
        doc,
        'EDITAL DE CONVOCAÇÃO DE ELEIÇÃO DA CIPA',
        `GESTÃO ${gestao?.ano_inicio || 2026} / ${gestao?.ano_fim || 2027} — NR-05 E LEI 14.457/2022`
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);

    const textoEdital = [
        `A LYNX EMS, em conformidade com as disposições da Norma Regulamentadora nº 05 (NR-05) da Secretaria de Trabalho e Emprego e a Lei nº 14.457/2022, CONVOCA todos os seus empregados para a Eleição dos seus representantes na Comissão Interna de Prevenção de Acidentes e Assédio (CIPA) para o mandato da Gestão ${gestao?.ano_inicio}/${gestao?.ano_fim}.`,
        '',
        `1. DO PROCESSO ELEITORAL ELETRÔNICO: A eleição será realizada de forma 100% eletrônica, garantindo o sigilo absoluto do voto, a ampla participação dos colaboradores através do Portal do Colaborador (celular) e totens acessíveis nas áreas de fábrica e portaria.`,
        '',
        `2. DAS VAGAS DISPONÍVEIS: Serão eleitos pelos empregados ${gestao?.vagas_titulares_eleitos || 4} membros Titulares e ${gestao?.vagas_suplentes_eleitos || 3} membros Suplentes, além do contingente paritário indicado pelo empregador.`,
        '',
        `3. DA ESTABILIDADE PROVISÓRIA: Fica assegurada a estabilidade provisória no emprego aos candidatos inscritos desde o registro da candidatura até um ano após o final do mandato, caso eleitos (Art. 10, II, "a" do ADCT e Art. 165 da CLT).`
    ];

    const splitTexto = doc.splitTextToSize(textoEdital.join('\n'), 182);
    doc.text(splitTexto, 14, y);
    y += splitTexto.length * 4.2 + 4;

    // Tabela de Cronograma
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 58, 95);
    doc.text('CRONOGRAMA OFICIAL DAS ETAPAS (NR-05):', 14, y);
    y += 3;

    const cronRows = (cronograma || []).map(c => [
        c.descricao_etapa,
        c.data_prevista ? new Date(c.data_prevista).toLocaleDateString('pt-BR') : 'A definir',
        c.status === 'concluido' ? 'CONCLUÍDO' : 'PROGRAMADO'
    ]);

    autoTable(doc, {
        startY: y,
        head: [['Etapa do Processo Eleitoral', 'Data Limite / Prevista', 'Status']],
        body: cronRows.length ? cronRows : [['Cronograma em fase de publicação', 'A Definir', 'PROGRAMADO']],
        theme: 'striped',
        headStyles: { fillColor: [31, 54, 92], textColor: 255, fontSize: 8, fontStyle: 'bold' },
        styles: { fontSize: 7.5, cellPadding: 2 },
        margin: { left: 14, right: 14 }
    });

    y = doc.lastAutoTable.finalY + 12;

    // Assinaturas
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Betim/MG, ${new Date().toLocaleDateString('pt-BR')}.`, 14, y);

    y += 15;
    doc.line(14, y, 90, y);
    doc.line(110, y, 186, y);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(getCompanyLegalName(), 52, y + 4, { align: 'center' });
    doc.text('COMISSÃO ELEITORAL DA CIPA', 148, y + 4, { align: 'center' });

    drawFooter(doc, 'Edital de Convocação CIPA NR-05');
    doc.save(`Edital_CIPA_Gestao_${gestao?.ano_inicio}_${gestao?.ano_fim}.pdf`);
};

/**
 * 2. ATA DE ELEIÇÃO E APURAÇÃO DOS VOTOS
 */
export const generateAtaEleicaoCipaPdf = (data) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const { gestao, candidatos = [], totalAptos, totalVotaram, totalBrancos = 0, totalNulos = 0 } = data;

    let y = drawHeader(
        doc,
        'ATA DE ELEIÇÃO E APURAÇÃO DA CIPA',
        `GESTÃO ${gestao?.ano_inicio || 2026} / ${gestao?.ano_fim || 2027} — VOTAÇÃO ELETRÔNICA NR-05`
    );

    const percentual = totalAptos > 0 ? ((totalVotaram / totalAptos) * 100).toFixed(1) : 0;
    const quorumMinimo = Math.floor(totalAptos / 2) + 1;

    // Resumo da Eleição
    const resumoData = [
        ['Total de Colaboradores Aptos na Empresa:', `${totalAptos} colaboradores`],
        ['Total de Votos Coletados na Urna Eletrônica:', `${totalVotaram} votos`],
        ['Percentual de Quórum Registrado:', `${percentual}% (Mínimo legal exigido: ${quorumMinimo} votos)`],
        ['Condição Legal de Quórum (NR-05.5.4):', totalVotaram >= quorumMinimo ? 'VALIDADO / QUÓRUM ATINGIDO' : 'PRORROGAÇÃO NECESSÁRIA'],
        ['Votos Válidos:', `${totalVotaram - totalBrancos - totalNulos}`],
        ['Votos em Branco:', `${totalBrancos}`],
        ['Votos Nulos:', `${totalNulos}`]
    ];

    autoTable(doc, {
        startY: y,
        body: resumoData,
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 1.5, textColor: [30, 41, 59] },
        columnStyles: { 0: { fontStyle: 'bold', width: 90 } },
        margin: { left: 14, right: 14 }
    });

    y = doc.lastAutoTable.finalY + 6;

    // Tabela de Classificação
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 58, 95);
    doc.text('RESULTADO DA APURAÇÃO DOS CANDIDATOS:', 14, y);
    y += 3;

    const candRows = (candidatos || []).map((c, idx) => [
        c.classificacao || (idx + 1),
        `Chapa ${c.numero_chapa} - ${c.nome_urna || c.nome_completo}`,
        c.cargo_setor || 'Fábrica',
        `${c.total_votos || 0} votos`,
        c.resultado === 'titular_eleito' ? 'TITULAR ELEITO' :
        c.resultado === 'suplente_eleito' ? 'SUPLENTE ELEITO' : 'NÃO ELEITO'
    ]);

    autoTable(doc, {
        startY: y,
        head: [['Class.', 'Candidato / Chapa', 'Função / Setor', 'Votos', 'Resultado Oficial']],
        body: candRows,
        theme: 'striped',
        headStyles: { fillColor: [31, 54, 92], textColor: 255, fontSize: 8, fontStyle: 'bold' },
        styles: { fontSize: 7.5, cellPadding: 2 },
        margin: { left: 14, right: 14 }
    });

    y = doc.lastAutoTable.finalY + 12;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const textoFechamento = `Lavrada esta ata eletrônica em cumprimento rigoroso à NR-05, com sigilo criptográfico dos votos garantido por sistema auditável. Os eleitos titulares e suplentes serão devidamente convocados para o treinamento obrigatório de 20 horas antes da posse.`;
    const splitFechamento = doc.splitTextToSize(textoFechamento, 182);
    doc.text(splitFechamento, 14, y);

    y += splitFechamento.length * 4 + 14;
    doc.line(14, y, 90, y);
    doc.line(110, y, 186, y);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('PRESIDENTE DA COMISSÃO ELEITORAL', 52, y + 4, { align: 'center' });
    doc.text('SECRETÁRIO DA COMISSÃO ELEITORAL', 148, y + 4, { align: 'center' });

    drawFooter(doc, 'Ata de Eleição e Apuração CIPA');
    doc.save(`Ata_Eleicao_CIPA_${gestao?.ano_inicio}_${gestao?.ano_fim}.pdf`);
};

/**
 * 3. ATA DE INSTALAÇÃO E POSSE DA CIPA
 */
export const generateAtaPosseCipaPdf = (data) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const { gestao, membros = [] } = data;

    let y = drawHeader(
        doc,
        'ATA DE INSTALAÇÃO E POSSE DA CIPA',
        `GESTÃO ${gestao?.ano_inicio || 2026} / ${gestao?.ano_fim || 2027} — NR-05 E LEI 14.457/2022`
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);

    const textoPosse = `Aos ${gestao?.data_inicio_mandato ? new Date(gestao.data_inicio_mandato).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')}, nas dependências da LYNX EMS, reuniram-se os representantes dos empregados eleitos por voto secreto e os representantes indicados pela direção da empresa para a cerimônia de Instalação e Posse da Comissão Interna de Prevenção de Acidentes e Assédio (CIPA), mandato ${gestao?.ano_inicio}/${gestao?.ano_fim}.\n\nOs membros abaixo empossados completaram o treinamento obrigatório de 20 horas e firmam o compromisso de zelar pela segurança dos colaboradores e combater ativamente o assédio sexual e moral no ambiente de trabalho.`;
    const splitPosse = doc.splitTextToSize(textoPosse, 182);
    doc.text(splitPosse, 14, y);
    y += splitPosse.length * 4.2 + 4;

    const membrosRows = (membros || []).map(m => [
        m.nome_completo || 'Colaborador',
        m.cargo_cipa === 'presidente' ? 'PRESIDENTE' :
        m.cargo_cipa === 'vice_presidente' ? 'VICE-PRESIDENTE' :
        m.cargo_cipa === 'secretario' ? 'SECRETÁRIO' : 'MEMBRO',
        m.origem === 'eleito' ? 'Representante dos Empregados' : 'Representante do Empregador',
        m.tipo_vaga === 'titular' ? 'TITULAR' : 'SUPLENTE',
        'Treinamento Concluído'
    ]);

    autoTable(doc, {
        startY: y,
        head: [['Nome do Cipeiro', 'Cargo na CIPA', 'Origem da Representação', 'Vaga', 'Treinamento']],
        body: membrosRows,
        theme: 'striped',
        headStyles: { fillColor: [31, 54, 92], textColor: 255, fontSize: 8, fontStyle: 'bold' },
        styles: { fontSize: 7.5, cellPadding: 2 },
        margin: { left: 14, right: 14 }
    });

    y = doc.lastAutoTable.finalY + 16;
    doc.line(14, y, 90, y);
    doc.line(110, y, 186, y);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('DIRETORIA LYNX EMS', 52, y + 4, { align: 'center' });
    doc.text('PRESIDENTE EMPOSTO DA CIPA', 148, y + 4, { align: 'center' });

    drawFooter(doc, 'Ata de Instalação e Posse CIPA');
    doc.save(`Ata_Posse_CIPA_${gestao?.ano_inicio}_${gestao?.ano_fim}.pdf`);
};

/**
 * 4. ATA DE REUNIÃO ORDINÁRIA MENSAL
 */
export const generateAtaReuniaoCipaPdf = (data) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const { reuniao, gestao, presencas = [] } = data;

    let y = drawHeader(
        doc,
        `ATA DE REUNIÃO ORDINÁRIA CIPA — ${reuniao?.numero_ata || '01'}`,
        `COMPETÊNCIA: ${reuniao?.mes_competencia || 'MENSAL'} — GESTÃO ${gestao?.ano_inicio || 2026}/${gestao?.ano_fim || 2027}`
    );

    const dadosReuniao = [
        ['Data da Reunião:', reuniao?.data_reuniao ? new Date(reuniao.data_reuniao).toLocaleDateString('pt-BR') : 'Data'],
        ['Horário de Realização:', `${reuniao?.horario_inicio || '09:00'} às ${reuniao?.horario_fim || '10:00'}`],
        ['Local da Reunião:', reuniao?.local || 'Sala de Reuniões Principal - Lynx EMS'],
        ['Pauta Discutida:', reuniao?.pauta || 'Avaliação mensal de riscos e segurança']
    ];

    autoTable(doc, {
        startY: y,
        body: dadosReuniao,
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 1.5, textColor: [30, 41, 59] },
        columnStyles: { 0: { fontStyle: 'bold', width: 45 } },
        margin: { left: 14, right: 14 }
    });

    y = doc.lastAutoTable.finalY + 5;

    // Conteúdo da Ata
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 58, 95);
    doc.text('DELIBERAÇÕES E REGISTRO DA ATA:', 14, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    const splitAta = doc.splitTextToSize(reuniao?.conteudo_ata || 'Sem deliberações adicionais registradas.', 182);
    doc.text(splitAta, 14, y);
    y += splitAta.length * 4 + 6;

    // Lista de Presença e Assinaturas
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 58, 95);
    doc.text('ASSINATURAS DOS MEMBROS PRESENTES:', 14, y);
    y += 3;

    const presRows = (presencas || []).map(p => [
        p.NomeCompleto || p.nome || 'Membro',
        p.cargo_cipa || 'Membro CIPA',
        p.presente ? 'PRESENTE' : 'AUSENTE',
        p.assinado_digitalmente ? `Assinado Digitalmente (${p.hash_assinatura ? p.hash_assinatura.substring(0, 10) + '...' : 'OK'})` : 'Pendente de Assinatura'
    ]);

    autoTable(doc, {
        startY: y,
        head: [['Nome do Membro', 'Função CIPA', 'Presença', 'Autenticação Digital']],
        body: presRows,
        theme: 'striped',
        headStyles: { fillColor: [31, 54, 92], textColor: 255, fontSize: 8, fontStyle: 'bold' },
        styles: { fontSize: 7.5, cellPadding: 2 },
        margin: { left: 14, right: 14 }
    });

    drawFooter(doc, `Ata CIPA ${reuniao?.numero_ata || ''}`);
    doc.save(`Ata_CIPA_${reuniao?.numero_ata || 'Reuniao'}.pdf`);
};
