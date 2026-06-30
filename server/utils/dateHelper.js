/**
 * Helper to identify weekends and Brazilian holidays under America/Sao_Paulo timezone.
 */

/**
 * Returns year, month, day, and weekday name in America/Sao_Paulo timezone.
 * @param {Date} date 
 */
function getBrazilDateParts(date = new Date()) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short'
    });
    
    const parts = formatter.formatToParts(date);
    const partMap = {};
    parts.forEach(p => partMap[p.type] = p.value);
    
    return {
        year: parseInt(partMap.year),
        month: parseInt(partMap.month),
        day: parseInt(partMap.day),
        weekday: partMap.weekday // "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"
    };
}

/**
 * Calculates the Easter date for a given year using Butcher's algorithm.
 * @param {number} year 
 * @returns {Date}
 */
function getEasterDate(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
}

/**
 * Checks if a given date is a weekend or Brazilian holiday.
 * @param {Date} date 
 * @returns {boolean}
 */
function isWeekendOrHoliday(date = new Date()) {
    const { year, month, day, weekday } = getBrazilDateParts(date);
    
    // 1. Weekend Check
    if (weekday === 'Sat' || weekday === 'Sun') {
        return true;
    }
    
    // 2. Fixed Brazilian Holidays (Format: "DD-MM")
    const fixedHolidays = [
        '01-01', // Confraternização Universal (Ano Novo)
        '21-04', // Tiradentes
        '01-05', // Dia do Trabalho
        '07-09', // Independência do Brasil
        '12-10', // Nossa Senhora Aparecida
        '02-11', // Finados
        '15-11', // Proclamação da República
        '20-11', // Consciência Negra
        '25-12'  // Natal
    ];
    
    const currentDayStr = `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}`;
    if (fixedHolidays.includes(currentDayStr)) {
        return true;
    }
    
    // 3. Movable Holidays (Carnaval, Sexta-feira Santa, Corpus Christi)
    const easter = getEasterDate(year);
    
    const formatDate = (d) => {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        return `${dd}-${mm}`;
    };
    
    // Sexta-feira Santa (Good Friday): Easter - 2 days
    const goodFriday = new Date(easter);
    goodFriday.setDate(easter.getDate() - 2);
    
    // Carnaval: Easter - 47 days
    const carnaval = new Date(easter);
    carnaval.setDate(easter.getDate() - 47);
    
    // Corpus Christi: Easter + 60 days
    const corpusChristi = new Date(easter);
    corpusChristi.setDate(easter.getDate() + 60);
    
    const movableHolidays = [
        formatDate(goodFriday),
        formatDate(carnaval),
        formatDate(corpusChristi)
    ];
    
    if (movableHolidays.includes(currentDayStr)) {
        return true;
    }
    
    return false;
}

module.exports = {
    getBrazilDateParts,
    getEasterDate,
    isWeekendOrHoliday
};
