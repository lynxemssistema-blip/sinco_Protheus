const db = require('../db');
db.query("SELECT g2_codigo FROM public.sg2010 WHERE btrim(g2_produto) = 'MT6-7544' AND COALESCE(d_e_l_e_t_, '') = '' ORDER BY g2_codigo DESC LIMIT 1").then(res => console.log(res.rows)).catch(console.error).finally(() => process.exit(0));
