const fs = require('fs').promises;
const path = require('path');

async function getFilesRecursively(dir) {
    console.log(`Scanning: ${dir}`);
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(dirents.map((dirent) => {
        const res = path.resolve(dir, dirent.name);
        return dirent.isDirectory() ? getFilesRecursively(res) : res;
    }));
    return Array.prototype.concat(...files);
}

(async () => {
    try {
        const testPath = process.cwd(); // Testing current directory
        console.log(`Starting scan of ${testPath}`);
        const files = await getFilesRecursively(testPath);
        console.log(`Found ${files.length} files.`);

        // Test filtering logic
        for (const filePath of files) {
            const fileName = path.basename(filePath);
            if (path.extname(fileName).toLowerCase() !== '.pdf') continue;
            const produtoCodigo = path.parse(fileName).name.toUpperCase().trim();
            console.log(`Found PDF: ${fileName} -> Code: ${produtoCodigo}`);
        }

    } catch (err) {
        console.error('CRASHED:', err);
    }
})();
