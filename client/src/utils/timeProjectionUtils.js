export function toSecs(timeStr) {
    if (!timeStr) return 0;
    const [h, m, s] = timeStr.split(':');
    return parseInt(h) * 3600 + parseInt(m) * 60 + (parseInt(s) || 0);
}

export function sortTurnos(turnos) {
    if (!turnos || turnos.length === 0) return [];
    return [...turnos].sort((a, b) => {
        if (a.ordem !== b.ordem) return a.ordem - b.ordem;
        return a.hora_inicio.localeCompare(b.hora_inicio);
    });
}

// Pula a data/hora atual para o próximo momento de trabalho válido
export function getNextWorkingTime(dateObj, turnos) {
    if (!turnos || turnos.length === 0) return dateObj;
    const sortedTurnos = sortTurnos(turnos);
    let current = new Date(dateObj);
    
    // Safety break
    let max = 100;
    while(max > 0) {
        max--;
        const currTimeSecs = current.getHours() * 3600 + current.getMinutes() * 60 + current.getSeconds();
        const dateStr = current.toISOString().substring(0, 10);
        
        let inWorkingTime = false;
        let jumpTo = null;

        for (let i = 0; i < sortedTurnos.length; i++) {
            const t = sortedTurnos[i];
            const startSecs = toSecs(t.hora_inicio);
            const endSecs = toSecs(t.hora_fim);
            
            // Check if we are inside a turno
            if (currTimeSecs >= startSecs && currTimeSecs < endSecs) {
                // Check if inside interval
                if (t.intervalo_inicio && t.intervalo_fim) {
                    const intStart = toSecs(t.intervalo_inicio);
                    const intEnd = toSecs(t.intervalo_fim);
                    if (currTimeSecs >= intStart && currTimeSecs < intEnd) {
                        jumpTo = new Date(`${dateStr}T${t.intervalo_fim}`);
                        break;
                    }
                }
                inWorkingTime = true;
                break;
            }
        }

        if (inWorkingTime && !jumpTo) return current;

        if (jumpTo) {
            current = jumpTo;
            continue;
        }

        // Out of bounds, find next turno
        let foundNext = false;
        for (let i = 0; i < sortedTurnos.length; i++) {
            const t = sortedTurnos[i];
            const startSecs = toSecs(t.hora_inicio);
            if (startSecs > currTimeSecs) {
                current = new Date(`${dateStr}T${t.hora_inicio}`);
                foundNext = true;
                break;
            }
        }

        if (!foundNext) {
            // Jump to next day first turno
            const nextDay = new Date(current);
            nextDay.setDate(nextDay.getDate() + 1);
            current = new Date(`${nextDay.toISOString().substring(0, 10)}T${sortedTurnos[0].hora_inicio}`);
        }
    }
    return current;
}

export function addWorkingTime(startDate, durationSeconds, turnos) {
    if (!turnos || turnos.length === 0) {
        return new Date(startDate.getTime() + durationSeconds * 1000);
    }

    const sortedTurnos = sortTurnos(turnos);
    let current = getNextWorkingTime(new Date(startDate), turnos);
    let remaining = durationSeconds;
    
    let maxIter = 1000;
    while (remaining > 0 && maxIter > 0) {
        maxIter--;
        const currTimeSecs = current.getHours() * 3600 + current.getMinutes() * 60 + current.getSeconds();
        const dateStr = current.toISOString().substring(0, 10);
        
        let activeTurno = null;
        for (let i = 0; i < sortedTurnos.length; i++) {
            const t = sortedTurnos[i];
            const startSecs = toSecs(t.hora_inicio);
            const endSecs = toSecs(t.hora_fim);
            
            if (currTimeSecs >= startSecs && currTimeSecs < endSecs) {
                activeTurno = t;
                break;
            }
        }

        if (!activeTurno) {
            current = getNextWorkingTime(current, turnos);
            continue;
        }

        const endSecs = toSecs(activeTurno.hora_fim);
        let nextBoundary = endSecs;
        
        if (activeTurno.intervalo_inicio && activeTurno.intervalo_fim) {
            const intStart = toSecs(activeTurno.intervalo_inicio);
            if (currTimeSecs < intStart) {
                nextBoundary = Math.min(endSecs, intStart);
            }
        }

        const availableSecs = nextBoundary - currTimeSecs;
        
        if (remaining <= availableSecs) {
            current.setSeconds(current.getSeconds() + remaining);
            remaining = 0;
        } else {
            current.setSeconds(current.getSeconds() + availableSecs);
            remaining -= availableSecs;
            // Get out of the boundary
            current = getNextWorkingTime(current, turnos);
        }
    }
    return current;
}

export function jumpToNextShift(dateObj, turnos) {
    if (!turnos || turnos.length === 0) return dateObj;
    const sortedTurnos = sortTurnos(turnos);
    let current = new Date(dateObj);
    const currTimeSecs = current.getHours() * 3600 + current.getMinutes() * 60 + current.getSeconds();
    const dateStr = current.toISOString().substring(0, 10);

    // Find the current or next turno, and jump to the one AFTER it
    let found = false;
    for (let i = 0; i < sortedTurnos.length; i++) {
        const t = sortedTurnos[i];
        const startSecs = toSecs(t.hora_inicio);
        const endSecs = toSecs(t.hora_fim);
        
        if (currTimeSecs < endSecs) {
            // If there's a next turno today
            if (i + 1 < sortedTurnos.length) {
                current = new Date(`${dateStr}T${sortedTurnos[i+1].hora_inicio}`);
                found = true;
                break;
            }
        }
    }

    if (!found) {
        // Jump to next day first turno
        const nextDay = new Date(current);
        nextDay.setDate(nextDay.getDate() + 1);
        current = new Date(`${nextDay.toISOString().substring(0, 10)}T${sortedTurnos[0].hora_inicio}`);
    }

    return current;
}

export function getTurnoForTime(dateObj, turnos) {
    if (!turnos || turnos.length === 0) return null;
    const sortedTurnos = sortTurnos(turnos);
    const currTimeSecs = dateObj.getHours() * 3600 + dateObj.getMinutes() * 60 + dateObj.getSeconds();
    
    for (let i = 0; i < sortedTurnos.length; i++) {
        const t = sortedTurnos[i];
        const startSecs = toSecs(t.hora_inicio);
        const endSecs = toSecs(t.hora_fim);
        if (currTimeSecs >= startSecs && currTimeSecs <= endSecs) { // <= to catch boundary
            return t;
        }
    }
    // Fallback: return the closest past shift, or simply null
    return null;
}
