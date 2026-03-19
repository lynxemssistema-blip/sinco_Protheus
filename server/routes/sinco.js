const express = require('express');
const router = express.Router();
const pool = require('../services/mysqlService');
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
                g2_operac AS operacao,
                TRIM(g2_descri) AS descricao,
                g2_recurso AS recurso,
                g2_setup AS tempo_setup,
                g2_tempad AS tempo_padrao,
                g2_ferram AS ferramentas,
                g2_depto AS departamento
            FROM sg2010
            WHERE TRIM(g2_produto) = $1
            AND (d_e_l_e_t_ = '' OR d_e_l_e_t_ = ' ')
            ORDER BY g2_operac
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

module.exports = router;
