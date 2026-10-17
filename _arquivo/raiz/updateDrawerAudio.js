const fs = require('fs');
const path = require('path');
const p = path.join('client', 'src', 'components', 'PCPMetalDrawer.jsx');
let text = fs.readFileSync(p, 'utf8');

text = text.replace(
    "const handleSend = async () => {",
    "const handleSend = async () => { if (isRecording && recognitionRef.current) { recognitionRef.current.stop(); setIsRecording(false); }"
);

const recordingLogic = 

    const toggleRecording = () => {
        if (isRecording) {
            if (recognitionRef.current) recognitionRef.current.stop();
            setIsRecording(false);
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('Reconhecimento de voz não suportado neste navegador.');
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
            setInput(transcript);
        };
        recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            setIsRecording(false);
        };
        recognition.onend = () => {
            setIsRecording(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
    };

    return (;

text = text.replace(
    "    return (",
    recordingLogic
);

const oldButtonHtml = <button\n                            onClick={handleSend};
const newButtonHtml = 
                        <button
                            onClick={toggleRecording}
                            className={\w-12 h-12 shrink-0 rounded-xl flex items-center justify-center transition-all \\}
                            title="Gravar áudio"
                        >
                            {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                        </button>
                        <button\n                            onClick={handleSend};

text = text.replace(oldButtonHtml, newButtonHtml);

fs.writeFileSync(p, text, 'utf8');
console.log('Audio logic injected!');
