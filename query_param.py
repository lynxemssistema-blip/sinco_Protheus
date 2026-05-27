import re

with open('client/src/pages/sgq/Documentos.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

if 'useSearchParams' not in code:
    code = code.replace("import { useNavigate } from 'react-router-dom';", "import { useNavigate, useSearchParams } from 'react-router-dom';")
    
    use_search_params = '''    const [searchParams] = useSearchParams();
    const docIdToOpen = searchParams.get('docId');'''
    code = code.replace('const navigate = useNavigate();', 'const navigate = useNavigate();\n' + use_search_params)
    
    use_effect_old = '''    useEffect(() => {
        fetchSectors();
        fetchDocuments();
    }, []);'''
    
    use_effect_new = '''    useEffect(() => {
        fetchSectors();
        fetchDocuments().then(() => {
            if (docIdToOpen) {
                openDocument(docIdToOpen);
            }
        });
    }, [docIdToOpen]);'''
    
    code = code.replace(use_effect_old, use_effect_new)
    
    # We also need fetchDocuments to return a promise
    fetch_docs_old = '''    const fetchDocuments = async () => {
        try {
            const res = await api.get('/sgq-documents');
            setDocuments(res.data);
        } catch (error) {
            console.error('Falha ao carregar documentos', error);
        }
    };'''
    
    fetch_docs_new = '''    const fetchDocuments = async () => {
        try {
            const res = await api.get('/sgq-documents');
            setDocuments(res.data);
            return res.data;
        } catch (error) {
            console.error('Falha ao carregar documentos', error);
        }
    };'''
    code = code.replace(fetch_docs_old, fetch_docs_new)

    with open('client/src/pages/sgq/Documentos.jsx', 'w', encoding='utf-8') as f:
        f.write(code)
    print('Query param parsing added')
