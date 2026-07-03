const axios = require('axios');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function exportVMI() {
    console.log('Iniciando exportacao VMI...');
    let page = 1;
    let limit = 200;
    let hasMore = true;
    let allOrders = [];

    const token = jwt.sign({ idUsuario: 1, Login: 'admin', TipoUsuario: 'ADMIN' }, process.env.JWT_SECRET || 'metalfisasecuritykey2026', { expiresIn: '1h' });

    while(hasMore) {
        console.log('Buscando pagina ' + page + '...');
        let success = false;
        let retries = 0;
        
        while(!success && retries < 5) {
            try {
                const res = await axios.get('http://localhost:3002/api/pcp-refinado/cronograma', {
                    params: { cliente: 'VMI', page, limit, only_active: 'true' },
                    headers: { Authorization: `Bearer ${token}` }
                });
                
                const payload = res.data;
                const data = payload.data || [];
                allOrders.push(...data);

                const meta = payload.meta || { total: data.length, page: 1, limit };
                if (meta.page * meta.limit >= meta.total || data.length === 0) {
                    hasMore = false;
                } else {
                    page++;
                }
                success = true;
            } catch(e) {
                console.log(`Erro na pagina ${page}, tentando novamente em 2s (Tentativa ${retries+1}/5)`);
                retries++;
                await new Promise(r => setTimeout(r, 2000));
            }
        }
        if(!success) {
            console.error('Falha ao processar pagina ' + page + '. Abortando.');
            break;
        }
    }

    console.log('Encontrados ' + allOrders.length + ' pedidos da VMI.');

    const itemsList = [];
    allOrders.forEach(p => {
        (p.itens || []).forEach(it => {
            itemsList.push({
                'Pedido': p.pedido,
                'Cliente': p.cliente || 'VMI',
                'Emissao': p.data_emissao,
                'Ref. Cliente': it.ref_cliente || '-',
                'PC': it.pedido_cliente || '-',
                'OP': (it.ops && it.ops.length > 0) ? it.ops.map(o => o.op_raw).filter(Boolean).join(', ') : '-',
                'Produto': it.produto,
                'Descricao': it.descricao,
                'Qtd. Vendida': Number(it.qtd_vendida) || 0,
                'Qtd. Faturada': Number(it.qtd_faturada) || 0,
                'Saldo a Faturar': Math.max(0, (Number(it.qtd_vendida) || 0) - (Number(it.qtd_faturada) || 0)),
                'Entrega Comercial': it.data_entrega,
                'Dt. PCP': it.data_entrega_pcp,
                'Previsao Faturamento': it.data_prevista_faturamento,
                'Progresso': (it.progresso_agregado || 0) + '%',
                'Status Geral': it.progresso_agregado === 100 ? 'Concluido' : 'Pendente'
            });
        });
    });

    const ws = xlsx.utils.json_to_sheet(itemsList);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'VMI');

    const filePath = path.join('C:', 'Users', 'lynx', 'Desktop', 'Cronograma_VMI.xlsx');
    xlsx.writeFile(wb, filePath);
    console.log('Arquivo salvo em: ' + filePath);
}

exportVMI().catch(console.error);
