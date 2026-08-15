require('dotenv').config({ path: 'c:/Users/lynx/Documents/MetalFisa Anty/server/.env' });
const express = require('express');
const router = require('../routes/pedidos');

// Mock request and response
const req = {
    query: {
        pedido: '004618',
        only_active: 'false',
        tipo_item: '',
        limit: '50',
        page: '1'
    },
    // Mock user with permissions to avoid auth errors
    user: {
        login: 'test',
        nome: 'Test User',
        permissoes: ['valores_financeiros']
    }
};

const res = {
    json: function(data) {
        console.log('\n--- API RESPONSE ---');
        console.log('Total items in response:', data.data?.length);
        console.log('Has next page:', data.meta?.hasNextPage);
        console.log('Meta:', data.meta);
        
        if (data.data && data.data.length > 0) {
            console.log('\nFirst 15 items in response:');
            data.data.slice(0, 15).forEach((item, idx) => {
                console.log(`${idx + 1}. Item: ${item.item} | Prod: ${item.codigo} | Qtd: ${item.quantidade} | Saldo: ${item.qtd_faturar} | Priority: ${item.op_prioridade} | OP: ${item.op_num}`);
            });
            
            console.log('\nChecking all items with notes:');
            let foundNotes = false;
            data.data.forEach((item) => {
                if (item.engineering_start_date || item.designer_name) {
                    console.log(`- Item: ${item.item} | Prod: ${item.codigo} | Date: ${item.engineering_start_date} | Designer: ${item.designer_name}`);
                    foundNotes = true;
                }
            });
            if (!foundNotes) {
                console.log('No items found with non-null notes in this response.');
            }
            
            // Search for Item 01
            const item01 = data.data.find(i => i.item === '01');
            console.log('\nIs Item 01 in response?', item01 ? 'YES' : 'NO');
            if (item01) {
                console.log('Item 01 Details:', JSON.stringify(item01, null, 2));
            }
        }
        process.exit(0);
    },
    status: function(code) {
        console.log('HTTP Status Code:', code);
        return this;
    }
};

// Find the handler for GET /flat
const route = router.stack.find(s => s.route && s.route.path === '/flat');
if (!route) {
    console.error('Route /flat not found in router stack!');
    process.exit(1);
}

const handler = route.route.stack[route.route.stack.length - 1].handle;

console.log('Calling GET /flat handler directly...');
handler(req, res).catch(err => {
    console.error('Handler threw error:', err);
    process.exit(1);
});
