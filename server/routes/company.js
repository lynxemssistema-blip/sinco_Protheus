const express = require('express');
const router = express.Router();
const pool = require('../services/mysqlService');
const { isSuperAdminUser, getTenantContext } = require('../util/authHelper');

// Per-company cache used only as a fallback for transient DB errors (never shared across companies)
const tenantCache = new Map();
const emptySettings = (tenantId) => ({ id: null, IdEmpresa: tenantId, razao_social: '', cnpj: '', menu_config: null, general_config: null });

// Extra contact channels and social network profiles
const SOCIAL_FIELDS = [
    'telefone_2', 'whatsapp', 'email_comercial', 'email_financeiro', 'email_nfe',
    'instagram', 'facebook', 'linkedin', 'youtube', 'tiktok', 'twitter_x', 'google_maps'
];

// Company profile fields editable in Configurações > Empresa (used by all generated reports)
const PROFILE_FIELDS = [
    'cnpj', 'razao_social', 'nome_fantasia', 'inscricao_estadual', 'inscricao_municipal',
    'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf', 'endereco',
    'telefone', 'email', 'site',
    ...SOCIAL_FIELDS,
    'cnae_principal', 'cnae_descricao', 'situacao_cadastral', 'data_abertura', 'regime_tributario',
    'logo_base64'
];
const SELECT_COLS = `id, ${PROFILE_FIELDS.join(', ')}, menu_config, general_config, IdEmpresa`;

// Ensure new profile columns exist (idempotent)
const schemaReady = (async () => {
    const newCols = {
        nome_fantasia: 'VARCHAR(255)', inscricao_estadual: 'VARCHAR(30)', inscricao_municipal: 'VARCHAR(30)',
        logradouro: 'VARCHAR(255)', numero: 'VARCHAR(20)', complemento: 'VARCHAR(100)',
        email: 'VARCHAR(150)', site: 'VARCHAR(150)',
        cnae_principal: 'VARCHAR(20)', cnae_descricao: 'VARCHAR(255)', situacao_cadastral: 'VARCHAR(50)',
        data_abertura: 'VARCHAR(20)', regime_tributario: 'VARCHAR(50)', logo_base64: 'MEDIUMTEXT',
        telefone_2: 'VARCHAR(30)', whatsapp: 'VARCHAR(30)',
        email_comercial: 'VARCHAR(150)', email_financeiro: 'VARCHAR(150)', email_nfe: 'VARCHAR(150)',
        instagram: 'VARCHAR(255)', facebook: 'VARCHAR(255)', linkedin: 'VARCHAR(255)', youtube: 'VARCHAR(255)',
        tiktok: 'VARCHAR(255)', twitter_x: 'VARCHAR(255)', google_maps: 'VARCHAR(500)'
    };
    try {
        const [cols] = await pool.query('SHOW COLUMNS FROM app_company_settings');
        const existing = new Set(cols.map(c => c.Field));
        for (const [name, type] of Object.entries(newCols)) {
            if (!existing.has(name)) {
                await pool.query(`ALTER TABLE app_company_settings ADD COLUMN ${name} ${type} NULL`);
                console.log(`✅ [COMPANY] Coluna ${name} adicionada.`);
            }
        }
    } catch (err) {
        console.warn('⚠️ [COMPANY] Falha ao garantir colunas do perfil:', err.message);
    }
})();

// Helper to get or initialize tenant settings row
async function getTenantSettingsRow(tenantId) {
    await schemaReady;
    const safeTenantId = parseInt(tenantId, 10) || 1;
    const [rows] = await pool.query(`
        SELECT ${SELECT_COLS}
        FROM app_company_settings 
        WHERE IdEmpresa = ?
        ORDER BY id
        LIMIT 1
    `, [safeTenantId]);

    if (rows && rows.length > 0) {
        return rows[0];
    }

    try {
        const [baseRows] = await pool.query('SELECT menu_config, general_config FROM app_company_settings WHERE id = 1 LIMIT 1');
        const defaultMenu = baseRows[0]?.menu_config || null;
        const defaultGen = baseRows[0]?.general_config || null;

        const [insertRes] = await pool.execute(`
            INSERT INTO app_company_settings (IdEmpresa, razao_social, menu_config, general_config)
            VALUES (?, ?, ?, ?)
        `, [safeTenantId, `Empresa ${safeTenantId}`, defaultMenu, defaultGen]);

        const [newRows] = await pool.query(`SELECT ${SELECT_COLS} FROM app_company_settings WHERE id = ?`, [insertRes.insertId]);
        if (newRows && newRows.length > 0) return newRows[0];
    } catch (insertErr) {
        console.warn('⚠️ [COMPANY SETTINGS INIT WARN]:', insertErr.message);
    }

    throw new Error(`Configurações da empresa ${safeTenantId} indisponíveis.`);
}

// GET /api/company/cnpj/:cnpj — lookup public company data on BrasilAPI
router.get('/cnpj/:cnpj', async (req, res) => {
    const cnpj = String(req.params.cnpj || '').replace(/\D/g, '');
    if (cnpj.length !== 14) {
        return res.status(400).json({ error: 'CNPJ inválido. Informe os 14 dígitos.' });
    }
    try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
            headers: { 'User-Agent': 'SINCO-Suite/1.0' },
            signal: AbortSignal.timeout(15000)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return res.status(response.status).json({ error: data.message || 'CNPJ não encontrado na BrasilAPI.' });
        }
        const fmtCep = (c) => { const d = String(c || '').replace(/\D/g, ''); return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : d; };
        const logradouro = [data.descricao_tipo_de_logradouro, data.logradouro].filter(Boolean).join(' ').trim();
        const regime = data.opcao_pelo_mei ? 'MEI' : data.opcao_pelo_simples ? 'Simples Nacional' : 'Lucro Presumido/Real';
        const tel = String(data.ddd_telefone_1 || '').replace(/\D/g, '');
        res.json({
            cnpj: cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5'),
            razao_social: data.razao_social || '',
            nome_fantasia: data.nome_fantasia || '',
            cep: fmtCep(data.cep),
            logradouro,
            numero: data.numero || '',
            complemento: data.complemento || '',
            bairro: data.bairro || '',
            cidade: data.municipio || '',
            uf: data.uf || '',
            telefone: tel.length >= 10 ? `(${tel.slice(0, 2)}) ${tel.slice(2, -4)}-${tel.slice(-4)}` : tel,
            email: (data.email || '').toLowerCase(),
            cnae_principal: data.cnae_fiscal ? String(data.cnae_fiscal) : '',
            cnae_descricao: data.cnae_fiscal_descricao || '',
            situacao_cadastral: data.descricao_situacao_cadastral || '',
            data_abertura: data.data_inicio_atividade || '',
            regime_tributario: regime
        });
    } catch (err) {
        console.error('❌ [BRASILAPI CNPJ]', err.message);
        res.status(502).json({ error: 'Não foi possível consultar a BrasilAPI no momento.' });
    }
});

// Get Company Settings (Per-Company Multi-Tenant)
router.get('/', async (req, res) => {
    const tenantId = getTenantContext(req) || 1;
    try {
        const row = await getTenantSettingsRow(tenantId);
        tenantCache.set(tenantId, row);
        res.json(row);
    } catch (err) {
        console.warn('⚠️ [COMPANY FALLBACK]', err.message);
        res.json(tenantCache.get(tenantId) || emptySettings(tenantId));
    }
});

// Update Company Info ONLY
router.put('/', async (req, res) => {
    const tenantId = getTenantContext(req) || 1;
    const data = {};
    for (const f of PROFILE_FIELDS) {
        if (req.body[f] !== undefined) data[f] = req.body[f] === '' ? null : req.body[f];
    }
    if (data.logo_base64 && String(data.logo_base64).length > 3 * 1024 * 1024) {
        return res.status(400).json({ error: 'Logo muito grande. Use uma imagem de até 2MB.' });
    }
    // Keep legacy single-line address in sync for older reports
    if (data.logradouro !== undefined || data.numero !== undefined) {
        const partes = [data.logradouro, data.numero, data.complemento].filter(Boolean).join(', ');
        if (partes) data.endereco = partes;
    }
    try {
        const row = await getTenantSettingsRow(tenantId);
        const keys = Object.keys(data);
        if (keys.length) {
            await pool.execute(
                `UPDATE app_company_settings SET ${keys.map(k => `${k}=?`).join(', ')} WHERE id = ? AND IdEmpresa = ?`,
                [...keys.map(k => data[k]), row.id, tenantId]
            );
        }
        tenantCache.set(tenantId, { ...row, ...data });
        res.json({ message: 'Dados da empresa atualizados com sucesso!' });
    } catch (err) {
        console.warn('⚠️ [COMPANY UPDATE FALLBACK]:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Update Menu Config ONLY
router.put('/menu', async (req, res) => {
    const tenantId = getTenantContext(req) || 1;
    const { menu_config } = req.body;
    try {
        const row = await getTenantSettingsRow(tenantId);
        const menuConfigStr = menu_config ? JSON.stringify(menu_config) : null;

        await pool.execute(`
            UPDATE app_company_settings 
            SET menu_config=?
            WHERE id = ? AND IdEmpresa = ?
        `, [menuConfigStr, row.id, tenantId]);

        tenantCache.set(tenantId, { ...row, menu_config });
        res.json({ message: 'Configuração do menu atualizada com sucesso!' });
    } catch (err) {
        console.warn('⚠️ [COMPANY MENU FALLBACK]:', err.message);
        if (err.message && err.message.includes('command denied')) {
            return res.json({ message: 'Configuração do menu atualizada em memória.' });
        }
        res.status(500).json({ error: err.message });
    }
});

// Update General Config ONLY (Per-Company)
router.put('/general', async (req, res) => {
    try {
        const tenantId = getTenantContext(req) || 1;
        const { general_config } = req.body;

        // Security check: only SA (SuperAdmin) or Admin can change general settings
        const isAuthorized = isSuperAdminUser(req.user) || req.isSuperAdmin || req.user?.is_superadmin || req.user?.tipo === 'SA' || req.user?.tipo === 'A' || req.user?.isAdmin;
        if (!isAuthorized) {
            return res.status(403).json({ error: 'Acesso negado: Apenas Administradores podem alterar as configurações do sistema.' });
        }

        const row = await getTenantSettingsRow(tenantId);
        const configStr = general_config ? JSON.stringify(general_config) : null;

        await pool.execute(`
            UPDATE app_company_settings 
            SET general_config=?
            WHERE id = ? AND IdEmpresa = ?
        `, [configStr, row.id, tenantId]);

        tenantCache.set(tenantId, { ...row, general_config });
        res.json({ message: 'Configurações gerais atualizadas com sucesso!' });
    } catch (err) {
        console.error("Error updating general settings:", err);
        res.status(500).json({ error: err.message });
    }
});

// Get Current Romaneio Number (AUTO_INCREMENT)
router.get('/romaneio-number', async (req, res) => {
    try {
        const query = `
            SELECT AUTO_INCREMENT
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
            AND table_name = 'app_romaneios'
        `;
        const [rows] = await pool.query(query);
        const autoIncrement = rows[0]?.AUTO_INCREMENT || 1;

        // Busca o maior ID de romaneio já existente no banco
        const [[maxRow]] = await pool.query('SELECT MAX(id) as max_id FROM app_romaneios');
        const maiorExistente = maxRow?.max_id || 0;

        res.json({ 
            current_number: autoIncrement,
            proximo_numero: autoIncrement,
            proximo_formatado: `RO-${String(autoIncrement).padStart(6, '0')}`,
            maior_existente: maiorExistente,
            maior_formatado: maiorExistente > 0 ? `RO-${String(maiorExistente).padStart(6, '0')}` : 'Nenhum'
        });
    } catch (err) {
        console.error("Error fetching romaneio auto increment:", err);
        res.status(500).json({ error: 'Erro ao buscar número do romaneio: ' + err.message });
    }
});

// Set Initial Romaneio Number (AUTO_INCREMENT)
router.post('/set-romaneio-number', async (req, res) => {
    try {
        let { numero_inicial } = req.body;

        if (numero_inicial === undefined || numero_inicial === null || String(numero_inicial).trim() === '') {
            return res.status(400).json({ error: 'Informe o número inicial do romaneio.' });
        }

        // Se o usuário digitou com prefixo "RO-" ou zeros à esquerda, extrai o número limpo
        const numLimpo = String(numero_inicial).toUpperCase().replace(/^RO-?/i, '').replace(/\D/g, '');
        const numSafe = parseInt(numLimpo, 10);

        if (isNaN(numSafe) || numSafe < 1 || numSafe > 999999) {
            return res.status(400).json({ error: 'Número inicial inválido. Informe um valor entre 1 e 999999.' });
        }

        // Validação contra retrocesso / colisão com romaneios já emitidos
        const [[maxRow]] = await pool.query('SELECT MAX(id) as max_id FROM app_romaneios');
        const maiorExistente = maxRow?.max_id || 0;

        if (maiorExistente > 0 && numSafe <= maiorExistente) {
            const formatadoMaior = `RO-${String(maiorExistente).padStart(6, '0')}`;
            return res.status(400).json({ 
                error: `O número inicial não pode ser menor ou igual ao maior romaneio já emitido (${formatadoMaior}) para evitar duplicidade de código.` 
            });
        }

        const query = `ALTER TABLE app_romaneios AUTO_INCREMENT = ${numSafe}`;
        await pool.query(query);

        const formatado = `RO-${String(numSafe).padStart(6, '0')}`;
        res.json({ 
            success: true,
            message: `Próximo número de Romaneio definido com sucesso para ${formatado}`,
            numero_inicial: numSafe,
            numero_formatado: formatado,
            proximo_formatado: formatado
        });
    } catch (err) {
        console.error("Error setting romaneio auto increment:", err);
        res.status(500).json({ error: 'Erro ao configurar a numeração automática: ' + err.message });
    }
});

module.exports = router;
