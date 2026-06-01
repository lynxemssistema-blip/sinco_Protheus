const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/clients/search
router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.length < 2) {
            const queryTop = `
                WITH TopClientes AS (
                    SELECT TRIM(z1_cliente) AS z1_cliente
                    FROM public.sz1010
                    WHERE COALESCE(d_e_l_e_t_, '') <> '*'
                    GROUP BY TRIM(z1_cliente)
                    ORDER BY COUNT(*) DESC
                    LIMIT 20
                )
                SELECT 
                    TRIM(a1_cod) AS codigo,
                    TRIM(a1_loja) AS loja,
                    TRIM(a1_nome) AS nome,
                    TRIM(a1_nreduz) AS nreduz,
                    'Cliente' AS tipo
                FROM public.sa1010
                INNER JOIN TopClientes ON TRIM(a1_cod) = TopClientes.z1_cliente
                WHERE COALESCE(d_e_l_e_t_, '') <> '*'
                ORDER BY a1_nome
            `;
            const resultTop = await db.query(queryTop);
            return res.json(resultTop.rows);
        }

        const searchTerm = `%${q}%`;

        const query = `
            WITH partners AS (
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
                    TRIM(a1_tel) AS telefone,
                    'Cliente' AS tipo
                FROM public.sa1010
                WHERE 
                    COALESCE(d_e_l_e_t_, '') <> '*'
                    AND (
                        a1_cod ILIKE $1 
                        OR a1_nome ILIKE $1 
                        OR a1_nreduz ILIKE $1
                    )
                UNION ALL
                SELECT 
                    TRIM(a2_cod) AS codigo,
                    TRIM(a2_loja) AS loja,
                    TRIM(a2_nome) AS nome,
                    TRIM(a2_nreduz) AS nreduz,
                    TRIM(a2_end) AS endereco,
                    TRIM(a2_bairro) AS bairro,
                    TRIM(a2_mun) AS cidade,
                    TRIM(a2_est) AS uf,
                    TRIM(a2_cep) AS cep,
                    TRIM(a2_tel) AS telefone,
                    'Fornecedor' AS tipo
                FROM public.sa2010
                WHERE 
                    COALESCE(d_e_l_e_t_, '') <> '*'
                    AND (
                        a2_cod ILIKE $1 
                        OR a2_nome ILIKE $1 
                        OR a2_nreduz ILIKE $1
                    )
            )
            SELECT * FROM partners
            ORDER BY nome
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
