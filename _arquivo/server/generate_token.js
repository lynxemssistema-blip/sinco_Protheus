require('dotenv').config();
const jwt = require('jsonwebtoken');

const token = jwt.sign(
    { id: 37, username: 'adm', nome: 'admin' }, 
    process.env.JWT_SECRET, 
    { expiresIn: '1h' }
);
console.log(token);
