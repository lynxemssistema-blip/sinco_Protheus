require('dotenv').config({path: './server/.env'});
const jwt = require('jsonwebtoken');
const axios = require('axios');

async function test() {
    try {
        const secret = process.env.JWT_SECRET || 'M3t4lF1s4_S3cr3t_2024!@#';
        const token = jwt.sign({ id: 1, login: 'adm', nome: 'Admin', role: 'admin' }, secret, { expiresIn: '1h' });

        const res = await axios.get('http://localhost:3002/api/production/matrix?op=003595', {
            headers: { Authorization: `Bearer ${token}` }
        });

        const matrix = res.data;
        const targetItem = matrix.data.find(i => i.op.trim() === '003595' && i.sequencia === '016');
        
        if (targetItem) {
            console.log("Found Item OP 003595 Seq 016");
            console.log("Operations:", Object.keys(targetItem.operations).map(k => {
                const op = targetItem.operations[k];
                return `${k} (Real: ${op.operacao_real}): ${op.qtd_produzida}/${op.qtd_planejada}`;
            }));
        } else {
            console.log("Item not found");
        }
    } catch(e) {
        console.error(e.response ? e.response.data : e.message);
    }
    process.exit(0);
}
test();
