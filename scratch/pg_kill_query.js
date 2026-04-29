const { Pool } = require('pg');
const pool = new Pool({
  user: 'sinco2',
  host: '192.168.1.61',
  database: 'p12prd',
  password: 'sinco25',
  port: 5432,
  connectionTimeoutMillis: 10000
});

async function run() {
  const client = await pool.connect();
  try {
    // Listar queries ativas com mais de 5 minutos
    const res = await client.query(`
      SELECT pid,
             extract(epoch from (now() - query_start)) AS segundos,
             state,
             client_addr,
             left(query, 120) AS query
      FROM pg_stat_activity
      WHERE state = 'active'
        AND now() - query_start > interval '5 minutes'
        AND pid <> pg_backend_pid()
      ORDER BY segundos DESC
    `);

    console.log(`=== ${res.rows.length} QUERY(IES) LONGAS ENCONTRADAS ===\n`);
    res.rows.forEach(r => {
      const horas = Math.floor(r.segundos / 3600);
      const min = Math.floor((r.segundos % 3600) / 60);
      console.log(`PID: ${r.pid} | Tempo: ${horas}h${min}m | IP: ${r.client_addr}`);
      console.log(`Query: ${r.query}\n`);
    });

    if (res.rows.length > 0) {
      console.log('=== TERMINANDO TODAS ===');
      for (const r of res.rows) {
        const kill = await client.query('SELECT pg_terminate_backend($1) AS ok', [r.pid]);
        const ok = kill.rows[0].ok;
        const horas = Math.floor(r.segundos / 3600);
        const min = Math.floor((r.segundos % 3600) / 60);
        console.log(`PID ${r.pid} (${horas}h${min}m) -> terminado: ${ok}`);
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
