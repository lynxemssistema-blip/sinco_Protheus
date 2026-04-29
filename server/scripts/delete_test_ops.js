const db = require('../db');

async function wipeTests() {
  try {
    const res = await db.query(
      `UPDATE public.sc2010 SET d_e_l_e_t_ = '*' WHERE c2_num IN ('000000', '999999', 'AUTO  ') AND COALESCE(d_e_l_e_t_, '') = ''`
    );
    console.log("Deleted test OPs count:", res.rowCount);
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    process.exit(0);
  }
}

wipeTests();
