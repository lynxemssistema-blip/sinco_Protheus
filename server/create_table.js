const db = require('./services/mysqlService');
db.query(`CREATE TABLE IF NOT EXISTS app_sgq_nao_conformidades (
    id INT AUTO_INCREMENT PRIMARY KEY, 
    recurso_codigo VARCHAR(50) NOT NULL, 
    descricao VARCHAR(255) NOT NULL, 
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`).then(() => {
    console.log('Table created');
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
