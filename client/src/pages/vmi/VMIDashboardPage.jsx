import React from 'react';
import { Target, Clock } from 'lucide-react';

const VMIDashboardPage = () => {
    return (
        <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mb-4">
                <Target className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Visão de Entrega</h1>
            <p className="text-slate-500 max-w-md mb-6">
                Status de entrega por pedido e por semana. Confronto entre a demanda do cliente
                e a capacidade real de entrega da Lynx.
            </p>
            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-4 py-2 rounded-full">
                <Clock className="w-4 h-4" />
                <span>Módulo em desenvolvimento</span>
            </div>
        </div>
    );
};

export default VMIDashboardPage;
