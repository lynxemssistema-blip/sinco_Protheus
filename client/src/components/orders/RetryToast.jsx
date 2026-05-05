import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

/**
 * RetryToast — shown when the system is auto-retrying after a 500 error.
 * Displays attempt number and delay countdown hint.
 */
const RetryToast = ({ retryInfo }) => {
    if (!retryInfo) return null;
    const { attempt, maxRetries, delayMs } = retryInfo;
    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] animate-fadeIn">
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-300 text-amber-800 rounded-xl px-5 py-3 shadow-xl">
                <RefreshCw className="h-5 w-5 animate-spin flex-shrink-0 text-amber-600" />
                <div>
                    <p className="font-semibold text-sm">Servidor ocupado. Reconectando automaticamente...</p>
                    <p className="text-xs text-amber-600 mt-0.5">
                        Tentativa {attempt} de {maxRetries} • aguardando {delayMs / 1000}s
                    </p>
                </div>
            </div>
        </div>
    );
};

export default RetryToast;
