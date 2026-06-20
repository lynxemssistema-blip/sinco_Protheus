import re

with open('client/src/components/PCPMetalDrawer.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add pendingTranscriptRef
content = content.replace(
    "const recognitionRef = useRef(null);",
    "const recognitionRef = useRef(null);\n    const pendingTranscriptRef = useRef('');"
)

# 2. Modify handleSend signature
content = content.replace(
    "const handleSend = async () => {\n        if (!input.trim() || loading) return;",
    "const handleSend = async (forcedText = null) => {\n        const textToSend = typeof forcedText === 'string' ? forcedText : input.trim();\n        if (!textToSend || loading) return;"
)

content = content.replace(
    "const question = input.trim();\n        setInput('');",
    "const question = textToSend;\n        if (typeof forcedText !== 'string') setInput('');"
)

# 3. Modify recognition hooks
old_hooks = """        recognition.onstart = () => setIsRecording(true);
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
        };"""

new_hooks = """        recognition.onstart = () => { setIsRecording(true); pendingTranscriptRef.current = ''; };
        recognition.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                finalTranscript += event.results[i][0].transcript;
            }
            pendingTranscriptRef.current = finalTranscript;
            setInput(finalTranscript);
        };
        recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            setIsRecording(false);
        };
        recognition.onend = () => {
            setIsRecording(false);
            if (pendingTranscriptRef.current && pendingTranscriptRef.current.trim().length > 0) {
                handleSend(pendingTranscriptRef.current.trim());
                pendingTranscriptRef.current = '';
                setInput('');
            }
        };"""

content = content.replace(old_hooks, new_hooks)

with open('client/src/components/PCPMetalDrawer.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Patch applied")
