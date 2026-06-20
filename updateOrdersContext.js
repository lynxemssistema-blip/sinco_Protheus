const fs = require('fs');
const path = require('path');
const p = path.join('client', 'src', 'components', 'OrdersTable.jsx');
let text = fs.readFileSync(p, 'utf8');

text = text.replace(
  /onClick=\{\(\) => setPcpmetalOpen\(true\)\}/,
  "onClick={() => { setPcpmetalContext({ page: 'visao-geral', modulo: 'Visão Geral', action: 'Geral' }); setPcpmetalOpen(true); }}"
);

fs.writeFileSync(p, text, 'utf8');
console.log('Updated OrdersTable.jsx Hermes button context successfully!');
