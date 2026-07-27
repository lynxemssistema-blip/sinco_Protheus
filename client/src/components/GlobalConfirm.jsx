import React, { useState, useEffect } from 'react';
import ConfirmModal from './ConfirmModal';

let globalConfirmFn = null;

export const confirmApp = (options) => {
    return new Promise((resolve) => {
        if (globalConfirmFn) {
            globalConfirmFn({ ...options, resolve });
        } else {
            console.error("GlobalConfirm não está montado no DOM!");
            resolve(false);
        }
    });
};

export const alertApp = (message, title = "Atenção") => {
    return confirmApp({
        title,
        message,
        confirmText: "OK",
        cancelText: "", // Hide cancel button
        danger: false
    });
};

export default function GlobalConfirmProvider() {
    const [state, setState] = useState({
        isOpen: false,
        title: '',
        message: '',
        confirmText: 'Confirmar',
        cancelText: 'Cancelar',
        danger: true,
        resolve: null
    });

    useEffect(() => {
        globalConfirmFn = (options) => {
            setState({
                isOpen: true,
                title: options.title || 'Confirmação',
                message: options.message || '',
                confirmText: options.confirmText || 'Confirmar',
                cancelText: options.cancelText !== undefined ? options.cancelText : 'Cancelar',
                danger: options.danger !== undefined ? options.danger : true,
                resolve: options.resolve
            });
        };
    }, []);

    const handleConfirm = () => {
        if (state.resolve) state.resolve(true);
        setState(s => ({ ...s, isOpen: false }));
    };

    const handleClose = () => {
        if (state.resolve) state.resolve(false);
        setState(s => ({ ...s, isOpen: false }));
    };

    if (!state.isOpen) return null;

    return (
        <ConfirmModal 
            isOpen={state.isOpen}
            onClose={handleClose}
            onConfirm={handleConfirm}
            title={state.title}
            message={state.message}
            confirmText={state.confirmText}
            cancelText={state.cancelText}
            danger={state.danger}
        />
    );
}
