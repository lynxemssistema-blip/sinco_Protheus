require('dotenv').config({ path: './server/.env' });
const db = require('../services/mysqlService');
const pgDb = require('../db');

async function migrate() {
    try {
        console.log('--- Migração: Adicionar protheus_tipo e atualizar UOM e TIPO em app_wabtec_estruturas ---');

        // 1. Verificar coluna protheus_tipo
        const [cols] = await db.query("SHOW COLUMNS FROM app_wabtec_estruturas LIKE 'protheus_tipo'");
        if (cols.length === 0) {
            await db.query("ALTER TABLE app_wabtec_estruturas ADD COLUMN protheus_tipo VARCHAR(10) NULL DEFAULT NULL AFTER protheus_rev");
            console.log("✅ Coluna 'protheus_tipo' criada com sucesso em app_wabtec_estruturas.");
        } else {
            console.log("ℹ️ Coluna 'protheus_tipo' já existe.");
        }

        // 2. Buscar todos os itens que possuem protheus_cod ou desenho_cliente
        const [items] = await db.query("SELECT id, desenho_cliente, protheus_cod, uom, protheus_tipo FROM app_wabtec_estruturas");
        console.log(`📦 Total de registros na estrutura: ${items.length}`);

        const protheusCods = Array.from(new Set(items.map(i => i.protheus_cod).filter(Boolean)));
        const desenhos = Array.from(new Set(items.map(i => i.desenho_cliente).filter(Boolean)));

        const infoMap = new Map(); // key -> { b1_um, b1_tipo, b1_cod }

        // Consulta Protheus SB1010 por b1_cod
        if (protheusCods.length > 0) {
            const { rows: sb1Rows } = await pgDb.query(`
                SELECT TRIM(b1_cod) as b1_cod, TRIM(b1_um) as b1_um, TRIM(b1_tipo) as b1_tipo
                FROM public.sb1010
                WHERE TRIM(b1_cod) = ANY($1) AND COALESCE(d_e_l_e_t_, '') <> '*'
            `, [protheusCods]);
            for (const r of sb1Rows) {
                infoMap.set('COD:' + r.b1_cod, r);
            }
        }

        // Consulta Protheus SZ1010 + SB1010 por z1_codcli
        if (desenhos.length > 0) {
            const { rows: sz1Rows } = await pgDb.query(`
                SELECT TRIM(sz1.z1_codcli) as codcli, TRIM(sb1.b1_cod) as b1_cod, TRIM(sb1.b1_um) as b1_um, TRIM(sb1.b1_tipo) as b1_tipo
                FROM public.sz1010 sz1
                JOIN public.sb1010 sb1 ON TRIM(sb1.b1_cod) = TRIM(sz1.z1_produto) AND COALESCE(sb1.d_e_l_e_t_, '') <> '*'
                WHERE TRIM(sz1.z1_codcli) = ANY($1) AND COALESCE(sz1.d_e_l_e_t_, '') = ''
                ORDER BY sz1.z1_revisao DESC
            `, [desenhos]);
            for (const r of sz1Rows) {
                if (!infoMap.has('DES:' + r.codcli)) {
                    infoMap.set('DES:' + r.codcli, r);
                }
            }
        }

        let updatedCount = 0;
        for (const item of items) {
            let hit = null;
            if (item.protheus_cod && infoMap.has('COD:' + item.protheus_cod)) {
                hit = infoMap.get('COD:' + item.protheus_cod);
            } else if (item.desenho_cliente && infoMap.has('DES:' + item.desenho_cliente)) {
                hit = infoMap.get('DES:' + item.desenho_cliente);
            }

            if (hit) {
                const newUom = hit.b1_um || item.uom || '';
                const newTipo = hit.b1_tipo || item.protheus_tipo || '';
                if (newUom !== item.uom || newTipo !== item.protheus_tipo) {
                    await db.query(`
                        UPDATE app_wabtec_estruturas 
                        SET uom = ?, protheus_tipo = ?
                        WHERE id = ?
                    `, [newUom, newTipo, item.id]);
                    updatedCount++;
                }
            }
        }

        console.log(`✅ Registros atualizados com UOM e TIPO: ${updatedCount} de ${items.length}`);
        process.exit(0);
    } catch (err) {
        console.error("❌ Erro na migração:", err);
        process.exit(1);
    }
}

migrate();
