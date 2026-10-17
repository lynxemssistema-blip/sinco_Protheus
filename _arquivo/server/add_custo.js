const pool = require('./services/mysqlService');

async function addCusto() {
    try {
        await pool.query('ALTER TABLE pcp_manutencao_materiais ADD COLUMN custo_unitario DECIMAL(10,2) DEFAULT 0');
        console.log('Added custo_unitario');
    } catch(e) { console.log(e.message); }

    try {
        await pool.query('ALTER TABLE pcp_manutencao_materiais ADD COLUMN custo_total DECIMAL(10,2) DEFAULT 0');
        console.log('Added custo_total');
    } catch(e) { console.log(e.message); }
    
    try {
        await pool.query('ALTER TABLE pcp_manutencao_ordens ADD COLUMN custo_materiais DECIMAL(10,2) DEFAULT 0');
        console.log('Added ordens custo_materiais');
    } catch(e) { console.log(e.message); }
    
    try {
        await pool.query('ALTER TABLE pcp_manutencao_ordens ADD COLUMN custo_servico DECIMAL(10,2) DEFAULT 0');
        console.log('Added ordens custo_servico');
    } catch(e) { console.log(e.message); }

    process.exit();
}
addCusto();
