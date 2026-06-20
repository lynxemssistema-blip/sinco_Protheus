const http = require('http');

http.get('http://localhost:5000/api/producao/vertical/LASER?plan_inicio_ate=2026-06-15', res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log('Response Length:', data.length, 'Content preview:', data.substring(0, 200)));
});
