import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function ErrorStateOverlay({ error, onRetry }) {
    if (!error) return null;
    return (
        <div className="px-6 pb-6">
            <div className="bg-red-50 border-l-4 border-red-500 rounded-r-lg p-6 shadow-sm flex items-start gap-4">
                <div className="bg-red-100 p-2 rounded-full mt-1">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-red-800 mb-1">Poxa, encontramos um problema técnico!</h3>
                    <p className="text-red-700 mb-3 text-sm leading-relaxed">
                        A sua consulta não pôde ser completada no momento. Mas não se preocupe, os detalhes técnicos ({error}) já foram reportados automaticamente e por e-mail para a nossa equipe de suporte analisar o ocorrido.
                    </p>
                    <p className="text-red-800 font-medium text-sm mb-4">
                        Por favor, aguarde alguns minutos e tente buscar novamente.
                    </p>
                    {onRetry && (
                        <button 
                            onClick={onRetry}
                            className="flex items-center gap-2 bg-red-100 hover:bg-red-200 text-red-800 px-4 py-2 rounded-lg font-bold text-sm transition-colors border border-red-200"
                        >
                            <RefreshCw className="w-4 h-4" /> Tentar Novamente
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
