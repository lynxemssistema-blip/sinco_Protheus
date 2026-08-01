require('dotenv').config();
const mysql = require('mysql2/promise');
(async () => {
    try {
        const pool = mysql.createPool({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASS,
            database: process.env.MYSQL_DB
        });
        // simulate the update exactly as the router does
        const nome = "Tiago";
        const login = "Tiago";
        const tipo = "AP";
        const email = "walter@metalfisa.com.br";
        const id = 34;
        
        console.log('Testing email select...');
        const [existingEmail] = await pool.query(
            'SELECT idUsuario FROM usuario WHERE email = ? AND idUsuario <> ?',
            [email, id]
        );
        console.log('existingEmail', existingEmail);
        
        console.log('Testing update...');
        // simulate without password
        await pool.query(
            'UPDATE usuario SET NomeCompleto = ?, Login = ?, TipoUsuario = ?, Setor = ?, Funcao = ?, email = ?, aprovado = ?, Observacoes = ?, TemPC = ?, fotoUsuario = ?, telefone = ?, whatsapp = ? WHERE idUsuario = ?',
            [nome, login, tipo, "Dobra", "Operador", email, 1, "Notebook", 1, null, "(99) 99999-9999", "(99) 99999-9999", id]
        );
        console.log('Update success');
        pool.end();
    } catch(e) { console.error('ERROR CATCHED:', e.message); pool.end(); }
})();
