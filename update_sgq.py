import re

with open('client/src/pages/sgq/Documentos.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Add headerData state
header_state = '''    const [headerData, setHeaderData] = useState({
        code: 'PQ xx-xx',
        version: 'xx',
        date: 'dd/mm/yyyy',
        preparedBy: '',
        approvedBy: '',
        approvedBy2: ''
    });
    const [showHeader, setShowHeader] = useState(false);'''
code = code.replace('const [selectedDoc, setSelectedDoc] = useState(null);', 'const [selectedDoc, setSelectedDoc] = useState(null);\n' + header_state)

# 2. Fix the ISO template: Remove the HTML table from isoTemplate, keeping only the body and footer
template_start = code.find('const isoTemplate = `')
template_end = code.find('`;', template_start) + 2

new_iso_template = '''    const isoTemplate = `
        <br>
        <h2>1. OBJETIVO</h2>
        <p><br></p>
        <br>
        <h2>2. ABRANGÊNCIA</h2>
        <p><br></p>
        <br>
        <h2>3. SIGLAS</h2>
        <p><br></p>
        <br>
        <h2>4. DEFINIÇÕES</h2>
        <p><br></p>
        <br>
        <h2>5. RESPONSABILIDADES</h2>
        <p><br></p>
        <br>
        <h2>6. PROCEDIMENTOS</h2>
        <p><br></p>
        <br>
        <h2>7. INFORMAÇÃO DOCUMENTADA</h2>
        <p><br></p>
        <br>
        <h2>8. ABORDAGEM A RISCOS</h2>
        <p><br></p>
        <br>
        <h2>9. ANEXOS</h2>
        <p><br></p>
        <br>
        <h2>10. HISTÓRICO DE REVISÕES</h2>
        <p><br></p>
        <br>
        <hr style="border: 1px solid #000; margin-top: 40px;">
        <p style="text-align: center; font-size: 9pt; font-family: Arial, sans-serif; margin-top: 5px;">
            <strong>Proibido reproduzir ou ceder a terceiros sem autorização da Metalfisa.</strong>
        </p>
    `;'''
code = code[:template_start] + new_iso_template + code[template_end:]

# 3. Add DocumentHeader component right above SGQDocuments
header_component = '''
const DocumentHeader = ({ headerData, setHeaderData, activeSector }) => {
    return (
        <div className="px-[60px] pt-[40px] pb-4 print:pt-[10px] print:px-[10px]">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Arial, sans-serif', fontSize: '10pt', border: '1px solid #000', textAlign: 'center', verticalAlign: 'middle' }}>
                <tbody>
                    <tr>
                        <td rowSpan="6" style={{ width: '25%', border: '1px solid #000', padding: '10px' }}>
                            <img src="https://metalfisa.com.br/wp-content/uploads/2021/04/logo-metalfisa.png" alt="MetalFisa" style={{ maxWidth: '100%', height: 'auto', maxHeight: '60px', margin: '0 auto' }} />
                        </td>
                        <td rowSpan="2" style={{ width: '45%', border: '1px solid #000', fontWeight: 'bold', fontSize: '12pt', color: '#555' }}>
                            SISTEMA DE GESTÃO DA QUALIDADE
                        </td>
                        <td style={{ width: '15%', border: '1px solid #000', backgroundColor: '#f2f2f2', fontSize: '8pt', color: '#555' }}>CÓDIGO</td>
                        <td style={{ width: '15%', border: '1px solid #000', backgroundColor: '#f2f2f2', fontSize: '8pt', color: '#555' }}>REVISÃO</td>
                    </tr>
                    <tr>
                        <td style={{ border: '1px solid #000', fontWeight: 'bold', color: '#555' }}>
                            <input value={headerData.code} onChange={e => setHeaderData({...headerData, code: e.target.value})} className="w-full text-center outline-none bg-transparent" />
                        </td>
                        <td style={{ border: '1px solid #000', fontWeight: 'bold', color: '#555' }}>
                            <input value={headerData.version} onChange={e => setHeaderData({...headerData, version: e.target.value})} className="w-full text-center outline-none bg-transparent" />
                        </td>
                    </tr>
                    <tr>
                        <td style={{ border: '1px solid #000', backgroundColor: '#f2f2f2', fontSize: '8pt', color: '#555' }}>TIPO DE DOCUMENTO</td>
                        <td colSpan="2" style={{ border: '1px solid #000', backgroundColor: '#f2f2f2', fontSize: '8pt', color: '#555' }}>DATA</td>
                    </tr>
                    <tr>
                        <td style={{ border: '1px solid #000', color: '#555' }}>Procedimento da Qualidade</td>
                        <td colSpan="2" style={{ border: '1px solid #000', fontWeight: 'bold', color: '#555' }}>
                            <input value={headerData.date} onChange={e => setHeaderData({...headerData, date: e.target.value})} className="w-full text-center outline-none bg-transparent" />
                        </td>
                    </tr>
                    <tr>
                        <td style={{ border: '1px solid #000', backgroundColor: '#f2f2f2', fontSize: '8pt', color: '#555' }}>TÍTULO DO DOCUMENTO</td>
                        <td colSpan="2" style={{ border: '1px solid #000', backgroundColor: '#f2f2f2', fontSize: '8pt', color: '#555' }}>PÁGINA</td>
                    </tr>
                    <tr>
                        <td style={{ border: '1px solid #000', color: '#555' }}>{activeSector}</td>
                        <td colSpan="2" style={{ border: '1px solid #000', fontWeight: 'bold', color: '#555' }}>1/1</td>
                    </tr>
                    <tr>
                        <td colSpan="2" style={{ border: '1px solid #000', backgroundColor: '#f2f2f2', fontSize: '8pt', color: '#555' }}>ANÁLISE CRÍTICA</td>
                        <td colSpan="2" style={{ border: '1px solid #000', backgroundColor: '#f2f2f2', fontSize: '8pt', color: '#555' }}>RESPONSÁVEL PELA APROVAÇÃO</td>
                    </tr>
                    <tr>
                        <td colSpan="2" style={{ border: '1px solid #000', textAlign: 'left', padding: '4px 8px', color: '#555' }}>
                            Documento elaborado por: 
                            <input value={headerData.preparedBy} onChange={e => setHeaderData({...headerData, preparedBy: e.target.value})} className="ml-2 w-[70%] outline-none bg-transparent" />
                        </td>
                        <td colSpan="2" style={{ border: '1px solid #000', color: '#555' }}>
                            <input value={headerData.approvedBy} onChange={e => setHeaderData({...headerData, approvedBy: e.target.value})} className="w-full text-center outline-none bg-transparent" />
                        </td>
                    </tr>
                    <tr>
                        <td colSpan="2" style={{ border: '1px solid #000', textAlign: 'left', padding: '4px 8px', color: '#555' }}>Documento analisado e aprovado quanto à adequação.</td>
                        <td colSpan="2" style={{ border: '1px solid #000', color: '#555' }}>
                            <input value={headerData.approvedBy2} onChange={e => setHeaderData({...headerData, approvedBy2: e.target.value})} className="w-full text-center outline-none bg-transparent" />
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

const SGQDocuments = () => {'''

code = code.replace('const SGQDocuments = () => {', header_component)

# 4. Modify openDocument to extract JSON
open_doc_old = '''    const openDocument = async (docId) => {
        try {
            const res = await api.get(`/sgq-documents/${docId}`);
            setSelectedDoc(res.data);
            setContent(res.data.content);
            setActiveSector(res.data.sector || 'Geral');
        } catch (error) {
            console.error('Falha ao abrir documento', error);
        }
    };'''

open_doc_new = '''    const openDocument = async (docId) => {
        try {
            const res = await api.get(`/sgq-documents/${docId}`);
            setSelectedDoc(res.data);
            
            let loadedContent = res.data.content || '';
            let loadedHeader = {
                code: res.data.code || 'PQ xx-xx',
                version: res.data.version || 'xx',
                date: 'dd/mm/yyyy',
                preparedBy: '',
                approvedBy: '',
                approvedBy2: ''
            };
            
            // Check if there's a hidden header JSON in the content
            const headerMatch = loadedContent.match(/<div data-header='(.*?)' style="display:none;"><\\/div>/);
            let hasHeader = false;
            if (headerMatch) {
                try {
                    const parsed = JSON.parse(headerMatch[1]);
                    loadedHeader = { ...loadedHeader, ...parsed };
                    loadedContent = loadedContent.replace(headerMatch[0], '');
                    hasHeader = true;
                } catch (e) {}
            }

            setHeaderData(loadedHeader);
            setShowHeader(hasHeader);
            setContent(loadedContent);
            setActiveSector(res.data.sector || 'Geral');
        } catch (error) {
            console.error('Falha ao abrir documento', error);
        }
    };'''

code = code.replace(open_doc_old, open_doc_new)

# 5. Modify saveDocument to append JSON
save_doc_old = '''            const payload = {
                title: tempTitle,
                sector: activeSector,
                code: selectedDoc?.code || 'POP-MF-00X',
                version: selectedDoc?.version || '01',
                content
            };'''

save_doc_new = '''            const packedHeader = showHeader ? `<div data-header='${JSON.stringify(headerData)}' style="display:none;"></div>` : '';
            const finalContent = packedHeader + content;

            const payload = {
                title: tempTitle,
                sector: activeSector,
                code: headerData.code || selectedDoc?.code || 'PQ-MF-00X',
                version: headerData.version || selectedDoc?.version || '01',
                content: finalContent
            };'''
code = code.replace(save_doc_old, save_doc_new)

# 6. Replace buttons
buttons_old = '''                        <button
                            onClick={insertHeader}
                            className="flex items-center gap-2 px-3 py-1.5 hover:bg-emerald-50 hover:text-emerald-700 rounded-md text-emerald-600 text-xs font-bold transition-all border border-emerald-200 bg-white shadow-sm"
                            title="Insere apenas o cabeçalho no documento atual sem apagar o texto"
                        >
                            <Layout className="h-3.5 w-3.5" />
                            INSERIR CABEÇALHO ISO
                        </button>
                        <button
                            onClick={loadTemplate}
                            className="flex items-center gap-2 px-3 py-1.5 hover:bg-blue-50 hover:text-blue-700 rounded-md text-blue-600 text-xs font-bold transition-all border border-blue-200 bg-white shadow-sm"
                            title="Apaga o documento atual e carrega o modelo completo (Cabeçalho + 10 Tópicos)"
                        >
                            <Layout className="h-3.5 w-3.5" />
                            CARREGAR MODELO ISO
                        </button>'''

buttons_new = '''                        <button
                            onClick={() => setShowHeader(!showHeader)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all border shadow-sm ${showHeader ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50'}`}
                            title="Ativa/desativa o cabeçalho fixo no topo da página"
                        >
                            <Layout className="h-3.5 w-3.5" />
                            {showHeader ? 'REMOVER CABEÇALHO' : 'INSERIR CABEÇALHO'}
                        </button>
                        <button
                            onClick={loadTemplate}
                            className="flex items-center gap-2 px-3 py-1.5 hover:bg-blue-50 hover:text-blue-700 rounded-md text-blue-600 text-xs font-bold transition-all border border-blue-200 bg-white shadow-sm"
                            title="Apaga o documento atual e carrega a estrutura ISO de 10 tópicos"
                        >
                            <Layout className="h-3.5 w-3.5" />
                            CARREGAR TÓPICOS ISO
                        </button>'''

code = code.replace(buttons_old, buttons_new)

# 7. Add Header above ReactQuill
quill_block = '''                        <ReactQuill
                            ref={quillRef}'''

new_quill_block = '''                        {showHeader && <DocumentHeader headerData={headerData} setHeaderData={setHeaderData} activeSector={activeSector} />}
                        <ReactQuill
                            ref={quillRef}'''

code = code.replace(quill_block, new_quill_block)

# Remove padding-top from quill if header is shown
style_block = '''                        .ql-editor {
                            min-height: 100%;
                            padding: 40px 60px 80px 60px !important;
                        }'''
new_style_block = '''                        .ql-editor {
                            min-height: 100%;
                            padding: ${showHeader ? '10px' : '40px'} 60px 80px 60px !important;
                        }'''
code = code.replace(style_block, new_style_block)

# 8. Add remove insertHeader function logic
insert_header_fn = '''    const insertHeader = () => {
        const headerHtml = isoTemplate.split('</table>')[0] + '</table><br><br>';
        setContent(prev => headerHtml + prev);
    };

'''
code = code.replace(insert_header_fn, '')

with open('client/src/pages/sgq/Documentos.jsx', 'w', encoding='utf-8') as f:
    f.write(code)

print('Update complete')
