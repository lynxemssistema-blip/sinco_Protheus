const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/production/matrix',
    method: 'GET',
    headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MzcsImxvZ2luIjoiRWRzb24iLCJub21lIjoiRWRzb24gTWFub2VsIiwiaWF0IjoxNzcwNjMyNjc3LCJleHAiOjE3NzA2NjE0Nzd9.pR28VFKijslZpKwC_cKGNxHGMZGrOMrcrSMeu2UfZ6M',
        'Content-Type': 'application/json'
    }
};

console.log('Testing /api/production/matrix...');

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        console.log('BODY:', data.substring(0, 1000));
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.end();
