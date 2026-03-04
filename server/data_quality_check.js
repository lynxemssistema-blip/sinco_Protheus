
const mysqlPool = require('./services/mysqlService');
const db = require('./db');
require('dotenv').config();

async function runDataQualityCheck() {
    console.log('🔍 INICIANDO DATA QUALITY CHECK (PCP ANALYST)...');
    console.log('================================================');

    const report = {
        errors: [],
        warnings: [],
        stats: {}
    };

    try {
        // 1. CHECAGEM DE CHAVES E RELACIONAMENTOS
        console.log('\n1️⃣  Verificando Integridade Referencial (MySQL App)...');

        // Check orphans: Appointments without OP
        const [orphansOp] = await mysqlPool.query(`
            SELECT COUNT(*) as count FROM app_production_appointments WHERE op_numero IS NULL OR op_numero = ''
        `);
        if (orphansOp[0].count > 0) report.errors.push(`[CRÍTICO] ${orphansOp[0].count} apontamentos sem Número de OP.`);

        // Check orphans: Appointments without Operation Code
        const [orphansOper] = await mysqlPool.query(`
            SELECT COUNT(*) as count FROM app_production_appointments WHERE operacao_codigo IS NULL OR operacao_codigo = ''
        `);
        if (orphansOper[0].count > 0) report.errors.push(`[CRÍTICO] ${orphansOper[0].count} apontamentos sem Código de Operação.`);


        // 2. CHECAGEM DE DATAS INVÁLIDAS
        console.log('\n2️⃣  Verificando Consistência Temporal...');

        // Start > End
        const [invertedDates] = await mysqlPool.query(`
            SELECT COUNT(*) as count FROM app_production_appointments WHERE data_fim < data_inicio
        `);
        if (invertedDates[0].count > 0) report.errors.push(`[CRÍTICO] ${invertedDates[0].count} apontamentos com Data Fim anterior à Data Início.`);

        // Future dates
        const [futureDates] = await mysqlPool.query(`
            SELECT COUNT(*) as count FROM app_production_appointments WHERE data_inicio > NOW()
        `);
        if (futureDates[0].count > 0) report.warnings.push(`[ALERTA] ${futureDates[0].count} apontamentos com data futura.`);


        // 3. CHECAGEM DE DUPLICIDADES
        console.log('\n3️⃣  Verificando Duplicidades...');

        // Identical appointments (same user, op, operation, start time)
        const [duplicates] = await mysqlPool.query(`
            SELECT op_numero, operacao_codigo, usuario, data_inicio, COUNT(*) as qtd
            FROM app_production_appointments
            GROUP BY op_numero, operacao_codigo, usuario, data_inicio
            HAVING qtd > 1
        `);
        if (duplicates.length > 0) report.errors.push(`[MÉDIO] ${duplicates.length} casos de apontamentos duplicados (mesmo usuário/op/hora).`);


        // 4. VALIDAÇÃO CRUZADA COM PROTHEUS (Amonstragem)
        console.log('\n4️⃣  Validação Cruzada com ERP (Amostragem de 10 OPs recentes)...');

        const [recentOps] = await mysqlPool.query(`SELECT DISTINCT op_numero FROM app_production_appointments ORDER BY id DESC LIMIT 10`);
        const opList = recentOps.map(r => r.op_numero).filter(Boolean);

        if (opList.length > 0) {
            const pgQuery = `
                SELECT c2_num, c2_pedido FROM public.sc2010 
                WHERE TRIM(c2_num) = ANY($1)
            `;
            const pgResult = await db.query(pgQuery, [opList]);
            const foundOps = new Set(pgResult.rows.map(r => r.c2_num.trim()));

            const missingInErp = opList.filter(op => !foundOps.has(op));
            if (missingInErp.length > 0) {
                report.errors.push(`[ALTA] OPs apontadas no App não encontradas no Protheus: ${missingInErp.join(', ')}`);
            } else {
                console.log('✅ Todas as 10 OPs recentes validadas no ERP.');
            }
        }

    } catch (err) {
        console.error('❌ ERRO FATAL NO CHECK:', err);
    }

    console.log('\n================================================');
    console.log('📊 RELATÓRIO FINAL DE QUALIDADE DE DADOS');
    console.log('================================================');

    if (report.errors.length === 0 && report.warnings.length === 0) {
        console.log('✅ NENHUMA INCONSISTÊNCIA GRAVE ENCONTRADA.');
    } else {
        report.errors.forEach(e => console.log(`🔴 ${e}`));
        report.warnings.forEach(w => console.log(`🟡 ${w}`));
    }

    process.exit(0);
}

runDataQualityCheck();
