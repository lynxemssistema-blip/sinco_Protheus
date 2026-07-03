import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { UploadCloud, Camera, Box, Activity, Sliders, AlertCircle, Eye, FileText, X, Download, HelpCircle } from 'lucide-react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// ─────────────────────────────────────────────────────────
// Hook: gerencia toda a cena Three.js em um <canvas> próprio
// Sem @react-three/fiber — puro Three.js imperativo
// ─────────────────────────────────────────────────────────
// Configurações de material por modo de visualização
const VIEW_MODES = {
  wireframe: {
    label: 'Wireframe',
    color: 0x00ffcc,
    wireframe: true,
    transparent: true,
    opacity: 0.9,
    emissive: 0x00ffcc,
    emissiveIntensity: 0.5,
    roughness: 0.5,
    metalness: 0.0,
  },
  solido: {
    label: 'Sólido',
    color: 0xb0c4de, // azul aço industrial
    wireframe: false,
    transparent: false,
    opacity: 1.0,
    emissive: 0x1a2a3a,
    emissiveIntensity: 0.08,
    roughness: 0.45,
    metalness: 0.6,
  },
  transparente: {
    label: 'Transparente',
    color: 0x88ccff,
    wireframe: false,
    transparent: true,
    opacity: 0.35,
    emissive: 0x004488,
    emissiveIntensity: 0.2,
    roughness: 0.1,
    metalness: 0.2,
  },
};

function useThreeScene(canvasRef, geometry, modelOpacity, viewMode, bgColor, sceneRef) {

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.shadowMap.enabled = true;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(bgColor || '#1e293b');
    const camera = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, 0.1, 5000);
    camera.position.set(0, 0, 200);

    // Iluminação
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dir = new THREE.DirectionalLight(0xffffff, 1.5);
    dir.position.set(10, 20, 10);
    scene.add(dir);

    const controls = new OrbitControls(camera, canvas);

    // ── Rotação (botão esquerdo / 1 dedo touch)
    controls.enableRotate = true;
    controls.rotateSpeed = 0.8;            // velocidade suave para peças industriais

    // ── Pan / deslocamento (botão direito ou 2 dedos touch)
    controls.enablePan = true;
    controls.panSpeed = 0.8;
    controls.screenSpacePanning = true;    // pan acompanha o plano da tela (mais intuitivo)

    // ── Zoom (scroll wheel + pinch touch)
    controls.enableZoom = true;
    controls.zoomSpeed = 1.2;             // responsivo mas sem ser agressivo
    controls.minDistance = 1;             // permite aproximação total
    controls.maxDistance = 50000;         // permite visão geral de peças grandes

    // ── Damping (inércia suave — "desliza" ao soltar)
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;

    // ── Zoom centrado no cursor (scroll aponta para onde o mouse está)
    controls.zoomToCursor = true;

    let meshRef = null;
    let animId;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize
    const ro = new ResizeObserver(() => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    ro.observe(canvas);

    // Eixos XYZ e Grid de referencia (escala 1:1 = mm)
    const axes = new THREE.AxesHelper(200); scene.add(axes);
    const grid = new THREE.GridHelper(500, 50, 0x334455, 0x223344); scene.add(grid);
    sceneRef.current = { scene, camera, controls, renderer, getMesh: () => meshRef, setMesh: (m) => { meshRef = m; } };

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
    };
  }, [canvasRef]);

  // Atualiza o modelo quando geometry muda
  useEffect(() => {
    if (!sceneRef.current || !geometry) return;
    const { scene, camera, getMesh, setMesh } = sceneRef.current;

    const old = getMesh();
    if (old) scene.remove(old);

    const cfg = VIEW_MODES[viewMode] || VIEW_MODES.wireframe;
    const mat = new THREE.MeshStandardMaterial({
      color: cfg.color,
      wireframe: cfg.wireframe,
      transparent: cfg.transparent,
      opacity: cfg.opacity * modelOpacity,
      emissive: new THREE.Color(cfg.emissive),
      emissiveIntensity: cfg.emissiveIntensity,
      roughness: cfg.roughness,
      metalness: cfg.metalness,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, mat);

    // Centraliza a câmera no bounding box do modelo
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    const center = new THREE.Vector3();
    box.getCenter(center);
    mesh.position.sub(center);

    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    camera.position.set(0, 0, maxDim * 2.2);
    camera.far = maxDim * 20;
    camera.updateProjectionMatrix();

    scene.add(mesh);
    setMesh(mesh);
  }, [geometry]);

  // Atualiza material (opacidade + modo) sem recriar o mesh
  useEffect(() => {
    if (!sceneRef.current) return;
    const mesh = sceneRef.current.getMesh?.();
    if (!mesh?.material) return;
    const cfg = VIEW_MODES[viewMode] || VIEW_MODES.wireframe;
    mesh.material.color.set(cfg.color);
    mesh.material.wireframe = cfg.wireframe;
    mesh.material.transparent = cfg.transparent;
    mesh.material.opacity = cfg.opacity * modelOpacity;
    mesh.material.emissive.set(cfg.emissive);
    mesh.material.emissiveIntensity = cfg.emissiveIntensity;
    mesh.material.roughness = cfg.roughness;
    mesh.material.metalness = cfg.metalness;
    mesh.material.needsUpdate = true;
  }, [modelOpacity, viewMode]);

  // Atualiza cor de fundo da cena em tempo real
  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.scene.background = new THREE.Color(bgColor);
  }, [bgColor]);
}

// ─────────────────────────────────────────────────────────
// Componente Principal
// ─────────────────────────────────────────────────────────
export default function Analise3DPage() {
  const [geometry, setGeometry] = useState(null);
  const [modelName, setModelName] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [cameraBlocked, setCameraBlocked] = useState(false);
  const [fallbackImgSrc, setFallbackImgSrc] = useState(null);
  const fallbackImgRef = useRef(null);
  const [cvLoaded, setCvLoaded] = useState(false);
  const [threshold, setThreshold] = useState({ lower: 50, upper: 150 });
  const [modelOpacity, setModelOpacity] = useState(0.55);
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState(null);
  const [discrepanciesList, setDiscrepanciesList] = useState([]);
  const [snapshots, setSnapshots] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [viewPdfMode, setViewPdfMode] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const videoRef = useRef(null);
  const processingCanvasRef = useRef(null); // canvas oculto para CV
  const overlayCanvasRef = useRef(null);    // canvas do feedback de bordas
  const threeCanvasRef = useRef(null);      // canvas do Three.js
  const streamRef = useRef(null);
  const analyzeLoopRef = useRef(null);

  const sceneRef = useRef(null); // ref compartilhado: hook 3D + ferramenta medicao
  const [viewMode, setViewMode] = useState('solido');
  const [bgColor, setBgColor] = useState('#1e293b');

  // Presets de fundo para o chão de fábrica
  const BG_PRESETS = [
    { label: 'Dark', color: '#1e293b' },
    { label: 'Preto', color: '#000000' },
    { label: 'Cinza', color: '#4a4a4a' },
    { label: 'Branco', color: '#f8fafc' },
    { label: 'Azul', color: '#0f172a' },
  ];

  const [measureMode, setMeasureMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState([]);
  const [measurement, setMeasurement] = useState(null);

  // Medicao: clique no canvas 3D
  const handleCanvasClick = useCallback((e) => {
    if (!measureMode || !geometry || !sceneRef.current) return;
    const canvas = threeCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    const raycaster = new THREE.Raycaster();
    const { camera, getMesh } = sceneRef.current;
    raycaster.setFromCamera({ x, y }, camera);
    const mesh = getMesh();
    if (!mesh) return;
    const hits = raycaster.intersectObject(mesh);
    if (!hits.length) return;
    const pt = hits[0].point.clone();
    setMeasurePoints(prev => {
      if (prev.length >= 2) {
        setMeasurement(null);
        return [pt];
      }
      const next = [...prev, pt];
      if (next.length === 2) {
        const d = next[0].distanceTo(next[1]);
        const dx = Math.abs(next[1].x - next[0].x);
        const dy = Math.abs(next[1].y - next[0].y);
        const dz = Math.abs(next[1].z - next[0].z);
        setMeasurement({ total: d.toFixed(2), dx: dx.toFixed(2), dy: dy.toFixed(2), dz: dz.toFixed(2) });
      }
      return next;
    });
  }, [measureMode, geometry]);

  // Inicializa cena Three.js
  useThreeScene(threeCanvasRef, geometry, modelOpacity, viewMode, bgColor, sceneRef);

  // Renderiza elementos visuais da medição no 3D
  useEffect(() => {
    if (!sceneRef.current) return;
    const { scene } = sceneRef.current;
    
    let measureGroup = scene.getObjectByName('measureGroup');
    if (measureGroup) scene.remove(measureGroup);

    if (measurePoints.length === 0 || !measureMode) return;

    measureGroup = new THREE.Group();
    measureGroup.name = 'measureGroup';

    // Pontos clicados
    const sphereGeo = new THREE.SphereGeometry(1.5, 16, 16);
    measurePoints.forEach((pt, i) => {
      const mat = new THREE.MeshBasicMaterial({ color: i === 0 ? 0xffaa00 : 0x00aaff });
      const sphere = new THREE.Mesh(sphereGeo, mat);
      sphere.position.copy(pt);
      measureGroup.add(sphere);
    });

    // Se temos 2 pontos, desenhamos as linhas (Total, dX, dY, dZ)
    if (measurePoints.length === 2) {
      const p1 = measurePoints[0];
      const p2 = measurePoints[1];

      // Linha de distância reta (Branca tracejada)
      const geoTotal = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const matTotal = new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 2, gapSize: 2 });
      const lineTotal = new THREE.Line(geoTotal, matTotal);
      lineTotal.computeLineDistances();
      measureGroup.add(lineTotal);

      // Eixo X (Vermelho)
      const px = new THREE.Vector3(p2.x, p1.y, p1.z);
      const geoX = new THREE.BufferGeometry().setFromPoints([p1, px]);
      measureGroup.add(new THREE.Line(geoX, new THREE.LineBasicMaterial({ color: 0xff4444 })));

      // Eixo Y (Verde)
      const py = new THREE.Vector3(p2.x, p2.y, p1.z);
      const geoY = new THREE.BufferGeometry().setFromPoints([px, py]);
      measureGroup.add(new THREE.Line(geoY, new THREE.LineBasicMaterial({ color: 0x44ff44 })));

      // Eixo Z (Azul)
      const geoZ = new THREE.BufferGeometry().setFromPoints([py, p2]);
      measureGroup.add(new THREE.Line(geoZ, new THREE.LineBasicMaterial({ color: 0x4444ff })));
    }
    
    scene.add(measureGroup);
  }, [measurePoints, measureMode]);

  // OpenCV via CDN - guard contra React StrictMode double-invoke
  useEffect(() => {
    if (window.cv && window.cv.Mat) { setCvLoaded(true); return; }
    if (document.getElementById('sinco-opencv')) {
      const t = setInterval(() => { if (window.cv && window.cv.Mat) { setCvLoaded(true); clearInterval(t); } }, 300);
      return () => clearInterval(t);
    }
    const script = document.createElement('script');
    script.id = 'sinco-opencv';
    script.src = 'https://docs.opencv.org/4.8.0/opencv.js';
    script.async = true;
    script.onload = () => {
      const t = setInterval(() => { if (window.cv && window.cv.Mat) { setCvLoaded(true); clearInterval(t); } }, 200);
    };
    document.body.appendChild(script);
    return () => stopCamera();
  }, []);

  // ── Câmera (WebRTC) ───────────────────────────────────
  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraBlocked(true);
        return;
      }

      setIsCameraActive(true);
      setCameraBlocked(false);
      setFallbackImgSrc(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          facingMode: "environment" 
        }
      });
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 50);
      streamRef.current = stream;
    } catch (err) {
        setIsCameraActive(false);
        if (err.name === 'NotAllowedError' || err.message.includes('reading getUserMedia')) {
           setCameraBlocked(true);
        } else {
           alert('Erro ao acessar a câmera: ' + err.message);
        }
    }
  };

  const handleFallbackImage = (e) => {
     const file = e.target.files[0];
     if (file) {
        const url = URL.createObjectURL(file);
        setFallbackImgSrc(url);
        setCameraBlocked(true);
     }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    setIsCameraActive(false);
    setCameraBlocked(false);
    setIsAnalyzing(false);
  };

  // ── Upload de STL ────────────────────────────────────
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setModelName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const loader = new STLLoader();
      try {
        const geo = loader.parse(ev.target.result);
        geo.center();
        setGeometry(geo);
      } catch {
        alert('Erro ao ler o arquivo STL.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ── Loop de Análise (OpenCV) ─────────────────────────
  const thresholdRef = useRef(threshold);
  useEffect(() => { thresholdRef.current = threshold; }, [threshold]);

  const processFrame = useCallback(() => {
    const video = videoRef.current;
    const procCanvas = processingCanvasRef.current;
    const overlay = overlayCanvasRef.current;
    const cv = window.cv;

    if (!video || !procCanvas || !overlay || !cv || video.readyState < 2) {
      analyzeLoopRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const W = video.videoWidth, H = video.videoHeight;
    if (!W || !H) { analyzeLoopRef.current = requestAnimationFrame(processFrame); return; }

    if (procCanvas.width !== W) { procCanvas.width = W; procCanvas.height = H; }
    if (overlay.width !== W) { overlay.width = W; overlay.height = H; }

    const ctx = procCanvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0);

    let src, gray, blurred, edges, feedback, contours, hierarchy;
    try {
      src = cv.imread(procCanvas);
      gray = new cv.Mat(); blurred = new cv.Mat(); edges = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      // Gaussian Blur — atenua reflexos metálicos do chão de fábrica
      cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
      cv.Canny(blurred, edges, thresholdRef.current.lower, thresholdRef.current.upper);

      feedback = cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC4);
      contours = new cv.MatVector(); hierarchy = new cv.Mat();
      cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      const red = new cv.Scalar(255, 50, 50, 255);
      for (let i = 0; i < contours.size(); i++) {
        const c = contours.get(i);
        if (cv.contourArea(c) > 120) {
          cv.drawContours(feedback, contours, i, red, 2, cv.LINE_8, hierarchy, 0);
        }
        c.delete();
      }
      cv.imshow(overlay, feedback);
    } catch (err) {
      console.error('CV Error:', err);
    } finally {
      src?.delete(); gray?.delete(); blurred?.delete(); edges?.delete();
      feedback?.delete(); contours?.delete(); hierarchy?.delete();
    }

    analyzeLoopRef.current = requestAnimationFrame(processFrame);
  }, []);

  // ── Inteligência Artificial (Diagnóstico Visual) ────────
  const handleDiagnostic = async () => {
    const video = videoRef.current;
    const fallbackImg = fallbackImgRef.current;
    if (!threeCanvasRef.current || (!video && !fallbackImgSrc)) return;
    
    setDiagnosticLoading(true);
    setDiagnosticResult(null);

    // 1. Extrair a foto perfeita do CAD (Modelo 3D alinhado pelo usuário)
    const canvas3D = threeCanvasRef.current;
    const img3D = canvas3D.toDataURL('image/jpeg', 0.8);

    // 2. Extrair a foto da câmera real OU da foto de fallback
    const canvasCam = document.createElement('canvas');
    if (fallbackImgSrc && fallbackImg) {
       canvasCam.width = fallbackImg.naturalWidth || 1280;
       canvasCam.height = fallbackImg.naturalHeight || 720;
       canvasCam.getContext('2d').drawImage(fallbackImg, 0, 0);
    } else if (video) {
       canvasCam.width = video.videoWidth;
       canvasCam.height = video.videoHeight;
       canvasCam.getContext('2d').drawImage(video, 0, 0);
    }
    const imgCam = canvasCam.toDataURL('image/jpeg', 0.8);

    try {
      let pdfDataStr = null;
      if (pdfFile) {
        const arrayBuffer = await pdfFile.arrayBuffer();
        const base64String = btoa(
          new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        pdfDataStr = 'data:application/pdf;base64,' + base64String;
      }

      const response = await fetch('/api/ai/analyze-3d', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          img3D,
          imgCam,
          pdfData: pdfDataStr
        })
      });

      if (!response.ok) {
        throw new Error('Falha na API de Visão: ' + response.statusText);
      }

      const data = await response.json();
      
      let finalReport = "🤖 **Agente Especialista (Gemini 1.5 Pro)**\n\n";
      finalReport += "✅ **STATUS GERAL:**\n" + data.general_status + "\n\n";
      
      if (data.discrepancies && data.discrepancies.length > 0) {
        finalReport += "❌ **DIVERGÊNCIAS DETECTADAS:**\n";
        data.discrepancies.forEach(d => {
           finalReport += "• " + d.description + "\n";
        });
      } else {
        finalReport += "✅ **DIVERGÊNCIAS:** Nenhuma não conformidade grave observada.\n";
      }

      setDiagnosticResult(finalReport);
      setDiscrepanciesList(data.discrepancies || []);
      setSnapshots({ img3D, imgCam });
    } catch (err) {
      setDiagnosticResult("❌ Erro na comunicação com a API de Visão: " + err.message);
    } finally {
      setDiagnosticLoading(false);
    }
  };

  const handleGeneratePDF = async () => {
    try {
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      
      let page = pdfDoc.addPage();
      const { width, height } = page.getSize();
      
      // Header MetalFisa
      page.drawText('METALFISA - RELATÓRIO DE INSPEÇÃO METROLÓGICA (IA)', {
        x: 50, y: height - 50, size: 16, font: boldFont, color: rgb(0.1, 0.1, 0.5)
      });
      page.drawText(`Data: ${new Date().toLocaleString('pt-BR')}`, {
        x: 50, y: height - 70, size: 10, font
      });
      page.drawText(`Peça / STL: ${modelName || 'Não especificado'}`, {
        x: 50, y: height - 85, size: 10, font
      });

      // Laudo do Agente
      page.drawText('LAUDO TÉCNICO:', {
        x: 50, y: height - 120, size: 12, font: boldFont
      });
      
      const lines = diagnosticResult ? diagnosticResult.split('\n') : [];
      let yOffset = height - 140;
      for (const line of lines) {
        if (yOffset < 50) {
          page = pdfDoc.addPage();
          yOffset = height - 50;
        }

        // Remover/Substituir emojis e caracteres markdown que quebram o padrão WinAnsi (Helvetica)
        const safeLine = line
          .replace(/🤖|🧠/g, '[IA]')
          .replace(/📄/g, '[DOC]')
          .replace(/⚠️/g, '[AVISO]')
          .replace(/❌/g, '[DIVERGENCIA]')
          .replace(/✅/g, '[OK]')
          .replace(/•/g, '-')
          .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
          .replace(/\*\*/g, '');

        page.drawText(safeLine, { x: 50, y: yOffset, size: 10, font });
        yOffset -= 15;
      }

      // Imagens Capturadas
      if (snapshots) {
        page = pdfDoc.addPage();
        page.drawText('EVIDÊNCIAS VISUAIS (Captura de Inspeção):', {
          x: 50, y: height - 50, size: 12, font: boldFont
        });

        // The dataURLs need to be split to get the base64 part
        const img3DBytes = Uint8Array.from(atob(snapshots.img3D.split(',')[1]), c => c.charCodeAt(0));
        const imgCamBytes = Uint8Array.from(atob(snapshots.imgCam.split(',')[1]), c => c.charCodeAt(0));

        const img3D = await pdfDoc.embedJpg(img3DBytes);
        const imgCam = await pdfDoc.embedJpg(imgCamBytes);
        
        // Render 3D Model
        page.drawText('Modelo 3D (Referência):', { x: 50, y: height - 80, size: 10, font: boldFont });
        page.drawImage(img3D, { x: 50, y: height - 280, width: 220, height: 180 });

        // Render Camera with Discrepancies
        page.drawText('Câmera (Física) c/ Marcações da IA:', { x: 300, y: height - 80, size: 10, font: boldFont });
        page.drawImage(imgCam, { x: 300, y: height - 280, width: 220, height: 180 });
        
        // Desenhar marcações (Bounding Boxes) sobre a imagem da câmera
        if (discrepanciesList.length > 0) {
           discrepanciesList.forEach((disc, idx) => {
             if (disc.coordinates) {
               // A Imagem tem tamanho 220x180 e é desenhada em x: 300, y: height - 280
               const bx = 300 + (disc.coordinates.x * 220);
               // 'y' na API é top-down. No pdf-lib 'y' é bottom-up
               const by = (height - 280) + 180 - (disc.coordinates.y * 180) - (disc.coordinates.h * 180);
               const bw = disc.coordinates.w * 220;
               const bh = disc.coordinates.h * 180;
               
               page.drawRectangle({
                 x: bx, y: by, width: bw, height: bh,
                 borderColor: rgb(1, 0, 0),
                 borderWidth: 2,
               });
               page.drawText((idx + 1).toString(), { x: bx, y: by + bh + 2, size: 12, color: rgb(1, 0, 0), font: boldFont });
             }
           });
        }
      }

      // Append Original PDF Se existir
      if (pdfFile) {
        try {
           const arrayBuffer = await pdfFile.arrayBuffer();
           const attachedPdf = await PDFDocument.load(arrayBuffer);
           
           // Se a IA gerou pontos, anotar na PRIMEIRA PÁGINA do Desenho Técnico também!
           const attachedPages = attachedPdf.getPages();
           if (attachedPages.length > 0 && discrepanciesList.length > 0) {
              const p1 = attachedPages[0];
              const { width: p1w, height: p1h } = p1.getSize();
              
              discrepanciesList.forEach((disc, idx) => {
                 if (disc.coordinates) {
                    const bx = disc.coordinates.x * p1w;
                    const by = p1h - (disc.coordinates.y * p1h);
                    
                    p1.drawCircle({
                       x: bx, y: by, size: 15,
                       borderColor: rgb(1, 0, 0),
                       borderWidth: 3,
                       color: rgb(1, 0, 0, 0.2) // Vermelho transparente
                    });
                    p1.drawText("Erro " + (idx + 1), { x: bx + 20, y: by, size: 14, color: rgb(1, 0, 0) });
                 }
              });
           }

           const copiedPages = await pdfDoc.copyPages(attachedPdf, attachedPdf.getPageIndices());
           copiedPages.forEach((p) => pdfDoc.addPage(p));
        } catch(e) {
           console.error("Erro ao mesclar o PDF de desenho", e);
        }
      }

      // Download
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Laudo_Inspecao_${modelName || 'Metalfisa'}.pdf`;
      link.click();
    } catch (err) {
      alert("Erro ao gerar o PDF Oficial: " + err.message);
    }
  };

  const analyzeTimeoutRef = useRef(null);

  useEffect(() => {
    if (isAnalyzing) {
      analyzeLoopRef.current = requestAnimationFrame(processFrame);
      
      // Auto-turn off para economizar bateria do tablet (Máximo de 2 minutos = 120000ms)
      const maxProcessingTime = 120000;
      analyzeTimeoutRef.current = setTimeout(() => {
        setIsAnalyzing(false);
        console.warn("Processamento em tempo real finalizado automaticamente por limite de tempo (Economia de Bateria).");
      }, maxProcessingTime);

    } else {
      cancelAnimationFrame(analyzeLoopRef.current);
      if (analyzeTimeoutRef.current) clearTimeout(analyzeTimeoutRef.current);
      // Limpa overlay ao parar
      const overlay = overlayCanvasRef.current;
      if (overlay) overlay.getContext('2d')?.clearRect(0, 0, overlay.width, overlay.height);
    }
    
    return () => {
      cancelAnimationFrame(analyzeLoopRef.current);
      if (analyzeTimeoutRef.current) clearTimeout(analyzeTimeoutRef.current);
    };
  }, [isAnalyzing, processFrame]);

  return (
    <div className="p-4 flex flex-col bg-slate-900 text-white" style={{ height: 'calc(100vh - 64px)' }}>

      {/* ── Header ─────────────────────────────────────── */}
      <div className="mb-3 flex flex-wrap gap-3 items-center justify-between bg-slate-800 px-5 py-3 rounded-xl border border-slate-700">
        <div className="flex items-center gap-3">
          <Eye className="text-emerald-400" size={26} />
          <div>
            <h1 className="text-lg font-bold tracking-wide">Análise 3D — Visão Computacional / WebAR</h1>
            <p className="text-[11px] text-slate-400 font-mono">
              OpenCV.js: {cvLoaded ? '🟢 Pronto' : '🟡 Carregando...'}
              {modelName && <span className="ml-3 text-blue-400">📦 {modelName}</span>}
            </p>
          </div>
          <button 
            onClick={() => setShowHelpModal(true)}
            className="ml-2 p-1.5 bg-slate-700 border border-slate-600 hover:bg-slate-600 hover:text-white rounded-full text-slate-300 transition-colors"
            title="Ajuda e Dicas de Uso"
          >
            <HelpCircle size={18} />
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg cursor-pointer text-sm border border-slate-600 transition-colors">
            <UploadCloud size={16} />
            Carregar STL
            <input type="file" accept=".stl" className="hidden" onChange={handleFileUpload} />
          </label>

          <button
            onClick={isCameraActive ? stopCamera : startCamera}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
              isCameraActive
                ? 'bg-red-500/20 text-red-400 border-red-500/50 hover:bg-red-500/30'
                : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500'
            }`}
          >
            <Camera size={16} />
            {isCameraActive ? 'Desligar Câmera' : 'Ativar Câmera'}
          </button>

          {/* Anexo de PDF Técnico */}
          <div className="flex items-center gap-1">
            {!pdfFile ? (
              <label className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg cursor-pointer text-sm border border-slate-600 transition-colors" title="Anexar desenho técnico em PDF para a IA">
                <FileText size={16} className="text-indigo-400" />
                <span>PDF (Opcional)</span>
                <input type="file" accept=".pdf" className="hidden" onChange={(e) => setPdfFile(e.target.files[0])} />
              </label>
            ) : (
              <div className="flex items-center gap-2 bg-indigo-900/40 text-indigo-200 border border-indigo-500/50 px-3 py-1.5 rounded-lg text-xs font-mono">
                <FileText size={14} className="text-indigo-400" />
                <span className="truncate max-w-[120px]">{pdfFile.name}</span>
                <button onClick={() => { setPdfFile(null); setViewPdfMode(false); }} className="p-0.5 hover:bg-indigo-500/50 rounded-full transition-colors">
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsAnalyzing(p => !p)}
            disabled={!isCameraActive || !cvLoaded}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all border ${
              !isCameraActive || !cvLoaded
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed border-slate-600'
                : isAnalyzing
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-900 border-amber-400 shadow-lg shadow-amber-500/20'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-900 border-emerald-400 shadow-lg shadow-emerald-500/20'
            }`}
          >
            <Activity size={16} />
            {isAnalyzing ? 'Parar Análise' : 'Comparação Real-Time'}
          </button>

          <button
            onClick={handleDiagnostic}
            disabled={!(isCameraActive || fallbackImgSrc) || diagnosticLoading}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all border ${
              !(isCameraActive || fallbackImgSrc)
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed border-slate-600'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500 shadow-lg shadow-indigo-500/20'
            }`}
          >
            {diagnosticLoading ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Analisando IA...</>
            ) : (
              <>🧠 Gerar Diagnóstico IA</>
            )}
          </button>
        </div>
      </div>

      {/* ── Viewport principal + Sidebar ───────────────── */}
      <div className="flex flex-1 gap-3 min-h-0">

        {/* PAINEL 3D */}
        <div className={`relative rounded-xl overflow-hidden border border-slate-700 shadow-2xl ${isCameraActive && geometry ? 'flex-1 min-h-[200px]' : 'flex-1'}`}>

          {/* Label split-screen */}
          {isCameraActive && geometry && (
            <div className="absolute top-2 left-2 z-30 bg-slate-900/80 backdrop-blur-sm text-[10px] font-bold text-emerald-400 px-2 py-1 rounded border border-slate-700 pointer-events-none">
              MODELO 3D
            </div>
          )}

          {/* Canvas Three.js - ocupa todo o painel 3D */}
          <canvas
            ref={threeCanvasRef}
            className={`absolute inset-0 w-full h-full pointer-events-auto z-10 ${viewPdfMode ? 'invisible' : 'visible'}`}
            onClick={handleCanvasClick}
            style={{ cursor: measureMode ? "crosshair" : "grab" }}
          />

          {/* Visualizador de PDF */}
          {pdfFile && viewPdfMode && (
            <iframe 
              src={URL.createObjectURL(pdfFile)} 
              className="absolute inset-0 w-full h-full z-20 bg-slate-800"
              title="Visualizador de PDF Técnico"
            />
          )}

          {/* Botão de Toggle PDF/3D */}
          {pdfFile && (
            <div className="absolute top-2 right-2 z-40">
              <button 
                onClick={() => setViewPdfMode(!viewPdfMode)}
                className={`flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded border transition-colors shadow-lg ${
                  viewPdfMode 
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-indigo-900/50 hover:bg-indigo-500' 
                    : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <FileText size={14} />
                {viewPdfMode ? 'Voltar para 3D' : 'Ver PDF em Tela Cheia'}
              </button>
            </div>
          )}

          {!geometry && isCameraActive && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur-sm text-slate-300 text-xs px-4 py-2 rounded-full border border-slate-700 z-40">
              ⬆ Carregue um arquivo STL para sobrepor o modelo à peça
            </div>
          )}

          {/* Indicador de análise ativa */}
          {isAnalyzing && (
            <div className="absolute top-3 left-3 flex items-center gap-2 bg-red-500/20 border border-red-500/50 text-red-400 text-xs px-3 py-1.5 rounded-full z-40 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              ANALISANDO — Bordas detectadas em vermelho
            </div>
          )}

          {/* HUD de controles de navegação 3D */}
          {geometry && (
            <div className="absolute bottom-3 right-3 z-40 bg-slate-900/75 backdrop-blur-sm border border-slate-700/60 rounded-xl px-3 py-2.5 text-[10px] text-slate-400 space-y-1 pointer-events-none select-none">
              <p className="text-slate-200 font-bold text-[11px] mb-1.5">Controles 3D</p>
              <div className="flex items-center gap-2">
                <kbd className="bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-mono text-[9px]">🖱 Esq</kbd>
                <span>Girar peça</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-mono text-[9px]">🖱 Dir</kbd>
                <span>Pan — deslocar</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-mono text-[9px]">⬆ Scroll</kbd>
                <span>Zoom in / out</span>
              </div>
              <div className="flex items-center gap-2 border-t border-slate-700/50 pt-1 mt-1">
                <kbd className="bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-mono text-[9px]">👆👆</kbd>
                <span>Pinch = zoom · 2 dedos = pan</span>
              </div>
            </div>
          )}
        </div>

        {/* PAINEL CÂMERA — só aparece quando câmera ativa ou câmera bloqueada */}
        {(isCameraActive || cameraBlocked) && (
          <div className={`relative rounded-xl overflow-hidden border border-slate-700 shadow-2xl bg-black ${geometry ? 'flex-1 min-h-[200px]' : 'flex-1'}`}>
            {geometry && (
              <div className="absolute top-2 left-2 z-30 bg-slate-900/80 backdrop-blur-sm text-[10px] font-bold text-red-400 px-2 py-1 rounded border border-slate-700 pointer-events-none">
                {cameraBlocked ? 'FOTO REAL (FALLBACK)' : 'CÂMERA REAL'}
              </div>
            )}
            
            {!cameraBlocked ? (
               <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
            ) : (
               <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-20">
                  {!fallbackImgSrc ? (
                     <>
                        <Camera size={48} className="text-slate-500 mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">Câmera Bloqueada</h3>
                        <p className="text-xs text-slate-400 mb-6 max-w-sm">Tire uma foto manual da peça (Modo de Compatibilidade Segura).</p>
                        <label className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl cursor-pointer shadow-lg flex items-center gap-2">
                           <Camera size={20} />
                           <span>Tirar Foto da Peça</span>
                           <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFallbackImage} />
                        </label>
                     </>
                  ) : (
                     <>
                        <img ref={fallbackImgRef} src={fallbackImgSrc} alt="Fallback" className="absolute inset-0 w-full h-full object-cover" />
                        <label className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-800/80 text-white font-bold py-2 px-4 rounded-full cursor-pointer border border-slate-600 backdrop-blur-sm flex items-center gap-2 text-xs shadow-xl z-50">
                           <Camera size={14} />
                           <span>Refazer Foto</span>
                           <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFallbackImage} />
                        </label>
                     </>
                  )}
               </div>
            )}

            <canvas ref={overlayCanvasRef} className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10" style={{ mixBlendMode: 'screen', opacity: 0.85 }} />
            <canvas ref={processingCanvasRef} className="hidden" />
            
            {isAnalyzing && !cameraBlocked && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-red-500/20 border border-red-500/50 text-red-400 text-xs px-3 py-1.5 rounded-full z-40 backdrop-blur-sm whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                DETECTANDO BORDAS
              </div>
            )}
            {!geometry && (
              <div className="absolute bottom-4 right-4 bg-slate-900/80 text-slate-400 text-xs px-4 py-2 rounded-full border border-slate-700 z-40 whitespace-nowrap pointer-events-none">
                Carregue um STL para comparar
              </div>
            )}
          </div>
        )}

        {/* Sidebar de Calibração */}
        <div className="w-72 bg-slate-800 rounded-xl p-4 border border-slate-700 flex flex-col gap-5 overflow-y-auto">
          <div>
            <h2 className="text-base font-bold flex items-center gap-2">
              <Sliders size={16} className="text-blue-400" />
              Calibração Industrial
            </h2>
            <p className="text-xs text-slate-400 mt-1">Ajuste para a iluminação e reflexos do ambiente de fábrica.</p>
          </div>

          {/* Seletor de Modo de Visualização */}
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-2">Modo de Visualização 3D</label>
            <div className="grid grid-cols-3 gap-1.5">
              {Object.entries(VIEW_MODES).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setViewMode(key)}
                  className={`py-2 px-1 rounded-lg text-[11px] font-bold transition-all border ${
                    viewMode === key
                      ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20'
                      : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600 hover:text-white'
                  }`}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 mt-1.5">
              {viewMode === 'wireframe' && 'Grade de arames neon — visibilidade máxima'}
              {viewMode === 'solido' && 'Superfície metálica sólida — realismo industrial'}
              {viewMode === 'transparente' && 'Translúcido — ideal para inspeção interna'}
            </p>
          </div>

          {/* Cor de Fundo 3D */}
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-2">Cor de Fundo 3D</label>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {BG_PRESETS.map(p => (
                <button key={p.color} onClick={() => setBgColor(p.color)} title={p.label}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${bgColor === p.color ? "border-blue-400 scale-110" : "border-slate-600"}`}
                  style={{ background: p.color }} />
              ))}
              <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border border-slate-600" title="Personalizada" />
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="text-xs font-medium text-slate-300 flex justify-between mb-1">
                <span>Threshold Canny — Mínimo</span>
                <span className="text-blue-400 font-mono">{threshold.lower}</span>
              </label>
              <input
                type="range" min="0" max="255" value={threshold.lower}
                onChange={e => setThreshold(p => ({ ...p, lower: +e.target.value }))}
                className="w-full accent-blue-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">Valor baixo = mais sensível (mais ruído)</p>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 flex justify-between mb-1">
                <span>Threshold Canny — Máximo</span>
                <span className="text-blue-400 font-mono">{threshold.upper}</span>
              </label>
              <input
                type="range" min="0" max="255" value={threshold.upper}
                onChange={e => setThreshold(p => ({ ...p, upper: +e.target.value }))}
                className="w-full accent-blue-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">Valor alto = só bordas fortes (menos ruído)</p>
            </div>

            <div className="pt-3 border-t border-slate-700">
              <label className="text-xs font-medium text-slate-300 flex justify-between mb-1">
                <span>Opacidade do Modelo 3D</span>
                <span className="text-emerald-400 font-mono">{Math.round(modelOpacity * 100)}%</span>
              </label>
              <input
                type="range" min="5" max="100" value={modelOpacity * 100}
                onChange={e => setModelOpacity(+e.target.value / 100)}
                className="w-full accent-emerald-500"
              />
            </div>
          </div>

          {/* Medicao */}
          <div>
            <button onClick={() => { setMeasureMode(p => !p); setMeasurePoints([]); setMeasurement(null); }}
              className={`w-full py-2 px-3 rounded-lg text-sm font-bold border transition-all flex items-center justify-center gap-2 ${measureMode ? "bg-amber-500 border-amber-400 text-slate-900" : "bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"}`}>
              {measureMode ? 'Sair da Medicao' : '📏 Ferramenta de Medicao'}
            </button>
            {measureMode && (
              <p className="text-[10px] text-amber-400 mt-1 text-center">Clique em 2 pontos no modelo</p>
            )}
            {measurement && (
              <div className="mt-2 bg-slate-900 rounded-lg p-3 border border-slate-700 text-xs font-mono">
                <p className="text-white font-bold text-sm mb-1">📐 {measurement.total} mm</p>
                <p className="text-red-400">ΔX: {measurement.dx} mm</p>
                <p className="text-green-400">ΔY: {measurement.dy} mm</p>
                <p className="text-blue-400">ΔZ: {measurement.dz} mm</p>
                <p className="text-slate-500 text-[10px] mt-1">Escala 1:1 — unidades em mm</p>
              </div>
            )}
            {measurePoints.length === 1 && !measurement && (
              <div className="mt-2 bg-slate-900 rounded-lg p-2 text-[10px] text-amber-300 border border-amber-800/40">
                Ponto A definido. Clique no Ponto B.
              </div>
            )}
          </div>

          {/* Resultado do Diagnóstico IA */}
          {diagnosticResult && (
            <div className="bg-indigo-900/30 border border-indigo-500/50 rounded-xl p-3 mt-2 shadow-lg shadow-indigo-900/20">
              <div className="text-xs text-indigo-200 whitespace-pre-line leading-relaxed">
                {diagnosticResult}
              </div>
              
              {pdfFile && (
                <div className="mt-3 border border-indigo-500/30 rounded overflow-hidden">
                  <div className="bg-indigo-800/50 px-2 py-1 text-[10px] text-indigo-200 font-bold flex items-center gap-1">
                    <FileText size={12} /> Referência 2D Analisada
                  </div>
                  <iframe 
                    src={URL.createObjectURL(pdfFile)} 
                    className="w-full h-48 bg-white" 
                    title="PDF Técnico"
                  />
                </div>
              )}

              <div className="mt-3 flex gap-2">
                <button 
                  onClick={handleGeneratePDF}
                  className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] uppercase font-bold tracking-wider transition-colors flex items-center justify-center gap-1 shadow-lg shadow-emerald-900/20"
                >
                  <Download size={14} /> Salvar PDF Oficial
                </button>
                <button 
                  onClick={() => { setDiagnosticResult(null); setSnapshots(null); }}
                  className="w-10 py-1.5 bg-indigo-800/50 hover:bg-indigo-700/50 text-indigo-300 rounded flex items-center justify-center transition-colors"
                  title="Dispensar Relatório"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Legenda visual */}
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Legenda Visual</h3>
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <span className="w-4 h-0.5 bg-red-400 inline-block rounded" />
              Bordas reais detectadas (câmera)
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <span className="w-4 h-0.5 bg-emerald-400 inline-block rounded" style={{ boxShadow: '0 0 4px #00ffcc' }} />
              Wireframe 3D (modelo STL)
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Desvios = regiões onde vermelho não coincide com verde.
            </p>
          </div>

          {/* Instruções */}
          <div className="mt-auto bg-slate-900/60 p-3 rounded-lg border border-slate-700/60">
            <h3 className="text-xs font-bold text-amber-400 mb-2 flex items-center gap-1">
              <AlertCircle size={13} /> Instruções de Uso
            </h3>
            <ol className="text-[11px] text-slate-400 space-y-1 list-decimal pl-3">
              <li>Carregue o arquivo STL da peça de referência.</li>
              <li>Ative a câmera e aponte para a peça física.</li>
              <li>Use o mouse para rotacionar/alinhar o wireframe 3D com a peça.</li>
              <li>Clique em "Comparação Real-Time" para ativar a detecção.</li>
              <li>Ajuste os sliders de Canny conforme a luz do ambiente.</li>
            </ol>
          </div>
        </div>
      </div>

      {/* MODAL DE AJUDA */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-600 rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <HelpCircle size={20} className="text-blue-400" /> 
                Guia Rápido: Inspeção 3D e IA
              </h2>
              <button onClick={() => setShowHelpModal(false)} className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700 transition">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-300">
              {/* Seção 1: Configuração Câmera Tablets */}
              <section className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-lg">
                <h3 className="text-white font-bold mb-2 flex items-center gap-2">
                  <Camera size={16} className="text-blue-400" />
                  Ativar Câmera nos Tablets Industriais (HTTP)
                </h3>
                <p className="mb-2">Por questões de segurança global, os navegadores de tablets (Android/iPad) bloqueiam o acesso direto à câmera em sites rodando na rede local (IP sem certificado válido).</p>
                <div className="bg-slate-900 p-3 rounded font-mono text-[11px] text-emerald-400 mb-2 border border-slate-700 shadow-inner">
                  1. Abra o Chrome no Tablet.<br/>
                  2. Digite na URL: <span className="text-white">chrome://flags/#unsafely-treat-insecure-origin-as-secure</span><br/>
                  3. No campo "Insecure origins...", digite: <span className="text-white">http://192.168.1.77:3001</span> (ou :3002)<br/>
                  4. Mude para <span className="text-amber-400">Enabled</span> e clique no botão azul <span className="text-amber-400">Relaunch</span> no final da tela.
                </div>
                <p className="text-xs text-blue-200">Isso só precisa ser feito uma vez por Tablet. Caso não seja feito, o sistema forçará o "Modo de Foto Segura" em vez do vídeo contínuo.</p>
              </section>

              {/* Seção 2: Como usar */}
              <section>
                <h3 className="text-white font-bold mb-2 border-b border-slate-700 pb-1">Passo a Passo da Inspeção</h3>
                <ol className="list-decimal pl-5 space-y-2">
                  <li><strong>Posicione a Peça:</strong> Coloque a peça física em uma mesa com fundo de cor diferente para dar contraste.</li>
                  <li><strong>Ligue a Câmera:</strong> Ative a câmera ou tire uma foto via Modo Alternativo.</li>
                  <li><strong>Carregue o Projeto:</strong> Anexe o arquivo <strong>.STL</strong> da peça. Use o mouse/dedo para arrastar, girar (1 dedo) e dar zoom (2 dedos) para encaixar o modelo 3D digital exatamente em cima do vídeo da peça física.</li>
                  <li><strong>Ferramenta de Medição 3D:</strong> Ative a régua, clique em dois pontos do modelo 3D para obter a distância exata em MM (Escala 1:1).</li>
                  <li><strong>Comparação OpenCV (Real-time):</strong> Liga um rastreador de bordas (linhas vermelhas). Se as bordas vermelhas vazarem para fora do modelo 3D, a peça está fora de medida. <em>(Desliga automaticamente em 2 minutos para poupar bateria).</em></li>
                </ol>
              </section>

              {/* Seção 3: IA e Relatório Oficial */}
              <section>
                <h3 className="text-white font-bold mb-2 border-b border-slate-700 pb-1 flex items-center gap-2">
                  <Activity size={16} className="text-indigo-400" />
                  Gerando o Laudo da Inteligência Artificial
                </h3>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Base da IA:</strong> Você pode anexar opcionalmente o Desenho Técnico em <strong>.PDF</strong>. O Gemini usará o PDF e a Foto da peça para procurar furos ausentes, medidas tortas e falta de solda.</li>
                  <li><strong>Marcadores:</strong> Ao clicar em <strong>Baixar PDF Oficial</strong>, a IA vai desenhar <span className="text-red-400 font-bold">caixas vermelhas</span> em cima da foto tirada apontando onde está o defeito, e vai anotar o PDF Técnico automaticamente.</li>
                  <li><strong>Tempo:</strong> A IA do Gemini 1.5 Pro leva cerca de 10 a 20 segundos para processar as 3 camadas de arquivos complexos. Tenha paciência!</li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}








