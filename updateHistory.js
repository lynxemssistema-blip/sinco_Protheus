const fs = require('fs');
const path = require('path');
const p = path.join('client', 'src', 'components', 'PCPMetalDrawer.jsx');
let text = fs.readFileSync(p, 'utf8');

text = text.replace(
  "const HISTORY_KEY = (userId, pedido) => \pcpmetal_hist_\_\\;",
  "const HISTORY_KEY = (userId, pedido, page) => \pcpmetal_hist_\_\_\\;"
);

text = text.replace(/loadHistory\(userId, context.pedido\)/g, "loadHistory(userId, context.pedido, context.page)");
text = text.replace(/saveHistory\(userId, context.pedido,/g, "saveHistory(userId, context.pedido, context.page,");
text = text.replace(/function loadHistory\(userId, pedido\)/g, "function loadHistory(userId, pedido, page)");
text = text.replace(/function saveHistory\(userId, pedido, turns\)/g, "function saveHistory(userId, pedido, page, turns)");
text = text.replace(/localStorage.getItem\(HISTORY_KEY\(userId, pedido\)\)/g, "localStorage.getItem(HISTORY_KEY(userId, pedido, page))");
text = text.replace(/localStorage.setItem\(HISTORY_KEY\(userId, pedido\)/g, "localStorage.setItem(HISTORY_KEY(userId, pedido, page)");

fs.writeFileSync(p, text, 'utf8');
console.log('Updated PCPMetalDrawer history to be page-specific!');
