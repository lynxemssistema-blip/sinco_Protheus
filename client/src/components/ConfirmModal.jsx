import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirmar', cancelText = 'Cancelar', danger = true }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
            
            {/* Modal */}
            <div className="relative bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-5">
                    <div className="flex items-start gap-4">
                        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${danger ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div className="flex-1 pt-1">
                            <h3 className="text-lg font-bold text-slate-800">{title}</h3>
                            <p className="text-sm text-slate-500 mt-1 leading-relaxed whitespace-pre-wrap">{message}</p>
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>
                
                <div className="bg-slate-50 px-5 py-4 flex flex-row-reverse gap-3">
                    <button 
                        onClick={() => { onConfirm(); onClose(); }}
                        className={`px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all active:scale-95 ${
                            danger
                            ? 'bg-red-600 text-white hover:bg-red-700 hover:shadow-red-200'
                            : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-blue-200'
                        }`}
                    >
                        {confirmText}
                    </button>
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-800 transition-all active:scale-95"
                    >
                        {cancelText}
                    </button>
                </div>
            </div>
        </div>
    );
}
