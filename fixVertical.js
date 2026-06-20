const fs = require('fs');
const path = require('path');

const filePath = path.join('client', 'src', 'pages', 'VerticalAppointmentPage.jsx');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Ensure PCPMetalDrawer is imported
if (!code.includes("PCPMetalDrawer")) {
    code = code.replace(
        "import useStickyState from '../hooks/useStickyState';",
        "import useStickyState from '../hooks/useStickyState';\nimport PCPMetalDrawer from '../components/PCPMetalDrawer';"
    );
}

// 2. Wrap inputs with relative div and Mic button
const wrapWithMic = (fieldStr, fieldName) => {
    return `<div className="relative">
                                ${fieldStr}
                                <button
                                    type="button"
                                    onClick={() => handleVoiceInput('${fieldName}')}
                                    className={\`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors \${recordingField === '${fieldName}' ? 'bg-red-100 text-red-600 animate-pulse' : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100'}\`}
                                    title="Ditar valor"
                                >
                                    <Mic className="w-3.5 h-3.5" />
                                </button>
                            </div>`;
};

// Replace OP
const opInputMatch = code.match(/<input[^>]+value=\{filters\.op\}[^>]+\/>/);
if (opInputMatch) code = code.replace(opInputMatch[0], wrapWithMic(opInputMatch[0], 'op'));

// Replace Pedido
const pedidoInputMatch = code.match(/<input[^>]+value=\{filters\.pedido\}[^>]+\/>/);
if (pedidoInputMatch) code = code.replace(pedidoInputMatch[0], wrapWithMic(pedidoInputMatch[0], 'pedido'));

// Replace Produto
const produtoInputMatch = code.match(/<input[^>]+value=\{filters\.produto\}[^>]+\/>/);
if (produtoInputMatch) code = code.replace(produtoInputMatch[0], wrapWithMic(produtoInputMatch[0], 'produto'));

// Replace Cliente
const clienteInputMatch = code.match(/<input[^>]+value=\{filters\.cliente\}[^>]+\/>/);
if (clienteInputMatch) code = code.replace(clienteInputMatch[0], wrapWithMic(clienteInputMatch[0], 'cliente'));

// 3. Add PCPMetalDrawer to the main render
const returnMatch = code.match(/<div className="p-6 space-y-4">/);
if (returnMatch && !code.includes("<PCPMetalDrawer />")) {
    code = code.replace(returnMatch[0], returnMatch[0] + "\n            <PCPMetalDrawer />");
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('Fixed VerticalAppointmentPage successfully!');
