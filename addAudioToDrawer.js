const fs = require('fs');
const path = require('path');
const p = path.join('client', 'src', 'components', 'PCPMetalDrawer.jsx');
let text = fs.readFileSync(p, 'utf8');

text = text.replace(
    "import { X, Bot, Send, Loader2, ChevronDown, ChevronUp, Database, CheckCircle2, AlertCircle, Cpu } from 'lucide-react';",
    "import { X, Bot, Send, Loader2, ChevronDown, ChevronUp, Database, CheckCircle2, AlertCircle, Cpu, Mic, MicOff } from 'lucide-react';"
);

text = text.replace(
    "const [isPinned, setIsPinned] = useState(false);",
    "const [isPinned, setIsPinned] = useState(false);\n    const [isRecording, setIsRecording] = useState(false);\n    const recognitionRef = useRef(null);"
);

const recordingLogic = 
    // Audio recording logic
    const toggleRecording = () => {
        if (isRecording) {
            if (recognitionRef.current) recognitionRef.current.stop();
            setIsRecording(false);
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            toast.error('Reconhecimento de voz não suportado neste navegador.');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'pt-BR';
        recognition.interimResults = true;
        recognition.continuous = false;

        recognition.onstart = () => setIsRecording(true);
        recognition.onresult = (event) => {
            const current = event.resultIndex;
            const transcript = event.results[current][0].transcript;
            setInput(prev => {
                // If it's final result, just replace or append better. For simplicity, just replace if input is empty, else append.
                // But interimResults fires multiple times, so it's tricky. Let's just set the input to the transcript.
                return transcript; 
            });
        };
        recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            setIsRecording(false);
            toast.error('Erro ao gravar áudio.');
        };
        recognition.onend = () => {
            setIsRecording(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
    };
;

text = text.replace(
    "const abortRef = useRef(null);",
    "const abortRef = useRef(null);\n" + recordingLogic
);

text = text.replace(
    "<button\n                            onClick={handleSend}",
    
                        <button
                            onClick={toggleRecording}
                            className={\w-12 h-12 shrink-0 rounded-xl flex items-center justify-center transition-all \\}
                            title="Gravar áudio"
                        >
                            {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                        </button>
                        <button\n                            onClick={handleSend}
);

fs.writeFileSync(p, text, 'utf8');
console.log('Audio added!');
