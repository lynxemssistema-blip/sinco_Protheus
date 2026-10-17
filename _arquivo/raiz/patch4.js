const fs = require('fs');
let content = fs.readFileSync('client/src/pages/VerticalAppointmentPage.jsx', 'utf8');

const matchStr = `                                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Plan. Início Até</label>
                                  <input
                                      type="date"
                                      value={filters.plan_inicio_ate}
                                      onChange={(e) => setFilters(prev => ({ ...prev, plan_inicio_ate: e.target.value }))}
                                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                      className="w-full px-3 py-2 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none shadow-sm"
                                  />
                              </div>
                          </div>`;

const replaceStr = `                                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Plan. Início Até</label>
                                  <input
                                      type="date"
                                      value={filters.plan_inicio_ate}
                                      onChange={(e) => setFilters(prev => ({ ...prev, plan_inicio_ate: e.target.value }))}
                                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                      className="w-full px-3 py-2 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none shadow-sm"
                                  />
                              </div>
                          </div>
                          <div className="flex gap-2 justify-start pt-3 col-span-1 sm:col-span-2 md:col-span-4 lg:col-span-5">
                                <button onClick={() => setDateShortcut('today')} className="text-[10px] uppercase font-bold text-slate-500 hover:text-blue-600 px-3 py-1.5 rounded border border-slate-200 bg-slate-50 hover:bg-blue-50 transition-colors shadow-sm">Hoje</button>
                                <button onClick={() => setDateShortcut('this_week')} className="text-[10px] uppercase font-bold text-slate-500 hover:text-blue-600 px-3 py-1.5 rounded border border-slate-200 bg-slate-50 hover:bg-blue-50 transition-colors shadow-sm">Semana</button>
                                <button onClick={() => setDateShortcut('next_week')} className="text-[10px] uppercase font-bold text-slate-500 hover:text-blue-600 px-3 py-1.5 rounded border border-slate-200 bg-slate-50 hover:bg-blue-50 transition-colors shadow-sm">Próx. Sem.</button>
                                <button onClick={() => setDateShortcut('this_month')} className="text-[10px] uppercase font-bold text-slate-500 hover:text-blue-600 px-3 py-1.5 rounded border border-slate-200 bg-slate-50 hover:bg-blue-50 transition-colors shadow-sm">Mês</button>
                          </div>`;

if (content.includes("Plan. Início Até")) {
    // try replacing with proper encoding handling if "Início" / "Até" is garbled
    const lines = content.split('\\n');
    let replaced = false;
    for (let i=0; i<lines.length; i++) {
        if (lines[i].includes('value={filters.plan_inicio_ate}')) {
            // The input for plan_inicio_ate is at line i
            // It ends with /> at i+4
            // And two </div> lines at i+5, i+6
            // We want to insert the div after i+6
            
            lines.splice(i+7, 0, \`                          <div className="flex gap-2 justify-start pt-3 col-span-1 sm:col-span-2 md:col-span-4 lg:col-span-5">
                                <button onClick={() => setDateShortcut('today')} className="text-[10px] uppercase font-bold text-slate-500 hover:text-blue-600 px-3 py-1.5 rounded border border-slate-200 bg-slate-50 hover:bg-blue-50 transition-colors shadow-sm">Hoje</button>
                                <button onClick={() => setDateShortcut('this_week')} className="text-[10px] uppercase font-bold text-slate-500 hover:text-blue-600 px-3 py-1.5 rounded border border-slate-200 bg-slate-50 hover:bg-blue-50 transition-colors shadow-sm">Semana</button>
                                <button onClick={() => setDateShortcut('next_week')} className="text-[10px] uppercase font-bold text-slate-500 hover:text-blue-600 px-3 py-1.5 rounded border border-slate-200 bg-slate-50 hover:bg-blue-50 transition-colors shadow-sm">Próx. Sem.</button>
                                <button onClick={() => setDateShortcut('this_month')} className="text-[10px] uppercase font-bold text-slate-500 hover:text-blue-600 px-3 py-1.5 rounded border border-slate-200 bg-slate-50 hover:bg-blue-50 transition-colors shadow-sm">Mês</button>
                          </div>\`);
            replaced = true;
            break;
        }
    }
    if (replaced) {
        fs.writeFileSync('client/src/pages/VerticalAppointmentPage.jsx', lines.join('\\n'));
        console.log('Successfully inserted buttons using line splitting.');
    } else {
        console.log('Failed to find insertion point.');
    }
}
