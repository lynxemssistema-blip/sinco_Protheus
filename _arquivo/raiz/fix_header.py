import re

with open('client/src/pages/sgq/Documentos.jsx', 'r', encoding='utf-8') as f:
    c = f.read()

old_save = '''        try {
            // Extrac basic title from first H1 if possible
            let tempTitle = 'Novo Procedimento';
            const parser = new DOMParser();
            const docHtml = parser.parseFromString(content, 'text/html');
            const h1 = docHtml.querySelector('h1');
            if (h1 && h1.innerText) tempTitle = h1.innerText.substring(0, 100);
            else if (selectedDoc?.title) tempTitle = selectedDoc.title;

            const payload = {
                title: tempTitle,
                sector: activeSector,
                code: selectedDoc?.code || 'POP-MF-00X',
                version: selectedDoc?.version || '01',
                content: content
            };'''

new_save = '''        try {
            // Extrac basic title from first H1 if possible
            let tempTitle = 'Novo Procedimento';
            const parser = new DOMParser();
            const docHtml = parser.parseFromString(content, 'text/html');
            const h1 = docHtml.querySelector('h1');
            if (h1 && h1.innerText) tempTitle = h1.innerText.substring(0, 100);
            else if (selectedDoc?.title) tempTitle = selectedDoc.title;

            // Injeta o cabeçalho no corpo HTML para salvamento persistente
            let finalContent = content;
            if (showHeader) {
                // remove cabeçalhos antigos antes de injetar o novo
                finalContent = finalContent.replace(/<div data-header='(.*?)' style="display:none;"><\\/div>/g, '');
                const headerHtml = `<div data-header='${JSON.stringify(headerData)}' style="display:none;"></div>`;
                finalContent = headerHtml + finalContent;
            }

            const payload = {
                title: tempTitle,
                sector: activeSector,
                code: headerData?.code || selectedDoc?.code || 'POP-MF-00X',
                version: headerData?.version || selectedDoc?.version || '01',
                content: finalContent
            };'''

c = c.replace(old_save, new_save)

with open('client/src/pages/sgq/Documentos.jsx', 'w', encoding='utf-8') as f:
    f.write(c)

print("header fix applied")
