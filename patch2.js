const fs = require('fs');
let code = fs.readFileSync('client/src/components/ProductionMacroModal.jsx', 'utf8');

const oldBtn = '<button onClick={onClose} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-[10px] font-bold text-white transition-colors">';
const newBtn = `<button onClick={handlePrint} className="px-3 py-1 bg-slate-600 hover:bg-slate-500 rounded text-[10px] font-bold text-white transition-colors flex items-center gap-1.5 border border-slate-500">
                            <Printer className="w-3 h-3" /> Imprimir
                        </button>
                        <button onClick={onClose} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-[10px] font-bold text-white transition-colors">`;

if (code.includes(oldBtn) && !code.includes('Imprimir')) {
    code = code.replace(oldBtn, newBtn);
    fs.writeFileSync('client/src/components/ProductionMacroModal.jsx', code, 'utf8');
    console.log('Botao de imprimir adicionado');
} else {
    console.log('Botao ja existe ou não encontrou o alvo');
}
