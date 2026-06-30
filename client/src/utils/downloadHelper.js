/**
 * Helper utility to safely trigger file downloads in all browsers (including Chromium-based).
 * It appends a hidden <a> tag to the body before clicking it to prevent the browser
 * from stripping the filename and extension.
 *
 * @param {Blob} blob - The Blob to download.
 * @param {string} fileName - The desired name of the file, including extension (e.g., 'report.xlsx').
 */
export const downloadBlob = (blob, fileName) => {
    if (!blob || !fileName) {
        console.warn('downloadBlob requires both a blob and a fileName.');
        return;
    }

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = fileName;
    
    // Append to body to ensure Chromium respects the download attribute
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 100);
};
