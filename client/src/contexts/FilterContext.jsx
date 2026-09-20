import React, { createContext, useState, useContext } from 'react';

const FilterContext = createContext();

export const FilterProvider = ({ children }) => {
    // Função auxiliar para inicializar com segurança do sessionStorage
    const initFilterState = (key, defaultState) => {
        try {
            const saved = sessionStorage.getItem(key) || localStorage.getItem(key);
            return saved ? JSON.parse(saved) : defaultState;
        } catch (e) {
            console.warn(`Erro ao carregar '${key}', usando default:`, e);
            return defaultState;
        }
    };

    // Estado para filtros de Produtos
    const [productFilters, setProductFilters] = useState(() =>
        initFilterState('@metalfisa:productFilters', {
            search: '',
            code: '',
            type: '',
            client: '',
            client_code: '',
            file_path: '',
            page: 1
        })
    );

    // Estado para filtros de Produtos MS Metal (Firebird)
    const [msMetalProductFilters, setMSMetalProductFilters] = useState(() =>
        initFilterState('@metalfisa:msMetalProductFilters', {
            search: '',
            code: '',
            client_code: '',
            client_name: '',
            has_bom: '',
            protheus_status: '',
            page: 1
        })
    );

    // Estado para filtros de Pedidos
    const [orderFilters, setOrderFilters] = useState(() =>
        initFilterState('@metalfisa:orderFilters', {
            cliente: '',
            pedido: '',
            item: '',
            op: '',
            produto: '',
            pedcli: '',
            refCliente: '',
            dataInicial: '',
            dataFinal: '',
            only_active: 'true',
            somente_prioridades: 'false',
            dateType: 'pedido',
            tipo_item: '',
            viewMode: 'flat',
            activeTab: 'evolucao',
            page: 1,
            expandedOrderId: null,
            sortBy: 'emissao',
            sortOrder: 'DESC'
        })
    );

    // Salvar no sessionStorage sempre que o estado mudar
    React.useEffect(() => {
        sessionStorage.setItem('@metalfisa:productFilters', JSON.stringify(productFilters));
    }, [productFilters]);

    React.useEffect(() => {
        sessionStorage.setItem('@metalfisa:msMetalProductFilters', JSON.stringify(msMetalProductFilters));
        localStorage.setItem('@metalfisa:msMetalProductFilters', JSON.stringify(msMetalProductFilters));
    }, [msMetalProductFilters]);

    React.useEffect(() => {
        sessionStorage.setItem('@metalfisa:orderFilters', JSON.stringify(orderFilters));
    }, [orderFilters]);

    // Métodos auxiliares para atualizar parcialmente
    const updateProductFilters = (newFilters) => {
        setProductFilters(prev => ({ ...prev, ...newFilters }));
    };

    const updateMSMetalProductFilters = (newFilters) => {
        setMSMetalProductFilters(prev => ({ ...prev, ...newFilters }));
    };

    const resetMSMetalProductFilters = () => {
        const defaultState = {
            search: '',
            code: '',
            client_code: '',
            client_name: '',
            has_bom: '',
            protheus_status: '',
            page: 1
        };
        setMSMetalProductFilters(defaultState);
        sessionStorage.setItem('@metalfisa:msMetalProductFilters', JSON.stringify(defaultState));
        localStorage.setItem('@metalfisa:msMetalProductFilters', JSON.stringify(defaultState));
    };

    const updateOrderFilters = (newFilters) => {
        setOrderFilters(prev => ({ ...prev, ...newFilters }));
    };

    return (
        <FilterContext.Provider value={{
            productFilters,
            updateProductFilters,
            msMetalProductFilters,
            updateMSMetalProductFilters,
            resetMSMetalProductFilters,
            orderFilters,
            updateOrderFilters
        }}>
            {children}
        </FilterContext.Provider>
    );
};

export const useFilters = () => {
    const context = useContext(FilterContext);
    if (!context) {
        throw new Error('useFilters deve ser usado dentro de um FilterProvider');
    }
    return context;
};
