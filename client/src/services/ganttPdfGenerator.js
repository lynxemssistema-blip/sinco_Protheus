import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Utilitários de data ───────────────────────────────────────────────────────
const safeDate = (val) => {
    if (!val) return new Date();
    if (val instanceof Date) return new Date(val.getFullYear(), val.getMonth(), val.getDate(), 12, 0, 0);
    const str = String(val).split('T')[0];
    return new Date(str + 'T12:00:00');
};

const fmtDate = (val) => {
    if (!val) return '-';
    const d = safeDate(val);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
};

const fmtShortDate = (val) => {
    if (!val) return '-';
    const d = safeDate(val);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
};

// Dias entre duas datas (inclusive)
const daysBetween = (a, b) => {
    const da = safeDate(a), db = safeDate(b);
    return Math.max(1, Math.round((db - da) / 86400000) + 1);
};

// Adiciona N dias corridos a uma data
const addDays = (base, n) => {
    const d = safeDate(base);
    d.setDate(d.getDate() + n);
    return d;
};

// Dia da semana: 0=dom, 6=sab
const dow = (d) => safeDate(d).getDay();

// ── Gerador principal ─────────────────────────────────────────────────────────
export const generateGanttPDF = async (opData, orderedGroups, operationPlans, aiAnalysisText) => {
    try {
        // ── Configuração da página: A4 Paisagem ──────────────────────────────
        const doc = new jsPDF('l', 'mm', 'a4');
        const PW = 297;  // largura A4 landscape
        const PH = 210;  // altura  A4 landscape
        const ML = 8, MR = 8, MT = 8;

        const opNumber = opData?.op || opData?.c2_num || 'N/A';
        const productName = opData?.desc_produto || opData?.produto || 'MÚLTIPLOS ITENS';
        const clientName  = opData?.nome_cliente || opData?.cliente || '';

        // ── Função cabeçalho ─────────────────────────────────────────────────
        const HDR_H = 18;
        const drawHeader = (subtitle) => {
            const y0 = MT;
            doc.setDrawColor(30, 30, 30);
            doc.setLineWidth(0.4);
            doc.rect(ML, y0, PW - ML - MR, HDR_H);

            const c1 = ML + 55, c2 = ML + 175, c3 = ML + 230;
            doc.setLineWidth(0.2);
            [c1, c2, c3].forEach(x => doc.line(x, y0, x, y0 + HDR_H));

            // Logo
            doc.setFontSize(14); doc.setFont('helvetica','bold'); doc.setTextColor(0,0,0);
            doc.text('METALFISA', ML + 4, y0 + 7);
            doc.setFontSize(6); doc.setFont('helvetica','normal'); doc.setTextColor(80,80,80);
            doc.text('Transformando metais em excelência', ML + 4, y0 + 12);

            // Empresa
            doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(0,0,0);
            doc.text('METALFISA METALURGICA LTDA', c1 + 3, y0 + 6);
            doc.setFontSize(6.5); doc.setFont('helvetica','normal'); doc.setTextColor(60,60,60);
            doc.text('R. Américo Santiago Piacenza, 516  —  CNPJ: 23.881.592/0001-01', c1 + 3, y0 + 10.5);
            doc.text('PCP - Planejamento e Controle de Produção', c1 + 3, y0 + 15);

            // Emissão
            doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(0,0,0);
            doc.text('EMISSÃO:', c2 + 3, y0 + 6);
            doc.setFont('helvetica','normal');
            doc.text(fmtDate(new Date()), c2 + 25, y0 + 6);

            // Título / OP
            doc.setFontSize(9); doc.setFont('helvetica','bold');
            doc.text(subtitle, c3 + (PW - MR - c3) / 2, y0 + 6, { align: 'center' });
            doc.setFontSize(8);
            doc.text(`OP: ${opNumber}`, c3 + (PW - MR - c3) / 2, y0 + 12, { align: 'center' });
        };

        // ── Função caixa produto ─────────────────────────────────────────────
        const PRD_Y = MT + HDR_H + 2;
        const PRD_H = 9;
        const drawProduct = () => {
            doc.setDrawColor(30,30,30); doc.setLineWidth(0.3);
            doc.rect(ML, PRD_Y, PW - ML - MR, PRD_H);
            doc.setFontSize(6); doc.setFont('helvetica','bold'); doc.setTextColor(100,100,100);
            doc.text('PRODUTO / PEÇA', ML + 2, PRD_Y + 3.5);
            const label = clientName ? `${productName}  |  Cliente: ${clientName}` : productName;
            doc.setFontSize(8.5); doc.setFont('helvetica','bold'); doc.setTextColor(0,0,0);
            doc.text(label, ML + 2, PRD_Y + 7.5);
        };

        // ══════════════════════════════════════════════════════════════════════
        // PÁGINA 1 — Tabela de dados detalhada
        // ══════════════════════════════════════════════════════════════════════
        drawHeader('PLANEJAMENTO SEQUENCIAL');
        drawProduct();

        const validGroups = orderedGroups.filter(g => operationPlans[g.code]?.selected);

        const tableRows = validGroups.map((g, i) => {
            const p = operationPlans[g.code] || {};
            return [
                (i + 1).toString(),
                g.code,
                g.desc || '-',
                fmtDate(p.start),
                fmtDate(p.end),
                `${p.duracao || 0} d`,
                p.locked ? 'Concluído' : (p.isAlreadyPlanned ? 'Replanejado' : 'Novo'),
            ];
        });

        autoTable(doc, {
            startY: PRD_Y + PRD_H + 3,
            head: [['#', 'Recurso', 'Descrição / Operação', 'Início', 'Fim', 'Duração', 'Status']],
            body: tableRows,
            theme: 'grid',
            headStyles: {
                fillColor: [25, 35, 55],
                textColor: [255,255,255],
                fontSize: 8,
                fontStyle: 'bold',
                halign: 'center',
                valign: 'middle',
                cellPadding: 2,
            },
            bodyStyles: {
                fontSize: 8,
                textColor: [20, 20, 20],
                cellPadding: 2,
                lineColor: [180,180,180],
                lineWidth: 0.15,
            },
            alternateRowStyles: { fillColor: [245, 247, 250] },
            columnStyles: {
                0: { halign: 'center', cellWidth: 10 },
                1: { halign: 'center', cellWidth: 38 },
                2: { halign: 'left',   cellWidth: 'auto' },
                3: { halign: 'center', cellWidth: 30 },
                4: { halign: 'center', cellWidth: 30 },
                5: { halign: 'center', cellWidth: 22 },
                6: { halign: 'center', cellWidth: 28 },
            },
            margin: { left: ML, right: MR, bottom: 12 },
            didDrawPage: ({ pageNumber }) => {
                doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(140,140,140);
                doc.text(`Pág. ${doc.internal.getCurrentPageInfo().pageNumber}`, PW - MR, PH - 5, { align: 'right' });
                doc.setTextColor(0,0,0);
            },
        });

        // ══════════════════════════════════════════════════════════════════════
        // PÁGINA 2 — Gráfico Gantt vetorial
        // ══════════════════════════════════════════════════════════════════════
        doc.addPage('a4', 'l');
        drawHeader('GRÁFICO GANTT');
        drawProduct();

        // ── Definição do espaço disponível ───────────────────────────────────
        const GANTT_TOP    = PRD_Y + PRD_H + 4;   // Y onde começa o gantt
        const GANTT_BOTTOM = PH - 14;              // Y onde termina
        const GANTT_H      = GANTT_BOTTOM - GANTT_TOP;

        const LABEL_W  = 52;   // largura da coluna de recursos
        const CHART_X  = ML + LABEL_W + 1;
        const CHART_W  = PW - MR - CHART_X;

        // ── Calcular intervalo total de datas ────────────────────────────────
        let minDate = null, maxDate = null;
        validGroups.forEach(g => {
            const p = operationPlans[g.code];
            if (!p?.start || !p?.end) return;
            const s = safeDate(p.start), e = safeDate(p.end);
            if (!minDate || s < minDate) minDate = s;
            if (!maxDate || e > maxDate) maxDate = e;
        });

        if (!minDate) {
            // Sem dados: aviso e encerra
            doc.setFontSize(11); doc.setFont('helvetica','italic'); doc.setTextColor(150,150,150);
            doc.text('Nenhum recurso planejado.', PW / 2, GANTT_TOP + 20, { align: 'center' });
            doc.save(`Gantt_Sequencial_OP_${opNumber}.pdf`);
            return true;
        }

        // Adiciona 1 dia de padding nos extremos
        minDate = addDays(minDate, -1);
        maxDate = addDays(maxDate,  1);

        const totalDays = daysBetween(minDate, maxDate);
        const pxPerDay  = CHART_W / totalDays; // mm por dia

        // ── Alturas das linhas ───────────────────────────────────────────────
        const ROW_H    = 8;    // altura de cada linha de recurso
        const HDR_ROW  = 10;   // altura da linha de datas no topo

        // Quantas linhas cabem
        const maxRows  = Math.floor((GANTT_H - HDR_ROW) / ROW_H);
        const rows     = validGroups.slice(0, maxRows);

        // ── Helper: x de uma data ────────────────────────────────────────────
        const dateToX = (dateVal) => {
            const days = daysBetween(minDate, dateVal) - 1;
            return CHART_X + days * pxPerDay;
        };

        // ── Desenha fundo do grid ────────────────────────────────────────────
        const GRID_TOP    = GANTT_TOP + HDR_ROW;
        const TOTAL_ROWS  = rows.length;
        const GRID_BOTTOM = GRID_TOP + TOTAL_ROWS * ROW_H;

        // Fundo branco
        doc.setFillColor(255,255,255);
        doc.rect(ML, GANTT_TOP, PW - ML - MR, GRID_BOTTOM - GANTT_TOP, 'F');
        doc.setDrawColor(200,200,200); doc.setLineWidth(0.15);
        doc.rect(ML, GANTT_TOP, PW - ML - MR, GRID_BOTTOM - GANTT_TOP);

        // ── Coluna de labels (vertical separada) ─────────────────────────────
        doc.setFillColor(30, 35, 55);
        doc.rect(ML, GANTT_TOP, LABEL_W, HDR_ROW, 'F');
        doc.setFontSize(6.5); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255);
        doc.text('RECURSO / OPERAÇÃO', ML + 2, GANTT_TOP + HDR_ROW / 2 + 2);

        // ── Cabeçalho de datas ────────────────────────────────────────────────
        // Agrupa por semana: exibe semana acima e dias abaixo
        // Linha 1 (semanas/meses): em cima da linha de dias
        let curDate = safeDate(minDate);
        const HALF_HDR = HDR_ROW / 2;
        const dayW = pxPerDay;

        // Itera dia a dia para desenhar colunas
        for (let di = 0; di < totalDays; di++) {
            const d = addDays(minDate, di);
            const x = CHART_X + di * dayW;
            const weekday = dow(d);
            const isWeekend = weekday === 0 || weekday === 6;

            // Fundo cinza para fim de semana na área de dados
            if (isWeekend) {
                doc.setFillColor(235, 237, 242);
                doc.rect(x, GRID_TOP, dayW, GRID_BOTTOM - GRID_TOP, 'F');
            }

            // Linha vertical do grid
            doc.setDrawColor(210, 210, 215); doc.setLineWidth(0.1);
            doc.line(x, GRID_TOP, x, GRID_BOTTOM);

            // Label do dia no cabeçalho
            if (dayW >= 3.5) {
                const dayLabel = String(d.getDate()).padStart(2,'0');
                const weekNames = ['D','S','T','Q','Q','S','S'];
                doc.setFontSize(isWeekend ? 5 : 5.5);
                doc.setFont('helvetica', isWeekend ? 'italic' : 'bold');
                doc.setTextColor(isWeekend ? 140 : 30, isWeekend ? 140 : 30, isWeekend ? 140 : 30);
                doc.text(dayLabel,           x + dayW / 2, GANTT_TOP + HALF_HDR + 2.5, { align: 'center' });
                doc.setFontSize(4.5);
                doc.setFont('helvetica','normal');
                doc.text(weekNames[weekday], x + dayW / 2, GANTT_TOP + HALF_HDR + 4.5, { align: 'center' });
            } else if (dayW >= 2 && d.getDate() % 2 === 0) {
                // Datas muito comprimidas: mostra apenas números pares
                doc.setFontSize(4); doc.setFont('helvetica','bold'); doc.setTextColor(50,50,50);
                doc.text(String(d.getDate()), x + dayW / 2, GANTT_TOP + HALF_HDR + 3.5, { align: 'center' });
            }
        }

        // Linha separadora do cabeçalho
        doc.setDrawColor(80,80,80); doc.setLineWidth(0.3);
        doc.line(ML, GANTT_TOP + HDR_ROW, PW - MR, GANTT_TOP + HDR_ROW);

        // Linha separadora label/chart (vertical)
        doc.line(CHART_X, GANTT_TOP, CHART_X, GRID_BOTTOM);

        // ── Mês no topo do cabeçalho ─────────────────────────────────────────
        // Detecta mudanças de mês e desenha label do mês
        const MONTH_NAMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        let lastMonth = -1;
        for (let di = 0; di < totalDays; di++) {
            const d = addDays(minDate, di);
            const mo = d.getMonth();
            if (mo !== lastMonth) {
                const x = CHART_X + di * dayW;
                // Background do mês no topo
                doc.setFillColor(25, 35, 55);
                // Calcular largura até próxima mudança de mês
                let endDi = di + 1;
                while (endDi < totalDays && addDays(minDate, endDi).getMonth() === mo) endDi++;
                const mW = (endDi - di) * dayW;
                if (mW >= 6) {
                    doc.setFillColor(30, 50, 90);
                    doc.rect(x, GANTT_TOP, mW, HALF_HDR, 'F');
                    doc.setFontSize(5.5); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255);
                    doc.text(`${MONTH_NAMES[mo]} ${d.getFullYear()}`, x + mW / 2, GANTT_TOP + HALF_HDR - 1.5, { align: 'center' });
                }
                lastMonth = mo;
            }
        }

        // ── Linhas de recursos + barras do Gantt ────────────────────────────
        rows.forEach((g, ri) => {
            const rowY     = GRID_TOP + ri * ROW_H;
            const midY     = rowY + ROW_H / 2;
            const plan     = operationPlans[g.code] || {};
            const isLocked = plan.locked;

            // Alternado de fundo nas linhas (labels)
            if (ri % 2 === 1) {
                doc.setFillColor(245, 247, 252);
                doc.rect(ML, rowY, LABEL_W, ROW_H, 'F');
            }

            // Linha horizontal separadora
            doc.setDrawColor(210,210,215); doc.setLineWidth(0.12);
            doc.line(ML, rowY + ROW_H, PW - MR, rowY + ROW_H);

            // ── Label do recurso ────────────────────────────────────────────
            // Código (pequeno, cinza)
            doc.setFontSize(5.5); doc.setFont('helvetica','bold');
            doc.setTextColor(isLocked ? 40 : 25, isLocked ? 100 : 60, isLocked ? 40 : 140);
            const codeText = g.code.length > 10 ? g.code.substring(0,10)+'…' : g.code;
            doc.text(codeText, ML + 2, midY - 1.2);

            // Descrição (mais escuro, normal)
            doc.setFontSize(6); doc.setFont('helvetica', isLocked ? 'italic' : 'normal');
            doc.setTextColor(30, 30, 30);
            const descText = (g.desc || g.code);
            const descMax  = descText.length > 20 ? descText.substring(0, 20)+'…' : descText;
            doc.text(descMax, ML + 2, midY + 2.5);

            // ── Barra do Gantt ───────────────────────────────────────────────
            if (plan.start && plan.end && plan.selected) {
                const barX  = dateToX(plan.start);
                const barX2 = dateToX(plan.end) + dayW;  // fim = último dia inclusive
                const barW  = Math.max(dayW * 0.5, barX2 - barX);
                const barH  = ROW_H * 0.68;
                const barY  = rowY + (ROW_H - barH) / 2;

                // Cor da barra
                const hasDiff = plan.start !== plan.baselineStart || plan.end !== plan.baselineEnd;
                let fillR = 37, fillG = 99, fillB = 235;   // azul
                if (isLocked)  { fillR = 22;  fillG = 163; fillB = 74;  } // verde
                if (hasDiff && !isLocked) { fillR = 217; fillG = 119; fillB = 6; }   // laranja

                // Sombra leve
                doc.setFillColor(0,0,0);
                doc.setDrawColor(0,0,0); doc.setLineWidth(0);
                doc.roundedRect(barX + 0.5, barY + 0.5, barW, barH, 1, 1, 'F');

                // Barra principal
                doc.setFillColor(fillR, fillG, fillB);
                doc.roundedRect(barX, barY, barW, barH, 1, 1, 'F');

                // Shine (brilho topo)
                doc.setFillColor(255, 255, 255);
                doc.setGState(new doc.GState({ opacity: 0.15 }));
                doc.rect(barX, barY, barW, barH * 0.4, 'F');
                doc.setGState(new doc.GState({ opacity: 1 }));

                // ── Texto dentro ou fora da barra ────────────────────────────
                const label = `${fmtShortDate(plan.start)} › ${fmtShortDate(plan.end)}`;
                doc.setFontSize(5.5);
                doc.setFont('helvetica', 'bold');
                const labelW = doc.getTextWidth(label);

                if (labelW <= barW - 3) {
                    // Cabe dentro
                    doc.setTextColor(255, 255, 255);
                    doc.text(label, barX + barW / 2, midY + 0.5, { align: 'center' });
                    
                    // Duração
                    if (barW > 18) {
                        doc.setFontSize(4.5); doc.setFont('helvetica','normal');
                        doc.setTextColor(220, 235, 255);
                        doc.text(`${plan.duracao}d`, barX + barW / 2, midY + 3.5, { align: 'center' });
                    }
                } else {
                    // Não cabe, mostra fora (à direita ou à esquerda se bater na borda)
                    doc.setTextColor(40, 40, 40); // preto/cinza escuro
                    if (barX + barW + 2 + labelW > PW - MR) {
                        // Se vazar a página pela direita, mostra à esquerda
                        doc.text(label, barX - 2, midY + 0.5, { align: 'right' });
                    } else {
                        // Normal: mostra à direita
                        doc.text(label, barX + barW + 2, midY + 0.5, { align: 'left' });
                    }
                }

                // Borda da barra
                doc.setDrawColor(fillR - 30 < 0 ? 0 : fillR - 30,
                                 fillG - 30 < 0 ? 0 : fillG - 30,
                                 fillB - 30 < 0 ? 0 : fillB - 30);
                doc.setLineWidth(0.2);
                doc.roundedRect(barX, barY, barW, barH, 1, 1, 'S');
            }
        });

        // ── Borda geral do grid ───────────────────────────────────────────────
        doc.setDrawColor(60, 60, 80); doc.setLineWidth(0.4);
        doc.rect(ML, GANTT_TOP, PW - ML - MR, GRID_BOTTOM - GANTT_TOP);

        // ── Legenda ───────────────────────────────────────────────────────────
        const LEG_Y = GRID_BOTTOM + 3;
        const items = [
            [37,99,235,   'Planejado'],
            [217,119,6,   'Alterado'],
            [22,163,74,   'Concluído'],
            [180,180,190, 'Fim de semana'],
        ];
        let lx = ML;
        items.forEach(([r,g,b,lbl]) => {
            doc.setFillColor(r,g,b);
            doc.rect(lx, LEG_Y, 5, 3.5, 'F');
            doc.setFontSize(6); doc.setFont('helvetica','normal'); doc.setTextColor(40,40,40);
            doc.text(lbl, lx + 6.5, LEG_Y + 2.8);
            lx += 6.5 + doc.getTextWidth(lbl) + 6;
        });

        // ── Rodapé ───────────────────────────────────────────────────────────
        doc.setFontSize(6.5); doc.setFont('helvetica','normal'); doc.setTextColor(130,130,130);
        doc.text(
            `Gerado em ${fmtDate(new Date())}  |  MetalFisa PCP System`,
            PW / 2, PH - 4, { align: 'center' }
        );
        doc.text(`Pág. 2`, PW - MR, PH - 4, { align: 'right' });
        doc.setTextColor(0,0,0);

        // ── ABA 3 (Opcional) — Análise PCP IA ────────────────────────────────
        if (aiAnalysisText) {
            doc.addPage('a4', 'l');
            drawHeader('ANÁLISE PCP IA');
            drawProduct();

            const AI_TOP = PRD_Y + PRD_H + 8;
            
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(40, 40, 40);

            // Clean Markdown markers like ** and ##
            let cleanText = aiAnalysisText.replace(/\*\*/g, '').replace(/#/g, '');

            const lines = doc.splitTextToSize(cleanText, PW - ML - MR - 4);
            doc.text(lines, ML + 2, AI_TOP);

            // Rodapé da página 3
            doc.setFontSize(6.5); doc.setFont('helvetica','normal'); doc.setTextColor(130,130,130);
            doc.text(
                `Gerado em ${fmtDate(new Date())}  |  MetalFisa PCP System`,
                PW / 2, PH - 4, { align: 'center' }
            );
            doc.text(`Pág. 3`, PW - MR, PH - 4, { align: 'right' });
            doc.setTextColor(0,0,0);
        }

        // ── Salva ─────────────────────────────────────────────────────────────
        doc.save(`Gantt_Sequencial_OP_${opNumber}.pdf`);
        return true;

    } catch (err) {
        console.error('[GanttPDF] Erro ao gerar:', err);
        throw err;
    }
};
