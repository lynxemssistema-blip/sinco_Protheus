/**
 * pplbEngine.js
 * Motor PPLB (EPL2) — compila todos os elementos da etiqueta
 * em uma string/buffer de comandos RAW prontos para envio à impressora.
 *
 * Especificação de suprimento (OSHER Couchê 75x55mm):
 *   - Largura : 75mm = 600 dots (203 DPI)
 *   - Altura  : 55mm = 440 dots
 *   - Gap     : 24 dots (calibração de salto)
 *   - Ribbon  : OBRIGATÓRIO comando OT (Thermal Transfer)
 */

const LABEL_WIDTH_DOTS  = 600;
const LABEL_HEIGHT_DOTS = 440;
const LABEL_GAP_DOTS    = 24;

// Posições e dimensões padrão
const LOGO_X = 10;
const LOGO_Y = 10;
const LOGO_MAX_HEIGHT = 120; // dots

// Área de texto começa após logo + margem
const TEXT_AREA_TOP = 145; // dots a partir do topo
const TEXT_LINE_HEIGHT = 42; // dots entre linhas
const TEXT_X = 20;

// Fonte padrão PPLB: A<x>,<y>,<rot>,<font>,<hMult>,<vMult>,<rev>,"texto"
// Font 4 = CG Times Bold, boa legibilidade em 203 DPI
const FONT_ID = 4;
const H_MULT  = 1;
const V_MULT  = 1;

/**
 * Constrói o buffer completo de comandos PPLB para impressão.
 * Na nova arquitetura, recebemos o comando GW inteiro (que já contém a matriz 600x440 completa).
 *
 * @param {Object} config  - Configuração da etiqueta processada
 * @param {Object} config.gw - { header: string, bitmapBytes: Array, bitmapBuffer: Buffer }
 * @param {number} copies  - Quantidade de cópias a imprimir
 * @returns {Buffer} Buffer de bytes RAW prontos para TCP/USB
 */
function buildLabel(config, copies = 1) {
    const { gw } = config;
    const parts = [];

    const append = (str) => parts.push(Buffer.from(str, 'latin1'));

    // ── Inicialização PPLA (Argox OS-214) ─────────────────────────
    // OS-214 é PPLA puro. N/OT/JF/ZB são PPLB-exclusivos e são ignorados.
    // Q, q, GW, P são idênticos em PPLA e PPLB.
    parts.push(Buffer.from([0x1B, 0x40]));      // ESC @ — reset/inicializa impressora PPLA
    append('\r\n');
    append(`Q${LABEL_HEIGHT_DOTS},${LABEL_GAP_DOTS}\r\n`); // Altura + gap
    append(`q${LABEL_WIDTH_DOTS}\r\n`);         // Largura 75mm = 600 dots

    // ── Matriz Gráfica Completa (Canvas 600x440) ───────────────────
    if (gw && gw.header && gw.bitmapBuffer) {
        append(gw.header);                      // "GW0,0,75,440\n"
        parts.push(gw.bitmapBuffer);            // Bytes binários da imagem completa
    }

    // ── Comando de impressão ───────────────────────────────────────
    append(`\nP${Math.max(1, Math.floor(copies))}\n`);

    return Buffer.concat(parts);
}

/**
 * Calcula quantas cópias devem ser impressas por item.
 * @param {'one'|'quantity'|'custom'} mode
 * @param {Object} item   - Item com campo `quantidade` ou `qtd_faturar`
 * @param {number} custom - Quantidade customizada (usado quando mode='custom')
 */
function calculateCopies(mode, item, custom = 1) {
    switch (mode) {
        case 'quantity':
            return Math.max(1, Math.round(parseFloat(item.quantidade || item.qtd_faturar || 1)));
        case 'custom':
            return Math.max(1, Math.floor(custom));
        case 'one':
        default:
            return 1;
    }
}

/**
 * Monta os campos de texto a partir dos dados do item e da configuração de campos.
 * @param {Object} item         - Dados do item (pedido, produto, descricao, etc.)
 * @param {Array}  fieldConfig  - [{ label: string, dataKey: string }]
 * @returns {Array<{label: string, value: string}>}
 */
function buildFields(item, fieldConfig) {
    const fieldMap = {
        pedido:        item.pedido        || '',
        cliente:       item.cliente       || '',
        produto:       item.produto       || item.codigo || '',
        descricao:     item.descricao     || item.descricao_produto || '',
        quantidade:    String(item.quantidade || item.qtd_faturar || ''),
        data_entrega:  item.data_entrega  || '',
        item:          item.item          || '',
    };

    return (fieldConfig || []).map(fc => ({
        label: fc.label || '',
        value: fieldMap[fc.dataKey] || fc.staticValue || '',
    }));
}

module.exports = { buildLabel, buildFields, calculateCopies };
