import * as XLSX from 'xlsx';
import { toast } from 'react-toastify';

export const exportFaturamentoHistoricoExcel = (viewMode, rows, includeValues = true) => {
    try {
        if (!rows || rows.length === 0) {
            toast.warning('Nenhum dado para exportar.');
            return;
        }

        const itemsList = [];

        if (viewMode === 'tabela') {
            rows.forEach(r => {
                const item = {
                    'Data Emissão': r.emissao,
                    'NF': `${r.nota}${r.serie ? ` S.${r.serie}` : ''}`,
                    'Cliente': r.cliente,
                    'Pedido': r.pedido,
                    'Cód. Produto': r.codigo_produto,
                    'Quantidade': parseFloat(r.quantidade) || 0,
                };
                if (includeValues) {
                    item['Valor Total'] = parseFloat(r.valor_total) || 0;
                }
                item['Status'] = r.status;
                itemsList.push(item);
            });
        } else if (viewMode === 'tabela_solicitacoes') {
            rows.forEach(r => {
                const item = {
                    'Número Solicit.': r.numero_solicitacao,
                    'Data Criação': r.emissao,
                    'Clientes': r.clientes,
                    'NFs': r.nfs || '-',
                    'Cód. Produtos': r.codigos || '-',
                    'Total Itens': r.total_itens || 0,
                };
                if (includeValues) {
                    item['Valor Total'] = parseFloat(r.valor_total) || 0;
                }
                item['Status'] = r.status;
                itemsList.push(item);
            });
        } else {
            // tabela_produtos
            rows.forEach(r => {
                const item = {
                    'Cód. Produto': r.codigo_produto,
                    'Qtd Total': parseFloat(r.quantidade) || 0,
                };
                if (includeValues) {
                    item['Valor Total'] = parseFloat(r.valor_total) || 0;
                }
                item['Pedidos'] = r.pedidos;
                item['NFs'] = r.notas;
                item['Clientes'] = r.clientes;
                item['Datas Emissão'] = r.emissao;
                itemsList.push(item);
            });
        }

        const worksheet = XLSX.utils.json_to_sheet(itemsList);
        const workbook = XLSX.utils.book_new();

        // Auto-size columns loosely
        const wscols = Object.keys(itemsList[0] || {}).map(key => ({ wch: Math.max(15, key.length + 5) }));
        worksheet['!cols'] = wscols;

        let sheetName = 'Historico_Faturamento';
        if (viewMode === 'tabela_solicitacoes') sheetName = 'Solicitacoes';
        if (viewMode === 'tabela_produtos') sheetName = 'Agrupado_Produto';

        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

        const fileName = `${sheetName}_${new Date().getTime()}.xlsx`;
        XLSX.writeFile(workbook, fileName);
        
        toast.success('Excel exportado com sucesso!');
    } catch (err) {
        console.error('Erro ao exportar excel historico:', err);
        toast.error('Erro ao exportar para Excel.');
    }
};
