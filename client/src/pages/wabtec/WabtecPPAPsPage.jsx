import React from 'react';
import OrdersTable from '../../components/OrdersTable';
import { Award, Layers } from 'lucide-react';

export default function WabtecPPAPsPage() {
    return (
        <div className="w-full">
            <OrdersTable 
                pageTitle="Gestão de PPAP's" 
                pageSubtitle="Painel dedicado para acompanhamento de todos os pedidos e itens com classificação PPAP."
                fixedClassificacao="PPAP,Jits e PPAP"
            />
        </div>
    );
}
