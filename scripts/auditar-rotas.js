// Auditoria estática (somente leitura) de segurança das rotas Express.
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'server', 'routes');
const out = { files: [], totals: {} };
let total = 0, sqlInterp = 0, noAuthInline = 0;

for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    const lines = src.split(/\r?\n/);
    const routeRe = /router\.(get|post|put|patch|delete|all)\(\s*(['"`])([^'"`]*)\2\s*(,\s*[^=]*?)?=>|router\.(get|post|put|patch|delete|all)\(\s*(['"`])([^'"`]*)\6\s*,([^\n]*)/;
    const routerUse = lines.filter(l => /router\.use\(/.test(l)).map(l => l.trim());
    const routes = [];
    const interp = [];
    const uploads = /multer\(/.test(src);
    const execs = lines.map((l, i) => [l, i + 1]).filter(([l]) => /child_process|\bexec\(|execSync|spawn\(|eval\(|new Function\(/.test(l)).map(([l, i]) => `${i}: ${l.trim().slice(0, 90)}`);
    const fsPaths = lines.map((l, i) => [l, i + 1]).filter(([l]) => /(readFile|createReadStream|sendFile|unlink|writeFile|download)\w*\([^)]*req\.(params|query|body)/.test(l)).map(([l, i]) => `${i}: ${l.trim().slice(0, 100)}`);
    lines.forEach((l, i) => {
        const m = l.match(/router\.(get|post|put|patch|delete|all)\(\s*['"`]([^'"`]*)['"`]\s*(,.*)?$/);
        if (m) {
            const rest = m[3] || '';
            const mws = (rest.match(/\b(authenticateToken|requireRole|requireAdmin|requirePermission|checkPermission|requireSuperAdmin|authorize\w*|isAdmin\w*|verify\w*|upload\.\w+\([^)]*\)|[a-zA-Z]*Limiter)\b/g) || []);
            routes.push({ line: i + 1, method: m[1].toUpperCase(), path: m[2], mws });
            total++;
        }
        // interpolação em SQL
        if (/\.query\(\s*`[^`]*\$\{/.test(l) || /(SELECT|INSERT|UPDATE|DELETE)[^`'"]*['"`]\s*\+\s*(req\.|[a-zA-Z_]+\b)/i.test(l) && /\+\s*req\./.test(l)) {
            interp.push(`${i + 1}: ${l.trim().slice(0, 140)}`); sqlInterp++;
        }
    });
    // consultas multi-linha com template e ${req.
    const multi = [...src.matchAll(/query\(\s*`([\s\S]*?)`/g)].filter(m => /\$\{\s*req\.(params|query|body)/.test(m[1])).length;
    out.files.push({ file: f, routes: routes.length, routerUse, uploads, execs, fsPaths, interpLines: interp.length, interpSample: interp.slice(0, 4), multiReqInterp: multi,
        publicHint: routes.filter(r => !r.mws.length).length });
}
fs.writeFileSync(path.join(__dirname, '..', '_arquivo_morto', 'auditoria_rotas.json'), JSON.stringify(out, null, 1));
const top = out.files.filter(f => f.interpLines || f.multiReqInterp || f.execs.length || f.fsPaths.length);
console.log('arquivos de rota:', out.files.length, '| endpoints:', total, '| linhas SQL com interpolacao:', sqlInterp);
top.forEach(f => console.log(`\n## ${f.file} routes=${f.routes} interp=${f.interpLines} multiReq=${f.multiReqInterp} uploads=${f.uploads}\n` +
    (f.execs.length ? '  EXEC: ' + f.execs.slice(0, 3).join(' | ') + '\n' : '') +
    (f.fsPaths.length ? '  FS: ' + f.fsPaths.slice(0, 3).join(' | ') + '\n' : '') +
    f.interpSample.map(s => '  SQL ' + s).join('\n')));
