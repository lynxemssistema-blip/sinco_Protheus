import React, { useRef, useState, useEffect } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';

/**
 * DateInputBR — Input de Data com Padrão Brasileiro (dd/mm/aaaa)
 * 
 * - Apresenta visualmente e permite digitação no formato dd/mm/aaaa.
 * - Integra com o date-picker nativo ao clicar no ícone do calendário.
 * - Comunica com o estado React via formato ISO (yyyy-mm-dd), garantindo
 *   100% de compatibilidade com os filtros e requisições existentes.
 */
export default function DateInputBR({
    value = '',
    onChange,
    className = '',
    placeholder = 'dd/mm/aaaa',
    name,
    disabled = false,
    required = false,
    ...props
}) {
    const isoToBr = (iso) => {
        if (!iso) return '';
        const clean = String(iso).split('T')[0];
        const parts = clean.split('-');
        if (parts.length === 3 && parts[0].length === 4) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return iso;
    };

    const brToIso = (br) => {
        if (!br) return '';
        const parts = br.split('/');
        if (parts.length === 3 && parts[2].length === 4) {
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
        return '';
    };

    const [textVal, setTextVal] = useState(isoToBr(value));
    const hiddenDateRef = useRef(null);

    useEffect(() => {
        setTextVal(isoToBr(value));
    }, [value]);

    const handleTextChange = (e) => {
        let raw = e.target.value.replace(/\D/g, '').slice(0, 8);
        let masked = raw;
        if (raw.length > 2 && raw.length <= 4) {
            masked = `${raw.slice(0, 2)}/${raw.slice(2)}`;
        } else if (raw.length > 4) {
            masked = `${raw.slice(0, 2)}/${raw.slice(2, 4)}/${raw.slice(4, 8)}`;
        }
        setTextVal(masked);

        if (masked.length === 10) {
            const iso = brToIso(masked);
            if (onChange) {
                onChange({ target: { name, value: iso } });
            }
        } else if (masked.length === 0) {
            if (onChange) {
                onChange({ target: { name, value: '' } });
            }
        }
    };

    const handleNativeChange = (e) => {
        const iso = e.target.value;
        setTextVal(isoToBr(iso));
        if (onChange) {
            onChange({ target: { name, value: iso } });
        }
    };

    const handleCalendarClick = () => {
        if (hiddenDateRef.current) {
            if (typeof hiddenDateRef.current.showPicker === 'function') {
                hiddenDateRef.current.showPicker();
            } else {
                hiddenDateRef.current.focus();
                hiddenDateRef.current.click();
            }
        }
    };

    return (
        <div className={`relative flex items-center ${className}`}>
            <input
                type="text"
                value={textVal}
                onChange={handleTextChange}
                placeholder={placeholder}
                maxLength={10}
                disabled={disabled}
                required={required}
                className="w-full h-full pr-8 text-sm outline-none bg-transparent font-medium text-slate-700 placeholder:text-slate-400"
                {...props}
            />
            <button
                type="button"
                onClick={handleCalendarClick}
                disabled={disabled}
                tabIndex={-1}
                className="absolute right-2.5 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                title="Abrir calendário"
            >
                <CalendarIcon className="w-4 h-4" />
            </button>
            <input
                ref={hiddenDateRef}
                type="date"
                value={value ? String(value).split('T')[0] : ''}
                onChange={handleNativeChange}
                disabled={disabled}
                tabIndex={-1}
                className="absolute opacity-0 pointer-events-none w-0 h-0"
                aria-hidden="true"
            />
        </div>
    );
}
