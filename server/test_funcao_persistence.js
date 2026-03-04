const mysql = require('mysql2/promise');
require('dotenv').config();

async function testFuncao() {
    const connection = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB
    });

    try {
        console.log('--- TEST START ---');

        // 1. Create Dummy User
        const uniqueLogin = 'test_funcao_' + Date.now();
        console.log('1. Creating dummy user:', uniqueLogin);
        const [insert] = await connection.execute(
            'INSERT INTO usuario (NomeCompleto, Login, Senha, TipoUsuario, Setor, Funcao) VALUES (?, ?, ?, ?, ?, ?)',
            ['Test User', uniqueLogin, '123', 'U', 'TestDept', 'InitialFunction']
        );
        const userId = insert.insertId;
        console.log('   -> Created ID:', userId);

        // 2. Verify Initial Insert
        const [rows1] = await connection.execute('SELECT Funcao FROM usuario WHERE idUsuario = ?', [userId]);
        console.log('2. Verified Insert:', rows1[0]);
        if (rows1[0].Funcao !== 'InitialFunction') throw new Error('Insert Failed!');

        // 3. Update Function
        console.log('3. Updating Funcao to "UPDATED_FUNCTION"...');
        await connection.execute(
            'UPDATE usuario SET Funcao = ? WHERE idUsuario = ?',
            ['UPDATED_FUNCTION', userId]
        );

        // 4. Verify Update
        const [rows2] = await connection.execute('SELECT Funcao FROM usuario WHERE idUsuario = ?', [userId]);
        console.log('4. Verified Update:', rows2[0]);
        if (rows2[0].Funcao !== 'UPDATED_FUNCTION') throw new Error('Update Failed!');

        // 5. Cleanup
        console.log('5. Cleaning up...');
        await connection.execute('DELETE FROM usuario WHERE idUsuario = ?', [userId]);
        console.log('   -> Deleted ID:', userId);

        console.log('✅ SUCCESS: Funcao field is working correctly in the Database.');

    } catch (error) {
        console.error('❌ TEST FAILED:', error);
    } finally {
        await connection.end();
        console.log('--- TEST END ---');
    }
}

testFuncao();
