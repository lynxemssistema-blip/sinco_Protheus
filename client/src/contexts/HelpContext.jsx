import React, { createContext, useContext, useState, useCallback } from 'react';

const HelpContext = createContext(null);

export function HelpProvider({ children }) {
    const [isOpen, setIsOpen] = useState(false);
    const [forcedPath, setForcedPath] = useState(null); // optional: override current path

    const openHelp = useCallback((path = null) => {
        setForcedPath(path);
        setIsOpen(true);
    }, []);

    const closeHelp = useCallback(() => {
        setIsOpen(false);
        setForcedPath(null);
    }, []);

    const toggleHelp = useCallback(() => {
        setIsOpen(prev => !prev);
        if (isOpen) setForcedPath(null);
    }, [isOpen]);

    return (
        <HelpContext.Provider value={{ isOpen, forcedPath, openHelp, closeHelp, toggleHelp }}>
            {children}
        </HelpContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useHelp() {
    const ctx = useContext(HelpContext);
    if (!ctx) throw new Error('useHelp must be used within HelpProvider');
    return ctx;
}
