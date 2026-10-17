const db = require('./services/mysqlService'); 
async function check() { 
    try { 
        const [rows] = await db.query(`SELECT * FROM app_sgq_documentos WHERE doc_route = '/wabtec/estrutura'`); 
        console.log(rows); 
        process.exit(0); 
    } catch(e) { 
        console.error(e); 
        process.exit(1); 
    } 
} 
check();
