import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    X, Printer, CheckCircle, XCircle, Loader2, AlertTriangle,
    Package, ChevronLeft, ChevronRight, Copy, Hash, List, Download, Wifi, WifiOff,
    Settings, Search, Network, ShieldCheck, RefreshCw
} from 'lucide-react';
import JsBarcode from 'jsbarcode';
import api from '../../services/api';
import {
    getCompany,
    getCompanyLegalName,
    getCompanyShortName,
    getCompanyLogoBase64,
    loadCompanyBranding
} from '../../services/companyBranding';

// ── Componente: modal de configuração do Print Agent ──────────────────────────
function PrintSetupModal({ onClose, localAgentUrl, onSave }) {
    const [hostInput, setHostInput]         = useState('');
    const [agentUrlInput, setAgentUrlInput] = useState(localAgentUrl === 'http://localhost:9101' ? '' : localAgentUrl);
    const [printerNameInput, setPrinterNameInput] = useState(localStorage.getItem('@lynxems:localPrinterName') || '');
    const [steps, setSteps]                 = useState([]);
    const [running, setRunning]             = useState(false);
    const [discovered, setDiscovered]       = useState(null);
    const [scanning, setScanning]           = useState(false);
    const [installedPrinters, setInstalledPrinters] = useState([]);
    const [loadingInstalled, setLoadingInstalled]   = useState(true);

    const agentBase = agentUrlInput.trim() || 'http://localhost:9101';

    // Carrega impressoras já instaladas no PC assim que o modal abre
    useEffect(() => {
        const load = async () => {
            setLoadingInstalled(true);
            try {
                const res = await fetch(`${agentBase}/status`, { signal: AbortSignal.timeout(4000) });
                if (res.ok) {
                    const data = await res.json();
                    setInstalledPrinters(data.printers || []);
                }
            } catch { /* agente offline */ }
            finally { setLoadingInstalled(false); }
        };
        load();
    }, [agentBase]);

    const addStep = (icon, text, status = 'done') =>
        setSteps(s => [...s, { icon, text, status, id: Date.now() + Math.random() }]);

    const callAgent = async (method, path, body) => {
        const res = await fetch(`${agentBase}${path}`, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined,
            signal: AbortSignal.timeout(95000),
        });
        return res.json();
    };

    const handleDiscover = async () => {
        if (!hostInput.trim()) return;
        setRunning(true);
        setSteps([]);
        setDiscovered(null);
        try {
            addStep('search', `Localizando "${hostInput}" na rede...`, 'running');
            const res = await callAgent('POST', '/setup/discover', { host: hostInput.trim() });
            if (!res.reachable || !res.ok) {
                setSteps(s => s.map((st, i) => i === s.length - 1 ? { ...st, status: 'error', text: res.error || `Host não encontrado` } : st));
            } else {
                setSteps(s => s.map((st, i) => i === s.length - 1 ? { ...st, status: 'done', text: `Encontrado: ${hostInput} (IP: ${res.ip || '?'})` } : st));
                if (res.printers.length === 0) {
                    addStep('warn', 'Nenhuma impressora compartilhada encontrada neste host.');
                } else {
                    addStep('ok', `${res.printers.length} impressora(s) encontrada(s).`);
                    setDiscovered(res);
                }
            }
        } catch (e) {
            setSteps(s => s.map((st, i) => i === s.length - 1 ? { ...st, status: 'error', text: `Erro: ${e.message}` } : st));
        } finally {
            setRunning(false);
        }
    };

    const handleInstall = async (printer, elevated = false) => {
        setRunning(true);
        if (!elevated) setSteps([]);
        try {
            addStep('install', `${elevated ? '[Admin] ' : ''}Instalando "${printer.path}"...`, 'running');
            const res = await callAgent('POST', '/setup/install', {
                printerPath: printer.path,
                printerName: printer.share || printer.name,
                elevated,
            });
            if (res.alreadyInstalled) {
                setSteps(s => s.map((st, i) => i === s.length - 1 ? { ...st, status: 'done', text: `Impressora já instalada: ${res.printerName}` } : st));
                setPrinterNameInput(res.printerName);
                addStep('ok', 'Tudo pronto! Salve as configurações.');
            } else if (res.ok) {
                setSteps(s => s.map((st, i) => i === s.length - 1 ? { ...st, status: 'done', text: `Instalada com sucesso: ${res.printerName}` } : st));
                setPrinterNameInput(res.printerName);
                addStep('ok', 'Tudo pronto! Salve as configurações.');
            } else if (res.needsElevation && !elevated) {
                setSteps(s => s.map((st, i) => i === s.length - 1 ? { ...st, status: 'warn', text: 'Precisa de permissão de administrador.' } : st));
                addStep('shield', 'Solicitando privilégios de admin... Confirme a janela UAC que aparecerá na tela.', 'running');
                await handleInstall(printer, true);
                return;
            } else {
                setSteps(s => s.map((st, i) => i === s.length - 1 ? { ...st, status: 'error', text: `Falha: ${res.error}` } : st));
            }
        } catch (e) {
            setSteps(s => s.map((st, i) => i === s.length - 1 ? { ...st, status: 'error', text: `Erro: ${e.message}` } : st));
        } finally {
            setRunning(false);
        }
    };

    const handleScanNetwork = async () => {
        setScanning(true);
        setSteps([]);
        setDiscovered(null);
        try {
            addStep('search', 'Varrendo a rede local em busca de impressoras... (pode levar 30s)', 'running');
            const res = await callAgent('POST', '/setup/scan', { filter: '' });
            if (res.printers && res.printers.length > 0) {
                setSteps(s => s.map((st, i) => i === s.length - 1 ? { ...st, status: 'done', text: `${res.printers.length} impressora(s) encontrada(s) na rede.` } : st));
                setDiscovered({ printers: res.printers });
            } else {
                setSteps(s => s.map((st, i) => i === s.length - 1 ? { ...st, status: 'warn', text: 'Nenhuma impressora encontrada. Tente pelo nome do host.' } : st));
            }
        } catch (e) {
            setSteps(s => s.map((st, i) => i === s.length - 1 ? { ...st, status: 'error', text: `Erro: ${e.message}` } : st));
        } finally {
            setScanning(false);
        }
    };

    const handleSave = () => {
        const url = agentUrlInput.trim();
        if (url) localStorage.setItem('@lynxems:agentUrl', url);
        else localStorage.removeItem('@lynxems:agentUrl');
        if (printerNameInput.trim()) localStorage.setItem('@lynxems:localPrinterName', printerNameInput.trim());
        onSave({ agentUrl: url || 'http://localhost:9101', printerName: printerNameInput.trim() });
        onClose();
    };

    const stepIcon = (step) => {
        if (step.status === 'running') return <Loader2 className="h-4 w-4 animate-spin text-indigo-500 flex-shrink-0" />;
        if (step.status === 'error')   return <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />;
        if (step.status === 'warn')    return <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />;
        if (step.icon === 'shield')    return <ShieldCheck className="h-4 w-4 text-purple-500 flex-shrink-0" />;
        return <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />;
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-violet-600 to-indigo-600">
                    <div className="flex items-center gap-2 text-white">
                        <Settings className="h-5 w-5" />
                        <div>
                            <h3 className="font-bold text-base">Configuração de Impressão</h3>
                            <p className="text-violet-200 text-xs">Agente local · Descoberta de rede · Instalação automática</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-white/70 hover:bg-white/20 rounded-full"><X className="h-4 w-4" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {/* Endereço do Print Agent */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                            <Network className="h-3.5 w-3.5 text-indigo-500" /> Endereço do Print Agent
                        </label>
                        <input
                            type="text"
                            value={agentUrlInput}
                            onChange={e => setAgentUrlInput(e.target.value)}
                            placeholder="http://192.168.1.50:9101  (vazio = localhost)"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                        <p className="text-[11px] text-gray-400">Deixe vazio se a impressora está neste PC. Preencha com o IP do PC que tem a impressora (ex: RABIT214).</p>
                    </div>

                    {/* Impressoras já instaladas neste PC */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                            <Printer className="h-3.5 w-3.5 text-green-500" /> Impressoras Instaladas neste PC
                        </label>
                        {loadingInstalled ? (
                            <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verificando impressoras instaladas...
                            </div>
                        ) : installedPrinters.length === 0 ? (
                            <p className="text-xs text-gray-400 py-1">Nenhuma impressora encontrada (agente offline ou nenhuma instalada).</p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {installedPrinters.map(p => (
                                    <button
                                        key={p}
                                        onClick={() => setPrinterNameInput(p)}
                                        className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                                            printerNameInput === p
                                                ? 'bg-green-100 border-green-400 text-green-800 font-semibold'
                                                : 'bg-white border-gray-200 text-gray-700 hover:border-indigo-300 hover:bg-indigo-50'
                                        }`}
                                    >
                                        {printerNameInput === p && <CheckCircle className="inline h-3.5 w-3.5 mr-1 text-green-600" />}
                                        {p}
                                    </button>
                                ))}
                            </div>
                        )}
                        <p className="text-[11px] text-gray-400">Clique para selecionar. Se a impressora não aparece, use a descoberta de rede abaixo.</p>
                    </div>

                    {/* Nome manual da impressora */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                            <Printer className="h-3.5 w-3.5 text-indigo-500" /> Nome da Impressora (manual)
                        </label>
                        <input
                            type="text"
                            value={printerNameInput}
                            onChange={e => setPrinterNameInput(e.target.value)}
                            placeholder="RABIT214"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                        <p className="text-[11px] text-gray-400">Editável se precisar corrigir o nome manualmente.</p>
                    </div>

                    {/* Descoberta automática */}
                    <div className="border border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50">
                        <p className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                            <Search className="h-3.5 w-3.5 text-indigo-500" /> Descoberta Automática de Rede
                        </p>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={hostInput}
                                onChange={e => setHostInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && !running && handleDiscover()}
                                placeholder="Nome do PC (ex: RABIT214) ou IP"
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                            />
                            <button
                                onClick={handleDiscover}
                                disabled={running || !hostInput.trim()}
                                className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-indigo-500 flex items-center gap-1.5"
                            >
                                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                Buscar
                            </button>
                        </div>
                        <button
                            onClick={handleScanNetwork}
                            disabled={running || scanning}
                            className="w-full flex items-center justify-center gap-2 text-xs text-indigo-600 hover:text-indigo-800 py-1.5 disabled:opacity-40"
                        >
                            {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                            Varrer toda a rede automaticamente (mais lento)
                        </button>

                        {/* Impressoras descobertas */}
                        {discovered && discovered.printers.length > 0 && (
                            <div className="space-y-2 pt-1">
                                <p className="text-[11px] font-semibold text-gray-500">Impressoras encontradas — clique para instalar:</p>
                                {discovered.printers.map((p, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleInstall(p)}
                                        disabled={running}
                                        className="w-full flex items-center justify-between text-left bg-white border border-indigo-200 hover:border-indigo-400 rounded-lg px-3 py-2 text-sm transition-colors disabled:opacity-40"
                                    >
                                        <div>
                                            <p className="font-semibold text-gray-800">{p.share || p.name}</p>
                                            <p className="text-xs text-gray-400 font-mono">{p.path}</p>
                                        </div>
                                        <span className="text-xs text-indigo-600 font-semibold whitespace-nowrap ml-2">Instalar →</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Log de etapas */}
                    {steps.length > 0 && (
                        <div className="space-y-1.5">
                            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Progresso</p>
                            <div className="space-y-1.5">
                                {steps.map(step => (
                                    <div key={step.id} className="flex items-start gap-2 text-sm text-gray-700">
                                        {stepIcon(step)}
                                        <span className={step.status === 'error' ? 'text-red-600' : step.status === 'warn' ? 'text-amber-700' : ''}>{step.text}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t bg-gray-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg border border-gray-200 hover:border-gray-300">Cancelar</button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg flex items-center gap-2"
                    >
                        <CheckCircle className="h-4 w-4" /> Salvar Configurações
                    </button>
                </div>
            </div>
        </div>
    );
}

const LOCAL_AGENT_URL   = 'http://localhost:9101';
const AGENT_PRINTER_KEY = '@lynxems:localPrinterName';
const AGENT_URL_KEY     = '@lynxems:agentUrl';

export default function LabelPrintModal({ items, onClose }) {
    const [selectedItems, setSelectedItems] = useState(items.map(i => {
        let defaultQtd = 0;
        if (i.qtd_faturar !== undefined) {
            defaultQtd = parseFloat(i.qtd_faturar);
        } else if (i.quantidade_solicitada !== undefined) {
            defaultQtd = parseFloat(i.quantidade_solicitada);
        } else if (i.cartQty !== undefined) {
            defaultQtd = parseFloat(i.cartQty);
        } else {
            defaultQtd = parseFloat(i.quantidade || 0);
        }
        return {
            ...i,
            _selected: true,
            _custom_nf: (i.notas_fiscais && i.notas_fiscais.length > 0 && i.notas_fiscais[0] && i.notas_fiscais[0].nota) ? i.notas_fiscais[0].nota.trim() : '',
            _custom_qtd: defaultQtd
        };
    }));
    const [previewIdx, setPreviewIdx] = useState(0);
    const [loadingConfig, setLoadingConfig] = useState(true);

    const [config, setConfig] = useState(null);
    const [logoImg, setLogoImg] = useState(null);
    const [brandingVersion, setBrandingVersion] = useState(0);

    const [copiesMode, setCopiesMode] = useState('one');
    const [customCopies, setCustomCopies] = useState(1);

    const [printProgress, setPrintProgress] = useState(null);
    
    // New states for templates
    const [configs, setConfigs] = useState([]);
    const [activeTemplateId, setActiveTemplateId] = useState('');

    const [printQuality, setPrintQuality] = useState(() => {
        return parseInt(localStorage.getItem('@lynxems:printQuality')) || 5;
    });

    const [printing, setPrinting] = useState(false);
    const [results, setResults] = useState(null);
    const [showSetup, setShowSetup] = useState(false);

    // ── Estado do Print Agent ──────────────────────────────────────────────────
    const [agentStatus, setAgentStatus] = useState('checking'); // 'checking' | 'online' | 'offline'
    const [agentPrinters, setAgentPrinters] = useState([]);
    const [localPrinterName, setLocalPrinterName] = useState(
        () => localStorage.getItem(AGENT_PRINTER_KEY) || 'ArgoxUSB'
    );
    // URL efetiva do agente (localhost ou remoto configurado)
    const [agentUrl, setAgentUrl] = useState(
        () => localStorage.getItem(AGENT_URL_KEY) || LOCAL_AGENT_URL
    );
    const [remoteAgentInput, setRemoteAgentInput] = useState(
        () => localStorage.getItem(AGENT_URL_KEY) || ''
    );

    const previewCanvasRef = useRef(null);

    const checkedItems = selectedItems.filter(i => i._selected);
    const currentItem = checkedItems[previewIdx] || checkedItems[0];

    // ── Salvar preferências ────────────────────────────────────────────────────
    useEffect(() => {
        localStorage.setItem('@lynxems:printQuality', printQuality);
    }, [printQuality]);

    const savePrinterName = (name) => {
        setLocalPrinterName(name);
        localStorage.setItem(AGENT_PRINTER_KEY, name);
    };

    // ── Verificar Print Agent (local primeiro, depois remoto configurado) ────────
    useEffect(() => {
        const checkAgent = async () => {
            const tryUrl = async (url) => {
                try {
                    const res = await fetch(`${url}/status`, { signal: AbortSignal.timeout(3000) });
                    if (res.ok) return await res.json();
                } catch { /* ignorar */ }
                return null;
            };

            // 1. Tenta localhost
            let data = await tryUrl(LOCAL_AGENT_URL);
            let effectiveUrl = LOCAL_AGENT_URL;

            // 2. Se offline, tenta o agente remoto configurado (se diferente)
            const savedRemote = localStorage.getItem(AGENT_URL_KEY);
            if (!data && savedRemote && savedRemote !== LOCAL_AGENT_URL) {
                data = await tryUrl(savedRemote);
                if (data) effectiveUrl = savedRemote;
            }

            if (data) {
                setAgentUrl(effectiveUrl);
                setAgentStatus('online');
                setAgentPrinters(data.printers || []);
                if (!localStorage.getItem(AGENT_PRINTER_KEY) && data.defaultPrinter) {
                    setLocalPrinterName(data.defaultPrinter);
                }
            } else {
                setAgentStatus('offline');
            }
        };
        checkAgent();
    }, []);

    // ── Carregar branding da empresa ativa (logo + Razão Social) ─────────────
    useEffect(() => {
        loadCompanyBranding().then(() => {
            setBrandingVersion(v => v + 1);
            const compLogo = getCompanyLogoBase64();
            if (compLogo && compLogo.length > 50) {
                const img = new Image();
                img.onload = () => setLogoImg(img);
                img.src = compLogo.startsWith('data:') ? compLogo : `data:image/png;base64,${compLogo}`;
            }
        });
    }, []);

    // ── Carregar configurações da etiqueta ─────────────────────────────────────
    const applyConfig = useCallback((c) => {
        if (typeof c.label_fields === 'string') {
            try { c.label_fields = JSON.parse(c.label_fields); } catch (e) { }
        }
        setConfig(c);

        const compLogo = getCompanyLogoBase64();
        const logoToUse = (compLogo && compLogo.length > 50)
            ? compLogo
            : (c.logo_base64 ? (c.logo_base64.startsWith('data:') ? c.logo_base64 : `data:image/png;base64,${c.logo_base64}`) : null);

        if (logoToUse) {
            const img = new Image();
            img.onload = () => setLogoImg(img);
            img.src = logoToUse.startsWith('data:') ? logoToUse : `data:image/png;base64,${logoToUse}`;
        } else {
            setLogoImg(null);
        }
    }, []);

    useEffect(() => {
        api.get('/labels/config')
            .then(({ data }) => {
                if (data.configs) {
                    setConfigs(data.configs);
                }
                if (data.config) {
                    applyConfig(data.config);
                    setActiveTemplateId(data.config.id);
                }
            })
            .catch(err => {
                console.error('Erro ao carregar configs', err);
                alert('Falha ao carregar configurações de etiqueta.');
            })
            .finally(() => setLoadingConfig(false));
    }, [applyConfig]);

    const handleTemplateChange = (id) => {
        const c = configs.find(conf => String(conf.id) === String(id));
        if (c) {
            setActiveTemplateId(c.id);
            applyConfig({ ...c }); // Clone to trigger update
        }
    };

    // ── Desenhar etiqueta no Canvas ────────────────────────────────────────────
    const drawLabelToCanvas = useCallback((canvas, item) => {
        if (!canvas || !config) return;
        const ctx = canvas.getContext('2d');

        const scale = canvas.width / 600;
        ctx.setTransform(scale, 0, 0, scale, 0, 0);

        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 600, 440);

        // 1. Logo da empresa ativa (proporcionalmente ajustada ao quadrante do cabeçalho)
        if (logoImg) {
            const maxW = 155;
            const maxH = 100;
            const ratio = Math.min(maxW / logoImg.width, maxH / logoImg.height, 1);
            const renderW = Math.round(logoImg.width * ratio);
            const renderH = Math.round(logoImg.height * ratio);
            const offsetX = 10 + Math.max(0, Math.floor((maxW - renderW) / 2));
            const offsetY = 10 + Math.max(0, Math.floor((maxH - renderH) / 2));
            ctx.drawImage(logoImg, offsetX, offsetY, renderW, renderH);
        }

        // 2. Linha divisória horizontal do cabeçalho
        const separatorY = 125;
        ctx.beginPath();
        ctx.moveTo(15, separatorY);
        ctx.lineTo(585, separatorY);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = 'black';
        ctx.textBaseline = 'top';

        // Abrevia texto longo para caber na largura máxima disponível.
        const fitText = (text, maxWidth) => {
            if (!text || ctx.measureText(text).width <= maxWidth) return text;
            let chars = text;
            while (chars.length > 1 && ctx.measureText(chars + '...').width > maxWidth) {
                chars = chars.slice(0, -1);
            }
            return chars + '...';
        };

        // 3. Razão Social da empresa ativa ao lado da logo
        const legalName = getCompanyLegalName();
        const shortName = getCompanyShortName();
        if (legalName) {
            const fontSize = legalName.length > 40 ? 14 : (legalName.length > 28 ? 16 : 18);
            ctx.font = `bold ${fontSize}px Tahoma, Arial, sans-serif`;
            const maxHeaderWidth = 420; // 600 - 170 - 10
            const fittedLegalName = fitText(legalName, maxHeaderWidth);
            ctx.fillText(fittedLegalName, 170, 16);
        }

        const formatIfDate = (val, key) => {
            if (!val) return '';
            if (key === 'emissao' && typeof val === 'string' && val.length === 8 && !val.includes('-')) {
                return `${val.substring(6, 8)}/${val.substring(4, 6)}/${val.substring(0, 4)}`;
            }
            if (key === 'data_entrega' || key === 'data_entrega_pcp') {
                if (typeof val === 'string') {
                    if (val.includes('T')) {
                        return new Date(val).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
                    }
                    if (val.includes('-')) {
                        const parts = val.split('-');
                        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
                    }
                    if (val.length === 8 && !val.includes('-')) {
                        return `${val.substring(6, 8)}/${val.substring(4, 6)}/${val.substring(0, 4)}`;
                    }
                }
                if (val instanceof Date) {
                    return val.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
                }
            }
            return val;
        };

        const removeAccents = (str) => {
            if (typeof str !== 'string') return str;
            return str.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9 ./<>?;:"'`!@#$%^&*()\[\]{}_+=|\\-]/g, '');
        };

        const getFieldValue = (it, key, label = '') => {
            if (it._quantity_override && key === 'quantidade') return it._quantity_override;
            
            // Allow explicit custom NF input to override if the label clearly refers to NF 
            // (fixes legacy templates where NF might be mapped to 'pedido')
            if (it._custom_nf && label.toUpperCase().includes('NF')) {
                return removeAccents(it._custom_nf);
            }

            if (key === 'cliente') return removeAccents(it.nome_cliente || it.cliente || '');
            if (key === 'produto' || key === 'codigo_produto') {
                return removeAccents(it.codigo || it.produto || it.codigo_produto || '');
            }
            if (key === 'data_entrega') {
                return (it._pcp_prog && it._pcp_prog.data_entrega_pcp)
                    ? it._pcp_prog.data_entrega_pcp
                    : (it.entrega || it.data_entrega || '');
            }
            if (key === 'quantidade') {
                return Number(it._custom_qtd !== undefined ? it._custom_qtd : (it.quantidade || it.qtd_faturar || 0)).toString();
            }
            if (key === 'nf' || key === 'nota_fiscal') {
                return removeAccents(it._custom_nf || it.nota_fiscal || it.nf || '');
            }
            return removeAccents(it[key] || '');
        };

        const fields = config.label_fields || [];
        fields.forEach(field => {
            if (field.disabled) return;
            const rawVal = getFieldValue(item, field.dataKey, field.label);
            const val = formatIfDate(rawVal, field.dataKey);

            // Ajusta rótulo dinamicamente: substitui o marcador legado Metalfisa pelo nome da empresa ativa
            let fieldLabel = field.label || '';
            if (/metalfisa/i.test(fieldLabel)) {
                fieldLabel = fieldLabel.replace(/metalfisa/gi, shortName || 'Empresa');
            }

            if (field.barcode && val) {
                try {
                    const tmpCanvas = document.createElement('canvas');
                    JsBarcode(tmpCanvas, val, {
                        format: 'CODE128',
                        width: 2 * scale,
                        height: (field.barcodeHeight || 60) * scale,
                        displayValue: true,
                        fontSize: 12 * scale,
                        margin: 4 * scale,
                        background: '#ffffff',
                        lineColor: '#000000',
                    });
                    
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    ctx.drawImage(tmpCanvas, field.x * scale, field.y * scale);
                    ctx.setTransform(scale, 0, 0, scale, 0, 0);
                } catch (e) {
                    ctx.font = '12px Arial';
                    ctx.fillStyle = 'black';
                    ctx.fillText(`[BC: ${val}]`, field.x, field.y);
                }
            } else {
                const isBold = field.fontWeight === 'bold' || printQuality > 7;
                ctx.font = `${isBold ? 'bold' : 'normal'} ${field.fontSize}px ${field.fontFamily}`;
                ctx.fillStyle = 'black';
                const maxWidth = 600 - field.x - 10;
                // Evita sobreposição com o topo da Razão Social no cabeçalho
                const targetY = (field.x >= 170 && field.y < 48) ? 52 : field.y;
                const displayText = fitText(`${fieldLabel}${val}`, maxWidth);
                ctx.fillText(displayText, field.x, targetY);
            }
        });
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }, [config, logoImg, printQuality]);

    // ── Calcular cópias ────────────────────────────────────────────────────────
    const getCopiesForItem = (item) => {
        switch (copiesMode) {
            case 'quantity': {
                const qtyVal = item._custom_qtd !== undefined ? item._custom_qtd : (item.quantidade || item.qtd_faturar || 1);
                return Math.max(1, Math.round(parseFloat(qtyVal)));
            }
            case 'custom':
                return Math.max(1, Math.floor(customCopies));
            default:
                return 1;
        }
    };
    const totalLabels = checkedItems.reduce((sum, item) => sum + getCopiesForItem(item), 0);

    // ── Renderizar preview ─────────────────────────────────────────────────────
    useEffect(() => {
        if (previewCanvasRef.current && currentItem) {
            const copies = getCopiesForItem(currentItem);
            let itemToPreview = currentItem;
            if (copiesMode === 'quantity' && copies > 0) {
                itemToPreview = { ...currentItem, _quantity_override: `1 de ${copies}` };
            }
            drawLabelToCanvas(previewCanvasRef.current, itemToPreview);
        }
    }, [previewIdx, currentItem, config, logoImg, drawLabelToCanvas, copiesMode, customCopies, brandingVersion]);

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    // ── Impressão via Print Agent local ────────────────────────────────────────
    const handlePrint = async () => {
        if (checkedItems.length === 0 || !config) return;

        if (agentStatus !== 'online') {
            setResults([{
                item: 'Print Agent',
                ok: false,
                error: 'O Print Agent não está rodando neste computador. Baixe e inicie o Lynx Print Agent em Configurações > Etiquetas.',
            }]);
            return;
        }

        setPrinting(true);
        setResults(null);

        try {
            // Monta payloads
            const printPayload = [];
            const offscreenCanvas = document.createElement('canvas');
            offscreenCanvas.width = 1800;
            offscreenCanvas.height = 1320;

            for (const item of checkedItems) {
                const copies = getCopiesForItem(item);

                if (copiesMode === 'quantity' && copies > 0) {
                    for (let i = 1; i <= copies; i++) {
                        const itemCopy = { ...item, _quantity_override: `${i} de ${copies}` };
                        drawLabelToCanvas(offscreenCanvas, itemCopy);
                        printPayload.push({
                            itemId: `${item.pedido} (Etiqueta ${i}/${copies})`,
                            copies: 1,
                            canvasBase64: offscreenCanvas.toDataURL('image/png'),
                        });
                    }
                } else {
                    drawLabelToCanvas(offscreenCanvas, item);
                    printPayload.push({
                        itemId: `${item.pedido || item.produto || 'Item'} (${copies}x)`,
                        copies,
                        canvasBase64: offscreenCanvas.toDataURL('image/png'),
                    });
                }
            }

            const total = printPayload.length;
            setPrintProgress({ current: 0, total, status: 'Iniciando fila...' });

            const offsetX = config.print_offset_x || 0;
            const offsetY = config.print_offset_y || 0;
            const printResults = [];

            for (let idx = 0; idx < total; idx++) {
                const payloadItem = printPayload[idx];

                setPrintProgress({
                    current: idx + 1,
                    total,
                    status: `Imprimindo: ${payloadItem.itemId} (${idx + 1} de ${total})`,
                });

                try {
                    const res = await fetch(`${agentUrl}/print`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            canvasBase64: payloadItem.canvasBase64,
                            copies: payloadItem.copies,
                            printerName: localPrinterName,
                            offsetX,
                            offsetY,
                        }),
                        signal: AbortSignal.timeout(35000),
                    });

                    const data = await res.json();

                    if (data.ok) {
                        printResults.push({ item: payloadItem.itemId, ok: true });
                    } else {
                        const errMsg = (data.results || []).find(r => !r.ok)?.error
                            || data.error
                            || 'Falha ao imprimir';
                        printResults.push({ item: payloadItem.itemId, ok: false, error: errMsg });
                    }
                } catch (err) {
                    printResults.push({
                        item: payloadItem.itemId,
                        ok: false,
                        error: (err.name === 'TypeError' && err.message.includes('Failed to fetch'))
                            ? 'Print Agent fechado. Inicie o Lynx Print Agent no seu PC.'
                            : (err.name === 'AbortError' || err.name === 'TimeoutError'
                                ? 'Timeout — Print Agent não respondeu em 35s'
                                : err.message),
                    });
                }

                if (idx < total - 1) await sleep(200);
            }

            setResults(printResults);
        } catch (err) {
            setResults([{ item: 'Erro geral de processamento', ok: false, error: err.message }]);
        } finally {
            setPrinting(false);
            setPrintProgress(null);
        }
    };

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">

                {/* ── Header ──────────────────────────────────────────────────── */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-600 to-indigo-700">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Printer className="h-5 w-5 opacity-90" />
                            Impressão de Etiquetas
                        </h2>
                        <p className="text-indigo-100 text-sm mt-0.5 font-medium">
                            {totalLabels} etiqueta{totalLabels !== 1 && 's'} na fila (Argox 75x55)
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowSetup(true)}
                            title="Configurar impressora"
                            className="flex items-center gap-1.5 px-3 py-1.5 text-white/80 hover:bg-white/20 rounded-lg transition-colors text-sm font-medium"
                        >
                            <Settings className="h-4 w-4" />
                            Configurar
                        </button>
                        <button onClick={onClose} className="p-2 text-white/80 hover:bg-white/20 rounded-full transition-colors">
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* ── Modal de configuração ────────────────────────────────────── */}
                {showSetup && (
                    <PrintSetupModal
                        localAgentUrl={agentUrl}
                        onClose={() => setShowSetup(false)}
                        onSave={({ agentUrl: newUrl, printerName }) => {
                            setAgentUrl(newUrl);
                            setRemoteAgentInput(newUrl === 'http://localhost:9101' ? '' : newUrl);
                            if (printerName) setLocalPrinterName(printerName);
                            setAgentStatus('checking');
                            setTimeout(async () => {
                                try {
                                    const r = await fetch(`${newUrl}/status`, { signal: AbortSignal.timeout(3000) });
                                    if (r.ok) {
                                        const d = await r.json();
                                        setAgentStatus('online');
                                        setAgentPrinters(d.printers || []);
                                    } else setAgentStatus('offline');
                                } catch { setAgentStatus('offline'); }
                            }, 500);
                        }}
                    />
                )}

                {/* ── Banner: status do Print Agent ───────────────────────────── */}
                {agentStatus === 'checking' && (
                    <div className="bg-gray-50 border-b border-gray-200 px-6 py-2 flex items-center gap-2 text-gray-500 text-sm">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Verificando Print Agent local...
                    </div>
                )}
                {agentStatus === 'offline' && (
                    <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-amber-800 text-sm">
                            <WifiOff className="h-4 w-4 flex-shrink-0" />
                            <span><strong>Print Agent offline</strong> — O agente de impressão não está rodando neste computador.</span>
                        </div>
                        <a
                            href="/api/labels/download-agent"
                            download="Lynx-Print-Agent.ems"
                            className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ml-4"
                        >
                            <Download className="h-3.5 w-3.5" />
                            Baixar Print Agent
                        </a>
                    </div>
                )}
                {agentStatus === 'online' && (
                    <div className="bg-green-50 border-b border-green-200 px-6 py-2 flex items-center gap-2 text-green-700 text-sm">
                        <Wifi className="h-3.5 w-3.5" />
                        Print Agent online — imprimindo localmente neste computador
                    </div>
                )}

                <div className="flex flex-1 overflow-hidden">
                    {/* ── Lista de itens ───────────────────────────────────────── */}
                    <div className="w-1/3 border-r border-gray-100 flex flex-col bg-gray-50/50 min-w-[280px]">
                        <div className="p-3 border-b border-gray-100 bg-white">
                            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Itens a Imprimir</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {selectedItems.map((item, idx) => (
                                <div
                                    key={idx}
                                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors border
                                        ${item._selected ? 'border-indigo-200 bg-indigo-50/50' : 'border-transparent hover:bg-gray-100'}`}
                                    onClick={() => {
                                        const newItems = [...selectedItems];
                                        newItems[idx] = { ...newItems[idx], _selected: !newItems[idx]._selected };
                                        setSelectedItems(newItems);
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={item._selected}
                                        readOnly
                                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <div
                                        className="flex-1 min-w-0"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setPreviewIdx(checkedItems.findIndex(i => i === item));
                                        }}
                                    >
                                        <div className="flex justify-between items-center">
                                            <p className="text-sm font-medium text-gray-800 truncate">{item.produto || item.item}</p>
                                            <span className="text-xs font-semibold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">
                                                {getCopiesForItem(item)}x
                                            </span>
                                        </div>
                                        <div className="flex flex-col mt-1">
                                            <p className="text-[10px] text-gray-500">Ped: {item.pedido}</p>
                                            <div className="flex items-center gap-2 mt-1.5" onClick={e => e.stopPropagation()}>
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[10px] font-semibold text-gray-600">NF:</span>
                                                    <input
                                                        list={`nfs-list-${idx}`}
                                                        type="text"
                                                        placeholder="Nº NF"
                                                        className="text-[10px] p-0.5 px-1 border border-gray-300 rounded w-16 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 text-gray-800"
                                                        value={item._custom_nf || ''}
                                                        onChange={(e) => {
                                                            const newItems = [...selectedItems];
                                                            newItems[idx] = { ...newItems[idx], _custom_nf: e.target.value };
                                                            setSelectedItems(newItems);
                                                        }}
                                                    />
                                                    {item.notas_fiscais && item.notas_fiscais.length > 0 && (
                                                        <datalist id={`nfs-list-${idx}`}>
                                                            {item.notas_fiscais.filter(nf => nf && nf.nota && nf.nota.trim()).map((nf, nfIdx) => (
                                                                <option key={nfIdx} value={nf.nota} />
                                                            ))}
                                                        </datalist>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[10px] font-semibold text-gray-600">Qtd:</span>
                                                    <input
                                                        type="number"
                                                        placeholder="Qtd"
                                                        className="text-[10px] p-0.5 px-1 border border-gray-300 rounded w-14 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 text-gray-800"
                                                        value={item._custom_qtd !== undefined ? item._custom_qtd : ''}
                                                        onChange={(e) => {
                                                            const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                                                            const newItems = [...selectedItems];
                                                            newItems[idx] = { ...newItems[idx], _custom_qtd: val };
                                                            setSelectedItems(newItems);
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── Preview ──────────────────────────────────────────────── */}
                    <div className="flex-1 flex flex-col bg-gray-50">
                        {loadingConfig ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                                <Loader2 className="h-8 w-8 animate-spin mb-3" />
                                Carregando configuração visual...
                            </div>
                        ) : checkedItems.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                                <Package className="h-12 w-12 mb-3 text-gray-300" />
                                <p>Nenhum item selecionado</p>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col">
                                <div className="flex-1 p-6 flex flex-col items-center justify-center overflow-auto">
                                    <div className="bg-white p-1 rounded-sm shadow-xl border-2 border-gray-800 transition-all duration-300 relative">
                                        <canvas
                                            ref={previewCanvasRef}
                                            width={1800}
                                            height={1320}
                                            className="bg-white"
                                            style={{ width: '400px', height: '293px' }}
                                        />
                                        <div className="absolute -bottom-8 left-0 right-0 text-center text-xs text-gray-400 font-medium tracking-wide">
                                            Área Real: 75mm × 55mm (600×440 px)
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 bg-white border-t border-gray-100 flex items-center justify-between">
                                    <button
                                        onClick={() => setPreviewIdx(p => Math.max(0, p - 1))}
                                        disabled={previewIdx === 0}
                                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                    >
                                        <ChevronLeft className="h-5 w-5" />
                                    </button>
                                    <div className="text-sm font-medium text-gray-700 bg-gray-100 px-4 py-1.5 rounded-full">
                                        Item {previewIdx + 1} de {checkedItems.length}
                                    </div>
                                    <button
                                        onClick={() => setPreviewIdx(p => Math.min(checkedItems.length - 1, p + 1))}
                                        disabled={previewIdx >= checkedItems.length - 1}
                                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                    >
                                        <ChevronRight className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Painel de configurações (direita) ────────────────────── */}
                    <div className="w-1/4 border-l border-gray-100 flex flex-col bg-white min-w-[240px]">
                        <div className="p-4 border-b border-gray-100">
                            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                <List className="h-4 w-4 text-indigo-500" />
                                Ajustes Rápidos
                            </h3>
                        </div>

                        <div className="p-4 space-y-5 flex-1 overflow-y-auto">
                            {/* Seleção de Modelo */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Modelo de Etiqueta</label>
                                <select
                                    value={activeTemplateId || ''}
                                    onChange={e => handleTemplateChange(e.target.value)}
                                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 font-medium text-gray-800"
                                >
                                    {configs.map(c => (
                                        <option key={c.id} value={c.id}>{c.name} {c.is_default ? '(Padrão)' : ''}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Qualidade / Densidade */}
                            <div className="space-y-2 pt-4 border-t border-gray-100">
                                <div className="flex justify-between items-end">
                                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Qualidade / Espessura</label>
                                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{printQuality}</span>
                                </div>
                                <input
                                    type="range"
                                    min="1" max="10"
                                    value={printQuality}
                                    onChange={(e) => setPrintQuality(parseInt(e.target.value))}
                                    className="w-full accent-indigo-600"
                                />
                                <p className="text-[10px] text-gray-400 leading-tight">
                                    Aumente para texto mais espesso e escuro.
                                </p>
                            </div>

                            {/* Agente remoto */}
                            <div className="space-y-2 pt-4 border-t border-gray-100">
                                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Print Agent (endereço)
                                </label>
                                <input
                                    type="text"
                                    value={remoteAgentInput}
                                    onChange={e => setRemoteAgentInput(e.target.value)}
                                    onBlur={() => {
                                        const val = remoteAgentInput.trim();
                                        if (val) {
                                            localStorage.setItem(AGENT_URL_KEY, val);
                                        } else {
                                            localStorage.removeItem(AGENT_URL_KEY);
                                        }
                                    }}
                                    placeholder="http://192.168.1.50:9101"
                                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono"
                                />
                                <p className="text-[10px] text-gray-400 leading-tight">
                                    Deixe vazio para usar o agente local. Preencha com o IP do PC que tem a impressora (ex: <span className="font-mono">http://192.168.1.50:9101</span>).
                                </p>
                            </div>

                            {/* Impressora local */}
                            <div className="space-y-2 pt-4 border-t border-gray-100">
                                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Impressora neste PC
                                </label>
                                {agentStatus === 'online' && agentPrinters.length > 0 ? (
                                    <select
                                        value={localPrinterName}
                                        onChange={e => savePrinterName(e.target.value)}
                                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                    >
                                        {agentPrinters.map(p => (
                                            <option key={p} value={p}>{p}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        value={localPrinterName}
                                        onChange={e => savePrinterName(e.target.value)}
                                        placeholder="ArgoxUSB"
                                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                    />
                                )}
                                <p className="text-[10px] text-gray-400 leading-tight">
                                    Nome exato da impressora instalada no Windows.
                                </p>
                            </div>

                            {/* Instruções quando offline */}
                            {agentStatus === 'offline' && (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 space-y-2">
                                    <p className="font-semibold">Como instalar o Print Agent:</p>
                                    <ol className="list-decimal list-inside space-y-1">
                                        <li>Baixe o arquivo <em>Lynx-Print-Agent.ems</em></li>
                                        <li>Renomeie para <em>Lynx-Print-Agent.exe</em></li>
                                        <li>Execute o arquivo para iniciar o agente</li>
                                        <li>Reabra este modal para imprimir</li>
                                    </ol>
                                    <a
                                        href="/api/labels/download-agent"
                                        download="Lynx-Print-Agent.ems"
                                        className="flex items-center gap-1.5 font-semibold text-amber-800 hover:text-amber-900 mt-2"
                                    >
                                        <Download className="h-3.5 w-3.5" />
                                        Baixar Print Agent
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Footer de ação ────────────────────────────────────────────── */}
                <div className="bg-gray-50 border-t border-gray-200 p-5 flex items-end justify-between">

                    {/* Modo de cópias */}
                    <div className="flex gap-6">
                        <div className="space-y-3">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Modo de Quantidade</label>
                            <div className="flex gap-2 bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
                                <button
                                    onClick={() => setCopiesMode('one')}
                                    className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-all ${copiesMode === 'one' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                                >
                                    <CheckCircle className="h-4 w-4 opacity-70" /> 1 por Item
                                </button>
                                <button
                                    onClick={() => setCopiesMode('quantity')}
                                    className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-all ${copiesMode === 'quantity' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                                >
                                    <Package className="h-4 w-4 opacity-70" /> Usar Qtd. do Item
                                </button>
                                <button
                                    onClick={() => setCopiesMode('custom')}
                                    className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-all ${copiesMode === 'custom' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                                >
                                    <Copy className="h-4 w-4 opacity-70" /> Fixa
                                </button>
                            </div>
                        </div>

                        {copiesMode === 'custom' && (
                            <div className="space-y-3">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Cópias Fixas</label>
                                <div className="relative shadow-sm rounded-lg">
                                    <Hash className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="number"
                                        min="1"
                                        value={customCopies}
                                        onChange={e => setCustomCopies(parseInt(e.target.value) || 1)}
                                        className="pl-9 pr-4 py-2.5 w-28 border border-gray-200 rounded-lg text-sm font-bold text-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Progresso + botão imprimir */}
                    <div className="flex items-center gap-4">
                        {printProgress && (
                            <div className="flex flex-col gap-1.5 w-64 text-left">
                                <div className="flex justify-between text-[11px] font-bold text-indigo-700">
                                    <span className="truncate max-w-[200px]">{printProgress.status}</span>
                                    <span>{Math.round((printProgress.current / printProgress.total) * 100)}%</span>
                                </div>
                                <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden shadow-inner">
                                    <div
                                        className="h-full bg-indigo-600 rounded-full transition-all duration-200"
                                        style={{ width: `${(printProgress.current / printProgress.total) * 100}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {results && !printProgress && (
                            <div className="text-sm font-medium max-w-xs">
                                {results.every(r => r.ok) ? (
                                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-50 border border-green-200 text-green-700">
                                        <CheckCircle className="h-4 w-4 flex-shrink-0" />
                                        <span>Enviado com sucesso!</span>
                                    </div>
                                ) : (
                                    <div className="px-4 py-2 rounded-lg bg-red-50 border border-red-200 space-y-1">
                                        <div className="flex items-center gap-2 text-red-700">
                                            <XCircle className="h-4 w-4 flex-shrink-0" />
                                            <span className="font-semibold">
                                                {results.filter(r => !r.ok).length === results.length
                                                    ? 'Falha na impressão'
                                                    : `Falha em ${results.filter(r => !r.ok).length} item(s)`}
                                            </span>
                                        </div>
                                        {results.filter(r => !r.ok).slice(0, 3).map((r, i) => (
                                            <p key={i} className="text-xs text-red-500 leading-tight">
                                                {r.error}
                                            </p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <button
                            onClick={handlePrint}
                            disabled={printing || checkedItems.length === 0 || loadingConfig || agentStatus === 'checking'}
                            className={`flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-white shadow-lg transition-all
                                ${printing || checkedItems.length === 0 || loadingConfig || agentStatus === 'checking'
                                    ? 'bg-gray-400 cursor-not-allowed shadow-none'
                                    : agentStatus === 'offline'
                                        ? 'bg-amber-500 hover:bg-amber-400 hover:shadow-amber-500/25 active:scale-95'
                                        : 'bg-indigo-600 hover:bg-indigo-500 hover:shadow-indigo-500/25 active:scale-95'
                                }`}
                        >
                            {printing ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : agentStatus === 'offline' ? (
                                <AlertTriangle className="h-5 w-5" />
                            ) : (
                                <Printer className="h-5 w-5" />
                            )}
                            {printing
                                ? 'Imprimindo...'
                                : agentStatus === 'offline'
                                    ? 'Agente Offline'
                                    : `Imprimir ${totalLabels} Etiqueta${totalLabels !== 1 ? 's' : ''}`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
