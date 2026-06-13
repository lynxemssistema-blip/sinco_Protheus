require('dotenv').config({path: './server/.env'});
const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3002,
    path: '/api/production/matrix-data?op=003595',
    method: 'GET',
    headers: {
        'Authorization': 'Bearer test' // Wait, do I know a valid token?
    }
};
