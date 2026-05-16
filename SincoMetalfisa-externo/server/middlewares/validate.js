/**
 * validate.js — Centralized Input Validation Middleware
 *
 * Usage:
 *   const { validate, rules } = require('../middlewares/validate');
 *   router.post('/path', validate(rules.pcpForecast), handler);
 *
 * No extra npm packages required — uses native JS validation.
 */

// ─── Primitive Validators ───────────────────────────────────────────────────

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

const isValidDate = (v) =>
    typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v));

const isPositiveNumber = (v) => {
    const n = parseFloat(v);
    return !isNaN(n) && n > 0;
};

const isNonNegativeNumber = (v) => {
    const n = parseFloat(v);
    return !isNaN(n) && n >= 0;
};

const isValidEnum = (allowed) => (v) => allowed.includes(v);

// ─── Rule Sets for Each Endpoint ────────────────────────────────────────────

/**
 * A rule is: { field, required, validator, message }
 * If required=false and field is absent/null/undefined → skip validation.
 */
const rules = {
    // POST /api/pedidos/pcp-forecasts (single)
    pcpForecast: [
        { field: 'pedido',          required: true,  validator: isNonEmptyString,    message: 'pedido deve ser uma string não vazia.' },
        { field: 'item',            required: true,  validator: isNonEmptyString,    message: 'item deve ser uma string não vazia.' },
        { field: 'data_entrega_pcp',required: true,  validator: isValidDate,         message: 'data_entrega_pcp deve estar no formato YYYY-MM-DD.' },
        { field: 'quantidade_pcp',  required: true,  validator: isPositiveNumber,    message: 'quantidade_pcp deve ser um número positivo.' },
        { field: 'usuario',         required: true,  validator: isNonEmptyString,    message: 'usuario é obrigatório.' },
    ],

    // POST /api/pedidos/pcp-forecasts/batch
    pcpForecastBatch: [
        { field: 'data_entrega_pcp',required: true,  validator: isValidDate,         message: 'data_entrega_pcp deve estar no formato YYYY-MM-DD.' },
        { field: 'usuario',         required: true,  validator: isNonEmptyString,    message: 'usuario é obrigatório.' },
    ],

    // PUT /api/pedidos/pcp-forecasts/:id
    pcpForecastUpdate: [
        { field: 'data_entrega_pcp',required: true,  validator: isValidDate,         message: 'data_entrega_pcp deve estar no formato YYYY-MM-DD.' },
        { field: 'quantidade_pcp',  required: true,  validator: isPositiveNumber,    message: 'quantidade_pcp deve ser um número positivo.' },
    ],

    // POST /api/pcp-releases/log
    pcpReleaseLog: [
        { field: 'lote_info',       required: true,  validator: isNonEmptyString,    message: 'lote_info é obrigatório.' },
        { field: 'usuario',         required: true,  validator: isNonEmptyString,    message: 'usuario é obrigatório.' },
        { field: 'qtd_ops',         required: false, validator: isNonNegativeNumber, message: 'qtd_ops deve ser um número não-negativo.' },
    ],

    // POST /api/pedidos/:pedido/items/:item/notes
    itemNotes: [
        { field: 'status', required: false,
          validator: isValidEnum(['PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO']),
          message: 'status deve ser PENDENTE, EM_ANDAMENTO ou CONCLUIDO.' },
    ],

    // POST /api/engineering-releases/log
    engineeringReleaseLog: [
        { field: 'codigo_produto',  required: true,  validator: isNonEmptyString,    message: 'codigo_produto é obrigatório.' },
        { field: 'usuario',         required: true,  validator: isNonEmptyString,    message: 'usuario é obrigatório.' },
        { field: 'tipo_acao',       required: true,
          validator: isValidEnum(['DOWNLOAD', 'EMAIL']),
          message: 'tipo_acao deve ser DOWNLOAD ou EMAIL.' },
        { field: 'modo',            required: true,
          validator: isValidEnum(['FULL', 'N1']),
          message: 'modo deve ser FULL ou N1.' },
    ],
};

// ─── Middleware Factory ──────────────────────────────────────────────────────

/**
 * Returns an Express middleware that validates req.body against the given rule set.
 * On failure: 422 Unprocessable Entity with field-level error details.
 */
const validate = (ruleSet) => (req, res, next) => {
    const errors = [];

    for (const rule of ruleSet) {
        const value = req.body[rule.field];
        const absent = value === undefined || value === null || value === '';

        if (absent) {
            if (rule.required) {
                errors.push({ field: rule.field, message: rule.message });
            }
            continue; // optional & absent → skip
        }

        if (!rule.validator(value)) {
            errors.push({ field: rule.field, message: rule.message });
        }
    }

    if (errors.length > 0) {
        return res.status(422).json({
            error: 'Validação falhou. Corrija os campos indicados.',
            fields: errors,
        });
    }

    next();
};

module.exports = { validate, rules };
