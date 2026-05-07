const fs = require('fs');
const { jsPDF } = require('jspdf');
require('jspdf-autotable');
const { PDFDocument } = require('pdf-lib');
const data = JSON.parse(fs.readFileSync('../server/mirror_3954.json'));
const { generateOPByOperationPdf } = require('./src/services/opByOperationPdfGenerator.js');

async function run() {
    try {
        const res = generateOPByOperationPdf(data, true, null);
        fs.writeFileSync('test_3954.pdf', Buffer.from(res));
        console.log('PDF saved to test_3954.pdf');
    } catch(e) {
        console.log('ERROR:', e.message);
    }
}
run();
