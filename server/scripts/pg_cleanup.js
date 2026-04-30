require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../db');

async function cleanup() {
  console.log('🧹 Tentando liberar conexões idle no PostgreSQL...\n');
  try {
    const r = await db.query(`
      SELECT pg_terminate_backend(pid) as ok, pid, usename, 
             now() - state_change AS idle_since
      FROM pg_stat_activity
      WHERE state = 'idle'
        AND now() - state_change > interval '3 minutes'
        AND pid <> pg_backend_pid()
    `);
    const done = r.rows.filter(x => x.ok).length;
    console.log(`✅ Terminadas: ${done} de ${r.rows.length} conexões idle (> 3 min)`);
    if (r.rows.length > 0) {
      r.rows.forEach(row => console.log(`   PID ${row.pid} | ${row.usename} | idle há ${row.idle_since}`));
    }
    process.exit(0);
  } catch (e) {
    console.error('❌ ERRO:', e.code, e.message);

    if (e.code === '53300' || e.code === '53100') {
      console.error('\n⚠️  PG com max_connections esgotado — pool deste processo também sem slot.');
      console.error('    O ÚNICO caminho agora é acessar diretamente o servidor 192.168.1.61:');
      console.error('    psql -h 192.168.1.61 -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state=\'idle\' AND now()-state_change > interval \'2 minutes\';"');
    }
    process.exit(1);
  }
}

cleanup();
