import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Factory, ClipboardList, Menu } from 'lucide-react';

export default function MobileBottomNav({ onOpenMenu }) {
    const location = useLocation();

    const navItems = [
        {
            to: '/visao-geral',
            label: 'Início',
            icon: LayoutDashboard,
            exact: true
        },
        {
            to: '/erp/pedidos',
            label: 'Pedidos',
            icon: ShoppingCart
        },
        {
            to: '/pcp/visao-fabrica',
            label: 'PCP Fábrica',
            icon: Factory
        },
        {
            to: '/pcp/apontamento-vertical',
            label: 'Apontar',
            icon: ClipboardList
        }
    ];

    return (
        <nav
            aria-label="Navegação Principal Mobile"
            className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800/80 shadow-[0_-4px_16px_rgba(0,0,0,0.25)] print:hidden"
            style={{
                paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))'
            }}
        >
            <div className="flex items-center justify-around h-14 max-w-md mx-auto px-2">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.exact 
                        ? location.pathname === item.to 
                        : location.pathname.startsWith(item.to);

                    return (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={`flex flex-col items-center justify-center flex-1 min-h-[44px] py-1 transition-all rounded-lg active:scale-95 ${
                                isActive
                                    ? 'text-amber-400 font-semibold drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                            <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[64px]">
                                {item.label}
                            </span>
                        </NavLink>
                    );
                })}

                {/* Botão para abrir o menu lateral completo */}
                <button
                    type="button"
                    onClick={onOpenMenu}
                    aria-label="Abrir Menu Completo"
                    className="flex flex-col items-center justify-center flex-1 min-h-[44px] py-1 text-slate-400 hover:text-white transition-all rounded-lg active:scale-95"
                >
                    <div className="w-5 h-5 flex items-center justify-center">
                        <Menu className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] mt-0.5 tracking-tight">Menu</span>
                </button>
            </div>
        </nav>
    );
}
