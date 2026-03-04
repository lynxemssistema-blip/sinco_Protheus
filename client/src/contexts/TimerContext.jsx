import React, { createContext, useContext, useState, useEffect } from 'react';

// Lightweight timer: stores only startedAt timestamp + pause accumulator.
// NO intervals, NO re-renders. Elapsed computed on-demand only when stopping.

const TimerContext = createContext({});

export function TimerProvider({ children }) {
    const [timers, setTimers] = useState(() => {
        try {
            const saved = localStorage.getItem('metalfisa_production_timers');
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            return {};
        }
    });

    useEffect(() => {
        localStorage.setItem('metalfisa_production_timers', JSON.stringify(timers));
    }, [timers]);

    const startTimer = (opData) => {
        const timerId = `${opData.op}_${opData.item_op || '01'}_${opData.sequen || '001'}_${opData.operacao}`;

        setTimers(prev => {
            const existing = prev[timerId];
            if (existing && existing.isRunning) return prev;

            return {
                ...prev,
                [timerId]: {
                    ...opData,
                    id: timerId,
                    startedAt: new Date().toISOString(),
                    isRunning: true
                }
            };
        });
    };

    const pauseTimer = (timerId) => {
        setTimers(prev => {
            const existing = prev[timerId];
            if (!existing || !existing.isRunning) return prev;

            return {
                ...prev,
                [timerId]: {
                    ...existing,
                    stoppedAt: new Date().toISOString(),
                    isRunning: false
                }
            };
        });
    };

    const restartTimer = (timerId) => {
        setTimers(prev => {
            const existing = prev[timerId];
            if (!existing) return prev;
            return {
                ...prev,
                [timerId]: {
                    ...existing,
                    startedAt: new Date().toISOString(),
                    stoppedAt: null,
                    isRunning: true
                }
            };
        });
    };

    const removeTimer = (timerId) => {
        setTimers(prev => {
            const newTimers = { ...prev };
            delete newTimers[timerId];
            return newTimers;
        });
    };

    // Compute elapsed seconds from startedAt to stoppedAt (or now if running).
    // Called on-demand, NOT via interval.
    const getElapsedTime = (timerId) => {
        const t = timers[timerId];
        if (!t) return 0;

        const start = new Date(t.startedAt).getTime();
        const end = t.stoppedAt ? new Date(t.stoppedAt).getTime() : new Date().getTime();
        return Math.max(0, Math.floor((end - start) / 1000));
    };

    return (
        <TimerContext.Provider value={{
            timers,
            startTimer,
            pauseTimer,
            restartTimer,
            removeTimer,
            getElapsedTime
        }}>
            {children}
        </TimerContext.Provider>
    );
}

export function useTimer() {
    return useContext(TimerContext);
}
