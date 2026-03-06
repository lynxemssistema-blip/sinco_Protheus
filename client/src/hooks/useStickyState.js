import { useState, useEffect } from 'react';

/**
 * Hook genérico para persistência de estado (Sticky Filters)
 * Funciona de forma idêntica ao useState convencional, mas salva e recupera
 * os valores do window.sessionStorage automaticamente.
 * 
 * @param {any} defaultValue Valor padrão inicial (caso a chave não exista no Storage)
 * @param {string} key Chave única para o sessionStorage (ex: '@metalfisa:eng_tipoFilter')
 */
export default function useStickyState(defaultValue, key) {
    const [value, setValue] = useState(() => {
        try {
            const stickyValue = window.sessionStorage.getItem(key);
            return stickyValue !== null ? JSON.parse(stickyValue) : defaultValue;
        } catch (error) {
            console.warn(`Erro ao carregar '${key}' do sessionStorage. Retornando ao default.`, error);
            return defaultValue;
        }
    });

    useEffect(() => {
        try {
            window.sessionStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error(`Erro ao salvar '${key}' no sessionStorage:`, error);
        }
    }, [key, value]);

    return [value, setValue];
}
