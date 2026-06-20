const fs = require('fs');
const path = require('path');
const p = path.join('client', 'src', 'pages', 'ProductionControl.jsx');
let text = fs.readFileSync(p, 'utf8');

if (!text.includes('const [activeRowKey')) {
  text = text.replace(
    /const \[ops, setOps\] = useStickyState/g,
    "const [activeRowKey, setActiveRowKey] = useState(null);\n    const [ops, setOps] = useStickyState"
  );
}

let newTrLogic = "                                    const status = getOpStatus(op);\n" +
"                                    const isPai = op.sequen === '001';\n" +
"                                    const rowKey = op.op + '_' + op.item_op + '_' + op.sequen + '_' + op.operacao;\n" +
"                                    const isActive = activeRowKey === rowKey;\n" +
"                                    const trClassName = isActive\n" +
"                                        ? 'bg-indigo-50 ring-1 ring-indigo-400 ring-inset shadow-inner transition-colors'\n" +
"                                        : isPai\n" +
"                                            ? 'bg-blue-50 hover:bg-blue-100 transition-colors border-b border-slate-100'\n" +
"                                            : 'hover:bg-slate-50 transition-colors border-b border-slate-100';\n" +
"                                    return (\n" +
"                                        <tr\n" +
"                                            key={rowKey}\n" +
"                                            onClick={() => setActiveRowKey(rowKey)}\n" +
"                                            className={trClassName}\n" +
"                                        >";

text = text.replace(
  /const status = getOpStatus\(op\);\s*const isPai = op\.sequen === '001';\s*return \(\s*<tr key=\{idx\} className=\{order-b border-slate-100 transition-colors \$\{isPai \? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-slate-50'\}\}>/g,
  newTrLogic
);

fs.writeFileSync(p, text, 'utf8');
console.log('Updated ProductionControl.jsx successfully!');
