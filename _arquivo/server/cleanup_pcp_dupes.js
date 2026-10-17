const mysql = require("./services/mysqlService");

async function cleanup() {
    const [dupes] = await mysql.query(
        "SELECT TRIM(pedido) as pedido, TRIM(item) as item, COUNT(*) as total " +
        "FROM app_pcp_delivery_forecasts " +
        "GROUP BY TRIM(pedido), TRIM(item) " +
        "HAVING COUNT(*) > 1 " +
        "ORDER BY total DESC"
    );
    
    console.log("Pedidos/itens com duplicatas:", dupes.length);
    if (dupes.length === 0) {
        console.log("Nenhuma duplicata encontrada. Banco ja esta limpo.");
        process.exit(0);
    }
    
    let deletados = 0;
    for (const row of dupes) {
        const [registros] = await mysql.query(
            "SELECT id, data_entrega_pcp, quantidade_pcp, usuario, observacao, op_protheus " +
            "FROM app_pcp_delivery_forecasts " +
            "WHERE TRIM(pedido) = ? AND TRIM(item) = ? " +
            "ORDER BY " +
            "  CASE WHEN (observacao LIKE \"%Agente FCS%\" OR (op_protheus LIKE \"V%\" AND LENGTH(op_protheus) > 8)) THEN 1 ELSE 0 END ASC, " +
            "  id ASC",
            [row.pedido, row.item]
        );
        
        const manter = registros[0];
        const deletar = registros.slice(1);
        
        console.log(
            "  " + row.pedido + "/" + row.item +
            " -> manter id=" + manter.id +
            " data=" + manter.data_entrega_pcp +
            " obs=" + (manter.observacao || "N/A") +
            " | deletar ids: " + deletar.map(function(r) { return r.id; }).join(",")
        );
        
        if (deletar.length > 0) {
            const ids = deletar.map(function(r) { return r.id; });
            await mysql.query("DELETE FROM app_pcp_delivery_forecasts WHERE id IN (?)", [ids]);
            deletados += ids.length;
        }
    }
    
    console.log("\nLimpeza concluida. Registros deletados: " + deletados);
    process.exit(0);
}

cleanup().catch(function(e) {
    console.error("ERRO:", e.message);
    process.exit(1);
});
