import re

with open('client/src/pages/sgq/Documentos.jsx', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Add state
state_match = "    const [selectionRange, setSelectionRange] = useState(null);"
state_repl = "    const [selectionRange, setSelectionRange] = useState(null);\n    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);\n    const isInitialLoad = useRef(false);"
c = c.replace(state_match, state_repl)

# 2. Update saveDocument to clear the flag
save_match = '''            const res = await api.post('/sgq-documents', payload);
            setSelectedDoc(res.data);
            alert('Documento salvo com sucesso!');
            fetchDocuments();'''
save_repl = '''            const res = await api.post('/sgq-documents', payload);
            setSelectedDoc(res.data);
            setHasUnsavedChanges(false);
            alert('Documento salvo com sucesso!');
            fetchDocuments();'''
c = c.replace(save_match, save_repl)

# 3. Create handleDocumentSwitch
switch_func = '''    const openDocument = async (docId) => {'''
switch_repl = '''    const handleDocumentSwitch = async (action) => {
        if (hasUnsavedChanges) {
            const wantsToSave = window.confirm("Existem alterações não salvas neste documento.\\n\\nClique em [OK] para SALVAR antes de sair, ou [Cancelar] para ignorar e perder as alterações.");
            if (wantsToSave) {
                await saveDocument();
            }
        }
        action();
        setHasUnsavedChanges(false);
    };

    const openDocument = async (docId) => {'''
c = c.replace(switch_func, switch_repl)

# 4. Prevent initial load from setting hasUnsavedChanges
open_match = '''            setHeaderData(loadedHeader);
            setShowHeader(hasHeader);
            setContent(loadedContent);
            setActiveSector(res.data.sector || 'Geral');'''
open_repl = '''            isInitialLoad.current = true;
            setHeaderData(loadedHeader);
            setShowHeader(hasHeader);
            setContent(loadedContent);
            setActiveSector(res.data.sector || 'Geral');
            setTimeout(() => { isInitialLoad.current = false; }, 500);'''
c = c.replace(open_match, open_repl)

# 5. Update setContent in SunEditor
suneditor_onChange = '''<SunEditor 
                            getSunEditorInstance={(editor) => { sunEditorRef.current = editor; }}
                            setContents={content}
                            onChange={setContent}'''
suneditor_onChange_repl = '''<SunEditor 
                            getSunEditorInstance={(editor) => { sunEditorRef.current = editor; }}
                            setContents={content}
                            onChange={(newContent) => {
                                setContent(newContent);
                                if (!isInitialLoad.current) setHasUnsavedChanges(true);
                            }}'''
c = c.replace(suneditor_onChange, suneditor_onChange_repl)

# 6. Replace onClick={openDocument(doc.id)} with handleDocumentSwitch(() => openDocument(doc.id))
click_open_match = "onClick={() => openDocument(doc.id)}"
click_open_repl = "onClick={() => handleDocumentSwitch(() => openDocument(doc.id))}"
c = c.replace(click_open_match, click_open_repl)

# 7. Replace loadTemplate
click_template_match = "onClick={loadTemplate}"
click_template_repl = "onClick={() => handleDocumentSwitch(loadTemplate)}"
c = c.replace(click_template_match, click_template_repl)

# 8. Check import word button
click_import_match = "onClick={() => fileInputRef.current?.click()}"
click_import_repl = "onClick={() => handleDocumentSwitch(() => fileInputRef.current?.click())}"
c = c.replace(click_import_match, click_import_repl)

with open('client/src/pages/sgq/Documentos.jsx', 'w', encoding='utf-8') as f:
    f.write(c)

print("unsaved changes logic added")
