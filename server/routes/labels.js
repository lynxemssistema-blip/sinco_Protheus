/**
 * labels.js — Rota /api/labels
 * Sistema de impressão de etiquetas PPLB/EPL2
 *
 * Endpoints:
 *   GET  /api/labels/config          → Busca configuração salva (impressora + layout)
 *   PUT  /api/labels/config          → Salva configuração
 *   POST /api/labels/logo            → Upload e processamento da logo
 *   POST /api/labels/test-connection → Testa conectividade com a impressora
 *   POST /api/labels/preview         → Gera preview HTML/SVG da etiqueta (sem imprimir)
 *   POST /api/labels/print           → Imprime etiquetas para os itens selecionados
 */

const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const sharp    = require('sharp');
const fs       = require('fs');
const path     = require('path');
const db       = require('../services/mysqlService'); // Mudou para MySQL
const { processImageToGW } = require('../services/imageProcessor');
const { buildLabel, buildFields, calculateCopies } = require('../services/pplbEngine');
const { sendRaw, testConnection, DEFAULT_PORT }    = require('../services/rawPrinter');
const { getTenantContext } = require('../util/authHelper');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ── Setup da tabela (cria se não existir) ─────────────────────────────────────
async function ensureTable() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS label_config (
            id             INT AUTO_INCREMENT PRIMARY KEY,
            printer_mode   VARCHAR(10)  DEFAULT 'tcp',
            printer_host   VARCHAR(100) DEFAULT '127.0.0.1',
            printer_port   INTEGER      DEFAULT 9100,
            print_offset_x INTEGER      DEFAULT 0,
            print_offset_y INTEGER      DEFAULT 0,
            logo_base64    LONGTEXT,
            logo_width     INTEGER,
            logo_height    INTEGER,
            logo_bytes_row INTEGER,
            logo_bitmap    LONGTEXT,
            label_fields   LONGTEXT,
            updated_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `);
    // Migração segura: adiciona colunas de offset somente se não existirem
    const [cols] = await db.query(`SHOW COLUMNS FROM label_config LIKE 'print_offset_x'`);
    if (cols.length === 0) {
        await db.query(`ALTER TABLE label_config ADD COLUMN print_offset_x INTEGER DEFAULT 0`);
        await db.query(`ALTER TABLE label_config ADD COLUMN print_offset_y INTEGER DEFAULT 0`);
    }
    const [colsName] = await db.query(`SHOW COLUMNS FROM label_config LIKE 'name'`);
    if (colsName.length === 0) {
        await db.query(`ALTER TABLE label_config ADD COLUMN name VARCHAR(255) DEFAULT 'Modelo Padrão'`);
    }
    const [colsIsDefault] = await db.query(`SHOW COLUMNS FROM label_config LIKE 'is_default'`);
    if (colsIsDefault.length === 0) {
        await db.query(`ALTER TABLE label_config ADD COLUMN is_default BOOLEAN DEFAULT FALSE`);
        try {
            const [first] = await db.query(`SELECT id FROM label_config ORDER BY id LIMIT 1`);
            if (first.length > 0) {
                await db.query(`UPDATE label_config SET is_default = 1 WHERE id = ?`, [first[0].id]);
            }
        } catch (e) {
            console.error('[Labels] Failed to set default label:', e);
        }
    }
    // Novas colunas de dimensões físicas (mm), resolução DPI e categoria
    const [colsWidth] = await db.query(`SHOW COLUMNS FROM label_config LIKE 'width_mm'`);
    if (colsWidth.length === 0) {
        await db.query(`ALTER TABLE label_config ADD COLUMN width_mm INTEGER DEFAULT 100`);
        await db.query(`ALTER TABLE label_config ADD COLUMN height_mm INTEGER DEFAULT 50`);
        await db.query(`ALTER TABLE label_config ADD COLUMN dpi INTEGER DEFAULT 203`);
        await db.query(`ALTER TABLE label_config ADD COLUMN category VARCHAR(50) DEFAULT 'geral'`);
    }
    // Garante que existe pelo menos 1 registro
    const [rows] = await db.query('SELECT id FROM label_config LIMIT 1');
    if (rows.length === 0) {
        await db.query(`INSERT INTO label_config (name, is_default, width_mm, height_mm, dpi, category, label_fields) VALUES (?, 1, 100, 50, 203, 'apontamento_etapa', ?)`, [
            '100x50 mm - Roteiro & Identificação Chão de Fábrica',
            JSON.stringify([
                { label: 'CLIENTE: ',  dataKey: 'cliente',   fontFamily: 'Arial', fontSize: 20, fontWeight: 'bold', x: 20, y: 135 },
                { label: 'OP: ',       dataKey: 'op',        fontFamily: 'Arial', fontSize: 22, fontWeight: 'bold', x: 20, y: 165 },
                { label: 'ITEM: ',     dataKey: 'item',      fontFamily: 'Arial', fontSize: 20, fontWeight: 'normal', x: 260, y: 165 },
                { label: 'PROD: ',     dataKey: 'produto',   fontFamily: 'Arial', fontSize: 18, fontWeight: 'bold', x: 20, y: 195 },
                { label: 'DESENHO: ',  dataKey: 'ref_cliente', fontFamily: 'Arial', fontSize: 18, fontWeight: 'bold', x: 260, y: 195 },
                { label: 'REV: ',      dataKey: 'revisao',   fontFamily: 'Arial', fontSize: 18, fontWeight: 'bold', x: 480, y: 195 },
                { label: 'DESC: ',     dataKey: 'descricao', fontFamily: 'Arial', fontSize: 16, fontWeight: 'normal', x: 20, y: 225 },
                { label: 'ETAPA: ',    dataKey: 'operacao',  fontFamily: 'Arial', fontSize: 20, fontWeight: 'bold', x: 20, y: 260 },
                { label: 'RECURSO: ',  dataKey: 'recurso',   fontFamily: 'Arial', fontSize: 18, fontWeight: 'normal', x: 380, y: 260 },
                { label: 'QTD APROV: ',dataKey: 'qtd_apontada', fontFamily: 'Arial', fontSize: 22, fontWeight: 'bold', x: 20, y: 295 },
                { label: 'OPERADOR: ', dataKey: 'operador',  fontFamily: 'Arial', fontSize: 18, fontWeight: 'normal', x: 260, y: 295 },
                { label: 'DATA/HORA: ',dataKey: 'data_hora', fontFamily: 'Arial', fontSize: 16, fontWeight: 'normal', x: 20, y: 330 },
                { label: 'PRÓXIMO: ',  dataKey: 'proxima_operacao', fontFamily: 'Arial', fontSize: 18, fontWeight: 'bold', x: 260, y: 330 },
                { label: '',           dataKey: 'qrcode',    fontFamily: 'Arial', fontSize: 12, fontWeight: 'normal', x: 440, y: 260, qrCode: true }
            ])
        ]);
    }
}
ensureTable().catch(e => console.error('[Labels] Erro ao criar tabela label_config no MySQL:', e));

// ── Modelos de Presets Padronizados de Mercado ────────────────────────────────
const PRESET_TEMPLATES = [
    {
        id: 'preset-100x50',
        name: '100x50 mm - Roteiro & Identificação Chão de Fábrica (MES)',
        width_mm: 100,
        height_mm: 50,
        dpi: 203,
        category: 'apontamento_etapa',
        description: 'Padrão industrial mais usado no Brasil para rastreamento de peças e subconjuntos.',
        label_fields: [
            { label: 'CLIENTE: ',  dataKey: 'cliente',   fontFamily: 'Arial', fontSize: 20, fontWeight: 'bold', x: 20, y: 135 },
            { label: 'OP: ',       dataKey: 'op',        fontFamily: 'Arial', fontSize: 22, fontWeight: 'bold', x: 20, y: 165 },
            { label: 'ITEM: ',     dataKey: 'item',      fontFamily: 'Arial', fontSize: 20, fontWeight: 'normal', x: 260, y: 165 },
            { label: 'PROD: ',     dataKey: 'produto',   fontFamily: 'Arial', fontSize: 18, fontWeight: 'bold', x: 20, y: 195 },
            { label: 'DESENHO: ',  dataKey: 'ref_cliente', fontFamily: 'Arial', fontSize: 18, fontWeight: 'bold', x: 260, y: 195 },
            { label: 'REV: ',      dataKey: 'revisao',   fontFamily: 'Arial', fontSize: 18, fontWeight: 'bold', x: 480, y: 195 },
            { label: 'DESC: ',     dataKey: 'descricao', fontFamily: 'Arial', fontSize: 16, fontWeight: 'normal', x: 20, y: 225 },
            { label: 'ETAPA: ',    dataKey: 'operacao',  fontFamily: 'Arial', fontSize: 20, fontWeight: 'bold', x: 20, y: 260 },
            { label: 'RECURSO: ',  dataKey: 'recurso',   fontFamily: 'Arial', fontSize: 18, fontWeight: 'normal', x: 380, y: 260 },
            { label: 'QTD APROV: ',dataKey: 'qtd_apontada', fontFamily: 'Arial', fontSize: 22, fontWeight: 'bold', x: 20, y: 295 },
            { label: 'OPERADOR: ', dataKey: 'operador',  fontFamily: 'Arial', fontSize: 18, fontWeight: 'normal', x: 260, y: 295 },
            { label: 'DATA/HORA: ',dataKey: 'data_hora', fontFamily: 'Arial', fontSize: 16, fontWeight: 'normal', x: 20, y: 330 },
            { label: 'PRÓXIMO: ',  dataKey: 'proxima_operacao', fontFamily: 'Arial', fontSize: 18, fontWeight: 'bold', x: 260, y: 330 },
            { label: '',           dataKey: 'qrcode',    fontFamily: 'Arial', fontSize: 12, fontWeight: 'normal', x: 440, y: 260, qrCode: true }
        ]
    },
    {
        id: 'preset-100x20',
        name: '100x20 mm - Perfis, Tubos, Cantoneiras & Barras Longas',
        width_mm: 100,
        height_mm: 20,
        dpi: 203,
        category: 'apontamento_etapa',
        description: 'Formato régua alongada estreita. Perfeito para colar na face de tubos e vigas.',
        label_fields: [
            { label: 'CLI: ',      dataKey: 'cliente',   fontFamily: 'Arial', fontSize: 16, fontWeight: 'bold', x: 15, y: 15 },
            { label: 'OP: ',       dataKey: 'op',        fontFamily: 'Arial', fontSize: 18, fontWeight: 'bold', x: 220, y: 15 },
            { label: 'QTD: ',      dataKey: 'qtd_apontada', fontFamily: 'Arial', fontSize: 18, fontWeight: 'bold', x: 380, y: 15 },
            { label: 'PEÇA: ',     dataKey: 'ref_cliente', fontFamily: 'Arial', fontSize: 16, fontWeight: 'bold', x: 15, y: 45 },
            { label: 'ETAPA: ',    dataKey: 'operacao',  fontFamily: 'Arial', fontSize: 16, fontWeight: 'normal', x: 220, y: 45 },
            { label: 'PRÓX: ',     dataKey: 'proxima_operacao', fontFamily: 'Arial', fontSize: 16, fontWeight: 'bold', x: 360, y: 45 },
            { label: '',           dataKey: 'qrcode',    fontFamily: 'Arial', fontSize: 10, fontWeight: 'normal', x: 480, y: 10, qrCode: true }
        ]
    },
    {
        id: 'preset-100x15',
        name: '100x15 mm - Fita Estreita para Feixes & Barras',
        width_mm: 100,
        height_mm: 15,
        dpi: 203,
        category: 'apontamento_etapa',
        description: 'Formato ultra-estreito para marcação rápida de feixes ou perfis finos.',
        label_fields: [
            { label: 'OP: ',       dataKey: 'op',        fontFamily: 'Arial', fontSize: 16, fontWeight: 'bold', x: 15, y: 15 },
            { label: 'DES: ',      dataKey: 'ref_cliente', fontFamily: 'Arial', fontSize: 16, fontWeight: 'bold', x: 160, y: 15 },
            { label: 'QTD: ',      dataKey: 'qtd_apontada', fontFamily: 'Arial', fontSize: 16, fontWeight: 'bold', x: 340, y: 15 },
            { label: '',           dataKey: 'qrcode',    fontFamily: 'Arial', fontSize: 10, fontWeight: 'normal', x: 460, y: 5, qrCode: true }
        ]
    },
    {
        id: 'preset-30x20',
        name: '30x20 mm - Usinagem, Mini-Peça & Gaveteiro',
        width_mm: 30,
        height_mm: 20,
        dpi: 203,
        category: 'almoxarifado',
        description: 'Para buchas, flanges pequenas, pinos usinados ou etiquetas de gaveteiro.',
        label_fields: [
            { label: '',           dataKey: 'produto',   fontFamily: 'Arial', fontSize: 16, fontWeight: 'bold', x: 10, y: 15 },
            { label: 'OP: ',       dataKey: 'op',        fontFamily: 'Arial', fontSize: 14, fontWeight: 'normal', x: 10, y: 40 },
            { label: 'QTD: ',      dataKey: 'qtd_apontada', fontFamily: 'Arial', fontSize: 14, fontWeight: 'bold', x: 10, y: 65 },
            { label: '',           dataKey: 'qrcode',    fontFamily: 'Arial', fontSize: 10, fontWeight: 'normal', x: 130, y: 15, qrCode: true }
        ]
    },
    {
        id: 'preset-30x15',
        name: '30x15 mm - Micro-Peças & Parafusos / Fixadores',
        width_mm: 30,
        height_mm: 15,
        dpi: 203,
        category: 'almoxarifado',
        description: 'Formato compacto para identificação de parafusos, porcas ou componentes elétricos.',
        label_fields: [
            { label: '',           dataKey: 'produto',   fontFamily: 'Arial', fontSize: 14, fontWeight: 'bold', x: 10, y: 12 },
            { label: 'OP: ',       dataKey: 'op',        fontFamily: 'Arial', fontSize: 12, fontWeight: 'normal', x: 10, y: 32 },
            { label: '',           dataKey: 'qrcode',    fontFamily: 'Arial', fontSize: 8, fontWeight: 'normal', x: 120, y: 8, qrCode: true }
        ]
    },
    {
        id: 'preset-100x100',
        name: '100x100 mm - Palete & Romaneio de Carga (Expedição)',
        width_mm: 100,
        height_mm: 100,
        dpi: 203,
        category: 'romaneio',
        description: 'Etiqueta grande para paletes fechados, caixas ou identificação de romaneio.',
        label_fields: [
            { label: 'CLIENTE: ',  dataKey: 'cliente',   fontFamily: 'Arial', fontSize: 24, fontWeight: 'bold', x: 20, y: 140 },
            { label: 'PEDIDO: ',   dataKey: 'pedido',    fontFamily: 'Arial', fontSize: 24, fontWeight: 'bold', x: 20, y: 180 },
            { label: 'OP: ',       dataKey: 'op',        fontFamily: 'Arial', fontSize: 24, fontWeight: 'bold', x: 300, y: 180 },
            { label: 'PRODUTO: ',  dataKey: 'produto',   fontFamily: 'Arial', fontSize: 20, fontWeight: 'normal', x: 20, y: 220 },
            { label: 'DESCRIÇÃO: ',dataKey: 'descricao', fontFamily: 'Arial', fontSize: 18, fontWeight: 'normal', x: 20, y: 260 },
            { label: 'QTD TOTAL: ',dataKey: 'quantidade',fontFamily: 'Arial', fontSize: 26, fontWeight: 'bold', x: 20, y: 305 },
            { label: 'ENTREGA: ',  dataKey: 'data_entrega', fontFamily: 'Arial', fontSize: 20, fontWeight: 'normal', x: 20, y: 350 },
            { label: '',           dataKey: 'qrcode',    fontFamily: 'Arial', fontSize: 12, fontWeight: 'normal', x: 420, y: 280, qrCode: true }
        ]
    }
];

// ── GET /api/labels/presets ───────────────────────────────────────────────────
router.get('/presets', (req, res) => {
    res.json({ ok: true, presets: PRESET_TEMPLATES });
});

// ── GET /api/labels/config ────────────────────────────────────────────────────
router.get('/config', async (req, res) => {
    try {
        const tenantId = getTenantContext(req) || 1;
        let company = {};
        try {
            const [compRows] = await db.query(
                'SELECT razao_social, nome_fantasia, logo_base64 FROM app_company_settings WHERE IdEmpresa = ? LIMIT 1',
                [tenantId]
            );
            company = compRows[0] || {};
        } catch (e) {
            console.warn('[Labels] Falha ao obter dados da empresa ativa:', e.message);
        }
        const companyShortName = (company.nome_fantasia || company.razao_social || 'EMPRESA').toUpperCase().split(/\s+/)[0].slice(0, 12);

        const [rows] = await db.query(
            'SELECT id, name, is_default, printer_mode, printer_host, printer_port, print_offset_x, print_offset_y, width_mm, height_mm, dpi, category, logo_base64, logo_width, logo_height, label_fields FROM label_config ORDER BY is_default DESC, id ASC'
        );
        if (rows.length === 0) {
            return res.json({
                ok: true,
                config: null,
                configs: [],
                company: {
                    razao_social: company.razao_social,
                    nome_fantasia: company.nome_fantasia,
                    short_name: companyShortName,
                    logo_base64: company.logo_base64
                }
            });
        }
        
        const configs = rows.map(r => {
            let fields = [];
            if (typeof r.label_fields === 'string') {
                try { fields = JSON.parse(r.label_fields); } catch(e){}
            } else {
                fields = r.label_fields || [];
            }
            // Substitui o marcador legado "Metalfisa" dinamicamente pelo nome curto da empresa ativa
            fields = fields.map(f => {
                if (f && f.label && /metalfisa/i.test(f.label)) {
                    return { ...f, label: f.label.replace(/metalfisa/gi, companyShortName) };
                }
                return f;
            });

            // Se a empresa possui logo cadastrada em app_company_settings, expõe na config
            let logoBase64 = r.logo_base64;
            if (company.logo_base64) {
                logoBase64 = company.logo_base64.replace(/^data:image\/\w+;base64,/, '');
            }

            return { 
                ...r, 
                width_mm: r.width_mm || 100,
                height_mm: r.height_mm || 50,
                dpi: r.dpi || 203,
                category: r.category || 'geral',
                logo_base64: logoBase64, 
                label_fields: fields 
            };
        });

        res.json({
            ok: true,
            config: configs[0],
            configs,
            company: {
                razao_social: company.razao_social,
                nome_fantasia: company.nome_fantasia,
                short_name: companyShortName,
                logo_base64: company.logo_base64
            }
        });
    } catch (err) {
        console.error('[Labels] GET /config:', err);
        res.status(500).json({ error: 'Erro ao buscar configuração de etiqueta' });
    }
});

// ── PUT /api/labels/config ────────────────────────────────────────────────────
router.put('/config', async (req, res) => {
    try {
        let { 
            id, name, is_default, printer_mode, printer_host, printer_port, 
            print_offset_x, print_offset_y, width_mm, height_mm, dpi, category, label_fields 
        } = req.body;

        if (!id) {
            // Fallback: se não enviou ID, tenta atualizar o modelo padrão
            const [rows] = await db.query('SELECT id FROM label_config ORDER BY is_default DESC, id ASC LIMIT 1');
            if (rows.length > 0) {
                id = rows[0].id;
            } else {
                return res.status(400).json({ error: 'Nenhuma configuração existente para atualizar. Crie um modelo primeiro.' });
            }
        }

        if (is_default) {
            await db.query(`UPDATE label_config SET is_default = FALSE WHERE id != ?`, [id]);
        }

        await db.query(`
            UPDATE label_config SET
                name           = ?,
                is_default     = ?,
                printer_mode   = ?,
                printer_host   = ?,
                printer_port   = ?,
                print_offset_x = ?,
                print_offset_y = ?,
                width_mm       = ?,
                height_mm      = ?,
                dpi            = ?,
                category       = ?,
                label_fields   = ?,
                updated_at     = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            name || 'Modelo Padrão',
            is_default ? 1 : 0,
            printer_mode || 'tcp',
            printer_host || '127.0.0.1',
            parseInt(printer_port) || DEFAULT_PORT,
            parseInt(print_offset_x) || 0,
            parseInt(print_offset_y) || 0,
            parseInt(width_mm) || 100,
            parseInt(height_mm) || 50,
            parseInt(dpi) || 203,
            category || 'geral',
            JSON.stringify(label_fields || []),
            id
        ]);

        res.json({ ok: true });
    } catch (err) {
        console.error('[Labels] PUT /config:', err);
        res.status(500).json({ error: 'Erro ao salvar configuração' });
    }
});

// ── POST /api/labels/config/new ────────────────────────────────────────────────
router.post('/config/new', async (req, res) => {
    try {
        const { 
            name, printer_mode, printer_host, printer_port, 
            print_offset_x, print_offset_y, width_mm, height_mm, dpi, category, label_fields 
        } = req.body;

        const [result] = await db.query(`
            INSERT INTO label_config 
                (name, is_default, printer_mode, printer_host, printer_port, print_offset_x, print_offset_y, width_mm, height_mm, dpi, category, label_fields) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            name || 'Novo Modelo',
            0,
            printer_mode || 'tcp',
            printer_host || '127.0.0.1',
            parseInt(printer_port) || DEFAULT_PORT,
            parseInt(print_offset_x) || 0,
            parseInt(print_offset_y) || 0,
            parseInt(width_mm) || 100,
            parseInt(height_mm) || 50,
            parseInt(dpi) || 203,
            category || 'geral',
            JSON.stringify(label_fields || [])
        ]);

        res.json({ ok: true, insertId: result.insertId });
    } catch (err) {
        console.error('[Labels] POST /config/new:', err);
        res.status(500).json({ error: 'Erro ao criar modelo de etiqueta' });
    }
});

// ── Funções Auxiliares de Tradução e Geração ZPL ──────────────────────────────
function cleanZplText(text) {
    if (!text) return '';
    return String(text)
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[\^~]/g, '');
}

function resolveFieldValue(key, data = {}) {
    switch (key) {
        case 'op': return data.op || '';
        case 'item': return data.item_op || data.item || '';
        case 'pedido': return data.pedido || '';
        case 'ped_cliente': return data.ped_cliente || data.pedido_cliente || '';
        case 'cliente': return data.cliente || '';
        case 'produto': return data.produto || data.codigo_produto || '';
        case 'ref_cliente': return data.ref_cliente || data.desenho || '';
        case 'revisao': return data.revisao || data.rev || '00';
        case 'descricao': return data.descricao || '';
        case 'operacao': return data.operacao_nome || data.operacao || '';
        case 'recurso': return data.recurso || data.recurso_nome || '';
        case 'operador': return data.operador || data.usuario || '';
        case 'qtd_apontada': return data.qtd_apontada !== undefined ? String(data.qtd_apontada) : (data.quantidade !== undefined ? String(data.quantidade) : '1');
        case 'quantidade': return data.quantidade !== undefined ? String(data.quantidade) : '';
        case 'status_etapa': return data.status_etapa || 'APROVADO';
        case 'proxima_operacao': return data.proxima_operacao || 'EXPEDICAO';
        case 'data_hora': return data.data_hora || new Date().toLocaleString('pt-BR');
        case 'data_entrega': return data.data_entrega || '';
        case 'emissao': return data.emissao || '';
        case 'nf': return data.nf || '';
        case 'qrcode': return data.qrcode || `OP:${data.op || ''}|IT:${data.item_op || ''}|ET:${data.operacao || ''}`;
        default: return data[key] || '';
    }
}

function generateZplFromTemplate(template, data = {}, copies = 1) {
    const widthMm = template.width_mm || 100;
    const heightMm = template.height_mm || 50;
    const dpi = template.dpi || 203;
    const dpmm = dpi === 300 ? 12 : 8;
    const widthDots = Math.round(widthMm * dpmm);
    const heightDots = Math.round(heightMm * dpmm);

    let zpl = `^XA\n`;
    zpl += `^PW${widthDots}\n`;
    zpl += `^LL${heightDots}\n`;
    zpl += `^LH0,0\n`;

    let fields = [];
    if (typeof template.label_fields === 'string') {
        try { fields = JSON.parse(template.label_fields); } catch(e){}
    } else {
        fields = template.label_fields || [];
    }

    fields.forEach(field => {
        if (field.disabled) return;
        const scaleX = widthDots / 600;
        const scaleY = heightDots / 440;
        const x = Math.max(10, Math.round((field.x || 20) * scaleX));
        const y = Math.max(10, Math.round((field.y || 20) * scaleY));
        const fontSize = Math.max(14, Math.round((field.fontSize || 22) * scaleY * 0.85));

        const val = resolveFieldValue(field.dataKey, data);
        const text = `${field.label || ''}${val}`;

        if (field.barcode) {
            zpl += `^FO${x},${y}^BCN,${Math.round((field.barcodeHeight || 45) * scaleY)},Y,N,N^FD${cleanZplText(val || '123456')}^FS\n`;
        } else if (field.qrCode || field.dataKey === 'qrcode') {
            zpl += `^FO${x},${y}^BQN,2,4^FDQA,${val || data.op || 'LYNX'}^FS\n`;
        } else {
            zpl += `^FO${x},${y}^A0N,${fontSize},${fontSize}^FD${cleanZplText(text)}^FS\n`;
        }
    });

    zpl += `^PQ${copies},0,1,Y\n`;
    zpl += `^XZ\n`;
    return zpl;
}

// ── POST /api/labels/print-apontamento ───────────────────────────────────────
router.post('/print-apontamento', async (req, res) => {
    try {
        const { 
            templateId, 
            resourceCode,
            printerHost: overrideHost,
            printerPort: overridePort,
            copies = 1,
            opData = {},
            canvasBase64
        } = req.body;

        let template = null;
        if (templateId) {
            const [tRows] = await db.query('SELECT * FROM label_config WHERE id = ?', [templateId]);
            if (tRows.length > 0) template = tRows[0];
        }

        if (!template && resourceCode) {
            const [rRows] = await db.query(
                'SELECT label_template_id, printer_host, printer_port FROM pcp_recursos WHERE codigo = ? LIMIT 1',
                [resourceCode]
            );
            if (rRows.length > 0 && rRows[0].label_template_id) {
                const [tRows] = await db.query('SELECT * FROM label_config WHERE id = ?', [rRows[0].label_template_id]);
                if (tRows.length > 0) template = tRows[0];
            }
        }

        if (!template) {
            const [defRows] = await db.query('SELECT * FROM label_config ORDER BY is_default DESC, id ASC LIMIT 1');
            template = defRows[0] || null;
        }

        if (!template) {
            return res.status(400).json({ error: 'Nenhum modelo de etiqueta cadastrado no sistema.' });
        }

        const host = overrideHost || template.printer_host || '127.0.0.1';
        const port = parseInt(overridePort || template.printer_port || DEFAULT_PORT, 10);

        // Se enviou canvasBase64 pré-renderizado, envia via Sharp / RAW Graphics
        if (canvasBase64) {
            const rawPng = Buffer.from(canvasBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            const pngBuffer = await sharp(rawPng)
                .greyscale()
                .threshold(128)
                .png()
                .toBuffer();

            const header = Buffer.alloc(8);
            header[0] = 0x4D; header[1] = 0x46;
            header.writeInt16BE(template.print_offset_x || 0, 2);
            header.writeInt16BE(template.print_offset_y || 0, 4);
            header[6] = 1;

            const packet = Buffer.concat([header, pngBuffer]);
            for (let c = 0; c < copies; c++) {
                await sendRaw(host, port, packet);
            }
            return res.json({ ok: true, printed: true, mode: 'canvas', host, port, copies });
        }

        // Caso contrário, gera ZPL puro
        const zpl = generateZplFromTemplate(template, opData, copies);
        try {
            await sendRaw(host, port, Buffer.from(zpl, 'utf8'));
            return res.json({ ok: true, printed: true, mode: 'zpl', host, port, copies, zplPreview: zpl });
        } catch (sendErr) {
            // Em caso de offline no ambiente de dev ou impressora física desligada, retorna ZPL para preview
            return res.json({ 
                ok: true, 
                printed: false, 
                warning: `Impressora em ${host}:${port} não respondeu (${sendErr.message}). O comando ZPL foi gerado com sucesso.`,
                zplPreview: zpl,
                template: template.name
            });
        }
    } catch (err) {
        console.error('[Labels] POST /print-apontamento:', err);
        res.status(500).json({ error: 'Erro ao imprimir etiqueta de apontamento: ' + err.message });
    }
});


// ── DELETE /api/labels/config/:id ──────────────────────────────────────────────
router.delete('/config/:id', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT COUNT(*) as count FROM label_config');
        if (rows[0].count <= 1) {
            return res.status(400).json({ error: 'Não é possível excluir o único modelo de etiqueta existente.' });
        }
        await db.query('DELETE FROM label_config WHERE id = ?', [req.params.id]);
        
        await db.query(`UPDATE label_config SET is_default = 1 ORDER BY id LIMIT 1`);
        
        res.json({ ok: true });
    } catch (err) {
        console.error('[Labels] DELETE /config/:id:', err);
        res.status(500).json({ error: 'Erro ao excluir modelo de etiqueta' });
    }
});

// ── POST /api/labels/logo ─────────────────────────────────────────────────────
router.post('/logo', upload.single('logo'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Nenhuma imagem enviada' });

        const id = req.body.id;
        if (!id) return res.status(400).json({ error: 'ID do modelo é obrigatório' });

        const result = await processImageToGW(req.file.buffer, 10, 10);

        // Salva no banco: base64 da imagem original + dados do bitmap processado
        await db.query(`
            UPDATE label_config SET
                logo_base64    = ?,
                logo_width     = ?,
                logo_height    = ?,
                logo_bytes_row = ?,
                logo_bitmap    = ?,
                updated_at     = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            req.file.buffer.toString('base64'),
            result.widthDots,
            result.heightDots,
            result.bytesPerRow,
            Buffer.from(result.bitmapBytes).toString('base64'),
            id
        ]);

        res.json({
            ok: true,
            widthDots:    result.widthDots,
            heightDots:   result.heightDots,
            previewBase64: result.base64Preview,
        });
    } catch (err) {
        console.error('[Labels] POST /logo:', err);
        res.status(500).json({ error: 'Erro ao processar logo: ' + err.message });
    }
});

// ── POST /api/labels/test-connection ─────────────────────────────────────────
router.post('/test-connection', async (req, res) => {
    try {
        const { host, port } = req.body;
        if (!host) return res.status(400).json({ error: 'Host é obrigatório' });

        const result = await testConnection(host, parseInt(port) || DEFAULT_PORT);
        res.json(result);
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ── POST /api/labels/preview ──────────────────────────────────────────────────
// Retorna dados para o frontend renderizar o preview visual da etiqueta
router.post('/preview', async (req, res) => {
    try {
        const { item, templateId } = req.body; // Um item de exemplo
        const tenantId = getTenantContext(req) || 1;
        let company = {};
        try {
            const [compRows] = await db.query(
                'SELECT razao_social, nome_fantasia, logo_base64 FROM app_company_settings WHERE IdEmpresa = ? LIMIT 1',
                [tenantId]
            );
            company = compRows[0] || {};
        } catch (e) {}
        const companyShortName = (company.nome_fantasia || company.razao_social || 'EMPRESA').toUpperCase().split(/\s+/)[0].slice(0, 12);

        let query = 'SELECT label_fields, logo_base64, logo_width, logo_height FROM label_config ORDER BY is_default DESC, id LIMIT 1';
        let params = [];
        if (templateId) {
            query = 'SELECT label_fields, logo_base64, logo_width, logo_height FROM label_config WHERE id = ? LIMIT 1';
            params = [templateId];
        }

        const [rows] = await db.query(query, params);
        const config = rows[0] || {};

        let parsedFields = [];
        if (typeof config.label_fields === 'string') {
            try { parsedFields = JSON.parse(config.label_fields); } catch(e){}
        } else {
            parsedFields = config.label_fields || [];
        }

        parsedFields = parsedFields.map(f => {
            if (f && f.label && /metalfisa/i.test(f.label)) {
                return { ...f, label: f.label.replace(/metalfisa/gi, companyShortName) };
            }
            return f;
        });

        const fields = buildFields(item || {}, parsedFields);

        let effectiveLogo = config.logo_base64;
        if (company.logo_base64) {
            effectiveLogo = company.logo_base64.replace(/^data:image\/\w+;base64,/, '');
        }

        res.json({
            ok: true,
            fields,
            company: {
                razao_social: company.razao_social,
                nome_fantasia: company.nome_fantasia,
                short_name: companyShortName
            },
            logoBase64: effectiveLogo ? `data:image/png;base64,${effectiveLogo}` : null,
            logoWidth: config.logo_width,
            logoHeight: config.logo_height,
        });
    } catch (err) {
        console.error('[Labels] POST /preview:', err);
        res.status(500).json({ error: 'Erro ao gerar preview' });
    }
});

// ── POST /api/labels/print ────────────────────────────────────────────────────
router.post('/print', async (req, res) => {
    try {
        const { items, copiesMode = 'one', customCopies = 1, templateId } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Nenhum item para imprimir' });
        }

        let query = 'SELECT * FROM label_config ORDER BY is_default DESC, id LIMIT 1';
        let params = [];
        if (templateId) {
            query = 'SELECT * FROM label_config WHERE id = ? LIMIT 1';
            params = [templateId];
        }

        // Busca configuração
        const [rows] = await db.query(query, params);
        if (rows.length === 0) {
            return res.status(400).json({ error: 'Configuração de etiqueta não encontrada. Configure em Configurações > Etiquetas.' });
        }
        const config = rows[0];

        // Monta logo (se existir)
        let logoData = null;
        if (config.logo_bitmap) {
            const bitmapBuffer = Buffer.from(config.logo_bitmap, 'base64');
            logoData = {
                header: `GW10,10,${config.logo_bytes_row},${config.logo_height}\n`,
                bitmapBuffer,
                heightDots: config.logo_height,
                widthDots:  config.logo_width,
            };
        }

        const host = config.printer_mode === 'usb' ? '127.0.0.1' : config.printer_host;
        const port = parseInt(config.printer_port) || DEFAULT_PORT;

        const results = [];

        for (const item of items) {
            try {
                const copies = calculateCopies(copiesMode, item, customCopies);
                let parsedFields = [];
                if (typeof config.label_fields === 'string') {
                    try { parsedFields = JSON.parse(config.label_fields); } catch(e){}
                } else {
                    parsedFields = config.label_fields || [];
                }
                const fields = buildFields(item, parsedFields);
                const labelBuffer = buildLabel({ logo: logoData, fields }, copies);

                await sendRaw(host, port, labelBuffer);
                results.push({ item: item.produto || item.item, ok: true, copies });
            } catch (err) {
                results.push({ item: item.produto || item.item, ok: false, error: err.message });
            }
        }

        const allOk = results.every(r => r.ok);
        res.json({ ok: allOk, results });
    } catch (err) {
        console.error('[Labels] POST /print:', err);
        res.status(500).json({ error: 'Erro interno ao imprimir: ' + err.message });
    }
});

// ── POST /api/labels/print-canvas (NOVA ARQUITETURA WYSIWYG) ────────────────────
router.post('/print-canvas', async (req, res) => {
    try {
        const { items, quality = 5, autoRewind = true } = req.body;
        // items: [{ itemId, copies, canvasBase64, itemData }]

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Nenhum item para imprimir' });
        }

        // Calcula o threshold baseado na qualidade (1 a 10)
        // 5 = 128 (Normal). 10 = ~210 (Muito grosso/escuro). 1 = ~60 (Muito fino/claro)
        const q = Math.max(1, Math.min(10, parseInt(quality) || 5));
        const thresholdValue = Math.round(50 + ((q - 1) * (160 / 9))); // Mapeia 1-10 para 50-210

        let query = 'SELECT printer_mode, printer_host, printer_port, print_offset_x, print_offset_y FROM label_config ORDER BY is_default DESC, id LIMIT 1';
        let params = [];
        if (req.body.templateId) {
            query = 'SELECT printer_mode, printer_host, printer_port, print_offset_x, print_offset_y FROM label_config WHERE id = ? LIMIT 1';
            params = [req.body.templateId];
        }

        // Busca configuração (somente para IP/Porta)
        const [rows] = await db.query(query, params);
        if (rows.length === 0) {
            return res.status(400).json({ error: 'Configuração de etiqueta não encontrada.' });
        }
        const config = rows[0];
        
        const host = config.printer_mode === 'usb' ? '127.0.0.1' : config.printer_host;
        const port = parseInt(config.printer_port) || DEFAULT_PORT;

        const results = [];
        
        for (const item of items) {
            try {
                if (!item.canvasBase64) {
                    throw new Error('Imagem Canvas não fornecida para o item');
                }

                // Converte base64 → PNG → escala de cinza com threshold (BW puro)
                // BW puro elimina dithering do driver e melhora qualidade de impressão
                const rawPng = Buffer.from(
                    item.canvasBase64.replace(/^data:image\/\w+;base64,/, ''),
                    'base64'
                );
                const pngBuffer = await sharp(rawPng)
                    .greyscale()
                    .threshold(thresholdValue)
                    .png()
                    .toBuffer();

                // Header Lynx (8 bytes) com offset de impressão
                const offsetX = parseInt(config.print_offset_x) || 0;
                const offsetY = parseInt(config.print_offset_y) || 0;
                const header = Buffer.alloc(8);
                header[0] = 0x4D; header[1] = 0x46; // "MF" magic
                header.writeInt16BE(offsetX, 2);
                header.writeInt16BE(offsetY, 4);
                
                // Futuramente podemos enviar a flag autoRewind no byte 6 se necessário
                header[6] = autoRewind ? 1 : 0;
                const packet = Buffer.concat([header, pngBuffer]);

                const copies = item.copies || 1;
                for (let c = 0; c < copies; c++) {
                    await sendRaw(host, port, packet);
                    // Delay para evitar colisão de Date.now() no print-bridge e 
                    // não sobrecarregar o Windows com processos do PowerShell simultâneos
                    if (copies > 1 || items.length > 1) {
                        await new Promise(resolve => setTimeout(resolve, 300));
                    }
                }

                results.push({ item: item.itemId, ok: true, copies });
            } catch (err) {
                console.error(`Erro ao imprimir item ${item.itemId}:`, err);
                results.push({ item: item.itemId, ok: false, error: err.message });
            }
        }

        const allOk = results.every(r => r.ok);
        res.json({ ok: allOk, results });
    } catch (err) {
        console.error('[Labels] POST /print-canvas:', err);
        res.status(500).json({ error: 'Erro interno ao imprimir: ' + err.message });
    }
});

// ── GET /api/labels/download-agent ───────────────────────────────────────────
// Serve o print-agent.exe para download pelo usuário
router.get('/download-agent', (_req, res) => {
    const agentPath = path.resolve(__dirname, '../../client/public/Lynx-Print-Agent.ems');
    if (!fs.existsSync(agentPath)) {
        return res.status(404).json({ error: 'Lynx-Print-Agent.ems não encontrado no servidor.' });
    }
    res.download(agentPath, 'Lynx-Print-Agent.ems');
});

module.exports = router;
