const express = require('express');
const router = express.Router();
const pool = require('../services/mysqlService');
const protheusDB = require('../services/protheusDB');
const sincoAgentBridge = require('../services/sincoAgentBridge');

console.log('🔄 [DEBUG] Loading Sinco Routes...');

// Helper to format date for SQL
const formatDate = (date) => {
    return date ? new Date(date).toISOString().slice(0, 10) : null;
};


// GET /api/sinco/os
// List all Service Orders with basic filtering
router.get('/os', async (req, res) => {
    try {
        const { cliente, data_inicio, data_fim, status, id } = req.query;

        // Using columns provided by user
        let query = `
            SELECT 
                IdOrdemServico,
                Projeto,
                Tag,
                DescTag,
                Descricao,
                EnderecoOrdemServico,
                CriadoPor,
                DataCriacao,
                Estatus,
                Liberado_Engenharia,
                Data_Liberacao_Engenharia,
                DescEmpresa as Cliente, 
                AreaPinturaTotal,
                PesoTotal,
                OrdemServicoFinalizado,
                DataFinalizado,
                DataFinalizacao
            FROM ordemservico 
            WHERE 1=1 AND (D_E_L_E_T_E IS NULL OR D_E_L_E_T_E = '')
        `;

        const params = [];

        if (id) {
            query += ` AND IdOrdemServico = ?`;
            params.push(id);
        }

        if (cliente) {
            query += ` AND DescEmpresa LIKE ?`;
            params.push(`%${cliente}%`);
        }

        if (data_inicio) {
            query += ` AND DataCriacao >= ?`;
            params.push(data_inicio);
        }

        if (data_fim) {
            query += ` AND DataCriacao <= ?`;
            params.push(data_fim);
        }

        // Status filter
        if (status === 'aberto') {
            query += ` AND (OrdemServicoFinalizado IS NULL OR OrdemServicoFinalizado != 'S')`;
        } else if (status === 'finalizado') {
            query += ` AND OrdemServicoFinalizado = 'S'`;
        }

        query += ` ORDER BY IdOrdemServico DESC LIMIT 500`; // Safety limit

        console.log('📊 [SINCO] Executing query with params:', params);
        const [rows] = await pool.query(query, params);
        console.log(`✅ [SINCO] Query successful. Returned ${rows.length} rows.`);
        res.json(rows);

    } catch (error) {
        console.error('❌ Erro ao buscar Ordens de Serviço:', error);
        res.status(500).json({ error: error.message || 'Erro interno ao buscar Ordens de Serviço' });
    }
});

// GET /api/sinco/os/:id/items
// Get items for a specific Service Order
router.get('/os/:id/items', async (req, res) => {
    try {
        const { id } = req.params;

        // Items query with specific columns as requested by user
        const query = `
            SELECT 
                IdOrdemServicoItem, 
                IdOrdemServico, 
                Projeto, 
                Tag, 
                DescTag, 
                Estatus_OrdemServico, 
                IdMaterial, 
                QtdeTotal, 
                CriadoPor, 
                DataCriacao, 
                Estatus, 
                Acabamento, 
                D_E_L_E_T_E, 
                OrdemServicoItemFinalizado, 
                IdEmpresa, 
                idProjeto, 
                IdTag, 
                DescResumo, 
                DescDetal, 
                Autor, 
                Palavrachave, 
                Notas, 
                Espessura, 
                AreaPintura, 
                NumeroDobras, 
                Peso, 
                Unidade, 
                UnidadeSW, 
                ValorSW, 
                Altura, 
                Largura, 
                CodMatFabricante, 
                EnderecoArquivo, 
                MaterialSW, 
                Fator, 
                qtde, 
                txtTipoDesenho, 
                descempresa, 
                ProdutoPrincipal,
                AreaPinturaUnitario, 
                PesoUnitario, 
                IdPlanodecorte,
                Nivel
            FROM ordemservicoitem
            WHERE IdOrdemServico = ?
        `;

        const [rows] = await pool.query(query, [id]);
        res.json(rows);

    } catch (error) {
        console.error('Erro ao buscar itens da OS:', error);
        res.status(500).json({ error: 'Erro interno ao buscar itens da OS' });
    }
});

// GET /api/sinco/produtos-raizes
// List all root products that have a structure loaded
router.get('/produtos-raizes', async (req, res) => {
    try {
        const query = `
            SELECT DISTINCT 
                p.CodProdutoPai as value, 
                p.CodProdutoPai as label,
                m.DescDetal as description
            FROM produto_estrutura_item p
            LEFT JOIN viewmontapeca m 
                ON p.CodProdutoPai = m.NomeArquivoSemExtensao 
                OR p.CodProdutoPai = CONCAT(m.NomeArquivoSemExtensao, '.asm')
                OR p.CodProdutoPai = CONCAT(m.NomeArquivoSemExtensao, '.ASM')
            ORDER BY p.CodProdutoPai ASC
        `;
        const [rows] = await pool.query(query);

        // Deduplicate in JS just in case of multiple matches in viewmontapeca
        const unique = [];
        const seen = new Set();

        for (const r of rows) {
            if (!seen.has(r.value)) {
                seen.add(r.value);
                const desc = r.description ? ` - ${r.description}` : '';
                unique.push({
                    value: r.value,
                    label: `${r.label}${desc}`
                });
            }
        }

        res.json(unique);
    } catch (error) {
        console.error('❌ Erro ao buscar produtos raízes:', error);
        res.status(500).json({ error: 'Erro interno ao buscar produtos raízes' });
    }
});

// GET /api/sinco/estrutura/:codProdutoPai
// Retorna a árvore completa da Estrutura do Produto, incluindo Módulos, Materiais Consumidos e Processos
router.get('/estrutura/:codProdutoPai', async (req, res) => {
    try {
        const { codProdutoPai } = req.params;

        const queryEstrutura = `
            SELECT p.IdProdutoEstruturaItem, p.CodProdutoPai, p.CodMatFabricante, p.nivel, p.QtdeTotal, p.DescResumo, p.MaterialSW, m.EnderecoArquivo, m.Unidade, p.txtTipoDesenho
            FROM produto_estrutura_item p
            LEFT JOIN material m ON p.CodMatFabricante = m.CodMatFabricante
            WHERE p.CodProdutoPai = ?
            ORDER BY p.IdProdutoEstruturaItem ASC
        `;
        const [items] = await pool.query(queryEstrutura, [codProdutoPai]);

        if (items.length === 0) {
            return res.status(404).json({ error: 'Produto pai não encontrado na estrutura.' });
        }

        // Fetch Protheus Metadata for the root product
        const pgPool = require('../db');
        let protheusData = null;
        try {
            // First get the base metadata from sb1010
            const prodQuery = `
                SELECT 
                    TRIM(b1_rev) AS revisao,
                    TRIM(b1_xdesen) AS desenho_cliente_base,
                    TRIM(b1_xrevcli) AS rev_cliente_base
                FROM public.sb1010
                WHERE TRIM(b1_cod) = $1
                  AND TRIM(COALESCE(d_e_l_e_t_, '')) <> '*'
            `;
            const pgResult = await pgPool.query(prodQuery, [codProdutoPai]);
            if (pgResult.rows.length > 0) {
                protheusData = pgResult.rows[0];
                
                // Now query SC6 (Pedidos de Venda) for C6_XREVM (Rev Cliente) and C6_CLI (Ref Cliente)
                const opsQuery = `
                    SELECT 
                        TRIM(c6_xrevm) as c6_xrevm,
                        TRIM(c6_cli) as c6_cli
                    FROM public.sc6010
                    WHERE TRIM(c6_produto) = $1
                      AND TRIM(COALESCE(d_e_l_e_t_, '')) <> '*'
                      AND (TRIM(c6_xrevm) <> '' OR TRIM(c6_cli) <> '')
                    ORDER BY r_e_c_n_o_ DESC
                `;
                const opsResult = await pgPool.query(opsQuery, [codProdutoPai]);
                
                if (opsResult.rows.length > 0) {
                    // Latest revision from SC6
                    const latestRev = opsResult.rows.find(r => r.c6_xrevm)?.c6_xrevm;
                    protheusData.rev_cliente = latestRev || protheusData.rev_cliente_base;
                    
                    // Unique references from C6_CLI
                    const uniqueRefs = [...new Set(opsResult.rows.map(r => r.c6_cli).filter(c => c))];
                    if (uniqueRefs.length > 0) {
                        protheusData.desenho_cliente = uniqueRefs.join(' / ');
                    } else {
                        protheusData.desenho_cliente = protheusData.desenho_cliente_base;
                    }
                } else {
                    protheusData.rev_cliente = protheusData.rev_cliente_base;
                    protheusData.desenho_cliente = protheusData.desenho_cliente_base;
                }
            }
        } catch (pgErr) {
            console.error('⚠️ [SINCO] Erro ao buscar metadados do Protheus (Ficha Técnica):', pgErr.message);
        }

        // Find unresolved comments related to the tree items
        const pieceCodes = [...new Set(items.map(i => i.CodMatFabricante))];
        let unresolvedItems = [];
        if (pieceCodes.length > 0) {
            const placeholders = pieceCodes.map(() => '?').join(',');
            const [unresolvedRows] = await pool.query(`
                SELECT DISTINCT CodMatFabricante 
                FROM sinco_comentarios_engenharia 
                WHERE CodMatFabricante IN (${placeholders}) 
                AND Status NOT IN ('FEITO', 'RESOLVIDO')
            `, pieceCodes);
            unresolvedItems = unresolvedRows.map(r => r.CodMatFabricante);
        }

        let materials = [];
        let processes = [];

        if (pieceCodes.length > 0) {
            const placeholders = pieceCodes.map(() => '?').join(',');

            // Match NomeArquivoSemExtensao against pieceCodes with or without file extension.
            // e.g. viewmontapeca stores 'MT3-14719.ASM' but CodMatFabricante may be 'MT3-14719'
            const queryMaterials = `
                SELECT NomeArquivoSemExtensao AS pieceCode,
                       CodMatFabricante       AS materialCode,
                       NumeroRP               AS numeroRP,
                       DescDetal              AS materialDescDetal,
                       DescFamilia            AS familia,
                       CodigoJuridicoMat      AS codigoJuridico,
                       Unidade                AS unidade,
                       txtItemEstoque,
                       PecaQtde               AS quantity,
                       Peso                   AS peso
                FROM viewmontapeca
                WHERE (
                    NomeArquivoSemExtensao IN (${placeholders})
                    OR SUBSTRING_INDEX(NomeArquivoSemExtensao, '.', 1) IN (${placeholders})
                )
                ORDER BY NomeArquivoSemExtensao, DescDetal
            `;
            try {
                const [matResult] = await pool.query(queryMaterials, [...pieceCodes, ...pieceCodes]);
                materials = matResult;
            } catch (matErr) {
                console.error('⚠️ Erro ao buscar materiais (viewmontapeca):', matErr.message);
            }

            const queryProcesses = `
                SELECT mp.codmatFabricante as pieceCode, 
                       p.processofabricacao as processName, 
                       mp.SequenciaExecucao as sequence, 
                       mp.TempoPadraoMin as timeMin
                FROM material_processo mp
                LEFT JOIN processofabricacao p ON mp.IdProcesso = p.IdProcessoFabricacao
                WHERE mp.codmatFabricante IN (${placeholders})
                ORDER BY mp.codmatFabricante, mp.SequenciaExecucao ASC
            `;
            const [procResult] = await pool.query(queryProcesses, pieceCodes);
            processes = procResult;
        }

        // Structuring the final response
        const fs = require('fs');

        // Strip file extension (e.g. '.ASM', '.PAR') — viewmontapeca may store the
        // extension in NomeArquivoSemExtensao while produto_estrutura_item may not.
        const stripExt = (s) => String(s || '').toLowerCase().replace(/\.[a-z]+$/i, '');

        const { normalizeFilePath, resolveCaseInsensitivePath } = require('../utils/pathResolver');

        const structure = items.map(item => {
            let hasPdfFile = false;
            let finalPdfPath = null;
            if (item.EnderecoArquivo) {
                try {
                    const normalized = normalizeFilePath(item.EnderecoArquivo);
                    const resolved = resolveCaseInsensitivePath(normalized);

                    // Check if file physically exists on the Linux server path
                    if (fs.existsSync(resolved)) {
                        hasPdfFile = true;
                        // Keep original windows path verbatim for frontend to request correctly
                        finalPdfPath = item.EnderecoArquivo;
                    }
                } catch (e) {
                    // File access error, default to false
                }
            }

            const baseCod = stripExt(item.CodMatFabricante);

            return {
                ...item,
                materiais: materials.filter(m => stripExt(m.pieceCode) === baseCod),
                processos: processes.filter(p => stripExt(p.pieceCode) === baseCod),
                hasPdfFile,
                pdfPath: finalPdfPath
            };
        });

        let revisionsSummary = [];
        if (pieceCodes.length > 0) {
            try {
                const cleanPieceCodes = [...new Set(pieceCodes.map(c => stripExt(c).toUpperCase()))];
                const revQuery = `
                    SELECT 
                        TRIM(sb1.b1_cod) as codigo,
                        TRIM(sb1.b1_desc) as descricao,
                        TRIM(sb1.b1_rev) as revisao_mf,
                        TRIM(sb1.b1_xrevcli) as revisao_cli,
                        TRIM(sb1.b1_xdesen) as desenho_cli,
                        sb1.b1_msblql as bloqueio_padrao,
                        (SELECT sz0.z0_status FROM public.sz0010 sz0 WHERE TRIM(sz0.z0_produto) = TRIM(sb1.b1_cod) AND COALESCE(sz0.d_e_l_e_t_, '') <> '*' AND COALESCE(sz0.z0_status, '') <> 'L' ORDER BY sz0.r_e_c_n_o_ DESC LIMIT 1) as bloqueio_eng
                    FROM public.sb1010 sb1
                    WHERE TRIM(sb1.b1_cod) = ANY($1::text[])
                      AND COALESCE(sb1.d_e_l_e_t_, '') <> '*'
                    ORDER BY sb1.b1_cod ASC
                `;
                const revResult = await pgPool.query(revQuery, [cleanPieceCodes]);
                revisionsSummary = revResult.rows.map(row => {
                    let statusText = 'Normal';
                    if (row.bloqueio_padrao === '1' || row.bloqueio_padrao === 'S' || row.bloqueio_padrao === 'T' || row.bloqueio_padrao === 'Y') {
                        statusText = 'Restrição (Protheus)';
                    } else if (row.bloqueio_eng === 'P') {
                        statusText = 'Restrição Pendente (PCP/Eng)';
                    }
                    return {
                        codigo: row.codigo,
                        descricao: row.descricao,
                        revisao_mf: row.revisao_mf || '-',
                        revisao_cli: row.revisao_cli || '-',
                        desenho_cli: row.desenho_cli || '-',
                        status: statusText
                    };
                });
            } catch (rErr) {
                console.error('⚠️ [SINCO] Erro ao buscar resumo de revisões:', rErr.message);
            }
        }

        res.json({
            rootCode: codProdutoPai,
            protheusData,
            tree: structure,
            unresolvedComments: unresolvedItems,
            revisionsSummary
        });

    } catch (error) {
        console.error('❌ Erro ao buscar Estrutura do Produto:', error);
        res.status(500).json({ error: error.message || 'Erro interno ao buscar estrutura' });
    }
});

// --- COMENTÁRIOS E REVISÕES DE ENGENHARIA ---

// GET /api/sinco/comentarios/:codigo
router.get('/comentarios/:codigo', async (req, res) => {
    try {
        const { codigo } = req.params;
        const [rows] = await pool.query(`
            SELECT * FROM sinco_comentarios_engenharia 
            WHERE CodMatFabricante = ? 
            ORDER BY DataCriacao DESC
        `, [codigo]);
        res.json(rows);
    } catch (error) {
        console.error('❌ Erro ao buscar comentários:', error);
        res.status(500).json({ error: 'Erro interno ao buscar comentários' });
    }
});

// POST /api/sinco/comentarios/:codigo
router.post('/comentarios/:codigo', async (req, res) => {
    try {
        const { codigo } = req.params;
        const { ProdutoPai, Nivel, UsuarioCriacao, Comentario } = req.body;

        await pool.query(`
            INSERT INTO sinco_comentarios_engenharia 
            (CodMatFabricante, ProdutoPai, Nivel, UsuarioCriacao, Comentario) 
            VALUES (?, ?, ?, ?, ?)
        `, [codigo, ProdutoPai || '', Nivel || 0, UsuarioCriacao, Comentario]);

        res.status(201).json({ success: true });
    } catch (error) {
        console.error('❌ Erro ao adicionar comentário:', error);
        res.status(500).json({ error: 'Erro interno ao adicionar comentário' });
    }
});

// PUT /api/sinco/comentarios/:id/status
router.put('/comentarios/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { Status, ObservacaoProjetista, UsuarioResolucao } = req.body;

        await pool.query(`
            UPDATE sinco_comentarios_engenharia 
            SET Status = ?, 
                ObservacaoProjetista = ?, 
                UsuarioResolucao = ?, 
                DataResolucao = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [Status, ObservacaoProjetista || '', UsuarioResolucao, id]);

        res.json({ success: true });
    } catch (error) {
        console.error('❌ Erro ao atualizar comentário:', error);
        res.status(500).json({ error: 'Erro interno ao atualizar comentário' });
    }
});

// --- MATERIAIS DE APOIO (DENSIDADE) ---

// CREATE TABLE IF NOT EXISTS on first run (lazy init)
let dbInitialized = false;
async function initMateriaisApoioDB() {
    if (dbInitialized) return;
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS sinco_materiais_densidade (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nome VARCHAR(100) NOT NULL UNIQUE,
                densidade DECIMAL(10,3) NOT NULL,
                criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        // Inserir os padrões caso a tabela esteja vazia
        const [rows] = await pool.query('SELECT COUNT(*) as count FROM sinco_materiais_densidade');
        if (rows[0].count === 0) {
            await pool.query(`
                INSERT INTO sinco_materiais_densidade (nome, densidade) VALUES
                ('Aço Carbono', 7.85),
                ('Aço Inox', 7.93),
                ('Alumínio', 2.70),
                ('Latão', 8.50)
            `);
        }
        dbInitialized = true;
    } catch (error) {
        console.error('❌ Erro ao inicializar tabela sinco_materiais_densidade:', error.message);
    }
}

// GET /api/sinco/materiais-apoio
router.get('/materiais-apoio', async (req, res) => {
    try {
        await initMateriaisApoioDB();
        const [rows] = await pool.query('SELECT * FROM sinco_materiais_densidade ORDER BY nome ASC');
        res.json(rows);
    } catch (error) {
        console.error('❌ Erro ao buscar materiais de apoio:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erro interno ao buscar materiais de apoio', 
            details: error.message,
            endpoint: '/api/sinco/materiais-apoio',
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/sinco/materiais-apoio
router.post('/materiais-apoio', async (req, res) => {
    try {
        const { nome, densidade } = req.body;
        if (!nome || !densidade) {
            return res.status(400).json({ 
                success: false, 
                error: 'Nome e densidade são obrigatórios', 
                frontendPayload: req.body,
                endpoint: '/api/sinco/materiais-apoio',
                timestamp: new Date().toISOString()
            });
        }
        
        await initMateriaisApoioDB();
        
        await pool.query(`
            INSERT INTO sinco_materiais_densidade (nome, densidade) 
            VALUES (?, ?) 
            ON DUPLICATE KEY UPDATE densidade = VALUES(densidade)
        `, [nome, parseFloat(densidade)]);
        
        res.status(201).json({ 
            success: true, 
            message: 'Material cadastrado/atualizado com sucesso', 
            data: { nome, densidade: parseFloat(densidade) },
            frontendPayload: req.body,
            endpoint: '/api/sinco/materiais-apoio',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Erro ao adicionar material:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erro interno ao adicionar material', 
            details: error.message,
            frontendPayload: req.body,
            endpoint: '/api/sinco/materiais-apoio',
            timestamp: new Date().toISOString()
        });
    }
});

// PUT /api/sinco/materiais-apoio
router.put('/materiais-apoio', async (req, res) => {
    try {
        const { nomeOriginal, nome, densidade } = req.body;
        if (!nomeOriginal || !nome || !densidade) {
            return res.status(400).json({ 
                success: false, 
                error: 'nomeOriginal, nome e densidade são obrigatórios', 
                frontendPayload: req.body,
                endpoint: '/api/sinco/materiais-apoio',
                timestamp: new Date().toISOString()
            });
        }
        
        await initMateriaisApoioDB();
        
        if (nomeOriginal !== nome) {
            await pool.query('DELETE FROM sinco_materiais_densidade WHERE nome = ?', [nomeOriginal]);
            await pool.query(`
                INSERT INTO sinco_materiais_densidade (nome, densidade) 
                VALUES (?, ?) 
                ON DUPLICATE KEY UPDATE densidade = VALUES(densidade)
            `, [nome, parseFloat(densidade)]);
        } else {
            await pool.query('UPDATE sinco_materiais_densidade SET densidade = ? WHERE nome = ?', [parseFloat(densidade), nome]);
        }
        
        res.json({ 
            success: true, 
            message: 'Material atualizado com sucesso', 
            data: { nomeOriginal, nome, densidade: parseFloat(densidade) },
            frontendPayload: req.body,
            endpoint: '/api/sinco/materiais-apoio',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Erro ao atualizar material:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erro interno ao atualizar material', 
            details: error.message,
            frontendPayload: req.body,
            endpoint: '/api/sinco/materiais-apoio',
            timestamp: new Date().toISOString()
        });
    }
});

// DELETE /api/sinco/materiais-apoio
router.delete('/materiais-apoio', async (req, res) => {
    try {
        const { nome } = req.body;
        if (!nome) {
            return res.status(400).json({ 
                success: false, 
                error: 'Nome é obrigatório', 
                frontendPayload: req.body,
                endpoint: '/api/sinco/materiais-apoio',
                timestamp: new Date().toISOString()
            });
        }
        
        await initMateriaisApoioDB();
        await pool.query('DELETE FROM sinco_materiais_densidade WHERE nome = ?', [nome]);
        
        res.json({ 
            success: true, 
            message: 'Material excluído com sucesso', 
            data: { nome },
            frontendPayload: req.body,
            endpoint: '/api/sinco/materiais-apoio',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Erro ao excluir material:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erro interno ao excluir material', 
            details: error.message,
            frontendPayload: req.body,
            endpoint: '/api/sinco/materiais-apoio',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * SOLIDEDGE INTEGRATION (Local Agent Proxy)
 */

// GET /api/sinco/status
router.get('/status', async (req, res) => {
    try {
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const status = await sincoAgentBridge.checkAgentStatus(clientIp);
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao verificar status do agent', details: error.message });
    }
});

// GET /api/sinco/active-document
router.get('/active-document', async (req, res) => {
    try {
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const document = await sincoAgentBridge.getActiveDocument(clientIp);
        if (document.error) {
            return res.status(404).json(document);
        }
        res.json(document);
    } catch (error) {
        console.error('❌ Erro no bridge SINCO:', error.message);
        res.status(500).json({
            error: 'Erro ao obter documento ativo',
            details: error.response?.data?.error || error.message
        });
    }
});

// POST /api/sinco/export-dxf
router.post('/export-dxf', async (req, res) => {
    try {
        const { outputPath } = req.body;
        const result = await sincoAgentBridge.exportDxf(outputPath);
        if (!result.success) {
            return res.status(400).json(result);
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao exportar DXF', details: error.message });
    }
});

// POST /api/sinco/export-pdf
router.post('/export-pdf', async (req, res) => {
    try {
        const { outputPath } = req.body;
        const result = await sincoAgentBridge.exportPdf(outputPath);
        if (!result.success) {
            return res.status(400).json(result);
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao exportar PDF', details: error.message });
    }
});

// GET /api/sinco/integrated-product-view
// Combina dados do SolidEdge Agent com dados do Protheus (Produto, BOM, Roteiro)
router.get('/integrated-product-view', async (req, res) => {
    try {
        // Import pool here for database queries
        const pool = require('../db');
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

        console.log('🔄 [SINCO Integration] Buscando dados integrados SolidEdge + Protheus...');

        //  1. Buscar dados do doumento ativo no SolidEdge
        const activeDoc = await sincoAgentBridge.getActiveDocument(clientIp);

        if (activeDoc.error) {
            console.log('⚠️ [SINCO Integration] Erro ao obter documento:', activeDoc.error);

            // Diagnóstico adicional
            const agentStatus = await sincoAgentBridge.checkAgentStatus(clientIp);

            return res.status(404).json({
                error: 'Nenhum documento ativo ou Agent desconectado',
                details: activeDoc.error,
                diagnosis: {
                    agentStatus: agentStatus,
                    activePort: sincoAgentBridge.activePort,
                    checkedPorts: sincoAgentBridge.basePorts
                }
            });
        }

        // Extrair código do produto do nome do arquivo (remove extensão)
        const fileName = activeDoc.basic?.fileName || '';
        const productCode = fileName.replace(/\.[^/.]+$/, '').trim(); // Remove extensão (.psm, .par, .asm)

        if (!productCode) {
            return res.status(400).json({
                error: 'Não foi possível identificar código do produto',
                fileName
            });
        }

        console.log(`📦 [SINCO Integration] Código extraído do arquivo: ${productCode}`);

        // Definição das Queries
        const productQuery = `
            SELECT 
                TRIM(b1_cod) AS codigo,
                b1_desc AS descricao,
                b1_tipo AS tipo,
                b1_um AS unidade,
                b1_grupo AS grupo,
                b1_locpad AS almoxarifado_padrao
            FROM public.sb1010 
            WHERE TRIM(b1_cod) = $1 
            AND TRIM(COALESCE(d_e_l_e_t_, '')) <> '*'
        `;

        const bomQuery = `
            SELECT 
                TRIM(g1_comp) AS componente,
                g1_quant AS quantidade,
                sb1.b1_desc AS descricao,
                sb1.b1_um AS unidade
            FROM public.sg1010 g1
            LEFT JOIN public.sb1010 sb1 
                ON TRIM(sb1.b1_cod) = TRIM(g1.g1_comp)
                AND TRIM(COALESCE(sb1.d_e_l_e_t_, '')) <> '*'
            WHERE TRIM(g1.g1_cod) = $1
            AND TRIM(COALESCE(g1.d_e_l_e_t_, '')) <> '*'
            ORDER BY g1.g1_comp
        `;

        const operationsQuery = `
            SELECT 
                g2.g2_operac AS operacao,
                TRIM(h1.h1_descri) AS descricao,
                g2.g2_recurso AS recurso,
                g2.g2_setup AS tempo_setup,
                ROUND(g2.g2_tempad::numeric, 3) AS tempo_padrao,
                g2.g2_ferram AS ferramentas,
                g2.g2_depto AS departamento
            FROM public.sg2010 g2
            LEFT JOIN public.sh1010 h1 ON h1.h1_codigo = g2.g2_recurso AND COALESCE(h1.d_e_l_e_t_, '') IN ('', ' ')
            WHERE TRIM(g2.g2_produto) = $1
            AND (g2.d_e_l_e_t_ = '' OR g2.d_e_l_e_t_ = ' ')
            AND TRIM(g2.g2_codigo) = (
                SELECT MAX(TRIM(g2_sub.g2_codigo))
                FROM public.sg2010 g2_sub
                WHERE TRIM(g2_sub.g2_produto) = TRIM(g2.g2_produto)
                AND (g2_sub.d_e_l_e_t_ = '' OR g2_sub.d_e_l_e_t_ = ' ')
            )
            ORDER BY g2.g2_operac
        `;

        // Execução Paralela (Promise.all)
        // Usamos .catch em cada promise individual para que uma falha não derrube todas as outras
        const [productResult, bomResult, opsResult] = await Promise.all([
            pool.query(productQuery, [productCode]).catch(err => { console.error('❌ Erro produto:', err.message); return { rows: [] }; }),
            pool.query(bomQuery, [productCode]).catch(err => { console.error('❌ Erro BOM:', err.message); return { rows: [] }; }),
            pool.query(operationsQuery, [productCode]).catch(err => { console.error('❌ Erro Operações:', err.message); return { rows: [] }; })
        ]);

        const protheusProduct = productResult.rows[0] || null;
        const bomStructure = bomResult.rows;
        const operations = opsResult.rows;

        console.log(`${protheusProduct ? '✅' : '⚠️'} [SINCO Integration] Produto: ${protheusProduct ? 'Encontrado' : 'Não encontrado'}`);
        console.log(`📋 [SINCO Integration] BOM: ${bomStructure.length} itens | Operações: ${operations.length}`);

        // 5. Montar resposta integrada
        const integratedData = {
            solidedge: activeDoc,
            protheus: {
                product: protheusProduct,
                bom: bomStructure,
                operations: operations
            },
            integration: {
                productCode: productCode,
                fileName: fileName,
                protheusFound: !!protheusProduct,
                hasBOM: bomStructure.length > 0,
                hasOperations: operations.length > 0
            }
        };

        console.log(`✅ [SINCO Integration] Dados integrados completos: ${productCode}`);
        res.json(integratedData);

    } catch (error) {
        console.error('❌ [SINCO Integration] Erro geral:', error.message);
        res.status(500).json({
            error: 'Erro ao buscar dados integrados',
            details: error.message
        });
    }
});

// =========================================================================
// SINCO Formulário Web — integração Solid Edge Desktop → Página Web
// =========================================================================

// POST /api/sinco/estrutura-completa
// Recebe a BOM completa do Solid Edge Desktop via POST (JSON Array) e disponibiliza temporariamente
let estruturaWebTemp = null;
router.post('/estrutura-completa', express.json({limit: '50mb'}), async (req, res) => {
    try {
        const bomData = req.body;
        // Armazena em memória (cache) para a página web ler via GET
        estruturaWebTemp = bomData;
        
        const io = req.app.get('io');
        if (io) {
            io.to('sinco_formulario').emit('sinco:bom_solidedge_atualizada', { total: bomData.length });
        }
        
        console.log(`✅ [SINCO] Estrutura (BOM) recebida do Solid Edge. Total itens: ${bomData.length}`);
        res.json({ success: true, message: 'BOM enviada para a Web com sucesso!' });
    } catch (error) {
        console.error('❌ Erro ao processar BOM para Web:', error);
        res.status(500).json({ error: 'Erro interno ao processar BOM' });
    }
});

// GET /api/sinco/estrutura-completa
// Rota para a página frontend (localhost:5173) ler a BOM recebida
router.get('/estrutura-completa', async (req, res) => {
    if (!estruturaWebTemp) {
        return res.json([]);
    }
    res.json(estruturaWebTemp);
});

// POST /api/sinco/validar-estruturas
// Valida em lote o status de Materiais (BOM), SZ1, Roteiro e SZ0 nativamente no SINCO (MySQL)
router.post('/validar-estruturas', express.json(), async (req, res) => {
    try {
        const { components } = req.body;
        if (!components || !Array.isArray(components) || components.length === 0) {
            return res.json({});
        }

        // Remove extensão (ex: .ASM, .PAR) e deixa maiúsculo
        const stripExt = (name) => {
            if (!name) return '';
            const n = String(name).trim();
            const lastDot = n.lastIndexOf('.');
            return (lastDot > 0 ? n.substring(0, lastDot) : n).toUpperCase();
        };

        const codes = [...new Set(components.map(stripExt))].filter(Boolean);
        if (codes.length === 0) return res.json({});

        // 1. Consultar tabelas nativas do SINCO (MySQL)
        const [bomRes] = await pool.query(
            `SELECT DISTINCT produto_pai_codigo AS cod FROM erp_estruturas_bom WHERE produto_pai_codigo IN (?) AND ativo = 1`,
            [codes]
        ).catch(() => [[]]);
        const [rotRes] = await pool.query(
            `SELECT DISTINCT codigo_produto AS cod FROM erp_roteiros_operacoes WHERE codigo_produto IN (?)`,
            [codes]
        ).catch(() => [[]]);
        const [sz1Res] = await pool.query(
            `SELECT DISTINCT TRIM(z1_produto) AS cod FROM sz1010 WHERE TRIM(z1_produto) IN (?) AND (d_e_l_e_t_ IS NULL OR TRIM(d_e_l_e_t_) <> '*')`,
            [codes]
        ).catch(() => [[]]);
        const [sz0Res] = await pool.query(
            `SELECT DISTINCT TRIM(z0_produto) AS cod FROM sz0010 WHERE TRIM(z0_produto) IN (?) AND (d_e_l_e_t_ IS NULL OR TRIM(d_e_l_e_t_) NOT IN ('*', '  *')) AND (z0_status IS NULL OR TRIM(z0_status) <> 'L')`,
            [codes]
        ).catch(() => [[]]);

        const sg1Set = new Set(bomRes.map(r => r.cod));
        const rotSet = new Set(rotRes.map(r => r.cod));
        const sz1Set = new Set(sz1Res.map(r => r.cod));
        const sz0Set = new Set(sz0Res.map(r => r.cod));

        // 2. Fallback nas tabelas espelho legadas caso algum código não tenha sido encontrado
        const missingSg1 = codes.filter(c => !sg1Set.has(c));
        const missingRot = codes.filter(c => !rotSet.has(c));
        const missingSz1 = codes.filter(c => !sz1Set.has(c));
        const missingSz0 = codes.filter(c => !sz0Set.has(c));

        if (missingSg1.length > 0 || missingRot.length > 0 || missingSz1.length > 0 || missingSz0.length > 0) {
            try {
                const pgPool = require('../db');
                if (missingSg1.length > 0) {
                    const r = await pgPool.query(`SELECT DISTINCT TRIM(g1_cod) as cod FROM public.sg1010 WHERE TRIM(g1_cod) = ANY($1::text[]) AND COALESCE(d_e_l_e_t_, '') <> '*'`, [missingSg1]);
                    r.rows.forEach(x => sg1Set.add(x.cod));
                }
                if (missingRot.length > 0) {
                    const r = await pgPool.query(`SELECT DISTINCT TRIM(g2_produto) as cod FROM public.sg2010 WHERE TRIM(g2_produto) = ANY($1::text[]) AND COALESCE(d_e_l_e_t_, '') <> '*'`, [missingRot]);
                    r.rows.forEach(x => rotSet.add(x.cod));
                }
                if (missingSz1.length > 0) {
                    const r = await pgPool.query(`SELECT DISTINCT TRIM(z1_produto) as cod FROM public.sz1010 WHERE TRIM(z1_produto) = ANY($1::text[]) AND COALESCE(d_e_l_e_t_, '') <> '*'`, [missingSz1]);
                    r.rows.forEach(x => sz1Set.add(x.cod));
                }
                if (missingSz0.length > 0) {
                    const r = await pgPool.query(`SELECT DISTINCT TRIM(z0_produto) as cod FROM public.sz0010 WHERE TRIM(z0_produto) = ANY($1::text[]) AND COALESCE(d_e_l_e_t_, '') <> '*' AND COALESCE(z0_status, '') <> 'L'`, [missingSz0]);
                    r.rows.forEach(x => sz0Set.add(x.cod));
                }
            } catch (_) {}
        }

        const result = {};
        for (const c of codes) {
            result[c] = {
                materiais: sg1Set.has(c),
                sz1: sz1Set.has(c),
                roteiro: rotSet.has(c),
                sz0: sz0Set.has(c)
            };
        }

        res.json(result);
    } catch (error) {
        console.error('❌ Erro em /validar-estruturas:', error);
        res.status(500).json({ error: 'Erro ao validar estruturas no SINCO' });
    }
});

async function queryProtheus(sql, params) {
    const res = await protheusDB.query(sql, params);
    return res.rows;
}

// GET /api/sinco/arvore/:codigo — estrutura do produto (BOM) nativa do SINCO (erp_estruturas_bom)
router.get('/arvore/:codigo', async (req, res) => {
    const codigo = req.params.codigo.trim().toUpperCase();
    try {
        // 1. Busca nativa no SINCO
        const [bomRows] = await pool.query(`
            SELECT
                '1' AS nivel,
                b.produto_filho_codigo AS componente,
                COALESCE(b.quantidade, 1) AS quantidade,
                '   ' AS trt,
                NULL AS ini,
                NULL AS fim,
                COALESCE(b.perda_percentual, 0) AS perda,
                COALESCE(p.descricao, b.produto_filho_codigo) AS descricao,
                COALESCE(b.unidade, p.unidade_medida, 'UN') AS unidade,
                COALESCE(p.tipo, 'PA') AS tipo
            FROM erp_estruturas_bom b
            LEFT JOIN erp_produtos p ON p.codigo = b.produto_filho_codigo
            WHERE b.produto_pai_codigo = ? AND b.ativo = 1
            ORDER BY b.ordem_sequencia ASC, b.id ASC
        `, [codigo]);

        if (bomRows.length > 0) {
            return res.json(bomRows);
        }

        // 2. Fallback espelho legado
        const rows = await queryProtheus(`
            SELECT
                TRIM(g.g1_niv)    AS nivel,
                TRIM(g.g1_comp)   AS componente,
                g.g1_quant        AS quantidade,
                TRIM(g.g1_trt)    AS trt,
                g.g1_ini          AS ini,
                g.g1_fim          AS fim,
                g.g1_perda        AS perda,
                TRIM(b.b1_desc)   AS descricao,
                TRIM(b.b1_um)     AS unidade,
                TRIM(b.b1_tipo)   AS tipo
            FROM public.sg1010 g
            LEFT JOIN public.sb1010 b
                ON TRIM(b.b1_cod) = TRIM(g.g1_comp)
                AND COALESCE(b.d_e_l_e_t_, '') NOT IN ('*', '  *')
            WHERE TRIM(g.g1_cod) = $1
              AND COALESCE(g.d_e_l_e_t_, '') NOT IN ('*', '  *')
            ORDER BY g.g1_niv, g.g1_comp
        `, [codigo]);
        res.json(rows);
    } catch (err) {
        console.error('Erro arvore produto (SINCO):', err.message);
        res.status(500).json({ 
            success: false,
            error: 'Erro ao buscar árvore de produto', 
            details: err.message,
            codigo,
            endpoint: `/api/sinco/arvore/${codigo}`
        });
    }
});

// GET /api/sinco/arvore-completa/:codigo — explosão BFS de todos os níveis da estrutura (BOM) nativa
router.get('/arvore-completa/:codigo', async (req, res) => {
    const codigo = req.params.codigo.trim().toUpperCase();
    try {
        const root = codigo;
        let queue = [{ cod: root, path: [root], sortKey: '' }];
        let level = 1;
        const allItems = [];

        while (queue.length > 0 && level <= 12) {
            const nextQueue = [];
            const parentsToFetch = [...new Set(queue.map(q => q.cod))];

            // 1. Busca nativa no SINCO
            const [sincoRows] = await pool.query(`
                SELECT 
                    b.produto_pai_codigo AS pai,
                    b.produto_filho_codigo AS componente,
                    COALESCE(b.quantidade, 1) AS quantidade,
                    '   ' AS trt,
                    COALESCE(p.descricao, b.produto_filho_codigo) AS descricao,
                    COALESCE(b.unidade, p.unidade_medida, 'UN') AS unidade,
                    COALESCE(p.tipo, 'PA') AS tipo,
                    '01' AS grupo,
                    COALESCE(p.peso_liquido, 0) AS peso
                FROM erp_estruturas_bom b
                LEFT JOIN erp_produtos p ON p.codigo = b.produto_filho_codigo
                WHERE b.produto_pai_codigo IN (?) AND b.ativo = 1
                ORDER BY b.ordem_sequencia ASC, b.id ASC
            `, [parentsToFetch]);

            const parentsFound = new Set(sincoRows.map(r => r.pai));
            const missingParents = parentsToFetch.filter(p => !parentsFound.has(p));

            let legacyRows = [];
            if (missingParents.length > 0) {
                try {
                    const placeholders = missingParents.map((_, i) => `$${i + 1}`).join(',');
                    legacyRows = await queryProtheus(`
                        SELECT 
                            TRIM(g.g1_cod) AS pai,
                            TRIM(g.g1_comp) AS componente,
                            COALESCE(g.g1_quant, 0) AS quantidade,
                            TRIM(COALESCE(g.g1_trt, '')) AS trt,
                            TRIM(COALESCE(sb.b1_desc, '')) AS descricao,
                            TRIM(COALESCE(sb.b1_um, '')) AS unidade,
                            TRIM(COALESCE(sb.b1_tipo, '')) AS tipo,
                            TRIM(COALESCE(sb.b1_grupo, '')) AS grupo,
                            COALESCE(sb.b1_peso, 0) AS peso
                        FROM sg1010 g
                        LEFT JOIN sb1010 sb ON TRIM(sb.b1_cod) = TRIM(g.g1_comp) AND COALESCE(sb.d_e_l_e_t_, '') NOT IN ('*', '  *')
                        WHERE TRIM(g.g1_cod) IN (${placeholders})
                          AND COALESCE(g.d_e_l_e_t_, '') NOT IN ('*', '  *')
                        ORDER BY g.g1_comp ASC
                    `, missingParents);
                } catch (_) {}
            }

            const rows = [...sincoRows, ...legacyRows];

            // Group by parent
            const childrenByParent = new Map();
            for (const r of rows) {
                if (!childrenByParent.has(r.pai)) childrenByParent.set(r.pai, []);
                childrenByParent.get(r.pai).push(r);
            }

            for (const parentItem of queue) {
                const children = childrenByParent.get(parentItem.cod) || [];
                for (let i = 0; i < children.length; i++) {
                    const child = children[i];
                    const comp = child.componente;

                    if (parentItem.path.includes(comp)) continue;

                    const newPath = [...parentItem.path, comp];
                    const caminho = newPath.join(' > ');
                    const qtd = parseFloat(child.quantidade) || 0;

                    const itemData = {
                        nivel: level,
                        pai: child.pai,
                        componente: comp,
                        quantidade: qtd,
                        trt: child.trt,
                        caminho_hierarquico: caminho,
                        descricao: child.descricao,
                        unidade: child.unidade,
                        tipo: child.tipo,
                        grupo: child.grupo,
                        peso: parseFloat(child.peso) || 0,
                        _sortKey: parentItem.sortKey ? `${parentItem.sortKey}.${String(i).padStart(4, '0')}` : String(i).padStart(4, '0')
                    };

                    allItems.push(itemData);

                    if (child.tipo !== 'MP' && level < 12) {
                        nextQueue.push({
                            cod: comp,
                            path: newPath,
                            sortKey: itemData._sortKey
                        });
                    }
                }
            }

            queue = nextQueue;
            level++;
        }

        allItems.sort((a, b) => a._sortKey.localeCompare(b._sortKey));
        const finalRows = allItems.map(({ _sortKey, ...rest }) => rest);
        res.json(finalRows);
    } catch (err) {
        console.error('Erro ao buscar árvore completa recursiva (SINCO):', err.message);
        res.status(500).json({ 
            success: false,
            error: 'Erro ao buscar árvore completa de produtos', 
            details: err.message,
            codigo,
            endpoint: `/api/sinco/arvore-completa/${codigo}`
        });
    }
});

// GET /api/sinco/produto/:codigo — dados básicos + complementares do produto (nativa no erp_produtos)
router.get('/produto/:codigo', async (req, res) => {
    const codigo = req.params.codigo.trim().toUpperCase();
    try {
        // 1. Busca nativa no SINCO (erp_produtos)
        const [erpRows] = await pool.query(`
            SELECT
                codigo,
                descricao AS titulo,
                tipo,
                unidade_medida AS unidade,
                '01' AS grupo,
                COALESCE(peso_liquido, 0) AS peso,
                COALESCE(revisao_atual, '00') AS rev,
                COALESCE(revisao_atual, '00') AS xrevm,
                0 AS comprimento,
                0 AS largura,
                0 AS espessura,
                '' AS status_delete,
                foto_url,
                desenho_url,
                desenho_nome,
                desenho_tipo
            FROM erp_produtos
            WHERE codigo = ?
            LIMIT 1
        `, [codigo]);

        if (erpRows.length > 0) {
            const p = erpRows[0];
            return res.json({ 
                success: true, 
                ...p, 
                erp_excluido: false,
                endpoint: `/api/sinco/produto/${codigo}`,
                timestamp: new Date().toISOString()
            });
        }

        // 2. Fallback no espelho legado (SB1 + SB5)
        const rows = await queryProtheus(`
            SELECT
                TRIM(sb1.b1_cod)     AS codigo,
                TRIM(sb1.b1_desc)    AS titulo,
                TRIM(sb1.b1_tipo)    AS tipo,
                TRIM(sb1.b1_um)      AS unidade,
                TRIM(sb1.b1_grupo)   AS grupo,
                sb1.b1_peso          AS peso,
                TRIM(sb1.b1_revatu)  AS rev,
                TRIM(sb1.b1_xrevm)   AS xrevm,
                sb5.b5_compr         AS comprimento,
                sb5.b5_larg          AS largura,
                sb5.b5_espess        AS espessura,
                COALESCE(sb1.d_e_l_e_t_, '') AS status_delete
            FROM public.sb1010 sb1
            LEFT JOIN public.sb5010 sb5 
                ON TRIM(sb1.b1_cod) = TRIM(sb5.b5_cod)
            WHERE TRIM(sb1.b1_cod) = $1
            ORDER BY sb1.r_e_c_n_o_ DESC
            LIMIT 1
        `, [codigo]);
        
        if (rows.length === 0) {
            return res.status(404).json({ 
                success: false,
                error: 'Produto não encontrado no SINCO.',
                codigo,
                endpoint: `/api/sinco/produto/${codigo}`,
                timestamp: new Date().toISOString()
            });
        }

        const row = rows[0];
        const isDeleted = row.status_delete === '*' || row.status_delete === '  *';
        res.json({ 
            success: true, 
            ...row, 
            erp_excluido: isDeleted,
            endpoint: `/api/sinco/produto/${codigo}`,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('Erro ao buscar produto no SINCO:', err.message);
        res.status(500).json({ 
            success: false,
            error: 'Erro ao buscar produto no SINCO', 
            details: err.message,
            codigo,
            endpoint: `/api/sinco/produto/${codigo}`,
            timestamp: new Date().toISOString()
        });
    }
});

// GET /api/sinco/produtos/busca?q=... — busca produtos por código ou descrição no SINCO
router.get('/produtos/busca', async (req, res) => {
    const termo = req.query.q ? req.query.q.trim().toUpperCase() : '';

    try {
        // Busca nativa no SINCO (sem termo = lista os produtos cadastrados)
        const where = termo ? 'WHERE (codigo LIKE ? OR descricao LIKE ?)' : '';
        const params = termo ? [`%${termo}%`, `%${termo}%`] : [];
        const [rows] = await pool.query(`
            SELECT
                codigo,
                descricao AS titulo,
                tipo,
                unidade_medida AS unidade
            FROM erp_produtos
            ${where}
            ORDER BY codigo
            LIMIT 200
        `, params);

        res.json(rows);
    } catch (err) {
        console.error('Erro ao buscar produtos:', err.message);
        res.status(500).json({ 
            success: false,
            error: 'Erro ao buscar produtos no SINCO', 
            details: err.message,
            query: termo,
            endpoint: '/api/sinco/produtos/busca',
            timestamp: new Date().toISOString()
        });
    }
});

// GET /api/sinco/restricoes/:codigo — SZ1 Produto X Cliente
router.get('/restricoes/:codigo', async (req, res) => {
    const codigo = req.params.codigo.trim().toUpperCase();
    try {
        const [rows] = await pool.query(`
            SELECT
                TRIM(z1_cliente)  AS cliente,
                TRIM(z1_loja)     AS loja,
                TRIM(z1_nomecli)  AS nome_cliente,
                TRIM(z1_codcli)   AS cod_cliente,
                TRIM(z1_desccli)  AS desc_cliente,
                TRIM(z1_revisao)  AS revisao,
                R_E_C_N_O_        AS recno
            FROM sz1010
            WHERE TRIM(z1_produto) = ?
              AND (d_e_l_e_t_ IS NULL OR TRIM(d_e_l_e_t_) <> '*')
            ORDER BY z1_nomecli
        `, [codigo]);
        res.json(rows);
    } catch (err) {
        console.error('Erro restricoes SZ1:', err.message);
        res.status(500).json({ 
            success: false,
            error: 'Erro ao buscar restrições SZ1', 
            details: err.message,
            codigo,
            endpoint: `/api/sinco/restricoes/${codigo}`
        });
    }
});

// GET /api/sinco/operacoes/:codigo — roteiro de operações nativo do SINCO (erp_roteiros_operacoes)
router.get('/operacoes/:codigo', async (req, res) => {
    const codigo = req.params.codigo.trim().toUpperCase();
    try {
        // 1. Busca nativa no SINCO
        const [sincoRows] = await pool.query(`
            SELECT
                o.operacao_seq AS operacao,
                COALESCE(o.descricao_operacao, '') AS descricao,
                o.codigo_recurso AS recurso,
                COALESCE(r.nome, o.codigo_recurso) AS recurso_descricao,
                COALESCE(o.centro_custo, '') AS ctrab,
                ROUND(COALESCE(o.tempo_operacao_minutos, 0), 3) AS tempo,
                COALESCE(o.tempo_setup_minutos, 0) AS setup,
                1 AS lotepad,
                1 AS maoobra
            FROM erp_roteiros_operacoes o
            LEFT JOIN pcp_recursos r ON r.codigo COLLATE utf8mb4_unicode_ci = o.codigo_recurso COLLATE utf8mb4_unicode_ci
            WHERE o.codigo_produto = ?
            ORDER BY o.operacao_seq ASC
        `, [codigo]);

        if (sincoRows.length > 0) {
            return res.json(sincoRows);
        }

        // 2. Fallback espelho legado
        const rows = await queryProtheus(`
            SELECT
                TRIM(g2.g2_operac)                                          AS operacao,
                TRIM(COALESCE(NULLIF(g2.g2_descri, ''), h1.h1_descri, '')) AS descricao,
                TRIM(g2.g2_recurso)                                         AS recurso,
                TRIM(h1.h1_descri)                                          AS recurso_descricao,
                TRIM(COALESCE(g2.g2_ctrab, h1.h1_ctrab, ''))                AS ctrab,
                ROUND(g2.g2_tempad::numeric, 3)                             AS tempo,
                COALESCE(g2.g2_setup, 0)                                    AS setup,
                COALESCE(g2.g2_lotepad, 1)                                  AS lotepad,
                COALESCE(g2.g2_maoobra, 1)                                  AS maoobra
            FROM public.sg2010 g2
            LEFT JOIN public.sh1010 h1
                ON h1.h1_codigo = g2.g2_recurso
                AND COALESCE(h1.d_e_l_e_t_, '') IN ('', ' ')
            WHERE TRIM(g2.g2_produto) = $1
              AND COALESCE(g2.d_e_l_e_t_, '') NOT IN ('*', '  *')
              AND TRIM(g2.g2_codigo) = (
                  SELECT MAX(TRIM(g2_sub.g2_codigo))
                  FROM public.sg2010 g2_sub
                  WHERE TRIM(g2_sub.g2_produto) = TRIM(g2.g2_produto)
                  AND COALESCE(g2_sub.d_e_l_e_t_, '') NOT IN ('*', '  *')
              )
            ORDER BY g2.g2_operac
        `, [codigo]);
        res.json(rows);
    } catch (err) {
        console.error('Erro operacoes (SINCO):', err.message);
        res.status(500).json({ 
            success: false,
            error: 'Erro ao buscar operações no SINCO', 
            details: err.message,
            codigo,
            endpoint: `/api/sinco/operacoes/${codigo}`
        });
    }
});

// GET /api/sinco/restricoes-sz0/:codigo — Restrições do Produto (SZ0010)
router.get('/restricoes-sz0/:codigo', async (req, res) => {
    const codigo = req.params.codigo.trim().toUpperCase();
    try {
        const [rows] = await pool.query(`
            SELECT
                Z0.z0_produto        AS produto,
                Z0.z0_item           AS item,
                Z0.z0_status         AS status,
                Z0.z0_resumo         AS resumo,
                Z0.z0_restric        AS restricao_raw,
                Z0.z0_respons        AS responsavel,
                Z0.z0_dtultal        AS dt_ultima_alt,
                Z0.z0_hrultal        AS hr_ultima_alt,
                COALESCE(P.descricao, '') AS descricao_oficial,
                COALESCE(P.tipo, '')      AS tipo,
                COALESCE(P.unidade_medida, '') AS unidade,
                Z0.z0_xrevm          AS revisao
            FROM sz0010 Z0
            LEFT JOIN erp_produtos P
                ON P.codigo = Z0.z0_produto
            WHERE TRIM(Z0.z0_produto) = ?
              AND (Z0.d_e_l_e_t_ IS NULL OR TRIM(Z0.d_e_l_e_t_) NOT IN ('*', '  *'))
              AND (Z0.z0_status IS NULL OR TRIM(Z0.z0_status) <> 'L')
            ORDER BY Z0.z0_item
        `, [codigo]);

        const decoded = rows.map(row => {
            const raw = row.restricao_raw;
            let restricao = '';
            if (raw) {
                if (Buffer.isBuffer(raw)) {
                    const buf = raw.filter(b => b !== 0);
                    const asUtf8 = buf.toString('utf8');
                    restricao = asUtf8.includes('\uFFFD') ? buf.toString('latin1').trim() : asUtf8.trim();
                } else {
                    restricao = String(raw).trim();
                }
            }
            return {
                produto: (row.produto || '').trim(),
                item: (row.item || '').trim(),
                status: (row.status || '').trim(),
                resumo: (row.resumo || '').trim(),
                responsavel: (row.responsavel || '').trim(),
                dt_ultima_alt: (row.dt_ultima_alt || '').trim(),
                hr_ultima_alt: (row.hr_ultima_alt || '').trim(),
                descricao_oficial: (row.descricao_oficial || '').trim(),
                tipo: (row.tipo || '').trim(),
                unidade: (row.unidade || '').trim(),
                revisao: (row.revisao || '').trim(),
                restricao
            };
        });

        res.json(decoded);
    } catch (err) {
        console.error('Erro restricoes SZ0:', err.message);
        res.status(500).json({ 
            success: false,
            error: 'Erro ao buscar restrições SZ0', 
            details: err.message,
            codigo,
            endpoint: `/api/sinco/restricoes-sz0/${codigo}`
        });
    }
});

// GET /api/sinco/restricoes-sz0-todas — Todas as restrições ativas
router.get('/restricoes-sz0-todas', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                Z0.z0_produto        AS produto,
                Z0.z0_item           AS item,
                Z0.z0_status         AS status,
                Z0.z0_resumo         AS resumo,
                Z0.z0_restric        AS restricao_raw,
                Z0.z0_respons        AS responsavel,
                Z0.z0_dtultal        AS dt_ultima_alt,
                Z0.z0_hrultal        AS hr_ultima_alt,
                COALESCE(P.descricao, '') AS descricao_oficial,
                COALESCE(P.tipo, '')      AS tipo,
                COALESCE(P.unidade_medida, '') AS unidade,
                Z0.z0_xrevm          AS revisao
            FROM sz0010 Z0
            LEFT JOIN erp_produtos P
                ON P.codigo = Z0.z0_produto
            WHERE (Z0.d_e_l_e_t_ IS NULL OR TRIM(Z0.d_e_l_e_t_) NOT IN ('*', '  *'))
              AND (Z0.z0_status IS NULL OR TRIM(Z0.z0_status) <> 'L')
            ORDER BY Z0.z0_produto, Z0.z0_item
        `);

        const decoded = rows.map(row => {
            const raw = row.restricao_raw;
            let restricao = '';
            if (raw) {
                if (Buffer.isBuffer(raw)) {
                    const buf = raw.filter(b => b !== 0);
                    const asUtf8 = buf.toString('utf8');
                    restricao = asUtf8.includes('\uFFFD') ? buf.toString('latin1').trim() : asUtf8.trim();
                } else {
                    restricao = String(raw).trim();
                }
            }
            return {
                produto: (row.produto || '').trim(),
                item: (row.item || '').trim(),
                status: (row.status || '').trim(),
                resumo: (row.resumo || '').trim(),
                responsavel: (row.responsavel || '').trim(),
                dt_ultima_alt: (row.dt_ultima_alt || '').trim(),
                hr_ultima_alt: (row.hr_ultima_alt || '').trim(),
                descricao_oficial: (row.descricao_oficial || '').trim(),
                tipo: (row.tipo || '').trim(),
                unidade: (row.unidade || '').trim(),
                revisao: (row.revisao || '').trim(),
                restricao
            };
        });

        res.json(decoded);
    } catch (err) {
        console.error('Erro todas restricoes SZ0:', err.message);
        res.status(500).json({ 
            success: false,
            error: 'Erro ao buscar todas as restrições SZ0', 
            details: err.message,
            endpoint: '/api/sinco/restricoes-sz0-todas'
        });
    }
});

// POST /api/sinco/restricao/edit — Inclusão e alteração de restrições de engenharia 100% nativo no SINCO (sz0010)
router.post('/restricao/edit', async (req, res) => {
    try {
        let rawRestricoes = [];
        if (Array.isArray(req.body?.data?.restricoes)) {
            rawRestricoes = req.body.data.restricoes;
        } else if (req.body?.restricoes && Array.isArray(req.body.restricoes)) {
            rawRestricoes = req.body.restricoes;
        } else if (req.body?.produto || req.body?.Z0_PRODUTO) {
            rawRestricoes = [{
                EMPRESA: req.body.empresa || req.body.EMPRESA || '01',
                CFILANT: req.body.filial || req.body.CFILANT || '01',
                NOPER: Number(req.body.noper || req.body.NOPER) || 3,
                Z0_PRODUTO: req.body.produto || req.body.Z0_PRODUTO,
                Z0_ITEM: req.body.item || req.body.Z0_ITEM || '001',
                Z0_STATUS: req.body.status || req.body.Z0_STATUS || 'P',
                Z0_RESUMO: req.body.resumo || req.body.Z0_RESUMO || '',
                Z0_RESTRIC: req.body.restricao || req.body.Z0_RESTRIC || '',
                Z0_RESPONS: req.body.responsavel || req.body.Z0_RESPONS || 'ENGENHARIA',
                Z0_XREVM: req.body.revLynx || req.body.Z0_XREVM || ''
            }];
        }

        const now = new Date();
        const dtHoje = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const hrAgora = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        for (const r of rawRestricoes) {
            const produtoCod = String(r.Z0_PRODUTO || r.produto || '').trim().toUpperCase();
            if (!produtoCod) continue;
            const noperRaw = Number(r.NOPER);
            const isExclusao = noperRaw === 5 || r.OPERACAO === 'EXCLUIR' || r.OPCAO === 'EXCLUIR' || r.deleted;
            const statusFinal = isExclusao ? 'L' : (['P', 'L', 'A'].includes(r.Z0_STATUS) ? r.Z0_STATUS : 'P');
            let itemFinal = String(r.Z0_ITEM || r.item || '001').padStart(3, '0');
            const resumo = String(r.Z0_RESUMO || r.resumo || 'RESTRIÇÃO').trim().substring(0, 80);
            const restricao = String(r.Z0_RESTRIC || r.restricao || resumo).trim();
            const responsavel = String(r.Z0_RESPONS || r.responsavel || 'ENGENHARIA').trim().substring(0, 15);
            const rev = String(r.Z0_XREVM || r.revLynx || '').trim().substring(0, 2);

            // Verificar se já existe na sz0010
            const [existRows] = await pool.query(
                'SELECT R_E_C_N_O_ FROM sz0010 WHERE TRIM(z0_produto) = ? AND TRIM(z0_item) = ? LIMIT 1',
                [produtoCod, itemFinal]
            );

            if (existRows.length > 0) {
                await pool.query(`
                    UPDATE sz0010 SET
                        z0_status = ?,
                        z0_resumo = ?,
                        z0_restric = ?,
                        z0_respons = ?,
                        z0_dtultal = ?,
                        z0_hrultal = ?,
                        z0_xrevm = ?,
                        d_e_l_e_t_ = ?
                    WHERE R_E_C_N_O_ = ?
                `, [statusFinal, resumo, restricao, responsavel, dtHoje, hrAgora, rev, isExclusao ? '*' : ' ', existRows[0].R_E_C_N_O_]);
            } else {
                const [[maxRec]] = await pool.query('SELECT COALESCE(MAX(R_E_C_N_O_), 0) + 1 AS nextRec FROM sz0010');
                const [[maxItem]] = await pool.query('SELECT COALESCE(MAX(CAST(z0_item AS UNSIGNED)), 0) + 1 AS nextItem FROM sz0010 WHERE TRIM(z0_produto) = ?', [produtoCod]);
                if (noperRaw === 3) {
                    itemFinal = String(maxItem.nextItem).padStart(3, '0');
                }
                await pool.query(`
                    INSERT INTO sz0010 (
                        z0_filial, z0_produto, z0_item, z0_status, z0_resumo, z0_restric,
                        z0_respons, z0_dtultal, z0_hrultal, z0_xrevm, d_e_l_e_t_, r_e_c_n_o_, IdEmpresa
                    ) VALUES ('01', ?, ?, ?, ?, ?, ?, ?, ?, ?, ' ', ?, 1)
                `, [produtoCod, itemFinal, statusFinal, resumo, restricao, responsavel, dtHoje, hrAgora, rev, maxRec.nextRec]);
            }
        }

        res.json({
            success: true,
            message: 'Restrição salva com sucesso no SINCO'
        });
    } catch (err) {
        console.error('Erro ao salvar restrição no SINCO:', err.message || err);
        res.status(500).json({ 
            success: false,
            error: 'Falha ao salvar restrição no SINCO', 
            details: err.message || String(err),
            endpoint: '/api/sinco/restricao/edit'
        });
    }
});

// Último estado recebido do Solid Edge (memória volátil, limpa ao reiniciar servidor)
let dadosCorrenteSE = null;

// POST /api/sinco/dados-correntes — recebe dados do desktop e transmite via socket
router.post('/dados-correntes', (req, res) => {
    const io = req.app.get('io');
    dadosCorrenteSE = req.body;
    io.to('sinco_formulario').emit('sinco:desenho_atualizado', dadosCorrenteSE);
    res.json({ ok: true });
});

// GET /api/sinco/dados-correntes/conectados — retorna quantos clientes estão com a página aberta
router.get('/dados-correntes/conectados', (req, res) => {
    const io = req.app.get('io');
    const room = io.sockets.adapter.rooms.get('sinco_formulario');
    const conectados = room ? room.size : 0;
    res.json({ conectados });
});

module.exports = router;
