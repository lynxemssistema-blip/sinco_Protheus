const express = require('express');
const router = express.Router();
const pool = require('../db'); // Changed db to pool
const mysqlPool = require('../services/mysqlService'); // Importar conexão MySQL

// --- VERIFICAÇÃO DE TABELA (ATA VIVA) ---
// Garante que a tabela exista para evitar erros nas rotas
(async () => {
    try {
        await mysqlPool.execute(`
            CREATE TABLE IF NOT EXISTS app_produto_ata (
                id INT AUTO_INCREMENT PRIMARY KEY,
                produto_codigo VARCHAR(50) NOT NULL,
                projeto VARCHAR(100),
                item_projeto VARCHAR(50),
                numero_pedido VARCHAR(50),
                item_pedido VARCHAR(50),
                texto TEXT,
                usuario VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_produto (produto_codigo)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // Migração simples: Tenta adicionar colunas caso a tabela já exista sem elas
        try { await mysqlPool.execute("ALTER TABLE app_produto_ata ADD COLUMN numero_pedido VARCHAR(50)"); } catch (e) { }
        try { await mysqlPool.execute("ALTER TABLE app_produto_ata ADD COLUMN item_pedido VARCHAR(50)"); } catch (e) { }

        console.log('✅ Tabela app_produto_ata verificada/criada.');
    } catch (err) {
        console.error('❌ Erro ao verificar tabela app_produto_ata:', err.message);
    }
})();

// GET /api/produtos - Listagem com busca e paginação
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '', code = '', type = '' } = req.query;
        const offset = (page - 1) * limit;

        // Definição da Query Base e Colunas
        const columns = `
            TRIM(sb1.b1_cod) AS codigo,
            sb1.b1_desc AS descricao,
            sb1.b1_tipo AS tipo,
            sb1.b1_um AS unidade,
            sb1.b1_grupo AS grupo
        `;

        let baseQuery = "FROM public.sb1010 sb1 WHERE TRIM(COALESCE(sb1.d_e_l_e_t_, '')) <> '*'";
        let params = [];
        let paramIndex = 1;

        // 1. Generic Search (Legacy support or Quick Search)
        if (search) {
            // Split by space/comma
            const terms = search.split(/[\s,]+/).filter(t => t.length > 0);

            if (terms.length > 0) {
                baseQuery += ' AND (';
                // Logic: ( (desc LIKE t1 AND desc LIKE t2...) OR (cod LIKE search) )

                // Description part: ALL terms must match
                let descConditions = terms.map(() => `sb1.b1_desc ILIKE $${paramIndex++}`).join(' AND ');

                // Code part: Exact or partial match of the full string? Usually Code is single token. 
                // Let's just check if the FULL search string matches code OR if the breakdown matches description.
                let codeCondition = `TRIM(sb1.b1_cod) ILIKE $${paramIndex++}`;

                baseQuery += `(${descConditions}) OR ${codeCondition})`;

                // Push params
                terms.forEach(t => params.push(`%${t}%`));
                params.push(`%${search}%`);
            }
        }

        // 2. Specific Code Filter
        if (code) {
            baseQuery += ` AND TRIM(sb1.b1_cod) ILIKE $${paramIndex++}`;
            params.push(`%${code}%`);
        }

        // 3. Specific Type Filter
        if (type) {
            baseQuery += ` AND TRIM(sb1.b1_tipo) = $${paramIndex++}`;
            params.push(type);
        }

        // 3.1 Specific Group Filter
        if (req.query.group) {
            baseQuery += ` AND TRIM(sb1.b1_grupo) = $${paramIndex++}`;
            params.push(req.query.group);
        }

        // 4. Client Name Filter (Search in SZ1010)
        if (req.query.client) {
            const clientTerm = `%${req.query.client}%`;
            baseQuery += ` AND EXISTS (
                SELECT 1 FROM public.sz1010 z1 
                WHERE TRIM(z1.z1_produto) = TRIM(sb1.b1_cod) 
                AND TRIM(COALESCE(z1.d_e_l_e_t_, '')) <> '*'
                AND z1.z1_nomecli ILIKE $${paramIndex++}
             )`;
            params.push(clientTerm);
        }

        // 5. Client Code Filter (Search in SZ1010)
        // Normaliza o termo buscado e o campo z1_codcli (remove caracteres não-alfanuméricos)
        // para que "33.11.10572" encontre "33111057204" e vice-versa
        if (req.query.client_code) {
            const cleanedTerm = req.query.client_code.replace(/[^a-zA-Z0-9]/g, '');
            if (cleanedTerm.length > 0) {
                baseQuery += ` AND EXISTS (
                    SELECT 1 FROM public.sz1010 z1
                    WHERE TRIM(z1.z1_produto) = TRIM(sb1.b1_cod)
                    AND TRIM(COALESCE(z1.d_e_l_e_t_, '')) <> '*'
                    AND regexp_replace(trim(z1.z1_codcli), '[^a-zA-Z0-9]', '', 'g') ILIKE $${paramIndex++}
                )`;
                params.push(`%${cleanedTerm}%`);
            }
        }

        // 6. File Path Filter (Multi-word search in MySQL produtos_docs)
        if (req.query.file_path) {
            console.log('🔍 Filtro por endereço recebido:', req.query.file_path);
            // Split by space to support multi-word search
            const pathTerms = req.query.file_path.trim().split(/\s+/).filter(t => t.length > 0);

            if (pathTerms.length > 0) {
                console.log('📝 Termos de busca:', pathTerms);
                // Build subquery that checks if product has a document
                // with url_arquivo containing ALL search terms
                const mysqlParams = pathTerms.map(t => `%${t}%`);
                const mysqlPlaceholders = mysqlParams.map(() => '?').join(',');

                // Store for later MySQL query (we'll check this separately after PG query)
                // For now, we'll just mark these products for filtering in the enrichment phase
                // NOTE: To fix pagination with this filter, strictly we should do what we do below for pdf_status
                // But for now keeping legacy behavior unless refactoring everything.
                req.filePathFilter = { terms: pathTerms, params: mysqlParams };
                console.log('✅ Filtro configurado:', req.filePathFilter);
            }
        }

        // 7. PDF Status Filter (With/Without PDF) - NEW FEATURE
        if (req.query.pdf_status) {
            const status = req.query.pdf_status; // 'with_pdf' or 'without_pdf'

            // 1. Get all product codes that HAVE documents from MySQL
            const [rows] = await mysqlPool.execute('SELECT DISTINCT produto_codigo FROM produtos_docs');
            const codesWithDocs = rows.map(r => r.produto_codigo.trim());

            if (status === 'with_pdf') {
                if (codesWithDocs.length === 0) {
                    // No documents exist at all -> return existing empty set logic
                    baseQuery += ' AND 1=0';
                } else {
                    // Postgres ANY param
                    baseQuery += ` AND TRIM(sb1.b1_cod) = ANY($${paramIndex++})`;
                    params.push(codesWithDocs);
                }
            } else if (status === 'without_pdf') {
                if (codesWithDocs.length > 0) {
                    // Exclude those that have docs
                    baseQuery += ` AND NOT (TRIM(sb1.b1_cod) = ANY($${paramIndex++}))`;
                    params.push(codesWithDocs);
                }
                // If length is 0, then ALL products are "without_pdf", so no filter needed.
            }
        }

        // 8. Stock Status Filter (Com Estoque/Sem Estoque)
        if (req.query.stock_status) {
            const stockStatus = req.query.stock_status; // 'with_stock' or 'without_stock'

            const [stockRows] = await mysqlPool.execute(`
                SELECT produto_codigo 
                FROM app_estoque_movimentos 
                GROUP BY produto_codigo 
                HAVING SUM(CASE WHEN tipo = 'E' THEN quantidade ELSE 0 END) - SUM(CASE WHEN tipo = 'S' THEN quantidade ELSE 0 END) > 0
            `);
            const codesWithStock = stockRows.map(r => r.produto_codigo.trim());

            if (stockStatus === 'with_stock') {
                if (codesWithStock.length === 0) {
                    baseQuery += ' AND 1=0';
                } else {
                    baseQuery += ` AND TRIM(sb1.b1_cod) = ANY($${paramIndex++})`;
                    params.push(codesWithStock);
                }
            } else if (stockStatus === 'without_stock') {
                if (codesWithStock.length > 0) {
                    baseQuery += ` AND NOT (TRIM(sb1.b1_cod) = ANY($${paramIndex++}))`;
                    params.push(codesWithStock);
                }
            }
        }

        const query = `SELECT ${columns} ${baseQuery} ORDER BY sb1.b1_cod LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        const countQuery = `SELECT COUNT(*) AS total ${baseQuery}`;

        const productsResult = await pool.query(query, [...params, limit, offset]);
        const countResult = await pool.query(countQuery, params);

        const produtos = productsResult.rows;

        // --- PARALLEL ENRICHMENT (4 independent queries at once) ---
        if (produtos.length > 0) {
            const codigos = produtos.map(p => p.codigo);
            const pgPlaceholders = codigos.map((_, i) => `$${i + 1}`).join(',');
            const mysqlPlaceholders = codigos.map(() => '?').join(',');

            const [szResult, sgResult, stockResult, imgsAssocsResult] = await Promise.allSettled([
                // 1. Referências Cliente (PG - SZ1010)
                pool.query(`
                    SELECT TRIM(z1_produto) as produto, TRIM(z1_codcli) as desenho,
                           TRIM(z1_nomecli) as cliente, TRIM(z1_revisao) as revisao
                    FROM public.sz1010
                    WHERE TRIM(z1_produto) IN (${pgPlaceholders})
                    AND TRIM(COALESCE(d_e_l_e_t_, '')) <> '*'
                `, codigos),

                // 2. Estrutura (PG - SG1010)
                pool.query(`
                    SELECT TRIM(g1_cod) as codigo
                    FROM public.sg1010
                    WHERE TRIM(g1_cod) IN (${pgPlaceholders})
                    AND TRIM(COALESCE(d_e_l_e_t_, '')) <> '*'
                    GROUP BY g1_cod
                `, codigos),

                // 3. Estoque Local (MySQL)
                mysqlPool.execute(`
                    SELECT produto_codigo as codigo,
                           SUM(CASE WHEN tipo = 'E' THEN quantidade ELSE 0 END) -
                           SUM(CASE WHEN tipo = 'S' THEN quantidade ELSE 0 END) as saldo
                    FROM app_estoque_movimentos
                    WHERE produto_codigo IN (${mysqlPlaceholders})
                    GROUP BY produto_codigo
                `, codigos),

                // 4. Imagens + Associações (MySQL — 2 queries sequenciais dentro)
                (async () => {
                    const [imgs] = await mysqlPool.execute(
                        `SELECT produto_codigo, url_imagem FROM app_produto_imagens WHERE produto_codigo IN (${mysqlPlaceholders}) ORDER BY id DESC`,
                        codigos
                    );
                    const [assocs] = await mysqlPool.execute(
                        `SELECT * FROM app_produto_associacoes WHERE produto_origem IN (${mysqlPlaceholders}) OR produto_destino IN (${mysqlPlaceholders})`,
                        [...codigos, ...codigos]
                    );
                    return { imgs, assocs };
                })()
            ]);

            // Merge SZ1 refs
            if (szResult.status === 'fulfilled') {
                const refMap = {};
                szResult.value.rows.forEach(r => {
                    if (!refMap[r.produto]) refMap[r.produto] = [];
                    refMap[r.produto].push(r);
                });
                produtos.forEach(p => { p.referencias = refMap[p.codigo] || []; });
            } else {
                console.error('Erro SZ1:', szResult.reason?.message);
            }

            // Merge SG1 structure
            if (sgResult.status === 'fulfilled') {
                const structSet = new Set(sgResult.value.rows.map(r => r.codigo.trim()));
                produtos.forEach(p => { p.tem_estrutura = structSet.has(p.codigo.trim()); });
            } else {
                console.error('Erro SG1:', sgResult.reason?.message);
            }

            // Merge stock
            if (stockResult.status === 'fulfilled') {
                const stockMap = {};
                stockResult.value[0].forEach(r => { stockMap[r.codigo] = parseFloat(r.saldo || 0); });
                produtos.forEach(p => { p.estoque_total = stockMap[p.codigo.trim()] || 0; });
            } else {
                console.error('Erro Estoque:', stockResult.reason?.message);
            }

            // Merge images + associations
            if (imgsAssocsResult.status === 'fulfilled') {
                const { imgs, assocs } = imgsAssocsResult.value;
                const imgMap = {};
                imgs.forEach(i => { if (!imgMap[i.produto_codigo]) imgMap[i.produto_codigo] = i.url_imagem; });

                const assocMap = {};
                assocs.forEach(a => {
                    const originMatch = codigos.find(c => c.trim().toUpperCase() === (a.produto_origem || '').trim().toUpperCase());
                    if (originMatch) {
                        if (!assocMap[originMatch]) assocMap[originMatch] = [];
                        assocMap[originMatch].push({ other: a.produto_destino, type: a.tipo_associacao, obs: a.comentario, role: 'origem' });
                    }
                    const destMatch = codigos.find(c => c.trim().toUpperCase() === (a.produto_destino || '').trim().toUpperCase());
                    if (destMatch) {
                        if (!assocMap[destMatch]) assocMap[destMatch] = [];
                        assocMap[destMatch].push({ other: a.produto_origem, type: a.tipo_associacao, obs: a.comentario, role: 'destino' });
                    }
                });

                produtos.forEach(p => {
                    p.imagem_url = imgMap[p.codigo] || null;
                    p.associacoes = assocMap[p.codigo] || [];
                });
            } else {
                console.error('Erro Imgs/Assocs:', imgsAssocsResult.reason?.message);
            }
        }

        // --- ENRICHMENT DO MYSQL (Documentos com Metadados Extraídos) ---
        if (produtos.length > 0) {
            try {
                // Coletar códigos para consulta em lote (IN (...))
                const codigos = produtos.map(p => p.codigo);
                console.log('🔍 Códigos sendo buscados no MySQL:', codigos); // DEBUG CODE
                let placeholders = codigos.map(() => '?').join(',');

                // Base query
                let docsQuery = `SELECT produto_codigo, id, url_arquivo, titulo, tipo,
                        titulo_desenho, peso_kg, operacao, area_pintura_m2, material, 
                        espessura_mm, dimensoes, revisao, confianca, 
                        extraido_em, extraido_por
                 FROM produtos_docs 
                 WHERE produto_codigo IN (${placeholders})`;

                let docsParams = [...codigos];

                // Apply file path filter if present
                if (req.filePathFilter) {
                    // Add WHERE conditions for multi-word search
                    // All terms must match (AND logic)
                    const conditions = req.filePathFilter.terms.map(() => 'url_arquivo LIKE ?').join(' AND ');
                    docsQuery += ` AND (${conditions})`;
                    docsParams.push(...req.filePathFilter.params);
                }

                docsQuery += ' ORDER BY created_at DESC';

                // Busca documentos com metadados extraídos
                const [rows] = await mysqlPool.execute(docsQuery, docsParams);

                console.log(`📊 Documentos encontrados: ${rows.length}${req.filePathFilter ? ' (com filtro de endereço)' : ''}`);

                // Se há filtro de arquivo, precisamos filtrar a lista de produtos
                if (req.filePathFilter && rows.length > 0) {
                    // Apenas produtos que têm documentos que passaram no filtro
                    const codigosComArquivos = new Set(rows.map(r => r.produto_codigo));
                    const produtosAntes = produtos.length;
                    produtos = produtos.filter(p => codigosComArquivos.has(p.codigo));
                    console.log(`✂️ Produtos filtrados: ${produtosAntes} → ${produtos.length}`);
                } else if (req.filePathFilter && rows.length === 0) {
                    // Nenhum produto tem arquivo que corresponde ao filtro
                    console.log('❌ Nenhum documento encontrado com o filtro de endereço');
                    produtos = [];
                }

                // Agrupar por produto
                const docsMap = {};
                rows.forEach(r => {
                    if (!docsMap[r.produto_codigo]) {
                        docsMap[r.produto_codigo] = [];
                    }
                    docsMap[r.produto_codigo].push(r);
                });

                // Adicionar info aos produtos
                produtos.forEach(p => {
                    const docs = docsMap[p.codigo] || [];
                    p.tem_arquivos = docs.length > 0;
                    p.arquivos_count = docs.length;

                    // Prioritize 'Desenho' type, otherwise take the most recent one (docs[0])
                    const drawing = docs.find(d => d.tipo === 'Desenho');
                    p.primeiro_arquivo = drawing ? drawing.url_arquivo : (docs.length > 0 ? docs[0].url_arquivo : null);

                    // Agregar metadados extraídos (pegar do primeiro documento com metadados relevantes)
                    // CORREÇÃO: Antes exigia titulo_desenho !== null. Agora aceita se tiver peso, operação OU titulo_desenho.
                    const docComMetadados = docs.find(d =>
                        d.titulo_desenho !== null ||
                        d.peso_kg !== null ||
                        (d.operacao !== null && d.operacao !== '')
                    );

                    if (docComMetadados) {
                        p.metadados = {
                            titulo_desenho: docComMetadados.titulo_desenho,
                            peso_kg: docComMetadados.peso_kg,
                            operacao: docComMetadados.operacao,
                            area_pintura_m2: docComMetadados.area_pintura_m2,
                            material: docComMetadados.material,
                            espessura_mm: docComMetadados.espessura_mm,
                            dimensoes: docComMetadados.dimensoes,
                            revisao: docComMetadados.revisao,
                            confianca: docComMetadados.confianca,
                            extraido_em: docComMetadados.extraido_em
                        };
                    } else {
                        p.metadados = null;
                    }
                });

            } catch (mysqlErr) {
                console.error('⚠️ Erro ao verificar documentos no MySQL:', mysqlErr.message);
                // Em caso de erro, garantimos clean state
                produtos.forEach(p => {
                    if (p.tem_arquivos === undefined) {
                        p.tem_arquivos = false;
                        p.arquivos_count = 0;
                        p.primeiro_arquivo = null;
                        p.metadados = null;
                    }
                });
            }
        }

        res.json({
            data: produtos,
            meta: {
                total: parseInt(countResult.rows[0].total),
                page: parseInt(page),
                limit: parseInt(limit)
            }
        });

    } catch (err) {
        console.error('Erro ao listar produtos:', err.message);
        res.status(500).json({ error: 'Erro ao listar produtos.', details: err.message });
    }
});

// GET /api/produtos/:codigo/estrutura
router.get('/:codigo/estrutura', async (req, res) => {
    try {
        const { codigo } = req.params;
        // Limpar espaços em branco do código caso venham
        const codClean = codigo.trim();

        // Query Recursiva (CTE) para explodir a estrutura
        const query = `
        WITH RECURSIVE bombill (cod_pai, cod_comp, nivel, qtd_rel, caminho) AS (
            -- Nível 0 (O próprio produto raiz)
            SELECT 
                TRIM(sb1.b1_cod)  AS cod_pai, 
                TRIM(sb1.b1_cod)  AS cod_comp, 
                0           AS nivel, 
                1::numeric  AS qtd_rel,
                TRIM(sb1.b1_cod)::text AS caminho
            FROM public.sb1010 sb1
            WHERE TRIM(sb1.b1_cod) = $1 
              AND TRIM(COALESCE(sb1.d_e_l_e_t_, '')) <> '*'

            UNION ALL

            -- Níveis N (Filhos)
            SELECT
                TRIM(g1.g1_cod)   AS cod_pai,
                TRIM(g1.g1_comp)  AS cod_comp,
                b.nivel + 1 AS nivel,
                (b.qtd_rel * g1.g1_quant::numeric) AS qtd_rel,
                (b.caminho || ' > ' || TRIM(g1.g1_comp)) AS caminho
            FROM bombill b
            JOIN public.sg1010 g1 
                ON TRIM(g1.g1_cod) = b.cod_comp 
                AND TRIM(COALESCE(g1.d_e_l_e_t_, '')) <> '*'
            WHERE b.nivel < 20
        )
        SELECT 
            b.nivel,
            b.cod_comp  AS codigo,
            sb1.b1_desc AS descricao,
            sb1.b1_um   AS unidade,
            sb1.b1_grupo AS grupo,
            b.qtd_rel   AS qtd_necessaria,
            b.caminho
        FROM bombill b
        LEFT JOIN public.sb1010 sb1 
            ON TRIM(sb1.b1_cod) = b.cod_comp
            AND TRIM(COALESCE(sb1.d_e_l_e_t_, '')) <> '*'
        ORDER BY b.caminho
        `;

        const result = await pool.query(query, [codClean]);
        const items = result.rows;

        // --- ENRICHMENT (DOCUMENTOS) ---
        if (items.length > 0) {
            try {
                const codigos = items.map(i => i.codigo.trim());
                // Create placeholders for MySQL IN (?)
                const placeholders = codigos.map(() => '?').join(',');

                // Fetch docs for these codes
                // We want to know IF it has docs, and get the first one for direct open capability
                const [docs] = await mysqlPool.execute(
                    `SELECT produto_codigo, url_arquivo, tipo FROM produtos_docs WHERE produto_codigo IN (${placeholders}) ORDER BY id ASC`,
                    codigos
                );

                const docMap = {};
                docs.forEach(d => {
                    // Update: Store 'Desenho' if found, or keep first found if no drawing yet
                    if (!docMap[d.produto_codigo]) {
                        docMap[d.produto_codigo] = d.url_arquivo; // Initialize with first found
                    }
                    if (d.tipo === 'Desenho') {
                        docMap[d.produto_codigo] = d.url_arquivo; // Overwrite if it is a drawing
                    }
                });

                items.forEach(i => {
                    const fileUrl = docMap[i.codigo.trim()];
                    i.tem_arquivos = !!fileUrl;
                    i.primeiro_arquivo = fileUrl || null;
                });

            } catch (errDocs) {
                console.error('Erro ao buscar documentos da estrutura:', errDocs);
            }
        }

        res.json(items);

    } catch (err) {
        console.error(`Erro ao buscar estrutura do produto ${req.params.codigo}:`, err.message);
        res.status(500).json({ error: 'Erro ao buscar estrutura do produto.', details: err.message });
    }
});

// GET /api/produtos/:codigo/roteiro
router.get('/:codigo/roteiro', async (req, res) => {
    try {
        const { codigo } = req.params;
        const codClean = decodeURIComponent(codigo).trim();

        const query = `
            SELECT
                g2.g2_operac                    AS operacao,
                TRIM(h1.h1_descri)              AS descricao,
                TRIM(g2.g2_recurso)             AS recurso,
                g2.g2_setup                     AS tempo_setup,
                g2.g2_tempad                    AS tempo_padrao,
                g2.g2_ferram                    AS ferramentas,
                g2.g2_depto                     AS departamento
            FROM public.sg2010 g2
            LEFT JOIN public.sh1010 h1
                ON h1.h1_codigo = g2.g2_recurso
                AND COALESCE(h1.d_e_l_e_t_, '') IN ('', ' ')
            WHERE TRIM(g2.g2_produto) = $1
            AND (g2.d_e_l_e_t_ = '' OR g2.d_e_l_e_t_ = ' ')
            AND g2.g2_codigo = (
                SELECT MAX(g2_sub.g2_codigo)
                FROM public.sg2010 g2_sub
                WHERE TRIM(g2_sub.g2_produto) = TRIM(g2.g2_produto)
                AND (g2_sub.d_e_l_e_t_ = '' OR g2_sub.d_e_l_e_t_ = ' ')
            )
            ORDER BY g2.g2_operac
        `;

        const result = await pool.query(query, [codClean]);

        console.log(`🔧 [ROTEIRO] ${result.rows.length} operações para produto ${codClean}`);
        res.json(result.rows);

    } catch (err) {
        console.error(`Erro ao buscar roteiro do produto ${req.params.codigo}:`, err.message);
        res.status(500).json({ error: 'Erro ao buscar roteiro do produto.', details: err.message });
    }
});

// --- IMAGENS ---
router.post('/:codigo/imagem', async (req, res) => {
    try {
        const { url } = req.body;
        const { codigo } = req.params;

        // Simple strategy: insert new record. User can have multiple history or we just care about latest.
        // Or delete previous? Let's just Insert.
        await mysqlPool.execute(
            'INSERT INTO app_produto_imagens (produto_codigo, url_imagem) VALUES (?, ?)',
            [codigo, url]
        );
        res.json({ message: 'Imagem salva com sucesso' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- ASSOCIAÇÕES ---
router.get('/:codigo/associacoes', async (req, res) => {
    try {
        const { codigo } = req.params;
        // Fetch associations where product is origin or destination
        const [rows] = await mysqlPool.execute(
            `SELECT * FROM app_produto_associacoes 
             WHERE produto_origem = ? OR produto_destino = ? 
             ORDER BY created_at DESC`,
            [codigo, codigo]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/:codigo/associacoes', async (req, res) => {
    try {
        const { codigo } = req.params;
        const { produto_destino, tipo, comentario } = req.body;

        await mysqlPool.execute(
            'INSERT INTO app_produto_associacoes (produto_origem, produto_destino, tipo_associacao, comentario) VALUES (?, ?, ?, ?)',
            [codigo, produto_destino, tipo || 'Relacionado', comentario]
        );
        res.json({ message: 'Associação criada' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:codigo/associacoes/:id', async (req, res) => {
    try {
        await mysqlPool.execute('DELETE FROM app_produto_associacoes WHERE id = ?', [req.params.id]);
        res.json({ message: 'Associação removida' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- IMPORTAÇÃO DE PESOS VIA EXCEL ---
const multer = require('multer');
const ExcelJS = require('exceljs');
const upload = multer({ storage: multer.memoryStorage() });

router.post('/import-weights', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
        }

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);

        const sheet = workbook.getWorksheet('Operações');
        if (!sheet) {
            return res.status(400).json({ error: 'A planilha deve conter uma aba chamada "Operações".' });
        }

        let stats = {
            total_linhas: 0,
            atualizados: 0,
            ignorados_sem_doc: 0,
            erros: 0
        };

        const updates = [];

        // Iterar linhas (Assumindo cabeçalho na linha 1)
        sheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // Pular cabeçalho

            // Coluna C (3) = Código, Coluna D (4) = Peso, Coluna F (6) = Operação
            const codigoCell = row.getCell(3).value;
            const pesoCell = row.getCell(4).value;
            const operacaoCell = row.getCell(6).value;

            if (codigoCell) {
                const codigo = codigoCell.toString().trim();
                const peso = pesoCell ? parseFloat(pesoCell) : null;
                const operacao = operacaoCell ? operacaoCell.toString().trim() : null;

                if (codigo) {
                    updates.push({ codigo, peso, operacao });
                }
            }
            stats.total_linhas++;
        });

        console.log(`📊 Processando ${updates.length} linhas de atualização...`);

        for (const item of updates) {
            try {
                // Montar query dinâmica
                let fields = [];
                let params = [];

                if (item.peso !== null && !isNaN(item.peso)) {
                    fields.push('peso_kg = ?');
                    params.push(item.peso);
                }

                if (item.operacao !== null) {
                    fields.push('operacao = ?');
                    params.push(item.operacao);
                }

                if (fields.length > 0) {
                    params.push(item.codigo);
                    const sql = `UPDATE produtos_docs SET ${fields.join(', ')} WHERE produto_codigo = ?`;

                    const [result] = await mysqlPool.execute(sql, params);

                    if (result.affectedRows > 0) {
                        stats.atualizados++;
                    } else {
                        stats.ignorados_sem_doc++;
                    }
                }
            } catch (err) {
                console.error(`Erro ao atualizar produto ${item.codigo}:`, err.message);
                stats.erros++;
            }
        }

        res.json({
            mensagem: 'Importação concluída.',
            estatisticas: stats,
            detalhes: 'Produtos sem registro de documento na tabela "produtos_docs" foram ignorados.'
        });

    } catch (err) {
        console.error('Erro na importação de pesos:', err);
        res.status(500).json({ error: 'Erro ao processar arquivo Excel.', detalhes: err.message });
    }
});

// --- ATA VIVA (LIVE MINUTES) ---
// GET /api/produtos/:codigo/ata - Listar itens da Ata Viva
router.get('/:codigo/ata', async (req, res) => {
    try {
        const { codigo } = req.params;
        const [rows] = await mysqlPool.execute(
            `SELECT * FROM app_produto_ata 
             WHERE produto_codigo = ? 
             ORDER BY created_at DESC`,
            [codigo]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/produtos/:codigo/ata - Criar novo item na Ata Viva
router.post('/:codigo/ata', async (req, res) => {
    try {
        const { codigo } = req.params;
        const { projeto, item_projeto, numero_pedido, item_pedido, texto, usuario } = req.body;

        if (!usuario) {
            return res.status(400).json({ error: 'Usuário é obrigatório.' });
        }

        await mysqlPool.execute(
            `INSERT INTO app_produto_ata (produto_codigo, projeto, item_projeto, numero_pedido, item_pedido, texto, usuario) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [codigo, projeto, item_projeto, numero_pedido, item_pedido, texto, usuario]
        );
        res.json({ message: 'Item da Ata Viva criado com sucesso.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/produtos/ata/:id - Editar item (apenas o criador)
router.put('/ata/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { texto, usuario, projeto, item_projeto, numero_pedido, item_pedido } = req.body;

        // 1. Verificar se o item pertence ao usuário
        const [rows] = await mysqlPool.execute('SELECT usuario FROM app_produto_ata WHERE id = ?', [id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Item não encontrado.' });
        }

        if (rows[0].usuario !== usuario) {
            return res.status(403).json({ error: 'Permissão negada. Você só pode editar itens que você criou.' });
        }

        // 2. Atualizar
        await mysqlPool.execute(
            `UPDATE app_produto_ata 
             SET texto = ?, projeto = ?, item_projeto = ?, numero_pedido = ?, item_pedido = ? 
             WHERE id = ?`,
            [texto, projeto, item_projeto, numero_pedido, item_pedido, id]
        );

        res.json({ message: 'Item atualizado com sucesso.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/produtos/ata/:id - Excluir item (apenas o criador)
router.delete('/ata/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const usuario = req.body.usuario || req.query.usuario;

        // 1. Verificar se o item pertence ao usuário
        const [rows] = await mysqlPool.execute('SELECT usuario FROM app_produto_ata WHERE id = ?', [id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Item não encontrado.' });
        }

        if (rows[0].usuario !== usuario) {
            return res.status(403).json({ error: 'Permissão negada. Você só pode excluir itens que você criou.' });
        }

        // 2. Deletar
        await mysqlPool.execute('DELETE FROM app_produto_ata WHERE id = ?', [id]);

        res.json({ message: 'Item removido com sucesso.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- ATA VIVA (LIVE MINUTES) ---
// GET /api/produtos/:codigo/ata - Listar itens da Ata Viva
router.get('/:codigo/ata', async (req, res) => {
    try {
        const { codigo } = req.params;
        const [rows] = await mysqlPool.execute(
            `SELECT * FROM app_produto_ata 
             WHERE produto_codigo = ? 
             ORDER BY created_at DESC`,
            [codigo]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/produtos/:codigo/ata - Criar novo item na Ata Viva
router.post('/:codigo/ata', async (req, res) => {
    try {
        const { codigo } = req.params;
        const { projeto, item_projeto, numero_pedido, item_pedido, texto, usuario } = req.body;

        if (!usuario) {
            return res.status(400).json({ error: 'Usuário é obrigatório.' });
        }

        await mysqlPool.execute(
            `INSERT INTO app_produto_ata (produto_codigo, projeto, item_projeto, numero_pedido, item_pedido, texto, usuario) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [codigo, projeto, item_projeto, numero_pedido, item_pedido, texto, usuario]
        );
        res.json({ message: 'Item da Ata Viva criado com sucesso.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/produtos/ata/:id - Editar item (apenas o criador)
router.put('/ata/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { texto, usuario, projeto, item_projeto, numero_pedido, item_pedido } = req.body;

        // 1. Verificar se o item pertence ao usuário
        const [rows] = await mysqlPool.execute('SELECT usuario FROM app_produto_ata WHERE id = ?', [id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Item não encontrado.' });
        }

        if (rows[0].usuario !== usuario) {
            return res.status(403).json({ error: 'Permissão negada. Você só pode editar itens que você criou.' });
        }

        // 2. Atualizar
        await mysqlPool.execute(
            `UPDATE app_produto_ata 
             SET texto = ?, projeto = ?, item_projeto = ?, numero_pedido = ?, item_pedido = ? 
             WHERE id = ?`,
            [texto, projeto, item_projeto, numero_pedido, item_pedido, id]
        );

        res.json({ message: 'Item atualizado com sucesso.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/produtos/ata/:id - Excluir item (apenas o criador)
router.delete('/ata/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const usuario = req.body.usuario || req.query.usuario;

        // 1. Verificar se o item pertence ao usuário
        const [rows] = await mysqlPool.execute('SELECT usuario FROM app_produto_ata WHERE id = ?', [id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Item não encontrado.' });
        }

        if (rows[0].usuario !== usuario) {
            return res.status(403).json({ error: 'Permissão negada. Você só pode excluir itens que você criou.' });
        }

        // 2. Deletar
        await mysqlPool.execute('DELETE FROM app_produto_ata WHERE id = ?', [id]);

        res.json({ message: 'Item removido com sucesso.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/produtos/:codigo/extract-ai-batch - Processa documento em anexo e extrai metadados
router.post('/:codigo/extract-ai-batch', async (req, res) => {
    try {
        const { codigo } = req.params;
        const PDFExtractionService = require('../services/pdfExtraction');

        if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'sua_api_key_aqui') {
            return res.status(500).json({ error: 'GEMINI_API_KEY não configurada no servidor.' });
        }

        // 1. Encontrar o documento principal (priorizando o que já é 'Desenho')
        // Se o produto não tiver doc próprio, procura no produto de destino da sua associação
        const [docs] = await mysqlPool.execute(
            `SELECT p.id, p.url_arquivo, p.tipo, p.produto_codigo as origem 
             FROM produtos_docs p
             WHERE p.produto_codigo = ? 
               AND p.tipo = 'Desenho'
             
             UNION ALL
             
             SELECT p.id, p.url_arquivo, p.tipo, a.produto_origem as origem
             FROM app_produto_associacoes a
             JOIN produtos_docs p ON p.produto_codigo = a.produto_destino
             WHERE a.produto_origem = ?
               AND p.tipo = 'Desenho'
             
             ORDER BY id DESC 
             LIMIT 1`,
            [codigo, codigo]
        );

        if (docs.length === 0) {
            return res.status(404).json({ error: 'Nenhum Desenho encontrado para este produto ou em suas associações.' });
        }

        const doc = docs[0];

        if (!doc.url_arquivo.toLowerCase().endsWith('.pdf')) {
            return res.status(400).json({ error: 'O documento principal não é um PDF válido.' });
        }

        // 2. Extrair dados via Gemini
        const extractor = new PDFExtractionService(process.env.GEMINI_API_KEY);
        
        // Função para resolver o caminho (importada de docs.js indiretamente / normalizar)
        let normalizedPath = doc.url_arquivo.trim();
        normalizedPath = normalizedPath.replace(/^Q:[\/\\]/i, '\\\\192.168.1.253\\Engenharia\\');
        if (process.platform !== 'win32') {
            normalizedPath = normalizedPath.replace(/\\/g, '/');
            normalizedPath = normalizedPath.replace(/^\/\/192\.168\.1\.253\/Engenharia\//i, '/mnt/engenharia/');
        }

        const metadata = await extractor.extractFromPDF(normalizedPath);

        // 3. Atualizar o banco de dados (se não for apenas preview)
        if (req.query.preview !== 'true') {
            await mysqlPool.execute(`
                UPDATE produtos_docs 
                SET titulo_desenho = COALESCE(?, titulo_desenho),
                    peso_kg = COALESCE(?, peso_kg),
                    area_pintura_m2 = COALESCE(?, area_pintura_m2),
                    material = COALESCE(?, material),
                    espessura_mm = COALESCE(?, espessura_mm),
                    dimensoes = COALESCE(?, dimensoes),
                    revisao = COALESCE(?, revisao),
                    confianca = COALESCE(?, confianca),
                    extraido_em = CURRENT_TIMESTAMP,
                    extraido_por = 'manual_batch'
                WHERE id = ?
            `, [
                metadata.titulo,
                metadata.peso_kg,
                metadata.area_pintura_m2,
                metadata.material,
                metadata.espessura_mm,
                metadata.dimensoes,
                metadata.revisao,
                metadata.confianca,
                doc.id
            ]);
        }

        res.json({
            message: req.query.preview === 'true' ? 'Metadados extraídos (Preview)' : 'Metadados extraídos e salvos com sucesso.',
            codigo: codigo,
            documento_id: doc.id,
            url_arquivo: doc.url_arquivo,
            metadata
        });

    } catch (err) {
        console.error('Erro na extração em lote com IA:', err);
        res.status(500).json({ error: 'Erro ao processar documento com Inteligência Artificial.', details: err.message });
    }
});

// [NEW] Bulk save AI extracted metadata
router.post('/bulk-save-ai-metadata', async (req, res) => {
    try {
        const { items } = req.body;
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Lista de itens inválida vazia.' });
        }

        let updatedCount = 0;
        let errorCount = 0;

        for (const item of items) {
            try {
                // Ensure null instead of empty strings or undefined for numeric fields
                const peso_kg = item.peso_kg === '' || item.peso_kg == null ? null : parseFloat(item.peso_kg);
                const area_pintura_m2 = item.area_pintura_m2 === '' || item.area_pintura_m2 == null ? null : parseFloat(item.area_pintura_m2);

                await mysqlPool.execute(`
                    UPDATE produtos_docs 
                    SET peso_kg = ?,
                        area_pintura_m2 = ?,
                        extraido_em = CURRENT_TIMESTAMP,
                        extraido_por = 'manual_batch_review'
                    WHERE id = ?
                `, [
                    peso_kg,
                    area_pintura_m2,
                    item.documento_id
                ]);
                updatedCount++;
            } catch (itemErr) {
                console.error(`Erro ao salvar metadados para doc ${item.documento_id}:`, itemErr);
                errorCount++;
            }
        }

        res.json({
            message: 'Salvamento em lote concluído.',
            updatedCount,
            errorCount
        });

    } catch (err) {
        console.error('Erro no salvamento em lote de metadados IA:', err);
        res.status(500).json({ error: 'Erro ao salvar metadados em lote.' });
    }
});

module.exports = router;
