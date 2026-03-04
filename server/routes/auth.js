const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
require('dotenv').config();

const SECRET_KEY = process.env.JWT_SECRET || 'metalfisa_secret_key_123';

const dbConfig = {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASS,
    database: process.env.MYSQL_DB,
    port: 3306
};

// Login Route
router.post('/login', async (req, res) => {
    const { login, senha } = req.body;

    if (!login || !senha) {
        return res.status(400).json({ error: 'Login e senha são obrigatórios' });
    }

    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);

        // Query user from database - PLAIN TEXT PASSWORD as per request
        const [rows] = await connection.execute(
            'SELECT idUsuario, NomeCompleto, Login, TipoUsuario, fotoUsuario FROM usuario WHERE Login = ? AND Senha = ?',
            [login, senha]
        );

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        const user = rows[0];

        // Generate Token
        const token = jwt.sign(
            { id: user.idUsuario, login: user.Login, nome: user.NomeCompleto },
            SECRET_KEY,
            { expiresIn: '8h' }
        );

        res.json({
            token,
            user: {
                id: user.idUsuario,
                nome: user.NomeCompleto,
                login: user.Login,
                tipo: user.TipoUsuario,
                fotoUsuario: user.fotoUsuario // Add photo to response
            }
        });

    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    } finally {
        if (connection) await connection.end();
    }
});

// Middleware for protected routes (exporting for use in other files if needed)
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

module.exports = router;
module.exports.authenticateToken = authenticateToken;
