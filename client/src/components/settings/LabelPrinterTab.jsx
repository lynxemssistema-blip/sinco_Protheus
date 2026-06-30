import React, { useState, useEffect, useRef } from 'react';
import {
    Printer, Wifi, Usb, Upload, Plus, Trash2, Save,
    CheckCircle, XCircle, Loader2, GripVertical, ChevronUp, ChevronDown, ImageIcon,
    Type, Bold, Eye, EyeOff, Download, HelpCircle, BarChart2, Move, WifiOff, Terminal
} from 'lucide-react';
import JsBarcode from 'jsbarcode';
import api from '../../services/api';

const AGENT_URL         = 'http://localhost:9101';
const AGENT_PRINTER_KEY = '@metalfisa:localPrinterName';

// Mapa de campos disponíveis para o layout da etiqueta
const AVAILABLE_FIELDS = [
    { key: 'pedido',       label: 'Número do Pedido (Sistema)' },
    { key: 'ped_cliente',  label: 'Número do Pedido (Cliente)' },
    { key: 'cliente',      label: 'Nome do Cliente' },
    { key: 'produto',      label: 'Código do Produto' },
    { key: 'ref_cliente',  label: 'Número do Desenho (Cliente)' },
    { key: 'descricao',    label: 'Descrição do Produto' },
    { key: 'quantidade',   label: 'Quantidade' },
    { key: 'data_entrega', label: 'Data de Entrega' },
    { key: 'emissao',      label: 'Data de Emissão do Pedido' },
    { key: 'item',         label: 'Item do Pedido' },
    { key: 'nf',           label: 'Número da NF' },
];

const FONTS = ['Arial', 'Tahoma', 'Courier New', 'Impact', 'Times New Roman'];

export default function LabelPrinterTab() {
    const [configs, setConfigs] = useState([]);
    const [activeConfigId, setActiveConfigId] = useState(null);

    const [config, setConfig] = useState({
        name: 'Modelo Padrão',
        is_default: true,
        printer_mode: 'tcp',
        printer_host: '192.168.1.100',
        printer_port: 9100,
        print_offset_x: 0,
        print_offset_y: 0,
        label_fields: [
            { label: 'Pedido: ',    dataKey: 'pedido', fontFamily: 'Arial', fontSize: 24, fontWeight: 'bold', x: 20, y: 140 },
            { label: 'Produto: ',   dataKey: 'produto', fontFamily: 'Arial', fontSize: 24, fontWeight: 'normal', x: 20, y: 180 },
            { label: 'Desc: ',      dataKey: 'descricao', fontFamily: 'Arial', fontSize: 22, fontWeight: 'normal', x: 20, y: 220 },
            { label: 'Qtd: ',       dataKey: 'quantidade', fontFamily: 'Arial', fontSize: 24, fontWeight: 'normal', x: 20, y: 260 },
            { label: 'Entrega: ',   dataKey: 'data_entrega', fontFamily: 'Arial', fontSize: 24, fontWeight: 'normal', x: 20, y: 300 },
        ],
    });

    const [loading, setLoading]       = useState(true);
    const [saving, setSaving]         = useState(false);
    const [testing, setTesting]       = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [showHelpModal, setShowHelpModal] = useState(false);

    const [logoPreview, setLogoPreview] = useState(null); // base64 da logo
    const [logoImg, setLogoImg] = useState(null); // Image object for canvas
    const [logoUploading, setLogoUploading] = useState(false);

    const fileInputRef = useRef(null);
    const canvasRef = useRef(null);

    // ── Buscar configuração ao montar ──────────────────────────────────────────
    const applyConfig = (conf) => {
        const fields = (conf.label_fields || []).map((f, i) => ({
            ...f,
            fontFamily: f.fontFamily || 'Arial',
            fontSize: f.fontSize || 24,
            fontWeight: f.fontWeight || 'normal',
            x: f.x || 20,
            y: f.y || (140 + i * 40),
        }));
        
        setConfig({ ...conf, label_fields: fields });
        setActiveConfigId(conf.id);
        
        if (conf.logo_base64) {
            const base64 = `data:image/png;base64,${conf.logo_base64}`;
            setLogoPreview(base64);
            loadLogoImage(base64);
        } else {
            setLogoPreview(null);
            setLogoImg(null);
        }
    };

    const fetchConfigs = () => {
        setLoading(true);
        api.get('/labels/config')
            .then(({ data }) => {
                if (data.configs && data.configs.length > 0) {
                    setConfigs(data.configs);
                    const initialConfig = data.configs.find(c => c.is_default) || data.configs[0];
                    applyConfig(initialConfig);
                } else if (data.config) {
                    setConfigs([data.config]);
                    applyConfig(data.config);
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchConfigs();
    }, []);

    const handleTemplateChange = (id) => {
        const conf = configs.find(c => c.id === parseInt(id));
        if (conf) applyConfig(conf);
    };

    const handleCreateTemplate = async () => {
        const name = prompt("Nome do novo modelo:", config.name ? config.name + ' (Cópia)' : 'Novo Modelo');
        if (!name) return;
        
        try {
            setSaving(true);
            const { data } = await api.post('/labels/config/new', { ...config, name, is_default: false });
            if (data.ok) {
                const res = await api.get('/labels/config');
                setConfigs(res.data.configs);
                const newConf = res.data.configs.find(c => c.id === data.insertId);
                if (newConf) applyConfig(newConf);
            }
        } catch (err) {
            alert('Erro ao criar modelo: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteTemplate = async () => {
        if (!activeConfigId) return;
        if (!confirm(`Tem certeza que deseja excluir o modelo "${config.name}"?`)) return;
        
        try {
            setSaving(true);
            const { data } = await api.delete(`/labels/config/${activeConfigId}`);
            if (data.ok) {
                fetchConfigs();
            }
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao excluir modelo');
        } finally {
            setSaving(false);
        }
    };

    const loadLogoImage = (src) => {
        const img = new Image();
        img.onload = () => setLogoImg(img);
        img.src = src;
    };

    // ── Renderizar no Canvas WYSIWYG ───────────────────────────────────────────
    useEffect(() => {
        if (!canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        
        // Limpar fundo (Branco)
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 600, 440);

        // Desenhar logo
        if (logoImg) {
            ctx.drawImage(logoImg, 10, 10);
            
            // Linha separadora abaixo da logo (apenas p/ manter estética anterior)
            ctx.beginPath();
            ctx.moveTo(20, logoImg.height + 20);
            ctx.lineTo(580, logoImg.height + 20);
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // Desenhar campos de texto / código de barras
        ctx.fillStyle = 'black';
        ctx.textBaseline = 'top';

        config.label_fields.forEach(field => {
            if (field.disabled) return;

            // 1. Sempre desenha o texto (rótulo + valor)
            const fontStr = `${field.fontWeight === 'bold' ? 'bold' : 'normal'} ${field.fontSize}px ${field.fontFamily}`;
            ctx.font = fontStr;
            const text = `${field.label}[${AVAILABLE_FIELDS.find(f => f.key === field.dataKey)?.label || field.dataKey}]`;
            ctx.fillText(text, field.x, field.y);

            // 2. Se for código de barras, renderiza o código logo abaixo do texto
            if (field.barcode) {
                try {
                    const tmpCanvas = document.createElement('canvas');
                    // No preview WYSIWYG, usamos um valor fixo seguro para evitar "Barcode Error"
                    const barcodeValue = "123456789";
                    
                    JsBarcode(tmpCanvas, barcodeValue, {
                        format: 'CODE128',
                        width: 2,
                        height: field.barcodeHeight || 60,
                        displayValue: true,
                        fontSize: 12,
                        margin: 4,
                        background: '#ffffff',
                        lineColor: '#000000',
                    });
                    
                    const barcodeY = field.y + parseInt(field.fontSize || 24) + 5;
                    ctx.drawImage(tmpCanvas, field.x, barcodeY);
                } catch (e) {
                    ctx.fillStyle = 'red';
                    ctx.font = '12px Arial';
                    ctx.fillText('[Barcode Error]', field.x, field.y + parseInt(field.fontSize || 24) + 5);
                    ctx.fillStyle = 'black';
                }
            }
        });

    }, [config.label_fields, logoImg]);


    const [printingTest, setPrintingTest] = useState(false);

    // ── Estado do Print Agent local ────────────────────────────────────────────
    const [agentStatus, setAgentStatus]       = useState('checking');
    const [agentPrinters, setAgentPrinters]   = useState([]);
    const [localPrinterName, setLocalPrinterName] = useState(
        () => localStorage.getItem(AGENT_PRINTER_KEY) || 'ArgoxUSB'
    );

    useEffect(() => {
        const check = async () => {
            try {
                const res = await fetch(`${AGENT_URL}/status`, { signal: AbortSignal.timeout(3000) });
                if (res.ok) {
                    const data = await res.json();
                    setAgentStatus('online');
                    setAgentPrinters(data.printers || []);
                } else {
                    setAgentStatus('offline');
                }
            } catch {
                setAgentStatus('offline');
            }
        };
        check();
    }, []);

    const saveLocalPrinter = (name) => {
        setLocalPrinterName(name);
        localStorage.setItem(AGENT_PRINTER_KEY, name);
    };

    const downloadSetupScript = () => {
        const content = `@echo off
echo ========================================================
echo Instalando impressora ArgoxUSB para o Sistema MetalFisa...
echo ========================================================
echo.
powershell -Command "Add-Printer -Name 'ArgoxUSB' -DriverName 'Generic / Text Only' -PortName 'USB001' -Shared -ShareName 'ArgoxUSB'"
if %errorlevel% neq 0 (
    echo.
    echo Ocorreu um erro! O driver "Generic / Text Only" ou a porta "USB001" podem nao existir no computador.
    echo Consulte a Ajuda Manual no Sistema!
) else (
    echo.
    echo Impressora instalada e compartilhada com sucesso!
)
echo.
pause`;
        const blob = new Blob([content], { type: 'application/bat' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ConfigurarImpressoraUSB.bat';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // ── Testar Impressão via Print Agent local ─────────────────────────────────
    const handlePrintTest = async () => {
        if (!canvasRef.current) return;

        if (agentStatus !== 'online') {
            alert('O Print Agent não está rodando neste computador.\nBaixe e inicie o MetalFisa Print Agent antes de testar a impressão.');
            return;
        }

        setPrintingTest(true);
        try {
            const canvasBase64 = canvasRef.current.toDataURL('image/png');
            const res = await fetch(`${AGENT_URL}/print`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    canvasBase64,
                    copies: 1,
                    printerName: localPrinterName,
                    offsetX: config.print_offset_x || 0,
                    offsetY: config.print_offset_y || 0,
                }),
                signal: AbortSignal.timeout(35000),
            });
            const data = await res.json();
            if (data.ok) {
                alert('Teste de impressão enviado com sucesso!');
            } else {
                const errMsg = (data.results || []).find(r => !r.ok)?.error || data.error || 'Erro desconhecido';
                alert('Falha na impressão de teste:\n' + errMsg);
            }
        } catch (err) {
            alert('Erro ao imprimir teste:\n' + err.message);
        } finally {
            setPrintingTest(false);
        }
    };

    // ── Salvar configuração ────────────────────────────────────────────────────
    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put('/labels/config', {
                id: activeConfigId,
                name: config.name,
                is_default: config.is_default,
                printer_mode:   config.printer_mode,
                printer_host:   config.printer_host,
                printer_port:   config.printer_port,
                print_offset_x: config.print_offset_x,
                print_offset_y: config.print_offset_y,
                label_fields:   config.label_fields,
            });
            alert('✅ Configuração salva com sucesso!');
            // Atualiza a lista local de configs
            setConfigs(c => c.map(cf => cf.id === activeConfigId ? { ...cf, name: config.name, is_default: config.is_default } : (config.is_default ? { ...cf, is_default: false } : cf)));
        } catch (err) {
            alert('Erro ao salvar configuração: ' + (err.response?.data?.error || err.message));
        } finally {
            setSaving(false);
        }
    };

    // ── Testar conexão ─────────────────────────────────────────────────────────
    const handleTestConnection = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const host = config.printer_mode === 'usb' ? '127.0.0.1' : config.printer_host;
            const { data } = await api.post('/labels/test-connection', {
                host,
                port: config.printer_port,
            });
            setTestResult(data);
        } catch (err) {
            setTestResult({ ok: false, error: err.response?.data?.error || err.message });
        } finally {
            setTesting(false);
        }
    };

    // ── Upload de Logo ─────────────────────────────────────────────────────────
    const handleLogoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLogoUploading(true);
        const formData = new FormData();
        formData.append('logo', file);
        formData.append('id', activeConfigId);

        try {
            const { data } = await api.post('/labels/logo', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const base64 = `data:image/png;base64,${data.previewBase64}`;
            setLogoPreview(base64);
            loadLogoImage(base64);
            alert(`✅ Logo processada com sucesso!`);
        } catch (err) {
            alert('Erro ao processar logo: ' + (err.response?.data?.error || err.message));
        } finally {
            setLogoUploading(false);
        }
    };

    // ── Gerenciar linhas dinâmicas ─────────────────────────────────────────────
    const addField = () => {
        const lastField = config.label_fields[config.label_fields.length - 1];
        const newY = lastField ? lastField.y + 40 : 140;

        setConfig(c => ({
            ...c,
            label_fields: [
                ...c.label_fields,
                { label: 'Campo: ', dataKey: 'pedido', fontFamily: 'Arial', fontSize: 24, fontWeight: 'normal', x: 20, y: newY, disabled: false }
            ],
        }));
    };

    const removeField = (idx) => {
        setConfig(c => ({
            ...c,
            label_fields: c.label_fields.filter((_, i) => i !== idx),
        }));
    };

    const updateField = (idx, key, value) => {
        setConfig(c => {
            const fields = [...c.label_fields];
            fields[idx] = { ...fields[idx], [key]: value };
            return { ...c, label_fields: fields };
        });
    };

    const toggleBold = (idx) => {
        setConfig(c => {
            const fields = [...c.label_fields];
            fields[idx].fontWeight = fields[idx].fontWeight === 'bold' ? 'normal' : 'bold';
            return { ...c, label_fields: fields };
        });
    };

    const toggleDisabled = (idx) => {
        setConfig(c => {
            const fields = [...c.label_fields];
            fields[idx].disabled = !fields[idx].disabled;
            return { ...c, label_fields: fields };
        });
    };

    const moveField = (idx, dir) => {
        setConfig(c => {
            const fields = c.label_fields.map(f => ({ ...f }));
            const target = idx + dir;
            if (target < 0 || target >= fields.length) return c;

            // Faz o swap completo do campo na lista. As posições x e y acompanham o campo,
            // então a visualização no canvas reflete a mudança sem misturar propriedades.
            [fields[idx], fields[target]] = [fields[target], fields[idx]];

            return { ...c, label_fields: fields };
        });
    };

    if (loading) return (
        <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 className="h-8 w-8 animate-spin mr-3" />
            Carregando configuração...
        </div>
    );

    // Na importação de ícones do lucide-react (lá no topo do arquivo) precisaremos do Eye, EyeOff
    // Importaremos no arquivo abaixo.


    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-10">

            {/* ── Header ──────────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Printer className="h-5 w-5 text-indigo-600" />
                        Configuração de Etiquetas PPLB (Design Visual)
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Renderização em Canvas — OS-214 Plus (203 DPI · Couchê 75×55mm)
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 shadow-sm"
                >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar Configuração
                </button>
            </div>

            {/* ── Seletor de Modelo ────────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs text-gray-500 font-medium mb-1">Modelo de Etiqueta Ativo</label>
                    <select 
                        value={activeConfigId || ''} 
                        onChange={e => handleTemplateChange(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                    >
                        {configs.map(c => (
                            <option key={c.id} value={c.id}>{c.name} {c.is_default ? '(Padrão)' : ''}</option>
                        ))}
                    </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs text-gray-500 font-medium mb-1">Nome do Modelo</label>
                    <input 
                        type="text" 
                        value={config.name || ''} 
                        onChange={e => setConfig({ ...config, name: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                </div>
                <div className="flex items-end gap-2 pt-1 h-[52px]">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer mb-2 mr-4">
                        <input 
                            type="checkbox" 
                            checked={config.is_default || false} 
                            onChange={e => setConfig({ ...config, is_default: e.target.checked })}
                            className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                        />
                        Modelo Padrão
                    </label>
                    <button 
                        onClick={handleCreateTemplate}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
                    >
                        <Plus className="h-4 w-4" /> Novo
                    </button>
                    <button 
                        onClick={handleDeleteTemplate}
                        disabled={configs.length <= 1}
                        className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                        <Trash2 className="h-4 w-4" /> Excluir
                    </button>
                </div>
            </div>

            {/* ── Seção 0: Print Agent local ───────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h3 className="font-semibold text-gray-700 mb-1 flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-indigo-500" />
                    Print Agent — Impressão Local por Usuário
                </h3>
                <p className="text-xs text-gray-500 mb-5">
                    Cada usuário deve rodar o Print Agent na sua própria máquina. O app envia a etiqueta diretamente para o agente local, que imprime usando o driver Windows instalado.
                </p>

                <div className="flex items-start gap-6">
                    {/* Status */}
                    <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                            {agentStatus === 'checking' && (
                                <span className="flex items-center gap-2 text-sm text-gray-500">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Verificando agente...
                                </span>
                            )}
                            {agentStatus === 'online' && (
                                <span className="flex items-center gap-2 text-sm font-semibold text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">
                                    <Wifi className="h-4 w-4" /> Print Agent online — porta 9101
                                </span>
                            )}
                            {agentStatus === 'offline' && (
                                <span className="flex items-center gap-2 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg">
                                    <WifiOff className="h-4 w-4" /> Print Agent offline
                                </span>
                            )}
                        </div>

                        {/* Seletor de impressora */}
                        {agentStatus === 'online' && (
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Impressora neste PC
                                </label>
                                {agentPrinters.length > 0 ? (
                                    <select
                                        value={localPrinterName}
                                        onChange={e => saveLocalPrinter(e.target.value)}
                                        className="w-full max-w-xs border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                    >
                                        {agentPrinters.map(p => (
                                            <option key={p} value={p}>{p}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        value={localPrinterName}
                                        onChange={e => saveLocalPrinter(e.target.value)}
                                        className="w-full max-w-xs border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                        placeholder="ArgoxUSB"
                                    />
                                )}
                                <p className="text-[10px] text-gray-400">
                                    Nome exato da impressora instalada no Windows. Salvo localmente neste navegador.
                                </p>
                            </div>
                        )}

                        {/* Instruções quando offline */}
                        {agentStatus === 'offline' && (
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs text-gray-600 space-y-2">
                                <p className="font-semibold text-gray-700">Para ativar a impressão neste computador:</p>
                                <ol className="list-decimal list-inside space-y-1.5">
                                    <li>Baixe o arquivo <strong>MetalFisa-Print-Agent.ems</strong></li>
                                    <li>Renomeie para <strong>MetalFisa-Print-Agent.exe</strong></li>
                                    <li>Execute o arquivo para iniciar o agente de impressão</li>
                                    <li>Recarregue esta página para verificar o status</li>
                                </ol>
                            </div>
                        )}
                    </div>

                    {/* Botão de download */}
                    <div className="flex-shrink-0">
                        <a
                            href="/api/labels/download-agent"
                            download="MetalFisa-Print-Agent.ems"
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm"
                        >
                            <Download className="h-4 w-4" />
                            Baixar Print Agent
                        </a>
                        <p className="text-[10px] text-gray-400 mt-2 text-center">
                            MetalFisa-Print-Agent.ems → renomear para .exe
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Seção 1: Impressora ──────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                    <Wifi className="h-4 w-4 text-indigo-500" />
                    Conexão com a Impressora
                </h3>

                {/* Toggle USB / TCP */}
                <div className="flex gap-3 mb-5">
                    {[
                        { mode: 'tcp', icon: Wifi,  label: 'TCP/IP (Impressora de Rede)' },
                        { mode: 'usb', icon: Usb,   label: 'USB Local (via 127.0.0.1:9100)' },
                    ].map(({ mode, icon: Icon, label }) => (
                        <button
                            key={mode}
                            onClick={() => setConfig(c => ({ ...c, printer_mode: mode }))}
                            className={[
                                'flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all',
                                config.printer_mode === mode
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                            ].join(' ')}
                        >
                            <Icon className="h-4 w-4" />
                            {label}
                        </button>
                    ))}
                </div>

                {/* Campos de IP e Porta */}
                {config.printer_mode === 'tcp' && (
                    <div className="flex gap-3 mb-4">
                        <div className="flex-1">
                            <label className="block text-xs text-gray-500 font-medium mb-1">Endereço IP da Impressora</label>
                            <input
                                type="text"
                                value={config.printer_host}
                                onChange={e => setConfig(c => ({ ...c, printer_host: e.target.value }))}
                                placeholder="Ex: 192.168.1.100"
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                        </div>
                        <div className="w-32">
                            <label className="block text-xs text-gray-500 font-medium mb-1">Porta TCP</label>
                            <input
                                type="number"
                                value={config.printer_port}
                                onChange={e => setConfig(c => ({ ...c, printer_port: parseInt(e.target.value) || 9100 }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                        </div>
                    </div>
                )}

                {config.printer_mode === 'usb' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 mb-4 space-y-2">
                        <p><strong>Modo USB:</strong> A impressora USB deve estar instalada no Windows e compartilhada como <strong>ArgoxUSB</strong>.</p>
                        <div className="flex gap-2 mt-2">
                            <button onClick={downloadSetupScript} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded font-medium flex items-center gap-1.5">
                                <Download className="w-3.5 h-3.5" />
                                Configurar Automaticamente (Download .bat)
                            </button>
                            <button onClick={() => setShowHelpModal(true)} className="bg-white border border-blue-300 text-blue-700 hover:bg-blue-100 font-medium px-3 py-1.5 rounded flex items-center gap-1.5 transition">
                                <HelpCircle className="w-3.5 h-3.5" />
                                Passo-a-passo Manual
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Ajuste de Posição de Impressão ─────────────────── */}
                <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 mb-4">
                    <h4 className="text-sm font-semibold text-amber-800 flex items-center gap-2 mb-3">
                        <Move className="h-4 w-4" />
                        Ajuste de Posição (Centralização)
                    </h4>
                    <p className="text-xs text-amber-700 mb-3">
                        Se a impressão aparecer deslocada, ajuste os valores abaixo. Valores positivos movem para direita/baixo. Unidade: pixels (1px ≈ 0,12mm a 203 DPI).
                    </p>
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-xs text-amber-700 font-medium mb-1">Offset X (horizontal)</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="range"
                                    min="-100" max="100" step="1"
                                    value={config.print_offset_x || 0}
                                    onChange={e => setConfig(c => ({ ...c, print_offset_x: parseInt(e.target.value) }))}
                                    className="flex-1 accent-amber-600"
                                />
                                <span className="text-xs font-mono w-10 text-center bg-white border border-amber-300 rounded px-1 py-0.5">
                                    {config.print_offset_x || 0}
                                </span>
                            </div>
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs text-amber-700 font-medium mb-1">Offset Y (vertical)</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="range"
                                    min="-100" max="100" step="1"
                                    value={config.print_offset_y || 0}
                                    onChange={e => setConfig(c => ({ ...c, print_offset_y: parseInt(e.target.value) }))}
                                    className="flex-1 accent-amber-600"
                                />
                                <span className="text-xs font-mono w-10 text-center bg-white border border-amber-300 rounded px-1 py-0.5">
                                    {config.print_offset_y || 0}
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={() => setConfig(c => ({ ...c, print_offset_x: 0, print_offset_y: 0 }))}
                            className="self-end text-xs text-amber-700 hover:text-amber-900 border border-amber-300 bg-white px-2 py-1 rounded"
                        >
                            Reset
                        </button>
                    </div>
                </div>

                {/* Botão de teste */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleTestConnection}
                        disabled={testing}
                        className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
                    >
                        {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                        Testar Conexão
                    </button>
                    {testResult && (
                        <span className={`flex items-center gap-1.5 text-sm font-medium ${testResult.ok ? 'text-green-600' : 'text-red-500'}`}>
                            {testResult.ok
                                ? <><CheckCircle className="h-4 w-4" /> Conectado ({testResult.latencyMs}ms)</>
                                : <><XCircle className="h-4 w-4" /> {testResult.error}</>
                            }
                        </span>
                    )}
                </div>
            </div>

            {/* ── Seção 2: Logo e Tipografia (WYSIWYG) ─────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                
                <h3 className="font-semibold text-gray-700 mb-6 flex items-center gap-2">
                    <Type className="h-4 w-4 text-indigo-500" />
                    Construtor Visual da Etiqueta
                </h3>

                <div className="flex flex-col lg:flex-row gap-8">
                    
                    {/* Editor de campos dinâmicos */}
                    <div className="flex-1 space-y-4">
                        
                        {/* Logo Upload Simplificado */}
                        <div className="flex items-center justify-between bg-gray-50 border border-dashed border-gray-300 p-4 rounded-lg">
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                    <ImageIcon className="h-4 w-4 text-gray-500" />
                                    Logo do Topo
                                </h4>
                                <p className="text-xs text-gray-500 mt-1">A imagem será processada em 1-bit.</p>
                            </div>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={logoUploading}
                                className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded text-xs font-medium hover:bg-gray-50 transition"
                            >
                                {logoUploading ? 'Carregando...' : 'Fazer Upload (PNG/JPG)'}
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png"
                                className="hidden"
                                onChange={handleLogoUpload}
                            />
                        </div>

                        <div className="flex items-center justify-between border-b pb-2 mt-6">
                            <h4 className="text-sm font-semibold text-gray-700">Linhas Dinâmicas</h4>
                            <button
                                onClick={addField}
                                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium bg-indigo-50 px-2 py-1 rounded"
                            >
                                <Plus className="h-3.5 w-3.5" /> Adicionar Linha
                            </button>
                        </div>

                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                            {config.label_fields.map((field, idx) => (
                                <div key={idx} className={`bg-gray-50 border border-gray-200 rounded-lg p-3 group relative transition-opacity ${field.disabled ? 'opacity-50 grayscale' : ''}`}>
                                    <div className="absolute top-3 right-3 flex items-center gap-1">
                                        <button onClick={() => toggleDisabled(idx)} className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-gray-200 rounded" title={field.disabled ? 'Mostrar na Etiqueta' : 'Ocultar da Etiqueta'}>
                                            {field.disabled ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                        </button>
                                        <button onClick={() => moveField(idx, -1)} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded">
                                            <ChevronUp className="h-3 w-3" />
                                        </button>
                                        <button onClick={() => moveField(idx, 1)} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded">
                                            <ChevronDown className="h-3 w-3" />
                                        </button>
                                        <button
                                            onClick={() => removeField(idx)}
                                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded ml-2"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-3 mb-3 pr-24">
                                        <span className="text-xs font-bold text-gray-400 w-4">{idx + 1}.</span>
                                        
                                        <div className="flex-1">
                                            <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Rótulo Fixo</label>
                                            <input
                                                type="text"
                                                value={field.label}
                                                onChange={e => updateField(idx, 'label', e.target.value)}
                                                className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-400 focus:outline-none"
                                            />
                                        </div>
                                        
                                        <div className="flex-1">
                                            <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Variável</label>
                                            <select
                                                value={field.dataKey}
                                                onChange={e => updateField(idx, 'dataKey', e.target.value)}
                                                className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-400 focus:outline-none bg-white"
                                            >
                                                {AVAILABLE_FIELDS.map(f => (
                                                    <option key={f.key} value={f.key}>{f.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="flex items-end gap-3">
                                        <div className="w-24">
                                            <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Fonte</label>
                                            <select
                                                value={field.fontFamily}
                                                onChange={e => updateField(idx, 'fontFamily', e.target.value)}
                                                className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white"
                                            >
                                                {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                                            </select>
                                        </div>
                                        <div className="w-16">
                                            <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Tamanho</label>
                                            <input
                                                type="number"
                                                value={field.fontSize}
                                                onChange={e => updateField(idx, 'fontSize', parseInt(e.target.value) || 20)}
                                                className="w-full border border-gray-300 rounded px-2 py-1 text-xs text-center"
                                            />
                                        </div>
                                        <button
                                            onClick={() => toggleBold(idx)}
                                            className={`p-1 border rounded transition-colors ${field.fontWeight === 'bold' ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-100'}`}
                                            title="Negrito"
                                        >
                                            <Bold className="h-4 w-4" />
                                        </button>
                                        
                                        <div className="flex items-center gap-2 ml-4">
                                            <span className="text-[10px] text-gray-400">Posição:</span>
                                            <div className="w-14">
                                                <div className="flex items-center border border-gray-300 rounded overflow-hidden bg-white">
                                                    <span className="text-[9px] text-gray-400 px-1 bg-gray-50 border-r">X</span>
                                                    <input type="number" value={field.x} onChange={e => updateField(idx, 'x', parseInt(e.target.value) || 0)} className="w-full px-1 text-xs text-center focus:outline-none" />
                                                </div>
                                            </div>
                                            <div className="w-14">
                                                <div className="flex items-center border border-gray-300 rounded overflow-hidden bg-white">
                                                    <span className="text-[9px] text-gray-400 px-1 bg-gray-50 border-r">Y</span>
                                                    <input type="number" value={field.y} onChange={e => updateField(idx, 'y', parseInt(e.target.value) || 0)} className="w-full px-1 text-xs text-center focus:outline-none" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Toggle Código de Barras */}
                                        <button
                                            onClick={() => updateField(idx, 'barcode', !field.barcode)}
                                            className={`ml-2 flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-medium transition-colors ${
                                                field.barcode
                                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                                    : 'bg-white text-gray-500 border-gray-300 hover:border-indigo-400'
                                            }`}
                                            title="Imprimir como código de barras (Code128)"
                                        >
                                            <BarChart2 className="h-3.5 w-3.5" />
                                            Barcode
                                        </button>
                                        {field.barcode && (
                                            <div className="w-16">
                                                <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Altura px</label>
                                                <input
                                                    type="number"
                                                    value={field.barcodeHeight || 60}
                                                    onChange={e => updateField(idx, 'barcodeHeight', parseInt(e.target.value) || 60)}
                                                    min="30" max="150"
                                                    className="w-full border border-gray-300 rounded px-1 py-1 text-xs text-center"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Preview visual (Canvas Real) */}
                    <div className="flex-shrink-0 flex flex-col items-center">
                        <p className="text-sm font-semibold text-gray-700 mb-2">Live Preview (600x440 dots)</p>
                        <p className="text-xs text-gray-500 mb-3 text-center max-w-xs">Este Canvas representa exatamente como a etiqueta será impressa no papel 75x55mm.</p>
                        
                        <div className="bg-white border-2 border-gray-800 shadow-lg rounded-sm overflow-hidden p-1 inline-block">
                            {/* O Canvas será escalado visualmente pelo CSS para caber na tela, mas terá internamente 600x440 */}
                            <canvas 
                                ref={canvasRef} 
                                width={600} 
                                height={440} 
                                className="bg-white"
                                style={{ width: '400px', height: '293px', imageRendering: 'pixelated' }}
                            />
                        </div>

                        {/* Botão de Teste de Impressão Direta */}
                        <button
                            onClick={handlePrintTest}
                            disabled={printingTest}
                            className="mt-6 flex items-center gap-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                        >
                            {printingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                            Imprimir Teste da Etiqueta
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal de Ajuda Manual */}
            {showHelpModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <Printer className="h-5 w-5 text-indigo-600" />
                                Configuração Manual da Impressora USB
                            </h3>
                            <button onClick={() => setShowHelpModal(false)} className="text-gray-400 hover:text-gray-600">
                                <XCircle className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-[70vh] text-sm text-gray-700 space-y-4">
                            <p>Caso o botão de <strong>Configuração Automática</strong> seja bloqueado pelo antivírus, siga estes passos no Windows para habilitar a impressão via USB:</p>
                            
                            <ol className="list-decimal list-inside space-y-3 pl-2">
                                <li>Aperte a tecla <strong>Windows</strong>, digite <code>Impressoras e scanners</code> e abra.</li>
                                <li>Clique em <strong>Adicionar dispositivo</strong> e depois em <strong>Adicionar manualmente</strong>.</li>
                                <li>Escolha a última opção: <strong>Adicionar uma impressora local ou de rede usando configurações manuais</strong>.</li>
                                <li>Em <em>Usar uma porta existente</em>, selecione a porta <strong>USB001 (Porta de impressora virtual para USB)</strong>.</li>
                                <li>Na lista de fabricantes, escolha <strong>Generic</strong> (Genérico) e, na lista à direita, escolha <strong>Generic / Text Only</strong>.</li>
                                <li>Dê exatamente este nome para a impressora: <strong className="bg-gray-100 px-1 rounded">ArgoxUSB</strong></li>
                                <li>Quando perguntar sobre compartilhamento, marque <strong>Compartilhar esta impressora</strong> e deixe o nome de compartilhamento como <strong className="bg-gray-100 px-1 rounded">ArgoxUSB</strong>.</li>
                            </ol>

                            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mt-6">
                                <p className="font-semibold text-blue-800">Tudo pronto!</p>
                                <p className="text-blue-700 mt-1">Após fazer isso, basta rodar a Print Bridge que a MetalFisa forneceu e clicar em <strong>Testar Conexão</strong>.</p>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-gray-50 border-t flex justify-end">
                            <button onClick={() => setShowHelpModal(false)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">
                                Entendi
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
