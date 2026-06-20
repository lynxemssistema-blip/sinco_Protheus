const fs = require('fs');
const path = require('path');

const filePath = path.join('client', 'src', 'pages', 'VerticalAppointmentPage.jsx');
let code = fs.readFileSync(filePath, 'utf8');

if (!code.includes('Mic')) {
    code = code.replace("import { Search, List", "import { Search, List, Mic");
}

if (!code.includes('PCPMetalDrawer')) {
    code = code.replace(
        "import useStickyState from '../hooks/useStickyState';",
        "import useStickyState from '../hooks/useStickyState';\nimport PCPMetalDrawer from '../components/PCPMetalDrawer';"
    );
}

// State changes
code = code.replace("plan_inicio_de: '',\n        plan_inicio_ate: ''", "plan_inicio: ''");
code = code.replace(/setFilters\(\{ op: '', pedido: '', produto: '', cliente: '', plan_inicio_de: '', plan_inicio_ate: '' \}\);/g, "setFilters({ op: '', pedido: '', produto: '', cliente: '', plan_inicio: '' });");

const hooksTarget = "const [historyTarget, setHistoryTarget] = useState(null);";
const hooksNew = `const [historyTarget, setHistoryTarget] = useState(null);
    const [recordingField, setRecordingField] = useState(null);

    useEffect(() => {
        if (!filters.plan_inicio) {
            const today = new Date();
            const todayStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            setFilters(prev => ({...prev, plan_inicio: todayStr}));
        }
    }, []);

    const handleVoiceInput = (field) => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            toast.error("Reconhecimento de voz não suportado neste navegador.");
            return;
        }
        const recognition = new SpeechRecognition();
        recognition.lang = 'pt-BR';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => setRecordingField(field);
        recognition.onresult = (event) => {
            let transcript = event.results[0][0].transcript.trim().toUpperCase();
            if (field === 'op' || field === 'pedido') transcript = transcript.replace(/[^0-9]/g, '');
            setFilters(prev => ({ ...prev, [field]: transcript }));
        };
        recognition.onerror = () => setRecordingField(null);
        recognition.onend = () => setRecordingField(null);
        recognition.start();
    };`;
if (!code.includes('recordingField')) {
    code = code.replace(hooksTarget, hooksNew);
}

// Wrap inputs
const fields = ['op', 'pedido', 'produto', 'cliente'];
for (const field of fields) {
    const inputRegex = new RegExp(`<input[^>]+value=\\{filters\\.${field}\\}[^>]+\\/>`);
    const match = code.match(inputRegex);
    if (match) {
        let inputStr = match[0].replace('className="w-full px-3 py-2 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none shadow-sm"', 'className="w-full px-3 py-2 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none shadow-sm pr-10"');
        const wrapped = `<div className="relative">
                                    ${inputStr}
                                    <button
                                        type="button"
                                        onClick={() => handleVoiceInput('${field}')}
                                        className={\`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors \${recordingField === '${field}' ? 'bg-red-100 text-red-600 animate-pulse' : 'text-slate-400 hover:text-blue-600 hover:bg-slate-100'}\`}
                                        title="Ditar valor"
                                    >
                                        <Mic className="w-4 h-4" />
                                    </button>
                                </div>`;
        code = code.replace(match[0], wrapped);
    }
}

// Replace the two date blocks
const startDateHtmlRegex = /<div>\s*<label[^>]*>Plan[\s\S]*?filters\.plan_inicio_ate[\s\S]*?<\/div>\s*<\/div>/;

const newDateHtml = `<div className="col-span-2 md:col-span-2">
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Plan. Início</label>
                                <input
                                    type="date"
                                    value={filters.plan_inicio}
                                    onChange={(e) => setFilters(prev => ({ ...prev, plan_inicio: e.target.value }))}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    className="w-full px-3 py-2 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none shadow-sm"
                                />
                            </div>`;

code = code.replace(startDateHtmlRegex, newDateHtml);

// Replace TR highlight
const trRegex = /<tr key=\{opKey\}\s*className=\{\`border-b border-slate-100 transition-colors \$\{row\.sequen_op === '001' \? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-slate-50'\}\`\}>/g;
const newTr = `<tr key={opKey} 
                                        onClick={() => setSelectedOp(opKey)}
                                        className={\`border-b border-slate-100 transition-colors cursor-pointer \${
                                            selectedOp === opKey 
                                                ? 'bg-indigo-50 ring-2 ring-indigo-500/50 outline-none z-10 relative' 
                                                : (row.sequen_op === '001' ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-slate-50')
                                        }\`}
                                    >`;
code = code.replace(trRegex, newTr);

// Insert drawer
if (!code.includes('<PCPMetalDrawer />')) {
    code = code.replace('<div className="p-6 space-y-4">', '<div className="p-6 space-y-4">\n            <PCPMetalDrawer />');
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('Done');
