// BUGFIX (IA): Garante download com extensao e impede perda de nome no Chromium/Chrome/Edge
/**
 * Helper utility to safely trigger file downloads in all browsers (including Chromium-based).
 * It appends a hidden <a> tag to the body and keeps the ObjectURL alive long enough
 * for Chromium's download manager to properly bind the filename and extension,
 * preventing files from being saved as extensionless UUIDs.
 *
 * @param {Blob} blob - The Blob to download.
 * @param {string} fileName - The desired name of the file, including extension (e.g., 'report.xlsx' or 'relatorio.pdf').
 * @param {string} [mimeType] - Optional explicit MIME type to enforce.
 */
export const downloadBlob = (blob, fileName, mimeType = null) => {
    if (!blob || !fileName) {
        console.warn('[downloadBlob] Requer um blob e um fileName válido.');
        return;
    }

    // Garante que o nome do arquivo esteja limpo e não vazio
    const finalFileName = String(fileName).trim();

    // Re-empacota o Blob caso seja especificado um MIME type diferente
    let effectiveBlob = blob;
    if (mimeType && blob.type !== mimeType) {
        effectiveBlob = new Blob([blob], { type: mimeType });
    }

    const url = window.URL.createObjectURL(effectiveBlob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.setAttribute('download', finalFileName);
    a.download = finalFileName;
    a.rel = 'noopener noreferrer';
    
    // Append to body to ensure Chromium respects the download attribute
    document.body.appendChild(a);
    
    // Dispara clique direto nativo (evita que o Chromium trate como download automático suspeito)
    try {
        a.click();
    } catch (e) {
        const clickEvent = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true
        });
        a.dispatchEvent(clickEvent);
    }
    
    // Retemos a URL por 60 segundos antes de limpar para garantir
    // que o Chromium tenha tempo hábil de receber o arquivo e registrar a extensão.
    setTimeout(() => {
        try {
            if (document.body.contains(a)) {
                document.body.removeChild(a);
            }
            window.URL.revokeObjectURL(url);
        } catch (e) {
            // ignore
        }
    }, 60000);
};

export default downloadBlob;
