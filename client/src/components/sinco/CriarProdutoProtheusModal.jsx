import React from 'react';
import ModalCadastroProduto from '../produtos/ModalCadastroProduto';

/**
 * Componente unificado de Cadastro de Produto no SINCO / Solid Edge
 * Padronizado 100% de acordo com o design oficial (Imagem 2) com suporte total a decimais,
 * amarração oficial Empresa x Cliente (SZ1010) e prefixo automático.
 */
export default function CriarProdutoProtheusModal({ isOpen, onClose, item, onSuccess, isSinco = false }) {
    if (!isOpen) return null;

    const isCadastroSinco = Boolean(
        isSinco ||
        item?.is_sinco || 
        item?.badge === 'CADASTRO SINCO' || 
        item?.badge === 'CADASTRO SOLID EDGE'
    );

    return (
        <ModalCadastroProduto
            isOpen={isOpen}
            onClose={onClose}
            isEditing={false}
            initialData={item ? { ...item, is_sinco: isCadastroSinco } : null}
            onSuccess={onSuccess}
            isSinco={isCadastroSinco}
        />
    );
}
