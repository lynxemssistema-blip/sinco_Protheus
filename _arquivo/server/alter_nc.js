require('dotenv').config();
const db = require('./services/mysqlService');
db.query("ALTER TABLE app_sgq_nao_conformidades ADD COLUMN gravidade VARCHAR(50) DEFAULT 'observacao'").then(res => console.log('Sucesso:', res[0])).catch(err => console.error(err)).finally(() => process.exit());
