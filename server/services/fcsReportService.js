/**
 * fcsReportService.js
 * Geracao de relatorios Excel para o Planejamento Inteligente (FCS).
 * Estilo MetalFisa - mesma paleta de cores dos demais relatorios do sistema.
 */
const ExcelJS = require("exceljs");
const path    = require("path");
const fs      = require("fs");

const NAVY   = "FF1E3A5F";
const BLUE   = "FF0D6EFD";
const WHITE  = "FFFFFFFF";
const GRAY   = "FFF5F7FA";
const DGRAY  = "FFD0D7E2";
const BLACK  = "FF1A1A2E";
const ACCENT = "FF00B4D8";
const GREEN  = "FF22C55E";
const AMBER  = "FFF59E0B";
const RED    = "FFEF4444";
const LGRAY  = "FFE2E8F0";

const setFill   = (c, argb) => { c.fill   = { type: "pattern", pattern: "solid", fgColor: { argb } }; };
const setFont   = (c, opts) => { c.font   = { name: "Calibri", ...opts }; };
const setAlign  = (c, h, v = "middle") => { c.alignment = { horizontal: h, vertical: v, wrapText: true }; };
const setBorder = (c, style = "thin", color = DGRAY) => {
    const s = { style, color: { argb: color } };
    c.border = { top: s, left: s, bottom: s, right: s };
};

// Formata recurso como "MO0013 - LASER" (ou só "MO0013" se não há descrição diferente do código)
const fmtRecurso = (code, desc) => {
    if (!code) return "";
    const d = (desc || "").trim();
    if (!d || d === code.trim()) return code.trim();
    return `${code.trim()} - ${d}`;
};

// Monta mapa código → descrição a partir do relatório (resumo_recursos + decisoes)
const buildDescMap = (report) => {
    const m = {};
    Object.entries(report.resumo_recursos || {}).forEach(([k, v]) => {
        m[k.trim()] = (v.desc_recurso || k).trim();
    });
    (report.decisoes || []).forEach(d => {
        if (d.recurso && !m[d.recurso.trim()]) m[d.recurso.trim()] = (d.desc_recurso || d.recurso).trim();
    });
    return m;
};

const fmtMin = (m) => {
    const total = Math.round(m || 0); // elimina artefatos float
    const h = Math.floor(total / 60);
    const mn = total % 60;
    // Formato brasileiro: 19:31 (quando tem horas) ou 45min (só minutos)
    return h > 0 ? `${h}:${String(mn).padStart(2, "0")}` : `${mn}min`;
};
// Conversão MetalFisa: 1 hora produtiva = 50 minutos (padrão da empresa)
const MF_MIN_POR_HORA = 50;
const fmtHoras = (m) => {
    if (!m || m <= 0) return "0,0 h";
    const horas = (Math.round(m) / MF_MIN_POR_HORA).toFixed(1);
    return horas.replace(".", ",") + " h";
};
const fmtMinHoras = (m) => `${Math.round(m || 0)} min  (${fmtHoras(m)})`;
const fmtDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};
const weekDay = (iso) => {
    if (!iso) return "";
    const d = new Date(iso + "T12:00:00");
    return ["Dom","Seg","Ter","Qua","Qui","Sex","Sab"][d.getDay()];
};
const utilizationColor = (pct) => {
    if (pct >= 90) return RED;
    if (pct >= 70) return AMBER;
    return GREEN;
};

const LOGO_PATH = path.join(__dirname, "../public/metalfisa-logo.png");
// Dimensões reais do logo: 139×130px — proporção ~1.069:1
// ExcelJS usa EMU (English Metric Units): 1px ≈ 9525 EMU
const LOGO_W_EMU = Math.round(110 * 9525); // 110px de largura → preserva proporção sem esticar
const LOGO_H_EMU = Math.round(103 * 9525); // 103px de altura (110 / 1.069 ≈ 103)
function addLogoToSheet(wb, ws, topLeftCol = 0, topLeftRow = 0) {
    if (!fs.existsSync(LOGO_PATH)) return;
    try {
        const imageId = wb.addImage({ filename: LOGO_PATH, extension: "png" });
        ws.addImage(imageId, {
            tl: { col: topLeftCol, row: topLeftRow },
            ext: { width: LOGO_W_EMU / 9525, height: LOGO_H_EMU / 9525 }, // em pixels, ExcelJS converte
            editAs: "absolute",  // não estica com a célula
        });
    } catch (_) {}
}

function buildHeader(wb, ws, cols, titulo, subtitulo, planejador, dataBase, geradoEm) {
    ws.views = [{ showGridLines: false }];
    ws.mergeCells("A1:" + cols + "2");
    const hCell = ws.getCell("A1");
    hCell.value = "METALFISA INDUSTRIA E COMERCIO LTDA";
    setFill(hCell, NAVY); setFont(hCell, { bold: true, size: 16, color: { argb: WHITE } });
    setAlign(hCell, "center", "middle");
    ws.getRow(1).height = 22; ws.getRow(2).height = 22;
    addLogoToSheet(wb, ws, 0, 0); // col=0 row=0 — tamanho fixo, sem distorção
    ws.mergeCells("A3:" + cols + "3");
    const tCell = ws.getCell("A3");
    tCell.value = titulo;
    setFill(tCell, BLUE); setFont(tCell, { bold: false, size: 11, italic: true, color: { argb: WHITE } });
    setAlign(tCell, "center", "middle"); ws.getRow(3).height = 20;
    ws.mergeCells("A4:" + cols + "4"); setFill(ws.getCell("A4"), ACCENT); ws.getRow(4).height = 3;
    ws.getRow(5).height = 14;
    const meta = [
        ["Subtitulo:", subtitulo],
        ["Planejado por:", planejador],
        ["Data Base:", fmtDate(dataBase)],
        ["Emitido em:", geradoEm],
    ];
    meta.forEach(([label, val], i) => {
        const row = ws.getRow(6 + i);
        const lc = row.getCell(1); const vc = row.getCell(2);
        lc.value = label; vc.value = val || "—";
        setFont(lc, { bold: true, size: 9, color: { argb: NAVY } });
        setFont(vc, { size: 9, color: { argb: BLACK } }); row.height = 14;
    });
    ws.getRow(10).height = 8;
}

function buildSheetCapa(wb, ws, report, meta) {
    ws.pageSetup = { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    const COL_WIDTHS = [22, 22, 22, 22, 22, 22];
    COL_WIDTHS.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    ws.views = [{ showGridLines: false }];
    buildHeader(wb, ws, "F",
        "Relatorio de Planejamento Inteligente FCS",
        "Agente FCS - " + (report.total_ops || 0) + " OPs processadas - " + Object.keys(report.resumo_recursos || {}).length + " Recursos",
        report.planejador, report.data_base, meta.geradoEm);

    let curRow = 11;

    // ── CONTADORES GERAIS ────────────────────────────────────────────────────
    ws.mergeCells("A"+curRow+":F"+curRow);
    const sep1 = ws.getCell("A"+curRow); sep1.value = "  RESUMO GERAL DO PLANEJAMENTO  ";
    setFill(sep1, NAVY); setFont(sep1, { bold: true, size: 10, color: { argb: WHITE } });
    setAlign(sep1, "center", "middle"); ws.getRow(curRow).height = 18; curRow++;

    const contadores = [
        ["📋 Total de OPs Planejadas",      report.total_ops || 0],
        ["🔧 Total de Operações",            report.total_operacoes_planejadas || 0],
        ["🏭 Recursos Utilizados",           Object.keys(report.resumo_recursos || {}).length],
        ["⚠️  OPs com Sobrecarga",           (report.decisoes || []).filter(d => d.is_sobrecarga).length > 0
                                                  ? [...new Set((report.decisoes||[]).filter(d=>d.is_sobrecarga).map(d=>d.op_numero))].length
                                                  : 0],
    ];

    contadores.forEach(([label, val]) => {
        ws.mergeCells("A"+curRow+":C"+curRow);
        ws.mergeCells("D"+curRow+":F"+curRow);
        const row = ws.getRow(curRow); row.height = 20;
        const lc = row.getCell(1); lc.value = label;
        const vc = row.getCell(4); vc.value = val;
        setFill(lc, LGRAY); setFont(lc, { bold: true, size: 10, color: { argb: NAVY } });
        setFill(vc, WHITE); setFont(vc, { bold: true, size: 14, color: { argb: BLUE } });
        setAlign(lc, "right", "middle"); setAlign(vc, "center", "middle");
        setBorder(lc); setBorder(vc); curRow++;
    });
    curRow++;

    // ── TABELA DE RECURSOS ────────────────────────────────────────────────────
    ws.mergeCells("A"+curRow+":F"+curRow);
    const sep2 = ws.getCell("A"+curRow); sep2.value = "  DETALHE POR RECURSO  ";
    setFill(sep2, NAVY); setFont(sep2, { bold: true, size: 10, color: { argb: WHITE } });
    setAlign(sep2, "center", "middle"); ws.getRow(curRow).height = 18; curRow++;

    const hdrs = ["Recurso / Descrição","Cap/Dia","Total Alocado","Operacoes","% Util."];
    const hRow = ws.getRow(curRow); hRow.height = 18;
    hdrs.forEach((h, i) => {
        const c = hRow.getCell(i + 1); c.value = h;
        setFill(c, BLUE); setFont(c, { bold: true, size: 9, color: { argb: WHITE } });
        setAlign(c, "center"); setBorder(c, "thin", WHITE);
    }); curRow++;

    const recursoKeys = Object.keys(report.resumo_recursos || {});
    recursoKeys.forEach((key, idx) => {
        const r = report.resumo_recursos[key];
        const capDia = r.capacidade_diaria_min || 480;
        const diasUsados = Object.keys(report.carga_diaria?.[key]?.dates || {}).length || 1;
        const pct = capDia > 0 ? Math.round((r.total_minutos_alocados / (capDia * Math.max(diasUsados, 1))) * 100) : 0;
        const bg = idx % 2 === 0 ? WHITE : GRAY;
        const row = ws.getRow(curRow); row.height = 16;
        [fmtRecurso(key, r.desc_recurso), fmtMin(capDia), fmtMin(r.total_minutos_alocados), r.total_operacoes, pct + "%"].forEach((v, i) => {
            const c = row.getCell(i + 1); c.value = v;
            setFill(c, i === 5 ? utilizationColor(pct) : bg);
            setFont(c, { size: 9, color: { argb: i === 5 ? WHITE : BLACK } });
            setAlign(c, i <= 1 ? "left" : "center"); setBorder(c);
        }); curRow++;
    });
    curRow += 2;
    ws.mergeCells("A"+curRow+":F"+curRow);
    const foot = ws.getCell("A"+curRow);
    foot.value = "Gerado pelo Agente de Planejamento FCS - MetalFisa Sistema - " + meta.geradoEm;
    setFont(foot, { size: 8, italic: true, color: { argb: ACCENT } }); setAlign(foot, "center");
}

function buildSheetEntendame(ws) {
    ws.pageSetup = { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    ws.views = [{ showGridLines: false }];
    ws.getColumn(1).width = 30; // Título do item
    ws.getColumn(2).width = 85; // Explicação

    let r = 1;

    // Utilitário local
    const title = (text, fillArgb) => {
        ws.mergeCells("A"+r+":B"+r);
        const c = ws.getCell("A"+r);
        c.value = text;
        c.fill = { type:"pattern", pattern:"solid", fgColor:{ argb: fillArgb || NAVY } };
        c.font = { bold: true, size: 12, color: { argb: WHITE } };
        c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        ws.getRow(r).height = 22; r++;
    };
    const sub = (label, desc, bgArgb) => {
        const row = ws.getRow(r); row.height = 46;
        const lc = row.getCell(1);
        const dc = row.getCell(2);
        lc.value = label;
        dc.value = desc;
        const bg = bgArgb || WHITE;
        lc.fill = { type:"pattern", pattern:"solid", fgColor:{ argb: LGRAY } };
        dc.fill = { type:"pattern", pattern:"solid", fgColor:{ argb: bg } };
        lc.font = { bold: true, size: 9, color: { argb: NAVY } };
        dc.font = { size: 9, color: { argb: BLACK } };
        lc.alignment = { horizontal:"right", vertical:"top", wrapText:true };
        dc.alignment = { horizontal:"left", vertical:"top", wrapText:true };
        lc.border = { top:{style:"thin",color:{argb:"FFD1D5DB"}}, bottom:{style:"thin",color:{argb:"FFD1D5DB"}}, left:{style:"thin",color:{argb:"FFD1D5DB"}}, right:{style:"thin",color:{argb:"FFD1D5DB"}} };
        dc.border = lc.border;
        r++;
    };
    const spacer = () => { ws.getRow(r).height = 8; r++; };

    // ═══════════════════════════════════════════════════════════════
    //  CAPA DA ABA
    // ═══════════════════════════════════════════════════════════════
    ws.mergeCells("A"+r+":B"+r);
    const cover = ws.getCell("A"+r);
    cover.value = "📖  GUIA COMPLETO DA PLANILHA DE PLANEJAMENTO FCS — MetalFisa";
    cover.fill = { type:"pattern", pattern:"solid", fgColor:{ argb: NAVY } };
    cover.font = { bold:true, size:14, color:{ argb: WHITE } };
    cover.alignment = { horizontal:"center", vertical:"middle" };
    ws.getRow(r).height = 32; r++;

    ws.mergeCells("A"+r+":B"+r);
    const sub0 = ws.getCell("A"+r);
    sub0.value = "Este documento explica, em linguagem simples, cada aba, cada coluna e cada conceito desta planilha. Qualquer pessoa pode entender!";
    sub0.fill = { type:"pattern", pattern:"solid", fgColor:{ argb: BLUE } };
    sub0.font = { size:10, italic:true, color:{ argb: WHITE } };
    sub0.alignment = { horizontal:"center", vertical:"middle", wrapText:true };
    ws.getRow(r).height = 22; r++;
    spacer();

    // ═══════════════════════════════════════════════════════════════
    //  SEÇÃO 1 — O QUE É ESTA PLANILHA?
    // ═══════════════════════════════════════════════════════════════
    title("📋  1. O QUE É ESTA PLANILHA?");
    sub("Para que serve?",
        "Esta planilha é gerada automaticamente pelo Agente de Planejamento FCS (Finite Capacity Scheduling — Planejamento de Capacidade Finita) da MetalFisa. "
        + "Ela mostra QUANDO cada produto deve ser fabricado, por QUAL máquina/operador (recurso) e se a fábrica tem CAPACIDADE suficiente para cumprir todos os pedidos no prazo.");
    sub("Quem deve usar?",
        "PCP (Planejamento e Controle da Produção), gerentes de fábrica, supervisores de produção e qualquer pessoa que precise entender a situação de capacidade da planta industrial.");
    sub("Quando é gerada?",
        "Toda vez que o usuário clica em 'Planejamento Inteligente' no sistema MetalFisa e executa o agente FCS para um grupo de Ordens de Produção (OPs). A data de geração aparece na aba Capa.");
    spacer();

    // ═══════════════════════════════════════════════════════════════
    //  SEÇÃO 2 — CONCEITOS FUNDAMENTAIS
    // ═══════════════════════════════════════════════════════════════
    title("🔑  2. CONCEITOS FUNDAMENTAIS (entenda antes das abas!)");
    sub("OP — Ordem de Produção",
        "É a autorização formal para fabricar um produto. Exemplo: \"OP 000497 — Fabricar 35 peças do produto MT6-6107\". "
        + "Cada OP pode ter várias operações (corte, solda, pintura, etc.) executadas em recursos diferentes.");
    sub("Operação",
        "É uma etapa do processo de fabricação. Cada operação é identificada por um código (ex: 10, 20, 30...). "
        + "A operação 10 sempre ocorre antes da 20, a 20 antes da 30, e assim por diante — é a sequência obrigatória do processo.");
    sub("Recurso",
        "É qualquer máquina, célula de manufatura ou operador que executa uma operação. Exemplos: MO0001 (torno), MO0013 (fresadora), ST0001 (estação de solda). "
        + "Cada recurso tem uma CAPACIDADE DIÁRIA — quantos minutos por dia ele pode produzir.");
    sub("Capacidade Diária",
        "É o total de minutos que um recurso pode trabalhar em 1 dia. Exemplo: se uma máquina trabalha 8h/dia, sua capacidade é 480 minutos/dia. "
        + "Na MetalFisa, a jornada padrão pode ser diferente por recurso — verifique a coluna 'Cap/Dia' nas abas.");
    sub("Hora MetalFisa (1h = 50 min)",
        "ATENÇÃO: Na MetalFisa, 1 hora produtiva equivale a 50 minutos de tempo cronológico — não 60 minutos! "
        + "Isso porque existem paradas programadas (limpeza, setup, descanso) dentro de cada hora de trabalho. "
        + "Por isso, todos os valores de HORAS nesta planilha usam a conversão: minutos ÷ 50 = horas MetalFisa. "
        + "Exemplo: 500 minutos ÷ 50 = 10,0 h MetalFisa.");
    sub("FCS — Capacidade Finita",
        "O sistema FCS respeita que cada recurso só pode trabalhar até sua capacidade máxima por dia. Se o recurso MO0001 tem 480 min/dia e já foram alocados 400 min, "
        + "só restam 80 min para mais trabalho naquele dia. O agente distribui automaticamente o excesso para o próximo dia útil.");
    sub("Sobrecarga",
        "Quando a DEMANDA (trabalho necessário) supera a CAPACIDADE disponível do recurso, ocorre sobrecarga. "
        + "O agente permite até 50% de sobrecarga por dia (ex: recurso com 480 min/dia pode absorver até 720 min em situação de sobrecarga). "
        + "Itens em sobrecarga são marcados em VERMELHO e indicam risco de atraso na entrega.");
    sub("Sobreposição entre operações",
        "Quando uma OP passa de um recurso para outro (ex: de MO0001 para ST0001), o sistema aplica um tempo mínimo de sobreposição "
        + "(padrão 180 min = 3 horas) antes de iniciar a próxima operação. Isso simula o tempo de transporte/setup entre estações.");
    spacer();

    // ═══════════════════════════════════════════════════════════════
    //  SEÇÃO 3 — ABA CAPA
    // ═══════════════════════════════════════════════════════════════
    title("📄  3. ABA: CAPA", BLUE);
    sub("O que mostra?",
        "É o resumo executivo do planejamento. Apresenta os 3 principais indicadores: Capacidade Total, Demanda Total e Saldo — todos em Horas MetalFisa.");
    sub("⚡ CAPACIDADE TOTAL",
        "Soma de todos os minutos disponíveis em todos os recursos durante os dias do período planejado. "
        + "Exemplo: se temos 5 recursos com 480 min/dia cada, trabalhando 10 dias = 5 × 480 × 10 = 24.000 min = 480 h MetalFisa.");
    sub("📦 DEMANDA TOTAL",
        "Soma de todos os minutos necessários para fabricar TODAS as peças de TODAS as OPs planejadas. "
        + "Este é o trabalho que precisa ser feito para cumprir os pedidos.");
    sub("✅ SALDO DISPONÍVEL / ⚠️ SOBRECARGA",
        "Saldo = Capacidade − Demanda. "
        + "Se POSITIVO (verde): a fábrica tem folga — a produção cabe dentro da capacidade normal. "
        + "Se NEGATIVO (vermelho): a demanda supera a capacidade — existe risco de atraso e será necessário usar horas extras ou redistribuir pedidos.");
    sub("Tabela de Recursos",
        "Lista cada recurso com: código, descrição, capacidade por dia (Cap/Dia), total alocado no período, número de operações planejadas e percentual de utilização. "
        + "Cores do % de utilização: VERDE = até 70% (confortável), AMARELO = 70-90% (atenção), VERMELHO = acima de 90% (crítico).");
    spacer();

    // ═══════════════════════════════════════════════════════════════
    //  SEÇÃO 4 — ABA POR RECURSO
    // ═══════════════════════════════════════════════════════════════
    title("🔧  4. ABA: POR RECURSO", BLUE);
    sub("O que mostra?",
        "O detalhe de cada peça/OP alocada em cada recurso, com a data exata de execução. É o \"cronograma\" de cada máquina/estação.");
    sub("Colunas principais",
        "Pedido: número do pedido do cliente. | OP: número da Ordem de Produção. | Produto: código do produto. | "
        + "Operação: etapa do processo (10, 20, 30...). | Recurso: código da máquina/estação. | "
        + "Qtd Alocada: quantas peças foram programadas para este dia. | Minutos: tempo necessário para fabricar essas peças. | "
        + "Data: dia em que a operação está planejada para ocorrer.");
    sub("Linhas em VERMELHO",
        "Indicam operações em SOBRECARGA — programadas além da capacidade normal do recurso. "
        + "Atenção especial: é necessário verificar se há disponibilidade real (horas extras, turno adicional) para cumprir o prazo.");
    sub("Linha Normal (branco/cinza alternado)",
        "Operações dentro da capacidade normal do recurso, sem risco de atraso.");
    spacer();

    // ═══════════════════════════════════════════════════════════════
    //  SEÇÃO 5 — ABA CARGA GERAL
    // ═══════════════════════════════════════════════════════════════
    title("📊  5. ABA: CARGA GERAL", BLUE);
    sub("O que mostra?",
        "Uma visão de calendário: cada LINHA é um recurso, cada COLUNA é um dia. "
        + "A célula mostra quanto tempo (horas:minutos) aquele recurso tem alocado naquele dia específico, e qual o percentual de sua capacidade.");
    sub("Como ler as células?",
        "Exemplo: uma célula mostrando '4:30 / 53%' significa que o recurso está com 4 horas e 30 minutos alocados naquele dia, o que representa 53% de sua capacidade diária. "
        + "Uma célula vazia significa que o recurso não tem trabalho planejado naquele dia.");
    sub("Cores das células",
        "🟢 VERDE (0-70%): Recurso com carga leve — dentro da capacidade confortável. "
        + "🟡 AMARELO (70-90%): Recurso com carga média — atenção, pouca margem de segurança. "
        + "🔴 VERMELHO (acima de 90%): Recurso saturado — alta chance de atraso se houver qualquer imprevisto. "
        + "(Valores acima de 100% = sobrecarga real, recurso trabalhando além do limite normal.)");
    sub("Linha TOTAL ALOCADO",
        "Última linha da tabela. Mostra a soma de todos os recursos para cada dia — é a carga total da fábrica por dia.");
    spacer();

    // ═══════════════════════════════════════════════════════════════
    //  SEÇÃO 6 — ABA RESUMO E ANÁLISE
    // ═══════════════════════════════════════════════════════════════
    title("📈  6. ABA: RESUMO E ANÁLISE", BLUE);
    sub("O que mostra?",
        "O resumo consolidado por recurso com: carga normal, sobrecarga, total e percentual de sobrecarga. Também inclui uma análise crítica automática com pontos de atenção.");
    sub("Carga Normal",
        "Total de minutos/horas alocados dentro da capacidade padrão do recurso (sem sobrecarga). É o trabalho que ocorre normalmente dentro do horário de fábrica.");
    sub("Sobrecarga",
        "Total de minutos/horas alocados ALÉM da capacidade normal. Para cada minuto de sobrecarga, é necessário prever hora extra ou turno adicional.");
    sub("Gráfico de barras",
        "Representação visual da carga de cada recurso usando barras formadas por células coloridas. O comprimento da barra é proporcional à carga total — quanto mais longa, mais ocupado o recurso.");
    sub("Análise Crítica",
        "Texto gerado automaticamente com alertas sobre os recursos em sobrecarga e recomendações práticas (ex: priorizar horas extras nos recursos gargalo, redistribuir datas com o cliente, verificar terceirização).");
    spacer();

    // ═══════════════════════════════════════════════════════════════
    //  SEÇÃO 7 — GLOSSÁRIO
    // ═══════════════════════════════════════════════════════════════
    title("📚  7. GLOSSÁRIO COMPLETO", NAVY);
    const glossario = [
        ["OP",               "Ordem de Produção — documento que autoriza a fabricação de um lote de peças."],
        ["FCS",              "Finite Capacity Scheduling — Planejamento com respeito à capacidade real de cada recurso (sem supor capacidade infinita)."],
        ["PCP",              "Planejamento e Controle da Produção — setor responsável por definir quando e como cada produto será fabricado."],
        ["Recurso",          "Qualquer ativo produtivo: máquina, célula, operador especializado ou estação de trabalho. Identificado por código (ex: MO0001, ST0001)."],
        ["Cap/Dia",          "Capacidade Diária — máximo de minutos que um recurso pode trabalhar em um dia útil (considerando paradas programadas)."],
        ["Alocação",         "Processo de definir QUANDO e em QUAL dia cada operação será executada, respeitando a capacidade do recurso."],
        ["Fatia diária",     "Porção de trabalho alocada em um único dia para um recurso. Uma OP pode ser dividida em várias fatias se não couber em um só dia."],
        ["Data Planejada",   "Data calculada pelo agente FCS para início e fim de cada operação. Fica registrada no sistema para monitoramento."],
        ["Sobrecarga (50%)", "O sistema permite alocar até 50% além da capacidade normal em situações de urgência. Ex: 480 min/dia normal → máximo 720 min/dia com sobrecarga."],
        ["Gargalo",          "Recurso que está com utilização acima de 90% ou em sobrecarga. É o ponto mais crítico da produção — qualquer problema aqui atrasa tudo."],
        ["Saldo",            "Capacidade Total − Demanda Total. Indica se a fábrica tem folga (positivo) ou déficit de capacidade (negativo) para o período planejado."],
        ["Entrega PCP",      "Data prometida ao cliente para entrega do pedido, registrada no ERP Protheus. O agente prioriza as OPs com entrega mais próxima."],
        ["Pedido",           "Pedido de venda — número do pedido do cliente, vinculado a uma ou mais OPs. Ex: pedido 004618 pode ter as OPs 000497, 000498, 000499."],
        ["Horas MetalFisa",  "Unidade de medida de tempo produtivo adotada pela MetalFisa. 1 hora MetalFisa = 50 minutos cronológicos. Todos os valores de \"horas\" nesta planilha usam esta conversão."],
    ];
    glossario.forEach(([term, def]) => sub(term, def));
    spacer();

    // ═══════════════════════════════════════════════════════════════
    //  SEÇÃO 8 — CORES E SINAIS
    // ═══════════════════════════════════════════════════════════════
    title("🎨  8. GUIA DE CORES E SINAIS", NAVY);
    sub("🟢 Verde (células)",   "Utilização até 70% — Situação confortável. O recurso tem folga e pode absorver imprevistos sem comprometer as entregas.");
    sub("🟡 Amarelo (células)", "Utilização entre 70% e 90% — Atenção. O recurso está com carga elevada. Pequenos imprevistos já podem causar atraso.");
    sub("🔴 Vermelho (células)","Utilização acima de 90% ou em sobrecarga — Situação crítica. Ação imediata necessária: horas extras, redistribuição ou negociação de prazo com o cliente.");
    sub("Texto em AZUL",        "Valores numéricos principais (totais, KPIs). São os números mais importantes para a tomada de decisão.");
    sub("Fundo AZUL MARINHO",   "Cabeçalhos e títulos de seção — servem para organizar e identificar cada bloco de informação.");
    sub("Linhas em vermelho claro (aba Por Recurso)", "Operações em SOBRECARGA — programadas além da capacidade normal. Requerem atenção do PCP.");
    sub("⚠️ Símbolo de alerta", "Aparece em recursos ou situações que requerem decisão urgente do gestor.");
    spacer();

    // ═══════════════════════════════════════════════════════════════
    //  FOOTER
    // ═══════════════════════════════════════════════════════════════
    ws.mergeCells("A"+r+":B"+r);
    const foot = ws.getCell("A"+r);
    foot.value = "Agente FCS — MetalFisa Sistema — Este guia foi gerado automaticamente. Em caso de dúvidas, consulte o setor de PCP.";
    foot.fill = { type:"pattern", pattern:"solid", fgColor:{ argb: LGRAY } };
    foot.font = { size:8, italic:true, color:{ argb: DGRAY } };
    foot.alignment = { horizontal:"center", wrapText:true };
    ws.getRow(r).height = 20;
}

function buildSheetPorRecurso(wb, ws, report) {
    ws.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    ws.views = [{ showGridLines: false, state: "frozen", ySplit: 12 }];
    [10, 22, 12, 28, 12, 12, 12, 15, 15, 22].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    const geradoEm = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });
    buildHeader(wb, ws, "J", "Planejamento por Recurso - Detalhe de Execucao",
        "Pecas programadas por recurso com dia definido para execucao (Normal e Sobrecarga)",
        report.planejador, report.data_base, geradoEm);

    const GREEN_HDR = "FF16A34A"; // verde escuro para subheader normal
    const RED_HDR   = "FFDC2626"; // vermelho para subheader sobrecarga
    const RED_ROW   = "FFFEE2E2"; // fundo vermelho claro para linhas sobrecarga
    const RED_TXT   = "FF991B1B"; // texto vermelho escuro

    // Agrupa decisoes por recurso, separando normal e sobrecarga
    const byRecurso = {};
    (report.decisoes || []).forEach(d => {
        if (!byRecurso[d.recurso]) byRecurso[d.recurso] = { normal: [], sobrecarga: [] };
        if (d.is_sobrecarga) byRecurso[d.recurso].sobrecarga.push(d);
        else                 byRecurso[d.recurso].normal.push(d);
    });

    const addDataRow = (d, idx, isSobre) => {
        const fatias = d.fatias_diarias || [];
        const bg     = isSobre ? RED_ROW : (idx % 2 === 0 ? WHITE : GRAY);
        const txtArg = isSobre ? RED_TXT : BLACK;
        const obs    = isSobre
            ? `⚠️ ATRASO: PCP era ${d.data_entrega_pcp || "?"}`
            : (d.excede_capacidade_dia ? "ATENCAO: Excede cap." : "");

        if (fatias.length > 1) {
            fatias.forEach((f, fi) => {
                const row = ws.getRow(curRow); row.height = 14;
                [fi===0?d.op_numero:"", fi===0?d.produto:"", d.operacao,
                 d.recurso + " - " + d.desc_recurso,
                 fi===0?d.qtd_pendente:"", d.tempo_unitario_min, f.minutos,
                 weekDay(f.data)+" "+fmtDate(f.data), "",
                 fi===0 ? obs : ""
                ].forEach((v, i) => {
                    const c = row.getCell(i + 1); c.value = v;
                    setFill(c, fi===0 ? bg : (isSobre ? RED_ROW : LGRAY));
                    setFont(c, { size: 8, color: { argb: txtArg } });
                    setAlign(c, i<=1?"left":i>=7?"center":"right"); setBorder(c);
                }); curRow++;
            });
        } else {
            const row = ws.getRow(curRow); row.height = 14;
            [d.op_numero, d.produto, d.operacao,
             d.recurso + " - " + d.desc_recurso,
             d.qtd_pendente, d.tempo_unitario_min, d.total_minutos_necessarios,
             weekDay(d.data_inicio)+" "+fmtDate(d.data_inicio),
             d.data_inicio!==d.data_fim ? fmtDate(d.data_fim) : "",
             obs
            ].forEach((v, i) => {
                const c = row.getCell(i + 1); c.value = v;
                setFill(c, bg); setFont(c, { size: 8, color: { argb: txtArg } });
                setAlign(c, i<=1?"left":i>=7?"center":"right"); setBorder(c);
            }); curRow++;
        }
    };

    let curRow = 11;
    const headers = ["OP","Produto","Operacao","Recurso / Desc.","Qtde","T.Unit (min)","Total (min)","Data Inicio","Data Fim","Obs."];

    Object.keys(byRecurso).forEach(recursoKey => {
        const { normal, sobrecarga } = byRecurso[recursoKey];
        const recurso = report.resumo_recursos?.[recursoKey] || {};
        const capNormal = recurso.capacidade_diaria_min || 480;

        // Cabeçalho do recurso
        ws.mergeCells("A" + curRow + ":J" + curRow);
        const rh = ws.getRow(curRow); rh.height = 20;
        const rhCell = rh.getCell(1);
        rhCell.value = "  " + recursoKey + "  -  " + (recurso.desc_recurso || "") +
            "    (Cap: " + fmtMin(capNormal) + "/dia | Sobrecarga: +" + fmtMin(Math.round(capNormal*0.5)) + "/dia | Alocado: " + fmtMin(recurso.total_minutos_alocados || 0) + ")";
        setFill(rhCell, NAVY); setFont(rhCell, { bold: true, size: 10, color: { argb: WHITE } });
        setAlign(rhCell, "left", "middle"); curRow++;

        // ── CARGA NORMAL ──────────────────────────────────────────────
        if (normal.length > 0) {
            ws.mergeCells("A" + curRow + ":J" + curRow);
            const nhCell = ws.getRow(curRow).getCell(1);
            nhCell.value = "  ── CARGA NORMAL (" + normal.length + " operacao(oes)) ──";
            setFill(nhCell, GREEN_HDR); setFont(nhCell, { bold: true, size: 8, color: { argb: WHITE } });
            setAlign(nhCell, "left", "middle"); ws.getRow(curRow).height = 14; curRow++;

            const hRow = ws.getRow(curRow); hRow.height = 14;
            headers.forEach((h, i) => {
                const c = hRow.getCell(i + 1); c.value = h;
                setFill(c, BLUE); setFont(c, { bold: true, size: 8, color: { argb: WHITE } });
                setAlign(c, "center"); setBorder(c, "thin", WHITE);
            }); curRow++;

            normal.forEach((d, idx) => addDataRow(d, idx, false));
        }

        // ── SOBRECARGA ────────────────────────────────────────────────
        if (sobrecarga.length > 0) {
            ws.mergeCells("A" + curRow + ":J" + curRow);
            const shCell = ws.getRow(curRow).getCell(1);
            shCell.value = "  ⚠️ SOBRECARGA / ALERTA DE ATRASO (" + sobrecarga.length + " operacao(oes))  — ate +" + fmtMin(Math.round(capNormal*0.5)) + "/dia";
            setFill(shCell, RED_HDR); setFont(shCell, { bold: true, size: 8, color: { argb: WHITE } });
            setAlign(shCell, "left", "middle"); ws.getRow(curRow).height = 14; curRow++;

            const hRow = ws.getRow(curRow); hRow.height = 14;
            headers.forEach((h, i) => {
                const c = hRow.getCell(i + 1); c.value = h;
                setFill(c, RED_HDR); setFont(c, { bold: true, size: 8, color: { argb: WHITE } });
                setAlign(c, "center"); setBorder(c, "thin", WHITE);
            }); curRow++;

            sobrecarga.forEach((d, idx) => addDataRow(d, idx, true));
        }

        // Subtotal do recurso
        const totalItens  = normal.length + sobrecarga.length;
        const stRow = ws.getRow(curRow); stRow.height = 15;
        ws.mergeCells("A"+curRow+":F"+curRow);
        const stCell = stRow.getCell(1);
        stCell.value = "Subtotal " + recursoKey + ": " + totalItens + " operacao(oes)  |  Normal: " + normal.length + "  |  Sobrecarga: " + sobrecarga.length;
        setFill(stCell, LGRAY); setFont(stCell, { bold: true, size: 8, color: { argb: NAVY } }); setAlign(stCell, "right");
        const stMin = stRow.getCell(7); stMin.value = fmtMin(recurso.total_minutos_alocados || 0);
        setFill(stMin, LGRAY); setFont(stMin, { bold: true, size: 8, color: { argb: NAVY } }); setAlign(stMin, "right");
        curRow += 2;
    });

    ws.mergeCells("A"+curRow+":J"+curRow);
    const foot = ws.getCell("A"+curRow);
    foot.value = "Agente FCS - MetalFisa Sistema - " + geradoEm + " - Planejador: " + report.planejador;
    setFont(foot, { size: 7, italic: true, color: { argb: ACCENT } }); setAlign(foot, "center");
}

function buildSheetCargaGeral(wb, ws, report) {
    ws.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    const cargaDiaria = report.carga_diaria || {};
    const recursos = Object.keys(cargaDiaria);
    const daysSet = new Set();
    recursos.forEach(r => Object.keys(cargaDiaria[r].dates || {}).forEach(d => daysSet.add(d)));
    const days = [...daysSet].sort();
    [12, 25, 12].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    days.forEach((_, i) => { ws.getColumn(i + 4).width = 9; });
    ws.views = [{ showGridLines: false, state: "frozen", xSplit: 3, ySplit: 12 }];
    const totalCols = 3 + days.length;
    const colLetter = (n) => {
        let s = ""; let nn = n;
        while (nn > 0) { nn--; s = String.fromCharCode(65 + (nn % 26)) + s; nn = Math.floor(nn / 26); }
        return s;
    };
    const lastCol = colLetter(totalCols);
    const geradoEm = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });
    buildHeader(wb, ws, lastCol, "Visao Geral - Carga por Dia e Recurso",
        "Utilizacao diaria de cada recurso (min alocados / capacidade)",
        report.planejador, report.data_base, geradoEm);
    let curRow = 11;
    const hRow = ws.getRow(curRow); hRow.height = 28;
    ["Recurso / Descrição","Cap/Dia"].forEach((h, i) => {
        const c = hRow.getCell(i + 1); c.value = h;
        setFill(c, NAVY); setFont(c, { bold: true, size: 9, color: { argb: WHITE } });
        setAlign(c, "center"); setBorder(c, "thin", WHITE);
    });
    days.forEach((day, i) => {
        const c = hRow.getCell(3 + i);
        c.value = fmtDate(day) + "\n" + weekDay(day);
        setFill(c, NAVY); setFont(c, { bold: true, size: 7, color: { argb: WHITE } });
        setAlign(c, "center"); setBorder(c, "thin", WHITE);
    }); curRow++;
    recursos.forEach((recursoKey, idx) => {
        const rc = report.resumo_recursos?.[recursoKey] || {};
        const capDia = cargaDiaria[recursoKey]?.capDia || rc.capacidade_diaria_min || 480;
        const bg = idx % 2 === 0 ? WHITE : GRAY;
        const row = ws.getRow(curRow); row.height = 20;
        [fmtRecurso(recursoKey, rc.desc_recurso), fmtMin(capDia)].forEach((v, i) => {
            const c = row.getCell(i + 1); c.value = v;
            setFill(c, bg); setFont(c, { bold: i===0, size: 9, color: { argb: i===0?NAVY:BLACK } });
            setAlign(c, "left"); setBorder(c);
        });
        days.forEach((day, i) => {
            const minUsado = cargaDiaria[recursoKey]?.dates?.[day] || 0;
            const pct = capDia > 0 ? Math.round((minUsado / capDia) * 100) : 0;
            const c = row.getCell(3 + i);
            if (minUsado > 0) {
                c.value = fmtMin(minUsado) + "\n" + pct + "%";
                setFill(c, utilizationColor(pct)); setFont(c, { size: 7, bold: pct>=90, color: { argb: WHITE } });
            } else {
                c.value = "-"; setFill(c, LGRAY); setFont(c, { size: 7, color: { argb: DGRAY } });
            }
            setAlign(c, "center"); setBorder(c);
        }); curRow++;
    });
    const totRow = ws.getRow(curRow); totRow.height = 18;
    ws.mergeCells("A"+curRow+":B"+curRow);
    const totLabel = totRow.getCell(1); totLabel.value = "TOTAL ALOCADO (todos os recursos)";
    setFill(totLabel, NAVY); setFont(totLabel, { bold: true, size: 9, color: { argb: WHITE } }); setAlign(totLabel, "center");
    days.forEach((day, i) => {
        let totalDia = 0;
        recursos.forEach(r => { totalDia += cargaDiaria[r]?.dates?.[day] || 0; });
        const c = totRow.getCell(3 + i); c.value = fmtMin(totalDia);
        setFill(c, BLUE); setFont(c, { bold: true, size: 8, color: { argb: WHITE } });
        setAlign(c, "center"); setBorder(c, "thin", WHITE);
    }); curRow += 2;
    ws.mergeCells("A"+curRow+":C"+curRow); ws.getCell("A"+curRow).value = "LEGENDA DE UTILIZACAO:";
    setFont(ws.getCell("A"+curRow), { bold: true, size: 8, color: { argb: NAVY } });
    [[GREEN,"Ate 70% - Folga disponivel"],[AMBER,"70-89% - Carga elevada"],[RED,">=90% - Capacidade critica / esgotada"]].forEach(([color, label], i) => {
        const row = ws.getRow(curRow + 1 + i); row.height = 13;
        setFill(row.getCell(1), color);
        ws.mergeCells("B"+(curRow+1+i)+":D"+(curRow+1+i));
        row.getCell(2).value = label;
        setFont(row.getCell(2), { size: 8, color: { argb: BLACK } });
    }); curRow += 5;
    ws.mergeCells("A"+curRow+":"+lastCol+curRow);
    const foot = ws.getCell("A"+curRow);
    foot.value = "Agente FCS - MetalFisa Sistema - " + geradoEm + " - Planejador: " + report.planejador;
    setFont(foot, { size: 7, italic: true, color: { argb: ACCENT } }); setAlign(foot, "center");
}

function buildSheetResumoAnalise(wb, ws, report) {
    ws.pageSetup = { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    ws.views = [{ showGridLines: false }];
    [20, 18, 18, 18, 18, 22].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    const geradoEm = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });
    buildHeader(wb, ws, "F", "Resumo Executivo e Analise Critica",
        "Carga Normal x Sobrecarga por Recurso | 1 hora = 50 min (padrao MetalFisa)",
        report.planejador, report.data_base, geradoEm);

    const RED_HDR = "FFDC2626"; const RED_ROW = "FFFEE2E2";
    const GREEN_HDR = "FF16A34A"; const AMBER_HDR = "FFF59E0B";
    const BAR_NORMAL = "FF0D6EFD"; const BAR_SOBRE = "FFDC2626"; const BAR_EMPTY = "FFF1F5F9";

    // ── TABELA RESUMO POR RECURSO ─────────────────────────────────────────────
    let curRow = 11;
    ws.mergeCells("A"+curRow+":F"+curRow);
    const t1 = ws.getCell("A"+curRow); t1.value = "  RESUMO DE CARGA POR RECURSO";
    setFill(t1, NAVY); setFont(t1, { bold: true, size: 11, color: { argb: WHITE } });
    setAlign(t1, "left", "middle"); ws.getRow(curRow).height = 20; curRow++;

    // Nota de conversão
    ws.mergeCells("A"+curRow+":F"+curRow);
    const nota = ws.getCell("A"+curRow);
    nota.value = "  ⚠️  Conversão de horas: 1 hora produtiva = 50 minutos (padrão MetalFisa)";
    setFill(nota, "FFFFF7ED"); setFont(nota, { size: 8, italic: true, color: { argb: "FFB45309" } });
    setAlign(nota, "left", "middle"); ws.getRow(curRow).height = 14; curRow++;

    // Cabeçalho da tabela
    const hdrs = ["Recurso", "Cap/Dia", "Carga Normal", "Sobrecarga", "Total Alocado", "% vs Cap."];
    const hRow = ws.getRow(curRow); hRow.height = 18;
    hdrs.forEach((h, i) => {
        const c = hRow.getCell(i + 1); c.value = h;
        setFill(c, NAVY); setFont(c, { bold: true, size: 9, color: { argb: WHITE } });
        setAlign(c, "center"); setBorder(c, "thin", WHITE);
    }); curRow++;

    // Coletar dados de normal/sobrecarga por recurso a partir das decisoes
    const recursoStats = {};
    (report.decisoes || []).forEach(d => {
        if (!recursoStats[d.recurso]) {
            recursoStats[d.recurso] = { desc: d.desc_recurso || d.recurso, capDia: d.capacidade_recurso_min_dia || 480, normal: 0, sobre: 0 };
        }
        if (d.is_sobrecarga) recursoStats[d.recurso].sobre += d.total_minutos_necessarios || 0;
        else                 recursoStats[d.recurso].normal += d.total_minutos_necessarios || 0;
    });

    const recursoKeys = Object.keys(recursoStats);
    let totalNormal = 0, totalSobre = 0;
    const alertas = [];

    recursoKeys.forEach((key, idx) => {
        const r = recursoStats[key];
        const total = r.normal + r.sobre;
        const capTotal = r.capDia; // por dia, mas usamos como referência
        const pct = capTotal > 0 ? Math.round((total / capTotal) * 100) : 0;
        const bg = idx % 2 === 0 ? WHITE : GRAY;
        const row = ws.getRow(curRow); row.height = 16;

        [key + " - " + r.desc,
         fmtMinHoras(r.capDia),
         r.normal > 0 ? fmtMinHoras(r.normal) : "—",
         r.sobre > 0  ? fmtMinHoras(r.sobre)  : "—",
         fmtMinHoras(total),
         pct + "%"
        ].forEach((v, i) => {
            const c = row.getCell(i + 1); c.value = v;
            let fill = bg;
            if (i === 3 && r.sobre > 0) fill = RED_ROW;
            if (i === 5) fill = utilizationColor(pct);
            setFill(c, fill);
            setFont(c, { size: 8, color: { argb: i===5 ? WHITE : (i===3&&r.sobre>0 ? "FF991B1B" : BLACK) } });
            setAlign(c, i===0?"left":"center"); setBorder(c);
        }); curRow++;

        totalNormal += r.normal;
        totalSobre  += r.sobre;
        if (r.sobre > 0) alertas.push({ recurso: key, desc: r.desc, normal: r.normal, sobre: r.sobre, capDia: r.capDia });
    });

    // Total geral
    const totRow = ws.getRow(curRow); totRow.height = 18;
    ["TOTAL GERAL", "—",
     fmtMinHoras(totalNormal), fmtMinHoras(totalSobre),
     fmtMinHoras(totalNormal + totalSobre), "—"
    ].forEach((v, i) => {
        const c = totRow.getCell(i + 1); c.value = v;
        setFill(c, NAVY); setFont(c, { bold: true, size: 9, color: { argb: WHITE } });
        setAlign(c, i===0?"left":"center"); setBorder(c, "thin", WHITE);
    }); curRow += 2;

    // ── GRÁFICO DE BARRAS (CÉLULAS COLORIDAS) ────────────────────────────────
    ws.mergeCells("A"+curRow+":F"+curRow);
    const g1 = ws.getCell("A"+curRow); g1.value = "  GRÁFICO: CARGA NORMAL vs SOBRECARGA POR RECURSO (em minutos)";
    setFill(g1, NAVY); setFont(g1, { bold: true, size: 10, color: { argb: WHITE } });
    setAlign(g1, "left", "middle"); ws.getRow(curRow).height = 18; curRow++;

    // Sub-nota
    ws.mergeCells("A"+curRow+":F"+curRow);
    const gnota = ws.getCell("A"+curRow);
    gnota.value = "  Azul = Carga Normal  |  Vermelho = Sobrecarga  |  Cinza = Capacidade residual";
    setFill(gnota, LGRAY); setFont(gnota, { size: 8, italic: true, color: { argb: NAVY } });
    setAlign(gnota, "left", "middle"); ws.getRow(curRow).height = 12; curRow++;

    const BAR_COLS = 40; // largura da barra em "slots" de células mergeadas visualmente
    const maxTotal = Math.max(1, ...recursoKeys.map(k => recursoStats[k].normal + recursoStats[k].sobre));

    recursoKeys.forEach(key => {
        const r = recursoStats[key];
        const total = r.normal + r.sobre;
        const normalSlots = Math.round((r.normal / maxTotal) * BAR_COLS);
        const sobreSlots  = Math.round((r.sobre  / maxTotal) * BAR_COLS);
        const emptySlots  = BAR_COLS - normalSlots - sobreSlots;

        // Label do recurso
        const labelRow = ws.getRow(curRow); labelRow.height = 14;
        const labelCell = labelRow.getCell(1);
        labelCell.value = key;
        setFont(labelCell, { bold: true, size: 8, color: { argb: NAVY } });
        setAlign(labelCell, "right", "middle"); curRow++;

        // Barra visual (1 linha por recurso, usando a largura da coluna F)
        const barRow = ws.getRow(curRow); barRow.height = 16;
        // Usamos apenas a coluna B-F como barra visual com nota de valores
        const barCell = barRow.getCell(2);
        // Mostra barra como texto graduado
        const normalBar = "█".repeat(normalSlots);
        const sobreBar  = sobreSlots > 0 ? "░".repeat(sobreSlots) : "";
        ws.mergeCells("B"+curRow+":E"+curRow);
        barCell.value = normalBar + sobreBar || "—";
        setFont(barCell, { size: 9, color: { argb: r.sobre > 0 ? RED_HDR : BAR_NORMAL } });
        setAlign(barCell, "left", "middle");
        const valCell = barRow.getCell(6);
        valCell.value = fmtMinHoras(total) + (r.sobre>0 ? " ⚠️" : "");
        setFont(valCell, { size: 8, bold: r.sobre>0, color: { argb: r.sobre>0 ? RED_HDR : NAVY } });
        setAlign(valCell, "left", "middle"); curRow++;
    }); curRow++;

    // ── ANÁLISE CRÍTICA E PONTOS DE ATENÇÃO ──────────────────────────────────
    ws.mergeCells("A"+curRow+":F"+curRow);
    const anTitle = ws.getCell("A"+curRow); anTitle.value = "  ⚙️  ANÁLISE CRÍTICA E PONTOS DE ATENÇÃO";
    setFill(anTitle, RED_HDR); setFont(anTitle, { bold: true, size: 11, color: { argb: WHITE } });
    setAlign(anTitle, "left", "middle"); ws.getRow(curRow).height = 20; curRow++;

    const totalAlocado = totalNormal + totalSobre;
    const pctSobre = totalAlocado > 0 ? ((totalSobre / totalAlocado) * 100).toFixed(1) : "0,0";
    const qtdRecursosComSobre = alertas.length;
    const qtdOpsNormais = (report.decisoes || []).filter(d => !d.is_sobrecarga).length;
    const qtdOpsSobre   = (report.decisoes || []).filter(d =>  d.is_sobrecarga).length;

    const pontos = [
        { cor: NAVY, txt: `📊 Total de operações planejadas: ${(report.decisoes||[]).length} | Normal: ${qtdOpsNormais} | Sobrecarga: ${qtdOpsSobre}` },
        { cor: NAVY, txt: `⏱️  Carga total: ${fmtMinHoras(totalNormal)} em carga normal + ${fmtMinHoras(totalSobre)} em sobrecarga = ${fmtMinHoras(totalAlocado)} total` },
        { cor: pctSobre > 20 ? RED_HDR : AMBER, txt: `📈 ${pctSobre}% da carga total está em sobrecarga (meta: < 20%)` },
        { cor: NAVY, txt: `🏭 Recursos com sobrecarga: ${qtdRecursosComSobre} de ${recursoKeys.length}` },
    ];

    if (alertas.length === 0) {
        pontos.push({ cor: GREEN_HDR, txt: "✅ Nenhum recurso em sobrecarga. Planejamento dentro da capacidade nominal." });
    } else {
        alertas.forEach(a => {
            const pctS = a.capDia > 0 ? ((a.sobre / a.capDia) * 100).toFixed(0) : "?";
            pontos.push({ cor: RED_HDR, txt: `⚠️  ATENÇÃO: ${a.recurso} (${a.desc}) — ${fmtMinHoras(a.sobre)} em sobrecarga (${pctS}% da cap/dia). Verificar possibilidade de H.E. ou redistribuição.` });
        });
    }

    // Recomendações gerais
    if (totalSobre > 0) {
        pontos.push({ cor: AMBER, txt: "💡 RECOMENDAÇÃO: Considerar horas extras nos recursos em sobrecarga ou revisar as datas PCP com o cliente para redistribuir a carga." });
        pontos.push({ cor: AMBER, txt: "💡 RECOMENDAÇÃO: Verificar se é possível transferir operações entre turnos ou adicionar capacidade temporária (terceirização)." });
    }
    pontos.push({ cor: NAVY, txt: `📅 Base de planejamento: ${fmtDate(report.data_base)} | Emitido em: ${geradoEm} | Planejador: ${report.planejador}` });

    pontos.forEach(p => {
        ws.mergeCells("A"+curRow+":F"+curRow);
        const pc = ws.getCell("A"+curRow);
        pc.value = "  " + p.txt;
        setFill(pc, p.cor === NAVY ? LGRAY : (p.cor === RED_HDR ? RED_ROW : "FFFFF7ED"));
        setFont(pc, { size: 9, color: { argb: p.cor }, bold: p.cor === RED_HDR });
        setAlign(pc, "left", "middle"); ws.getRow(curRow).height = 18; curRow++;
    });

    // Footer
    curRow++;
    ws.mergeCells("A"+curRow+":F"+curRow);
    const foot = ws.getCell("A"+curRow);
    foot.value = "Agente FCS - MetalFisa Sistema - " + geradoEm;
    setFont(foot, { size: 7, italic: true, color: { argb: ACCENT } }); setAlign(foot, "center");
}

// ════════════════════════════════════════════════════════════════════════════
//  ABA: PROGRAMAÇÃO DIÁRIA — Peças a fabricar por dia por recurso
// ════════════════════════════════════════════════════════════════════════════
function buildSheetProgDiaria(wb, ws, report) {
    ws.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    ws.views = [{ showGridLines: false, state: "frozen", ySplit: 12 }];
    // Colunas: Recurso/Desc | Dia | Pedido | OP | Produto | Op | Qtd | Minutos | Sobrecarga
    [28, 14, 14, 10, 18, 8, 8, 10, 12].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

    const geradoEm = new Date().toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo", day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit"
    });
    buildHeader(wb, ws, "I",
        "Programação Diária — Peças a Fabricar por Dia / Recurso",
        "Lista detalhada de peças alocadas por recurso e por dia de produção",
        report.planejador, report.data_base, geradoEm);

    const RED_HDR = "FFDC2626";
    const RED_ROW = "FFFEE2E2";
    const RED_TXT = "FF991B1B";
    const GRN_HDR = "FF16A34A";
    const GRN_ROW = "FFF0FDF4";
    const GRN_TXT = "FF166534";

    // ── Monta estrutura: recurso → dia → [itens] ──────────────────────────────
    // Usa report.decisoes com fatias_diarias
    // Também inclui pedido buscando de report.decisoes
    const byRecursoDia = {};  // { recurso: { date: [{ op, pedido, produto, operacao, qtd, minutos, is_sobrecarga, desc_recurso }] } }
    const ordemRecurso = {};
    let ordemIdx = 0;
    Object.keys(report.resumo_recursos || {}).forEach(k => { ordemRecurso[k] = ordemIdx++; });

    // Mapa op_numero → pedido (extraído do próprio report.decisoes via op_numero)
    // O pedido vem de report.ops_info se disponível, fallback: '—'
    const pedidoMap = {}; // op_numero → pedido
    if (report.ops_info) {
        report.ops_info.forEach(o => { if (o.op_num && o.pedido) pedidoMap[o.op_num] = o.pedido; });
    }

    (report.decisoes || []).forEach(d => {
        const rec = (d.recurso || "").trim();
        if (!byRecursoDia[rec]) byRecursoDia[rec] = { desc: d.desc_recurso || rec, dias: {} };
        (d.fatias_diarias || []).forEach(f => {
            if (!f.data) return;
            if (!byRecursoDia[rec].dias[f.data]) byRecursoDia[rec].dias[f.data] = [];
            byRecursoDia[rec].dias[f.data].push({
                op:           d.op_numero,
                pedido:       pedidoMap[d.op_numero] || d.pedido || "—",
                produto:      d.produto,
                operacao:     d.operacao,
                qtd:          f.qtd || 0,
                minutos:      f.minutos || 0,
                is_sobrecarga: f.is_sobrecarga,
            });
        });
    });

    // Ordena recursos pela ordem configurada
    const recursos = Object.keys(byRecursoDia).sort((a, b) =>
        (ordemRecurso[a] ?? 9999) - (ordemRecurso[b] ?? 9999)
    );

    let curRow = 11;

    // ── Cabeçalho da tabela ───────────────────────────────────────────────────
    const COL_HDR = ["Recurso / Descrição","Dia","Pedido","OP","Produto","Op.","Qtd","Minutos","Tipo"];
    const hRow = ws.getRow(curRow); hRow.height = 18;
    COL_HDR.forEach((h, i) => {
        const c = hRow.getCell(i + 1); c.value = h;
        setFill(c, NAVY); setFont(c, { bold: true, size: 9, color: { argb: WHITE } });
        setAlign(c, i <= 1 ? "left" : "center"); setBorder(c, "thin", WHITE);
    }); curRow++;

    // ── Dados: agrupa por recurso → dia ───────────────────────────────────────
    recursos.forEach((rec, recIdx) => {
        const rData = byRecursoDia[rec];
        const dias = Object.keys(rData.dias).sort();
        const recLabel = fmtRecurso(rec, rData.desc);
        const capDia = report.resumo_recursos?.[rec]?.capacidade_diaria_min || 480;

        // Sub-cabeçalho do recurso
        ws.mergeCells("A"+curRow+":I"+curRow);
        const rh = ws.getCell("A"+curRow);
        const totalMinRec = dias.reduce((sum, d) =>
            sum + rData.dias[d].reduce((s, i) => s + i.minutos, 0), 0);
        rh.value = `  ${recLabel}  —  Total: ${fmtMin(totalMinRec)}  (${fmtHoras(totalMinRec)})  |  Cap/Dia: ${fmtMin(capDia)}`;
        setFill(rh, NAVY); setFont(rh, { bold: true, size: 10, color: { argb: WHITE } });
        setAlign(rh, "left", "middle"); ws.getRow(curRow).height = 18; curRow++;

        dias.forEach((dia, dIdx) => {
            const itens = rData.dias[dia];
            const totalMinDia = itens.reduce((s, i) => s + i.minutos, 0);
            const pct = capDia > 0 ? Math.round((totalMinDia / capDia) * 100) : 0;
            const temSobre = itens.some(i => i.is_sobrecarga);
            const diaFill = temSobre ? "FFFEF3C7" : "FFE0F2FE";
            const diaTxt  = temSobre ? AMBER : BLUE;

            // Sub-cabeçalho do dia
            ws.mergeCells("A"+curRow+":I"+curRow);
            const dh = ws.getCell("A"+curRow);
            dh.value = `    📅 ${fmtDate(dia)} (${weekDay(dia)})  —  ${fmtMin(totalMinDia)} / ${pct}% da capacidade${temSobre ? "  ⚠️ SOBRECARGA" : ""}`;
            setFill(dh, diaFill); setFont(dh, { bold: true, size: 9, color: { argb: diaTxt } });
            setAlign(dh, "left", "middle"); ws.getRow(curRow).height = 16; curRow++;

            // Linhas de cada peça/operação
            itens.forEach((item, iIdx) => {
                const bg  = item.is_sobrecarga ? RED_ROW : (iIdx % 2 === 0 ? WHITE : GRAY);
                const txt = item.is_sobrecarga ? RED_TXT : BLACK;
                const row = ws.getRow(curRow); row.height = 14;
                [
                    recLabel,
                    fmtDate(dia) + " " + weekDay(dia),
                    item.pedido,
                    item.op,
                    item.produto,
                    item.operacao,
                    item.qtd,
                    fmtMin(item.minutos),
                    item.is_sobrecarga ? "⚠️ SOBRE" : "✅ Normal",
                ].forEach((v, i) => {
                    const c = row.getCell(i + 1); c.value = v;
                    setFill(c, bg);
                    setFont(c, { size: 8, color: { argb: i === 8 && item.is_sobrecarga ? RED_TXT : txt } });
                    setAlign(c, i < 2 ? "left" : (i >= 6 ? "center" : "left")); setBorder(c);
                }); curRow++;
            });

            // Total do dia
            ws.mergeCells("A"+curRow+":F"+curRow);
            const totDiaLabel = ws.getRow(curRow).getCell(1);
            totDiaLabel.value = `    Total do dia ${fmtDate(dia)}`;
            const totDiaMin   = ws.getRow(curRow).getCell(7);
            totDiaMin.value = itens.reduce((s, i) => s + i.qtd, 0); // total peças
            const totDiaHr    = ws.getRow(curRow).getCell(8);
            totDiaHr.value = fmtMin(totalMinDia) + " (" + fmtHoras(totalMinDia) + ")";
            [totDiaLabel, totDiaMin, totDiaHr].forEach(c => {
                setFill(c, LGRAY); setFont(c, { bold: true, size: 8, color: { argb: DGRAY } });
                setAlign(c, "center"); setBorder(c);
            }); curRow++;
        });

        curRow++; // espaço entre recursos
    });

    // Footer
    ws.mergeCells("A"+curRow+":I"+curRow);
    const foot = ws.getCell("A"+curRow);
    foot.value = "Agente FCS — MetalFisa Sistema — " + geradoEm + "  |  ⚠️ = Sobrecarga (além da capacidade normal)";
    setFont(foot, { size: 7, italic: true, color: { argb: ACCENT } }); setAlign(foot, "center");
}

async function generateExcelReport(report) {
    const geradoEm = new Date().toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo", day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit"
    });
    const wb = new ExcelJS.Workbook();
    wb.creator = "MetalFisa - Agente FCS"; wb.created = new Date(); wb.modified = new Date();
    buildSheetCapa(wb, wb.addWorksheet("Capa"), report, { geradoEm });
    buildSheetProgDiaria(wb, wb.addWorksheet("Prog. Diária"), report);
    buildSheetPorRecurso(wb, wb.addWorksheet("Por Recurso"), report);
    buildSheetCargaGeral(wb, wb.addWorksheet("Carga Geral"), report);
    buildSheetResumoAnalise(wb, wb.addWorksheet("Resumo e Analise"), report);
    buildSheetEntendame(wb.addWorksheet("Entenda-me"));
    return wb;
}

module.exports = { generateExcelReport };
