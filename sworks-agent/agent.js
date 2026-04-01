/**
 * Agente Local SolidWorks - MetalFisa
 * Este script deve rodar na máquina do projetista.
 * Ele cria um servidor local que expõe propriedades do SolidWorks ativo para a aplicação Web (React).
 */

const express = require('express');
const cors = require('cors');
const { execSync } = require('child_process');
const path = require('path');

const app = express();
const PORT = 3005;

// Caminho absoluto para o script PowerShell
const PS_SCRIPT = path.join(__dirname, 'get_sw_data.ps1');

// Configurar CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

/**
 * Função Auxiliar para rodar PowerShell
 */
function runPowerShell(action) {
  try {
    // Executa e força o formato do output
    const result = execSync(`powershell -Sta -ExecutionPolicy Bypass -File "${PS_SCRIPT}" ${action}`, {
       encoding: 'utf8',
       windowsHide: true
    });
    
    // O PowerShell pode imprimir quebra de linhas, então faremos trim e parse
    const rawData = result.trim();
    if (!rawData) {
        throw new Error('Retorno vazio do script PowerShell.');
    }
    return JSON.parse(rawData);
  } catch (err) {
    if (err.stdout) {
       try {
           return JSON.parse(err.stdout.toString().trim());
       } catch (e) { } // ignora parse erro no stdout se ja deu erro forte
    }
    
    throw new Error('Falha ao executar rotina do SolidWorks: ' + err.message);
  }
}

// ==========================================
// ROTAS DA API
// ==========================================

app.get('/api/status', (req, res) => {
  try {
    const data = runPowerShell('status');
    res.json(data);
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.get('/api/properties', (req, res) => {
  try {
    const data = runPowerShell('properties');
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/geometry', (req, res) => {
  try {
    const data = runPowerShell('geometry');
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// ==========================================
// INICIALIZAÇÃO
// ==========================================
app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🤖 Agente SolidWorks MetalFisa INICIADO`);
  console.log(`======================================================`);
  console.log(`🟢 Servidor escutando na porta HTTP: ${PORT}`);
  console.log(`📡 Aplicacao Web agora pode se conectar para ler o SW.`);
  console.log(`\n⚠️ Mantenha esta janela aberta enquanto usar o sistema.`);
  console.log(`======================================================\n`);
});
