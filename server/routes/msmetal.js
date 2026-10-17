const express = require('express');
const router = express.Router();
const firebirdService = require('../services/firebirdService');
const { pool: pgPool } = require('../db');
let mysqlPool;
try {
    mysqlPool = require('../services/mysqlService');
} catch (e) {
    console.warn('⚠️ mysqlService não disponível em msmetal.js:', e.message);
}

// GET /api/msmetal/produtos - Catálogo de produtos com paginação, filtros e cruzamento Protheus
router.get('/produtos', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            search = '',
            code = '',
            client_code = '',
            client_name = '',
            has_bom = '',
            protheus_status = ''
        } = req.query;

        // 1. Busca no Firebird (MS Metal)
        const result = await firebirdService.getProdutosMSMetal({
            page,
            limit,
            search,
            code,
            client_code,
            client_name,
            has_bom
        });

        let products = result.data || [];

        if (products.length === 0) {
            return res.json({
                data: [],
                meta: result.meta
            });
        }

        // 2. Cruzamento Automático com o Protheus (PostgreSQL - sb1010)
        const checkCodes = new Set();
        products.forEach(p => {
            if (p.REFER1) checkCodes.add(p.REFER1.trim());
            if (p.PRODUTO) checkCodes.add(p.PRODUTO.trim());
            if (p.COD_DES_ESTRUTURA) checkCodes.add(p.COD_DES_ESTRUTURA.trim());
        });

        const codesArr = Array.from(checkCodes).filter(Boolean);
        let protheusMap = {};

        if (codesArr.length > 0) {
            try {
                const pgSql = `
                    SELECT 
                        TRIM(b1_cod) AS b1_cod, 
                        TRIM(b1_desc) AS b1_desc, 
                        TRIM(b1_tipo) AS b1_tipo, 
                        TRIM(b1_um) AS b1_um, 
                        b1_peso AS b1_peso,
                        TRIM(b1_grupo) AS b1_grupo
                    FROM public.sb1010 
                    WHERE TRIM(b1_cod) = ANY($1) 
                      AND TRIM(COALESCE(d_e_l_e_t_, '')) <> '*'
                `;
                const pgRes = await pgPool.query(pgSql, [codesArr]);
                pgRes.rows.forEach(r => {
                    protheusMap[r.b1_cod] = {
                        cadastrado: true,
                        codigo: r.b1_cod,
                        descricao: r.b1_desc,
                        tipo: r.b1_tipo,
                        unidade: r.b1_um,
                        peso: r.b1_peso,
                        grupo: r.b1_grupo
                    };
                });
            } catch (pgErr) {
                console.warn('⚠️ Falha ao verificar Protheus sb1010 para MS Metal:', pgErr.message);
            }
        }

        // 3. Verificação de Desenhos / PDFs no MySQL (produtos_docs)
        let docsMap = {};
        if (mysqlPool && codesArr.length > 0) {
            try {
                const placeholders = codesArr.map(() => '?').join(',');
                const docsSql = `
                    SELECT produto_codigo, url_arquivo, tipo, titulo, revisao 
                    FROM produtos_docs 
                    WHERE produto_codigo IN (${placeholders})
                `;
                const [docRows] = await mysqlPool.query(docsSql, codesArr);
                docRows.forEach(d => {
                    const cod = d.produto_codigo ? d.produto_codigo.trim() : '';
                    if (!docsMap[cod]) docsMap[cod] = [];
                    docsMap[cod].push(d);
                });
            } catch (mysqlErr) {
                // Silencioso se mysql remoto estiver em retry
            }
        }

        // 4. Enriquecer produtos com dados do Protheus e Origem dos Desenhos
        const enriched = products.map(p => {
            const ref1 = p.REFER1 ? p.REFER1.trim() : '';
            const codProd = p.PRODUTO ? p.PRODUTO.trim() : '';
            const codDes = p.COD_DES_ESTRUTURA ? p.COD_DES_ESTRUTURA.trim() : '';

            // Vínculo Protheus
            const vinculo = protheusMap[ref1] || protheusMap[codProd] || protheusMap[codDes] || { cadastrado: false };

            // Desenho do Protheus
            const docsProtheus = docsMap[ref1] || docsMap[codProd] || docsMap[codDes] || [];
            const temDesenhoProtheus = docsProtheus.length > 0;
            const primeiroDocProtheus = temDesenhoProtheus ? docsProtheus[0] : null;

            // Desenho do MS Metal
            const temDesenhoMS = Boolean(p.COD_DES_ESTRUTURA || p.ARQUIVO_PROD || p.ARQUIVO_EST || p.REFER1);
            const codigoDesenhoMS = p.COD_DES_ESTRUTURA || p.REFER1 || '';

            return {
                ...p,
                protheus_vinculo: vinculo,
                desenho_origem: {
                    tem_ms: temDesenhoMS,
                    codigo_ms: codigoDesenhoMS,
                    revisao_ms: p.COD_REVDES_ESTRUTURA || '',
                    arquivo_ms: p.ARQUIVO_EST || p.ARQUIVO_PROD || null,
                    tem_protheus: temDesenhoProtheus,
                    url_protheus: primeiroDocProtheus ? primeiroDocProtheus.url_arquivo : null,
                    qtd_docs_protheus: docsProtheus.length
                }
            };
        });

        // 5. Filtro adicional de status Protheus (se solicitado pelo cliente)
        let finalData = enriched;
        if (protheus_status === 'with_protheus') {
            finalData = enriched.filter(p => p.protheus_vinculo.cadastrado === true);
        } else if (protheus_status === 'without_protheus') {
            finalData = enriched.filter(p => p.protheus_vinculo.cadastrado === false);
        }

        res.json({
            data: finalData,
            meta: result.meta
        });
    } catch (err) {
        console.error('❌ Erro no endpoint /api/msmetal/produtos:', err);
        res.status(500).json({
            error: 'Erro ao consultar catálogo MS Metal: ' + err.message
        });
    }
});

// GET /api/msmetal/produtos/:id/estrutura - Árvore técnica completa (BOM, Roteiro, Clientes)
router.get('/produtos/:id/estrutura', async (req, res) => {
    try {
        const idOuCodigo = req.params.id;
        const estrutura = await firebirdService.getEstruturaMSMetal(idOuCodigo);

        // Cruzar componentes da estrutura com o Protheus
        const componentesCodes = new Set();
        if (estrutura.produto?.REFER1) componentesCodes.add(estrutura.produto.REFER1.trim());
        if (estrutura.produto?.PRODUTO) componentesCodes.add(estrutura.produto.PRODUTO.trim());

        estrutura.materias_primas.forEach(mp => {
            if (mp.COD_PRODUTO) componentesCodes.add(mp.COD_PRODUTO.trim());
            if (mp.REFER_MP) componentesCodes.add(mp.REFER_MP.trim());
        });

        estrutura.subconjuntos.forEach(sub => {
            if (sub.REFER_COMPONENTE) componentesCodes.add(sub.REFER_COMPONENTE.trim());
            if (sub.PROD_COMPONENTE) componentesCodes.add(sub.PROD_COMPONENTE.trim());
        });

        const compArr = Array.from(componentesCodes).filter(Boolean);
        let protheusMap = {};

        if (compArr.length > 0) {
            try {
                const pgSql = `
                    SELECT 
                        TRIM(b1_cod) AS b1_cod, 
                        TRIM(b1_desc) AS b1_desc, 
                        TRIM(b1_tipo) AS b1_tipo, 
                        TRIM(b1_um) AS b1_um 
                    FROM public.sb1010 
                    WHERE TRIM(b1_cod) = ANY($1) 
                      AND TRIM(COALESCE(d_e_l_e_t_, '')) <> '*'
                `;
                const pgRes = await pgPool.query(pgSql, [compArr]);
                pgRes.rows.forEach(r => {
                    protheusMap[r.b1_cod] = {
                        cadastrado: true,
                        codigo: r.b1_cod,
                        descricao: r.b1_desc,
                        tipo: r.b1_tipo,
                        unidade: r.b1_um
                    };
                });
            } catch (pgErr) {
                console.warn('⚠️ Falha ao verificar componentes no Protheus:', pgErr.message);
            }
        }

        // Verificar desenhos no MySQL
        let docsMap = {};
        if (mysqlPool && compArr.length > 0) {
            try {
                const placeholders = compArr.map(() => '?').join(',');
                const docsSql = `
                    SELECT produto_codigo, url_arquivo, tipo, titulo 
                    FROM produtos_docs 
                    WHERE produto_codigo IN (${placeholders})
                `;
                const [docRows] = await mysqlPool.query(docsSql, compArr);
                docRows.forEach(d => {
                    const cod = d.produto_codigo ? d.produto_codigo.trim() : '';
                    if (!docsMap[cod]) docsMap[cod] = [];
                    docsMap[cod].push(d);
                });
            } catch (mysqlErr) {}
        }

        // Enriquecer estrutura raiz
        const prodRef = estrutura.produto?.REFER1 ? estrutura.produto.REFER1.trim() : '';
        const prodCod = estrutura.produto?.PRODUTO ? estrutura.produto.PRODUTO.trim() : '';
        const raizProtheus = protheusMap[prodRef] || protheusMap[prodCod] || { cadastrado: false };
        const raizDocsProtheus = docsMap[prodRef] || docsMap[prodCod] || [];

        // Enriquecer matérias-primas
        const materiasPrimasEnriched = estrutura.materias_primas.map(mp => {
            const mRef = mp.REFER_MP ? mp.REFER_MP.trim() : '';
            const mCod = mp.COD_PRODUTO ? mp.COD_PRODUTO.trim() : '';
            return {
                ...mp,
                protheus_vinculo: protheusMap[mRef] || protheusMap[mCod] || { cadastrado: false },
                desenho_protheus: docsMap[mRef]?.[0]?.url_arquivo || docsMap[mCod]?.[0]?.url_arquivo || null
            };
        });

        // Enriquecer subconjuntos
        const subconjuntosEnriched = estrutura.subconjuntos.map(sub => {
            const sRef = sub.REFER_COMPONENTE ? sub.REFER_COMPONENTE.trim() : '';
            const sCod = sub.PROD_COMPONENTE ? sub.PROD_COMPONENTE.trim() : '';
            return {
                ...sub,
                protheus_vinculo: protheusMap[sRef] || protheusMap[sCod] || { cadastrado: false },
                desenho_protheus: docsMap[sRef]?.[0]?.url_arquivo || docsMap[sCod]?.[0]?.url_arquivo || null
            };
        });

        res.json({
            ...estrutura,
            materias_primas: materiasPrimasEnriched,
            subconjuntos: subconjuntosEnriched,
            protheus_vinculo: raizProtheus,
            desenho_origem: {
                tem_ms: Boolean(estrutura.estrutura?.COD_DES_ESTRUTURA || estrutura.produto?.REFER1),
                codigo_ms: estrutura.estrutura?.COD_DES_ESTRUTURA || estrutura.produto?.REFER1,
                revisao_ms: estrutura.estrutura?.COD_REVDES_ESTRUTURA || '',
                arquivo_ms: estrutura.estrutura?.ARQUIVO || estrutura.produto?.ARQUIVO_PROD || null,
                tem_protheus: raizDocsProtheus.length > 0,
                url_protheus: raizDocsProtheus[0]?.url_arquivo || null,
                docs_protheus: raizDocsProtheus
            }
        });
    } catch (err) {
        const notFound = /não encontrad/i.test(err.message || '');
        if (!notFound) console.error('❌ Erro no endpoint /api/msmetal/produtos/:id/estrutura:', err);
        res.status(notFound ? 404 : 500).json({
            error: notFound ? err.message : 'Erro ao consultar estrutura no MS Metal: ' + err.message
        });
    }
});

module.exports = router;
