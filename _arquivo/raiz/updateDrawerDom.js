const fs = require('fs');
const path = require('path');
const p = path.join('client', 'src', 'components', 'PCPMetalDrawer.jsx');
let text = fs.readFileSync(p, 'utf8');

text = text.replace(
    'const [isPinned, setIsPinned] = useState(false);',
    "const [isPinned, setIsPinned] = useState(false);\n\n    useEffect(() => {\n        const mainEl = document.querySelector('main');\n        if (!mainEl) return;\n        if (isPinned && isOpen) {\n            mainEl.style.paddingRight = '576px';\n        } else {\n            mainEl.style.paddingRight = '';\n        }\n        return () => { mainEl.style.paddingRight = ''; };\n    }, [isPinned, isOpen]);"
);

fs.writeFileSync(p, text, 'utf8');
console.log('DOM padding logic added!');
