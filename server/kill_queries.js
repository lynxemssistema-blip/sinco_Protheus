const { Pool } = require('pg'); 
require('dotenv').config({ path: '.env' }); 

async function run() { 
  const db = new Pool({ 
    host: process.env.PG_HOST, 
    user: process.env.PG_USER, 
    password: process.env.PG_PASSWORD, 
    database: process.env.PG_DATABASE, 
    port: process.env.PG_PORT || 5432 
  }); 

  try { 
    const res = await db.query("SELECT pid, state, query FROM pg_stat_activity WHERE state = 'active'"); 
    console.log(res.rows); 
    
    for (let r of res.rows) { 
      if (r.query.includes('c2_obs LIKE') || r.query.includes('sc2010')) { 
        if (r.query.includes('pg_stat_activity')) continue;
        console.log('Killing PID', r.pid); 
        await db.query('SELECT pg_terminate_backend(' + r.pid + ')'); 
      } 
    } 
  } catch(e) { 
    console.error(e) 
  } 
  process.exit(0); 
} 

run();
