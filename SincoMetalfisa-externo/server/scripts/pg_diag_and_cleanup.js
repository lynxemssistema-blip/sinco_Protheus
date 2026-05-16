require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../db');

async function diagnose() {
  try {
    // Conexões por banco
    const byDb = await db.query(`
      SELECT datname, state, count(*) as total
      FROM pg_stat_activity
      GROUP BY datname, state
      ORDER BY datname, total DESC
    `);
    console.log('\n📊 Conexões por banco + estado:');
    byDb.rows.forEach(r => console.log(`   ${(r.datname||'[NULL]').padEnd(20)} | ${(r.state||'null').padEnd(12)} | ${r.total}`));

    // Limite global
    const maxConn = await db.query(`SHOW max_connections`);
    const totalConn = await db.query(`SELECT count(*) as n FROM pg_stat_activity`);
    const superSlots = await db.query(`SHOW superuser_reserved_connections`);
    console.log(`\n📊 max_connections: ${maxConn.rows[0].max_connections}`);
    console.log(`📊 superuser_reserved: ${superSlots.rows[0].superuser_reserved_connections}`);
    console.log(`📊 Usadas atualmente: ${totalConn.rows[0].n}`);
    console.log(`📊 Disponíveis para não-superuser: ${parseInt(maxConn.rows[0].max_connections) - parseInt(superSlots.rows[0].superuser_reserved_connections) - parseInt(totalConn.rows[0].n)}`);

    // Quem está ocupando mais
    const topUsers = await db.query(`
      SELECT usename, datname, count(*) as n
      FROM pg_stat_activity
      GROUP BY usename, datname
      ORDER BY n DESC LIMIT 10
    `);
    console.log('\n📊 Top usuários por conexão:');
    topUsers.rows.forEach(r => console.log(`   ${(r.usename||'?').padEnd(20)} | ${(r.datname||'?').padEnd(20)} | ${r.n}`));

    // Conexões idle > 2 min em QUALQUER banco
    const idleAll = await db.query(`
      SELECT pg_terminate_backend(pid) as ok, pid, usename, datname, now()-state_change AS idle
      FROM pg_stat_activity
      WHERE state = 'idle'
        AND now() - state_change > interval '2 minutes'
        AND pid <> pg_backend_pid()
    `);
    const terminated = idleAll.rows.filter(r=>r.ok).length;
    console.log(`\n🧹 Conexões idle > 2min terminadas: ${terminated} de ${idleAll.rows.length}`);
    if (idleAll.rows.length > 0) {
      idleAll.rows.slice(0, 5).forEach(r => console.log(`   ${r.ok?'✅':'❌'} PID ${r.pid} | ${r.usename} @ ${r.datname} | ${r.idle}`));
    }

    process.exit(0);
  } catch (e) {
    console.error('ERRO:', e.code, e.message);
    process.exit(1);
  }
}

diagnose();
