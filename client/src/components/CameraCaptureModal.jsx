import React, { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCw, Upload, X, Check, AlertCircle, Smartphone, FlipHorizontal } from 'lucide-react';

export default function CameraCaptureModal({ isOpen, onClose, onCapture, title = 'Capturar Foto' }) {
    // Detectar se o usuário está em dispositivo móvel
    const isMobileDevice = typeof navigator !== 'undefined' && (
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        (typeof window !== 'undefined' && window.innerWidth <= 768)
    );

    const [mode, setMode] = useState('camera'); // 'camera' | 'upload'
    const [stream, setStream] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [cameraError, setCameraError] = useState(null);
    // Em celulares, a câmera traseira ('environment') é a mais utilizada para placa/visitante
    const [facingMode, setFacingMode] = useState(isMobileDevice ? 'environment' : 'user');
    
    const videoRef = useRef(null);
    const fileInputRef = useRef(null);
    const nativeCameraInputRef = useRef(null);

    // Inicializar câmera quando o modal abrir em modo camera
    useEffect(() => {
        if (isOpen && mode === 'camera' && !photoPreview) {
            startCamera();
        } else {
            stopCamera();
        }

        return () => {
            stopCamera();
        };
    }, [isOpen, mode, photoPreview, facingMode]);

    const startCamera = async () => {
        setCameraError(null);
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Navegador não possui suporte para acesso direto à câmera via WebRTC.');
            }

            // Encerrar stream anterior se houver
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }

            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: facingMode },
                    width: { ideal: isMobileDevice ? 1280 : 1280 },
                    height: { ideal: isMobileDevice ? 720 : 720 }
                },
                audio: false
            });

            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
        } catch (err) {
            console.warn('Erro ao acessar webcam:', err);
            setCameraError(
                isMobileDevice
                    ? 'Acesso direto à câmera bloqueado. Toque em "Câmera Nativa do Celular" abaixo para usar a câmera do seu smartphone.'
                    : 'Não foi possível acessar a câmera. Você pode usar a opção de upload.'
            );
            setMode('upload');
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };

    // Helper: Comprimir imagem para tamanho otimizado (evita travar em fotos pesadas de celulares modernos)
    const compressImage = (dataUrl, maxWidth = 1280, maxHeight = 960, quality = 0.82) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = dataUrl;
        });
    };

    const handleTakePhoto = async () => {
        if (!videoRef.current) return;
        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        
        // Se a câmera for frontal ('user'), espelhar horizontalmente
        if (facingMode === 'user') {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const rawBase64 = canvas.toDataURL('image/jpeg', 0.88);
        const optimized = await compressImage(rawBase64);
        setPhotoPreview(optimized);
        stopCamera();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const optimized = await compressImage(event.target.result);
            setPhotoPreview(optimized);
        };
        reader.readAsDataURL(file);
    };

    const handleConfirm = () => {
        if (photoPreview) {
            onCapture(photoPreview);
            handleClose();
        }
    };

    const handleRetake = () => {
        setPhotoPreview(null);
        if (mode === 'camera') {
            startCamera();
        }
    };

    const handleClose = () => {
        stopCamera();
        setPhotoPreview(null);
        setCameraError(null);
        onClose();
    };

    const toggleFacingMode = () => {
        setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100 max-h-[95dvh]">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4 border-b border-slate-800 bg-slate-950/70">
                    <div className="flex items-center gap-2">
                        <Camera className="w-5 h-5 text-emerald-400" />
                        <h3 className="font-semibold text-sm sm:text-base text-slate-100 truncate">{title}</h3>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition active:scale-95"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Sub-header com abas / botões responsivos */}
                {!photoPreview && (
                    <div className="flex border-b border-slate-800 bg-slate-950/40 p-1.5 gap-1.5">
                        <button
                            type="button"
                            onClick={() => { setMode('camera'); setPhotoPreview(null); }}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold rounded-xl transition ${
                                mode === 'camera'
                                    ? 'bg-emerald-600 text-white shadow-md'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                            }`}
                        >
                            <Camera className="w-4 h-4" />
                            <span>Câmera ao Vivo</span>
                        </button>

                        {/* Botão de disparo de Câmera Nativa do Celular */}
                        {isMobileDevice && (
                            <button
                                type="button"
                                onClick={() => nativeCameraInputRef.current?.click()}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold rounded-xl bg-blue-600/30 border border-blue-500/50 text-blue-300 hover:bg-blue-600/40 transition active:scale-95"
                            >
                                <Smartphone className="w-4 h-4" />
                                <span>Câmera Celular</span>
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={() => { setMode('upload'); stopCamera(); }}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold rounded-xl transition ${
                                mode === 'upload'
                                    ? 'bg-emerald-600 text-white shadow-md'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                            }`}
                        >
                            <Upload className="w-4 h-4" />
                            <span>{isMobileDevice ? 'Galeria' : 'Arquivo'}</span>
                        </button>
                    </div>
                )}

                {/* Inputs ocultos de câmera nativa e upload */}
                <input
                    ref={nativeCameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileChange}
                />
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                />

                {/* Área de Visualização Principal */}
                <div className="relative p-3 sm:p-4 flex flex-col items-center justify-center min-h-[260px] sm:min-h-[320px] bg-slate-950 overflow-hidden">
                    {cameraError && mode === 'camera' && !photoPreview && (
                        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-center max-w-sm space-y-3">
                            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
                            <p className="text-xs text-rose-200">{cameraError}</p>
                            <div className="flex flex-col gap-2">
                                {isMobileDevice && (
                                    <button
                                        type="button"
                                        onClick={() => nativeCameraInputRef.current?.click()}
                                        className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow"
                                    >
                                        <Smartphone className="w-4 h-4" />
                                        Abrir Câmera do Celular
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setMode('upload')}
                                    className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl"
                                >
                                    Escolher da Galeria / Arquivos
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Preview da Foto Capturada */}
                    {photoPreview ? (
                        <div className="relative w-full aspect-video sm:aspect-video rounded-xl overflow-hidden border border-emerald-500/50 shadow-inner bg-black flex items-center justify-center">
                            <img
                                src={photoPreview}
                                alt="Preview da foto capturada"
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute top-2 right-2 bg-emerald-500/90 text-white text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow">
                                <Check className="w-3.5 h-3.5" /> Foto Pronta
                            </div>
                        </div>
                    ) : mode === 'camera' && !cameraError ? (
                        /* Feed de Vídeo da Câmera ao Vivo */
                        <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-slate-800 bg-black flex items-center justify-center">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className={`w-full h-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`}
                            />
                            {/* Guia visual de enquadramento central */}
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-full border-2 border-dashed border-emerald-400/40" />
                            </div>

                            {/* Botão de Alternar Câmera (Frontal / Traseira) */}
                            <button
                                type="button"
                                onClick={toggleFacingMode}
                                title={facingMode === 'user' ? 'Mudar para Câmera Traseira' : 'Mudar para Câmera Frontal'}
                                className="absolute bottom-3 right-3 px-3 py-2 bg-slate-900/90 hover:bg-slate-800 text-white rounded-xl border border-slate-700 shadow-md flex items-center gap-1.5 text-xs font-semibold active:scale-95 transition"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>{facingMode === 'user' ? 'Traseira' : 'Frontal'}</span>
                            </button>
                        </div>
                    ) : mode === 'upload' ? (
                        /* Área de Upload / Galeria */
                        <div className="w-full space-y-3">
                            {isMobileDevice && (
                                <button
                                    type="button"
                                    onClick={() => nativeCameraInputRef.current?.click()}
                                    className="w-full py-4 rounded-xl border border-blue-500/40 bg-blue-950/30 hover:bg-blue-950/50 flex flex-col items-center justify-center gap-1.5 transition active:scale-98"
                                >
                                    <Smartphone className="w-8 h-8 text-blue-400" />
                                    <span className="text-sm font-bold text-blue-200">Tirar Foto com a Câmera do Celular</span>
                                    <span className="text-[11px] text-blue-300/80">Abre o aplicativo nativo de câmera</span>
                                </button>
                            )}

                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full py-6 rounded-xl border-2 border-dashed border-slate-700 hover:border-emerald-500/70 bg-slate-900/50 flex flex-col items-center justify-center cursor-pointer transition p-4 text-center active:scale-98"
                            >
                                <Upload className="w-8 h-8 text-slate-400 mb-1.5" />
                                <p className="text-xs sm:text-sm font-semibold text-slate-200">
                                    {isMobileDevice ? 'Selecionar da Galeria' : 'Clique para selecionar uma foto'}
                                </p>
                                <p className="text-[11px] text-slate-500 mt-0.5">JPG, PNG ou WEBP</p>
                            </div>
                        </div>
                    ) : null}
                </div>

                {/* Footer de Ações Responsivo */}
                <div className="flex items-center justify-between p-3 sm:p-4 border-t border-slate-800 bg-slate-950/70 gap-2">
                    <button
                        type="button"
                        onClick={handleClose}
                        className="px-3.5 py-2.5 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
                    >
                        Cancelar
                    </button>

                    <div className="flex items-center gap-2">
                        {photoPreview ? (
                            <>
                                <button
                                    type="button"
                                    onClick={handleRetake}
                                    className="px-3 py-2.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl flex items-center gap-1.5 transition active:scale-95"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    <span>Tirar Outra</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirm}
                                    className="px-4 sm:px-5 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 transition active:scale-95"
                                >
                                    <Check className="w-4 h-4" />
                                    <span>Usar Esta Foto</span>
                                </button>
                            </>
                        ) : mode === 'camera' && !cameraError ? (
                            <button
                                type="button"
                                onClick={handleTakePhoto}
                                className="px-5 py-3 text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-950/50 transition active:scale-95"
                            >
                                <Camera className="w-4 h-4" />
                                <span>Capturar Foto</span>
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
}
