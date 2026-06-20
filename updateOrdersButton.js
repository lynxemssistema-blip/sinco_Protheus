const fs = require('fs');
const path = require('path');
const p = path.join('client', 'src', 'components', 'OrdersTable.jsx');
let text = fs.readFileSync(p, 'utf8');

const target = "                        {viewMode === 'flat' && (";
const injection = "                        <button\n" +
"                            type=\"button\"\n" +
"                            onClick={() => setPcpmetalOpen(true)}\n" +
"                            className=\"bg-blue-600 hover:bg-blue-700 text-white border border-blue-700 font-medium rounded-lg text-sm px-4 py-2.5 text-center transition-colors flex items-center justify-center gap-2 shadow-sm\"\n" +
"                            title=\"Abrir Assistente Hermes\"\n" +
"                        >\n" +
"                            <Bot className=\"w-4 h-4\" /> Hermes AI\n" +
"                        </button>\n\n" +
"                        {viewMode === 'flat' && (";

text = text.replace(target, injection);

fs.writeFileSync(p, text, 'utf8');
console.log('Updated OrdersTable.jsx with Hermes button successfully!');
