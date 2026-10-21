const express = require('express');
const router = express.Router();
const mysql = require('../services/mysqlService');
const ErpValidator = require('../services/erpValidationService');
const fs = require('fs');
const path = require('path');

// ── Drawing single source of truth: produtos_docs + server/uploads/docs ──
// The same table/files are used by the SINCO formulário (/engenharia/sinco/formulario).
const DOCS_DIR = path.join(__dirname, '../uploads/docs');
const DRAWING_EXTS = ['pdf', 'dwg', 'dxf'];
const docViewUrl = (filePath) => `/api/docs/view?path=${encodeURIComponent(filePath)}`;
const extOf = (name = '') => (String(name).split('?')[0].split('.').pop() || '').toLowerCase();

// Ensure per-line observation column on order items (idempotent)
(async () => {
    try {
        const [cols] = await mysql.query("SHOW COLUMNS FROM erp_pedidos_itens LIKE 'observacao'");
        if (!cols.length) {
            await mysql.query('ALTER TABLE erp_pedidos_itens ADD COLUMN observacao TEXT NULL');
            console.log('✅ [ERP] Coluna erp_pedidos_itens.observacao adicionada.');
        }
    } catch (err) {
        console.warn('⚠️ [ERP] Falha ao garantir coluna observacao:', err.message);
    }
})();

// Order lifecycle: orcamento -> pedido (requires customer PO + attachment) | cancelado
const STATUS_PEDIDO = ['orcamento', 'pedido', 'cancelado'];
const PEDIDO_ANEXOS_DIR = path.join(__dirname, '../uploads/pedidos_anexos');

(async () => {
    try {
        const [cols] = await mysql.query("SHOW COLUMNS FROM erp_pedidos_venda LIKE 'pedido_cliente'");
        if (!cols.length) {
            await mysql.query('ALTER TABLE erp_pedidos_venda ADD COLUMN pedido_cliente VARCHAR(60) NULL');
            console.log('✅ [ERP] Coluna erp_pedidos_venda.pedido_cliente adicionada.');
        }
        await mysql.query(`
            CREATE TABLE IF NOT EXISTS erp_pedidos_anexos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                IdEmpresa INT NOT NULL,
                pedido_numero VARCHAR(30) NOT NULL,
                nome_original VARCHAR(255) NOT NULL,
                caminho VARCHAR(500) NOT NULL,
                tamanho INT NULL,
                mime VARCHAR(150) NULL,
                created_by VARCHAR(100) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_pedido (IdEmpresa, pedido_numero)
            )
        `);
        // Legacy statuses collapse into the new 3-state lifecycle
        await mysql.query("UPDATE erp_pedidos_venda SET status = 'orcamento' WHERE status IS NULL OR status IN ('', 'aberto')");
        await mysql.query("UPDATE erp_pedidos_venda SET status = 'pedido' WHERE status IN ('faturado', 'em_producao')");
    } catch (err) {
        console.warn('⚠️ [ERP] Falha ao preparar status/anexos de pedidos:', err.message);
    }
})();

// Ensure pasta_servidor on erp_produtos and create erp_config_produtos table (Multi-Tenant)
(async () => {
    try {
        const [cols] = await mysql.query("SHOW COLUMNS FROM erp_produtos LIKE 'pasta_servidor'");
        if (!cols.length) {
            await mysql.query('ALTER TABLE erp_produtos ADD COLUMN pasta_servidor VARCHAR(255) NULL');
            console.log('✅ [ERP] Coluna erp_produtos.pasta_servidor adicionada.');
        }
        await mysql.query(`
            CREATE TABLE IF NOT EXISTS erp_config_produtos (
                IdEmpresa INT NOT NULL PRIMARY KEY,
                diretorio_raiz_produtos VARCHAR(255) NULL,
                padrao_subpasta VARCHAR(100) DEFAULT '{CODIGO_PRODUTO}',
                criar_pasta_automatica TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
    } catch (err) {
        console.warn('⚠️ [ERP] Falha ao preparar pasta_servidor/erp_config_produtos:', err.message);
    }
})();

const multer = require('multer');
const uploadPedidoAnexos = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const dir = path.join(PEDIDO_ANEXOS_DIR, String(getTenantId(req) || 1));
            fs.mkdirSync(dir, { recursive: true });
            cb(null, dir);
        },
        filename: (req, file, cb) => {
            const original = Buffer.from(file.originalname, 'latin1').toString('utf8');
            file.originalUtf8 = original;
            const safe = original.replace(/[^\w.\-]+/g, '_').slice(-120);
            cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}-${safe}`);
        }
    }),
    limits: { fileSize: 30 * 1024 * 1024, files: 20 }
});

/**
 * Persists a base64 drawing uploaded from the product registration into produtos_docs
 * and returns the values to store on erp_produtos (a viewer URL instead of base64).
 */
async function syncDesenhoDoc(codigo, desenho_url, desenho_nome, desenho_tipo) {
    if (!desenho_url || !String(desenho_url).startsWith('data:')) {
        return { desenho_url: desenho_url || null, desenho_nome: desenho_nome || null, desenho_tipo: desenho_tipo || null };
    }
    const base64 = String(desenho_url).split(',')[1] || '';
    const tipo = (desenho_tipo || extOf(desenho_nome) || 'pdf').toLowerCase();
    const nomeOriginal = desenho_nome || `${codigo}.${tipo}`;
    const cleanName = nomeOriginal.replace(/[^a-zA-Z0-9._-]/g, '_');
    if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });
    const filePath = path.join(DOCS_DIR, `${Date.now()}-${Math.round(Math.random() * 1e4)}-${cleanName}`);
    fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));

    await mysql.query(
        'INSERT INTO produtos_docs (produto_codigo, titulo, url_arquivo, tipo) VALUES (?, ?, ?, ?)',
        [codigo, nomeOriginal, filePath, 'Desenho']
    );
    return { desenho_url: docViewUrl(filePath), desenho_nome: nomeOriginal, desenho_tipo: tipo };
}

/**
 * Converte automaticamente o caminho ou URL de um arquivo de desenho para extensão .pdf
 * Preserva o caminho original no servidor e substitui qualquer extensão (.dwg, .dxf, .step, etc.) por .pdf
 */
function convertToPdfPath(filePathOrUrl) {
    if (!filePathOrUrl) return null;
    const str = String(filePathOrUrl).trim();
    if (!str || str.startsWith('data:')) return null;
    if (/\.pdf([?#].*)?$/i.test(str)) return str;
    return str.replace(/\.[a-zA-Z0-9]+([?#].*)?$/, '.pdf');
}

/** Overlays the latest drawing from produtos_docs onto product rows. */
async function attachDesenhos(rows) {
    const codigos = [...new Set(rows.map(r => String(r.codigo || '').trim()).filter(Boolean))];
    if (!codigos.length) return rows;
    const [docs] = await mysql.query(
        `SELECT TRIM(produto_codigo) AS produto_codigo, titulo, url_arquivo
         FROM produtos_docs
         WHERE TRIM(produto_codigo) IN (?)
         ORDER BY created_at DESC, id DESC`,
        [codigos]
    );
    const latest = {};
    for (const d of docs) {
        const tipo = extOf(d.url_arquivo);
        if (!DRAWING_EXTS.includes(tipo) || latest[d.produto_codigo]) continue;
        latest[d.produto_codigo] = { desenho_url: docViewUrl(d.url_arquivo), desenho_nome: d.titulo, desenho_tipo: tipo };
    }
    return rows.map(r => {
        const doc = latest[String(r.codigo || '').trim()];
        return doc ? { ...r, ...doc } : r;
    });
}

/**
 * Helper para extrair o IdEmpresa (Tenant) de forma segura:
 * - Se SuperAdmin sem impersonation: retorna null (acesso global irrestrito)
 * - Se empresa selecionada ou usuário comum: retorna o IdEmpresa do tenant ativo
 */
function getTenantId(req) {
    if (req.tenantId !== undefined && req.tenantId !== null) {
        return req.tenantId;
    }
    if (req.isSuperAdmin && !req.headers['x-tenant-override'] && !req.query.tenant_id) {
        return null;
    }
    return req.user?.IdEmpresa || 1;
}

// 1. Dashboard / Estatísticas do ERP Nativo (100% MySQL - Paralelizado via Promise.all)
router.get('/stats', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const whereEmpresa = tenantId ? ' WHERE IdEmpresa = ?' : '';
        const params = tenantId ? [tenantId] : [];
        const opsWhere = tenantId 
            ? ' WHERE IdEmpresa = ? AND status != "cancelada"' 
            : ' WHERE status != "cancelada"';

        const paWhere = tenantId ? ' WHERE IdEmpresa = ? AND tipo = "PA"' : ' WHERE tipo = "PA"';
        const piWhere = tenantId ? ' WHERE IdEmpresa = ? AND tipo = "PI"' : ' WHERE tipo = "PI"';
        const mpWhere = tenantId ? ' WHERE IdEmpresa = ? AND tipo = "MP"' : ' WHERE tipo = "MP"';

        const [
            [[prod]],
            [[prodPA]],
            [[prodPI]],
            [[prodMP]],
            [[cli]],
            [[forn]],
            [[ped]],
            [[ops]]
        ] = await Promise.all([
            mysql.query(`SELECT COUNT(*) as total FROM erp_produtos${whereEmpresa}`, params),
            mysql.query(`SELECT COUNT(*) as total FROM erp_produtos${paWhere}`, params),
            mysql.query(`SELECT COUNT(*) as total FROM erp_produtos${piWhere}`, params),
            mysql.query(`SELECT COUNT(*) as total FROM erp_produtos${mpWhere}`, params),
            mysql.query(`SELECT COUNT(*) as total FROM erp_clientes${whereEmpresa}`, params),
            mysql.query(`SELECT COUNT(*) as total FROM erp_fornecedores${whereEmpresa}`, params),
            mysql.query(`SELECT COUNT(*) as total FROM erp_pedidos_venda${whereEmpresa}`, params),
            mysql.query(`SELECT COUNT(*) as total FROM erp_ordens_producao${opsWhere}`, params)
        ]);

        res.json({
            produtos: prod?.total || 0,
            pa: prodPA?.total || 0,
            pi: prodPI?.total || 0,
            mp: prodMP?.total || 0,
            clientes: cli?.total || 0,
            fornecedores: forn?.total || 0,
            pedidos: ped?.total || 0,
            ops_ativas: ops?.total || 0
        });
    } catch (err) {
        console.error('Erro em /api/erp/stats:', err);
        res.status(500).json({ error: 'Erro ao buscar estatísticas do ERP', detail: err.message });
    }
});

// 1.1 PRODUTOS: Próximo código automático no padrão Protheus com base no prefixo (mínimo 4 dígitos)
router.get('/produtos/proximo-codigo', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        let { prefixo = '', tipo = 'PA' } = req.query;
        prefixo = (prefixo || '').trim().toUpperCase().replace(/[-_ ]+$/, '');
        if (!prefixo) {
            if (tipo === 'PA') prefixo = 'SCL';
            else if (tipo === 'MP') prefixo = 'MPT';
            else if (tipo === 'PI') prefixo = 'MT2';
            else if (tipo === 'SV') prefixo = 'SRV';
            else if (tipo === 'EM') prefixo = 'EMB';
            else if (tipo === 'ME') prefixo = 'REV';
            else prefixo = tipo.toUpperCase();
        }

        const prefixoComHifen = `${prefixo}-`;

        // 1. Busca o maior número sequencial existente para esse prefixo exato na empresa
        let where = " WHERE codigo LIKE ? AND codigo REGEXP ?";
        let params = [`${prefixoComHifen}%`, `^${prefixo}-[0-9]+$`];
        if (tenantId) {
            where = " WHERE IdEmpresa = ? AND codigo LIKE ? AND codigo REGEXP ?";
            params = [tenantId, `${prefixoComHifen}%`, `^${prefixo}-[0-9]+$`];
        }

        const [rows] = await mysql.query(
            `SELECT MAX(CAST(SUBSTRING_INDEX(codigo, '-', -1) AS UNSIGNED)) as max_num FROM erp_produtos${where}`,
            params
        );

        let proximoNumero = (rows[0]?.max_num || 0) + 1;

        // 2. Mínimo de 6 dígitos sequenciais (ex: 000001, 000002, 000045)
        let seqStr = String(proximoNumero).padStart(Math.max(6, String(proximoNumero).length), '0');
        let proximoCodigo = `${prefixoComHifen}${seqStr}`;

        // 3. Garantia de unicidade / colisão ExistChav (Protheus) na empresa
        while (true) {
            let existsQuery = 'SELECT id FROM erp_produtos WHERE codigo = ? LIMIT 1';
            let existsParams = [proximoCodigo];
            if (tenantId) {
                existsQuery = 'SELECT id FROM erp_produtos WHERE IdEmpresa = ? AND codigo = ? LIMIT 1';
                existsParams = [tenantId, proximoCodigo];
            }
            const [[exists]] = await mysql.query(existsQuery, existsParams);
            if (!exists) break;
            proximoNumero++;
            seqStr = String(proximoNumero).padStart(Math.max(6, String(proximoNumero).length), '0');
            proximoCodigo = `${prefixoComHifen}${seqStr}`;
        }

        res.json({ 
            proximoCodigo, 
            proximo_codigo: proximoCodigo, 
            prefixo, 
            proximoNumero, 
            proximo_numero: proximoNumero 
        });
    } catch (err) {
        console.error('Erro ao gerar próximo código no padrão Protheus:', err);
        res.status(500).json({ error: 'Erro ao gerar código automático de produto' });
    }
});

// 2. PRODUTOS: Lookup com filtros avançados para autocomplete e modal de seleção
router.get('/produtos/lookup', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { 
            q = '', 
            tipo = '', 
            grupo = '', 
            unidade = '',
            armazem = '',
            com_preco = '',
            preco_min = '',
            preco_max = '',
            modo_busca = 'contem', // 'contem', 'comeca', 'exato'
            ordenar = 'codigo_asc',
            limit = 50, 
            offset = 0,
            format = ''
        } = req.query;

        let baseQuery = " FROM erp_produtos WHERE status = 'ativo'";
        const params = [];
        if (tenantId) {
            baseQuery += ' AND IdEmpresa = ?';
            params.push(tenantId);
        }

        // Filtro Textual Inteligente
        if (q && q.trim()) {
            const trimmed = q.trim();
            if (modo_busca === 'exato') {
                baseQuery += ' AND (codigo = ? OR ncm = ?)';
                params.push(trimmed, trimmed);
            } else if (modo_busca === 'comeca') {
                const termStart = `${trimmed}%`;
                baseQuery += ' AND (codigo LIKE ? OR descricao LIKE ?)';
                params.push(termStart, termStart);
            } else {
                // Multi-term: cada palavra digitada é buscada conjuntamente
                const words = trimmed.split(/\s+/).filter(w => w.length > 0);
                for (const word of words) {
                    const term = `%${word}%`;
                    baseQuery += ' AND (codigo LIKE ? OR descricao LIKE ? OR ncm LIKE ? OR b1_xproc1 LIKE ? OR b1_xrevm LIKE ? OR b1_xrevc LIKE ?)';
                    params.push(term, term, term, term, term, term);
                }
            }
        }

        // Filtro por Tipo de Produto (B1_TIPO)
        if (tipo && tipo.trim()) {
            const tiposArray = tipo.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
            if (tiposArray.length === 1) {
                baseQuery += ' AND tipo = ?';
                params.push(tiposArray[0]);
            } else if (tiposArray.length > 1) {
                baseQuery += ` AND tipo IN (${tiposArray.map(() => '?').join(',')})`;
                params.push(...tiposArray);
            }
        }

        // Filtro por Grupo / Prefixo
        if (grupo && grupo.trim()) {
            const g = grupo.trim().toUpperCase();
            baseQuery += ' AND (codigo LIKE CONCAT(?, "-%") OR codigo LIKE CONCAT(?, " %") OR codigo LIKE CONCAT(?, "%"))';
            params.push(g, g, g);
        }

        // Filtro por Unidade de Medida (B1_UM)
        if (unidade && unidade.trim()) {
            baseQuery += ' AND unidade_medida = ?';
            params.push(unidade.trim().toUpperCase());
        }

        // Filtro por Armazém Padrão (B1_LOCPAD)
        if (armazem && armazem.trim()) {
            baseQuery += ' AND armazem_padrao = ?';
            params.push(armazem.trim());
        }

        // Filtro por Preço Comercial
        if (com_preco === 'true' || com_preco === '1') {
            baseQuery += ' AND preco_venda > 0';
        }
        if (preco_min !== undefined && preco_min !== '') {
            baseQuery += ' AND preco_venda >= ?';
            params.push(parseFloat(preco_min) || 0);
        }
        if (preco_max !== undefined && preco_max !== '') {
            baseQuery += ' AND preco_venda <= ?';
            params.push(parseFloat(preco_max) || 0);
        }

        // Total de registros para paginação
        const [countRows] = await mysql.query(`SELECT COUNT(*) as total ${baseQuery}`, params);
        const total = countRows[0]?.total || 0;
        res.setHeader('X-Total-Count', total);

        // Ordenação
        let orderClause = ' ORDER BY codigo ASC';
        if (ordenar === 'codigo_desc') orderClause = ' ORDER BY codigo DESC';
        else if (ordenar === 'descricao_asc') orderClause = ' ORDER BY descricao ASC';
        else if (ordenar === 'descricao_desc') orderClause = ' ORDER BY descricao DESC';
        else if (ordenar === 'preco_desc') orderClause = ' ORDER BY preco_venda DESC, codigo ASC';
        else if (ordenar === 'preco_asc') orderClause = ' ORDER BY preco_venda ASC, codigo ASC';

        const parsedLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 200);
        const parsedOffset = Math.max(parseInt(offset) || 0, 0);

        const selectQuery = `
            SELECT codigo, descricao, tipo, unidade_medida, ncm, peso_liquido, preco_venda, armazem_padrao,
                   desenho_url, desenho_nome, desenho_tipo
            ${baseQuery}
            ${orderClause}
            LIMIT ? OFFSET ?
        `;
        const queryParams = [...params, parsedLimit, parsedOffset];
        let [rows] = await mysql.query(selectQuery, queryParams);
        try {
            rows = await attachDesenhos(rows);
        } catch (docErr) {
            console.warn('[ERP] Lookup: falha ao anexar desenhos:', docErr.message);
        }
        // Base64 drawings must never travel in list payloads
        rows = rows.map(r => (String(r.desenho_url || '').startsWith('data:') ? { ...r, desenho_url: null } : r));

        if (format === 'paged') {
            return res.json({
                itens: rows,
                total,
                page: Math.floor(parsedOffset / parsedLimit) + 1,
                limit: parsedLimit,
                pages: Math.ceil(total / parsedLimit) || 1
            });
        }

        res.json(rows);
    } catch (err) {
        console.error('Erro em /api/erp/produtos/lookup:', err);
        res.status(500).json({ error: 'Erro na busca de produtos' });
    }
});

// 2.1 PRODUTOS: Listagem de Grupos/Prefixos disponíveis para filtros
router.get('/produtos/grupos', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        let where = " WHERE codigo LIKE '%-%'";
        const params = [];
        if (tenantId) {
            where = " WHERE IdEmpresa = ? AND codigo LIKE '%-%'";
            params.push(tenantId);
        }

        const [rows] = await mysql.query(`
            SELECT TRIM(SUBSTRING_INDEX(codigo, '-', 1)) as sigla, COUNT(*) as total
            FROM erp_produtos
            ${where}
            GROUP BY sigla
            ORDER BY total DESC
            LIMIT 40
        `, params);
        res.json(rows);
    } catch (err) {
        console.error('Erro em /api/erp/produtos/grupos:', err);
        res.status(500).json({ error: 'Erro ao listar grupos de produtos' });
    }
});

// 2.9 CORES DE PRODUTOS (Codificação de Aço / Matérias-Primas)
router.get('/produtos/cores', async (req, res) => {
    try {
        const tenantId = getTenantId(req) || 1;
        let [rows] = await mysql.query(
            'SELECT * FROM erp_produtos_cores WHERE IdEmpresa = ? AND ativo = 1 ORDER BY codigo ASC',
            [tenantId]
        );
        if (!rows || rows.length === 0) {
            const { seedSteelColors } = require('../services/tenantSeedService');
            await seedSteelColors(tenantId, false);
            [rows] = await mysql.query(
                'SELECT * FROM erp_produtos_cores WHERE IdEmpresa = ? AND ativo = 1 ORDER BY codigo ASC',
                [tenantId]
            );
        }
        res.json(rows || []);
    } catch (err) {
        console.error('Erro em GET /api/erp/produtos/cores:', err);
        res.status(500).json({ error: 'Erro ao buscar cores de produtos', detail: err.message });
    }
});

router.post('/produtos/cores/restaurar-padroes', async (req, res) => {
    try {
        const tenantId = getTenantId(req) || 1;
        const { seedSteelColors } = require('../services/tenantSeedService');
        await seedSteelColors(tenantId, true);
        const [rows] = await mysql.query(
            'SELECT * FROM erp_produtos_cores WHERE IdEmpresa = ? AND ativo = 1 ORDER BY codigo ASC',
            [tenantId]
        );
        res.json({ message: 'Padrão industrial de cores de aço restaurado com sucesso!', cores: rows });
    } catch (err) {
        console.error('Erro em POST /api/erp/produtos/cores/restaurar-padroes:', err);
        res.status(500).json({ error: 'Erro ao restaurar cores padrão', detail: err.message });
    }
});

router.post('/produtos/cores', async (req, res) => {
    try {
        const tenantId = getTenantId(req) || 1;
        const { codigo, significado, tipo_cor = 'solida', cor_primaria, cor_secundaria, descricao } = req.body;
        if (!codigo || !significado || !cor_primaria) {
            return res.status(400).json({ error: 'Código, significado e cor primária são obrigatórios.' });
        }
        const [result] = await mysql.query(`
            INSERT INTO erp_produtos_cores (IdEmpresa, codigo, significado, tipo_cor, cor_primaria, cor_secundaria, descricao, ativo)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        `, [
            tenantId,
            codigo.trim().toUpperCase(),
            significado.trim(),
            tipo_cor === 'bicolor' ? 'bicolor' : 'solida',
            cor_primaria.trim(),
            tipo_cor === 'bicolor' && cor_secundaria ? cor_secundaria.trim() : null,
            descricao ? descricao.trim() : null
        ]);
        res.status(201).json({ id: result.insertId, message: 'Cor cadastrada com sucesso!' });
    } catch (err) {
        console.error('Erro em POST /api/erp/produtos/cores:', err);
        res.status(500).json({ error: 'Erro ao cadastrar cor', detail: err.message });
    }
});

router.put('/produtos/cores/:id', async (req, res) => {
    try {
        const tenantId = getTenantId(req) || 1;
        const { id } = req.params;
        const { codigo, significado, tipo_cor = 'solida', cor_primaria, cor_secundaria, descricao, ativo = 1 } = req.body;
        await mysql.query(`
            UPDATE erp_produtos_cores SET
                codigo = COALESCE(?, codigo),
                significado = COALESCE(?, significado),
                tipo_cor = ?,
                cor_primaria = COALESCE(?, cor_primaria),
                cor_secundaria = ?,
                descricao = ?,
                ativo = ?
            WHERE id = ? AND IdEmpresa = ?
        `, [
            codigo ? codigo.trim().toUpperCase() : null,
            significado ? significado.trim() : null,
            tipo_cor === 'bicolor' ? 'bicolor' : 'solida',
            cor_primaria ? cor_primaria.trim() : null,
            tipo_cor === 'bicolor' && cor_secundaria ? cor_secundaria.trim() : null,
            descricao !== undefined ? (descricao ? descricao.trim() : null) : null,
            ativo !== undefined ? (ativo ? 1 : 0) : 1,
            parseInt(id, 10),
            tenantId
        ]);
        res.json({ message: 'Cor atualizada com sucesso!' });
    } catch (err) {
        console.error('Erro em PUT /api/erp/produtos/cores/:id:', err);
        res.status(500).json({ error: 'Erro ao atualizar cor', detail: err.message });
    }
});

router.delete('/produtos/cores/:id', async (req, res) => {
    try {
        const tenantId = getTenantId(req) || 1;
        const { id } = req.params;
        await mysql.query('UPDATE erp_produtos SET cor_id = NULL WHERE cor_id = ? AND IdEmpresa = ?', [id, tenantId]);
        await mysql.query('DELETE FROM erp_produtos_cores WHERE id = ? AND IdEmpresa = ?', [id, tenantId]);
        res.json({ message: 'Cor excluída e desvinculada dos produtos com sucesso!' });
    } catch (err) {
        console.error('Erro em DELETE /api/erp/produtos/cores/:id:', err);
        res.status(500).json({ error: 'Erro ao excluir cor', detail: err.message });
    }
});

// 3. PRODUTOS: Listar com busca e paginação
router.get('/produtos', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { search = '', tipo = '', cor_id = '', limit = 50, offset = 0 } = req.query;
        let query = `
            SELECT p.*, 
                   c.codigo as cor_codigo,
                   c.significado as cor_significado,
                   c.tipo_cor as cor_tipo,
                   c.cor_primaria,
                   c.cor_secundaria,
                   EXISTS(
                       SELECT 1 FROM erp_estruturas_bom 
                       WHERE produto_pai_codigo = p.codigo 
                       ${tenantId ? 'AND IdEmpresa = p.IdEmpresa' : ''} 
                       LIMIT 1
                   ) as tem_estrutura
            FROM erp_produtos p
            LEFT JOIN erp_produtos_cores c ON (p.cor_id = c.id)
            WHERE 1=1
        `;
        const params = [];

        if (tenantId) {
            query += ' AND p.IdEmpresa = ?';
            params.push(tenantId);
        }

        if (cor_id) {
            if (cor_id === 'sem_cor') {
                query += ' AND p.cor_id IS NULL';
            } else {
                query += ' AND p.cor_id = ?';
                params.push(parseInt(cor_id, 10));
            }
        }

        if (search) {
            const term = `%${search}%`;
            query += ' AND (p.codigo LIKE ? OR p.descricao LIKE ? OR p.ncm LIKE ? OR p.b1_xproc1 LIKE ? OR p.b1_xrevm LIKE ? OR p.b1_xrevc LIKE ? OR c.codigo LIKE ? OR c.significado LIKE ?)';
            params.push(term, term, term, term, term, term, term, term);
        }
        if (tipo) {
            query += ' AND UPPER(TRIM(p.tipo)) = UPPER(TRIM(?))';
            params.push(tipo);
        }

        query += ' ORDER BY p.id DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await mysql.query(query, params);
        let result = rows;
        try {
            result = await attachDesenhos(rows);
        } catch (docErr) {
            console.warn('[ERP] Falha ao anexar desenhos de produtos_docs:', docErr.message);
        }
        res.json(result);
    } catch (err) {
        console.error('Erro em GET /api/erp/produtos:', err);
        res.status(500).json({ error: 'Erro ao listar produtos', detail: err.message });
    }
});

// 4. PRODUTOS: Criar Novo Produto com Validação
router.post('/produtos', async (req, res) => {
    try {
        const tenantId = getTenantId(req) || 1;
        const validacao = ErpValidator.validarProduto(req.body);
        if (!validacao.valido) {
            return res.status(400).json({ error: 'Falha na validação do produto', erros: validacao.erros });
        }

        const parseNum = (v) => {
            if (v === null || v === undefined || v === '') return 0;
            const s = String(v).trim().replace(/\s/g, '').replace(',', '.');
            const n = parseFloat(s);
            return isNaN(n) ? 0 : n;
        };

        const {
            codigo, descricao, tipo = 'PA', unidade_medida = 'UN', ncm = '',
            armazem_padrao = '01', peso_liquido = 0, peso_bruto = 0,
            custo_standard = 0, preco_venda = 0, lead_time_dias = 0,
            foto_url = null, desenho_url = null, desenho_nome = null, desenho_tipo = null,
            b1_xrevm = '0', b1_xproc1 = '', b1_xrevc = '0', cor_id = null,
            cliente_codigo = null, cliente_loja = '01', cliente_nome = null,
            pasta_servidor = null
        } = req.body;

        const codLimpo = codigo.trim().toUpperCase();
        const revProd = String(b1_xrevm || '0').trim();
        const desCli = String(b1_xproc1 || '').trim();
        const revCli = String(b1_xrevc || '0').trim();
        const corId = (cor_id !== undefined && cor_id !== '' && cor_id !== null) ? parseInt(cor_id, 10) : null;
        const cliCod = cliente_codigo ? String(cliente_codigo).trim() : null;
        const cliLoj = cliente_loja ? String(cliente_loja).trim() : '01';
        const cliNom = cliente_nome ? String(cliente_nome).trim() : null;

        // Auto-resolução da pasta do produto no servidor (se não informada)
        let pastaServidorFinal = String(pasta_servidor || '').trim();
        if (!pastaServidorFinal) {
            try {
                const [[cfg]] = await mysql.query(
                    'SELECT diretorio_raiz_produtos, padrao_subpasta, criar_pasta_automatica FROM erp_config_produtos WHERE IdEmpresa = ?',
                    [tenantId]
                );
                if (cfg?.diretorio_raiz_produtos) {
                    const sep = cfg.diretorio_raiz_produtos.includes('/') ? '/' : '\\';
                    const base = cfg.diretorio_raiz_produtos.replace(/[/\\]+$/, '');
                    const sub = (cfg.padrao_subpasta || '{CODIGO_PRODUTO}').replace(/\{CODIGO_PRODUTO\}/g, codLimpo);
                    pastaServidorFinal = `${base}${sep}${sub}`;
                    if (cfg.criar_pasta_automatica && process.platform === 'win32' && !fs.existsSync(pastaServidorFinal)) {
                        fs.mkdirSync(pastaServidorFinal, { recursive: true });
                    }
                }
            } catch (cfgErr) {
                console.warn('[ERP] Erro ao auto-gerar pasta do produto:', cfgErr.message);
            }
        }

        // Verificar duplicidade no escopo da empresa
        const [existente] = await mysql.query('SELECT id FROM erp_produtos WHERE IdEmpresa = ? AND codigo = ?', [tenantId, codLimpo]);
        if (existente.length > 0) {
            return res.status(400).json({ error: `O produto com código "${codLimpo}" já existe nesta empresa.` });
        }

        const desenho = await syncDesenhoDoc(codLimpo, desenho_url, desenho_nome, desenho_tipo);

        const [result] = await mysql.query(`
            INSERT INTO erp_produtos (
                codigo, descricao, tipo, unidade_medida, ncm, armazem_padrao,
                peso_liquido, peso_bruto, custo_standard, preco_venda, lead_time_dias,
                foto_url, desenho_url, desenho_nome, desenho_tipo, b1_xrevm, b1_xproc1, b1_xrevc, 
                cliente_codigo, cliente_loja, cliente_nome,
                IdEmpresa, cor_id, pasta_servidor
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            codLimpo, descricao.trim(), tipo, unidade_medida, ncm,
            armazem_padrao, parseNum(peso_liquido), parseNum(peso_bruto), parseNum(custo_standard),
            parseNum(preco_venda), parseInt(lead_time_dias, 10) || 0,
            foto_url || null, desenho.desenho_url, desenho.desenho_nome, desenho.desenho_tipo,
            revProd, desCli, revCli,
            cliCod, cliLoj, cliNom,
            tenantId, corId, pastaServidorFinal || null
        ]);

        // Sincroniza também no espelho Protheus sb1010
        try {
            await mysql.query(`
                INSERT INTO sb1010 (
                    b1_filial, b1_cod, b1_desc, b1_tipo, b1_um, b1_locpad, b1_posipi,
                    b1_peso, b1_pesbru, b1_custd, b1_prv1, b1_revatu, b1_xrevm, b1_xproc1, b1_xrevc,
                    d_e_l_e_t_, IdEmpresa
                ) VALUES (
                    '0101', ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, '00', ?, ?, ?,
                    '', ?
                ) ON DUPLICATE KEY UPDATE
                    b1_desc = VALUES(b1_desc),
                    b1_tipo = VALUES(b1_tipo),
                    b1_um = VALUES(b1_um),
                    b1_locpad = VALUES(b1_locpad),
                    b1_posipi = VALUES(b1_posipi),
                    b1_peso = VALUES(b1_peso),
                    b1_pesbru = VALUES(b1_pesbru),
                    b1_custd = VALUES(b1_custd),
                    b1_prv1 = VALUES(b1_prv1),
                    b1_xrevm = VALUES(b1_xrevm),
                    b1_xproc1 = VALUES(b1_xproc1),
                    b1_xrevc = VALUES(b1_xrevc)
            `, [
                codLimpo, descricao.trim(), tipo, unidade_medida, armazem_padrao, ncm,
                parseNum(peso_liquido), parseNum(peso_bruto), parseNum(custo_standard), parseNum(preco_venda),
                revProd, desCli, revCli, tenantId
            ]);
        } catch (sb1Err) {
            console.warn('[ERP] Erro ao sincronizar SB1010:', sb1Err.message);
        }

        // Sincroniza sz1010 oficial se informado cliente ou desenho do cliente
        if (desCli || cliCod) {
            try {
                const zCli = cliCod || '000001';
                const zLoj = cliLoj || '01';
                const zNom = cliNom || '';
                await mysql.query(`
                    INSERT INTO sz1010 (z1_filial, z1_cliente, z1_loja, z1_nomecli, z1_produto, z1_codcli, z1_desccli, z1_revisao, z1_tes, d_e_l_e_t_, IdEmpresa)
                    VALUES ('0101', ?, ?, ?, ?, ?, '', ?, '', '', ?)
                    ON DUPLICATE KEY UPDATE 
                        z1_cliente = VALUES(z1_cliente),
                        z1_loja = VALUES(z1_loja),
                        z1_nomecli = VALUES(z1_nomecli),
                        z1_codcli = VALUES(z1_codcli),
                        z1_revisao = VALUES(z1_revisao)
                `, [zCli, zLoj, zNom, codLimpo, desCli, revCli, tenantId]);
            } catch (sz1Err) {
                console.warn('[ERP] Erro ao sincronizar SZ1010:', sz1Err.message);
            }
        }

        res.status(201).json({ id: result.insertId, codigo: codLimpo, message: 'Produto cadastrado com sucesso!' });
    } catch (err) {
        console.error('Erro em POST /api/erp/produtos:', err);
        res.status(500).json({ error: 'Erro ao criar produto', detail: err.message });
    }
});

// 4.1 PRODUTOS: Atualizar Produto existente
router.put('/produtos/:codigo', async (req, res) => {
    try {
        const tenantId = getTenantId(req) || 1;
        const { codigo } = req.params;
        const codLimpo = decodeURIComponent(codigo || '').trim().toUpperCase();
        const {
            descricao, tipo, unidade_medida, ncm, armazem_padrao,
            peso_liquido, peso_bruto, custo_standard, preco_venda, lead_time_dias,
            foto_url, desenho_url, desenho_nome, desenho_tipo, status,
            b1_xrevm, b1_xproc1, b1_xrevc, cor_id,
            cliente_codigo, cliente_loja, cliente_nome, pasta_servidor
        } = req.body;

        const parseNum = (v) => {
            if (v === null || v === undefined || v === '') return 0;
            const s = String(v).trim().replace(/\s/g, '').replace(',', '.');
            const n = parseFloat(s);
            return isNaN(n) ? 0 : n;
        };

        const revProd = b1_xrevm !== undefined ? String(b1_xrevm || '0').trim() : null;
        const desCli = b1_xproc1 !== undefined ? String(b1_xproc1 || '').trim() : null;
        const revCli = b1_xrevc !== undefined ? String(b1_xrevc || '0').trim() : null;
        const corIdProvided = cor_id !== undefined;
        const corIdVal = corIdProvided ? (cor_id ? parseInt(cor_id, 10) : null) : null;
        const cliCodProvided = cliente_codigo !== undefined;
        const cliCodVal = cliCodProvided ? (cliente_codigo ? String(cliente_codigo).trim() : null) : null;
        const cliLojProvided = cliente_loja !== undefined;
        const cliLojVal = cliLojProvided ? (cliente_loja ? String(cliente_loja).trim() : '01') : '01';
        const cliNomProvided = cliente_nome !== undefined;
        const cliNomVal = cliNomProvided ? (cliente_nome ? String(cliente_nome).trim() : null) : null;
        const pastaServidorProvided = pasta_servidor !== undefined;
        const pastaServidorVal = pastaServidorProvided ? (pasta_servidor ? String(pasta_servidor).trim() : null) : null;

        const desenho = await syncDesenhoDoc(codLimpo, desenho_url, desenho_nome, desenho_tipo);
        if (!desenho.desenho_url) {
            // Drawing removed in the registration: remove the drawing shown (latest in shared docs)
            const [docs] = await mysql.query(
                'SELECT id, url_arquivo FROM produtos_docs WHERE TRIM(produto_codigo) = ? ORDER BY created_at DESC, id DESC',
                [codLimpo]
            );
            const atual = docs.find(d => DRAWING_EXTS.includes(extOf(d.url_arquivo)));
            if (atual) await mysql.query('DELETE FROM produtos_docs WHERE id = ?', [atual.id]);
        }

        const [result] = await mysql.query(`
            UPDATE erp_produtos SET
                descricao = COALESCE(?, descricao),
                tipo = COALESCE(?, tipo),
                unidade_medida = COALESCE(?, unidade_medida),
                ncm = COALESCE(?, ncm),
                armazem_padrao = COALESCE(?, armazem_padrao),
                peso_liquido = ?,
                peso_bruto = ?,
                custo_standard = ?,
                preco_venda = ?,
                lead_time_dias = COALESCE(?, lead_time_dias),
                foto_url = ?,
                desenho_url = ?,
                desenho_nome = ?,
                desenho_tipo = ?,
                status = COALESCE(?, status),
                b1_xrevm = COALESCE(?, b1_xrevm),
                b1_xproc1 = COALESCE(?, b1_xproc1),
                b1_xrevc = COALESCE(?, b1_xrevc),
                cor_id = CASE WHEN ? = 1 THEN ? ELSE cor_id END,
                cliente_codigo = CASE WHEN ? = 1 THEN ? ELSE cliente_codigo END,
                cliente_loja = CASE WHEN ? = 1 THEN ? ELSE cliente_loja END,
                cliente_nome = CASE WHEN ? = 1 THEN ? ELSE cliente_nome END,
                pasta_servidor = CASE WHEN ? = 1 THEN ? ELSE pasta_servidor END
            WHERE (codigo = ? OR id = ?) AND IdEmpresa = ?
        `, [
            descricao ? descricao.trim() : null,
            tipo || null,
            unidade_medida || null,
            ncm || null,
            armazem_padrao || null,
            parseNum(peso_liquido),
            parseNum(peso_bruto),
            parseNum(custo_standard),
            parseNum(preco_venda),
            lead_time_dias !== undefined ? parseInt(lead_time_dias, 10) : null,
            foto_url || null,
            desenho.desenho_url,
            desenho.desenho_nome,
            desenho.desenho_tipo,
            status || null,
            revProd,
            desCli,
            revCli,
            corIdProvided ? 1 : 0,
            corIdVal,
            cliCodProvided ? 1 : 0,
            cliCodVal,
            cliLojProvided ? 1 : 0,
            cliLojVal,
            cliNomProvided ? 1 : 0,
            cliNomVal,
            pastaServidorProvided ? 1 : 0,
            pastaServidorVal,
            codLimpo,
            isNaN(parseInt(codLimpo, 10)) ? -1 : parseInt(codLimpo, 10),
            tenantId
        ]);

        if (result.affectedRows === 0) {
            await mysql.query(`
                UPDATE erp_produtos SET
                    descricao = COALESCE(?, descricao),
                    tipo = COALESCE(?, tipo),
                    unidade_medida = COALESCE(?, unidade_medida),
                    ncm = COALESCE(?, ncm),
                    armazem_padrao = COALESCE(?, armazem_padrao),
                    peso_liquido = ?,
                    peso_bruto = ?,
                    custo_standard = ?,
                    preco_venda = ?,
                    lead_time_dias = COALESCE(?, lead_time_dias),
                    foto_url = ?,
                    desenho_url = ?,
                    desenho_nome = ?,
                    desenho_tipo = ?,
                    status = COALESCE(?, status),
                    b1_xrevm = COALESCE(?, b1_xrevm),
                    b1_xproc1 = COALESCE(?, b1_xproc1),
                    b1_xrevc = COALESCE(?, b1_xrevc),
                    cor_id = CASE WHEN ? = 1 THEN ? ELSE cor_id END
                WHERE codigo = ? OR id = ?
            `, [
                descricao ? descricao.trim() : null,
                tipo || null,
                unidade_medida || null,
                ncm || null,
                armazem_padrao || null,
                parseNum(peso_liquido),
                parseNum(peso_bruto),
                parseNum(custo_standard),
                parseNum(preco_venda),
                lead_time_dias !== undefined ? parseInt(lead_time_dias, 10) : null,
                foto_url || null,
                desenho.desenho_url,
                desenho.desenho_nome,
                desenho.desenho_tipo,
                status || null,
                revProd,
                desCli,
                revCli,
                corIdProvided ? 1 : 0,
                corIdVal,
                codLimpo,
                isNaN(parseInt(codLimpo, 10)) ? -1 : parseInt(codLimpo, 10)
            ]);
        }

        // Sincronizar também no SB1010
        try {
            await mysql.query(`
                UPDATE sb1010 SET
                    b1_desc = COALESCE(?, b1_desc),
                    b1_tipo = COALESCE(?, b1_tipo),
                    b1_um = COALESCE(?, b1_um),
                    b1_locpad = COALESCE(?, b1_locpad),
                    b1_posipi = COALESCE(?, b1_posipi),
                    b1_peso = ?,
                    b1_pesbru = ?,
                    b1_custd = ?,
                    b1_prv1 = ?,
                    b1_xrevm = COALESCE(?, b1_xrevm),
                    b1_xproc1 = COALESCE(?, b1_xproc1),
                    b1_xrevc = COALESCE(?, b1_xrevc)
                WHERE b1_cod = ?
            `, [
                descricao ? descricao.trim() : null,
                tipo || null,
                unidade_medida || null,
                armazem_padrao || null,
                ncm || null,
                parseNum(peso_liquido),
                parseNum(peso_bruto),
                parseNum(custo_standard),
                parseNum(preco_venda),
                revProd,
                desCli,
                revCli,
                codLimpo
            ]);
        } catch (sb1Err) {
            console.warn('[ERP] Erro ao sincronizar SB1010 no update:', sb1Err.message);
        }

        // Sincronizar em cascata para os pedidos de venda (sc6010 e erp_pedidos_itens)
        try {
            if (revProd !== null || desCli !== null || revCli !== null) {
                await mysql.query(`
                    UPDATE sc6010 SET
                        c6_xrevm = COALESCE(?, c6_xrevm),
                        c6_xproc1 = COALESCE(?, c6_xproc1),
                        c6_xrevc = COALESCE(?, c6_xrevc)
                    WHERE c6_produto = ?
                `, [revProd, desCli, revCli, codLimpo]);

                await mysql.query(`
                    UPDATE erp_pedidos_itens SET
                        c6_xrevm = COALESCE(?, c6_xrevm),
                        c6_xproc1 = COALESCE(?, c6_xproc1),
                        c6_xrevc = COALESCE(?, c6_xrevc)
                    WHERE produto_codigo = ?
                `, [revProd, desCli, revCli, codLimpo]);
            }
        } catch (ordersErr) {
            console.warn('[ERP] Erro ao sincronizar pedidos após alteração do produto:', ordersErr.message);
        }

        // Sincronizar sz1010 oficial se informado cliente ou desenho
        if (desCli !== null || cliCodProvided) {
            try {
                const [[sz1Exist]] = await mysql.query('SELECT r_e_c_n_o_, z1_cliente, z1_loja, z1_nomecli, z1_codcli, z1_revisao FROM sz1010 WHERE z1_produto = ? AND IdEmpresa = ? LIMIT 1', [codLimpo, tenantId]);
                const zCli = cliCodProvided ? (cliCodVal || '000001') : (sz1Exist?.z1_cliente || '000001');
                const zLoj = cliLojProvided ? (cliLojVal || '01') : (sz1Exist?.z1_loja || '01');
                const zNom = cliNomProvided ? (cliNomVal || '') : (sz1Exist?.z1_nomecli || '');
                const effectiveDesCli = desCli !== null ? desCli : (sz1Exist?.z1_codcli || '');
                const effectiveRevCli = revCli !== null ? revCli : (sz1Exist?.z1_revisao || '0');

                if (sz1Exist) {
                    await mysql.query(`
                        UPDATE sz1010 SET 
                            z1_cliente = ?, 
                            z1_loja = ?, 
                            z1_nomecli = ?, 
                            z1_codcli = ?, 
                            z1_revisao = ? 
                        WHERE r_e_c_n_o_ = ?
                    `, [zCli, zLoj, zNom, effectiveDesCli, effectiveRevCli, sz1Exist.r_e_c_n_o_]);
                } else if (effectiveDesCli || zCli) {
                    await mysql.query(`
                        INSERT INTO sz1010 (z1_filial, z1_cliente, z1_loja, z1_nomecli, z1_produto, z1_codcli, z1_desccli, z1_revisao, z1_tes, d_e_l_e_t_, IdEmpresa)
                        VALUES ('0101', ?, ?, ?, ?, ?, '', ?, '', '', ?)
                    `, [zCli, zLoj, zNom, codLimpo, effectiveDesCli, effectiveRevCli, tenantId]);
                }
            } catch (sz1Err) {
                console.warn('[ERP] Erro ao atualizar SZ1010:', sz1Err.message);
            }
        }

        res.json({ message: 'Produto atualizado com sucesso e refletido nos pedidos!' });
    } catch (err) {
        console.error('Erro em PUT /api/erp/produtos/:codigo:', err);
        res.status(500).json({ error: 'Erro ao atualizar produto', detail: err.message });
    }
});

// 5. CLIENTES: Lookup rápido para autocomplete nos pedidos
router.get('/clientes/lookup', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { q = '' } = req.query;
        const term = `%${q.trim()}%`;
        let where = ' WHERE (codigo LIKE ? OR razao_social LIKE ? OR nome_fantasia LIKE ? OR cnpj_cpf LIKE ?)';
        const params = [term, term, term, term];
        if (tenantId) {
            where = ' WHERE IdEmpresa = ? AND (codigo LIKE ? OR razao_social LIKE ? OR nome_fantasia LIKE ? OR cnpj_cpf LIKE ?)';
            params.unshift(tenantId);
        }
        const [rows] = await mysql.query(`
            SELECT codigo, loja, razao_social, nome_fantasia, cnpj_cpf, cidade, uf, status
            FROM erp_clientes
            ${where}
            ORDER BY razao_social ASC LIMIT 25
        `, params);
        res.json(rows);
    } catch (err) {
        console.error('Erro em /api/erp/clientes/lookup:', err);
        res.status(500).json({ error: 'Erro na busca de clientes' });
    }
});

// 5.1. CNPJ: Consulta de Dados Cadastrais via BrasilAPI
router.get('/cnpj/:cnpj', async (req, res) => {
    try {
        const cnpjLimpo = (req.params.cnpj || '').replace(/\D/g, '');
        if (cnpjLimpo.length !== 14) {
            return res.status(400).json({ error: 'CNPJ deve conter 14 dígitos' });
        }
        const axios = require('axios');
        const response = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`, {
            timeout: 10000,
            headers: { 'User-Agent': 'SINCO-Suite/1.0' }
        });
        res.json(response.data);
    } catch (err) {
        console.warn(`[BrasilAPI] Erro ao consultar CNPJ ${req.params.cnpj}:`, err.message);
        const status = err.response?.status || 500;
        res.status(status).json({
            error: err.response?.data?.message || 'Falha ao consultar CNPJ na BrasilAPI',
            detail: err.message
        });
    }
});

// 6. CLIENTES: Listar
router.get('/clientes', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { search = '', limit = 50 } = req.query;
        let query = 'SELECT * FROM erp_clientes WHERE 1=1';
        const params = [];

        if (tenantId) {
            query += ' AND IdEmpresa = ?';
            params.push(tenantId);
        }

        if (search) {
            query += ' AND (codigo LIKE ? OR razao_social LIKE ? OR cnpj_cpf LIKE ? OR nome_fantasia LIKE ?)';
            const term = `%${search}%`;
            params.push(term, term, term, term);
        }

        query += ' ORDER BY razao_social ASC LIMIT ?';
        params.push(parseInt(limit));

        const [rows] = await mysql.query(query, params);
        const formatados = rows.map(r => ({
            ...r,
            enderecos_adicionais: typeof r.enderecos_adicionais === 'string'
                ? (() => { try { return JSON.parse(r.enderecos_adicionais); } catch { return []; } })()
                : (r.enderecos_adicionais || []),
            dados_receita: typeof r.dados_receita === 'string'
                ? (() => { try { return JSON.parse(r.dados_receita); } catch { return null; } })()
                : (r.dados_receita || null),
            contatos: typeof r.contatos === 'string'
                ? (() => { try { return JSON.parse(r.contatos); } catch { return []; } })()
                : (r.contatos || [])
        }));
        res.json(formatados);
    } catch (err) {
        console.error('Erro em GET /api/erp/clientes:', err);
        res.status(500).json({ error: 'Erro ao listar clientes', detail: err.message });
    }
});

// 6.0. CLIENTES: Obter Próximo Código Sequencial (6 dígitos, ex: 000001)
router.get('/clientes/proximo-codigo', async (req, res) => {
    try {
        const tenantId = getTenantId(req) || 1;
        const [[maxRow]] = await mysql.query(
            'SELECT MAX(CAST(codigo AS UNSIGNED)) as max_cod FROM erp_clientes WHERE IdEmpresa = ? AND codigo REGEXP "^[0-9]+$"',
            [tenantId]
        );
        const proximo = (maxRow?.max_cod || 0) + 1;
        const proximoCodigo = String(proximo).padStart(6, '0');
        res.json({ proximo_codigo: proximoCodigo });
    } catch (err) {
        console.error('Erro em /api/erp/clientes/proximo-codigo:', err);
        res.status(500).json({ error: 'Erro ao calcular próximo código' });
    }
});

// 6.1. CLIENTES: Criar Novo Cliente
router.post('/clientes', async (req, res) => {
    try {
        const tenantId = getTenantId(req) || 1;
        const validacao = ErpValidator.validarCliente(req.body, false);
        if (!validacao.valido) {
            return res.status(400).json({ error: 'Falha na validação do cliente', erros: validacao.erros });
        }

        const {
            codigo, loja = '01', razao_social, nome_fantasia = '', cnpj_cpf = '',
            inscricao_estadual = '', tipo_pessoa = 'J', endereco = '', bairro = '',
            cidade = '', uf = 'SP', cep = '', telefone = '', email = '', contato = '',
            condicao_pagamento_padrao = '30 DDL', status = 'ativo',
            enderecos_adicionais = [], logo_url = '', dados_receita = null,
            contatos = []
        } = req.body;

        // Verificar duplicidade de CNPJ/CPF na mesma empresa
        if (cnpj_cpf && cnpj_cpf.trim() !== '') {
            const limpo = cnpj_cpf.replace(/\D/g, '');
            const [dupl] = await mysql.query(
                'SELECT codigo, razao_social FROM erp_clientes WHERE IdEmpresa = ? AND REPLACE(REPLACE(REPLACE(cnpj_cpf, ".", ""), "/", ""), "-", "") = ?',
                [tenantId, limpo]
            );
            if (dupl.length > 0) {
                return res.status(400).json({ error: `Já existe um cliente cadastrado com este CNPJ/CPF: Código ${dupl[0].codigo} (${dupl[0].razao_social})` });
            }
        }

        // Gerar código se não fornecido para este tenant (6 dígitos, ex: 000001)
        let codFinal = codigo ? codigo.trim().toUpperCase() : '';
        if (!codFinal) {
            const [[maxRow]] = await mysql.query('SELECT MAX(CAST(codigo AS UNSIGNED)) as max_cod FROM erp_clientes WHERE IdEmpresa = ? AND codigo REGEXP "^[0-9]+$"', [tenantId]);
            const proximo = (maxRow?.max_cod || 0) + 1;
            codFinal = String(proximo).padStart(6, '0');
        } else {
            // Garantir que códigos numéricos manuais também fiquem com 6 dígitos se menores
            if (/^\d+$/.test(codFinal) && codFinal.length < 6) {
                codFinal = codFinal.padStart(6, '0');
            }
            const [codExistente] = await mysql.query('SELECT codigo FROM erp_clientes WHERE IdEmpresa = ? AND codigo = ?', [tenantId, codFinal]);
            if (codExistente.length > 0) {
                return res.status(400).json({ error: `O código de cliente "${codFinal}" já está em uso nesta empresa` });
            }
        }

        const endAdicionaisStr = typeof enderecos_adicionais === 'string'
            ? enderecos_adicionais
            : JSON.stringify(enderecos_adicionais || []);

        const dadosReceitaStr = dados_receita
            ? (typeof dados_receita === 'string' ? dados_receita : JSON.stringify(dados_receita))
            : null;

        const contatosStr = typeof contatos === 'string'
            ? contatos
            : JSON.stringify(contatos || []);

        const [result] = await mysql.query(`
            INSERT INTO erp_clientes (
                codigo, loja, razao_social, nome_fantasia, cnpj_cpf, inscricao_estadual,
                tipo_pessoa, endereco, bairro, cidade, uf, cep, telefone, email,
                contato, condicao_pagamento_padrao, status, enderecos_adicionais, logo_url, dados_receita, contatos, IdEmpresa
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            codFinal, loja, razao_social.trim(), nome_fantasia.trim(), cnpj_cpf.trim(),
            inscricao_estadual.trim(), tipo_pessoa, endereco.trim(), bairro.trim(),
            cidade.trim(), uf.trim().toUpperCase(), cep.trim(), telefone.trim(),
            email.trim(), contato.trim(), condicao_pagamento_padrao.trim(), status,
            endAdicionaisStr, logo_url || null, dadosReceitaStr, contatosStr, tenantId
        ]);

        res.status(201).json({
            success: true,
            id: result.insertId,
            codigo: codFinal,
            message: `Cliente ${codFinal} - ${razao_social} cadastrado com sucesso!`
        });
    } catch (err) {
        console.error('Erro em POST /api/erp/clientes:', err);
        res.status(500).json({ error: 'Erro ao cadastrar cliente', detail: err.message });
    }
});

// 6.2. CLIENTES: Atualizar Cliente
router.put('/clientes/:codigo', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { codigo } = req.params;
        const validacao = ErpValidator.validarCliente({ ...req.body, codigo }, true);
        if (!validacao.valido) {
            return res.status(400).json({ error: 'Falha na validação do cliente', erros: validacao.erros });
        }

        const {
            razao_social, nome_fantasia = '', cnpj_cpf = '', inscricao_estadual = '',
            tipo_pessoa = 'J', endereco = '', bairro = '', cidade = '', uf = 'SP',
            cep = '', telefone = '', email = '', contato = '', condicao_pagamento_padrao = '30 DDL',
            status = 'ativo', enderecos_adicionais = [], logo_url = '', dados_receita = null,
            contatos = []
        } = req.body;

        const endAdicionaisStr = typeof enderecos_adicionais === 'string'
            ? enderecos_adicionais
            : JSON.stringify(enderecos_adicionais || []);

        const dadosReceitaStr = dados_receita
            ? (typeof dados_receita === 'string' ? dados_receita : JSON.stringify(dados_receita))
            : null;

        const contatosStr = typeof contatos === 'string'
            ? contatos
            : JSON.stringify(contatos || []);

        let whereClause = 'WHERE codigo = ?';
        const params = [
            razao_social.trim(), nome_fantasia.trim(), cnpj_cpf.trim(), inscricao_estadual.trim(),
            tipo_pessoa, endereco.trim(), bairro.trim(), cidade.trim(), uf.trim().toUpperCase(),
            cep.trim(), telefone.trim(), email.trim(), contato.trim(), condicao_pagamento_padrao.trim(),
            status, endAdicionaisStr, logo_url || null, dadosReceitaStr, contatosStr
        ];

        if (tenantId) {
            whereClause = 'WHERE IdEmpresa = ? AND codigo = ?';
            params.push(tenantId, codigo);
        } else {
            params.push(codigo);
        }

        await mysql.query(`
            UPDATE erp_clientes SET
                razao_social = ?, nome_fantasia = ?, cnpj_cpf = ?, inscricao_estadual = ?,
                tipo_pessoa = ?, endereco = ?, bairro = ?, cidade = ?, uf = ?,
                cep = ?, telefone = ?, email = ?, contato = ?, condicao_pagamento_padrao = ?,
                status = ?, enderecos_adicionais = ?, logo_url = ?, dados_receita = ?, contatos = ?
            ${whereClause}
        `, params);

        res.json({ success: true, message: `Cliente ${codigo} atualizado com sucesso!` });
    } catch (err) {
        console.error('Erro em PUT /api/erp/clientes/:codigo:', err);
        res.status(500).json({ error: 'Erro ao atualizar cliente', detail: err.message });
    }
});

// Helper: Obter próximo número sequencial de pedido (Padrão Protheus GetSXENum SC5)
async function getProximoNumeroPedido(conn, tenantId) {
    const clientConn = conn || mysql;
    let protheusMax = 0;

    // Apenas consulta Postgres se for a empresa 1 (Lynx EMS Matriz histórica)
    if (tenantId === 1) {
        try {
            const pg = require('../db');
            const res = await pg.query("SELECT MAX(c5_num) as max_num FROM sc5010 WHERE d_e_l_e_t_ = ' ' AND c5_num ~ '^[0-9]+$'");
            if (res.rows && res.rows[0]?.max_num) {
                protheusMax = parseInt(res.rows[0].max_num, 10) || 0;
            }
        } catch (e) {
            // Postgres Protheus offline ou inacessível, continua com MySQL
        }
    }

    let whereClause = "WHERE numero_pedido REGEXP '^[0-9]+$'";
    let params = [];
    if (tenantId) {
        whereClause = "WHERE IdEmpresa = ? AND numero_pedido REGEXP '^[0-9]+$'";
        params = [tenantId];
    }

    const [[mysqlMax]] = await clientConn.query(`
        SELECT MAX(CAST(numero_pedido AS UNSIGNED)) as max_num 
        FROM erp_pedidos_venda 
        ${whereClause}
    `, params);
    const mysqlMaxNum = mysqlMax?.max_num || 0;

    // Busca o número inicial configurado para a empresa em erp_config_pedidos
    let numeroInicialConfig = 1;
    let tamanhoDigitos = 6;
    if (tenantId) {
        try {
            const [[cfg]] = await clientConn.query(
                'SELECT numero_inicial_pedido, tamanho_digitos FROM erp_config_pedidos WHERE IdEmpresa = ?',
                [tenantId]
            );
            if (cfg?.numero_inicial_pedido) {
                numeroInicialConfig = parseInt(cfg.numero_inicial_pedido, 10) || 1;
            }
            if (cfg?.tamanho_digitos) {
                tamanhoDigitos = parseInt(cfg.tamanho_digitos, 10) || 6;
            }
        } catch (cfgErr) {
            // Se falhar leitura ou tabela, mantém padrão
        }
    }

    let baseMax = Math.max(protheusMax, mysqlMaxNum);
    let candidate = baseMax > 0 ? Math.max(numeroInicialConfig, baseMax + 1) : Math.max(numeroInicialConfig, 1);

    // Protheus ExistChav check: garante que o código não existe previamente no tenant
    let exists = true;
    let formatted = '';
    while (exists) {
        formatted = String(candidate).padStart(tamanhoDigitos, '0');
        let checkSql = 'SELECT 1 FROM erp_pedidos_venda WHERE numero_pedido = ? LIMIT 1';
        let checkParams = [formatted];
        if (tenantId) {
            checkSql = 'SELECT 1 FROM erp_pedidos_venda WHERE IdEmpresa = ? AND numero_pedido = ? LIMIT 1';
            checkParams = [tenantId, formatted];
        }
        const [[check]] = await clientConn.query(checkSql, checkParams);
        if (!check) {
            exists = false;
        } else {
            candidate++;
        }
    }

    return formatted;
}

// 6.5 PEDIDOS DE VENDA: Próximo número sequencial no padrão Protheus (GetSXENum SC5)
router.get('/pedidos/proximo-numero', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const proximoNumero = await getProximoNumeroPedido(null, tenantId);
        res.json({
            proximoNumero,
            tamanho: 6,
            mecanismo: 'Protheus SC5 GetSXENum',
            padrao: 'Numérico com 6 dígitos'
        });
    } catch (err) {
        console.error('Erro em GET /api/erp/pedidos/proximo-numero:', err);
        res.status(500).json({ error: 'Erro ao obter próximo número de pedido' });
    }
});

// 6.6 PEDIDOS DE VENDA: Consultar configuração de numeração inicial (Multi-Tenant)
router.get('/pedidos/config-numeracao', async (req, res) => {
    try {
        const tenantId = getTenantId(req) || 1;
        const proximoNumero = await getProximoNumeroPedido(mysql, tenantId);

        const [[cfg]] = await mysql.query(
            'SELECT numero_inicial_pedido, tamanho_digitos FROM erp_config_pedidos WHERE IdEmpresa = ?',
            [tenantId]
        );
        const numInicial = cfg?.numero_inicial_pedido ? parseInt(cfg.numero_inicial_pedido, 10) : 1;
        const tamanho = cfg?.tamanho_digitos ? parseInt(cfg.tamanho_digitos, 10) : 6;

        const [[maxRow]] = await mysql.query(
            'SELECT MAX(CAST(numero_pedido AS UNSIGNED)) as max_num FROM erp_pedidos_venda WHERE IdEmpresa = ? AND numero_pedido REGEXP "^[0-9]+$"',
            [tenantId]
        );
        const maiorExistente = maxRow?.max_num || 0;

        res.json({
            numero_inicial: numInicial,
            numero_inicial_formatado: String(numInicial).padStart(tamanho, '0'),
            tamanho_digitos: tamanho,
            maior_existente: maiorExistente,
            maior_formatado: maiorExistente > 0 ? String(maiorExistente).padStart(tamanho, '0') : 'Nenhum',
            proximo_numero: proximoNumero,
            proximo_formatado: proximoNumero
        });
    } catch (err) {
        console.error('Erro em GET /api/erp/pedidos/config-numeracao:', err);
        res.status(500).json({ error: 'Erro ao consultar configuração de numeração de pedidos', detail: err.message });
    }
});

// 6.7 PEDIDOS DE VENDA: Definir número inicial do Pedido Interno (Apenas Admin/Empresa)
router.post('/pedidos/config-numeracao', async (req, res) => {
    try {
        const tenantId = getTenantId(req) || 1;
        let { numero_inicial } = req.body;

        if (numero_inicial === undefined || numero_inicial === null || String(numero_inicial).trim() === '') {
            return res.status(400).json({ error: 'Informe o número inicial do pedido.' });
        }

        const numLimpo = String(numero_inicial).replace(/\D/g, '');
        const numSafe = parseInt(numLimpo, 10);

        if (isNaN(numSafe) || numSafe < 1 || numSafe > 999999) {
            return res.status(400).json({ error: 'Número inicial inválido. Informe um valor entre 1 e 999999.' });
        }

        // Validação contra regressão: não permitir número inicial menor ou igual ao maior pedido já emitido
        const [[maxRow]] = await mysql.query(
            'SELECT MAX(CAST(numero_pedido AS UNSIGNED)) as max_num FROM erp_pedidos_venda WHERE IdEmpresa = ? AND numero_pedido REGEXP "^[0-9]+$"',
            [tenantId]
        );
        const maiorExistente = maxRow?.max_num || 0;

        if (maiorExistente > 0 && numSafe <= maiorExistente) {
            const formatadoMaior = String(maiorExistente).padStart(6, '0');
            return res.status(400).json({
                error: `O número inicial não pode ser menor ou igual ao maior pedido já emitido (${formatadoMaior}) para evitar duplicidade de código.`
            });
        }

        await mysql.query(`
            INSERT INTO erp_config_pedidos (IdEmpresa, numero_inicial_pedido, tamanho_digitos)
            VALUES (?, ?, 6)
            ON DUPLICATE KEY UPDATE
                numero_inicial_pedido = VALUES(numero_inicial_pedido),
                tamanho_digitos = 6,
                updated_at = NOW()
        `, [tenantId, numSafe]);

        const novoProximo = await getProximoNumeroPedido(mysql, tenantId);
        const formatado = String(numSafe).padStart(6, '0');

        res.json({
            success: true,
            message: `Número inicial do Pedido Interno configurado com sucesso para ${formatado}.`,
            numero_inicial: numSafe,
            numero_inicial_formatado: formatado,
            proximo_numero: novoProximo,
            proximo_formatado: novoProximo
        });
    } catch (err) {
        console.error('Erro em POST /api/erp/pedidos/config-numeracao:', err);
        res.status(500).json({ error: 'Erro ao configurar numeração inicial do pedido', detail: err.message });
    }
});

// 6.9 CONFIGURAÇÃO DA PASTA PADRÃO DE PEDIDOS NO SERVIDOR (Multi-Tenant)
router.get('/pedidos/config-pasta', async (req, res) => {
    try {
        const tenantId = getTenantId(req) || 1;
        const [rows] = await mysql.query(
            'SELECT diretorio_raiz_pedidos, padrao_subpasta, criar_pasta_automatica FROM erp_config_pedidos WHERE IdEmpresa = ?',
            [tenantId]
        );
        res.json(rows[0] || {
            diretorio_raiz_pedidos: '',
            padrao_subpasta: '{NUMERO_PEDIDO}',
            criar_pasta_automatica: 1
        });
    } catch (err) {
        console.error('Erro em GET /api/erp/pedidos/config-pasta:', err);
        res.status(500).json({ error: 'Erro ao buscar configuração da pasta de pedidos' });
    }
});

router.put('/pedidos/config-pasta', async (req, res) => {
    try {
        const tenantId = getTenantId(req) || 1;
        const { diretorio_raiz_pedidos, padrao_subpasta, criar_pasta_automatica } = req.body;
        
        await mysql.query(`
            INSERT INTO erp_config_pedidos (IdEmpresa, diretorio_raiz_pedidos, padrao_subpasta, criar_pasta_automatica)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                diretorio_raiz_pedidos = VALUES(diretorio_raiz_pedidos),
                padrao_subpasta = VALUES(padrao_subpasta),
                criar_pasta_automatica = VALUES(criar_pasta_automatica),
                updated_at = NOW()
        `, [
            tenantId,
            String(diretorio_raiz_pedidos || '').trim(),
            String(padrao_subpasta || '{NUMERO_PEDIDO}').trim(),
            criar_pasta_automatica ? 1 : 0
        ]);

        res.json({
            success: true,
            message: 'Configuração da pasta de pedidos salva com sucesso!',
            config: {
                diretorio_raiz_pedidos: String(diretorio_raiz_pedidos || '').trim(),
                padrao_subpasta: String(padrao_subpasta || '{NUMERO_PEDIDO}').trim(),
                criar_pasta_automatica: criar_pasta_automatica ? 1 : 0
            }
        });
    } catch (err) {
        console.error('Erro em PUT /api/erp/pedidos/config-pasta:', err);
        res.status(500).json({ error: 'Erro ao salvar configuração da pasta de pedidos', detail: err.message });
    }
});

// ABRIR / CRIAR PASTA DO PEDIDO NO SERVIDOR
router.post('/pedidos/abrir-pasta', async (req, res) => {
    try {
        const { caminho, criarSeNaoExistir = true } = req.body;
        if (!caminho || !String(caminho).trim()) {
            return res.status(400).json({ error: 'Caminho da pasta não informado.' });
        }
        const cleanPath = String(caminho).trim();
        const normalized = path.normalize(cleanPath);
        const forbiddenPatterns = [
            /^[a-zA-Z]:\\(windows|system32|recovery|boot)/i,
            /[\\\/](\.git|\.env|node_modules|server[\\\/]routes|server[\\\/]config)/i
        ];
        if (forbiddenPatterns.some(rx => rx.test(normalized))) {
            return res.status(403).json({ error: 'Acesso a este diretório é restrito por motivos de segurança.' });
        }

        let openedLocally = false;
        let created = false;

        // Se o servidor estiver rodando no Windows, tenta abrir diretamente o explorer
        if (process.platform === 'win32') {
            try {
                if (criarSeNaoExistir && !fs.existsSync(cleanPath)) {
                    fs.mkdirSync(cleanPath, { recursive: true });
                    created = true;
                }
                const { spawn } = require('child_process');
                const proc = spawn('explorer.exe', [cleanPath], { detached: true, stdio: 'ignore' });
                proc.unref();
                openedLocally = true;
            } catch (errLocal) {
                console.warn('[AbrirPasta] Tentativa local via spawn falhou:', errLocal.message);
            }
        }

        res.json({
            success: true,
            caminho: cleanPath,
            openedLocally,
            created
        });
    } catch (err) {
        console.error('Erro em POST /api/erp/pedidos/abrir-pasta:', err);
        res.status(500).json({ error: 'Erro ao processar abertura de pasta', detail: err.message });
    }
});

// 7.0 RELATÓRIO GERAL: Itens detalhados de múltiplos pedidos (para exportação em lote)
router.get('/pedidos-itens-relatorio', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { numeros } = req.query; // ex: "000001,000002,000003"
        let where = 'WHERE 1=1';
        const params = [];
        if (tenantId) {
            where += ' AND i.IdEmpresa = ?';
            params.push(tenantId);
        }
        if (numeros) {
            const list = String(numeros).split(',').map(n => n.trim()).filter(Boolean);
            if (list.length > 0) {
                where += ` AND i.pedido_numero IN (${list.map(() => '?').join(',')})`;
                params.push(...list);
            }
        }

        const [rows] = await mysql.query(`
            SELECT i.id, i.pedido_numero, i.item_seq, i.produto_codigo, i.quantidade, i.preco_unitario,
                   COALESCE(NULLIF(i.valor_total, 0), (i.quantidade * i.preco_unitario)) as valor_total,
                   i.data_entrega_prevista, i.observacao, i.numero_op_gerada,
                   pr.descricao as produto_descricao, pr.unidade_medida
            FROM erp_pedidos_itens i
            LEFT JOIN erp_produtos pr ON (i.produto_codigo = pr.codigo ${tenantId ? 'AND pr.IdEmpresa = i.IdEmpresa' : ''})
            ${where}
            ORDER BY i.pedido_numero DESC, CAST(i.item_seq AS UNSIGNED) ASC
        `, params);

        res.json(rows);
    } catch (err) {
        console.error('Erro em GET /api/erp/pedidos-itens-relatorio:', err);
        res.status(500).json({ error: 'Erro ao buscar itens para relatório', detail: err.message });
    }
});

// 7. PEDIDOS DE VENDA: Listar com cliente e totais (Otimizado: CTE + Agregação sem subqueries correlacionadas)
router.get('/pedidos', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { search = '', status = '', limit = 150 } = req.query;
        let whereClause = ' WHERE 1=1';
        const params = [];

        if (tenantId) {
            whereClause += ' AND p.IdEmpresa = ?';
            params.push(tenantId);
        }

        if (search) {
            whereClause += ' AND (p.numero_pedido LIKE ? OR c.razao_social LIKE ? OR c.nome_fantasia LIKE ?)';
            const term = `%${search}%`;
            params.push(term, term, term);
        }

        if (status) {
            whereClause += ' AND p.status = ?';
            params.push(status);
        }

        const parsedLimit = Math.min(Math.max(parseInt(limit) || 150, 1), 500);
        params.push(parsedLimit);

        const itemsWhere = tenantId ? 'WHERE i.IdEmpresa = ?' : '';
        const itemsParams = tenantId ? [tenantId] : [];

        const query = `
            WITH top_pedidos AS (
                SELECT p.id, p.numero_pedido, p.cliente_codigo, p.data_emissao, p.condicao_pagamento,
                       p.valor_total, p.peso_total, p.tipo_frete, p.transportadora, p.status, p.observacoes, p.created_at, p.pedido_cliente,
                       p.pasta_servidor,
                       c.razao_social as cliente_nome, c.nome_fantasia as cliente_fantasia
                FROM erp_pedidos_venda p
                LEFT JOIN erp_clientes c ON (p.cliente_codigo = c.codigo ${tenantId ? 'AND c.IdEmpresa = p.IdEmpresa' : ''})
                ${whereClause}
                ORDER BY p.id DESC 
                LIMIT ?
            ),
            itens_agg AS (
                SELECT i.pedido_numero,
                       COUNT(*) as total_itens,
                       MIN(NULLIF(i.data_entrega_prevista, '')) as data_entrega_prevista,
                       SUM(COALESCE(NULLIF(i.valor_total, 0), i.quantidade * i.preco_unitario)) as valor_calculado
                FROM erp_pedidos_itens i
                INNER JOIN top_pedidos tp ON tp.numero_pedido = i.pedido_numero
                ${itemsWhere}
                GROUP BY i.pedido_numero
            )
            SELECT p.id, p.numero_pedido, p.cliente_codigo, p.data_emissao, p.condicao_pagamento,
                   COALESCE(NULLIF(p.valor_total, 0), it.valor_calculado, 0) as valor_total,
                   p.peso_total, p.tipo_frete, p.transportadora, p.status, p.observacoes, p.created_at, p.pedido_cliente,
                   p.pasta_servidor,
                   p.cliente_nome, p.cliente_fantasia,
                   COALESCE(it.total_itens, 0) as total_itens,
                   it.data_entrega_prevista,
                   COALESCE(it.valor_calculado, 0) as valor_calculado
            FROM top_pedidos p
            LEFT JOIN itens_agg it ON it.pedido_numero = p.numero_pedido
            ORDER BY p.id DESC
        `;

        const [rows] = await mysql.query(query, [...params, ...itemsParams]);
        res.json(rows);
    } catch (err) {
        console.error('Erro em GET /api/erp/pedidos:', err);
        res.status(500).json({ error: 'Erro ao listar pedidos', detail: err.message });
    }
});

// Client logos map ({ codigo: logo }) — kept separate from the order list to avoid repeating base64 per row
router.get('/clientes-logos', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const codigos = String(req.query.codigos || '').split(',').map(c => c.trim()).filter(Boolean).slice(0, 300);
        if (!codigos.length) return res.json({});
        let sql = "SELECT codigo, logo_url FROM erp_clientes WHERE codigo IN (?) AND logo_url IS NOT NULL AND logo_url != ''";
        const params = [codigos];
        if (tenantId) {
            sql += ' AND IdEmpresa = ?';
            params.push(tenantId);
        }
        const [rows] = await mysql.query(sql, params);
        res.json(Object.fromEntries(rows.map(r => [r.codigo, r.logo_url])));
    } catch (err) {
        console.error('Erro em GET /api/erp/clientes-logos:', err);
        res.status(500).json({ error: 'Erro ao buscar logos dos clientes', detail: err.message });
    }
});

// 7.1 PEDIDOS DE VENDA: Editar cabeçalho (emissão, pagamento, frete, transportadora, observações)
router.put('/pedidos/:numero', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { numero } = req.params;
        const { data_emissao, condicao_pagamento, tipo_frete, transportadora, observacoes, pasta_servidor } = req.body;

        let findSql = 'SELECT id, status, pasta_servidor FROM erp_pedidos_venda WHERE numero_pedido = ?';
        const findParams = [numero];
        if (tenantId) {
            findSql += ' AND IdEmpresa = ?';
            findParams.push(tenantId);
        }
        const [found] = await mysql.query(findSql, findParams);
        if (!found.length) return res.status(404).json({ error: 'Pedido não encontrado.' });
        if (['cancelado', 'faturado'].includes(found[0].status)) {
            return res.status(400).json({ error: `Pedido ${found[0].status} não pode ser alterado.` });
        }

        const emissao = data_emissao ? String(data_emissao).split('T')[0] : null;
        if (emissao && !/^\d{4}-\d{2}-\d{2}$/.test(emissao)) {
            return res.status(400).json({ error: 'Data de emissão inválida.' });
        }
        const frete = ['FOB', 'CIF'].includes(tipo_frete) ? tipo_frete : 'FOB';

        await mysql.query(
            `UPDATE erp_pedidos_venda
             SET data_emissao = COALESCE(?, data_emissao), condicao_pagamento = ?, tipo_frete = ?,
                 transportadora = ?, observacoes = ?,
                 pasta_servidor = ?
             WHERE id = ?`,
            [emissao, String(condicao_pagamento || '').trim(), frete,
             String(transportadora || '').trim(), String(observacoes || '').trim() || null,
             pasta_servidor !== undefined ? (String(pasta_servidor || '').trim() || null) : found[0].pasta_servidor,
             found[0].id]
        );

        const [[pedido]] = await mysql.query(
            'SELECT data_emissao, condicao_pagamento, tipo_frete, transportadora, observacoes, pasta_servidor FROM erp_pedidos_venda WHERE id = ?',
            [found[0].id]
        );
        res.json({ success: true, message: 'Cabeçalho do pedido atualizado!', pedido });
    } catch (err) {
        console.error('Erro em PUT /api/erp/pedidos/:numero:', err);
        res.status(500).json({ error: 'Falha ao atualizar o pedido', detail: err.message });
    }
});

async function findPedidoHeader(tenantId, numero, conn = mysql) {
    let sql = 'SELECT id, numero_pedido, status, cliente_codigo, pedido_cliente, pasta_servidor, IdEmpresa FROM erp_pedidos_venda WHERE numero_pedido = ?';
    const params = [numero];
    if (tenantId) {
        sql += ' AND IdEmpresa = ?';
        params.push(tenantId);
    }
    const [rows] = await conn.query(sql, params);
    return rows[0] || null;
}

async function listPedidoAnexos(idEmpresa, numero) {
    const [rows] = await mysql.query(
        'SELECT id, nome_original, tamanho, mime, created_by, created_at FROM erp_pedidos_anexos WHERE IdEmpresa = ? AND pedido_numero = ? ORDER BY id',
        [idEmpresa, numero]
    );
    return rows;
}

// 7.2 PEDIDOS DE VENDA: Mudança de status (Orçamento / Pedido / Cancelado)
router.put('/pedidos/:numero/status', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { numero } = req.params;
        const novoStatus = String(req.body.status || '').toLowerCase();
        const pedidoCliente = String(req.body.pedido_cliente || '').trim();

        if (!STATUS_PEDIDO.includes(novoStatus)) {
            return res.status(400).json({ error: 'Status inválido. Use: Orçamento, Pedido ou Cancelado.' });
        }
        const pedido = await findPedidoHeader(tenantId, numero);
        if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado.' });
        if (pedido.status === novoStatus) {
            return res.status(400).json({ error: 'O pedido já está neste status.' });
        }

        if (novoStatus === 'pedido') {
            if (pedido.status !== 'orcamento') {
                return res.status(400).json({ error: 'Somente um Orçamento pode ser convertido em Pedido.' });
            }
            if (!pedidoCliente) {
                return res.status(400).json({ error: 'Informe o número do pedido do cliente.' });
            }
            const [[{ total }]] = await mysql.query(
                'SELECT COUNT(*) AS total FROM erp_pedidos_anexos WHERE IdEmpresa = ? AND pedido_numero = ?',
                [pedido.IdEmpresa, numero]
            );
            if (!total) {
                return res.status(400).json({ error: 'Anexe pelo menos um arquivo do pedido do cliente.' });
            }
        }

        if (novoStatus === 'orcamento' && pedido.status !== 'cancelado') {
            return res.status(400).json({ error: 'Um Pedido não pode voltar para Orçamento.' });
        }

        if (novoStatus === 'cancelado') {
            const [ops] = await mysql.query(
                `SELECT numero_op FROM erp_ordens_producao
                 WHERE IdEmpresa = ? AND TRIM(pedido_venda) = TRIM(?) AND status != 'cancelada' LIMIT 1`,
                [pedido.IdEmpresa, numero]
            );
            if (ops.length) {
                return res.status(400).json({ error: `Não é possível cancelar: existe OP ativa (${ops[0].numero_op}). Cancele a OP primeiro.` });
            }
        }

        await mysql.query(
            'UPDATE erp_pedidos_venda SET status = ?, pedido_cliente = COALESCE(?, pedido_cliente) WHERE id = ?',
            [novoStatus, pedidoCliente || null, pedido.id]
        );
        const labels = { orcamento: 'Orçamento', pedido: 'Pedido', cancelado: 'Cancelado' };
        res.json({
            success: true,
            message: `Status alterado para ${labels[novoStatus]}.`,
            status: novoStatus,
            pedido_cliente: pedidoCliente || pedido.pedido_cliente
        });
    } catch (err) {
        console.error('Erro em PUT /api/erp/pedidos/:numero/status:', err);
        res.status(500).json({ error: 'Falha ao alterar status do pedido', detail: err.message });
    }
});

// 7.3 PEDIDOS DE VENDA: Anexos (qualquer extensão, múltiplos arquivos)
router.get('/pedidos/:numero/anexos', async (req, res) => {
    try {
        const pedido = await findPedidoHeader(getTenantId(req), req.params.numero);
        if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado.' });
        res.json(await listPedidoAnexos(pedido.IdEmpresa, pedido.numero_pedido));
    } catch (err) {
        res.status(500).json({ error: 'Erro ao listar anexos', detail: err.message });
    }
});

router.post('/pedidos/:numero/anexos', (req, res) => {
    uploadPedidoAnexos.array('arquivos', 20)(req, res, async (uploadErr) => {
        const files = req.files || [];
        const cleanup = () => files.forEach(f => fs.promises.unlink(f.path).catch(() => {}));
        if (uploadErr) {
            cleanup();
            const msg = uploadErr.code === 'LIMIT_FILE_SIZE' ? 'Arquivo excede o limite de 30 MB.' : uploadErr.message;
            return res.status(400).json({ error: msg });
        }
        try {
            if (!files.length) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
            const pedido = await findPedidoHeader(getTenantId(req), req.params.numero);
            if (!pedido) {
                cleanup();
                return res.status(404).json({ error: 'Pedido não encontrado.' });
            }
            const user = req.user?.username || req.user?.nome || req.user?.email || null;
            for (const f of files) {
                await mysql.query(
                    `INSERT INTO erp_pedidos_anexos (IdEmpresa, pedido_numero, nome_original, caminho, tamanho, mime, created_by)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [pedido.IdEmpresa, pedido.numero_pedido, f.originalUtf8 || f.originalname, f.path, f.size, f.mimetype, user]
                );
            }
            res.json({
                success: true,
                message: `${files.length} arquivo(s) anexado(s).`,
                anexos: await listPedidoAnexos(pedido.IdEmpresa, pedido.numero_pedido)
            });
        } catch (err) {
            cleanup();
            console.error('Erro em POST /api/erp/pedidos/:numero/anexos:', err);
            res.status(500).json({ error: 'Falha ao anexar arquivos', detail: err.message });
        }
    });
});

async function findAnexo(req) {
    const tenantId = getTenantId(req);
    let sql = 'SELECT * FROM erp_pedidos_anexos WHERE id = ?';
    const params = [req.params.id];
    if (tenantId) {
        sql += ' AND IdEmpresa = ?';
        params.push(tenantId);
    }
    const [rows] = await mysql.query(sql, params);
    return rows[0] || null;
}

router.get('/pedidos-anexos/:id/download', async (req, res) => {
    try {
        const anexo = await findAnexo(req);
        if (!anexo || !fs.existsSync(anexo.caminho)) return res.status(404).json({ error: 'Anexo não encontrado.' });
        const inline = req.query.inline === '1';
        res.setHeader('Content-Type', anexo.mime || 'application/octet-stream');
        res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(anexo.nome_original)}`);
        fs.createReadStream(anexo.caminho).pipe(res);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao baixar anexo', detail: err.message });
    }
});

router.delete('/pedidos-anexos/:id', async (req, res) => {
    try {
        const anexo = await findAnexo(req);
        if (!anexo) return res.status(404).json({ error: 'Anexo não encontrado.' });
        const pedido = await findPedidoHeader(anexo.IdEmpresa, anexo.pedido_numero);
        if (pedido?.status === 'pedido') {
            const [[{ total }]] = await mysql.query(
                'SELECT COUNT(*) AS total FROM erp_pedidos_anexos WHERE IdEmpresa = ? AND pedido_numero = ?',
                [anexo.IdEmpresa, anexo.pedido_numero]
            );
            if (total <= 1) {
                return res.status(400).json({ error: 'Um Pedido precisa manter pelo menos um anexo do cliente.' });
            }
        }
        await mysql.query('DELETE FROM erp_pedidos_anexos WHERE id = ?', [anexo.id]);
        fs.promises.unlink(anexo.caminho).catch(() => {});
        res.json({ success: true, message: 'Anexo removido.' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao remover anexo', detail: err.message });
    }
});

// 8. PEDIDOS DE VENDA: Detalhes de um pedido específico + itens do grid com detecção de OPs
router.get('/pedidos/:numero', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { numero } = req.params;

        let wherePed = 'WHERE p.numero_pedido = ?';
        let paramsPed = [numero];
        if (tenantId) {
            wherePed = 'WHERE p.IdEmpresa = ? AND p.numero_pedido = ?';
            paramsPed = [tenantId, numero];
        }

        const [pedidos] = await mysql.query(`
            SELECT p.id, p.numero_pedido, p.cliente_codigo, p.data_emissao, p.condicao_pagamento,
                   COALESCE(NULLIF(p.valor_total, 0), (
                       SELECT SUM(COALESCE(NULLIF(valor_total, 0), quantidade * preco_unitario)) 
                       FROM erp_pedidos_itens 
                       WHERE pedido_numero = p.numero_pedido ${tenantId ? 'AND IdEmpresa = p.IdEmpresa' : ''}
                   ), 0) as valor_total,
                   p.peso_total, p.tipo_frete, p.transportadora, p.status, p.observacoes, p.created_at, p.pedido_cliente, p.pasta_servidor, p.IdEmpresa,
                   c.razao_social as cliente_nome, c.cnpj_cpf, c.cidade, c.uf, c.telefone, c.email, c.logo_url as cliente_logo
            FROM erp_pedidos_venda p
            LEFT JOIN erp_clientes c ON (p.cliente_codigo = c.codigo ${tenantId ? 'AND c.IdEmpresa = p.IdEmpresa' : ''})
            ${wherePed}
        `, paramsPed);

        if (pedidos.length === 0) {
            return res.status(404).json({ error: 'Pedido não encontrado' });
        }

        let whereItens = 'WHERE i.pedido_numero = ?';
        let paramsItens = [numero];
        if (tenantId) {
            whereItens = 'WHERE i.IdEmpresa = ? AND i.pedido_numero = ?';
            paramsItens = [tenantId, numero];
        }

        const [itens] = await mysql.query(`
            SELECT i.*, pr.descricao as produto_descricao, pr.unidade_medida, pr.peso_liquido,
                   COALESCE(NULLIF(i.valor_total, 0), (i.quantidade * i.preco_unitario)) as subtotal,
                   COALESCE(NULLIF(TRIM(i.numero_op_gerada), ''), op.numero_op) as numero_op_efetiva,
                   CASE 
                       WHEN (i.numero_op_gerada IS NOT NULL AND TRIM(i.numero_op_gerada) != '') OR op.numero_op IS NOT NULL THEN 0
                       ELSE 1
                   END as pode_editar
            FROM erp_pedidos_itens i
            LEFT JOIN erp_produtos pr ON (i.produto_codigo = pr.codigo ${tenantId ? 'AND pr.IdEmpresa = i.IdEmpresa' : ''})
            LEFT JOIN erp_ordens_producao op ON (
                TRIM(op.pedido_venda) = TRIM(i.pedido_numero) 
                AND (
                    TRIM(op.item_pedido) = TRIM(i.item_seq) 
                    OR (COALESCE(TRIM(op.item_pedido), '') = '' AND TRIM(op.produto_codigo) = TRIM(i.produto_codigo))
                )
                AND op.status != 'cancelada'
                ${tenantId ? 'AND op.IdEmpresa = i.IdEmpresa' : ''}
            )
            ${whereItens}
            GROUP BY i.id
            ORDER BY CAST(i.item_seq AS UNSIGNED) ASC, i.id ASC
        `, paramsItens);

        const itensComDesenho = (await attachDesenhos(itens.map(i => ({ ...i, codigo: i.produto_codigo }))))
            .map(({ codigo, ...rest }) => rest);

        res.json({
            pedido: pedidos[0],
            itens: itensComDesenho,
            anexos: await listPedidoAnexos(pedidos[0].IdEmpresa, pedidos[0].numero_pedido)
        });
    } catch (err) {
        console.error('Erro em GET /api/erp/pedidos/:numero:', err);
        res.status(500).json({ error: 'Erro ao buscar detalhes do pedido', detail: err.message });
    }
});

// 8.1 PEDIDOS DE VENDA: Atualizar item individualmente (apenas se não houver OP emitida)
router.put('/pedidos/:numero/itens/:itemId', async (req, res) => {
    const conn = await mysql.getConnection();
    try {
        const tenantId = getTenantId(req);
        await conn.beginTransaction();
        const { numero, itemId } = req.params;
        const { quantidade, preco_unitario, data_entrega_prevista, observacao } = req.body;
        const onlyObs = quantidade === undefined && preco_unitario === undefined && data_entrega_prevista === undefined;

        // 1. Busca item e verifica se pertence ao pedido e tenant
        let itemSql = 'SELECT * FROM erp_pedidos_itens WHERE id = ? AND pedido_numero = ? FOR UPDATE';
        let itemParams = [itemId, numero];
        if (tenantId) {
            itemSql = 'SELECT * FROM erp_pedidos_itens WHERE id = ? AND pedido_numero = ? AND IdEmpresa = ? FOR UPDATE';
            itemParams = [itemId, numero, tenantId];
        }

        const [items] = await conn.query(itemSql, itemParams);
        if (items.length === 0) {
            await conn.rollback();
            return res.status(404).json({ error: 'Item não encontrado para este pedido.' });
        }

        const item = items[0];
        const novaObs = observacao === undefined ? (item.observacao ?? null) : (String(observacao).trim() || null);

        // Observation-only update is allowed even when an OP exists (does not affect production)
        if (onlyObs) {
            await conn.query('UPDATE erp_pedidos_itens SET observacao = ? WHERE id = ?', [novaObs, item.id]);
            await conn.commit();
            return res.json({
                success: true,
                message: 'Observação do item atualizada!',
                item: {
                    id: item.id,
                    quantidade: item.quantidade,
                    preco_unitario: item.preco_unitario,
                    valor_total: item.valor_total,
                    data_entrega_prevista: item.data_entrega_prevista,
                    observacao: novaObs
                }
            });
        }

        // 2. Verifica se já possui OP emitida
        let hasOp = Boolean(item.numero_op_gerada && item.numero_op_gerada.trim());
        let opNum = item.numero_op_gerada || '';

        if (!hasOp) {
            let opSql = `
                SELECT numero_op FROM erp_ordens_producao 
                WHERE TRIM(pedido_venda) = TRIM(?) 
                  AND (
                      TRIM(item_pedido) = TRIM(?) 
                      OR (COALESCE(TRIM(item_pedido), '') = '' AND TRIM(produto_codigo) = TRIM(?))
                  )
                  AND status != 'cancelada'
                LIMIT 1
            `;
            let opParams = [numero, item.item_seq, item.produto_codigo];
            if (tenantId) {
                opSql = `
                    SELECT numero_op FROM erp_ordens_producao 
                    WHERE IdEmpresa = ?
                      AND TRIM(pedido_venda) = TRIM(?) 
                      AND (
                          TRIM(item_pedido) = TRIM(?) 
                          OR (COALESCE(TRIM(item_pedido), '') = '' AND TRIM(produto_codigo) = TRIM(?))
                      )
                      AND status != 'cancelada'
                    LIMIT 1
                `;
                opParams = [tenantId, numero, item.item_seq, item.produto_codigo];
            }

            const [ops] = await conn.query(opSql, opParams);
            if (ops.length > 0) {
                hasOp = true;
                opNum = ops[0].numero_op;
            }
        }

        if (hasOp) {
            await conn.rollback();
            return res.status(400).json({ 
                error: `Este item já possui Ordem de Produção emitida (OP: ${opNum}). Edição bloqueada por regra de integridade fabril (MATA410).` 
            });
        }

        // 3. Validações dos novos valores
        const novaQtd = parseFloat(quantidade);
        const novoPreco = parseFloat(preco_unitario);

        if (isNaN(novaQtd) || novaQtd <= 0) {
            await conn.rollback();
            return res.status(400).json({ error: 'A quantidade deve ser um número maior que zero.' });
        }

        if (isNaN(novoPreco) || novoPreco < 0) {
            await conn.rollback();
            return res.status(400).json({ error: 'O preço unitário não pode ser negativo.' });
        }

        const novoValorTotal = parseFloat((novaQtd * novoPreco).toFixed(2));
        const novaDataEntrega = data_entrega_prevista ? String(data_entrega_prevista).split('T')[0] : item.data_entrega_prevista;

        // 4. Atualiza o item na base de dados
        let updateItemSql = 'UPDATE erp_pedidos_itens SET quantidade = ?, preco_unitario = ?, valor_total = ?, data_entrega_prevista = ?, observacao = ? WHERE id = ?';
        let updateItemParams = [novaQtd, novoPreco, novoValorTotal, novaDataEntrega, novaObs, itemId];
        if (tenantId) {
            updateItemSql = 'UPDATE erp_pedidos_itens SET quantidade = ?, preco_unitario = ?, valor_total = ?, data_entrega_prevista = ?, observacao = ? WHERE id = ? AND IdEmpresa = ?';
            updateItemParams.push(tenantId);
        }
        await conn.query(updateItemSql, updateItemParams);

        // 5. Recalcula o cabeçalho do pedido
        let sumSql = 'SELECT COALESCE(SUM(valor_total), 0) as total_pedido, COUNT(*) as total_itens FROM erp_pedidos_itens WHERE pedido_numero = ?';
        let sumParams = [numero];
        if (tenantId) {
            sumSql = 'SELECT COALESCE(SUM(valor_total), 0) as total_pedido, COUNT(*) as total_itens FROM erp_pedidos_itens WHERE IdEmpresa = ? AND pedido_numero = ?';
            sumParams = [tenantId, numero];
        }
        const [[totais]] = await conn.query(sumSql, sumParams);

        let updatePedSql = 'UPDATE erp_pedidos_venda SET valor_total = ? WHERE numero_pedido = ?';
        let updatePedParams = [totais.total_pedido, numero];
        if (tenantId) {
            updatePedSql = 'UPDATE erp_pedidos_venda SET valor_total = ? WHERE IdEmpresa = ? AND numero_pedido = ?';
            updatePedParams = [totais.total_pedido, tenantId, numero];
        }
        await conn.query(updatePedSql, updatePedParams);

        await conn.commit();

        res.json({
            success: true,
            message: 'Item do pedido atualizado com sucesso!',
            item: {
                id: item.id,
                quantidade: novaQtd,
                preco_unitario: novoPreco,
                valor_total: novoValorTotal,
                data_entrega_prevista: novaDataEntrega,
                observacao: novaObs
            },
            total_pedido: totais.total_pedido
        });
    } catch (err) {
        await conn.rollback();
        console.error('Erro em PUT /api/erp/pedidos/:numero/itens/:itemId:', err);
        res.status(500).json({ error: 'Falha ao atualizar item do pedido', detail: err.message });
    } finally {
        conn.release();
    }
});

// 8.2 PEDIDOS DE VENDA: Adicionar novo item a pedido existente
router.post('/pedidos/:numero/itens', async (req, res) => {
    const conn = await mysql.getConnection();
    try {
        const tenantId = getTenantId(req) || 1;
        await conn.beginTransaction();
        const { numero } = req.params;
        const { produto_codigo, quantidade, preco_unitario, data_entrega_prevista, observacao } = req.body;
        const obs = String(observacao || '').trim() || null;

        // 1. Verifica se o pedido existe e pertence a esta empresa
        const [pedidos] = await conn.query(
            'SELECT * FROM erp_pedidos_venda WHERE IdEmpresa = ? AND numero_pedido = ? FOR UPDATE',
            [tenantId, numero]
        );
        if (pedidos.length === 0) {
            await conn.rollback();
            return res.status(404).json({ error: 'Pedido não encontrado.' });
        }
        const pedido = pedidos[0];
        if (pedido.status === 'cancelado') {
            await conn.rollback();
            return res.status(400).json({ error: 'Não é possível adicionar produtos a um pedido cancelado.' });
        }
        if (pedido.status === 'faturado') {
            await conn.rollback();
            return res.status(400).json({ error: 'Não é possível adicionar produtos a um pedido faturado.' });
        }

        // 2. Valida o produto na empresa
        const prodCod = String(produto_codigo || '').trim().toUpperCase();
        if (!prodCod) {
            await conn.rollback();
            return res.status(400).json({ error: 'Código do produto é obrigatório.' });
        }
        const [prods] = await conn.query('SELECT codigo, descricao, unidade_medida, peso_liquido FROM erp_produtos WHERE IdEmpresa = ? AND codigo = ?', [tenantId, prodCod]);
        if (prods.length === 0) {
            await conn.rollback();
            return res.status(400).json({ error: `Produto "${prodCod}" não encontrado no catálogo desta empresa.` });
        }
        const prod = prods[0];

        // 3. Valida valores
        const qtd = parseFloat(quantidade);
        const preco = parseFloat(preco_unitario);
        if (isNaN(qtd) || qtd <= 0) {
            await conn.rollback();
            return res.status(400).json({ error: 'Quantidade deve ser maior que zero.' });
        }
        if (isNaN(preco) || preco < 0) {
            await conn.rollback();
            return res.status(400).json({ error: 'Preço unitário não pode ser negativo.' });
        }
        const subtotal = parseFloat((qtd * preco).toFixed(2));
        const dataEntrega = data_entrega_prevista ? String(data_entrega_prevista).split('T')[0] : (pedido.data_emissao ? String(pedido.data_emissao).split('T')[0] : new Date().toISOString().split('T')[0]);

        // 4. Determina o próximo item_seq (01, 02, 03...)
        const [existingItems] = await conn.query(
            'SELECT item_seq FROM erp_pedidos_itens WHERE IdEmpresa = ? AND pedido_numero = ?',
            [tenantId, numero]
        );
        let maxNum = 0;
        for (const it of existingItems) {
            const num = parseInt(it.item_seq, 10);
            if (!isNaN(num) && num > maxNum) maxNum = num;
        }
        const nextSeq = String(maxNum + 1).padStart(2, '0');

        // 5. Insere o item com IdEmpresa
        const [insertRes] = await conn.query(`
            INSERT INTO erp_pedidos_itens (
                pedido_numero, item_seq, produto_codigo, quantidade, quantidade_original,
                quantidade_entregue, quantidade_saldo, preco_unitario, valor_total,
                data_entrega_prevista, status, observacao, IdEmpresa
            ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 'aberto', ?, ?)
        `, [numero, nextSeq, prodCod, qtd, qtd, qtd, preco, subtotal, dataEntrega, obs, tenantId]);

        const [novoComDesenho] = await attachDesenhos([{ codigo: prodCod }]);

        // 6. Recalcula o cabeçalho do pedido
        const [[totais]] = await conn.query(`
            SELECT COALESCE(SUM(valor_total), 0) as total_pedido,
                   COUNT(*) as total_itens
            FROM erp_pedidos_itens 
            WHERE IdEmpresa = ? AND pedido_numero = ?
        `, [tenantId, numero]);

        await conn.query(`
            UPDATE erp_pedidos_venda 
            SET valor_total = ?
            WHERE IdEmpresa = ? AND numero_pedido = ?
        `, [totais.total_pedido, tenantId, numero]);

        await conn.commit();

        res.json({
            success: true,
            message: `Produto ${prodCod} adicionado com sucesso como item ${nextSeq}!`,
            item: {
                id: insertRes.insertId,
                pedido_numero: numero,
                item_seq: nextSeq,
                produto_codigo: prodCod,
                produto_descricao: prod.descricao,
                unidade_medida: prod.unidade_medida,
                quantidade: qtd,
                quantidade_original: qtd,
                quantidade_saldo: qtd,
                preco_unitario: preco,
                valor_total: subtotal,
                subtotal: subtotal,
                data_entrega_prevista: dataEntrega,
                numero_op_efetiva: null,
                pode_editar: 1,
                status: 'aberto',
                observacao: obs,
                desenho_url: novoComDesenho?.desenho_url || null
            },
            total_pedido: totais.total_pedido
        });
    } catch (err) {
        await conn.rollback();
        console.error('Erro em POST /api/erp/pedidos/:numero/itens:', err);
        res.status(500).json({ error: 'Falha ao adicionar item ao pedido', detail: err.message });
    } finally {
        conn.release();
    }
});

// 8.3 PEDIDOS DE VENDA: Remover item de pedido existente (apenas se não houver OP)
router.delete('/pedidos/:numero/itens/:itemId', async (req, res) => {
    const conn = await mysql.getConnection();
    try {
        const tenantId = getTenantId(req);
        await conn.beginTransaction();
        const { numero, itemId } = req.params;

        let findSql = 'SELECT * FROM erp_pedidos_itens WHERE id = ? AND pedido_numero = ? FOR UPDATE';
        let findParams = [itemId, numero];
        if (tenantId) {
            findSql = 'SELECT * FROM erp_pedidos_itens WHERE id = ? AND pedido_numero = ? AND IdEmpresa = ? FOR UPDATE';
            findParams = [itemId, numero, tenantId];
        }

        const [items] = await conn.query(findSql, findParams);
        if (items.length === 0) {
            await conn.rollback();
            return res.status(404).json({ error: 'Item não encontrado para este pedido.' });
        }
        const item = items[0];

        // Verifica se tem OP
        let hasOp = Boolean(item.numero_op_gerada && item.numero_op_gerada.trim());
        let opNum = item.numero_op_gerada || '';
        if (!hasOp) {
            let opCheckSql = `
                SELECT numero_op FROM erp_ordens_producao 
                WHERE TRIM(pedido_venda) = TRIM(?) 
                  AND (TRIM(item_pedido) = TRIM(?) OR (COALESCE(TRIM(item_pedido), '') = '' AND TRIM(produto_codigo) = TRIM(?)))
                  AND status != 'cancelada'
                LIMIT 1
            `;
            let opCheckParams = [numero, item.item_seq, item.produto_codigo];
            if (tenantId) {
                opCheckSql = `
                    SELECT numero_op FROM erp_ordens_producao 
                    WHERE IdEmpresa = ?
                      AND TRIM(pedido_venda) = TRIM(?) 
                      AND (TRIM(item_pedido) = TRIM(?) OR (COALESCE(TRIM(item_pedido), '') = '' AND TRIM(produto_codigo) = TRIM(?)))
                      AND status != 'cancelada'
                    LIMIT 1
                `;
                opCheckParams = [tenantId, numero, item.item_seq, item.produto_codigo];
            }

            const [ops] = await conn.query(opCheckSql, opCheckParams);
            if (ops.length > 0) {
                hasOp = true;
                opNum = ops[0].numero_op;
            }
        }
        if (hasOp) {
            await conn.rollback();
            return res.status(400).json({ 
                error: `Este item já possui Ordem de Produção emitida (OP: ${opNum}). Exclusão bloqueada.` 
            });
        }

        let delSql = 'DELETE FROM erp_pedidos_itens WHERE id = ?';
        let delParams = [itemId];
        if (tenantId) {
            delSql = 'DELETE FROM erp_pedidos_itens WHERE id = ? AND IdEmpresa = ?';
            delParams = [itemId, tenantId];
        }
        await conn.query(delSql, delParams);

        // Recalcula totais
        let sumSql = 'SELECT COALESCE(SUM(valor_total), 0) as total_pedido, COUNT(*) as total_itens FROM erp_pedidos_itens WHERE pedido_numero = ?';
        let sumParams = [numero];
        if (tenantId) {
            sumSql = 'SELECT COALESCE(SUM(valor_total), 0) as total_pedido, COUNT(*) as total_itens FROM erp_pedidos_itens WHERE IdEmpresa = ? AND pedido_numero = ?';
            sumParams = [tenantId, numero];
        }
        const [[totais]] = await conn.query(sumSql, sumParams);

        let updatePedSql = 'UPDATE erp_pedidos_venda SET valor_total = ? WHERE numero_pedido = ?';
        let updatePedParams = [totais.total_pedido, numero];
        if (tenantId) {
            updatePedSql = 'UPDATE erp_pedidos_venda SET valor_total = ? WHERE IdEmpresa = ? AND numero_pedido = ?';
            updatePedParams = [totais.total_pedido, tenantId, numero];
        }
        await conn.query(updatePedSql, updatePedParams);

        await conn.commit();

        res.json({
            success: true,
            message: `Item ${item.item_seq} removido com sucesso!`,
            deletedItemId: parseInt(itemId, 10),
            total_pedido: totais.total_pedido
        });
    } catch (err) {
        await conn.rollback();
        console.error('Erro em DELETE /api/erp/pedidos/:numero/itens/:itemId:', err);
        res.status(500).json({ error: 'Falha ao remover item do pedido', detail: err.message });
    } finally {
        conn.release();
    }
});

// 9. PEDIDOS DE VENDA: Gravar Pedido com Validação Rígida e Transação ACID
router.post('/pedidos', async (req, res) => {
    const conn = await mysql.getConnection();
    try {
        const tenantId = getTenantId(req) || 1;
        const { cabecalho, itens } = req.body;

        if (!cabecalho) {
            return res.status(400).json({ error: 'Dados do cabeçalho do pedido não informados' });
        }

        // A. Validação Protheus-Grade no escopo da empresa
        const validacao = await ErpValidator.validarPedidoVenda(cabecalho, itens, conn, tenantId);
        if (!validacao.valido) {
            console.warn('⚠️ [ERP PEDIDO] Validação reprovada:', validacao.erros);
            return res.status(400).json({
                erros: validacao.erros
            });
        }

        await conn.beginTransaction();

        // Gerar ou validar número de pedido conforme padrão Protheus
        let numPedido = cabecalho.numero_pedido ? cabecalho.numero_pedido.trim().toUpperCase() : '';
        if (!numPedido) {
            numPedido = await getProximoNumeroPedido(conn, tenantId);
        } else {
            // Validar ExistChav na empresa
            const [[existente]] = await conn.query('SELECT 1 FROM erp_pedidos_venda WHERE IdEmpresa = ? AND numero_pedido = ? LIMIT 1', [tenantId, numPedido]);
            if (existente) {
                await conn.rollback();
                return res.status(400).json({ error: `O número de pedido "${numPedido}" já existe no banco de dados desta empresa.` });
            }
        }

        // Calcular totais
        let valorTotal = 0;
        let pesoTotal = 0;

        for (const item of itens) {
            const qtd = parseFloat(item.quantidade) || 0;
            const preco = parseFloat(item.preco_unitario) || 0;
            valorTotal += (qtd * preco);

            const [[prodInfo]] = await conn.query('SELECT peso_liquido FROM erp_produtos WHERE IdEmpresa = ? AND codigo = ?', [tenantId, item.produto_codigo]);
            pesoTotal += (qtd * (parseFloat(prodInfo?.peso_liquido) || 0));
        }

        valorTotal = parseFloat(valorTotal.toFixed(2));

        // Calcular ou obter pasta no servidor para o pedido
        let pastaServidor = cabecalho.pasta_servidor ? String(cabecalho.pasta_servidor).trim() : null;
        if (!pastaServidor) {
            const [[cfgPasta]] = await conn.query('SELECT diretorio_raiz_pedidos, padrao_subpasta, criar_pasta_automatica FROM erp_config_pedidos WHERE IdEmpresa = ?', [tenantId]);
            if (cfgPasta?.diretorio_raiz_pedidos) {
                const raiz = cfgPasta.diretorio_raiz_pedidos.replace(/[\/\\]+$/, '');
                pastaServidor = `${raiz}\\${numPedido}`;
                if (cfgPasta.criar_pasta_automatica && process.platform === 'win32') {
                    try { fs.mkdirSync(pastaServidor, { recursive: true }); } catch (_) {}
                }
            }
        }

        // Inserir Cabeçalho com IdEmpresa
        await conn.query(`
            INSERT INTO erp_pedidos_venda (
                numero_pedido, cliente_codigo, data_emissao, condicao_pagamento,
                valor_total, peso_total, tipo_frete, transportadora, status, observacoes, pasta_servidor, IdEmpresa
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'orcamento', ?, ?, ?)
        `, [
            numPedido,
            cabecalho.cliente_codigo.trim(),
            cabecalho.data_emissao,
            cabecalho.condicao_pagamento || '',
            valorTotal,
            pesoTotal,
            cabecalho.tipo_frete || 'FOB',
            cabecalho.transportadora || '',
            cabecalho.observacoes || '',
            pastaServidor,
            tenantId
        ]);

        // Inserir Itens do Grid com valor_total e IdEmpresa
        for (let i = 0; i < itens.length; i++) {
            const item = itens[i];
            const seq = String(i + 1).padStart(2, '0');
            const qtd = parseFloat(item.quantidade) || 0;
            const preco = parseFloat(item.preco_unitario) || 0;
            const itemSubtotal = parseFloat((qtd * preco).toFixed(2));

            await conn.query(`
                INSERT INTO erp_pedidos_itens (
                    pedido_numero, item_seq, produto_codigo, quantidade,
                    quantidade_entregue, preco_unitario, valor_total, data_entrega_prevista, status, observacao, IdEmpresa
                ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, 'aberto', ?, ?)
            `, [
                numPedido,
                seq,
                item.produto_codigo.trim(),
                qtd,
                preco,
                itemSubtotal,
                item.data_entrega_prevista || cabecalho.data_emissao,
                (item.observacao || '').trim() || null,
                tenantId
            ]);
        }

        await conn.commit();

        // Sincroniza em background para visualização imediata na Visão Geral e relatórios Protheus
        const { syncErpToProtheus } = require('../scripts/sync_erp_to_protheus');
        syncErpToProtheus().catch(e => console.warn('Aviso sync ERP->Protheus:', e.message));

        res.status(201).json({
            success: true,
            numero_pedido: numPedido,
            valor_total: valorTotal,
            itens_cadastrados: itens.length,
            message: `Pedido ${numPedido} gerado e gravado com sucesso no ERP nativo!`
        });

    } catch (err) {
        await conn.rollback();
        console.error('Erro na gravação transacional do pedido:', err);
        res.status(500).json({ error: 'Erro ao gravar pedido de venda no ERP', detail: err.message });
    } finally {
        conn.release();
    }
});

// 10. ESTRUTURA / BOM: Buscar componentes para explosão na OP
router.get('/estruturas/:codigo', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { codigo } = req.params;

        let whereClause = 'WHERE b.produto_pai_codigo = ?';
        let params = [codigo];
        if (tenantId) {
            whereClause = 'WHERE b.IdEmpresa = ? AND b.produto_pai_codigo = ?';
            params = [tenantId, codigo];
        }

        const [componentes] = await mysql.query(`
            SELECT b.*, p.descricao as componente_descricao, p.tipo as componente_tipo,
                   p.peso_liquido, COALESCE(s.saldo_atual, 0) as saldo_estoque
            FROM erp_estruturas_bom b
            LEFT JOIN erp_produtos p ON (b.produto_filho_codigo = p.codigo ${tenantId ? 'AND p.IdEmpresa = b.IdEmpresa' : ''})
            LEFT JOIN erp_estoque_saldos s ON (b.produto_filho_codigo = s.produto_codigo AND s.armazem = '01' ${tenantId ? 'AND s.IdEmpresa = b.IdEmpresa' : ''})
            ${whereClause}
            ORDER BY CAST(b.ordem_sequencia AS UNSIGNED) ASC
        `, params);

        res.json(componentes);
    } catch (err) {
        console.error('Erro em GET /api/erp/estruturas/:codigo:', err);
        res.status(500).json({ error: 'Erro ao buscar componentes da estrutura', detail: err.message });
    }
});

// 11. ORDENS DE PRODUÇÃO: Listar OPs com filtros e joins
router.get('/ordens-producao', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { search = '', status = '', limit = 50, offset = 0 } = req.query;

        let where = 'WHERE 1=1';
        const params = [];
        if (tenantId) {
            where += ' AND op.IdEmpresa = ?';
            params.push(tenantId);
        }

        if (search) {
            where += ' AND (op.numero_op LIKE ? OR op.produto_codigo LIKE ? OR p.descricao LIKE ? OR op.pedido_venda LIKE ?)';
            const term = `%${search}%`;
            params.push(term, term, term, term);
        }

        if (status) {
            where += ' AND op.status = ?';
            params.push(status);
        }

        const query = `
            SELECT op.*, p.descricao as produto_descricao, p.unidade_medida, p.tipo as produto_tipo,
                   p.peso_liquido, (op.quantidade_planejada * COALESCE(p.peso_liquido, 0)) as peso_total_planejado
            FROM erp_ordens_producao op
            LEFT JOIN erp_produtos p ON (op.produto_codigo = p.codigo ${tenantId ? 'AND p.IdEmpresa = op.IdEmpresa' : ''})
            ${where}
            ORDER BY op.id DESC 
            LIMIT ? OFFSET ?
        `;
        const queryParams = [...params, parseInt(limit), parseInt(offset)];

        const [rows] = await mysql.query(query, queryParams);

        // Contagem total para paginação
        let countQuery = `
            SELECT COUNT(*) as total 
            FROM erp_ordens_producao op 
            LEFT JOIN erp_produtos p ON (op.produto_codigo = p.codigo ${tenantId ? 'AND p.IdEmpresa = op.IdEmpresa' : ''}) 
            ${where}
        `;
        const [[countRes]] = await mysql.query(countQuery, params);

        res.json({
            total: countRes.total,
            rows
        });
    } catch (err) {
        console.error('Erro em GET /api/erp/ordens-producao:', err);
        res.status(500).json({ error: 'Erro ao listar ordens de produção', detail: err.message });
    }
});

// 12. ORDENS DE PRODUÇÃO: Abertura de Nova OP (MATA650 / SC2)
router.post('/ordens-producao', async (req, res) => {
    const conn = await mysql.getConnection();
    try {
        const tenantId = getTenantId(req) || 1;
        const validacao = await ErpValidator.validarOrdemProducao(req.body, conn, tenantId);
        if (!validacao.valido) {
            return res.status(400).json({ error: 'Falha na validação da OP', erros: validacao.erros });
        }

        const {
            numero_op, produto_codigo, quantidade_planejada,
            pedido_venda = '', item_pedido = '', data_emissao,
            data_inicio_prevista = '', data_fim_prevista = '',
            prioridade = 'media', observacoes = ''
        } = req.body;

        await conn.beginTransaction();

        // Gerar número de OP se não fornecido para esta empresa
        let numOpFinal = numero_op ? numero_op.trim().toUpperCase() : '';
        if (!numOpFinal) {
            const [[maxOp]] = await conn.query('SELECT MAX(CAST(REGEXP_REPLACE(numero_op, "[^0-9]", "") AS UNSIGNED)) as max_num FROM erp_ordens_producao WHERE IdEmpresa = ?', [tenantId]);
            const proximo = (maxOp?.max_num || 10000) + 1;
            numOpFinal = `OP-${String(proximo).padStart(6, '0')}`;
        }

        const [result] = await conn.query(`
            INSERT INTO erp_ordens_producao (
                numero_op, produto_codigo, quantidade_planejada, quantidade_produzida,
                quantidade_perdida, pedido_venda, item_pedido, data_emissao,
                data_inicio_prevista, data_fim_prevista, prioridade, status, observacoes, IdEmpresa
            ) VALUES (?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, 'aberta', ?, ?)
        `, [
            numOpFinal,
            produto_codigo.trim().toUpperCase(),
            parseFloat(quantidade_planejada),
            pedido_venda.trim(),
            item_pedido.trim(),
            data_emissao,
            data_inicio_prevista || data_emissao,
            data_fim_prevista || data_emissao,
            prioridade,
            observacoes.trim(),
            tenantId
        ]);

        await conn.commit();

        res.status(201).json({
            success: true,
            id: result.insertId,
            numero_op: numOpFinal,
            message: `Ordem de Produção ${numOpFinal} aberta com sucesso no ERP!`
        });

    } catch (err) {
        await conn.rollback();
        console.error('Erro ao abrir ordem de produção:', err);
        res.status(500).json({ error: 'Erro ao abrir ordem de produção', detail: err.message });
    } finally {
        conn.release();
    }
});

module.exports = router;
