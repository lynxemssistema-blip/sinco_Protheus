const fs = require('fs');
let content = fs.readFileSync('client/src/pages/VerticalAppointmentPage.jsx', 'utf8');

// Add shortcut function
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
            // now
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
        setFilters(prev => ({ ...prev, plan_inicio_de: fmt(start), plan_inicio_ate: fmt(end) }));
    };

    const savePlan = async (row) => {`;

content = content.replace(
    /    const savePlan = async \(row\) => {/g,
    shortcutCode
);

// Add shortcut buttons under the inputs
const buttonsHtml = `
                                </div>
                            </div>
                            <div className="flex gap-2 justify-center pt-1 mt-1 col-span-2 sm:col-span-1">
                                <button onClick={() => setDateShortcut('today')} className="text-[10px] uppercase font-bold text-slate-500 hover:text-blue-600 px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-blue-50 transition-colors">Hoje</button>
                                <button onClick={() => setDateShortcut('this_week')} className="text-[10px] uppercase font-bold text-slate-500 hover:text-blue-600 px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-blue-50 transition-colors">Semana</button>
                                <button onClick={() => setDateShortcut('next_week')} className="text-[10px] uppercase font-bold text-slate-500 hover:text-blue-600 px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-blue-50 transition-colors">Próx. Sem.</button>
                                <button onClick={() => setDateShortcut('this_month')} className="text-[10px] uppercase font-bold text-slate-500 hover:text-blue-600 px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-blue-50 transition-colors">Mês</button>
                            </div>
`;

content = content.replace(
    /                                \/>\r?\n                            <\/div>\r?\n                        <\/div>\r?\n                        \r?\n                        {selectedOp \? \(/,
    `                                />\n                            </div>\n                        </div>\n                        <div className="flex gap-2 justify-start col-span-1 sm:col-span-2 md:col-span-4 lg:col-span-5 mb-2">\n                                <button onClick={() => setDateShortcut('today')} className="text-[10px] uppercase font-bold text-slate-500 hover:text-blue-600 px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-blue-50 transition-colors">Hoje</button>\n                                <button onClick={() => setDateShortcut('this_week')} className="text-[10px] uppercase font-bold text-slate-500 hover:text-blue-600 px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-blue-50 transition-colors">Semana</button>\n                                <button onClick={() => setDateShortcut('next_week')} className="text-[10px] uppercase font-bold text-slate-500 hover:text-blue-600 px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-blue-50 transition-colors">Próx. Sem.</button>\n                                <button onClick={() => setDateShortcut('this_month')} className="text-[10px] uppercase font-bold text-slate-500 hover:text-blue-600 px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-blue-50 transition-colors">Mês</button>\n                        </div>\n\n                        {selectedOp ? (`
);

fs.writeFileSync('client/src/pages/VerticalAppointmentPage.jsx', content);
console.log('VerticalAppointmentPage.jsx updated successfully.');
