const path = require('path');

const DANGEROUS_EXTENSIONS = new Set([
    '.exe', '.bat', '.cmd', '.sh', '.bash', '.ps1', '.vbs', '.vbe',
    '.js', '.mjs', '.cjs', '.jar', '.msi', '.bin', '.php', '.phtml',
    '.py', '.cgi', '.pl', '.com', '.scr', '.pif', '.hta', '.dll', '.so'
]);

const SAFE_DOCUMENT_EXTENSIONS = new Set([
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt',
    '.png', '.jpg', '.jpeg', '.webp', '.dwg', '.dxf', '.stp', '.step',
    '.zip', '.rar', '.7z', '.xml', '.json'
]);

const SAFE_IMAGE_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'
]);

const DEFAULT_UPLOAD_LIMITS = {
    fileSize: 25 * 1024 * 1024, // 25 MB máximo por arquivo
    files: 10
};

const IMAGE_UPLOAD_LIMITS = {
    fileSize: 10 * 1024 * 1024, // 10 MB para fotos
    files: 5
};

/**
 * Cria um filtro Multer seguro que bloqueia executáveis e restringe extensões
 * @param {Set<string>|Array<string>} [allowedExtensions] - Lista opcional de extensões permitidas
 */
function createSafeFileFilter(allowedExtensions = SAFE_DOCUMENT_EXTENSIONS) {
    const allowed = new Set(Array.from(allowedExtensions).map(ext => ext.toLowerCase()));

    return function safeFileFilter(req, file, cb) {
        const ext = path.extname(file.originalname || '').toLowerCase();

        // 1. Bloqueio imediato de executáveis e scripts maliciosos
        if (DANGEROUS_EXTENSIONS.has(ext)) {
            return cb(new Error(`O tipo de arquivo '${ext}' é proibido por motivos de segurança.`));
        }

        // 2. Validação contra a whitelist permitida
        if (allowed.size > 0 && !allowed.has(ext)) {
            return cb(new Error(`Extensão '${ext}' não autorizada. Extensões permitidas: ${Array.from(allowed).join(', ')}`));
        }

        cb(null, true);
    };
}

module.exports = {
    DANGEROUS_EXTENSIONS,
    SAFE_DOCUMENT_EXTENSIONS,
    SAFE_IMAGE_EXTENSIONS,
    DEFAULT_UPLOAD_LIMITS,
    IMAGE_UPLOAD_LIMITS,
    createSafeFileFilter
};
