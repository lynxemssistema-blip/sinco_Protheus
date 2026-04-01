import * as XLSX from 'xlsx';

export const generateFaturamentosExcel = (solicitacoesList, customFileName = null) => {
    if (!solicitacoesList || solicitacoesList.length === 0) return;

    const rows = [];
    
    solicitacoesList.forEach(sol => {
        if (!sol.itens || sol.itens.length === 0) return;
        
        sol.itens.forEach(it => {
            const fmtDate = (d) => {
                if (!d) return '-';
                try { return new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' }); } catch { return '-'; }
            };
            rows.push({
                'Faturamento Origem': sol.numero_solicitacao,
                'Status Fat.': sol.status,
                'Nota Fiscal': sol.nota_fiscal || '-',
                'Data Solicitação': sol.created_at ? new Date(sol.created_at).toLocaleString('pt-BR') : '',
                'Solicitante': sol.usuario || '',
                'Cliente': it.nome_cliente || '-',
                'Pedido MetalFisa': it.pedido,
                'Item': it.item,
                'Cód. Produto': it.codigo_produto,
                'Qtd. Solicitada': Number(it.quantidade_solicitada) || 0,
                'Pedido Cliente': it.pedido_cliente || '-',
                'Desenho Cliente': it.desenho_cliente || '-',
                'Dt. Entrega PCP': fmtDate(it.pcp_data_entrega),
                'Série Cliente': it.pcp_serie_cliente || '-',
                'Série MetalFisa': it.pcp_serie_metalfisa || '-',
                'Nº Série': it.pcp_numero_serie || '-',
                'Lote': it.pcp_lote || '-',
                'Nº Lote': it.pcp_numero_lote || '-',
            });
        });
    });

    if (rows.length === 0) {
        alert('Nenhum item válido encontrado nestas solicitações para exportação.');
        return;
    }

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Itens Faturados');

    // Auto-size columns slightly
    const colWidths = [
         { wch: 22 }, // Faturamento Origem
         { wch: 15 }, // Status Fat.
         { wch: 18 }, // Nota Fiscal
         { wch: 20 }, // Data Solicitação
         { wch: 18 }, // Solicitante
         { wch: 40 }, // Cliente
         { wch: 18 }, // Pedido MetalFisa
         { wch: 8 },  // Item
         { wch: 25 }, // Cód. Produto
         { wch: 18 }, // Qtd. Solicitada
         { wch: 20 }, // Pedido Cliente
         { wch: 25 }, // Desenho Cliente
         { wch: 16 }, // Dt. Entrega PCP
         { wch: 18 }, // Série Cliente
         { wch: 18 }, // Série MetalFisa
         { wch: 20 }, // Nº Série
         { wch: 15 }, // Lote
         { wch: 18 }, // Nº Lote
    ];
    worksheet['!cols'] = colWidths;

    let fileName = customFileName;
    if (!fileName) {
        const isSingle = solicitacoesList.length === 1;
        fileName = isSingle 
            ? `Faturamento_${solicitacoesList[0].numero_solicitacao}.xlsx`
            : `Faturamentos_Lote_${solicitacoesList.length}_registros.xlsx`;
    }

    XLSX.writeFile(workbook, fileName);
};

export default generateFaturamentosExcel;
