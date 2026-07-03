import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { toast } from 'react-toastify';
import { AlertCircle } from 'lucide-react';

export const BillingForecastInput = ({ item, user, onUpdateSuccess, canEdit = true }) => {
    // Delivery date fallback in YYYY-MM-DD
    const getFallbackDate = () => {
        if (!item.entrega) return '';
        // If it's already YYYY-MM-DD (e.g. from sub-item date helper)
        if (item.entrega.includes('-')) return item.entrega;
        return item.entrega.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
    };

    const getInitialValue = () => {
        if (item.data_prevista_faturamento) {
            // Cut time part if any
            return item.data_prevista_faturamento.slice(0, 10);
        }
        return '';
    };

    const [value, setValue] = useState(getInitialValue());
    const [isSaving, setIsSaving] = useState(false);

    // Sync value with prop changes
    useEffect(() => {
        setValue(getInitialValue());
    }, [item.data_prevista_faturamento]);

    const handleChange = async (e) => {
        const newValue = e.target.value;
        setValue(newValue);
        setIsSaving(true);

        try {
            const fallbackDate = getFallbackDate();
            const payload = {
                id: item.pcp_delivery_forecast_id,
                pedido: item.pedido,
                item: item.item,
                data_prevista_faturamento: newValue || null,
                // fallback variables if inserting a new row
                data_entrega_pcp: item.pcp_delivery_forecast_date || fallbackDate || new Date().toISOString().slice(0, 10),
                quantidade_pcp: item.pcp_delivery_forecast_qtd || parseFloat(item.quantidade || item.qtd_total_item || 1),
                usuario: user?.nome || user?.username || 'PCP'
            };

            const response = await api.patch('/pedidos/pcp-forecasts/faturamento', payload);
            if (response.data.success) {
                toast.success('Previsão de faturamento atualizada!');
                if (onUpdateSuccess) {
                    onUpdateSuccess(item.pedido, item.item, newValue || null, response.data.id);
                }
            }
        } catch (err) {
            console.error('Error saving billing forecast date:', err);
            toast.error('Erro ao salvar previsão de faturamento');
            // Revert state
            setValue(getInitialValue());
        } finally {
            setIsSaving(false);
        }
    };

    const isFallback = !item.data_prevista_faturamento;
    const displayValue = isFallback ? getFallbackDate() : value;

    const todayStr = new Date().toLocaleDateString('sv-SE');
    const isCompleted = parseFloat(item.qtd_faturar || 0) <= 0;
    const isOverdue = !isCompleted && displayValue && displayValue < todayStr;

    return (
        <div className="relative inline-flex items-center gap-1.5">
            {isOverdue && (
                <AlertCircle className="w-4 h-4 text-red-500 animate-pulse flex-shrink-0" title="Faturamento Atrasado!" />
            )}
            <div className="relative inline-flex items-center">
                <input
                    type="date"
                    value={displayValue}
                    onChange={handleChange}
                    disabled={!canEdit || isSaving}
                    aria-label="Previsão de Faturamento"
                    className={`px-2 py-1 text-xs border rounded transition-all focus:ring-1 focus:ring-teal-500 outline-none w-[125px] ${
                        !canEdit ? 'bg-transparent text-gray-500 border-transparent cursor-default' :
                        isSaving ? 'opacity-50 cursor-wait' : 'cursor-pointer'
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
                                ? 'Alerta: Data de entrega vencida! Clique para alterar previsão de faturamento.' 
                                : 'Alerta: Previsão de faturamento vencida!' 
                            : isFallback 
                                ? 'Usando data de entrega (padrão). Clique para alterar.' 
                                : 'Previsão de faturamento definida.'
                    }
                />
                {isSaving && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                        <span className="w-3 h-3 border-2 border-teal-500 border-t-transparent rounded-full animate-spin block"></span>
                    </div>
                )}
            </div>
        </div>
    );
};
