const { jsPDF } = require('jspdf');
const fs = require('fs');

const doc = new jsPDF();
doc.setFont('helvetica', 'normal');

// Create a string with a replacement character or similar malformed UTF-16
const text = "E EMBALAGEM. SAÍDAS COM SUSPENS\uFFFD DO IPI";
const lines = doc.splitTextToSize(text, 100);

doc.text(lines, 10, 10);
const pdf = doc.output();
console.log(pdf.indexOf('&E&'));
