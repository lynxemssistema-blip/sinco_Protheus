const mysql = require('../services/mysqlService');

async function applyForeignKeysAndIndexes() {
  try {
    console.log('--- Configurando Chaves Estrangeiras e Índices para Salas de Reunião ---');

    // 1. Limpar dados órfãos se houver
    await mysql.query(`
      DELETE FROM reservas_participantes 
      WHERE reserva_id NOT IN (SELECT id FROM reservas_salas)
    `);

    await mysql.query(`
      DELETE FROM reservas_historico 
      WHERE reserva_id NOT IN (SELECT id FROM reservas_salas)
    `);

    await mysql.query(`
      DELETE FROM reservas_salas 
      WHERE sala_id NOT IN (SELECT id FROM salas_reuniao)
    `);

    // 2. Adicionar FKs com tratamento de erro (caso já existam)
    try {
      await mysql.query(`
        ALTER TABLE reservas_salas
        ADD CONSTRAINT fk_reserva_sala
        FOREIGN KEY (sala_id) REFERENCES salas_reuniao(id)
        ON DELETE CASCADE
      `);
      console.log('✅ FK fk_reserva_sala adicionada com sucesso.');
    } catch (e) {
      console.log('ℹ️ FK fk_reserva_sala já existe ou:', e.message);
    }

    try {
      await mysql.query(`
        ALTER TABLE reservas_participantes
        ADD CONSTRAINT fk_part_reserva
        FOREIGN KEY (reserva_id) REFERENCES reservas_salas(id)
        ON DELETE CASCADE
      `);
      console.log('✅ FK fk_part_reserva adicionada com sucesso.');
    } catch (e) {
      console.log('ℹ️ FK fk_part_reserva já existe ou:', e.message);
    }

    try {
      await mysql.query(`
        ALTER TABLE reservas_historico
        ADD CONSTRAINT fk_hist_reserva
        FOREIGN KEY (reserva_id) REFERENCES reservas_salas(id)
        ON DELETE CASCADE
      `);
      console.log('✅ FK fk_hist_reserva adicionada com sucesso.');
    } catch (e) {
      console.log('ℹ️ FK fk_hist_reserva já existe ou:', e.message);
    }

    // 3. Garantir índices de performance e multi-tenant
    try {
      await mysql.query(`CREATE INDEX idx_salas_empresa ON salas_reuniao(IdEmpresa, ativo)`);
      console.log('✅ Índice idx_salas_empresa criado.');
    } catch (e) {
      console.log('ℹ️ idx_salas_empresa:', e.message);
    }

    try {
      await mysql.query(`CREATE INDEX idx_reservas_anti_conflito ON reservas_salas(IdEmpresa, sala_id, data_hora_inicio, data_hora_fim, status, liberada_antecipadamente)`);
      console.log('✅ Índice idx_reservas_anti_conflito criado.');
    } catch (e) {
      console.log('ℹ️ idx_reservas_anti_conflito:', e.message);
    }

    console.log('--- Schema verificado com sucesso! ---');
  } catch (err) {
    console.error('Erro ao aplicar constraints:', err);
  } finally {
    process.exit(0);
  }
}

applyForeignKeysAndIndexes();
