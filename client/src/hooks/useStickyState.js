import { useState, useEffect } from 'react';

/**
 * Hook genérico para persistência de estado (Sticky Filters / Preferences)
 * Salva e recupera valores do window.localStorage permanentemente (com fallback para sessionStorage).
 * 
 * @param {any} defaultValue Valor padrão inicial (caso a chave não exista no Storage)
 * @param {string} key Chave única para o Storage (ex: '@lynxems:itensFat_filters')
 */
export default function useStickyState(defaultValue, key) {
    const [value, setValue] = useState(() => {
        try {
            if (typeof window === 'undefined') return defaultValue;
            // 1. Tenta recuperar do localStorage (permanente entre sessões)
            let stickyValue = window.localStorage.getItem(key);
            // 2. Se não encontrou, tenta sessionStorage para compatibilidade
            if (stickyValue === null && window.sessionStorage) {
                stickyValue = window.sessionStorage.getItem(key);
            }
            return stickyValue !== null ? JSON.parse(stickyValue) : defaultValue;
        } catch (error) {
            console.warn(`Erro ao carregar '${key}'. Retornando ao default.`, error);
            return defaultValue;
        }
    });

    useEffect(() => {
        try {
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(key, JSON.stringify(value));
                if (window.sessionStorage) {
                    window.sessionStorage.setItem(key, JSON.stringify(value));
                }
            }
        } catch (error) {
            console.error(`Erro ao salvar '${key}':`, error);
        }
    }, [key, value]);

    return [value, setValue];
}
