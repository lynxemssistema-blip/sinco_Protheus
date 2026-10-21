import React, { useState, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';

import { HELP_CONTENT } from '../config/helpContent';
import { HelpContext } from './HelpContext';

const ROUTE_ALIASES = {
    '/settings': '/configuracoes',
    '/pedidos': '/visao-geral',
    '/pedidos-venda': '/visao-geral',
    '/saldos-estoque': '/estoque/saldos',
    '/estrutura': '/estrutura-produtos',
    '/estrutura-produto': '/estrutura-produtos',
    '/salas': '/salas-reuniao',
    '/portaria': '/portaria/gerencial',
    '/cadastros/basicos': '/cadastros/prefixos',
    '/sst/brigada/inspecao': '/sst/brigada/inspecao-rapida',
    '/sst/cipa/urna': '/sst/cipa'
};

export function HelpProvider({ children }) {
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);
    const [forcedPath, setForcedPath] = useState(null);
    const [isPinned, setIsPinned] = useState(() => {
        return localStorage.getItem('@Lynx:helpPinned') === 'true';
    });
    
    // SGQ Database State
    const [allModules, setAllModules] = useState([]);
    const [loadingHelp, setLoadingHelp] = useState(false);

    // Quando o usuário navega para uma nova rota, limpa qualquer caminho forçado anterior
    useEffect(() => {
        setForcedPath(null);
    }, [location.pathname]);

    const togglePin = useCallback(() => {
        setIsPinned(prev => {
            const newVal = !prev;
            localStorage.setItem('@Lynx:helpPinned', String(newVal));
            return newVal;
        });
    }, []);

    const fetchHelpData = useCallback(async () => {
        setLoadingHelp(true);
        try {
            const localModulesArr = Object.entries(HELP_CONTENT).map(([path, data], index) => ({
                id: `local_${index}`,
                route_path: path,
                path: path,
                ...data
            }));

            const token = localStorage.getItem('@LynxEMS:token') || localStorage.getItem('@Lynx:token');
            // If not logged in, we still want to show help from helpContent.js
            if (!token || token === 'undefined') {
                setAllModules(localModulesArr);
                return;
            }

            const res = await axios.get('/api/sgq/processos', {
                headers: { Authorization: `Bearer ${token}` }
            });

            const dbModules = Array.isArray(res?.data) ? res.data : [];
            const merged = [...localModulesArr];
            dbModules.forEach(dbMod => {
                if (dbMod && dbMod.route_path) {
                    const existingIndex = merged.findIndex(m => m.route_path === dbMod.route_path);
                    if (existingIndex >= 0) {
                        merged[existingIndex] = { ...merged[existingIndex], ...dbMod, path: dbMod.route_path };
                    } else {
                        merged.push({ ...dbMod, path: dbMod.route_path });
                    }
                }
            });

            setAllModules(merged);
        } catch (e) {
            console.warn('⚠️ Ajuda/SGQ não pôde ser carregada da API, usando local:', e.message);
            const localModulesArr = Object.entries(HELP_CONTENT).map(([path, data], index) => ({
                id: `local_${index}`,
                route_path: path,
                path: path,
                ...data
            }));
            setAllModules(localModulesArr);
        } finally {
            setLoadingHelp(false);
        }
    }, []);

    // Load globally on mount (useful for HelpCenter and Drawer)
    useEffect(() => {
        fetchHelpData();
    }, [fetchHelpData]);

    // Sincroniza estado visual global do HelpDrawer (classes CSS e variáveis de largura)
    useEffect(() => {
        const updateDrawerCssState = () => {
            const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
            if (isOpen && isDesktop) {
                document.documentElement.classList.add('help-drawer-open');
                document.documentElement.style.setProperty('--help-drawer-width', '420px');
            } else {
                document.documentElement.classList.remove('help-drawer-open');
                document.documentElement.style.setProperty('--help-drawer-width', '0px');
            }
        };

        updateDrawerCssState();
        window.addEventListener('resize', updateDrawerCssState);
        return () => {
            window.removeEventListener('resize', updateDrawerCssState);
            document.documentElement.classList.remove('help-drawer-open');
            document.documentElement.style.setProperty('--help-drawer-width', '0px');
        };
    }, [isOpen]);

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

    const getHelpByPath = useCallback((rawPathname) => {
        if (!rawPathname) return HELP_CONTENT['/'] || null;

        // Clean pathname (remove query string, hash, and trailing slash)
        let pathname = rawPathname.split('?')[0].split('#')[0];
        if (pathname.length > 1 && pathname.endsWith('/')) {
            pathname = pathname.slice(0, -1);
        }

        // Apply route alias if present
        if (ROUTE_ALIASES[pathname]) {
            pathname = ROUTE_ALIASES[pathname];
        }

        // 1. Exact match in allModules (SGQ Database)
        if (allModules && allModules.length > 0) {
            const exact = allModules.find(m => m.route_path === pathname || m.path === pathname);
            if (exact) return exact;
        }

        // 2. Exact match in static HELP_CONTENT
        if (HELP_CONTENT[pathname]) {
            return HELP_CONTENT[pathname];
        }

        // 3. Dynamic route regex matching
        const dynamicPatterns = [
            { regex: /^\/estrutura\/.+$/, key: '/estrutura/:codigo' },
            { regex: /^\/bom\/.+$/, key: '/bom-generator' },
            { regex: /^\/fornecedor\/romaneio\/.+$/, key: '/fornecedor/romaneios' },
            { regex: /^\/producao\/op\/.+$/, key: '/producao/op' },
            { regex: /^\/portal-cliente\/tablet.*$/, key: '/portal-cliente/tablet' },
            { regex: /^\/suprimentos\/espelho-nf.*$/, key: '/suprimentos/espelho-nf' },
        ];

        for (const pattern of dynamicPatterns) {
            if (pattern.regex.test(pathname)) {
                const found = (allModules && allModules.find(m => m.route_path === pattern.key || m.path === pattern.key)) || HELP_CONTENT[pattern.key];
                if (found) return found;
            }
        }

        // 4. Se for raiz exata '/', retorna Dashboard Principal
        if (pathname === '/' || pathname === '') {
            return HELP_CONTENT['/'] || Object.values(HELP_CONTENT)[0];
        }

        // 5. Fallback contextual dinâmico inteligente (ao invés de Dashboard Principal)
        const pathSegments = pathname.split('/').filter(Boolean);
        const segmentName = pathSegments[pathSegments.length - 1] || 'modulo';
        const formattedTitle = segmentName
            .replace(/-/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());

        return {
            category: pathSegments[0]?.toUpperCase() || 'Módulo',
            categoryColor: '#425750',
            title: `Ajuda: ${formattedTitle}`,
            icon: 'HelpCircle',
            description: `Orientações e instruções de operação para a tela ${formattedTitle} (${pathname}).`,
            tabs: [
                {
                    id: 'visao_geral',
                    label: 'Visão Geral',
                    description: `Informações de uso para ${formattedTitle}.`,
                    steps: [
                        `Esta tela permite visualizar e gerenciar os dados de ${formattedTitle}.`,
                        'Utilize os botões de ação e filtros no topo da página para refinar os resultados.',
                        'Para dúvidas adicionais ou sugestões de documentação, acione a Central de Suporte.'
                    ]
                }
            ],
            tips: [
                'Você pode fixar este menu de ajuda clicando no ícone de pino no canto superior.',
                'Use os atalhos de teclado e filtros para agilizar o fluxo operacional.'
            ],
            links: [
                { path: '/', label: 'Página Inicial' },
                { path: '/ajuda', label: 'Central de Ajuda SGQ' }
            ]
        };
    }, [allModules]);

    return (
        <HelpContext.Provider value={{ 
            isOpen, forcedPath, setForcedPath, openHelp, closeHelp, toggleHelp, isPinned, togglePin,
            allModules, loadingHelp, fetchHelpData, getHelpByPath
        }}>
            {children}
        </HelpContext.Provider>
    );
}

