const fs = require('fs');
const path = require('path');
const p = path.join('client', 'src', 'components', 'PCPMetalDrawer.jsx');
let text = fs.readFileSync(p, 'utf8');

text = text.replace(
    "const handleSend = async () => {\r\n        if (!input.trim() || loading) return;\r\n        const question = input.trim();",
    "const handleSend = async () => {\r\n        if (!input.trim() || loading) return;\r\n        if (isRecording && recognitionRef.current) {\r\n            recognitionRef.current.stop();\r\n            setIsRecording(false);\r\n        }\r\n        const question = input.trim();"
);

text = text.replace(
    "const handleSend = async () => {\n        if (!input.trim() || loading) return;\n        const question = input.trim();",
    "const handleSend = async () => {\n        if (!input.trim() || loading) return;\n        if (isRecording && recognitionRef.current) {\n            recognitionRef.current.stop();\n            setIsRecording(false);\n        }\n        const question = input.trim();"
);

const oldButtonHtml = '<button\\r\\n                            onClick={handleSend}';
const newButtonHtml = \
                        <button
                            onClick={toggleRecording}
                            className={\\\w-12 h-12 shrink-0 rounded-xl flex items-center justify-center transition-all \\\\\\}
                            title="Gravar áudio"
                        >
                            {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                        </button>
                        <button
                            onClick={handleSend}\;

text = text.replace('<button\n                            onClick={handleSend}', newButtonHtml);
text = text.replace('<button\r\n                            onClick={handleSend}', newButtonHtml);

fs.writeFileSync(p, text, 'utf8');
console.log('Audio logic injected!');
