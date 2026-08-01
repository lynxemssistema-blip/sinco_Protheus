const { jsPDF } = require('jspdf');

const doc = new jsPDF();
doc.setFont('helvetica', 'normal');

const text = "E EMBALAGEM. SAÍDAS COM SUSPENS\uFFFDO";
const lines = doc.splitTextToSize(text, 100);

doc.text(lines, 10, 10);
const pdf = doc.output();
console.log(pdf.indexOf('&E&'));
console.log(pdf.substring(pdf.indexOf('E EMBALAGEM') - 20, pdf.indexOf('E EMBALAGEM') + 50));
