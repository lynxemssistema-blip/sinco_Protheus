import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function captureScreenshots() {
    console.log("Iniciando Puppeteer...");
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    // Set viewport to a standard desktop size
    await page.setViewport({ width: 1366, height: 768 });

    console.log("Navegando para o Login...");
    await page.goto('http://localhost:5173/login');
    
    // Fill login
    console.log("Preenchendo credenciais...");
    await page.waitForSelector('input[type="text"]', { timeout: 10000 });
    const inputs = await page.$$('input');
    await inputs[0].type('edson');
    await inputs[1].type('10207597');
    
    console.log("Fazendo login...");
    await page.click('button[type="submit"]');
    
    // Wait for the app to load
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(e => console.log('Navigation timeout, continuing...'));
    await delay(3000); // Give it some time to finish loading

    const outDir = path.join(__dirname, '..', 'client', 'public', 'help-images');
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    const pagesToCapture = [
        { route: '/pcp/visao-fabrica', file: 'pcp_visao_fabrica.png' },
        { route: '/controle-producao', file: 'controle_producao.png' },
        { route: '/pcp/planejador-avancado', file: 'pcp_planejador.png' },
        { route: '/producao-matrix', file: 'producao_matrix.png' },
        { route: '/pcp-refinado/capacidade', file: 'pcp_capacidade.png' }
    ];

    for (const p of pagesToCapture) {
        console.log(`Navegando para ${p.route}...`);
        await page.goto(`http://localhost:5173${p.route}`, { waitUntil: 'networkidle0' });
        await delay(5000); // Wait for data to load
        
        // Remove the floating help button and sidebar to make the screenshot cleaner
        await page.evaluate(() => {
            const btn = document.querySelector('button[title="Ajuda desta tela"]');
            if (btn) btn.remove();
            const sidebar = document.querySelector('aside');
            if (sidebar) sidebar.style.display = 'none'; // hide sidebar
        });
        
        console.log(`Capturando print de ${p.route}...`);
        
        // Try to capture main content, otherwise capture full page
        const mainContent = await page.$('main > div.flex-1');
        if (mainContent) {
            await mainContent.screenshot({ path: path.join(outDir, p.file) });
        } else {
            await page.screenshot({ path: path.join(outDir, p.file) });
        }
        console.log(`Salvo em ${p.file}`);
    }

    await browser.close();
    console.log("Finalizado!");
}

captureScreenshots().catch(console.error);
