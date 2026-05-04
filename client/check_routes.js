import fs from 'fs';

const appJsx = fs.readFileSync('src/App.jsx', 'utf8');
const menuItemsStr = fs.readFileSync('src/config/menuItems.js', 'utf8');

// Extract paths from menuItems.js
const menuPaths = [...menuItemsStr.matchAll(/path:\s*['"]([^'"]+)['"]/g)].map(m => m[1]).filter(p => p !== '#');

// Extract routes from App.jsx
const appRoutes = [...appJsx.matchAll(/<Route\s+path=['"]([^'"]+)['"]/g)].map(m => m[1]);

const missingInApp = menuPaths.filter(p => !appRoutes.includes(p));
const definedButNotInMenu = appRoutes.filter(p => !menuPaths.includes(p) && !p.includes(':') && p !== '/' && p !== '/login');

console.log('--- Paths in Menu but MISSING in App.jsx (Broken Links) ---');
console.log(missingInApp.length ? missingInApp : 'None');

console.log('\n--- Paths in App.jsx but NOT in Menu ---');
console.log(definedButNotInMenu.length ? definedButNotInMenu : 'None');
