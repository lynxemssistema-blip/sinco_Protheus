const pool = require('./db');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

async function run() {
    let client;
    try {
        console.log("Iniciando extração de dados...");
        client = await pool.connect();
        await client.query("SET client_encoding TO 'WIN1252'");

        // Filtra apenas registros onde o cliente tem 'VMI' no nome (ou razao social)
        const query = `
            SELECT 
                TRIM(sb1.b1_cod) as cod_prduto,
                TRIM(sb1.b1_xrevm) as revmetalfiza,
                TRIM(z1.z1_revisao) as rev_cliente,
                TRIM(z1.z1_codcli) as ref_cliente_original,
                TRIM(sb1.b1_desc) as descricao,
                TRIM(sa1.a1_nome) as nome_cliente
            FROM public.sz1010 z1
            JOIN public.sb1010 sb1 
                ON TRIM(z1.z1_produto) = TRIM(sb1.b1_cod) 
                AND TRIM(COALESCE(sb1.d_e_l_e_t_, '')) <> '*'
            JOIN public.sa1010 sa1
                ON TRIM(z1.z1_cliente) = TRIM(sa1.a1_cod)
                AND TRIM(z1.z1_loja) = TRIM(sa1.a1_loja)
                AND TRIM(COALESCE(sa1.d_e_l_e_t_, '')) <> '*'
            WHERE TRIM(COALESCE(z1.d_e_l_e_t_, '')) <> '*'
              AND sa1.a1_nome LIKE '%VMI%'
        `;
        
        const res = await client.query(query);
        console.log(`Encontrados ${res.rows.length} registros para o cliente VMI. Processando...`);

        // Padrão VMI de formatação com máscara
        const vmiFormat = (str, rev_cliente) => {
            if (!str) return '';
            // 1. Remove qualquer variação de DCM-xxxx (ex: DCM-1234, DMC-9800)
            let s = String(str).replace(/D[CM]C?-?[A-Z0-9]{1,4}-?/gi, '');
            
            // Lógica VMI base: Remove não-alfanuméricos
            let cleanStr = s.replace(/[^a-zA-Z0-9]/g, '');
            
            // Regra nova: Se tiver exatos 9 caracteres, anexa a rev_cliente (garantindo 2 posições)
            if (cleanStr.length === 9) {
                let rev = String(rev_cliente || '00').trim().padStart(2, '0').substring(0, 2);
                cleanStr = cleanStr + rev;
            }

            // Tenta aplicar a formatação VMI (00.00.00000.00 ou 00.00.000000.00)
            if (cleanStr.length === 11) {
                return `${cleanStr.slice(0,2)}.${cleanStr.slice(2,4)}.${cleanStr.slice(4,9)}.${cleanStr.slice(9,11)}`;
            } else if (cleanStr.length === 12) {
                return `${cleanStr.slice(0,2)}.${cleanStr.slice(2,4)}.${cleanStr.slice(4,10)}.${cleanStr.slice(10,12)}`;
            }
            
            // Se não tiver 11 ou 12 dígitos, aplica a lógica VMI fallback
            return cleanStr.replace(/^0+/, '').toUpperCase();
        };

        const processedRows = res.rows.map(row => {
            return {
                cod_prduto: row.cod_prduto,
                descricao: row.descricao || '',
                revmetalfiza: row.revmetalfiza || '',
                rev_cliente: row.rev_cliente || '',
                ref_cliente: vmiFormat(row.ref_cliente_original, row.rev_cliente),
                ref_original: row.ref_cliente_original || '',
                cliente: row.nome_cliente || ''
            };
        });

        console.log("Gerando arquivo Excel...");
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Produtos VMI');

        worksheet.columns = [
            { header: 'cod_prduto', key: 'cod_prduto', width: 20 },
            { header: 'descricao', key: 'descricao', width: 40 },
            { header: 'revmetalfiza', key: 'revmetalfiza', width: 15 },
            { header: 'rev_cliente', key: 'rev_cliente', width: 15 },
            { header: 'ref_cliente', key: 'ref_cliente', width: 25 },
            { header: 'ref_original (debug)', key: 'ref_original', width: 25 },
            { header: 'cliente', key: 'cliente', width: 40 }
        ];

        worksheet.addRows(processedRows);

        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        const outputPath = path.join(__dirname, '..', 'relatorio_produtos_vmi_final.xlsx');
        await workbook.xlsx.writeFile(outputPath);
        
        console.log(`✅ Relatório gerado com sucesso em: ${outputPath}`);

    } catch(e) { 
        console.error("Erro:", e); 
    } finally {
        if (client) client.release();
    }
    process.exit();
}
run();
