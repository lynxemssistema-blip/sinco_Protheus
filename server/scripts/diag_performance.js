require('dotenv').config();
const { Pool } = require('pg');
const mysql = require('mysql2/promise');

// ─── PostgreSQL Config (192.168.1.61) ───────────────────────────────────────
const pgPool = new Pool({
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT) || 5432,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  connectionTimeoutMillis: 5000,
  max: 3
});

// ─── MySQL Config (192.168.1.77 — SINCO/MetalFisa) ──────────────────────────
const mysqlPool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASS,
  database: process.env.MYSQL_DB,
  waitForConnections: true,
  connectionLimit: 3,
  connectTimeout: 5000
});

function ms(start) {
  return (Date.now() - start) + 'ms';
}

function pad(str, len) {
  return String(str).padEnd(len);
}

function fmtBytes(bytes) {
  if (!bytes) return 'N/A';
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? mb.toFixed(1) + ' MB' : (bytes / 1024).toFixed(1) + ' KB';
}

async function diagPostgres() {
  console.log('\n' + '═'.repeat(60));
  console.log('  🐘 PostgreSQL — 192.168.1.61');
  console.log('═'.repeat(60));

  let t = Date.now();
  let client;
  try {
    client = await pgPool.connect();
    console.log(`  ✅ Conexão estabelecida em ${ms(t)}`);
  } catch (e) {
    console.error(`  ❌ Falha de conexão: ${e.message}`);
    return;
  }

  // 1. Versão e uptime
  try {
    const ver = await client.query('SELECT version(), pg_postmaster_start_time() as start_time');
    const v = ver.rows[0];
    const uptime = Math.floor((Date.now() - new Date(v.start_time)) / 3600000);
    console.log(`  📦 Versão: ${v.version.split(' ').slice(0,2).join(' ')}`);
    console.log(`  ⏱  Uptime: ${uptime}h desde ${new Date(v.start_time).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
  } catch(e) { console.error('  versão:', e.message); }

  // 2. Conexões ativas
  try {
    const conn = await client.query(`
      SELECT state, count(*) as total
      FROM pg_stat_activity
      WHERE datname = current_database()
      GROUP BY state ORDER BY total DESC
    `);
    console.log(`\n  🔌 Conexões ativas (banco: ${process.env.PGDATABASE}):`);
    conn.rows.forEach(r => console.log(`     ${pad(r.state || 'null', 12)} → ${r.total}`));
  } catch(e) { console.error('  conexões:', e.message); }

  // 3. Tamanho do banco
  try {
    const sz = await client.query(`SELECT pg_size_pretty(pg_database_size(current_database())) AS size`);
    console.log(`\n  💾 Tamanho do banco: ${sz.rows[0].size}`);
  } catch(e) { console.error('  tamanho:', e.message); }

  // 4. Maiores tabelas
  try {
    const tbls = await client.query(`
      SELECT schemaname || '.' || tablename AS tabela,
             pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS tamanho_total,
             pg_total_relation_size(schemaname||'.'||tablename) AS bytes
      FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog','information_schema')
      ORDER BY bytes DESC
      LIMIT 8
    `);
    console.log(`\n  📊 Top 8 maiores tabelas:`);
    tbls.rows.forEach(r => console.log(`     ${pad(r.tabela, 28)} ${r.tamanho_total}`));
  } catch(e) { console.error('  tabelas:', e.message); }

  // 5. Cache hit ratio
  try {
    const cache = await client.query(`
      SELECT round(100.0 * sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2) AS cache_hit_pct
      FROM pg_statio_user_tables
    `);
    const pct = cache.rows[0].cache_hit_pct;
    const icon = pct >= 99 ? '🟢' : pct >= 95 ? '🟡' : '🔴';
    console.log(`\n  ${icon} Cache hit ratio: ${pct}% ${pct < 95 ? '(ATENÇÃO: abaixo do ideal)' : '(excelente)'}`);
  } catch(e) { console.error('  cache:', e.message); }

  // 6. Queries lentas em execução agora
  try {
    const slow = await client.query(`
      SELECT pid, now() - pg_stat_activity.query_start AS duracao, 
             left(query, 100) AS query_trunc, state
      FROM pg_stat_activity
      WHERE (now() - pg_stat_activity.query_start) > interval '2 seconds'
        AND state = 'active'
        AND datname = current_database()
    `);
    if (slow.rows.length > 0) {
      console.log(`\n  ⚠️  Queries lentas AGORA (> 2s):`);
      slow.rows.forEach(r => console.log(`     PID ${r.pid} | ${r.duracao} | ${r.query_trunc}`));
    } else {
      console.log(`\n  🟢 Nenhuma query lenta em execução no momento`);
    }
  } catch(e) { console.error('  queries lentas:', e.message); }

  // 7. Tabelas bloated / sem VACUUM recente
  try {
    const vac = await client.query(`
      SELECT schemaname || '.' || relname AS tabela,
             last_vacuum, last_autovacuum, last_analyze, last_autoanalyze,
             n_dead_tup AS linhas_mortas, n_live_tup AS linhas_vivas
      FROM pg_stat_user_tables
      WHERE n_dead_tup > 1000
      ORDER BY n_dead_tup DESC
      LIMIT 5
    `);
    if (vac.rows.length > 0) {
      console.log(`\n  🧹 Tabelas com linhas mortas (VACUUM recomendado):`);
      vac.rows.forEach(r => console.log(`     ${pad(r.tabela, 28)} ${pad(r.linhas_mortas + ' mortas', 15)} vivas: ${r.linhas_vivas}`));
    } else {
      console.log(`\n  🟢 VACUUM em dia — sem tabelas com excesso de linhas mortas`);
    }
  } catch(e) { console.error('  vacuum:', e.message); }

  // 8. Benchmark: latência de roundtrip
  try {
    console.log(`\n  📶 Benchmark de latência (10x roundtrip):`);
    const times = [];
    for (let i = 0; i < 10; i++) {
      const s = Date.now();
      await client.query('SELECT 1');
      times.push(Date.now() - s);
    }
    const avg = (times.reduce((a, b) => a + b, 0) / times.length).toFixed(1);
    const min = Math.min(...times);
    const max = Math.max(...times);
    console.log(`     min: ${min}ms | avg: ${avg}ms | max: ${max}ms`);
    if (avg > 10) console.log(`     ⚠️  Latência média acima de 10ms — verificar rede ou carga do servidor`);
  } catch(e) { console.error('  benchmark:', e.message); }

  // 9. Benchmark query crítica do sistema (vertical route)
  try {
    console.log(`\n  🏭 Benchmark query de produção (vertical route):`);
    const t2 = Date.now();
    const res = await client.query(`
      SELECT COUNT(*) as total
      FROM public.sc2010 c2
      INNER JOIN public.sg2010 g2
        ON btrim(g2.g2_produto) = btrim(c2.c2_produto)
        AND COALESCE(g2.d_e_l_e_t_, '') = ''
      WHERE COALESCE(c2.d_e_l_e_t_, '') = ''
    `);
    console.log(`     Linhas em sc2010 × sg2010: ${res.rows[0].total} | Tempo: ${ms(t2)}`);
  } catch(e) { console.error('  benchmark vertical:', e.message); }

  client.release();
  await pgPool.end();
}

async function diagMySQL() {
  console.log('\n' + '═'.repeat(60));
  console.log(`  🐬 MySQL — ${process.env.MYSQL_HOST}`);
  console.log('═'.repeat(60));

  let conn;
  const t = Date.now();
  try {
    conn = await mysqlPool.getConnection();
    console.log(`  ✅ Conexão estabelecida em ${ms(t)}`);
  } catch (e) {
    console.error(`  ❌ Falha de conexão: ${e.message}`);
    return;
  }

  // Versão
  try {
    const [rows] = await conn.query('SELECT VERSION() as ver, NOW() as now_ts');
    console.log(`  📦 Versão: MySQL ${rows[0].ver}`);
    console.log(`  🕐 Horário do servidor: ${new Date(rows[0].now_ts).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
  } catch(e) { console.error('  versão:', e.message); }

  // Status globais chave
  try {
    const [status] = await conn.query(`SHOW GLOBAL STATUS WHERE Variable_name IN (
      'Threads_connected','Threads_running','Queries','Uptime',
      'Innodb_buffer_pool_read_requests','Innodb_buffer_pool_reads',
      'Slow_queries','Questions','Connections'
    )`);
    const map = {};
    status.forEach(r => { map[r.Variable_name] = r.Value; });

    const upH = Math.floor(parseInt(map.Uptime) / 3600);
    const cacheHit = map.Innodb_buffer_pool_reads > 0
      ? (100 * (1 - map.Innodb_buffer_pool_reads / map.Innodb_buffer_pool_read_requests)).toFixed(2)
      : '100.00';
    const cacheIcon = parseFloat(cacheHit) >= 99 ? '🟢' : parseFloat(cacheHit) >= 95 ? '🟡' : '🔴';

    console.log(`\n  ⏱  Uptime: ${upH}h`);
    console.log(`  🔌 Threads connected: ${map.Threads_connected} | running: ${map.Threads_running}`);
    console.log(`  📊 Total queries: ${parseInt(map.Questions).toLocaleString()}`);
    console.log(`  🐢 Slow queries: ${map.Slow_queries}`);
    console.log(`  ${cacheIcon} InnoDB buffer pool hit: ${cacheHit}%`);
  } catch(e) { console.error('  status:', e.message); }

  // Maiores tabelas do banco corrente
  try {
    const db = process.env.MYSQL_DB;
    const [tbls] = await conn.query(`
      SELECT table_name, 
             ROUND((data_length + index_length)/1024/1024, 2) AS size_mb,
             table_rows
      FROM information_schema.TABLES
      WHERE table_schema = ?
      ORDER BY (data_length + index_length) DESC
      LIMIT 10
    `, [db]);
    console.log(`\n  📊 Top 10 maiores tabelas (banco: ${db}):`);
    tbls.forEach(r => console.log(`     ${pad(r.table_name, 40)} ${pad(r.size_mb + ' MB', 10)} ~${parseInt(r.table_rows).toLocaleString()} linhas`));
  } catch(e) { console.error('  tabelas:', e.message); }

  // Benchmark latência
  try {
    console.log(`\n  📶 Benchmark de latência (10x roundtrip):`);
    const times = [];
    for (let i = 0; i < 10; i++) {
      const s = Date.now();
      await conn.query('SELECT 1');
      times.push(Date.now() - s);
    }
    const avg = (times.reduce((a, b) => a + b, 0) / times.length).toFixed(1);
    const min = Math.min(...times);
    const max = Math.max(...times);
    console.log(`     min: ${min}ms | avg: ${avg}ms | max: ${max}ms`);
    if (avg > 30) console.log(`     ⚠️  Latência alta — servidor MySQL está no host remoto (uhserver.com)`);
  } catch(e) { console.error('  benchmark:', e.message); }

  // Benchmark nas tabelas de produção críticas
  try {
    console.log(`\n  🏭 Benchmark tabelas críticas de produção:`);
    const tables = [
      'app_production_appointments',
      'app_production_planning',
      'app_production_sessions'
    ];
    for (const tbl of tables) {
      try {
        const s = Date.now();
        const [r] = await conn.query(`SELECT COUNT(*) as c FROM \`${tbl}\``);
        console.log(`     ${pad(tbl, 35)} ${pad(r[0].c.toLocaleString() + ' registros', 18)} ${ms(s)}`);
      } catch(e) {
        console.log(`     ${pad(tbl, 35)} ❌ ${e.message}`);
      }
    }
  } catch(e) { console.error('  benchmark tabelas:', e.message); }

  conn.release();
  await mysqlPool.end();
}

async function main() {
  console.log('\n🔍 DIAGNÓSTICO DE PERFORMANCE — MetalFisa');
  console.log('🕐 Executado em: ' + new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }));
  console.log('💻 A partir de: ' + require('os').hostname());

  await diagPostgres();
  await diagMySQL();

  console.log('\n' + '═'.repeat(60));
  console.log('  ✅ Diagnóstico concluído');
  console.log('═'.repeat(60) + '\n');
  process.exit(0);
}

main().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
