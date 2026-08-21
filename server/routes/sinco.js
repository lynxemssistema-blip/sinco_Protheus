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

        const structure = items.map(item => {
            let hasPdfFile = false;
            let finalPdfPath = null;
            if (item.EnderecoArquivo) {
                const replaced = item.EnderecoArquivo.replace(/\\/g, '/').replace(/\/192\.168\.1\.253\/ENGENHARIA/i, '/mnt/engenharia');

                try {
                    // Check if file physically exists on the Linux server path
                    if (fs.existsSync(replaced)) {
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
                        (SELECT sz0.z0_status FROM public.sz0010 sz0 WHERE TRIM(sz0.z0_produto) = TRIM(sb1.b1_cod) AND COALESCE(sz0.d_e_l_e_t_, '') <> '*' ORDER BY sz0.r_e_c_n_o_ DESC LIMIT 1) as bloqueio_eng
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
        res.status(500).json({ error: 'Erro interno ao buscar materiais' });
    }
});

// POST /api/sinco/materiais-apoio
router.post('/materiais-apoio', async (req, res) => {
    try {
        const { nome, densidade } = req.body;
        if (!nome || !densidade) {
            return res.status(400).json({ error: 'Nome e densidade são obrigatórios' });
        }
        
        await initMateriaisApoioDB();
        
        await pool.query(`
            INSERT INTO sinco_materiais_densidade (nome, densidade) 
            VALUES (?, ?) 
            ON DUPLICATE KEY UPDATE densidade = VALUES(densidade)
        `, [nome, parseFloat(densidade)]);
        
        res.status(201).json({ success: true, message: 'Material cadastrado/atualizado com sucesso' });
    } catch (error) {
        console.error('❌ Erro ao adicionar material:', error);
        res.status(500).json({ error: 'Erro interno ao adicionar material' });
    }
});

// PUT /api/sinco/materiais-apoio
router.put('/materiais-apoio', async (req, res) => {
    try {
        const { nomeOriginal, nome, densidade } = req.body;
        if (!nomeOriginal || !nome || !densidade) {
            return res.status(400).json({ error: 'nomeOriginal, nome e densidade são obrigatórios' });
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
        
        res.json({ success: true, message: 'Material atualizado com sucesso' });
    } catch (error) {
        console.error('❌ Erro ao atualizar material:', error);
        res.status(500).json({ error: 'Erro interno ao atualizar material' });
    }
});

// DELETE /api/sinco/materiais-apoio
router.delete('/materiais-apoio', async (req, res) => {
    try {
        const { nome } = req.body;
        if (!nome) {
            return res.status(400).json({ error: 'Nome é obrigatório' });
        }
        
        await initMateriaisApoioDB();
        await pool.query('DELETE FROM sinco_materiais_densidade WHERE nome = ?', [nome]);
        
        res.json({ success: true, message: 'Material excluído com sucesso' });
    } catch (error) {
        console.error('❌ Erro ao excluir material:', error);
        res.status(500).json({ error: 'Erro interno ao excluir material' });
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
// Valida em lote o status de Materiais (SG1), SZ1, Roteiro (SG2) e SZ0 para uma lista de componentes
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

        // Utilizamos pgPool direto para consultas ao Postgres (Protheus)
        const pgPool = require('../db');

        const sg1Query = `
            SELECT DISTINCT TRIM(g1_cod) as cod
            FROM public.sg1010
            WHERE TRIM(g1_cod) = ANY($1::text[])
              AND COALESCE(d_e_l_e_t_, '') <> '*'
        `;
        
        const sz1Query = `
            SELECT DISTINCT TRIM(z1_produto) as cod
            FROM public.sz1010
            WHERE TRIM(z1_produto) = ANY($1::text[])
              AND COALESCE(d_e_l_e_t_, '') <> '*'
        `;
        
        const sg2Query = `
            SELECT DISTINCT TRIM(g2_produto) as cod
            FROM public.sg2010
            WHERE TRIM(g2_produto) = ANY($1::text[])
              AND COALESCE(d_e_l_e_t_, '') <> '*'
        `;
        
        const sz0Query = `
            SELECT DISTINCT TRIM(z0_produto) as cod
            FROM public.sz0010
            WHERE TRIM(z0_produto) = ANY($1::text[])
              AND COALESCE(d_e_l_e_t_, '') <> '*'
        `;

        const [resSg1, resSz1, resSg2, resSz0] = await Promise.all([
            pgPool.query(sg1Query, [codes]),
            pgPool.query(sz1Query, [codes]),
            pgPool.query(sg2Query, [codes]),
            pgPool.query(sz0Query, [codes])
        ]);

        const sg1Set = new Set(resSg1.rows.map(r => r.cod));
        const sz1Set = new Set(resSz1.rows.map(r => r.cod));
        const sg2Set = new Set(resSg2.rows.map(r => r.cod));
        const sz0Set = new Set(resSz0.rows.map(r => r.cod));

        const result = {};
        for (const c of codes) {
            result[c] = {
                materiais: sg1Set.has(c),
                sz1: sz1Set.has(c),
                roteiro: sg2Set.has(c),
                sz0: sz0Set.has(c)
            };
        }

        res.json(result);
    } catch (error) {
        console.error('❌ Erro em /validar-estruturas:', error);
        res.status(500).json({ error: 'Erro ao validar estruturas no Protheus' });
    }
});

async function queryProtheus(sql, params) {
    const res = await protheusDB.query(sql, params);
    return res.rows;
}

// GET /api/sinco/arvore/:codigo — estrutura do produto (BOM) via Protheus (SG1010)
router.get('/arvore/:codigo', async (req, res) => {
    const codigo = req.params.codigo.trim().toUpperCase();
    try {
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
        console.error('Erro arvore produto (Protheus):', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/sinco/produto/:codigo — dados básicos + complementares do produto (SB1 + SB5)
// ⚠️ Não filtramos d_e_l_e_t_ aqui: o formulário SINCO precisa acessar qualquer produto,
//    inclusive os que foram excluídos logicamente no ERP (engenharia ainda referencia esses dados).
router.get('/produto/:codigo', async (req, res) => {
    const codigo = req.params.codigo.trim().toUpperCase();
    try {
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
            return res.status(404).json({ error: 'Produto não encontrado no Protheus (SB1010).' });
        }

        const row = rows[0];
        // Informa o frontend se o produto está excluído no ERP
        const isDeleted = row.status_delete === '*' || row.status_delete === '  *';
        res.json({ ...row, erp_excluido: isDeleted });
    } catch (err) {
        console.error('Erro ao buscar produto (Protheus):', err.message);
        res.status(500).json({ error: err.message });
    }
});


// GET /api/sinco/produtos/busca?q=... — busca produtos por código ou descrição
router.get('/produtos/busca', async (req, res) => {
    const termo = req.query.q ? req.query.q.trim().toUpperCase() : '';
    if (!termo || termo.length < 3) {
        return res.json([]);
    }
    
    try {
        const rows = await queryProtheus(`
            SELECT
                TRIM(sb1.b1_cod)     AS codigo,
                TRIM(sb1.b1_desc)    AS titulo,
                TRIM(sb1.b1_tipo)    AS tipo,
                TRIM(sb1.b1_um)      AS unidade
            FROM public.sb1010 sb1
            WHERE (TRIM(sb1.b1_cod) LIKE $1 OR TRIM(sb1.b1_desc) LIKE $1)
              AND COALESCE(sb1.d_e_l_e_t_, '') NOT IN ('*', '  *')
            ORDER BY sb1.b1_cod
            LIMIT 50
        `, [`%${termo}%`]);
        
        res.json(rows);
    } catch (err) {
        console.error('Erro ao buscar produtos:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/sinco/restricoes/:codigo — SZ1 Produto X Cliente
router.get('/restricoes/:codigo', async (req, res) => {
    const codigo = req.params.codigo.trim().toUpperCase();
    try {
        const rows = await queryProtheus(`
            SELECT
                TRIM(z1_cliente)  AS cliente,
                TRIM(z1_loja)     AS loja,
                TRIM(z1_nomecli)  AS nome_cliente,
                TRIM(z1_codcli)   AS cod_cliente,
                TRIM(z1_desccli)  AS desc_cliente,
                TRIM(z1_revisao)  AS revisao,
                R_E_C_N_O_        AS recno
            FROM public.sz1010
            WHERE TRIM(z1_produto) = $1
              AND TRIM(COALESCE(d_e_l_e_t_, '')) <> '*'
            ORDER BY z1_nomecli
        `, [codigo]);
        res.json(rows);
    } catch (err) {
        console.error('Erro restricoes SZ1:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/sinco/operacoes/:codigo — roteiro de operações via Protheus (SG2010 + SH1010)
router.get('/operacoes/:codigo', async (req, res) => {
    const codigo = req.params.codigo.trim().toUpperCase();
    try {
        const rows = await queryProtheus(`
            SELECT
                TRIM(g2.g2_operac)                                          AS operacao,
                TRIM(h1.h1_descri)                                          AS descricao,
                TRIM(g2.g2_recurso)                                         AS recurso,
                TRIM(h1.h1_descri)                                          AS recurso_descricao,
                ROUND(g2.g2_tempad::numeric, 3)                             AS tempo,
                g2.g2_setup                                                 AS setup
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
        console.error('Erro operacoes (Protheus):', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/sinco/restricoes-sz0/:codigo — Restrições do Produto (SZ0010)
router.get('/restricoes-sz0/:codigo', async (req, res) => {
    const codigo = req.params.codigo.trim().toUpperCase();
    try {
        // z0_restric é bytea (Latin-1 com null terminator) — não usar TRIM() no SQL
        const rows = await queryProtheus(`
            SELECT
                Z0.z0_produto        AS produto,
                Z0.z0_item           AS item,
                Z0.z0_status         AS status,
                Z0.z0_resumo         AS resumo,
                Z0.z0_restric        AS restricao_raw,
                Z0.z0_respons        AS responsavel,
                Z0.z0_dtultal        AS dt_ultima_alt,
                Z0.z0_hrultal        AS hr_ultima_alt,
                B1.b1_desc           AS descricao_oficial,
                B1.b1_tipo           AS tipo,
                B1.b1_um             AS unidade,
                Z0.z0_xrevm          AS revisao
            FROM public.sz0010 Z0
            INNER JOIN public.sb1010 B1
                ON TRIM(B1.b1_cod) = TRIM(Z0.z0_produto)
                AND COALESCE(B1.d_e_l_e_t_, '') NOT IN ('*', '  *')
            WHERE TRIM(Z0.z0_produto) = $1
              AND COALESCE(Z0.d_e_l_e_t_, '') NOT IN ('*', '  *')
            ORDER BY Z0.z0_item
        `, [codigo]);

        // Decodifica bytea (null-terminated) → string JS
        // Dados novos (via API) são UTF-8; dados antigos são Latin-1.
        // Detecta automaticamente: tenta UTF-8 (sem replacement chars U+FFFD), senão usa Latin-1.
        const decoded = rows.map(row => {
            const raw = row.restricao_raw;
            let restricao = '';
            if (raw) {
                const buf = Buffer.from(raw).filter(b => b !== 0);
                const asUtf8 = buf.toString('utf8');
                restricao = asUtf8.includes('\uFFFD')
                    ? buf.toString('latin1').trim()
                    : asUtf8.trim();
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
        res.status(500).json({ error: err.message });
    }
});

// GET /api/sinco/restricoes-sz0-todas - Todas as Restrições (SZ0010)
router.get('/restricoes-sz0-todas', async (req, res) => {
    try {
        const rows = await queryProtheus(`
            SELECT
                Z0.z0_produto        AS produto,
                Z0.z0_item           AS item,
                Z0.z0_status         AS status,
                Z0.z0_resumo         AS resumo,
                Z0.z0_restric        AS restricao_raw,
                Z0.z0_respons        AS responsavel,
                Z0.z0_dtultal        AS dt_ultima_alt,
                Z0.z0_hrultal        AS hr_ultima_alt,
                B1.b1_desc           AS descricao_oficial,
                B1.b1_tipo           AS tipo,
                B1.b1_um             AS unidade,
                Z0.z0_xrevm          AS revisao
            FROM public.sz0010 Z0
            INNER JOIN public.sb1010 B1
                ON TRIM(B1.b1_cod) = TRIM(Z0.z0_produto)
                AND COALESCE(B1.d_e_l_e_t_, '') NOT IN ('*', '  *')
            WHERE COALESCE(Z0.d_e_l_e_t_, '') NOT IN ('*', '  *')
            ORDER BY Z0.z0_produto, Z0.z0_item
        `);

        const decoded = rows.map(row => {
            const raw = row.restricao_raw;
            let restricao = '';
            if (raw) {
                const buf = Buffer.from(raw).filter(b => b !== 0);
                const asUtf8 = buf.toString('utf8');
                restricao = asUtf8.includes('\uFFFD')
                    ? buf.toString('latin1').trim()
                    : asUtf8.trim();
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
        res.status(500).json({ error: err.message });
    }
});


// POST /api/sinco/restricao/edit — Proxy para API Protheus de inclusão/alteração de restrições
router.post('/restricao/edit', async (req, res) => {
    const https = require('https');
    const PROTHEUS_BASE = 'https://192.168.1.60:47500';

    // Função auxiliar: faz request HTTPS ignorando cert autoassinado
    const httpsRequest = (url, options, body) => new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const opts = {
            hostname: parsed.hostname,
            port: parsed.port || 443,
            path: parsed.pathname + parsed.search,
            rejectUnauthorized: false,
            ...options,
            headers: {
                ...(options.headers || {}),
                ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
            },
        };
        const r = https.request(opts, (resp) => {
            let raw = '';
            resp.on('data', chunk => raw += chunk);
            resp.on('end', () => {
                try {
                    const ct = resp.headers['content-type'] || '';
                    const parsed = ct.includes('application/json') ? JSON.parse(raw) : { message: raw };
                    resolve({ status: resp.statusCode, data: parsed, raw });
                } catch (e) {
                    resolve({ status: resp.statusCode, data: { message: raw }, raw });
                }
            });
        });
        r.on('error', reject);
        if (body) r.write(body);
        r.end();
    });

    try {
        // 1. Obter token OAuth2
        const tokenResp = await httpsRequest(
            `${PROTHEUS_BASE}/tlpp/oauth2/token?grant_type=password&username=sinco&password=Metal1120`,
            { method: 'GET' }
        );
        if (tokenResp.status >= 400 || !tokenResp.data.access_token) {
            throw new Error('Falha ao obter token Protheus: ' + (tokenResp.data.message || tokenResp.raw));
        }
        const accessToken = tokenResp.data.access_token;

        // 2. Enviar restrição
        const body = JSON.stringify(req.body);
        const editResp = await httpsRequest(
            `${PROTHEUS_BASE}/restricao/edit`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
            },
            body
        );

        if (editResp.status >= 400) {
            return res.status(editResp.status).json(editResp.data);
        }
        res.json(editResp.data);
    } catch (err) {
        console.error('Erro ao enviar restrição para Protheus:', err.message || err);
        res.status(500).json({ error: 'Falha de comunicação com API Protheus', details: err.message || String(err) });
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
