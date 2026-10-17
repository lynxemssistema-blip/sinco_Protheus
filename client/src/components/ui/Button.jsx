import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Componente Padronizado de Botão (Texto / Ícone + Texto)
 * Adere estritamente ao Design System Lynx Deep Forest Green
 */
export const Button = React.forwardRef(({
    children,
    variant = 'primary',
    size = 'md',
    icon: Icon,
    iconRight: IconRight,
    loading = false,
    disabled = false,
    className = '',
    type = 'button',
    ...props
}, ref) => {
    // Variantes de cores do Design System Lynx
    const variantClasses = {
        primary: 'bg-[#425750] hover:bg-[#32423D] active:bg-[#23302C] text-white border border-[#425750] shadow-xs',
        cta: 'bg-[#E0E800] hover:bg-[#c9d000] active:bg-[#b5bc00] text-[#1E2825] font-black shadow-xs border border-[#E0E800]',
        secondary: 'bg-[#24312D] hover:bg-[#2D3C37] active:bg-[#1E2825] text-slate-100 border border-[#425750]/60 shadow-2xs',
        ghost: 'bg-transparent hover:bg-[#2D3C37]/50 active:bg-[#2D3C37] text-slate-300 hover:text-white',
        danger: 'bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/30 active:bg-red-600',
        outline: 'bg-transparent border border-[#425750] text-[#8E9F97] hover:text-white hover:bg-[#425750]/20 active:bg-[#425750]/30',
        light: 'bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-700 border border-gray-200 shadow-2xs'
    };

    // Alturas e paddings padronizados
    const sizeClasses = {
        sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
        md: 'h-9 px-4 text-xs sm:text-sm font-semibold gap-2 rounded-xl',
        lg: 'h-11 px-6 text-sm font-extrabold gap-2.5 rounded-xl shadow-md'
    };

    const isInteractionDisabled = disabled || loading;

    return (
        <button
            ref={ref}
            type={type}
            disabled={isInteractionDisabled}
            className={`
                inline-flex items-center justify-center shrink-0 select-none
                transition-all duration-150 active:scale-[0.98]
                disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none disabled:active:scale-100
                ${variantClasses[variant] || variantClasses.primary}
                ${sizeClasses[size] || sizeClasses.md}
                ${className}
            `}
            {...props}
        >
            {loading ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0 text-current" />
            ) : (
                Icon && <Icon className="w-4 h-4 shrink-0" />
            )}
            {children && <span>{children}</span>}
            {!loading && IconRight && <IconRight className="w-4 h-4 shrink-0" />}
        </button>
    );
});

Button.displayName = 'Button';

/**
 * Componente Padronizado de Botão Somente de Ícone (Action Icon Button)
 * Garante touch targets mínimos para chão de fábrica e acessibilidade obrigatória.
 */
export const IconButton = React.forwardRef(({
    icon: Icon,
    title,
    ariaLabel,
    variant = 'ghost',
    size = 'md',
    disabled = false,
    loading = false,
    className = '',
    type = 'button',
    ...props
}, ref) => {
    // Fallback de acessibilidade: nunca permitir botão sem title/aria-label
    const effectiveTitle = title || ariaLabel || 'Ação';
    const effectiveAriaLabel = ariaLabel || title || 'Ação';

    const variantClasses = {
        ghost: 'text-slate-400 hover:text-white hover:bg-[#2D3C37] active:bg-[#1E2825]',
        secondary: 'bg-[#24312D] text-slate-200 border border-[#425750]/60 hover:bg-[#2D3C37] hover:text-white',
        primary: 'bg-[#425750] text-white hover:bg-[#32423D] border border-[#425750]',
        cta: 'bg-[#E0E800] text-[#1E2825] hover:bg-[#c9d000] border border-[#E0E800]',
        danger: 'text-red-400 hover:text-white hover:bg-red-500/20 active:bg-red-500 border border-transparent hover:border-red-500/30',
        light: 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200 bg-white'
    };

    // Dimensões com touch-target ergonômico (mínimo 32x32)
    const sizeClasses = {
        sm: 'w-8 h-8 p-1.5 rounded-lg',
        md: 'w-9 h-9 p-2 rounded-xl',
        lg: 'w-11 h-11 p-2.5 rounded-xl shadow-md'
    };

    const iconSizes = {
        sm: 16,
        md: 18,
        lg: 22
    };

    const isInteractionDisabled = disabled || loading;

    return (
        <button
            ref={ref}
            type={type}
            title={effectiveTitle}
            aria-label={effectiveAriaLabel}
            disabled={isInteractionDisabled}
            className={`
                inline-flex items-center justify-center shrink-0 select-none
                transition-all duration-150 active:scale-95
                disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none disabled:active:scale-100
                ${variantClasses[variant] || variantClasses.ghost}
                ${sizeClasses[size] || sizeClasses.md}
                ${className}
            `}
            {...props}
        >
            {loading ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0 text-current" />
            ) : (
                Icon && <Icon size={iconSizes[size] || 18} className="shrink-0" />
            )}
        </button>
    );
});

IconButton.displayName = 'IconButton';

export default Button;
