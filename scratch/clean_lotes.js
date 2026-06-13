const mysqlPool = require('../server/services/mysqlService');

async function clean() {
  try {
    console.log('Iniciando limpeza das tabelas de lote de corte...');
    
    // Deletar os itens dos lotes primeiro por causa da chave estrangeira se houver
    console.log('Limpando tabela app_lotes_corte_itens...');
    await mysqlPool.query('DELETE FROM app_lotes_corte_itens');
    
    console.log('Limpando tabela app_lotes_corte...');
    await mysqlPool.query('DELETE FROM app_lotes_corte');
    
    console.log('✅ Tabelas limpas com sucesso!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro ao limpar tabelas:', err);
    process.exit(1);
  }
}

clean();
