// FIX (IA): Refatoracao de dados do relatorio para a nova arquitetura
import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import { toast } from 'react-toastify';
import { AlertCircle, Calendar } from 'lucide-react';

/**
 * Converte data ISO (YYYY-MM-DD) ou YYYYMMDD para padrão brasileiro (DD/MM/AAAA)
 */
export const toBrazilianDate = (isoDate) => {
    if (!isoDate) return '';
    const clean = String(isoDate).trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
        const [y, m, d] = clean.split('-');
        return `${d}/${m}/${y}`;
    }
    if (/^\d{8}$/.test(clean)) {
        return `${clean.slice(6, 8)}/${clean.slice(4, 6)}/${clean.slice(0, 4)}`;
    }
    return clean;
};

/**
 * Converte data no padrão brasileiro (DD/MM/AAAA) para ISO (YYYY-MM-DD)
 */
export const fromBrazilianDate = (brDate) => {
    if (!brDate) return '';
    const clean = String(brDate).trim();
    const parts = clean.split('/');
    if (parts.length === 3 && parts[2].length === 4) {
        const [d, m, y] = parts;
        const day = parseInt(d, 10);
        const month = parseInt(m, 10);
        const year = parseInt(y, 10);
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
    }
    return '';
};

export const BillingForecastInput = ({ item, user, onUpdateSuccess, canEdit = true }) => {
    const nativePickerRef = useRef(null);

    // Delivery date fallback in YYYY-MM-DD
    const getFallbackDate = () => {
        if (!item.entrega) return '';
        if (item.entrega.includes('-')) return item.entrega;
        return item.entrega.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
    };

    const getInitialIsoValue = () => {
        if (item.data_prevista_faturamento) {
            return item.data_prevista_faturamento.slice(0, 10);
        }
        return '';
    };

    const [isoValue, setIsoValue] = useState(getInitialIsoValue());
    const isFallback = !item.data_prevista_faturamento;
    const activeIsoDate = isFallback ? getFallbackDate() : isoValue;

    // Estado do texto exibido no padrão brasileiro DD/MM/AAAA
    const [brText, setBrText] = useState(toBrazilianDate(activeIsoDate));
    const [isSaving, setIsSaving] = useState(false);

    // Sincroniza com mudanças de props externas
    useEffect(() => {
        const initial = getInitialIsoValue();
        setIsoValue(initial);
        const effectiveIso = initial || getFallbackDate();
        setBrText(toBrazilianDate(effectiveIso));
    }, [item.data_prevista_faturamento, item.entrega]);

    // Salva data ISO no backend
    const saveIsoDate = async (newIso) => {
        setIsSaving(true);
        try {
            const fallbackDate = getFallbackDate();
            const payload = {
                id: item.pcp_delivery_forecast_id,
                pedido: item.pedido,
                item: item.item,
                data_prevista_faturamento: newIso || null,
                data_entrega_pcp: item.pcp_delivery_forecast_date || fallbackDate || new Date().toISOString().slice(0, 10),
                quantidade_pcp: item.pcp_delivery_forecast_qtd || parseFloat(item.quantidade || item.qtd_total_item || 1),
                usuario: user?.nome || user?.username || 'PCP'
            };

            const response = await api.patch('/pedidos/pcp-forecasts/faturamento', payload);
            if (response.data.success) {
                toast.success('Previsão de faturamento atualizada!');
                if (onUpdateSuccess) {
                    onUpdateSuccess(item.pedido, item.item, newIso || null, response.data.id);
                }
            }
        } catch (err) {
            console.error('Error saving billing forecast date:', err);
            toast.error('Erro ao salvar previsão de faturamento');
            // Reverter estado
            const rollbackIso = getInitialIsoValue() || getFallbackDate();
            setIsoValue(getInitialIsoValue());
            setBrText(toBrazilianDate(rollbackIso));
        } finally {
            setIsSaving(false);
        }
    };

    // Mudança vinda do picker nativo
    const handleNativePickerChange = (e) => {
        const selectedIso = e.target.value;
        if (!selectedIso) return;
        setIsoValue(selectedIso);
        setBrText(toBrazilianDate(selectedIso));
        saveIsoDate(selectedIso);
    };

    // Máscara e digitação direta no padrão brasileiro DD/MM/AAAA
    const handleTextChange = (e) => {
        let v = e.target.value.replace(/\D/g, '').slice(0, 8);
        if (v.length > 4) {
            v = `${v.slice(0, 2)}/${v.slice(2, 4)}/${v.slice(4)}`;
        } else if (v.length > 2) {
            v = `${v.slice(0, 2)}/${v.slice(2)}`;
        }
        setBrText(v);
    };

    // Ao perder o foco, valida e salva se mudou
    const handleTextBlur = () => {
        if (!brText || brText.trim() === '') {
            // Se limpou o campo
            if (isoValue) {
                setIsoValue('');
                saveIsoDate(null);
            }
            return;
        }

        const parsedIso = fromBrazilianDate(brText);
        if (parsedIso) {
            if (parsedIso !== isoValue) {
                setIsoValue(parsedIso);
                saveIsoDate(parsedIso);
            }
        } else {
            // Formato inválido: reverte para o anterior
            toast.warn('Data inválida. Use o formato DD/MM/AAAA.');
            setBrText(toBrazilianDate(activeIsoDate));
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.target.blur();
        }
    };

    const todayStr = new Date().toLocaleDateString('sv-SE');
    const isCompleted = parseFloat(item.qtd_faturar || 0) <= 0;
    const isOverdue = !isCompleted && activeIsoDate && activeIsoDate < todayStr;

    return (
        <div className="relative inline-flex items-center gap-1.5">
            {isOverdue && (
                <AlertCircle className="w-4 h-4 text-red-500 animate-pulse flex-shrink-0" title="Faturamento Atrasado!" />
            )}
            <div className="relative inline-flex items-center">
                {/* Input de texto com formatação brasileira DD/MM/AAAA */}
                <input
                    type="text"
                    value={brText}
                    onChange={handleTextChange}
                    onBlur={handleTextBlur}
                    onKeyDown={handleKeyDown}
                    disabled={!canEdit || isSaving}
                    placeholder="DD/MM/AAAA"
                    maxLength={10}
                    aria-label="Previsão de Faturamento (DD/MM/AAAA)"
                    className={`px-2 py-1 pr-6 text-xs text-center border rounded transition-all focus:ring-1 focus:ring-teal-500 outline-none w-[112px] font-mono ${
                        !canEdit ? 'bg-transparent text-gray-500 border-transparent cursor-default' :
                        isSaving ? 'opacity-50 cursor-wait' : 'cursor-text'
                    } ${
                        !canEdit ? '' :
                        isOverdue 
                            ? isFallback
                                ? 'text-red-500 font-normal italic border-dashed border-red-300 bg-red-50/20 hover:border-red-400' 
                                : 'text-red-800 font-semibold border-red-300 bg-red-50 hover:border-red-500'
                            : isFallback 
                                ? 'text-gray-400 font-normal italic border-dashed border-gray-200 bg-transparent hover:border-gray-300' 
                                : 'text-teal-800 font-semibold border-teal-200 bg-teal-50/50 hover:border-teal-400'
                    }`}
                    title={
                        !canEdit ? 'Previsão de Faturamento (Visualização)' :
                        isOverdue 
                            ? isFallback 
                                ? 'Alerta: Data de entrega vencida! Clique ou digite para alterar previsão de faturamento.' 
                                : 'Alerta: Previsão de faturamento vencida!' 
                            : isFallback 
                                ? 'Usando data de entrega (padrão). Clique no calendário ou digite para alterar.' 
                                : 'Previsão de faturamento definida (DD/MM/AAAA).'
                    }
                />

                {/* Ícone de Calendário para acionar o seletor visual nativo */}
                <button
                    type="button"
                    onClick={() => {
                        if (!canEdit || isSaving) return;
                        if (nativePickerRef.current?.showPicker) {
                            nativePickerRef.current.showPicker();
                        } else {
                            nativePickerRef.current?.focus();
                        }
                    }}
                    disabled={!canEdit || isSaving}
                    className="absolute right-1 text-gray-400 hover:text-teal-700 transition p-0.5 rounded cursor-pointer"
                    title="Selecionar no calendário"
                >
                    <Calendar className="w-3.5 h-3.5" />
                </button>

                {/* Input invisível type="date" para permitir abertura do calendário do navegador */}
                <input
                    ref={nativePickerRef}
                    type="date"
                    value={activeIsoDate || ''}
                    onChange={handleNativePickerChange}
                    tabIndex={-1}
                    aria-hidden="true"
                    className="sr-only pointer-events-none opacity-0 absolute w-0 h-0"
                />

                {isSaving && (
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none">
                        <span className="w-3 h-3 border-2 border-teal-500 border-t-transparent rounded-full animate-spin block"></span>
                    </div>
                )}
            </div>
        </div>
    );
};
