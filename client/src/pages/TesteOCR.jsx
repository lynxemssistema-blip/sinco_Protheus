import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createWorker } from 'tesseract.js';
import {
    Camera, CameraOff, ScanLine, CheckCircle2, XCircle,
    AlertTriangle, RefreshCw, Loader2, Info
} from 'lucide-react';

// ─── SANITIZAÇÃO ──────────────────────────────────────────────────────────────
// Converte caracteres ambíguos comuns em leituras de metal gravado a laser
const CHAR_MAP = {
    'S': '5', 's': '5',
    'O': '0', 'o': '0',
    'I': '1', 'l': '1', 'i': '1',
    'Z': '2', 'z': '2',
    'G': '6', 'g': '6',
    'B': '8', 'b': '8',
    'Q': '0',
    'A': '4',
    'T': '7',
    ' ': '',   // espaços ao redor do hífen
};

const PATTERN = /^\d+-\d+$/;

function sanitize(raw) {
    // 1. Remove tudo exceto dígitos, letras ambíguas e hífen
    let s = raw.replace(/[^0-9A-Za-z\-\s]/g, '');

    // 2. Substitui chars ambíguos
    s = s.split('').map(c => CHAR_MAP[c] ?? c).join('');

    // 3. Normaliza hífen: remove espaços ao redor e colapsa múltiplos hífens
    s = s.replace(/\s*-+\s*/g, '-').trim();

    // 4. Remove caracteres não numéricos restantes (exceto hífen)
    s = s.replace(/[^0-9\-]/g, '');

    return s;
}

function validate(code) {
    return PATTERN.test(code);
}

// ─── PRÉ-PROCESSAMENTO DE IMAGEM ──────────────────────────────────────────────
// Aumenta contraste para melhorar leitura em metal
function preprocessCanvas(srcCanvas) {
    const dst = document.createElement('canvas');
    dst.width = srcCanvas.width;
    dst.height = srcCanvas.height;
    const ctx = dst.getContext('2d');
    ctx.drawImage(srcCanvas, 0, 0);

    const img = ctx.getImageData(0, 0, dst.width, dst.height);
    const data = img.data;

    for (let i = 0; i < data.length; i += 4) {
        // Converte para escala de cinza
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        // Limiarização simples (threshold): metal gravado tende a ser escuro
        const val = gray < 128 ? 0 : 255;
        data[i] = data[i + 1] = data[i + 2] = val;
    }

    ctx.putImageData(img, 0, 0);
    return dst;
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function TesteOCR() {
    const videoRef   = useRef(null);
    const canvasRef  = useRef(null);
    const workerRef  = useRef(null);
    const streamRef  = useRef(null);

    const [cameraOn,    setCameraOn]    = useState(false);
    const [loading,     setLoading]     = useState(false);
    const [loadingMsg,  setLoadingMsg]  = useState('');
    const [rawText,     setRawText]     = useState('');
    const [sanitized,   setSanitized]   = useState('');
    const [valid,       setValid]       = useState(null); // true | false | null
    const [captured,    setCaptured]    = useState(null); // dataURL da imagem
    const [preprocessed,setPreprocessed]= useState(null); // dataURL pré-processada
    const [history,     setHistory]     = useState([]);
    const [workerReady, setWorkerReady] = useState(false);

    // Inicializa o worker Tesseract uma vez
    useEffect(() => {
        let active = true;
        (async () => {
            setLoadingMsg('Carregando motor OCR...');
            setLoading(true);
            const w = await createWorker('eng', 1, {
                logger: () => {},
            });
            // Configuração otimizada: só dígitos e hífen
            await w.setParameters({
                tessedit_char_whitelist: '0123456789-SOIlZGBQATsogb ',
                tessedit_pageseg_mode: '7', // uma linha de texto
            });
            if (active) {
                workerRef.current = w;
                setWorkerReady(true);
                setLoading(false);
                setLoadingMsg('');
            }
        })();
        return () => {
            active = false;
            workerRef.current?.terminate();
        };
    }, []);

    const startCamera = useCallback(async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            const isHttp = location.protocol === 'http:' && location.hostname !== 'localhost';
            if (isHttp) {
                const httpsUrl = `https://${location.hostname}/teste-ocr`;
                if (window.confirm(`Câmera requer conexão segura (HTTPS).\n\nAcesse pelo endereço seguro?\n${httpsUrl}`)) {
                    window.location.href = httpsUrl;
                }
            } else {
                alert('Seu navegador não suporta acesso à câmera neste contexto.');
            }
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                }
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            setCameraOn(true);
            setRawText('');
            setSanitized('');
            setValid(null);
            setCaptured(null);
            setPreprocessed(null);
        } catch (err) {
            alert('Não foi possível acessar a câmera: ' + err.message);
        }
    }, []);

    const stopCamera = useCallback(() => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        setCameraOn(false);
    }, []);

    const capture = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current || !workerRef.current) return;

        setLoading(true);
        setLoadingMsg('Capturando imagem...');
        setRawText('');
        setSanitized('');
        setValid(null);

        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        setCaptured(canvas.toDataURL('image/png'));

        // Pré-processa
        setLoadingMsg('Pré-processando imagem...');
        const processed = preprocessCanvas(canvas);
        setPreprocessed(processed.toDataURL('image/png'));

        // OCR
        setLoadingMsg('Reconhecendo texto (OCR)...');
        try {
            const { data } = await workerRef.current.recognize(processed);
            const raw = data.text.trim();
            setRawText(raw);

            setLoadingMsg('Sanitizando resultado...');
            const clean = sanitize(raw);
            setSanitized(clean);
            const ok = validate(clean);
            setValid(ok);

            const entry = {
                id: Date.now(),
                raw,
                sanitized: clean,
                valid: ok,
                time: new Date().toLocaleTimeString('pt-BR'),
            };
            setHistory(h => [entry, ...h].slice(0, 10));
        } catch (err) {
            alert('Erro no OCR: ' + err.message);
        } finally {
            setLoading(false);
            setLoadingMsg('');
        }
    }, []);

    // Permite testar sem câmera
    const [manualInput, setManualInput] = useState('');
    const testManual = () => {
        const clean = sanitize(manualInput);
        const ok = validate(clean);
        setSanitized(clean);
        setRawText(manualInput);
        setValid(ok);
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white p-4">
            <div className="max-w-2xl mx-auto space-y-4">

                {/* Header */}
                <div className="text-center pt-2">
                    <h1 className="text-2xl font-bold text-white">Leitor OCR — Peças Laser</h1>
                    <p className="text-slate-400 text-sm mt-1">Leitura de códigos gravados em metal (padrão: <code className="text-yellow-400">número-números</code>)</p>
                </div>

                {/* Status OCR Engine */}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${workerReady ? 'bg-green-900/50 text-green-300' : 'bg-slate-800 text-slate-400'}`}>
                    {workerReady
                        ? <><CheckCircle2 size={14} /> Motor OCR pronto</>
                        : <><Loader2 size={14} className="animate-spin" /> Carregando motor OCR...</>
                    }
                </div>

                {/* Aviso HTTPS */}
                {(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) && (
                    <div className="flex flex-col gap-2 px-3 py-3 rounded-lg bg-amber-900/50 border border-amber-700 text-amber-300 text-sm">
                        <div className="flex items-center gap-2 font-bold">
                            <AlertTriangle size={16} className="shrink-0" />
                            Câmera indisponível — conexão não segura (HTTP)
                        </div>
                        <p className="text-xs text-amber-400">Toque no link abaixo para acessar pelo endereço seguro:</p>
                        <a
                            href={`https://${window.location.hostname}/teste-ocr`}
                            className="text-xs underline text-yellow-300 font-mono break-all"
                        >
                            https://{window.location.hostname}/teste-ocr
                        </a>
                    </div>
                )}

                {/* Câmera */}
                <div className="bg-slate-800 rounded-xl overflow-hidden">
                    <div className="relative bg-black aspect-video flex items-center justify-center">
                        <video
                            ref={videoRef}
                            className={`w-full h-full object-contain ${cameraOn ? '' : 'hidden'}`}
                            playsInline muted
                        />
                        {/* Guia de enquadramento */}
                        {cameraOn && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="border-2 border-yellow-400 rounded w-2/3 h-16 opacity-70">
                                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-yellow-400 text-xs whitespace-nowrap">
                                        Enquadre o código aqui
                                    </div>
                                </div>
                            </div>
                        )}
                        {!cameraOn && (
                            <div className="text-slate-500 flex flex-col items-center gap-2">
                                <CameraOff size={48} />
                                <span className="text-sm">Câmera desligada</span>
                            </div>
                        )}
                    </div>
                    <canvas ref={canvasRef} className="hidden" />

                    {/* Controles câmera */}
                    <div className="flex gap-2 p-3">
                        {!cameraOn ? (
                            <button
                                onClick={startCamera}
                                disabled={!workerReady}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 rounded-lg font-semibold text-sm"
                            >
                                <Camera size={16} /> Ligar Câmera
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={capture}
                                    disabled={loading}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-yellow-500 hover:bg-yellow-400 text-black disabled:opacity-40 rounded-lg font-bold text-sm"
                                >
                                    {loading
                                        ? <><Loader2 size={16} className="animate-spin" /> {loadingMsg}</>
                                        : <><ScanLine size={16} /> Capturar e Ler</>
                                    }
                                </button>
                                <button
                                    onClick={stopCamera}
                                    className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm"
                                >
                                    <CameraOff size={16} />
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Resultado */}
                {(rawText || sanitized) && (
                    <div className={`rounded-xl border-2 p-4 space-y-3 ${
                        valid === true  ? 'bg-green-900/30 border-green-500' :
                        valid === false ? 'bg-red-900/30 border-red-500' :
                                          'bg-slate-800 border-slate-600'
                    }`}>
                        <div className="flex items-center gap-2 font-bold text-lg">
                            {valid === true  && <><CheckCircle2 className="text-green-400" size={22} /> Código Válido</>}
                            {valid === false && <><XCircle className="text-red-400" size={22} /> Código Inválido</>}
                            {valid === null  && <><AlertTriangle className="text-yellow-400" size={22} /> Aguardando</>}
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="bg-slate-800/60 rounded-lg p-3">
                                <div className="text-slate-400 text-xs mb-1">Texto bruto (OCR)</div>
                                <div className="font-mono text-orange-300 break-all">{rawText || '—'}</div>
                            </div>
                            <div className="bg-slate-800/60 rounded-lg p-3">
                                <div className="text-slate-400 text-xs mb-1">Após sanitização</div>
                                <div className={`font-mono text-xl font-bold ${valid ? 'text-green-300' : 'text-red-300'}`}>
                                    {sanitized || '—'}
                                </div>
                            </div>
                        </div>

                        {valid === false && sanitized && (
                            <div className="text-xs text-red-300 flex items-start gap-1">
                                <Info size={12} className="mt-0.5 flex-shrink-0" />
                                O código <code className="mx-1 bg-slate-700 px-1 rounded">{sanitized}</code> não corresponde ao padrão <code className="mx-1 bg-slate-700 px-1 rounded">^\d+-\d+$</code>. Tente reposicionar e capturar novamente.
                            </div>
                        )}
                    </div>
                )}

                {/* Imagens capturadas */}
                {(captured || preprocessed) && (
                    <div className="grid grid-cols-2 gap-3">
                        {captured && (
                            <div className="bg-slate-800 rounded-xl overflow-hidden">
                                <div className="text-xs text-slate-400 px-3 py-1.5 border-b border-slate-700">Original</div>
                                <img src={captured} alt="original" className="w-full" />
                            </div>
                        )}
                        {preprocessed && (
                            <div className="bg-slate-800 rounded-xl overflow-hidden">
                                <div className="text-xs text-slate-400 px-3 py-1.5 border-b border-slate-700">Pré-processada (OCR)</div>
                                <img src={preprocessed} alt="preprocessed" className="w-full" />
                            </div>
                        )}
                    </div>
                )}

                {/* Teste manual */}
                <div className="bg-slate-800 rounded-xl p-4 space-y-2">
                    <div className="text-sm font-semibold text-slate-300">Teste manual (sem câmera)</div>
                    <p className="text-xs text-slate-500">Simule uma leitura imperfeita do OCR, ex: <code className="text-yellow-400">S-2979b</code> ou <code className="text-yellow-400">5 - 2Q796</code></p>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={manualInput}
                            onChange={e => setManualInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && testManual()}
                            placeholder="Cole aqui o texto do OCR..."
                            className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        />
                        <button
                            onClick={testManual}
                            className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-bold rounded-lg"
                        >
                            Testar
                        </button>
                    </div>
                </div>

                {/* Histórico */}
                {history.length > 0 && (
                    <div className="bg-slate-800 rounded-xl overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700">
                            <span className="text-sm font-semibold text-slate-300">Histórico de leituras</span>
                            <button onClick={() => setHistory([])} className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1">
                                <RefreshCw size={11} /> Limpar
                            </button>
                        </div>
                        <div className="divide-y divide-slate-700">
                            {history.map(h => (
                                <div key={h.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                                    {h.valid
                                        ? <CheckCircle2 size={14} className="text-green-400 flex-shrink-0" />
                                        : <XCircle     size={14} className="text-red-400 flex-shrink-0" />
                                    }
                                    <span className={`font-mono font-bold ${h.valid ? 'text-green-300' : 'text-red-300'}`}>{h.sanitized || '(vazio)'}</span>
                                    <span className="text-slate-500 text-xs truncate flex-1">bruto: {h.raw}</span>
                                    <span className="text-slate-600 text-xs">{h.time}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Legenda dos mapeamentos */}
                <details className="bg-slate-800 rounded-xl">
                    <summary className="px-4 py-3 text-sm font-semibold text-slate-300 cursor-pointer flex items-center gap-2">
                        <Info size={14} /> Tabela de substituição de caracteres
                    </summary>
                    <div className="px-4 pb-4 pt-2 grid grid-cols-4 gap-1 text-xs font-mono">
                        {Object.entries(CHAR_MAP).filter(([k]) => k !== ' ').map(([from, to]) => (
                            <div key={from} className="flex items-center gap-1 bg-slate-700/50 rounded px-2 py-1">
                                <span className="text-orange-300">{from}</span>
                                <span className="text-slate-500">→</span>
                                <span className="text-green-300">{to}</span>
                            </div>
                        ))}
                    </div>
                    <div className="px-4 pb-4 text-xs text-slate-400">
                        Regex de validação: <code className="text-yellow-400 bg-slate-700 px-1.5 py-0.5 rounded">^\d+-\d+$</code>
                    </div>
                </details>
            </div>
        </div>
    );
}
