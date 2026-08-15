const http = require('http');

async function testEdsonLogin() {
    const loginData = JSON.stringify({
        login: 'edson',
        senha: '10207597'
    });

    const loginOptions = {
        hostname: 'localhost',
        port: 3002,
        path: '/api/auth/login',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(loginData)
        }
    };

    let token = '';

    const req = http.request(loginOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            console.log('Login Status Code:', res.statusCode);
            try {
                const json = JSON.parse(data);
                if (json.token) {
                    token = json.token;
                    console.log('✅ Login successful! Token acquired.');
                    queryMasterSheet(token);
                } else {
                    console.error('❌ Login failed. No token in response:', json);
                }
            } catch (e) {
                console.error('Error parsing login response:', e.message);
            }
        });
    });

    req.on('error', (e) => {
        console.error('Login request error:', e.message);
    });

    req.write(loginData);
    req.end();
}

function queryMasterSheet(token) {
    // Query master sheet for order 004159
    const path = '/api/reports/sales-planning/master-sheet?pedido=004159';
    
    const options = {
        hostname: 'localhost',
        port: 3002,
        path: path,
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    };

    http.get(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            console.log('Master Sheet API Status Code:', res.statusCode);
            try {
                const json = JSON.parse(data);
                console.log('Resources available:', json.recursos);
                
                if (json.execucao_op && json.execucao_op.length > 0) {
                    console.log(`Total OPs in Execution sheet: ${json.execucao_op.length}`);
                    console.log('Sample OP data mapping details:');
                    
                    // Show a few rows with resource data
                    json.execucao_op.slice(0, 5).forEach((opRow, idx) => {
                        console.log(`\nRow ${idx+1}: OP: ${opRow.op} | Prod: ${opRow.produto} | Qtd Plan: ${opRow.qtd_planejada}`);
                        
                        json.recursos.forEach(r => {
                            const prev = opRow[`previsto_${r}`] || 0;
                            const apon = opRow[`apontado_${r}`] || 0;
                            const qtdApon = opRow[`qtd_apontada_${r}`] || 0;
                            
                            if (prev > 0 || apon > 0 || qtdApon > 0) {
                                console.log(`  -> Rec: ${r} | Prev (min): ${prev} | Apon (min): ${apon} | Qtd Apon (un): ${qtdApon}`);
                            }
                        });
                    });
                } else {
                    console.log('No execution data returned in response.');
                }
            } catch (e) {
                console.error('Error parsing master-sheet response:', e.message);
            }
        });
    }).on('error', (err) => {
        console.error('Master Sheet request failed:', err.message);
    });
}

testEdsonLogin();
