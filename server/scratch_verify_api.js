const http = require('http');

console.log("Sending request to /api/pedidos/flat...");
http.get('http://localhost:3001/api/pedidos/flat?pedido=004812&limit=2', (res) => {
    console.log("Response Status:", res.statusCode);
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const parsed = JSON.parse(data);
            console.log("Success! Row sample:", parsed.data?.[0]);
        } catch (e) {
            console.log("Raw response (not JSON):", data.substring(0, 300));
        }
    });
}).on('error', (err) => {
    console.error("Connection Error:", err);
});
