const fs = require('fs');
const path = require('path');
const p = path.join('client', 'src', 'components', 'OrdersTable.jsx');
let text = fs.readFileSync(p, 'utf8');

const target = "<PCPMetalDrawer\\s+isOpen={pcpmetalOpen}\\s+onClose={<replace_1> () => setPcpmetalOpen(false)}\\s+context={pcpmetalContext}\\s+/>";
const regex = /<PCPMetalDrawer\s+isOpen=\{pcpmetalOpen\}\s+onClose=\{.*?\}\s+context=\{pcpmetalContext\}\s+\/>/g;

text = text.replace(regex, "<PCPMetalDrawer\n                isOpen={pcpmetalOpen}\n                onClose={() => setPcpmetalOpen(false)}\n                context={pcpmetalContext}\n                pageData={{ ops: flatOrders, total: flatOrders.length }}\n            />");

fs.writeFileSync(p, text, 'utf8');
console.log('Updated OrdersTable.jsx Drawer with pageData successfully!');
