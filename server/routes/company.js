const express = require('express');
const router = express.Router();
const pool = require('../services/mysqlService');

// Get Company Settings
router.get('/', async (req, res) => {
    try {
        console.log('📊 [COMPANY] GET request received');
        const [rows] = await pool.query('SELECT * FROM app_company_settings WHERE id = 1');
        console.log('✅ [COMPANY] Query successful, rows:', rows.length);
        res.json(rows[0] || {});
    } catch (err) {
        console.error('❌ [COMPANY ERROR]', err.message);
        console.error('[COMPANY ERROR STACK]', err.stack);
        res.status(500).json({ error: err.message });
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
        
        if (!numero_inicial || isNaN(numero_inicial)) {
            return res.status(400).json({ error: 'Número inicial inválido.' });
        }

        const query = `ALTER TABLE app_romaneios AUTO_INCREMENT = ${parseInt(numero_inicial, 10)}`;
        await pool.query(query);

        res.json({ message: `Próximo número de Romaneio definido para ${numero_inicial}` });
    } catch (err) {
        console.error("Error setting romaneio auto increment:", err);
        res.status(500).json({ error: 'Erro ao configurar a numeração automática: ' + err.message });
    }
});

module.exports = router;
