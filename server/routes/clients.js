const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/clients/search
router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.length < 2) {
            return res.json([]);
        }

        const searchTerm = `%${q}%`;

        const query = `
            SELECT 
                TRIM(a1_cod) AS codigo,
                TRIM(a1_loja) AS loja,
                TRIM(a1_nome) AS nome,
                TRIM(a1_nreduz) AS nreduz,
                TRIM(a1_end) AS endereco,
                TRIM(a1_bairro) AS bairro,
                TRIM(a1_mun) AS cidade,
                TRIM(a1_est) AS uf,
                TRIM(a1_cep) AS cep,
                TRIM(a1_tel) AS telefone
            FROM public.sa1010
            WHERE 
                COALESCE(d_e_l_e_t_, '') = ''
                AND (
                    a1_cod ILIKE $1 
                    OR a1_nome ILIKE $1 
                    OR a1_nreduz ILIKE $1
                )
            ORDER BY a1_nome
            LIMIT 50
        `;

        const result = await db.query(query, [searchTerm]);
        res.json(result.rows);

    } catch (err) {
        console.error('Error searching clients:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
