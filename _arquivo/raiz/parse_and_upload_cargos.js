const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });
const mysql = require('./server/node_modules/mysql2/promise');

const dir = path.join(__dirname, 'CargosExtract', 'Cargo e Funções');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.doc'));

const extractedCargos = {};

for (const file of files) {
    const fileBuffer = fs.readFileSync(path.join(dir, file));
    let content = fileBuffer.toString('latin1');
    content = content.replace(/[^\x20-\x7E\xA0-\xFF\n\r]/g, ' ').replace(/\s{2,}/g, ' ');

    let denominacao = '';
    let codigo_interno = '';
    let cbo = '';
    let atividades_brutas = '';
    let educacao = '';
    let experiencia = '';
    let treinamento = '';

    const denMatch = content.match(/DENOMINA[ÇC][ÃA]O:\s*(.+?)\s*(C[OÓ]DIGO:|CBO:|ITEM)/i);
    if (denMatch && denMatch[1]) denominacao = denMatch[1].trim();
    if (!denominacao) denominacao = file.replace('.doc', '').trim();

    const codMatch = content.match(/C[OÓ]DIGO:\s*(.+?)\s*(CBO:|ITEM|ATIVIDADE|QUALIFICA[ÇC][ÃA]O)/i);
    if (codMatch && codMatch[1]) codigo_interno = codMatch[1].trim();

    const cboMatch = content.match(/CBO:\s*(.+?)\s*(ITEM|ATIVIDADE|QUALIFICA[ÇC][ÃA]O)/i);
    if (cboMatch && cboMatch[1]) cbo = cboMatch[1].trim();

    const atvMatch = content.match(/ATIVIDADE PRINCIPAL\s*(.+?)\s*QUALIFICA[ÇC][ÕO]ES EXIGIDAS/i);
    if (atvMatch && atvMatch[1]) {
        atividades_brutas = atvMatch[1].trim();
    } else {
        const fallback = content.match(/ATIVIDADES PRINCIPAIS\s*(.+?)\s*(DESCRI[ÇC][ÃA]O DE CARGO|P[aá]g\.)/i);
        if (fallback) atividades_brutas = fallback[1].trim();
    }

    atividades_brutas = atividades_brutas.replace(/(\d{2}\s[A-Z0-9À-Ú])/g, '\n$1');
    const atividadesArray = atividades_brutas
        .split('\n')
        .map(line => line.trim().replace(/^\d{2}\s+/, '').trim())
        .filter(line => !!line);

    const eduMatch = content.match(/EDUCA[ÇC][ÃA]O:\s*(.+?)\s*EXPERI[ÊE]NCIA:/i);
    if (eduMatch && eduMatch[1]) educacao = eduMatch[1].trim();

    const expMatch = content.match(/EXPERI[ÊE]NCIA:\s*(.+?)\s*TREINAMENTO:/i);
    if (expMatch && expMatch[1]) experiencia = expMatch[1].trim();

    const treiMatch = content.match(/TREINAMENTO:\s*(.+?)(DESCRI[ÇC][ÃA]O DE CARGO|P[aá]g\.|DATA|$)/i);
    if (treiMatch && treiMatch[1]) treinamento = treiMatch[1].trim();

    const key = denominacao.toUpperCase();
    
    if (!extractedCargos[key] || extractedCargos[key].atividadesArray.length < atividadesArray.length) {
        extractedCargos[key] = {
            denominacao,
            codigo_interno,
            cbo,
            atividadesArray,
            educacao,
            experiencia,
            treinamento
        };
    }
}

console.log(`Parsed ${Object.keys(extractedCargos).length} distinct roles.`);

async function saveToDatabase() {
    console.log('🔗 Conectando ao MySQL (UOL Host)...');
    const connection = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB
    });

    try {
        console.log('🛠️ Alterando a tabela...');
        try { await connection.query('ALTER TABLE app_sgq_cargos_funcoes ADD COLUMN educacao TEXT'); } catch(e) {}
        try { await connection.query('ALTER TABLE app_sgq_cargos_funcoes ADD COLUMN experiencia TEXT'); } catch(e) {}
        try { await connection.query('ALTER TABLE app_sgq_cargos_funcoes ADD COLUMN treinamento TEXT'); } catch(e) {}

        console.log('🗑️ Apagando dados antigos...');
        await connection.query('TRUNCATE TABLE app_sgq_cargos_funcoes');

        console.log('📥 Inserindo dados com campos de qualificacao...');
        for (const item of Object.values(extractedCargos)) {
            await connection.query(
                `INSERT INTO app_sgq_cargos_funcoes 
                (denominacao, codigo_interno, cbo, atividades, educacao, experiencia, treinamento) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    item.denominacao, 
                    item.codigo_interno, 
                    item.cbo, 
                    JSON.stringify(item.atividadesArray),
                    item.educacao,
                    item.experiencia,
                    item.treinamento
                ]
            );
        }
        console.log('✅ Finalizado com sucesso!');
    } catch (e) {
        console.error('Erro DB:', e);
    } finally {
        await connection.end();
    }
}

saveToDatabase();
