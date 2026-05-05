const fs = require('fs');
let content = fs.readFileSync('client/src/pages/ProductionControl.jsx', 'utf8');

// 1. Add import
content = content.replace(
    /import useStickyState from '\.\.\/hooks\/useStickyState';/g,
    'import useStickyState from \'../hooks/useStickyState\';\nimport { generateProductionControlPdf } from \'../services/productionControlPdfGenerator\';'
);

// 2. Add date shortcut functions
const shortcutCode = `
    const getWeekStart = (date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    };

    const setDateShortcut = (type) => {
        const now = new Date();
        let start = new Date(now);
        let end = new Date(now);

        const fmt = (d) => {
            const yr = d.getFullYear();
            const mo = String(d.getMonth() + 1).padStart(2, '0');
            const da = String(d.getDate()).padStart(2, '0');
            return \`\${yr}-\${mo}-\${da}\`;
        };

        if (type === 'today') {
            // start and end are already now
        } else if (type === 'this_week') {
            start = getWeekStart(now);
            end = new Date(start);
            end.setDate(end.getDate() + 6);
        } else if (type === 'next_week') {
            start = getWeekStart(now);
            start.setDate(start.getDate() + 7);
            end = new Date(start);
            end.setDate(end.getDate() + 6);
        } else if (type === 'this_month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        }
        setFilters(prev => ({ ...prev, planned_date_start: fmt(start), planned_date_end: fmt(end) }));
    };

    const [sortConfig, setSortConfig] = useStickyState(null, '@metalfisa:prod_sortConfig');`;

content = content.replace(
    /    const \[sortConfig, setSortConfig\] = useStickyState\(null, '@metalfisa:prod_sortConfig'\);/g,
    shortcutCode
);

// 3. Add shortcut buttons
const buttonsHtml = `
                        <div className="flex flex-col gap-1 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 shrink-0">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-slate-500" />
                                <span className="text-xs text-slate-600 font-medium uppercase tracking-wider">Planejado:</span>
                                <input 
                                    type="date" 
                                    value={filters.planned_date_start || ''} 
                                    onChange={(e) => setFilters({ ...filters, planned_date_start: e.target.value })} 
                                    className="px-2 py-1 border border-slate-200 rounded bg-white text-sm text-slate-700 outline-none focus:border-blue-500 transition-all" 
                                />
                                <span className="text-slate-400 text-sm">até</span>
                                <input 
                                    type="date" 
                                    value={filters.planned_date_end || ''} 
                                    onChange={(e) => setFilters({ ...filters, planned_date_end: e.target.value })} 
                                    className="px-2 py-1 border border-slate-200 rounded bg-white text-sm text-slate-700 outline-none focus:border-blue-500 transition-all" 
                                />
                            </div>
                            <div className="flex gap-2 justify-center pt-1">
                                <button onClick={() => setDateShortcut('today')} className="text-[10px] uppercase font-bold text-slate-500 hover:text-blue-600 px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-blue-50 transition-colors">Hoje</button>
                                <button onClick={() => setDateShortcut('this_week')} className="text-[10px] uppercase font-bold text-slate-500 hover:text-blue-600 px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-blue-50 transition-colors">Semana</button>
                                <button onClick={() => setDateShortcut('next_week')} className="text-[10px] uppercase font-bold text-slate-500 hover:text-blue-600 px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-blue-50 transition-colors">Próx. Sem.</button>
                                <button onClick={() => setDateShortcut('this_month')} className="text-[10px] uppercase font-bold text-slate-500 hover:text-blue-600 px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-blue-50 transition-colors">Mês</button>
                            </div>
                        </div>`;

content = content.replace(
    /                        <div className="flex items-center border border-slate-200 rounded-lg px-3 py-1 bg-slate-50 gap-2 shrink-0">\r?\n                            <Calendar className="w-4 h-4 text-slate-500" \/>\r?\n                            <span className="text-xs text-slate-600 font-medium uppercase tracking-wider">Planejado:<\/span>\r?\n                            <input \r?\n                                type="date" \r?\n                                value={filters.planned_date_start \|\| ''} \r?\n                                onChange={\(e\) => setFilters\({ \.\.\.filters, planned_date_start: e.target.value }\)} \r?\n                                className="px-2 py-1 border border-slate-200 rounded bg-white text-sm text-slate-700 outline-none focus:border-blue-500 transition-all" \r?\n                            \/>\r?\n                            <span className="text-slate-400 text-sm">at(?:é|Ã©)<\/span>\r?\n                            <input \r?\n                                type="date" \r?\n                                value={filters.planned_date_end \|\| ''} \r?\n                                onChange={\(e\) => setFilters\({ \.\.\.filters, planned_date_end: e.target.value }\)} \r?\n                                className="px-2 py-1 border border-slate-200 rounded bg-white text-sm text-slate-700 outline-none focus:border-blue-500 transition-all" \r?\n                            \/>\r?\n                        <\/div>/g,
    buttonsHtml
);

// 4. Add Report Print button
const printHtml = `
                        <div className="flex gap-2">
                            <button onClick={async () => {
                                if (!ops || ops.length === 0) {
                                    toast.warning('Faça uma busca primeiro para gerar o relatório.');
                                    return;
                                }
                                try {
                                    const filterTexts = [];
                                    if (filters.planned_date_start) filterTexts.push(\`De: \${filters.planned_date_start}\`);
                                    if (filters.planned_date_end) filterTexts.push(\`Até: \${filters.planned_date_end}\`);
                                    if (filters.operacao) filterTexts.push(\`Recurso: \${filters.operacao}\`);
                                    
                                    await generateProductionControlPdf(ops, filterTexts);
                                    toast.success('Relatório gerado com sucesso!');
                                } catch (e) {
                                    toast.error('Erro ao gerar PDF');
                                }
                            }} className="px-4 py-2 bg-slate-800 text-white font-semibold rounded-lg hover:bg-slate-900 transition-colors flex items-center gap-2 shadow-sm shrink-0" title="Imprimir Relatório (Separado por Recurso)">
                                <Printer className="w-4 h-4" />
                                Relatório
                            </button>
                            <button onClick={handleSearch} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm shrink-0" disabled={loading}>
                                <Search className="w-4 h-4" />
                                {loading ? 'Buscando...' : 'Buscar'}
                            </button>
                        </div>`;

content = content.replace(
    /                        <button onClick={handleSearch} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm shrink-0" disabled={loading}>\r?\n                            <Search className="w-4 h-4" \/>\r?\n                            {loading \? 'Buscando\.\.\.' : 'Buscar'}\r?\n                        <\/button>/g,
    printHtml
);

fs.writeFileSync('client/src/pages/ProductionControl.jsx', content);
console.log('ProductionControl.jsx updated successfully.');
