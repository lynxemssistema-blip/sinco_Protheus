import jsPDFLib from 'jspdf';
const jsPDF = jsPDFLib.jsPDF || jsPDFLib;
import autoTable from 'jspdf-autotable';
import { logoBase64 } from './metalfisaLogoBase64';
import { toast } from 'react-toastify';
import { getCompanyShortName } from './companyBranding';

/**
 * Utilitário para formatar data por extenso em pt-BR
 */
const formatarDataPorExtenso = (dataIsoOuObj) => {
    try {
        let d;
        if (typeof dataIsoOuObj === 'string') {
            const parts = dataIsoOuObj.split('T')[0].split('-');
            if (parts.length === 3) {
                d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            } else {
                d = new Date(dataIsoOuObj);
            }
        } else if (dataIsoOuObj instanceof Date) {
            d = dataIsoOuObj;
        } else {
            d = new Date();
        }

        const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
        const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

        const diaSemana = diasSemana[d.getDay()];
        const dia = String(d.getDate()).padStart(2, '0');
        const mes = meses[d.getMonth()];
        const ano = d.getFullYear();

        return `${diaSemana}, ${dia} de ${mes} de ${ano}`;
    } catch {
        return new Date().toLocaleDateString('pt-BR');
    }
};

/**
 * Desenha uma página da Folha de Porta para uma sala específica
 */
const desenharFolhaSala = (doc, sala, reservasSala, dataStr, currentUser, isFirstPage = true) => {
    if (!isFirstPage) {
        doc.addPage('a4', 'landscape');
    }

    const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
    const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
    const ML = 12; // Margem esquerda
    const MR = 12; // Margem direita
    const usableW = pageWidth - ML - MR; // 273mm

    // ==========================================
    // 1. CABEÇALHO CORPORATIVO LYNX EMS
    // ==========================================
    const hY = 8;
    const hH = 20;

    // Moldura principal do cabeçalho
    doc.setDrawColor(30, 58, 95); // Navy Lynx EMS #1E3A5F
    doc.setLineWidth(0.4);
    doc.rect(ML, hY, usableW, hH);

    const col1 = ML + 52; // Linha divisória da logo (64mm)
    const col2 = ML + 205; // Linha divisória para metadados (217mm)

    doc.setLineWidth(0.25);
    doc.line(col1, hY, col1, hY + hH);
    doc.line(col2, hY, col2, hY + hH);

    // 1.1 Logotipo Lynx EMS
    try {
        if (logoBase64) {
            doc.addImage(logoBase64, 'PNG', ML + 5, hY + 2.5, 42, 15);
        } else {
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 58, 95);
            doc.text(getCompanyShortName(), ML + 6, hY + 11);
            doc.setFontSize(6);
            doc.setFont('helvetica', 'normal');
            doc.text('INDUSTRIAL LTDA', ML + 6, hY + 15);
        }
    } catch {
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 58, 95);
        doc.text(getCompanyShortName(), ML + 6, hY + 12);
    }

    // 1.2 Título Central do Documento
    doc.setTextColor(30, 58, 95);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('FOLHA DE PORTA & AGENDA DIÁRIA DE REUNIÕES', col1 + 5, hY + 7);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(217, 119, 6); // Amber #D97706
    doc.text(`SALA: ${String(sala.nome || 'SALA DE REUNIÃO').toUpperCase()}`, col1 + 5, hY + 13);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    const recursosTxt = Array.isArray(sala.recursos) 
        ? sala.recursos.join(' • ') 
        : (typeof sala.recursos === 'string' ? sala.recursos.replace(/[\[\]"']/g, '') : 'TV, Climatizador, Wi-Fi');
    doc.text(`Localização: ${sala.localizacao || 'Bloco Administrativo'}  |  Capacidade: ${sala.capacidade || 10} pessoas  |  Recursos: ${recursosTxt}`, col1 + 5, hY + 17.5);

    // 1.3 Metadados do Dia e Emissão (Coluna Direita)
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'bold');
    doc.text(`DATA: ${dataStr}`, col2 + 4, hY + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Dia: ${formatarDataPorExtenso(dataStr).split(',')[0]}`, col2 + 4, hY + 9.5);
    doc.text(`Emissão: ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}h`, col2 + 4, hY + 13.5);
    doc.text(`Emissor: ${currentUser?.nome?.split(' ')[0] || 'Sistema Portaria'}`, col2 + 4, hY + 17.5);

    // ==========================================
    // 2. FAIXA DE IDENTIFICAÇÃO E DATA DA AGENDA
    // ==========================================
    let currentY = hY + hH + 3.5;

    doc.setFillColor(241, 245, 249); // slate-100
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setLineWidth(0.3);
    doc.roundedRect(ML, currentY, usableW, 7, 1, 1, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 95);
    doc.text(`CALENDÁRIO OFICIAL: ${formatarDataPorExtenso(dataStr).toUpperCase()}`, ML + 4, currentY + 4.8);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('DOCUMENTO DE FIXAÇÃO NA PORTA  •  USO OBRIGATÓRIO DE CHECK-IN / CHECK-OUT', ML + usableW - 4, currentY + 4.8, { align: 'right' });

    currentY += 9;

    // ==========================================
    // 3. TABELA 1: AGENDAMENTOS REGISTRADOS NO SISTEMA
    // ==========================================
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 95);
    doc.text(`1. REUNIÕES AGENDADAS NO SISTEMA (${reservasSala.length})`, ML, currentY);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 116, 139);
    doc.text('Horários reservados previamente via Portal Lynx EMS. Marque a presença física na porta.', ML + 80, currentY);

    currentY += 2;

    const formatarStatusBadge = (status) => {
        const s = String(status || 'confirmada').toLowerCase();
        if (s === 'confirmada') return '[✓] CONFIRMADA';
        if (s === 'em_andamento') return '[⚡] EM ANDAMENTO';
        if (s === 'concluida') return '[✓] CONCLUÍDA';
        if (s === 'liberada_antes') return '[⟲] LIBERADA ANTES';
        if (s === 'cancelada') return '[✗] CANCELADA';
        return `[ ] ${s.toUpperCase()}`;
    };

    let reservasTableBody = [];
    if (reservasSala.length > 0) {
        reservasTableBody = reservasSala.map((r, idx) => {
            const horario = `${r.hora_inicio || '00:00'} às ${r.hora_fim || '00:00'}`;
            const tituloEPauta = `${r.titulo || 'Reunião'}${r.pauta ? `\nPauta: ${r.pauta.substring(0, 120)}` : ''}`;
            const solicitante = `${r.organizador_nome || 'Não informado'}\nSetor: ${r.departamento_solicitante || 'PCP / Geral'}`;
            const participantes = r.participantes_nomes || (r.quantidade_participantes ? `${r.quantidade_participantes} pessoas` : 'Equipe');
            const statusTxt = formatarStatusBadge(r.status);
            const checkPorta = '[ ] Início: ___:___\n[ ] Fim: ___:___  Rubrica: ______';

            return [
                String(idx + 1).padStart(2, '0'),
                horario,
                tituloEPauta,
                solicitante,
                participantes,
                statusTxt,
                checkPorta
            ];
        });
    } else {
        reservasTableBody = [[
            '-',
            'LIVRE',
            'NENHUMA REUNIÃO AGENDADA NO SISTEMA PARA ESTA SALA NESTA DATA.\nSala disponível para uso avulso mediante preenchimento manual obrigatório abaixo.',
            '-',
            '-',
            '[✓] DISPONÍVEL',
            'Preencher seção 2'
        ]];
    }

    autoTable(doc, {
        startY: currentY,
        head: [[
            'Item',
            'Horário Reservado',
            'Assunto / Pauta da Reunião',
            'Responsável / Setor',
            'Participantes',
            'Status no Sistema',
            'Conferência na Porta'
        ]],
        body: reservasTableBody,
        margin: { left: ML, right: MR },
        tableWidth: usableW,
        styles: {
            fontSize: 7.2,
            cellPadding: 2,
            textColor: [30, 41, 59],
            valign: 'middle',
            lineWidth: 0.15,
            lineColor: [203, 213, 225]
        },
        headStyles: {
            fillColor: [30, 58, 95], // #1E3A5F
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 7.5,
            halign: 'center'
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252]
        },
        columnStyles: {
            0: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
            1: { cellWidth: 32, halign: 'center', fontStyle: 'bold', textColor: [30, 58, 95] },
            2: { cellWidth: 70 },
            3: { cellWidth: 42 },
            4: { cellWidth: 34 },
            5: { cellWidth: 35, halign: 'center', fontStyle: 'bold' },
            6: { cellWidth: 50, fontSize: 6.8, halign: 'left' }
        },
        didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 5) {
                const text = String(data.cell.raw || '');
                if (text.includes('CONFIRMADA')) {
                    data.cell.styles.textColor = [16, 124, 65]; // verde escuro
                } else if (text.includes('EM ANDAMENTO')) {
                    data.cell.styles.textColor = [217, 119, 6]; // âmbar
                } else if (text.includes('CANCELADA')) {
                    data.cell.styles.textColor = [185, 28, 28]; // vermelho
                }
            }
        },
        didDrawPage: (data) => {
            currentY = data.cursor.y;
        }
    });

    currentY += 4.5;

    // ==========================================
    // 4. TABELA 2: PREENCHIMENTO MANUAL À MÃO (USO AVULSO NA PORTA)
    // ==========================================
    // Garantir espaço mínimo na página para a tabela manual e o rodapé
    if (currentY > 140) {
        // Se a lista de reuniões for muito grande, podemos adicionar outra página, mas geralmente cabe em 1 página
        // Vamos ajustar para caber confortavelmente
    }

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 95);
    doc.text('2. PREENCHIMENTO MANUAL À MÃO  •  AGENDAMENTO AVULSO / USO DE PORTA', ML, currentY);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 83, 9); // Amber-700
    doc.text('✎ OBRIGATÓRIO: Caso utilize a sala sem reserva prévia no sistema, anote à caneta abaixo antes de iniciar.', ML + 115, currentY);

    currentY += 2;

    // Calcular quantas linhas manuais cabem (mínimo 4 linhas, idealmente 4 a 5 linhas bem pautadas)
    // Altura restante até o box de regras (que ocupa aprox 24mm no rodapé)
    const espacoDisponivel = (pageHeight - 28) - currentY;
    let qtdLinhasManuais = 4;
    let alturaLinhaManual = 9;

    if (espacoDisponivel > 45) {
        qtdLinhasManuais = 5;
        alturaLinhaManual = 8.5;
    } else if (espacoDisponivel < 35) {
        qtdLinhasManuais = 3;
        alturaLinhaManual = 8;
    }

    const linhasManuaisBody = [];
    for (let i = 1; i <= qtdLinhasManuais; i++) {
        linhasManuaisBody.push([
            String(i),
            '___:___ às ___:___',
            '_________________________________________________',
            'Nome: __________________________  Setor: ________',
            '____',
            '___________________',
            '[ ] Em Uso   [ ] Liberada'
        ]);
    }

    autoTable(doc, {
        startY: currentY,
        head: [[
            'Nº',
            'Horário Utilizado',
            'Assunto / Finalidade da Reunião (Preencher à mão)',
            'Responsável & Setor / Ramal',
            'Pessoas',
            'Assinatura / Rubrica',
            'Status Físico'
        ]],
        body: linhasManuaisBody,
        margin: { left: ML, right: MR },
        tableWidth: usableW,
        styles: {
            fontSize: 7.2,
            cellPadding: 2.2,
            textColor: [71, 85, 105],
            valign: 'middle',
            minCellHeight: alturaLinhaManual,
            lineWidth: 0.2,
            lineColor: [148, 163, 184]
        },
        headStyles: {
            fillColor: [71, 85, 105], // Slate escuro #475569 para diferenciar visualmente da tabela do sistema
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 7.5,
            halign: 'center'
        },
        alternateRowStyles: {
            fillColor: [255, 255, 255]
        },
        columnStyles: {
            0: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
            1: { cellWidth: 32, halign: 'center' },
            2: { cellWidth: 78 },
            3: { cellWidth: 54 },
            4: { cellWidth: 16, halign: 'center' },
            5: { cellWidth: 42, halign: 'center' },
            6: { cellWidth: 41, halign: 'center' }
        },
        didDrawPage: (data) => {
            currentY = data.cursor.y;
        }
    });

    // ==========================================
    // 5. BOX DE REGRAS 5S, CONSERVAÇÃO E VISTO SGQ
    // ==========================================
    const footerY = pageHeight - 21; // 189mm
    const footerH = 15;

    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(ML, footerY, usableW, footerH, 1, 1, 'FD');

    // Título das regras
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 95);
    doc.text('DIRETRIZES DE USO CONSCIENTE & CONSERVAÇÃO (5S LYNX EMS):', ML + 3, footerY + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(51, 65, 85);
    doc.text('• 1. Pontualidade: Respeite os horários de início e término agendados para não comprometer as próximas reuniões.', ML + 3, footerY + 7.5);
    doc.text('• 2. Limpeza & Descarte: Não deixe copos, garrafas ou papéis na mesa. Descarte o lixo nas lixeiras adequadas.', ML + 3, footerY + 10.5);
    doc.text('• 3. Economia & Equipamentos: Ao desocupar, desligue o ar-condicionado, TV / monitor e luzes, organizando as cadeiras.', ML + 3, footerY + 13.5);

    // Divisória para Visto da Portaria / SGQ
    const vistoColX = ML + usableW - 70;
    doc.setDrawColor(203, 213, 225);
    doc.line(vistoColX, footerY, vistoColX, footerY + footerH);

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 95);
    doc.text('VISTO / CONFERÊNCIA PORTARIA:', vistoColX + 3, footerY + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text('Inspeção 5S e liberação da sala:', vistoColX + 3, footerY + 7.5);
    doc.text('Assinatura: ___________________________', vistoColX + 3, footerY + 12.5);

    // Número da página
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.text(`Lynx EMS Sistema Integrado  •  Folha de Porta A4 Landscape  •  Página ${doc.internal.getCurrentPageInfo().pageNumber}`, pageWidth / 2, pageHeight - 3, { align: 'center' });
};

/**
 * Função principal para gerar o PDF da Agenda / Folha de Porta de Salas
 * 
 * @param {Object} params
 * @param {Object} params.sala - Objeto da sala selecionada (se todasAsSalas for falso)
 * @param {Array} params.salas - Lista completa de salas ativas
 * @param {Array} params.reservas - Lista de todas as reservas carregadas
 * @param {string} params.dataStr - Data selecionada no formato YYYY-MM-DD
 * @param {Object} params.currentUser - Usuário logado
 * @param {boolean} params.todasAsSalas - Se verdadeiro, gera 1 página para cada sala ativa
 */
export const gerarFolhaPortaPdf = async ({
    sala = null,
    salas = [],
    reservas = [],
    dataStr = '',
    currentUser = null,
    todasAsSalas = false
}) => {
    try {
        if (!dataStr) {
            const hoje = new Date();
            const pad = (n) => String(n).padStart(2, '0');
            dataStr = `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-${pad(hoje.getDate())}`;
        }

        // Determinar salas a processar
        let salasAlvo = [];
        if (todasAsSalas) {
            salasAlvo = salas.filter(s => s.ativo !== false);
            if (salasAlvo.length === 0 && sala) {
                salasAlvo = [sala];
            }
        } else {
            if (sala) {
                salasAlvo = [sala];
            } else if (salas.length > 0) {
                salasAlvo = [salas[0]];
            }
        }

        if (salasAlvo.length === 0) {
            toast.warn('Nenhuma sala disponível para gerar a folha de porta.');
            return;
        }

        // Inicializar documento jsPDF em modo paisagem A4
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        // Iterar sobre as salas alvo e desenhar cada folha
        salasAlvo.forEach((salaItem, index) => {
            // Filtrar reservas desta sala para a data informada
            const reservasDestaSala = reservas.filter(r => {
                const matchSala = String(r.sala_id) === String(salaItem.id);
                const rData = r.data_reserva ? String(r.data_reserva).substring(0, 10) : '';
                const matchData = rData === dataStr;
                const matchStatus = r.status !== 'cancelada';
                return matchSala && matchData && matchStatus;
            }).sort((a, b) => String(a.hora_inicio || '').localeCompare(String(b.hora_inicio || '')));

            desenharFolhaSala(
                doc,
                salaItem,
                reservasDestaSala,
                dataStr,
                currentUser,
                index === 0 // Primeira página reutiliza a inicial, seguintes dão addPage
            );
        });

        // Nome do arquivo de saída
        let filename = '';
        if (todasAsSalas) {
            filename = `Folhas_Porta_Todas_Salas_${dataStr}.pdf`;
        } else {
            const salaSanitizada = (salasAlvo[0]?.nome || 'Sala').replace(/[^a-zA-Z0-9_-]/g, '_');
            filename = `Folha_Porta_${salaSanitizada}_${dataStr}.pdf`;
        }

        // Tentar abrir em nova aba para visualização e salvar arquivo
        try {
            const blobUrl = doc.output('bloburl');
            if (blobUrl) {
                window.open(blobUrl, '_blank');
            }
        } catch (err) {
            console.warn('Não foi possível abrir janela pop-up, efetuando download direto:', err);
        }

        doc.save(filename);
        toast.success(
            todasAsSalas 
                ? `Folhas de porta de ${salasAlvo.length} sala(s) geradas com sucesso!`
                : `Folha de porta da ${salasAlvo[0]?.nome} gerada com sucesso!`
        );
    } catch (error) {
        console.error('Erro ao gerar folha de porta em PDF:', error);
        toast.error('Erro ao gerar documento PDF da folha de porta.');
    }
};
