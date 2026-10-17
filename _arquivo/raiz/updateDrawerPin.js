const fs = require('fs');
const path = require('path');
const p = path.join('client', 'src', 'components', 'PCPMetalDrawer.jsx');
let text = fs.readFileSync(p, 'utf8');

text = text.replace(
    "const [loading, setLoading] = useState(false);",
    "const [loading, setLoading] = useState(false);\n    const [isPinned, setIsPinned] = useState(false);"
);

text = text.replace(
    '<div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm pointer-events-auto" onClick={onClose} />',
    '{!isPinned && <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm pointer-events-auto" onClick={onClose} />}'
);

text = text.replace(
    '<button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors ml-1">',
    '<button onClick={() => setIsPinned(!isPinned)} title={isPinned ? "Desafixar gaveta" : "Fixar gaveta na tela"} className={p-2 rounded-lg transition-colors ml-1 }><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg></button>\n                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors ml-1">'
);

fs.writeFileSync(p, text, 'utf8');
console.log('Pinned functionality added!');
