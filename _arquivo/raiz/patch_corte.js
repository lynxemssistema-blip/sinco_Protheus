const fs = require('fs');

let file = fs.readFileSync('server/routes/corte.js', 'utf8');

const newQuery = `
        SELECT DISTINCT 
            TRIM(sc2_filhas.c2_produto) as componente, 
            TRIM(sc2_filhas.c2_num) || TRIM(sc2_filhas.c2_item) || TRIM(sc2_filhas.c2_sequen) as op_numero, 
            sc2_filhas.c2_quant::numeric as qtd_necessaria, 
            TRIM(sb1.b1_desc) as descricao,
            (
                SELECT json_agg(json_build_object(
                    'operacao', TRIM(sg2_sub.g2_operac),
                    'recurso', TRIM(sg2_sub.g2_recurso),
                    'desc_recurso', COALESCE(TRIM(sh1.h1_descri), TRIM(sg2_sub.g2_recurso)),
                    'tempo', sg2_sub.g2_tempad
                ) ORDER BY TRIM(sg2_sub.g2_operac))
                FROM sg2010 sg2_sub
                LEFT JOIN sh1010 sh1 ON TRIM(sh1.h1_codigo) = TRIM(sg2_sub.g2_recurso) AND sh1.d_e_l_e_t_ = ''
                WHERE TRIM(sg2_sub.g2_produto) = TRIM(sc2_filhas.c2_produto) 
                  AND sg2_sub.d_e_l_e_t_ = ''
            ) as roteiro_completo,
            TRIM(sg1_mtc.g1_comp) as mtc_codigo,
            TRIM(sb1_mct.b1_desc) as mtc_descricao 
        FROM sc2010 sc2_pai 
        JOIN sc2010 sc2_filhas ON sc2_filhas.c2_num = sc2_pai.c2_num AND sc2_filhas.d_e_l_e_t_ = '' 
        JOIN sb1010 sb1 ON TRIM(sb1.b1_cod) = TRIM(sc2_filhas.c2_produto) AND sb1.d_e_l_e_t_ = ''
        LEFT JOIN sg1010 sg1_mtc ON TRIM(sg1_mtc.g1_cod) = TRIM(sc2_filhas.c2_produto) AND TRIM(sg1_mtc.g1_comp) LIKE 'MTC%' AND sg1_mtc.d_e_l_e_t_ = '' AND sg1_mtc.g1_filial = '0101' 
        LEFT JOIN sb1010 sb1_mct ON TRIM(sb1_mct.b1_cod) = TRIM(sg1_mtc.g1_comp) AND sb1_mct.d_e_l_e_t_ = ''
        WHERE sc2_pai.d_e_l_e_t_ = '' 
          AND TRIM(sc2_pai.c2_pedido) = $1 
          AND TRIM(sc2_pai.c2_itempv) = $2 
          AND TRIM(sc2_pai.c2_produto) = $3
          AND EXISTS (SELECT 1 FROM sg2010 sg2_check WHERE TRIM(sg2_check.g2_produto) = TRIM(sc2_filhas.c2_produto) AND sg2_check.d_e_l_e_t_ = '')
        `;

const oldQueryRegex = /SELECT DISTINCT[\s\S]*?TRIM\(sc2_pai\.c2_produto\) = \$3\s*`;/g;
file = file.replace(oldQueryRegex, newQuery.trim() + '\n        `;');

const newQueryByOp = `
                SELECT DISTINCT 
                    TRIM(sc2_filhas.c2_produto) as componente, 
                    TRIM(sc2_filhas.c2_num) || TRIM(sc2_filhas.c2_item) || TRIM(sc2_filhas.c2_sequen) as op_numero, 
                    sc2_filhas.c2_quant::numeric as qtd_necessaria, 
                    TRIM(sb1.b1_desc) as descricao,
                    (
                        SELECT json_agg(json_build_object(
                            'operacao', TRIM(sg2_sub.g2_operac),
                            'recurso', TRIM(sg2_sub.g2_recurso),
                            'desc_recurso', COALESCE(TRIM(sh1.h1_descri), TRIM(sg2_sub.g2_recurso)),
                            'tempo', sg2_sub.g2_tempad
                        ) ORDER BY TRIM(sg2_sub.g2_operac))
                        FROM sg2010 sg2_sub
                        LEFT JOIN sh1010 sh1 ON TRIM(sh1.h1_codigo) = TRIM(sg2_sub.g2_recurso) AND sh1.d_e_l_e_t_ = ''
                        WHERE TRIM(sg2_sub.g2_produto) = TRIM(sc2_filhas.c2_produto) 
                          AND sg2_sub.d_e_l_e_t_ = ''
                    ) as roteiro_completo,
                    TRIM(sg1_mtc.g1_comp) as mtc_codigo,
                    TRIM(sb1_mct.b1_desc) as mtc_descricao 
                FROM sc2010 sc2_filhas 
                JOIN sb1010 sb1 ON TRIM(sb1.b1_cod) = TRIM(sc2_filhas.c2_produto) AND sb1.d_e_l_e_t_ = ''
                LEFT JOIN sg1010 sg1_mtc ON TRIM(sg1_mtc.g1_cod) = TRIM(sc2_filhas.c2_produto) AND TRIM(sg1_mtc.g1_comp) LIKE 'MTC%' AND sg1_mtc.d_e_l_e_t_ = '' AND sg1_mtc.g1_filial = '0101' 
                LEFT JOIN sb1010 sb1_mct ON TRIM(sb1_mct.b1_cod) = TRIM(sg1_mtc.g1_comp) AND sb1_mct.d_e_l_e_t_ = ''
                WHERE sc2_filhas.d_e_l_e_t_ = '' 
                  AND sc2_filhas.c2_num = $1
                  AND EXISTS (SELECT 1 FROM sg2010 sg2_check WHERE TRIM(sg2_check.g2_produto) = TRIM(sc2_filhas.c2_produto) AND sg2_check.d_e_l_e_t_ = '')
                `;

const oldQueryByOpRegex = /SELECT DISTINCT[\s\S]*?AND sc2_filhas\.c2_num = \$1\s*`;/g;
file = file.replace(oldQueryByOpRegex, newQueryByOp.trim() + '\n                `;');


// Modify parsing logic to handle the new roteiro_completo
const parseLogicRegex = /for \(const row of pgRes\.rows\) \{[\s\S]*?\}\s*\}/g;
const newParseLogic = `for (const row of pgRes.rows) {
                let firstRes = 'INDEFINIDO';
                let totalTempo = 0;
                let fullRouteStr = '';
                try {
                    const roteiro = Array.isArray(row.roteiro_completo) ? row.roteiro_completo : JSON.parse(row.roteiro_completo || '[]');
                    if (roteiro.length > 0) {
                        firstRes = roteiro[0].desc_recurso || roteiro[0].recurso;
                        totalTempo = roteiro.reduce((acc, curr) => acc + (parseFloat(curr.tempo) || 0), 0);
                        fullRouteStr = roteiro.map(r => r.desc_recurso || r.recurso).join(' -> ');
                    }
                } catch(e) {}

                resultados.push({
                    pedido_pai: item.pedido,
                    item_pai: item.item,
                    produto_pai: produto_pai,
                    op_numero: row.op_numero,
                    componente: row.componente,
                    componente_descricao: row.descricao,
                    recurso: firstRes, // legacy
                    recurso_nome: firstRes, // legacy
                    roteiro_completo: row.roteiro_completo,
                    roteiro_str: fullRouteStr,
                    tempo_unitario: totalTempo,
                    mtc_codigo: row.mtc_codigo || 'SEM_MTC',
                    mtc_descricao: row.mtc_descricao || 'Material não encontrado',
                    qtd_necessaria: parseFloat(row.qtd_necessaria) || 0
                });
            }
        }`;
file = file.replace(parseLogicRegex, newParseLogic);

// Add Routing Groups CRUD endpoints at the bottom
const crudEndpoints = `

// -------------------------------------------------------------
// Routing Groups CRUD
// -------------------------------------------------------------
router.get('/routing-groups', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query('SELECT * FROM app_routing_groups ORDER BY name ASC');
        const groups = rows.map(r => ({ ...r, rules: typeof r.rules === 'string' ? JSON.parse(r.rules) : r.rules }));
        res.json({ success: true, groups });
    } catch(e) {
        if(e.code === 'ER_NO_SUCH_TABLE') return res.json({ success: true, groups: [] });
        console.error(e);
        res.status(500).json({ error: 'Erro ao buscar grupos de roteiro.' });
    }
});

router.post('/routing-groups', async (req, res) => {
    try {
        const { name, rules } = req.body;
        // make sure table exists
        await mysqlPool.query(\`CREATE TABLE IF NOT EXISTS app_routing_groups (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            rules JSON NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )\`);
        const rulesStr = JSON.stringify(rules);
        await mysqlPool.query('INSERT INTO app_routing_groups (name, rules) VALUES (?, ?)', [name, rulesStr]);
        res.json({ success: true });
    } catch(e) {
        console.error(e);
        res.status(500).json({ error: 'Erro ao criar grupo.' });
    }
});

router.put('/routing-groups/:id', async (req, res) => {
    try {
        const { name, rules } = req.body;
        const rulesStr = JSON.stringify(rules);
        await mysqlPool.query('UPDATE app_routing_groups SET name = ?, rules = ? WHERE id = ?', [name, rulesStr, req.params.id]);
        res.json({ success: true });
    } catch(e) {
        console.error(e);
        res.status(500).json({ error: 'Erro ao atualizar grupo.' });
    }
});

router.delete('/routing-groups/:id', async (req, res) => {
    try {
        await mysqlPool.query('DELETE FROM app_routing_groups WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch(e) {
        console.error(e);
        res.status(500).json({ error: 'Erro ao excluir grupo.' });
    }
});

module.exports = router;
`;
file = file.replace(/module\.exports = router;[\s\S]*$/, crudEndpoints);

fs.writeFileSync('server/routes/corte.js', file);
console.log('patched corte.js');
