require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const net = require('net');

// Teste direto de conectividade TCP antes do PG
const client = new net.Socket();
const t = Date.now();

client.setTimeout(5000);
client.connect(parseInt(process.env.PGPORT) || 5432, process.env.PGHOST, () => {
  console.log(`✅ TCP conectado a ${process.env.PGHOST}:${process.env.PGPORT} em ${Date.now()-t}ms`);
  client.destroy();

  // Agora tenta PG com connection direto (sem pool)
  const { Client } = require('pg');
  const pgClient = new Client({
    host: process.env.PGHOST, port: process.env.PGPORT,
    user: process.env.PGUSER, password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    connectionTimeoutMillis: 8000
  });

  pgClient.connect()
    .then(async () => {
      console.log('✅ PG Client conectado (conexão direta, sem pool)\n');

      // Verificar limite e uso atual
      const [lim, uso] = await Promise.all([
        pgClient.query(`SHOW max_connections`),
        pgClient.query(`
          SELECT state, count(*) as total
          FROM pg_stat_activity
          WHERE datname = $1
          GROUP BY state ORDER BY total DESC
        `, [process.env.PGDATABASE])
      ]);

      console.log(`📊 max_connections do servidor: ${lim.rows[0].max_connections}`);
      console.log(`📊 Conexões no banco ${process.env.PGDATABASE}:`);
      uso.rows.forEach(r => console.log(`   ${(r.state || 'NULL').padEnd(12)} → ${r.total}`));

      // Total de conexões abertas no servidor inteiro
      const total = await pgClient.query(`SELECT count(*) FROM pg_stat_activity`);
      console.log(`\n📊 Total de conexões no servidor PostgreSQL: ${total.rows[0].count}`);

      // Conexões idle há mais de 5 minutos
      const idleOld = await pgClient.query(`
        SELECT pid, usename, application_name, state, 
               now() - state_change AS idle_duration
        FROM pg_stat_activity
        WHERE state = 'idle'
          AND now() - state_change > interval '5 minutes'
          AND datname = $1
        ORDER BY idle_duration DESC
        LIMIT 10
      `, [process.env.PGDATABASE]);

      if (idleOld.rows.length > 0) {
        console.log(`\n⚠️  Conexões idle há mais de 5 min (banco ${process.env.PGDATABASE}):`);
        idleOld.rows.forEach(r => console.log(`   PID ${r.pid} | ${r.usename} | ${r.application_name} | idle há ${r.idle_duration}`));
        console.log(`\n   Para liberar (executar como superuser):`);
        console.log(`   SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state='idle' AND now()-state_change > interval '5 minutes' AND datname='${process.env.PGDATABASE}';`);
      } else {
        console.log(`\n🟢 Sem conexões idle antigas no banco ${process.env.PGDATABASE}`);
      }

      // Teste rápido de query
      const r = await pgClient.query(`SELECT 1 as ok`);
      console.log(`\n✅ Query teste: ${r.rows[0].ok} (banco respondendo)\n`);

      await pgClient.end();
      process.exit(0);
    })
    .catch(e => {
      console.error(`❌ PG Client falhou: ${e.code} — ${e.message}`);
      process.exit(1);
    });
});

client.on('error', e => {
  console.error(`❌ TCP falhou: ${e.message}`);
  process.exit(1);
});
client.on('timeout', () => {
  console.error(`❌ TCP timeout para ${process.env.PGHOST}:${process.env.PGPORT}`);
  client.destroy();
  process.exit(1);
});
