import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * CadastrosBasicosPage (Legado / Compatibilidade)
 * Redireciona com segurança para a nova estrutura modular (/cadastros/prefixos)
 */
export default function CadastrosBasicosPage() {
    return <Navigate to="/cadastros/prefixos" replace />;
}
