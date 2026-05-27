import re

with open('client/src/pages/sgq/Documentos.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Replace imports
code = code.replace("import ReactQuill from 'react-quill';", "import SunEditor from 'suneditor-react';")
code = code.replace("import 'react-quill/dist/quill.snow.css';", "import 'suneditor/dist/css/suneditor.min.css';")

# 2. Remove quill modules and refs
modules_start = code.find('const modules = {')
modules_end = code.find('};', modules_start) + 2
code = code[:modules_start] + code[modules_end:]

code = code.replace('const quillRef = useRef(null);', '')
code = code.replace('onChangeSelection={handleQuillChangeSelection}', '')
code = code.replace('modules={modules}', '')

# Remove handleQuillChangeSelection
handler_start = code.find('const handleQuillChangeSelection = (range, source, editor) => {')
if handler_start != -1:
    handler_end = code.find('};', handler_start) + 2
    code = code[:handler_start] + code[handler_end:]

# 3. Replace ReactQuill with SunEditor
quill_tag = '''                        <ReactQuill
                            ref={quillRef}
                            theme="snow"
                            value={content}
                            onChange={setContent}
                            
                            
                            className="custom-quill-editor"
                            placeholder="Comece a redigir o documento aqui..."
                        />'''

suneditor_tag = '''                        <SunEditor 
                            setContents={content}
                            onChange={setContent}
                            setOptions={{
                                height: 'auto',
                                minHeight: '600px',
                                buttonList: [
                                    ['undo', 'redo'],
                                    ['font', 'fontSize', 'formatBlock'],
                                    ['paragraphStyle', 'blockquote'],
                                    ['bold', 'underline', 'italic', 'strike', 'subscript', 'superscript'],
                                    ['fontColor', 'hiliteColor', 'textStyle'],
                                    ['removeFormat'],
                                    '/', 
                                    ['outdent', 'indent'],
                                    ['align', 'horizontalRule', 'list', 'lineHeight'],
                                    ['table', 'link', 'image', 'video'],
                                    ['fullScreen', 'showBlocks', 'codeView'],
                                    ['preview', 'print']
                                ],
                                defaultStyle: "font-family: Arial, sans-serif; font-size: 11pt;"
                            }}
                            className="custom-sun-editor"
                        />'''

code = code.replace(quill_tag, suneditor_tag)

# 4. Remove the huge style tag we had for Quill, as SunEditor handles its own styles well
style_tag_start = code.find('<style dangerouslySetInnerHTML={{')
if style_tag_start != -1:
    style_tag_end = code.find('}} />', style_tag_start) + 5
    
    new_style = '''                        <style dangerouslySetInnerHTML={{
                            __html: `
                        .sun-editor { border: none !important; }
                        .se-resizing-bar { display: none !important; }
                        .se-wrapper { border-radius: 8px; }
                        .se-wrapper-inner { 
                            min-height: 100%;
                            padding: ${showHeader ? '10px' : '40px'} 60px 80px 60px !important;
                            background-image: repeating-linear-gradient(
                                to bottom,
                                transparent 0mm,
                                transparent 296.8mm,
                                #cbd5e1 296.8mm,
                                #cbd5e1 297mm
                            );
                        }
                        .se-container { z-index: 10 !important; }
                        `
                        }} />'''
    code = code[:style_tag_start] + new_style + code[style_tag_end:]

# Write back
with open('client/src/pages/sgq/Documentos.jsx', 'w', encoding='utf-8') as f:
    f.write(code)

print('SunEditor migration complete')
