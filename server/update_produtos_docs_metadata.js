const mysqlPool = require('./services/mysqlService');

/**
 * Script para adicionar campos de metadados na tabela produtos_docs
 * Substitui a necessidade da tabela produtos_metadata
 */
async function updateProdutosDocsTable() {
    console.log('🔄 Atualizando tabela produtos_docs com campos de metadados...');

    // Adicionar colunas de metadados extraídos
    const alterQueries = [
        `ALTER TABLE produtos_docs ADD COLUMN titulo_desenho VARCHAR(255) DEFAULT NULL COMMENT 'Título do desenho (extraído pela IA)'`,
        `ALTER TABLE produtos_docs ADD COLUMN peso_kg DECIMAL(10, 3) DEFAULT NULL COMMENT 'Peso em kg (extraído pela IA)'`,
        `ALTER TABLE produtos_docs ADD COLUMN area_pintura_m2 DECIMAL(10, 3) DEFAULT NULL COMMENT 'Área de pintura em m² (extraído pela IA)'`,
        `ALTER TABLE produtos_docs ADD COLUMN material VARCHAR(100) DEFAULT NULL COMMENT 'Material (extraído pela IA)'`,
        `ALTER TABLE produtos_docs ADD COLUMN espessura_mm DECIMAL(10, 3) DEFAULT NULL COMMENT 'Espessura em mm (extraído pela IA)'`,
        `ALTER TABLE produtos_docs ADD COLUMN dimensoes VARCHAR(255) DEFAULT NULL COMMENT 'Dimensões (extraído pela IA)'`,
        `ALTER TABLE produtos_docs ADD COLUMN revisao VARCHAR(50) DEFAULT NULL COMMENT 'Revisão (extraído pela IA)'`,
        `ALTER TABLE produtos_docs ADD COLUMN confianca DECIMAL(3, 2) DEFAULT NULL COMMENT 'Confiança da IA (0.00 a 1.00)'`,
        `ALTER TABLE produtos_docs ADD COLUMN extraido_em TIMESTAMP NULL DEFAULT NULL COMMENT 'Data/hora da extração'`,
        `ALTER TABLE produtos_docs ADD COLUMN extraido_por ENUM('manual', 'automatico') DEFAULT NULL COMMENT 'Forma de extração'`
    ];

    try {
        for (const query of alterQueries) {
            try {
                await mysqlPool.query(query);
                console.log('✅ Coluna adicionada');
            } catch (err) {
                // Ignora erro se coluna já existe
                if (err.code === 'ER_DUP_FIELDNAME' || err.message.includes('Duplicate column')) {
                    console.log('⚠️ Coluna já existe, pulando...');
                } else {
                    throw err;
                }
            }
        }

        console.log('✅ Tabela produtos_docs atualizada com sucesso!');
        console.log('🗑️ A tabela produtos_metadata não é mais necessária e pode ser removida.');

        // Remover tabela antiga se existir
        try {
            await mysqlPool.query('DROP TABLE IF EXISTS produtos_metadata');
            console.log('✅ Tabela produtos_metadata removida.');
        } catch (err) {
            console.log('⚠️ Não foi possível remover produtos_metadata:', err.message);
        }

        process.exit(0);
    } catch (err) {
        console.error('❌ Erro ao atualizar tabela:', err.message);
        process.exit(1);
    }
}

updateProdutosDocsTable();
