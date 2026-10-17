require('dotenv').config();
const jwt = require('jsonwebtoken');
const http = require('http');

const SECRET_KEY = process.env.JWT_SECRET;
const token = jwt.sign({ id: 1, login: 'adm', nome: 'Admin', tipo: 'Admin' }, SECRET_KEY, { expiresIn: '1h' });

const options = {
  hostname: 'localhost',
  port: 3002,
  path: '/api/pedidos/flat?cliente=&pedido=&produto=&pedcli=&dataInicial=&dataFinal=&dateType=pedido&tipo_item=&op_status=&only_active=true&sortBy=emissao&sortOrder=DESC&page=1&limit=50',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ' + token
  }
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    if(res.statusCode >= 400) {
        console.log('Body:', data);
    } else {
        console.log('Success length:', data.length);
    }
  });
});

req.on('error', error => {
  console.error(error);
});

req.end();
