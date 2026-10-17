const fs = require('fs');
const path = require('path');

const filePath = path.join('client', 'src', 'pages', 'VerticalAppointmentPage.jsx');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Add Mic to imports
code = code.replace("import { Search, List", "import { Search, List, Mic");

// 2. Add recording state inside component
const stateTarget = "const [historyTarget, setHistoryTarget] = useState(null);";
const stateRepl = `const [historyTarget, setHistoryTarget] = useState(null);
    const [recordingField, setRecordingField] = useState(null);

    // Default plan_inicio_ate to today
    useEffect(() => {
        if (!filters.plan_inicio_ate) {
            const today = new Date();
            // Adjust to local timezone YYYY-MM-DD
            const todayStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            setFilters(prev => ({...prev, plan_inicio_ate: todayStr}));
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
            // Clean up dots if user says numbers
            if (field === 'op' || field === 'pedido') {
                transcript = transcript.replace(/[^0-9]/g, '');
            }
            setFilters(prev => ({ ...prev, [field]: transcript }));
        };
        recognition.onerror = () => setRecordingField(null);
        recognition.onend = () => setRecordingField(null);
        recognition.start();
    };
`;
code = code.replace(stateTarget, stateRepl);

// 3. Update Inputs to have a relative wrapper and a Mic button
const wrapInput = (field, originalInput) => {
    return `<div className="relative">
                                    ${originalInput}
                                    <button
                                        type="button"
                                        onClick={() => handleVoiceInput('${field}')}
                                        className={\`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors \${recordingField === '${field}' ? 'bg-red-100 text-red-600 animate-pulse' : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100'}\`}
                                        title="Ditar valor"
                                    >
                                        <Mic className="w-3.5 h-3.5" />
                                    </button>
                                </div>`;
};

// OP Input
const opInputStr = `<input
                                    type="text"
                                    placeholder="Ex: 001234"
                                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
                                    value={filters.op}
                                    onChange={(e) => setFilters(prev => ({ ...prev, op: e.target.value.toUpperCase() }))}
                                />`;
code = code.replace(opInputStr, wrapInput('op', opInputStr));

// Pedido Input
const pedidoInputStr = `<input
                                    type="text"
                                    placeholder="PV..."
                                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
                                    value={filters.pedido}
                                    onChange={(e) => setFilters(prev => ({ ...prev, pedido: e.target.value.toUpperCase() }))}
                                />`;
code = code.replace(pedidoInputStr, wrapInput('pedido', pedidoInputStr));

// Produto Input
const produtoInputStr = `<input
                                    type="text"
                                    placeholder="Nome/Código"
                                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
                                    value={filters.produto}
                                    onChange={(e) => setFilters(prev => ({ ...prev, produto: e.target.value.toUpperCase() }))}
                                />`;
code = code.replace(produtoInputStr, wrapInput('produto', produtoInputStr));

// Cliente Input
const clienteInputStr = `<input
                                    type="text"
                                    placeholder="Razão Social"
                                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
                                    value={filters.cliente}
                                    onChange={(e) => setFilters(prev => ({ ...prev, cliente: e.target.value.toUpperCase() }))}
                                />`;
code = code.replace(clienteInputStr, wrapInput('cliente', clienteInputStr));


// 4. Update the TR to have active row styling
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

fs.writeFileSync(filePath, code, 'utf8');
console.log('VerticalAppointmentPage.jsx updated successfully!');
