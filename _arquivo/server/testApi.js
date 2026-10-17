const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3002,
  path: '/api/pedidos/flat?cliente=&pedido=&produto=&pedcli=&dataInicial=&dataFinal=&dateType=pedido&tipo_item=&op_status=&only_active=true&sortBy=emissao&sortOrder=DESC&page=1&limit=50',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ' + 'YOUR_TOKEN'
  }
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => {
    data += chunk;
  });
  res.on('end', () => {
    console.log(data);
  });
});

req.on('error', error => {
  console.error(error);
});

req.end();
