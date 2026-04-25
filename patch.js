const fs = require('fs');
let content = fs.readFileSync('client/src/components/ProductionMacroModal.jsx', 'utf8');

// 1. Imports
content = content.replace(
  "import { X, Calendar, Save, CheckSquare, Square, ChevronDown, ChevronRight, GripVertical, MoveUp, MoveDown, Briefcase, Globe, Plus, Minus, Link } from 'lucide-react';",
  "import { X, Calendar, Save, CheckSquare, Square, ChevronDown, ChevronRight, GripVertical, MoveUp, MoveDown, Briefcase, Globe, Plus, Minus, Link, Printer } from 'lucide-react';"
);
content = content.replace(
  "import { useHelp } from '../contexts/HelpContext';",
  "import { useHelp } from '../contexts/HelpContext';\nimport { generateGanttPDF } from '../services/ganttPdfGenerator';"
);

// 2. Dates Logic
const oldDates = `    const subtractDays = (date, days, mode, incSat = false) => {
        const result = new Date(date);
        let count = 0;
        while (count < days) {
            result.setDate(result.getDate() - 1);
            if (mode === 'business') {
                const day = result.getDay();
                if (day !== 0 && (incSat || day !== 6)) count++;
            } else {
                count++;
            }
        }
        return result;
    };

    const addDays = (date, days, mode, incSat = false) => {
        const result = new Date(date);
        let count = 0;
        while (count < days) {
            result.setDate(result.getDate() + 1);
            if (mode === 'business') {
                const day = result.getDay();
                if (day !== 0 && (incSat || day !== 6)) count++;
            } else {
                count++;
            }
        }
        return result;
    };

    // Normaliza uma data para o dia útil mais próximo (evita domingo/sábado como âncora)
    const skipToWorkday = (date, forward, incSat) => {
        const result = new Date(date);
        const day = result.getDay();
        if (day === 0) { // Domingo → sempre pula
            result.setDate(result.getDate() + (forward ? 1 : -2));
        } else if (!incSat && day === 6) { // Sábado (quando não incluído)
            result.setDate(result.getDate() + (forward ? 2 : -1));
        }
        return result;
    };

    // Conta dias úteis entre duas datas (inclusivo)
    const countBusinessDays = (startDate, endDate, incSat) => {
        let count = 0;
        const cur = new Date(startDate);
        cur.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(0, 0, 0, 0);
        while (cur <= end) {
            const day = cur.getDay();
            if (day !== 0 && (incSat || day !== 6)) count++;
            cur.setDate(cur.getDate() + 1);
        }
        return count;
    };`;

const newDates = `    const isHoliday = (date) => false;
    const safeDate = (dateVal) => {
        if (!dateVal) return new Date();
        if (dateVal instanceof Date) return new Date(dateVal.getFullYear(), dateVal.getMonth(), dateVal.getDate(), 12, 0, 0);
        const str = String(dateVal);
        const ymd = str.split('T')[0];
        if (ymd.length === 10) return new Date(ymd + 'T12:00:00');
        return new Date(dateVal);
    };

    const toDateStr = (dateObj) => {
        if (!dateObj) return '';
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return \`\${y}-\${m}-\${d}\`;
    };

    const subtractDays = (date, days, mode, incSat = false, incSun = false) => {
        const result = safeDate(date);
        let count = 0;
        while (count < days) {
            result.setDate(result.getDate() - 1);
            if (mode === 'business') {
                const day = result.getDay();
                const isWkend = (!incSun && day === 0) || (!incSat && day === 6);
                if (!isWkend && !isHoliday(result)) count++;
            } else {
                count++;
            }
        }
        return result;
    };

    const addDays = (date, days, mode, incSat = false, incSun = false) => {
        const result = safeDate(date);
        let count = 0;
        while (count < days) {
            result.setDate(result.getDate() + 1);
            if (mode === 'business') {
                const day = result.getDay();
                const isWkend = (!incSun && day === 0) || (!incSat && day === 6);
                if (!isWkend && !isHoliday(result)) count++;
            } else {
                count++;
            }
        }
        return result;
    };

    // Normaliza uma data para o dia útil mais próximo (evita domingo/sábado/feriado como âncora)
    const skipToWorkday = (date, forward, incSat, incSun) => {
        const result = safeDate(date);
        while (true) {
            const day = result.getDay();
            const isWkend = (!incSun && day === 0) || (!incSat && day === 6);
            if (isWkend || isHoliday(result)) {
                result.setDate(result.getDate() + (forward ? 1 : -1));
            } else {
                break;
            }
        }
        return result;
    };

    // Conta dias úteis entre duas datas (inclusivo)
    const countBusinessDays = (startDate, endDate, incSat, incSun) => {
        let count = 0;
        const cur = safeDate(startDate);
        const end = safeDate(endDate);
        while (cur <= end) {
            const day = cur.getDay();
            const isWkend = (!incSun && day === 0) || (!incSat && day === 6);
            if (!isWkend && !isHoliday(cur)) count++;
            cur.setDate(cur.getDate() + 1);
        }
        return count;
    };

    const getWeekdayShort = (dateStr) => {
        if (!dateStr) return '';
        const d = safeDate(dateStr);
        const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        return dias[d.getDay()];
    };`;

content = content.replace(oldDates, newDates);

// Signature of calcRoutine
content = content.replace(
  'const { isForward, anchorDate, plansList, targetGroups, joinedSet, incST, incSat } = params;',
  'const { isForward, anchorDate, plansList, targetGroups, joinedSet, incST, incSat, incSun } = params;'
);

content = content.replace(
  'const [includeSaturday, setIncludeSaturday] = useState(false); // Consider Saturday as workday',
  'const [includeSaturday, setIncludeSaturday] = useState(false); // Consider Saturday as workday\n    const [includeSunday, setIncludeSunday] = useState(false); // Consider Sunday as workday'
);

// 3. Normaliza âncora
content = content.replace(
  "        let currentDate = daysMode === 'business'\r\n            ? skipToWorkday(new Date(anchorDate), isForward, incSat)\r\n            : new Date(anchorDate);",
  "        let currentDate = daysMode === 'business'\r\n            ? skipToWorkday(safeDate(anchorDate), isForward, incSat, incSun)\r\n            : safeDate(anchorDate);"
);
content = content.replace(
  "        let currentDate = daysMode === 'business'\n            ? skipToWorkday(new Date(anchorDate), isForward, incSat)\n            : new Date(anchorDate);",
  "        let currentDate = daysMode === 'business'\n            ? skipToWorkday(safeDate(anchorDate), isForward, incSat, incSun)\n            : safeDate(anchorDate);"
);

// maxDur replaces
content = content.replace(
  'eDate = addDays(blockAnchorDate, maxDur - 1, daysMode, incSat);',
  'eDate = addDays(blockAnchorDate, maxDur - 1, daysMode, incSat, incSun);'
);
content = content.replace(
  'nextDate = addDays(blockAnchorDate, maxDur, daysMode, incSat);',
  'nextDate = addDays(blockAnchorDate, maxDur, daysMode, incSat, incSun);'
);
content = content.replace(
  'sDate = subtractDays(blockAnchorDate, maxDur - 1, daysMode, incSat);',
  'sDate = subtractDays(blockAnchorDate, maxDur - 1, daysMode, incSat, incSun);'
);
content = content.replace(
  'nextDate = subtractDays(blockAnchorDate, maxDur, daysMode, incSat);',
  'nextDate = subtractDays(blockAnchorDate, maxDur, daysMode, incSat, incSun);'
);

// result saving
const saveDatesBlock = `                    const normalizedEnd = daysMode === 'business'
                        ? skipToWorkday(new Date(eDate), true, incSat)
                        : eDate;
                    p.start = sDate.toISOString().split('T')[0];
                    p.end = normalizedEnd.toISOString().split('T')[0];`;
const newSaveDatesBlock = `                    const normalizedEnd = daysMode === 'business'
                        ? skipToWorkday(eDate, true, incSat, incSun)
                        : eDate;
                    p.start = toDateStr(sDate);
                    p.end = toDateStr(normalizedEnd);`;
content = content.replace(saveDatesBlock, newSaveDatesBlock);


// handlePrint Function
const handleSave = `    // --- Salvar Batch ---
    const handleSave = async () => {`;
const newHandleSave = `    const handlePrint = async () => {
        try {
            await generateGanttPDF(op, orderedGroups, operationPlans);
        } catch (error) {
            console.error(error);
            alert('Falha ao gerar o relatório PDF.');
        }
    };

    // --- Salvar Batch ---
    const handleSave = async () => {`;
content = content.replace(handleSave, newHandleSave);


// Checkboxes
const checkboxes = `                        {daysMode === 'business' && (
                            <label className="flex items-center gap-1 cursor-pointer text-[9px] font-bold text-slate-600 uppercase tracking-tight select-none hover:text-blue-600 transition-colors ml-1 pr-1 border-l border-slate-200 pl-1">
                                <input 
                                    type="checkbox" 
                                    checked={includeSaturday} 
                                    onChange={(e) => {
                                        setIncludeSaturday(e.target.checked);
                                        setTimeout(() => triggerRecalculation(operationPlans, orderedGroups, calcDirection, includeST, e.target.checked), 0);
                                    }}
                                    className="w-3 h-3 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                                />
                                Incluir Sábado?
                            </label>
                        )}`;
                        
const newCheckboxes = `                        {daysMode === 'business' && (
                            <>
                                <label className="flex items-center gap-1 cursor-pointer text-[9px] font-bold text-slate-600 uppercase tracking-tight select-none hover:text-blue-600 transition-colors ml-1 pr-1 border-l border-slate-200 pl-1">
                                    <input 
                                        type="checkbox" 
                                        checked={includeSaturday} 
                                        onChange={(e) => {
                                            setIncludeSaturday(e.target.checked);
                                            setTimeout(() => triggerRecalculation(operationPlans, orderedGroups, calcDirection, includeST, e.target.checked, includeSunday), 0);
                                        }}
                                        className="w-3 h-3 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                                    />
                                    Incluir Sábado?
                                </label>
                                <label className="flex items-center gap-1 cursor-pointer text-[9px] font-bold text-slate-600 uppercase tracking-tight select-none hover:text-blue-600 transition-colors ml-1 pr-1 border-l border-slate-200 pl-1">
                                    <input 
                                        type="checkbox" 
                                        checked={includeSunday} 
                                        onChange={(e) => {
                                            setIncludeSunday(e.target.checked);
                                            setTimeout(() => triggerRecalculation(operationPlans, orderedGroups, calcDirection, includeST, includeSaturday, e.target.checked), 0);
                                        }}
                                        className="w-3 h-3 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                                    />
                                    Incluir Domingo?
                                </label>
                            </>
                        )}`;
content = content.replace(checkboxes, newCheckboxes);


// Start End Inputs
const inputs = `                                            <div className="w-[140px] px-1 py-1 flex items-center justify-center gap-1 border-l border-slate-50">
                                                <input type="date" value={plan.start ? plan.start.split('T')[0] : ''} onChange={e => { setOperationPlans(p => ({...p, [group.code]: {...p[group.code], start: e.target.value}})); }} disabled={!plan.selected}
                                                    className={\`w-[66px] text-[9px] px-0.5 py-0.5 border rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-center \${plan.start !== plan.baselineStart ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-slate-200 text-slate-700'}\`} />
                                                <span className="text-slate-300 text-[10px]">&gt;</span>
                                                <input type="date" value={plan.end ? plan.end.split('T')[0] : ''} onChange={e => { setOperationPlans(p => ({...p, [group.code]: {...p[group.code], end: e.target.value}})); }} disabled={!plan.selected}
                                                    className={\`w-[66px] text-[9px] px-0.5 py-0.5 border rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-center \${plan.end !== plan.baselineEnd ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-slate-200 text-slate-700'}\`} />
                                            </div>`;
                                            
const newInputs = `                                            <div className="w-[140px] px-1 py-1 flex items-center justify-center gap-1 border-l border-slate-50">
                                                <div className="flex flex-col items-center">
                                                    <input type="date" value={plan.start ? plan.start.split('T')[0] : ''} onChange={e => { 
                                                        const validatedDate = daysMode === 'business' ? skipToWorkday(e.target.value, true, includeSaturday, includeSunday) : safeDate(e.target.value);
                                                        setOperationPlans(p => ({...p, [group.code]: {...p[group.code], start: toDateStr(validatedDate)}})); 
                                                    }} disabled={!plan.selected}
                                                        className={\`w-[66px] text-[9px] px-0.5 py-0.5 border rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-center \${plan.start !== plan.baselineStart ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-slate-200 text-slate-700'}\`} />
                                                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tight mt-[1px]">{getWeekdayShort(plan.start)}</span>
                                                </div>
                                                <span className="text-slate-300 text-[10px] mb-3">&gt;</span>
                                                <div className="flex flex-col items-center">
                                                    <input type="date" value={plan.end ? plan.end.split('T')[0] : ''} onChange={e => { 
                                                        const validatedDate = daysMode === 'business' ? skipToWorkday(e.target.value, true, includeSaturday, includeSunday) : safeDate(e.target.value);
                                                        setOperationPlans(p => ({...p, [group.code]: {...p[group.code], end: toDateStr(validatedDate)}})); 
                                                    }} disabled={!plan.selected}
                                                        className={\`w-[66px] text-[9px] px-0.5 py-0.5 border rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-center \${plan.end !== plan.baselineEnd ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-slate-200 text-slate-700'}\`} />
                                                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tight mt-[1px]">{getWeekdayShort(plan.end)}</span>
                                                </div>
                                            </div>`;
content = content.replace(inputs, newInputs);


// Footer buttons
const footerButtons = `                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-[10px] font-bold text-white transition-colors">`;
const newFooterButtons = `                    <div className="flex gap-2">
                        <button onClick={handlePrint} className="px-3 py-1 bg-slate-600 hover:bg-slate-500 rounded text-[10px] font-bold text-white transition-colors flex items-center gap-1.5 border border-slate-500">
                            <Printer className="w-3 h-3" /> Imprimir
                        </button>
                        <button onClick={onClose} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-[10px] font-bold text-white transition-colors">`;
content = content.replace(footerButtons, newFooterButtons);

fs.writeFileSync('client/src/components/ProductionMacroModal.jsx', content, 'utf8');
console.log('Script executed correctly!');
