const axios = require('axios');

const API_URL = 'http://localhost:3000/api';
const TEST_PEDIDO = 'TEST_BOM';
const TEST_ITEM = '0001';

async function testBom() {
    try {
        console.log('🚀 Starting Engineering BOM Verification...');

        // 1. Add an existing material
        console.log('\n--- 1. Adding existing material ---');
        const addRes1 = await axios.post(`${API_URL}/engineering-bom/${TEST_PEDIDO}/${TEST_ITEM}`, {
            codigo: 'MP0001',
            descricao: 'CHAPA DE ACO TESTE',
            quantidade: 5,
            unidade: 'KG',
            is_novo: false,
            usuario: 'TEST_USER'
        });
        console.log('Add Existing Result:', addRes1.data);

        // 2. Add a NEW material
        console.log('\n--- 2. Adding new material ---');
        const addRes2 = await axios.post(`${API_URL}/engineering-bom/${TEST_PEDIDO}/${TEST_ITEM}`, {
            descricao: 'MATERIAL ESPECIAL NAO CADASTRADO',
            quantidade: 2,
            unidade: 'UN',
            is_novo: true,
            usuario: 'TEST_USER'
        });
        console.log('Add New Result:', addRes2.data);
        const newId = addRes2.data.id;

        // 3. List BOM
        console.log('\n--- 3. Listing BOM ---');
        const listRes = await axios.get(`${API_URL}/engineering-bom/${TEST_PEDIDO}/${TEST_ITEM}`);
        console.log('BOM Items Count:', listRes.data.length);
        console.table(listRes.data.map(i => ({ id: i.id, cod: i.codigo, desc: i.descricao, qtd: i.quantidade, novo: i.is_novo })));

        // 4. Update an item
        console.log('\n--- 4. Updating item ---');
        await axios.put(`${API_URL}/engineering-bom/${newId}`, {
            descricao: 'MATERIAL ESPECIAL EDITADO',
            quantidade: 10,
            unidade: 'UN',
            usuario: 'TEST_USER'
        });
        console.log('Update Complete');

        // 5. Check History
        console.log('\n--- 5. Checking History ---');
        const histRes = await axios.get(`${API_URL}/engineering-bom/${TEST_PEDIDO}/${TEST_ITEM}/history`);
        console.log('History Count:', histRes.data.length);
        console.table(histRes.data.map(h => ({ acao: h.acao, detalhes: h.detalhes, user: h.usuario })));

        // 6. Delete item
        console.log('\n--- 6. Deleting item ---');
        await axios.delete(`${API_URL}/engineering-bom/${newId}?usuario=TEST_USER`);
        console.log('Delete Complete');

        // 7. Verify History again
        console.log('\n--- 7. Final History Check ---');
        const finalHistRes = await axios.get(`${API_URL}/engineering-bom/${TEST_PEDIDO}/${TEST_ITEM}/history`);
        console.table(finalHistRes.data.map(h => ({ acao: h.acao, detalhes: h.detalhes })));

        console.log('\n✅ Verification Script Completed Successfully!');
    } catch (error) {
        console.error('❌ Verification Failed:', error.response ? error.response.data : error.message);
    }
}

testBom();
