import re

with open('client/src/pages/sgq/Documentos.jsx', 'r', encoding='utf-8') as f:
    c = f.read()

# Update handleUploadContext
old_upload = '''    const handleUploadContext = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setAiContextFileName(file.name);
        setAiContextLoading(true);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await api.post('/ai/extract-context', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setAiContextText(res.data.text);
        } catch (error) {'''

new_upload = '''    const handleUploadContext = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setAiContextFileName(file.name);
        setAiContextLoading(true);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await api.post('/ai/extract-context', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setAiContextText({ 
                type: res.data.type, 
                data: res.data.type === 'image' ? res.data.data : res.data.text,
                mimeType: res.data.mimeType
            });
        } catch (error) {'''

c = c.replace(old_upload, new_upload)

# Update accept attribute and button text
old_accept = '''<input type="file" ref={contextFileInputRef} className="hidden" accept=".pdf,.docx,.doc" onChange={handleUploadContext} />'''
new_accept = '''<input type="file" ref={contextFileInputRef} className="hidden" accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.webp" onChange={handleUploadContext} />'''
c = c.replace(old_accept, new_accept)

old_btn_text = "{aiContextLoading ? 'Processando arquivo...' : 'Anexar PDF ou Word como base'}"
new_btn_text = "{aiContextLoading ? 'Processando arquivo...' : 'Anexar PDF, Word ou Imagem'}"
c = c.replace(old_btn_text, new_btn_text)

with open('client/src/pages/sgq/Documentos.jsx', 'w', encoding='utf-8') as f:
    f.write(c)

print("frontend multimodal ready")
