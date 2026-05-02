import { createContext, useContext } from 'react';

export const HelpContext = createContext(null);

export function useHelp() {
    const ctx = useContext(HelpContext);
    if (!ctx) throw new Error('useHelp must be used within HelpProvider');
    return ctx;
}
