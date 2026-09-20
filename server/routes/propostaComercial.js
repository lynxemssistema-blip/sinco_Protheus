const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const DATA_FILE = path.join(__dirname, '../data/proposta_comercial.json');
const SCRIPT_PATH = path.join(__dirname, '../scripts/gerar_proposta_word.py');
const OUTPUT_DOCX = path.resolve(__dirname, '../../Proposta_Comercial_Lynx_Metalfisa_2026.docx');

const { authenticateToken } = require('./auth');

// Middleware estrito: Acesso EXCLUSIVO ao superadmin (login 'Edson'/'SuperAdmin', tipo 'SA' ou 'edsonmanoel2012@gmail.com')
// Bloqueado para qualquer outro usuário, sem possibilidade de concessão de permissão via sistema
const checkSuperAdminOnly = (req, res, next) => {
    const userEmail = (req.user?.email || '').toLowerCase().trim();
    const userLogin = (req.user?.login || '').toLowerCase().trim();
    const userTipo = (req.user?.tipo || '').toUpperCase().trim();
    const userId = req.user?.id;

    const isAuthorized = 
        userLogin === 'superadmin' || 
        userLogin === 'edson' ||
        userTipo === 'SA' ||
        userId === 37 ||
        userEmail === 'edsonmanoel2012@gmail.com' || 
        userLogin === 'edsonmanoel2012@gmail.com';

    if (isAuthorized) {
        return next();
    }

    console.warn(`⛔ [PropostaComercial] Tentativa de acesso negada: id=${userId}, login=${userLogin}, tipo=${userTipo}, email=${userEmail}`);
    return res.status(403).json({
        error: 'Acesso negado: Esta área é estritamente confidencial e de acesso exclusivo do usuário SuperAdmin.'
    });
};

// Aplica autenticação e verificação de Superadmin em todas as rotas
router.use(authenticateToken);
router.use(checkSuperAdminOnly);

// 1. Obter proposta comercial atual
router.get('/', (req, res) => {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            return res.status(404).json({ error: 'Arquivo de proposta comercial não encontrado.' });
        }
        const fileData = fs.readFileSync(DATA_FILE, 'utf-8');
        const json = JSON.parse(fileData);
        res.json(json);
    } catch (err) {
        console.error('❌ Erro ao ler proposta comercial:', err);
        res.status(500).json({ error: 'Falha ao carregar dados da proposta comercial.', detail: err.message });
    }
});

// 2. Atualizar proposta comercial (salvar edições)
router.put('/', (req, res) => {
    try {
        const updatedData = req.body;
        if (!updatedData || typeof updatedData !== 'object') {
            return res.status(400).json({ error: 'Dados da proposta inválidos ou ausentes.' });
        }

        // Criar backup prévio
        if (fs.existsSync(DATA_FILE)) {
            const backupPath = path.join(__dirname, `../data/proposta_comercial_backup_${Date.now()}.json`);
            fs.copyFileSync(DATA_FILE, backupPath);
        }

        fs.writeFileSync(DATA_FILE, JSON.stringify(updatedData, null, 2), 'utf-8');

        // Regenerar o arquivo Word com base nos novos dados
        const pythonProcess = spawn('python', [SCRIPT_PATH, DATA_FILE, OUTPUT_DOCX]);
        pythonProcess.on('close', (code) => {
            if (code === 0) {
                console.log('✅ Documento Word atualizado com sucesso após PUT.');
            } else {
                console.warn(`⚠️ Aviso: Python exit code ${code} ao atualizar docx`);
            }
        });

        res.json({
            success: true,
            message: 'Proposta comercial atualizada com sucesso!',
            data: updatedData
        });
    } catch (err) {
        console.error('❌ Erro ao salvar proposta comercial:', err);
        res.status(500).json({ error: 'Falha ao salvar proposta comercial.', detail: err.message });
    }
});

// 3. Gerar e baixar documento Word (.docx)
router.post('/export-word', (req, res) => {
    try {
        const pythonProcess = spawn('python', [SCRIPT_PATH, DATA_FILE, OUTPUT_DOCX]);

        let stderr = '';
        pythonProcess.stderr.on('data', (chunk) => {
            stderr += chunk.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                console.error('Erro no gerador Python:', stderr);
                return res.status(500).json({ error: 'Erro ao gerar documento Word.', detail: stderr });
            }

            if (!fs.existsSync(OUTPUT_DOCX)) {
                return res.status(500).json({ error: 'Arquivo Word gerado não foi encontrado no disco.' });
            }

            res.download(OUTPUT_DOCX, 'Proposta_Comercial_Lynx_Metalfisa_2026.docx');
        });
    } catch (err) {
        console.error('❌ Erro na exportação do Word:', err);
        res.status(500).json({ error: 'Falha ao exportar documento Word.', detail: err.message });
    }
});

module.exports = router;
