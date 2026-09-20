import { useState, useEffect } from 'react';

/**
 * Hook customizado de alto desempenho para debounce de valores de busca/filtro.
 * Atrasa a emissão do valor até que o usuário pare de digitar pelo período determinado (delayMs).
 * Evita tempestade de requisições ao backend e poupa conexões com o banco de dados.
 *
 * @param {any} value - O valor reativo (ex: searchTerm)
 * @param {number} delayMs - O tempo em ms para aguardar (padrão: 350ms)
 * @returns {any} O valor estabilizado com debounce
 */
export function useDebounce(value, delayMs = 350) {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delayMs);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delayMs]);

    return debouncedValue;
}

export default useDebounce;
