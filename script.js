const fs = require('fs');
let lines = fs.readFileSync('client/src/pages/ProductionControl.jsx', 'utf8').split('\n');

let start = lines.findIndex(l => l.includes('<button onClick={() => setShowLegend(true)}'));
if (start > -1 && start < 410) { 
    lines.splice(start, 4); 
}

let inputStart = lines.findIndex(l => l.includes('<div className="w-2/3 relative">'));
if (inputStart > -1) {
    lines.splice(inputStart, 4, 
        '                            <div className="w-2/3 flex gap-2">',
        '                                <div className="relative flex-1">',
        '                                    <input type="text" placeholder="Operação ou Recurso (ex: 01, SOLDA)" value={filters.operacao || \'\'} onChange={(e) => setFilters({ ...filters, operacao: e.target.value })} className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" onKeyPress={(e) => e.key === \'Enter\' && handleSearch()} />',
        '                                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />',
        '                                </div>',
        '                                <button onClick={() => setShowLegend(true)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-lg transition-colors flex items-center gap-2 text-sm whitespace-nowrap" title="Ver legenda de processos">',
        '                                    <Filter className="w-4 h-4" />',
        '                                    Legenda de Processos',
        '                                </button>',
        '                            </div>'
    );
}

fs.writeFileSync('client/src/pages/ProductionControl.jsx', lines.join('\n'));
console.log('Done');
