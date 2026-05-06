const p = require('./services/mysqlService');
async function run() {
    const [res] = await p.query("DELETE FROM app_production_appointments WHERE observacao = 'Baixa automatica (pedido 002730 sem saldo a faturar)'");
    console.log("Deleted", res.affectedRows, "rows");
    process.exit(0);
}
run();
