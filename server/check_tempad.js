require("dotenv").config({ path: ".env" });
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING });
(async () => {
    const res = await pool.query(
        "SELECT TRIM(g2_produto) prod, TRIM(g2_operac) op, TRIM(g2_recurso) rec, g2_tempad " +
        "FROM sg2010 WHERE TRIM(g2_produto) IN " +
        "(SELECT DISTINCT TRIM(c2_produto) FROM sc2010 WHERE TRIM(c2_pedido)=$1 AND COALESCE(d_e_l_e_t_,'') IN ('', ' ')) " +
        "AND COALESCE(d_e_l_e_t_, '') IN ('', ' ') LIMIT 20",
        ["004618"]
    );
    console.log("Amostras g2_tempad do pedido 004618:");
    res.rows.forEach(function(r) {
        var tempad = parseFloat(r.g2_tempad) || 0;
        console.log("  " + r.prod + " | " + r.op + " | " + r.rec + " | g2_tempad=" + tempad + " | se_em_horas=" + (tempad*60).toFixed(1) + "min | se_em_min=" + tempad.toFixed(2) + "min");
    });
    await pool.end();
})().catch(function(e) { console.error("ERR:", e.message); process.exit(1); });
