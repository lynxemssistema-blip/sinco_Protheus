const db = require('../db');

async function checkNextOp() {
  try {
    const res = await db.query(
      `SELECT MAX(c2_num) as max_op FROM public.sc2010 WHERE c2_num ~ '^[0-9]+$' AND c2_num < '900000' AND COALESCE(d_e_l_e_t_, '') = ''`
    );
    console.log("Max OP:", res.rows[0].max_op);
    const nextOp = String(parseInt(res.rows[0].max_op, 10) + 1).padStart(6, '0');
    console.log("Next OP:", nextOp);
  } catch (e) {
    console.error("SQL Error:", e.message);
  } finally {
    process.exit(0);
  }
}
checkNextOp();
