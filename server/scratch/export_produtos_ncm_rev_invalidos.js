require('dotenv').config({ path: 'c:/Users/lynx/Documents/MetalFisa Anty/server/.env' });
const { Pool } = require('pg');
const ExcelJS = require('exceljs');
const path = require('path');

const pool = new Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
});

async function main() {
    try {
        const res = await pool.query(`
            SELECT
                TRIM(b1.b1_cod)   AS codigo,
                TRIM(b1.b1_desc)  AS descricao,
                TRIM(b1.b1_tipo)  AS tipo,
                TRIM(b1.b1_um)    AS unidade,
                TRIM(b1.b1_grupo) AS grupo,
                TRIM(b1.b1_xrevm) AS revisao_metalfisa,
                COALESCE(z1.z1_revisao, '') AS rev_cliente,
                TRIM(b1.b1_posipi) AS ncm
            FROM public.sb1010 b1
            LEFT JOIN LATERAL (
                SELECT TRIM(sz1.z1_revisao) AS z1_revisao
                FROM public.sz1010 sz1
                WHERE TRIM(sz1.z1_produto) = TRIM(b1.b1_cod)
                  AND COALESCE(sz1.d_e_l_e_t_, '') = ''
                ORDER BY sz1.z1_revisao DESC
                LIMIT 1
            ) z1 ON true
            WHERE COALESCE(b1.d_e_l_e_t_, '') <> '*'
              AND (
                    TRIM(COALESCE(b1.b1_posipi, '')) !~ '^[0-9]{8}$'
                 OR TRIM(COALESCE(b1.b1_xrevm, '')) = ''
              )
            ORDER BY b1.b1_cod
        `);

        console.log(`Encontrados ${res.rows.length} produtos.`);

        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Produtos');
        ws.columns = [
            { header: 'Código', key: 'codigo', width: 18 },
            { header: 'Descrição', key: 'descricao', width: 45 },
            { header: 'Tipo', key: 'tipo', width: 8 },
            { header: 'Unidade', key: 'unidade', width: 10 },
            { header: 'Grupo', key: 'grupo', width: 10 },
            { header: 'Revisão MetalFisa', key: 'revisao_metalfisa', width: 18 },
            { header: 'Rev. Cliente', key: 'rev_cliente', width: 14 },
            { header: 'NCM (MCN)', key: 'ncm', width: 14 },
            { header: 'Motivo', key: 'motivo', width: 30 },
        ];
        ws.getRow(1).font = { bold: true };

        for (const r of res.rows) {
            const ncmInvalido = !/^[0-9]{8}$/.test(r.ncm || '');
            const revVazia = !(r.revisao_metalfisa || '').trim();
            const motivos = [];
            if (ncmInvalido) motivos.push('NCM inválido');
            if (revVazia) motivos.push('Rev. MetalFisa vazia');
            ws.addRow({ ...r, motivo: motivos.join(' + ') });
        }

        const outPath = path.resolve('c:/Users/lynx/Documents/MetalFisa Anty/produtos_ncm_revisao_invalidos.xlsx');
        await wb.xlsx.writeFile(outPath);
        console.log('Arquivo salvo em:', outPath);
    } catch (e) {
        console.error(e);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}
main();
