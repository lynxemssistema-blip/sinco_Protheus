const fs = require('fs');
const path = require('path');
const p = path.join('client', 'src', 'components', 'PCPMetalDrawer.jsx');
let text = fs.readFileSync(p, 'utf8');

text = text.replace(/const handleSend = async \(\) => \{[\s\S]*?const question = input.trim\(\);/, 'const handleSend = async () => {\n        if (!input.trim() || loading) return;\n        if (isRecording && recognitionRef.current) {\n            recognitionRef.current.stop();\n            setIsRecording(false);\n        }\n        const question = input.trim();');

text = text.replace(/\/>\s*<button\s*onClick=\{handleSend\}/, '/>\n                        <button\n                            onClick={toggleRecording}\n                            className={\w-12 h-12 shrink-0 rounded-xl flex items-center justify-center transition-all \\}\n                            title="Gravar"\n                        >\n                            {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}\n                        </button>\n                        <button\n                            onClick={handleSend}');

fs.writeFileSync(p, text, 'utf8');
console.log('Audio logic injected finally!');
