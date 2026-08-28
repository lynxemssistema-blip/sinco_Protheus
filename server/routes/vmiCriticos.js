const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const db = require('../db');
const { getInactiveOrdersFilter } = require('../util/pedidoFilterHelper');
const { hasFinancialAccess } = require('../util/permissionHelper');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// Helper pool MySQL para tabelas de apoio
const mysqlPool = require('../services/mysqlService');

// Inicialização das tabelas MySQL para VMI Críticos
async function initCriticosTables() {
    try {
        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS app_vmi_criticos_versoes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nome_arquivo VARCHAR(255) NOT NULL,
                aba_selecionada VARCHAR(100) NOT NULL,
                titulo_versao VARCHAR(255) DEFAULT NULL,
                data_referencia VARCHAR(30) DEFAULT NULL,
                mes_referencia VARCHAR(30) DEFAULT NULL,
                usuario_id VARCHAR(50) DEFAULT NULL,
                usuario_nome VARCHAR(150) DEFAULT NULL,
                total_itens INT DEFAULT 0,
                total_faltantes DECIMAL(14,2) DEFAULT 0,
                total_ok INT DEFAULT 0,
                total_pendente INT DEFAULT 0,
                dados_json LONGTEXT DEFAULT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS app_vmi_criticos_itens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                versao_id INT NOT NULL,
                cod_metalfisa VARCHAR(100) DEFAULT '',
                cod_vmi VARCHAR(100) NOT NULL,
                descricao VARCHAR(255) DEFAULT '',
                prioridade VARCHAR(50) DEFAULT '',
                wk01 DECIMAL(14,2) DEFAULT 0,
                wk02 DECIMAL(14,2) DEFAULT 0,
                wk03 DECIMAL(14,2) DEFAULT 0,
                wk04 DECIMAL(14,2) DEFAULT 0,
                wk05 DECIMAL(14,2) DEFAULT 0,
                total_faltantes DECIMAL(14,2) DEFAULT 0,
                entradas DECIMAL(14,2) DEFAULT 0,
                pre_nota DECIMAL(14,2) DEFAULT 0,
                faltantes_firmes DECIMAL(14,2) DEFAULT 0,
                status_entrega VARCHAR(100) DEFAULT '',
                follow_up TEXT DEFAULT NULL,
                previsao_entrega VARCHAR(50) DEFAULT '',
                nova_previsao VARCHAR(50) DEFAULT '',
                pedidos_json MEDIUMTEXT DEFAULT NULL,
                ops_json MEDIUMTEXT DEFAULT NULL,
                nfs_json MEDIUMTEXT DEFAULT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_versao (versao_id),
                INDEX idx_cod_vmi (cod_vmi),
                INDEX idx_cod_metal (cod_metalfisa),
                CONSTRAINT fk_criticos_versao FOREIGN KEY (versao_id) REFERENCES app_vmi_criticos_versoes(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        console.log('✅ [VMI CRITICOS] Tabelas verificadas/criadas com sucesso.');
    } catch (err) {
        console.error('❌ [VMI CRITICOS] Erro ao inicializar tabelas:', err.message);
    }
}

initCriticosTables();

// Utilitários de limpeza e correspondência de códigos
function cleanCode(str) {
    if (!str) return '';
    return String(str).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function stripRevision(str) {
    if (!str) return '';
    const s = String(str).trim();
    return s.replace(/\.[a-zA-Z0-9]{1,2}$/, '');
}

function getBaseCleanCode(str) {
    if (!str) return '';
    return cleanCode(stripRevision(str));
}

function formatProtheusDate(raw) {
    if (!raw) return null;
    const s = String(raw).trim();
    if (s.length === 8 && /^\d{8}$/.test(s)) {
        return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
    }
    return s;
}

function formatExcelDate(serialOrStr) {
    if (!serialOrStr) return '';
    if (typeof serialOrStr === 'number') {
        // Excel serial date to JS Date
        const d = new Date(Math.round((serialOrStr - 25569) * 86400 * 1000));
        if (!isNaN(d.getTime())) {
            const day = String(d.getUTCDate()).padStart(2, '0');
            const month = String(d.getUTCMonth() + 1).padStart(2, '0');
            const year = d.getUTCFullYear();
            return `${day}/${month}/${year}`;
        }
    }
    if (serialOrStr instanceof Date) {
        const day = String(serialOrStr.getUTCDate()).padStart(2, '0');
        const month = String(serialOrStr.getUTCMonth() + 1).padStart(2, '0');
        const year = serialOrStr.getUTCFullYear();
        return `${day}/${month}/${year}`;
    }
    return String(serialOrStr).trim();
}

// =========================================================================
// 1. POST /api/vmi-criticos/preview-abas — Listar todas as abas e prévia
// =========================================================================
router.post('/preview-abas', upload.single('planilha'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Nenhum arquivo Excel fornecido.' });
        }

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer', cellDates: true });
        const sheetDetails = workbook.SheetNames.map(name => {
            const sheet = workbook.Sheets[name];
            const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });
            
            // Sugestão de aba principal
            const isSuggested = name.toUpperCase().includes('FALTANTE') || 
                                name.toUpperCase().includes('CRITICO') || 
                                (name.toUpperCase().includes('METALFISA') && rows.length > 50);

            return {
                name,
                totalRows: rows.length,
                isSuggested,
                previewRows: rows.slice(0, 6)
            };
        });

        res.json({
            fileName: req.file.originalname,
            totalSheets: sheetDetails.length,
            sheets: sheetDetails
        });
    } catch (err) {
        console.error('❌ [VMI CRITICOS] Erro ao obter abas:', err);
        res.status(500).json({ error: 'Erro ao processar planilha para leitura das abas: ' + err.message });
    }
});

// =========================================================================
// 2. POST /api/vmi-criticos/processar — Cruzamento completo e/ou salvar versão
// =========================================================================
router.post('/processar', upload.single('planilha'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Nenhum arquivo Excel fornecido.' });
        }

        const selectedSheetName = req.body.sheetName || '';
        const tituloVersao = req.body.tituloVersao || '';
        const salvarVersao = req.body.salvarVersao === 'true' || req.body.salvarVersao === true;
        const usuarioId = req.user?.id || req.body.usuarioId || 'SISTEMA';
        const usuarioNome = req.user?.nome || req.body.usuarioNome || 'Usuário';

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer', cellDates: true });
        
        let sheetName = selectedSheetName;
        if (!sheetName || !workbook.Sheets[sheetName]) {
            // Auto-detect
            sheetName = workbook.SheetNames.find(s => s.toUpperCase().includes('FALTANTE') || s.toUpperCase().includes('CRITICO')) || 
                        workbook.SheetNames.find(s => s.toUpperCase().includes('METALFISA')) || 
                        workbook.SheetNames[0];
        }

        const sheet = workbook.Sheets[sheetName];
        if (!sheet) {
            return res.status(400).json({ error: `Aba "${sheetName}" não encontrada no arquivo.` });
        }

        const rawRows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });
        if (rawRows.length < 3) {
            return res.status(400).json({ error: 'Aba selecionada contém poucas linhas ou está vazia.' });
        }

        // Localizar a linha de cabeçalho principal
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(10, rawRows.length); i++) {
            const r = rawRows[i] || [];
            const str = r.map(c => String(c || '').toUpperCase()).join(' ');
            if ((str.includes('CÓDIGO') || str.includes('CODIGO')) && (str.includes('DESCRI') || str.includes('FALTANTE') || str.includes('WK'))) {
                headerRowIdx = i;
                break;
            }
        }
        if (headerRowIdx === -1) headerRowIdx = 2; // Padrão da 24-08.xlsx

        const headerRow = rawRows[headerRowIdx] || [];
        
        // Mapear índices das colunas chave
        let colPrioridade = -1;
        let colCodMetalfisa = -1;
        let colCodVmi = -1;
        let colDescricao = -1;
        let colWk01 = -1;
        let colWk02 = -1;
        let colWk03 = -1;
        let colWk04 = -1;
        let colWk05 = -1;
        let colTotalFaltantes = -1;
        let colEntradas = -1;
        let colPreNota = -1;
        let colFaltantesFirmes = -1;
        let colStatusEntrega = -1;
        let colFollowUp = -1;
        let colPrevisao = -1;
        let colNovaPrevisao = -1;

        headerRow.forEach((col, idx) => {
            const s = String(col || '').toUpperCase().trim();
            if (s === 'PRIORIDADE') colPrioridade = idx;
            else if (s.includes('CODIGO METALFISA') || s.includes('CÓDIGO METALFISA') || s.includes('COD METAL')) colCodMetalfisa = idx;
            else if ((s === 'CÓDIGO' || s === 'CODIGO' || s === 'PRODUTO' || s.includes('REF')) && colCodVmi === -1) colCodVmi = idx;
            else if (s.includes('DESCRI')) colDescricao = idx;
            else if (s === 'WK 01' || s === 'WK01' || s === 'SEM 01' || s === 'SEM 1') colWk01 = idx;
            else if (s === 'WK 02' || s === 'WK02' || s === 'SEM 02' || s === 'SEM 2') colWk02 = idx;
            else if (s === 'WK 03' || s === 'WK03' || s === 'SEM 03' || s === 'SEM 3') colWk03 = idx;
            else if (s === 'WK 04' || s === 'WK04' || s === 'SEM 04' || s === 'SEM 4') colWk04 = idx;
            else if (s === 'WK 05' || s === 'WK05' || s === 'SEM 05' || s === 'SEM 5') colWk05 = idx;
            else if (s.includes('TOTAL FALTANTE') || s.includes('FALTANTE TOTAL')) colTotalFaltantes = idx;
            else if (s === 'ENTRADAS' || s === 'ENTRADA') colEntradas = idx;
            else if (s.includes('PRÉ NOTA') || s.includes('PRE NOTA')) colPreNota = idx;
            else if (s.includes('FALTANTE FIRME') || s.includes('FALTANTES FIRMES')) colFaltantesFirmes = idx;
            else if (s.includes('STATUS')) colStatusEntrega = idx;
            else if (s.includes('FOLLOW')) colFollowUp = idx;
            else if (s.includes('PREVISÃO DE ENTREGA') || s.includes('PREVISAO')) {
                if (colPrevisao === -1) colPrevisao = idx;
                else colNovaPrevisao = idx;
            }
        });

        // Fallbacks baseados na estrutura oficial da 24-08.xlsx
        if (colCodMetalfisa === -1) colCodMetalfisa = 1;
        if (colCodVmi === -1) colCodVmi = 2;
        if (colDescricao === -1) colDescricao = 3;
        if (colWk01 === -1) colWk01 = 4;
        if (colWk02 === -1) colWk02 = 5;
        if (colWk03 === -1) colWk03 = 6;
        if (colWk04 === -1) colWk04 = 7;
        if (colWk05 === -1) colWk05 = 8;
        if (colTotalFaltantes === -1) colTotalFaltantes = 9;
        if (colEntradas === -1) colEntradas = 10;
        if (colPreNota === -1) colPreNota = 11;
        if (colFaltantesFirmes === -1) colFaltantesFirmes = 12;
        if (colStatusEntrega === -1) colStatusEntrega = 13;
        if (colFollowUp === -1) colFollowUp = 14;
        if (colPrevisao === -1) colPrevisao = 21;
        if (colNovaPrevisao === -1) colNovaPrevisao = 23;

        // Extrair itens brutos da planilha
        const itensExcel = [];
        for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
            const row = rawRows[r];
            if (!row || row.length === 0) continue;

            const codVmiRaw = String(row[colCodVmi] || '').trim();
            const codMetalRaw = String(row[colCodMetalfisa] || '').trim();
            const descrRaw = String(row[colDescricao] || '').trim();

            if (!codVmiRaw && !codMetalRaw) continue;
            if (codVmiRaw.toUpperCase().includes('TOTAL') || descrRaw.toUpperCase().includes('TOTAL GERAL')) continue;

            const parseNum = (v) => {
                if (typeof v === 'number') return v;
                if (!v || v === '-') return 0;
                const n = parseFloat(String(v).replace(/\./g, '').replace(',', '.'));
                return isNaN(n) ? 0 : n;
            };

            const itemObj = {
                linhaOriginal: r + 1,
                prioridade: colPrioridade !== -1 ? String(row[colPrioridade] || '').trim() : '',
                codMetalfisa: codMetalRaw,
                codVmi: codVmiRaw,
                codVmiClean: cleanCode(codVmiRaw),
                codVmiBase: getBaseCleanCode(codVmiRaw),
                codMetalClean: cleanCode(codMetalRaw),
                descricao: descrRaw,
                wk01: parseNum(row[colWk01]),
                wk02: parseNum(row[colWk02]),
                wk03: parseNum(row[colWk03]),
                wk04: parseNum(row[colWk04]),
                wk05: parseNum(row[colWk05]),
                totalFaltantes: parseNum(row[colTotalFaltantes]),
                entradas: parseNum(row[colEntradas]),
                preNota: parseNum(row[colPreNota]),
                faltantesFirmes: parseNum(row[colFaltantesFirmes]),
                statusEntrega: colStatusEntrega !== -1 ? String(row[colStatusEntrega] || '').trim() : '',
                followUp: colFollowUp !== -1 ? String(row[colFollowUp] || '').trim() : '',
                previsaoEntrega: colPrevisao !== -1 ? formatExcelDate(row[colPrevisao]) : '',
                novaPrevisao: colNovaPrevisao !== -1 ? formatExcelDate(row[colNovaPrevisao]) : ''
            };

            // Normalizar status
            if (!itemObj.statusEntrega) {
                if (itemObj.totalFaltantes <= 0 || itemObj.entradas > 0) {
                    itemObj.statusEntrega = 'MATERIAL OK';
                } else {
                    itemObj.statusEntrega = 'FALTA ENTREGA';
                }
            }

            itensExcel.push(itemObj);
        }

        if (itensExcel.length === 0) {
            return res.status(400).json({ error: 'Nenhum item com código de cliente ou produto encontrado na aba selecionada.' });
        }

        // =========================================================================
        // CRUZAMENTO COM O BANCO DE DADOS (Protheus + SINCO)
        // =========================================================================
        const inactiveFilter = await getInactiveOrdersFilter();
        const inactiveSqlC6 = inactiveFilter('c6.c6_num');
        const inactiveSqlC2 = inactiveFilter('c2_pedido');
        const inactiveSqlD2 = inactiveFilter('d2.d2_pedido');

        const [vmiMapRes, sz1Res, sc6Res, sc2Res, pcpRes, sd2Res] = await Promise.all([
            // 1. De-Para VMI
            mysqlPool.query('SELECT codigo_produto_cliente, b1_cod, descricao_protheus, z1_revisao FROM app_demanda_vmi_map')
                .catch(e => { console.warn('[CRITICOS] Aviso ao ler app_demanda_vmi_map:', e.message); return [[]]; }),
            // 2. SZ1010 Protheus
            db.query(`
                SELECT TRIM(z1_codcli) as cod_cli, TRIM(z1_produto) as b1_cod
                FROM public.sz1010
                WHERE COALESCE(d_e_l_e_t_, '') <> '*' AND TRIM(z1_produto) <> ''
            `).catch(e => { console.warn('[CRITICOS] Aviso ao ler SZ1010:', e.message); return { rows: [] }; }),
            // 3. Pedidos Protheus SC6010 / SC5010 para VMI
            db.query(`
                SELECT TRIM(c6.c6_num) as pedido_metal,
                       TRIM(c6.c6_item) as item_pedido,
                       TRIM(c6.c6_pedcli) as pedido_cliente,
                       TRIM(c6.c6_produto) as cod_produto,
                       TRIM(c6.c6_descri) as desc_produto,
                       TRIM(c6.c6_xproc1) as ref_cliente,
                       TRIM(a1.a1_nome) as nome_cliente,
                       COALESCE(c6.c6_qtdven, 0)::numeric as qtd_pedida,
                       COALESCE(c6.c6_qtdent, 0)::numeric as qtd_faturada,
                       (COALESCE(c6.c6_qtdven, 0) - COALESCE(c6.c6_qtdent, 0))::numeric as saldo_a_faturar,
                       c6.c6_entreg as data_entrega_protheus
                FROM public.sc6010 c6
                JOIN public.sc5010 c5 ON c5.c5_num = c6.c6_num AND COALESCE(c5.d_e_l_e_t_, '') NOT IN ('*', '  *')
                LEFT JOIN public.sa1010 a1 ON a1.a1_cod = c6.c6_cli AND COALESCE(a1.d_e_l_e_t_, '') <> '*'
                WHERE ((COALESCE(c6.c6_qtdven, 0) - COALESCE(c6.c6_qtdent, 0)) > 0 OR COALESCE(c6.c6_qtdent, 0) > 0)
                  AND COALESCE(c6.d_e_l_e_t_, '') NOT IN ('*', '  *')
                  AND COALESCE(c6.c6_blq, '') <> 'R'
                  AND UPPER(a1.a1_nome) LIKE '%VMI SISTEMAS%'
                  ${inactiveSqlC6}
            `),
            // 4. OPs SC2010
            db.query(`
                SELECT TRIM(c2_pedido) as pedido,
                       TRIM(c2_itempv) as item,
                       TRIM(c2_num) || TRIM(c2_item) || TRIM(c2_sequen) as numero_op,
                       (COALESCE(c2_quant, 0) - COALESCE(c2_quje, 0)) as saldo_op
                FROM public.sc2010
                WHERE (COALESCE(c2_quant, 0) - COALESCE(c2_quje, 0)) > 0
                  AND COALESCE(d_e_l_e_t_, '') NOT IN ('*', '  *')
                  ${inactiveSqlC2}
            `),
            // 5. Previsões PCP SINCO
            mysqlPool.query(`
                SELECT TRIM(pedido) as pedido, TRIM(item) as item, TRIM(op_protheus) as op_protheus,
                       data_entrega_pcp, quantidade_pcp
                FROM app_pcp_delivery_forecasts
                WHERE data_entrega_pcp IS NOT NULL
            `).catch(e => { console.warn('[CRITICOS] Aviso ao ler PCP forecasts:', e.message); return [[]]; }),
            // 6. NFs Emitidas SD2010 para VMI
            db.query(`
                SELECT TRIM(d2.d2_pedido) as pedido,
                       TRIM(d2.d2_itempv) as item,
                       TRIM(d2.d2_cod)    as cod_produto,
                       TRIM(d2.d2_doc)    as nota,
                       TRIM(d2.d2_serie)  as serie,
                       TRIM(d2.d2_emissao) as emissao_raw,
                       d2.d2_quant::numeric as qtd_faturada
                FROM public.sd2010 d2
                JOIN public.sa1010 a1 ON a1.a1_cod = d2.d2_cliente AND COALESCE(a1.d_e_l_e_t_, '') NOT IN ('*', '  *')
                WHERE COALESCE(d2.d_e_l_e_t_, '') NOT IN ('*', '  *')
                  AND TRIM(d2.d2_doc) <> ''
                  AND UPPER(a1.a1_nome) LIKE '%VMI SISTEMAS%'
                  ${inactiveSqlD2}
            `).catch(e => { console.warn('[CRITICOS] Aviso ao ler SD2010:', e.message); return { rows: [] }; })
        ]);

        // Mapeamentos em memória
        const vmiMap = new Map();
        const vmiList = [];
        for (const m of (vmiMapRes[0] || [])) {
            const k = cleanCode(m.codigo_produto_cliente);
            const kBase = getBaseCleanCode(m.codigo_produto_cliente);
            if (k) {
                vmiMap.set(k, m.b1_cod);
                if (kBase) vmiMap.set(kBase, m.b1_cod);
                vmiList.push({ codCliClean: k, codCliBase: kBase, b1Cod: m.b1_cod });
            }
        }

        const sz1Map = new Map();
        for (const z of (sz1Res?.rows || [])) {
            const k = cleanCode(z.cod_cli);
            const kBase = getBaseCleanCode(z.cod_cli);
            if (k) {
                if (!sz1Map.has(k)) sz1Map.set(k, z.b1_cod);
                if (kBase && !sz1Map.has(kBase)) sz1Map.set(kBase, z.b1_cod);
            }
        }

        const sc6List = [];
        const protheusByRef = new Map();
        for (const row of (sc6Res?.rows || [])) {
            const refClean = cleanCode(row.ref_cliente);
            const refBase = getBaseCleanCode(row.ref_cliente);
            const prodClean = cleanCode(row.cod_produto);
            const rObj = {
                ...row,
                refClean,
                refBase,
                prodClean,
                data_entrega_formatada: formatProtheusDate(row.data_entrega_protheus)
            };
            sc6List.push(rObj);
            const keys = [refClean, refBase, prodClean].filter(Boolean);
            for (const k of keys) {
                if (!protheusByRef.has(k)) protheusByRef.set(k, []);
                protheusByRef.get(k).push(rObj);
            }
        }

        const opMap = new Map();
        for (const op of (sc2Res?.rows || [])) {
            const k = `${op.pedido}|${op.item}`;
            if (!opMap.has(k)) opMap.set(k, []);
            opMap.get(k).push(op);
        }

        const pcpMap = new Map();
        for (const p of (pcpRes[0] || [])) {
            const k = `${p.pedido}|${p.item}`;
            if (!pcpMap.has(k)) pcpMap.set(k, []);
            pcpMap.get(k).push(p);
        }

        const nfMapByItem = new Map();
        const nfMapByProd = new Map();
        for (const nf of (sd2Res?.rows || [])) {
            const kItem = `${nf.pedido}|${nf.item}`;
            const kProd = cleanCode(nf.cod_produto);
            const nfObj = {
                nota: nf.nota,
                serie: nf.serie,
                emissao: formatProtheusDate(nf.emissao_raw),
                emissao_raw: nf.emissao_raw,
                qtd_faturada: Number(nf.qtd_faturada) || 0,
                pedido: nf.pedido,
                item: nf.item,
                cod_produto: nf.cod_produto
            };
            if (!nfMapByItem.has(kItem)) nfMapByItem.set(kItem, []);
            nfMapByItem.get(kItem).push(nfObj);
            if (kProd) {
                if (!nfMapByProd.has(kProd)) nfMapByProd.set(kProd, []);
                nfMapByProd.get(kProd).push(nfObj);
            }
        }

        // Realizar o cruzamento inteligente item a item
        let totalFaltantesSum = 0;
        let totalOkCount = 0;
        let totalPendenteCount = 0;
        let totalSaldoPedidosMetalFisa = 0;
        let totalFaturadoMetalFisa = 0;

        const itensCruzados = itensExcel.map(item => {
            const ref = item.codVmiClean;
            const refBase = item.codVmiBase;
            const codMetalRawClean = item.codMetalClean;

            let b1Cod = item.codMetalfisa || vmiMap.get(ref) || (refBase && vmiMap.get(refBase)) || sz1Map.get(ref) || (refBase && sz1Map.get(refBase)) || null;

            if (!b1Cod) {
                const vMatch = vmiList.find(m => m.codCliClean.endsWith(ref) || m.codCliClean.includes(ref) || (refBase && m.codCliClean.includes(refBase)));
                if (vMatch) b1Cod = vMatch.b1Cod;
            }

            const matchedOrders = [];
            if (ref && protheusByRef.has(ref)) matchedOrders.push(...protheusByRef.get(ref));
            if (refBase && protheusByRef.has(refBase)) matchedOrders.push(...protheusByRef.get(refBase));
            if (b1Cod) {
                const bClean = cleanCode(b1Cod);
                if (protheusByRef.has(bClean)) matchedOrders.push(...protheusByRef.get(bClean));
            }
            if (codMetalRawClean && protheusByRef.has(codMetalRawClean)) {
                matchedOrders.push(...protheusByRef.get(codMetalRawClean));
            }

            // Deduplicar pedidos encontrados
            const uniqueMap = new Map();
            for (const o of matchedOrders) {
                const k = `${o.pedido_metal}|${o.item_pedido}`;
                if (!uniqueMap.has(k)) uniqueMap.set(k, o);
            }
            const uniqueOrders = Array.from(uniqueMap.values());

            let saldoTotalItem = 0;
            let faturadoTotalItem = 0;
            let qtdPedidaTotalItem = 0;
            const itemNfs = [];
            const itemOps = [];
            const itemPcps = [];

            uniqueOrders.forEach(o => {
                const saldo = Number(o.saldo_a_faturar) || 0;
                const fat = Number(o.qtd_faturada) || 0;
                const ped = Number(o.qtd_pedida) || (saldo + fat);

                saldoTotalItem += saldo;
                faturadoTotalItem += fat;
                qtdPedidaTotalItem += ped;

                if (!b1Cod) b1Cod = o.cod_produto;

                const ops = opMap.get(`${o.pedido_metal}|${o.item_pedido}`) || [];
                const pcps = pcpMap.get(`${o.pedido_metal}|${o.item_pedido}`) || [];
                const nfs = nfMapByItem.get(`${o.pedido_metal}|${o.item_pedido}`) || [];

                ops.forEach(op => itemOps.push({ ...op, pedido_metal: o.pedido_metal, item_pedido: o.item_pedido }));
                pcps.forEach(pcp => itemPcps.push({ ...pcp, pedido_metal: o.pedido_metal, item_pedido: o.item_pedido }));
                nfs.forEach(nf => itemNfs.push(nf));
            });

            // Se não encontrou NFs por pedido, tenta por código de produto
            if (itemNfs.length === 0 && b1Cod) {
                const nfsProd = nfMapByProd.get(cleanCode(b1Cod)) || [];
                nfsProd.forEach(nf => itemNfs.push(nf));
            }

            totalFaltantesSum += Math.abs(item.totalFaltantes);
            totalSaldoPedidosMetalFisa += saldoTotalItem;
            totalFaturadoMetalFisa += faturadoTotalItem;

            if (item.statusEntrega === 'MATERIAL OK') {
                totalOkCount++;
            } else {
                totalPendenteCount++;
            }

            return {
                ...item,
                b1Cod: b1Cod || item.codMetalfisa || '',
                temPedidoMetalFisa: uniqueOrders.length > 0,
                saldoPedidosMetalFisa: saldoTotalItem,
                faturadoMetalFisa: faturadoTotalItem,
                qtdPedidaMetalFisa: qtdPedidaTotalItem,
                pedidos: uniqueOrders,
                ops: itemOps,
                pcps: itemPcps,
                nfs: itemNfs
            };
        });

        const versaoDataRef = new Date().toLocaleDateString('pt-BR');
        const versaoTituloFinal = tituloVersao || `Posição Críticos ${versaoDataRef}`;

        let novaVersaoId = null;

        // Se solicitado, salva a versão no banco de dados
        if (salvarVersao) {
            const [insertVersao] = await mysqlPool.query(`
                INSERT INTO app_vmi_criticos_versoes 
                (nome_arquivo, aba_selecionada, titulo_versao, data_referencia, mes_referencia, usuario_id, usuario_nome, total_itens, total_faltantes, total_ok, total_pendente, dados_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                req.file.originalname,
                sheetName,
                versaoTituloFinal,
                versaoDataRef,
                'Agosto/2026',
                String(usuarioId),
                usuarioNome,
                itensCruzados.length,
                totalFaltantesSum,
                totalOkCount,
                totalPendenteCount,
                JSON.stringify(itensCruzados)
            ]);

            novaVersaoId = insertVersao.insertId;

            // Inserir itens individuais para indexação e consultas rápidas
            const batchSize = 100;
            for (let i = 0; i < itensCruzados.length; i += batchSize) {
                const batch = itensCruzados.slice(i, i + batchSize);
                const values = batch.map(it => [
                    novaVersaoId,
                    it.b1Cod || it.codMetalfisa || '',
                    it.codVmi,
                    it.descricao,
                    it.prioridade,
                    it.wk01,
                    it.wk02,
                    it.wk03,
                    it.wk04,
                    it.wk05,
                    it.totalFaltantes,
                    it.entradas,
                    it.preNota,
                    it.faltantesFirmes,
                    it.statusEntrega,
                    it.followUp,
                    it.previsaoEntrega,
                    it.novaPrevisao,
                    JSON.stringify(it.pedidos || []),
                    JSON.stringify(it.ops || []),
                    JSON.stringify(it.nfs || [])
                ]);

                await mysqlPool.query(`
                    INSERT INTO app_vmi_criticos_itens 
                    (versao_id, cod_metalfisa, cod_vmi, descricao, prioridade, wk01, wk02, wk03, wk04, wk05, total_faltantes, entradas, pre_nota, faltantes_firmes, status_entrega, follow_up, previsao_entrega, nova_previsao, pedidos_json, ops_json, nfs_json)
                    VALUES ?
                `, [values]);
            }
        }

        res.json({
            versaoId: novaVersaoId,
            tituloVersao: versaoTituloFinal,
            nomeArquivo: req.file.originalname,
            abaSelecionada: sheetName,
            totalItens: itensCruzados.length,
            resumo: {
                totalItens: itensCruzados.length,
                totalFaltantes: totalFaltantesSum,
                totalOk: totalOkCount,
                totalPendente: totalPendenteCount,
                taxaAtendimento: itensCruzados.length > 0 ? ((totalOkCount / itensCruzados.length) * 100).toFixed(1) : 0,
                saldoPedidosMetalFisa: totalSaldoPedidosMetalFisa,
                faturadoMetalFisa: totalFaturadoMetalFisa
            },
            itens: itensCruzados
        });

    } catch (err) {
        console.error('❌ [VMI CRITICOS] Erro no processamento:', err);
        res.status(500).json({ error: 'Erro ao processar Tabela de Críticos: ' + err.message });
    }
});

// =========================================================================
// 3. GET /api/vmi-criticos/versoes — Listar todas as versões salvas
// =========================================================================
router.get('/versoes', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query(`
            SELECT id, nome_arquivo, aba_selecionada, titulo_versao, data_referencia, mes_referencia,
                   usuario_nome, total_itens, total_faltantes, total_ok, total_pendente, created_at
            FROM app_vmi_criticos_versoes
            ORDER BY id DESC
        `);
        res.json(rows);
    } catch (err) {
        console.error('❌ [VMI CRITICOS] Erro ao listar versões:', err);
        res.status(500).json({ error: 'Erro ao buscar versões salvas: ' + err.message });
    }
});

// =========================================================================
// 4. GET /api/vmi-criticos/versoes/:id — Retornar espelho completo de uma versão
// =========================================================================
router.get('/versoes/:id', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query('SELECT * FROM app_vmi_criticos_versoes WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Versão não encontrada.' });
        }

        const versao = rows[0];
        let itens = [];
        if (versao.dados_json) {
            try {
                itens = JSON.parse(versao.dados_json);
            } catch (e) {
                console.warn('Erro ao parsear dados_json da versão:', e.message);
            }
        }

        // Se dados_json estiver vazio, busca da tabela de itens
        if (itens.length === 0) {
            const [itemRows] = await mysqlPool.query('SELECT * FROM app_vmi_criticos_itens WHERE versao_id = ? ORDER BY id ASC', [req.params.id]);
            itens = itemRows.map(r => ({
                codMetalfisa: r.cod_metalfisa,
                codVmi: r.cod_vmi,
                descricao: r.descricao,
                prioridade: r.prioridade,
                wk01: Number(r.wk01),
                wk02: Number(r.wk02),
                wk03: Number(r.wk03),
                wk04: Number(r.wk04),
                wk05: Number(r.wk05),
                totalFaltantes: Number(r.total_faltantes),
                entradas: Number(r.entradas),
                preNota: Number(r.pre_nota),
                faltantesFirmes: Number(r.faltantes_firmes),
                statusEntrega: r.status_entrega,
                followUp: r.follow_up,
                previsaoEntrega: r.previsao_entrega,
                novaPrevisao: r.nova_previsao,
                pedidos: r.pedidos_json ? JSON.parse(r.pedidos_json) : [],
                ops: r.ops_json ? JSON.parse(r.ops_json) : [],
                nfs: r.nfs_json ? JSON.parse(r.nfs_json) : []
            }));
        }

        res.json({
            versao: {
                id: versao.id,
                nomeArquivo: versao.nome_arquivo,
                abaSelecionada: versao.aba_selecionada,
                tituloVersao: versao.titulo_versao,
                dataReferencia: versao.data_referencia,
                mesReferencia: versao.mes_referencia,
                usuarioNome: versao.usuario_nome,
                totalItens: versao.total_itens,
                totalFaltantes: versao.total_faltantes,
                totalOk: versao.total_ok,
                totalPendente: versao.total_pendente,
                createdAt: versao.created_at
            },
            itens
        });
    } catch (err) {
        console.error('❌ [VMI CRITICOS] Erro ao buscar versão:', err);
        res.status(500).json({ error: 'Erro ao carregar detalhes da versão: ' + err.message });
    }
});

// =========================================================================
// 5. DELETE /api/vmi-criticos/versoes/:id — Excluir versão
// =========================================================================
router.delete('/versoes/:id', async (req, res) => {
    try {
        await mysqlPool.query('DELETE FROM app_vmi_criticos_itens WHERE versao_id = ?', [req.params.id]);
        await mysqlPool.query('DELETE FROM app_vmi_criticos_versoes WHERE id = ?', [req.params.id]);
        res.json({ msg: 'Versão excluída com sucesso!' });
    } catch (err) {
        console.error('❌ [VMI CRITICOS] Erro ao excluir versão:', err);
        res.status(500).json({ error: 'Erro ao excluir versão: ' + err.message });
    }
});

// =========================================================================
// 6. POST /api/vmi-criticos/comparar — Comparador Dinâmico entre 2 Versões
// =========================================================================
router.post('/comparar', async (req, res) => {
    try {
        const { versaoAId, versaoBId } = req.body;
        if (!versaoAId || !versaoBId) {
            return res.status(400).json({ error: 'Informe os IDs das duas versões (versaoAId e versaoBId) para comparação.' });
        }

        const [versaoARows] = await mysqlPool.query('SELECT * FROM app_vmi_criticos_versoes WHERE id = ?', [versaoAId]);
        const [versaoBRows] = await mysqlPool.query('SELECT * FROM app_vmi_criticos_versoes WHERE id = ?', [versaoBId]);

        if (versaoARows.length === 0 || versaoBRows.length === 0) {
            return res.status(404).json({ error: 'Uma ou ambas as versões não foram encontradas.' });
        }

        const vA = versaoARows[0];
        const vB = versaoBRows[0];

        const itensA = JSON.parse(vA.dados_json || '[]');
        const itensB = JSON.parse(vB.dados_json || '[]');

        const mapA = new Map();
        itensA.forEach(it => {
            const k = cleanCode(it.codVmi) || cleanCode(it.codMetalfisa);
            if (k) mapA.set(k, it);
        });

        const mapB = new Map();
        itensB.forEach(it => {
            const k = cleanCode(it.codVmi) || cleanCode(it.codMetalfisa);
            if (k) mapB.set(k, it);
        });

        const todosCodigos = Array.from(new Set([...mapA.keys(), ...mapB.keys()]));

        let resolvidos = 0;
        let novosCriticos = 0;
        let saldoReduzido = 0;
        let saldoAumentado = 0;
        let inalterados = 0;

        const comparativoItens = todosCodigos.map(k => {
            const itA = mapA.get(k);
            const itB = mapB.get(k);

            const faltA = itA ? Math.abs(Number(itA.totalFaltantes) || 0) : 0;
            const faltB = itB ? Math.abs(Number(itB.totalFaltantes) || 0) : 0;
            const deltaFaltante = faltB - faltA;

            const stA = itA?.statusEntrega || 'INEXISTENTE';
            const stB = itB?.statusEntrega || 'INEXISTENTE';

            let classificacao = 'INALTERADO';

            if (!itA && itB) {
                classificacao = 'NOVO_NOVO_ITEM';
                novosCriticos++;
            } else if (itA && !itB) {
                classificacao = 'REMOVIDO_DA_PLANILHA';
                resolvidos++;
            } else if (stA !== 'MATERIAL OK' && stB === 'MATERIAL OK') {
                classificacao = 'RESOLVIDO_MATERIAL_OK';
                resolvidos++;
            } else if (stA === 'MATERIAL OK' && stB !== 'MATERIAL OK') {
                classificacao = 'NOVO_CRITICO';
                novosCriticos++;
            } else if (deltaFaltante < 0) {
                classificacao = 'SALDO_REDUZIDO';
                saldoReduzido++;
            } else if (deltaFaltante > 0) {
                classificacao = 'SALDO_AUMENTADO';
                saldoAumentado++;
            } else {
                inalterados++;
            }

            return {
                chave: k,
                codVmi: itB?.codVmi || itA?.codVmi,
                codMetalfisa: itB?.b1Cod || itB?.codMetalfisa || itA?.b1Cod || itA?.codMetalfisa,
                descricao: itB?.descricao || itA?.descricao,
                classificacao,
                versaoA: {
                    totalFaltantes: faltA,
                    statusEntrega: stA,
                    followUp: itA?.followUp || '',
                    previsaoEntrega: itA?.previsaoEntrega || '',
                    saldoPedidosMetalFisa: itA?.saldoPedidosMetalFisa || 0,
                    faturadoMetalFisa: itA?.faturadoMetalFisa || 0
                },
                versaoB: {
                    totalFaltantes: faltB,
                    statusEntrega: stB,
                    followUp: itB?.followUp || '',
                    previsaoEntrega: itB?.previsaoEntrega || '',
                    saldoPedidosMetalFisa: itB?.saldoPedidosMetalFisa || 0,
                    faturadoMetalFisa: itB?.faturadoMetalFisa || 0
                },
                deltaFaltante,
                mudancaPrevisao: (itA?.previsaoEntrega !== itB?.previsaoEntrega) || (itA?.followUp !== itB?.followUp)
            };
        });

        res.json({
            versaoA: { id: vA.id, titulo: vA.titulo_versao, data: vA.data_referencia, totalItens: vA.total_itens, totalFaltantes: vA.total_faltantes },
            versaoB: { id: vB.id, titulo: vB.titulo_versao, data: vB.data_referencia, totalItens: vB.total_itens, totalFaltantes: vB.total_faltantes },
            resumo: {
                totalAnalisados: todosCodigos.length,
                resolvidos,
                novosCriticos,
                saldoReduzido,
                saldoAumentado,
                inalterados,
                deltaFaltantesLiquidos: vB.total_faltantes - vA.total_faltantes
            },
            itens: comparativoItens
        });

    } catch (err) {
        console.error('❌ [VMI CRITICOS] Erro na comparação:', err);
        res.status(500).json({ error: 'Erro ao comparar versões: ' + err.message });
    }
});

// =========================================================================
// 7. GET /api/vmi-criticos/evolucao — Curva histórica de redução de faltantes
// =========================================================================
router.get('/evolucao', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query(`
            SELECT id, titulo_versao, data_referencia, created_at,
                   total_itens, total_faltantes, total_ok, total_pendente
            FROM app_vmi_criticos_versoes
            ORDER BY created_at ASC, id ASC
        `);

        const evolucao = rows.map((r, idx) => ({
            id: r.id,
            label: r.titulo_versao || `Versão ${r.id}`,
            data: r.data_referencia || new Date(r.created_at).toLocaleDateString('pt-BR'),
            totalItens: r.total_itens,
            totalFaltantes: parseFloat(r.total_faltantes) || 0,
            totalOk: r.total_ok,
            totalPendente: r.total_pendente,
            taxaAtendimento: r.total_itens > 0 ? parseFloat(((r.total_ok / r.total_itens) * 100).toFixed(1)) : 0
        }));

        res.json(evolucao);
    } catch (err) {
        console.error('❌ [VMI CRITICOS] Erro na curva de evolução:', err);
        res.status(500).json({ error: 'Erro ao buscar curva de evolução: ' + err.message });
    }
});

module.exports = router;
