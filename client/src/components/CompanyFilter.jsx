import React, { useState, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import api from '../services/api';

const CompanyFilter = ({ selectedFiliais, onChange, defaultAll = true }) => {
    const [empresas, setEmpresas] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchEmpresas = async () => {
            try {
                const { data } = await api.get('/financeiro/empresas');
                const filtradas = data.filter(e => e.id !== '01');
                setEmpresas(filtradas);
                
                if (defaultAll && selectedFiliais.length === 0) {
                    onChange(filtradas.map(e => e.id));
                }
            } catch (err) {
                console.error("Erro ao carregar empresas:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchEmpresas();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const toggleSelection = (id) => {
        const newSelection = selectedFiliais.includes(id)
            ? selectedFiliais.filter(f => f !== id)
            : [...selectedFiliais, id];
        
        onChange(newSelection);
    };

    const toggleAll = () => {
        if (selectedFiliais.length === empresas.length) {
            // Se todas já estavam marcadas, desmarca todas (não faz sentido não ver nada, mas ok)
            onChange([]);
        } else {
            // Marca todas
            onChange(empresas.map(e => e.id));
        }
    };

    if (loading) {
        return <div className="h-10 px-4 bg-slate-100 rounded-lg animate-pulse flex items-center min-w-[200px]">Carregando empresas...</div>;
    }

    const allSelected = selectedFiliais.length === empresas.length && empresas.length > 0;
    const isIndeterminate = selectedFiliais.length > 0 && selectedFiliais.length < empresas.length;

    return (
        <div className="relative z-20">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="h-10 px-4 bg-white border border-slate-300 rounded-lg flex items-center justify-between gap-2 min-w-[250px] shadow-sm hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            >
                <span className="text-sm font-medium text-slate-700 truncate">
                    {allSelected 
                        ? 'Todas as Empresas' 
                        : selectedFiliais.length === 0 
                            ? 'Nenhuma selecionada' 
                            : `${selectedFiliais.length} empresa(s) selecionada(s)`}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <>
                    <div 
                        className="fixed inset-0 z-10"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute top-full left-0 mt-2 w-[350px] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-20">
                        <div className="p-3 border-b border-slate-100 bg-slate-50">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div className="relative flex items-center justify-center">
                                    <input 
                                        type="checkbox" 
                                        className="peer sr-only"
                                        checked={allSelected}
                                        onChange={toggleAll}
                                        ref={input => {
                                            if (input) input.indeterminate = isIndeterminate;
                                        }}
                                    />
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors
                                        ${allSelected || isIndeterminate ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white group-hover:border-blue-500'}`}
                                    >
                                        {(allSelected || isIndeterminate) && <Check className="w-3.5 h-3.5 text-white" />}
                                    </div>
                                </div>
                                <span className="text-sm font-bold text-slate-800">
                                    Visão Consolidada Total
                                </span>
                            </label>
                        </div>
                        
                        <div className="max-h-[300px] overflow-y-auto p-2">
                            {empresas.map((emp) => (
                                <label 
                                    key={emp.id} 
                                    className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer group transition-colors"
                                >
                                    <div className="relative flex items-center justify-center">
                                        <input 
                                            type="checkbox" 
                                            className="peer sr-only"
                                            checked={selectedFiliais.includes(emp.id)}
                                            onChange={() => toggleSelection(emp.id)}
                                        />
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors
                                            ${selectedFiliais.includes(emp.id) ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white group-hover:border-blue-500'}`}
                                        >
                                            {selectedFiliais.includes(emp.id) && <Check className="w-3.5 h-3.5 text-white" />}
                                        </div>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-semibold text-slate-700">{emp.nome}</span>
                                        <span className="text-xs text-slate-500">{emp.razao_social}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default CompanyFilter;
