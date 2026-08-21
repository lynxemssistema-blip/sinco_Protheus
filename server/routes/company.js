const express = require('express');
const router = express.Router();
const pool = require('../services/mysqlService');

let lastCompanySettings = {
    id: 1,
    cnpj: '00.000.000/0001-00',
    razao_social: 'MetalFisa',
    menu_config: null,
    general_config: null
};

// Get Company Settings
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, cnpj, razao_social, endereco, bairro, cidade, uf, cep, telefone, menu_config, general_config FROM app_company_settings WHERE id = 1');
        if (rows && rows[0]) {
            lastCompanySettings = rows[0];
        }
        res.json(rows[0] || lastCompanySettings);
    } catch (err) {
        console.warn('⚠️ [COMPANY FALLBACK]', err.message);
        res.json(lastCompanySettings);
    }
});

// Update Company Info ONLY
router.put('/', async (req, res) => {
    try {
        const { cnpj, razao_social, endereco, bairro, cidade, uf, cep, telefone } = req.body;

        // We only update the info fields here, NOT menu_config
        await pool.execute(`
            UPDATE app_company_settings 
            SET cnpj=?, razao_social=?, endereco=?, bairro=?, cidade=?, uf=?, cep=?, telefone=?
            WHERE id = 1
        `, [cnpj, razao_social, endereco, bairro, cidade, uf, cep, telefone]);

        res.json({ message: 'Dados da empresa atualizados com sucesso!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Menu Config ONLY
router.put('/menu', async (req, res) => {
    try {
        const { menu_config } = req.body;
        const menuConfigStr = menu_config ? JSON.stringify(menu_config) : null;

        await pool.execute(`
            UPDATE app_company_settings 
            SET menu_config=?
            WHERE id = 1
        `, [menuConfigStr]);

        res.json({ message: 'Configuração do menu atualizada com sucesso!' });
    } catch (err) {
        console.error("Error updating menu settings:", err);
        res.status(500).json({ error: err.message });
    }
});

// Update General Config ONLY
router.put('/general', async (req, res) => {
    try {
        const { general_config } = req.body;

        // Security check: only SA (SuperAdmin) can change module states
        const isSuperAdmin = req.user?.tipo === 'SA';
        if (!isSuperAdmin) {
            // Fetch current general_config
            const [rows] = await pool.query('SELECT general_config FROM app_company_settings WHERE id = 1');
            const currentConfig = rows[0]?.general_config ? (typeof rows[0].general_config === 'string' ? JSON.parse(rows[0].general_config) : rows[0].general_config) : {};
            
            const currentMaintenance = !!currentConfig?.module_maintenance_active;
            const newMaintenance = !!general_config?.module_maintenance_active;
            const currentSgq = !!currentConfig?.module_sgq_active;
            const newSgq = !!general_config?.module_sgq_active;
            const currentAnalise3d = !!currentConfig?.module_analise3d_active;
            const newAnalise3d = !!general_config?.module_analise3d_active;
            const currentPcpRefinado = !!currentConfig?.module_pcp_refinado_active;
            const newPcpRefinado = !!general_config?.module_pcp_refinado_active;

            if (currentMaintenance !== newMaintenance || currentSgq !== newSgq || currentAnalise3d !== newAnalise3d || currentPcpRefinado !== newPcpRefinado) {
                return res.status(403).json({ error: 'Acesso negado: Apenas SuperAdmins podem alterar o status de ativação de módulos do sistema.' });
            }
        }

        const configStr = general_config ? JSON.stringify(general_config) : null;

        await pool.execute(`
            UPDATE app_company_settings 
            SET general_config=?
            WHERE id = 1
        `, [configStr]);

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
        const autoIncrement = rows[0]?.AUTO_INCREMENT || 0;
        
        res.json({ current_number: autoIncrement });
    } catch (err) {
        console.error("Error fetching romaneio auto increment:", err);
        res.status(500).json({ error: 'Erro ao buscar número do romaneio: ' + err.message });
    }
});

// Set Initial Romaneio Number (AUTO_INCREMENT)
router.post('/set-romaneio-number', async (req, res) => {
    try {
        const { numero_inicial } = req.body;

        const numSafe = parseInt(numero_inicial, 10);
        if (!numero_inicial || isNaN(numSafe) || numSafe < 1 || numSafe > 9999999) {
            return res.status(400).json({ error: 'Número inicial inválido. Informe um número entre 1 e 9999999.' });
        }

        const query = `ALTER TABLE app_romaneios AUTO_INCREMENT = ${numSafe}`;
        await pool.query(query);

        res.json({ message: `Próximo número de Romaneio definido para ${numero_inicial}` });
    } catch (err) {
        console.error("Error setting romaneio auto increment:", err);
        res.status(500).json({ error: 'Erro ao configurar a numeração automática: ' + err.message });
    }
});

module.exports = router;
