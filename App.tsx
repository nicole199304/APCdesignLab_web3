import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Canvas } from './components/Canvas';
import { BottomBar } from './components/BottomBar';
import { LayerPanel } from './components/LayerPanel';
import { Icons } from './components/Icons';
import { Layer, ToolMode } from './types';

// Sample initial data
const INITIAL_LAYERS: Layer[] = [
  {
    id: 'layer-1',
    type: 'image',
    src: 'https://picsum.photos/800/600',
    x: 200,
    y: 100,
    width: 600,
    height: 450,
    rotation: 0,
    zIndex: 1,
    name: 'Background',
    visible: true
  }
];

// --- Advanced Color Math (CIELAB) ---
const rgb2lab = (r: number, g: number, b: number) => {
    let r_ = r / 255, g_ = g / 255, b_ = b / 255;
    r_ = r_ > 0.04045 ? Math.pow((r_ + 0.055) / 1.055, 2.4) : r_ / 12.92;
    g_ = g_ > 0.04045 ? Math.pow((g_ + 0.055) / 1.055, 2.4) : g_ / 12.92;
    b_ = b_ > 0.04045 ? Math.pow((b_ + 0.055) / 1.055, 2.4) : b_ / 12.92;

    let x = (r_ * 0.4124 + g_ * 0.3576 + b_ * 0.1805) / 0.95047;
    let y = (r_ * 0.2126 + g_ * 0.7152 + b_ * 0.0722) / 1.00000;
    let z = (r_ * 0.0193 + g_ * 0.1192 + b_ * 0.9505) / 1.08883;

    x = x > 0.008856 ? Math.pow(x, 1/3) : (7.787 * x) + 16/116;
    y = y > 0.008856 ? Math.pow(y, 1/3) : (7.787 * y) + 16/116;
    z = z > 0.008856 ? Math.pow(z, 1/3) : (7.787 * z) + 16/116;

    return [(116 * y) - 16, 500 * (x - y), 200 * (y - z)];
};

const deltaE = (labA: number[], labB: number[]) => {
    return Math.sqrt(
        Math.pow(labA[0] - labB[0], 2) +
        Math.pow(labA[1] - labB[1], 2) +
        Math.pow(labA[2] - labB[2], 2)
    );
};

const App: React.FC = () => {
  const [layers, setLayers] = useState<Layer[]>(INITIAL_LAYERS);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [toolMode, setToolMode] = useState<ToolMode>(ToolMode.SELECT);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedLayerId) {
        setLayers(prev => prev.filter(l => l.id !== selectedLayerId));
        setSelectedLayerId(null);
        showNotification("Layer deleted");
      }
      if (e.key === 'v') setToolMode(ToolMode.SELECT);
      if (e.key === 'h') setToolMode(ToolMode.HAND);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLayerId]);

  const updateLayer = useCallback((id: string, updates: Partial<Layer>) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  }, []);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      const img = new Image();
      img.src = src;
      img.onload = () => {
        const scale = Math.min(600 / img.width, 1);
        const width = img.width * scale;
        const height = img.height * scale;

        const newLayer: Layer = {
          id: `layer-${Date.now()}`,
          type: 'image',
          src: src,
          x: window.innerWidth / 2 - width / 2 - 150, 
          y: window.innerHeight / 2 - height / 2,
          width: width,
          height: height,
          rotation: 0,
          zIndex: layers.length + 1,
          name: file.name.split('.')[0],
          visible: true
        };
        
        setLayers(prev => [...prev, newLayer]);
        setSelectedLayerId(newLayer.id);
        showNotification("Image imported");
      };
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // --- The Engine: Advanced Soft-Cutout Logic with Flood Fill ---
  const processSmartCutout = async (layer: Layer, points: {x: number, y: number}[], strokeWidth: number) => {
    return new Promise<{ newLayerSrc: string, maskForOriginal: string }>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = layer.src;
        img.onload = () => {
            const w = layer.width;
            const h = layer.height;
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) return;

            canvas.width = w;
            canvas.height = h;
            ctx.drawImage(img, 0, 0, w, h);
            
            const fullImageData = ctx.getImageData(0, 0, w, h);
            const pixels = fullImageData.data;

            // 1. Identify Seed Pixels from Brush
            // We draw the user's brush stroke on a temp canvas to know exactly which pixels started the selection
            const maskCvs = document.createElement('canvas');
            maskCvs.width = w;
            maskCvs.height = h;
            const maskCtx = maskCvs.getContext('2d');
            if (!maskCtx) return;

            maskCtx.beginPath();
            if(points.length > 0) {
                maskCtx.moveTo(points[0].x, points[0].y);
                points.forEach(p => maskCtx.lineTo(p.x, p.y));
            }
            maskCtx.lineCap = 'round';
            maskCtx.lineJoin = 'round';
            maskCtx.lineWidth = strokeWidth; // Use the brush size
            maskCtx.strokeStyle = '#FFFFFF';
            maskCtx.stroke();

            const brushData = maskCtx.getImageData(0, 0, w, h).data;
            const seeds: number[] = []; // Array of pixel indices (i/4)
            
            // Collect Color Statistics from the Brush Area
            let rSum = 0, gSum = 0, bSum = 0, count = 0;
            
            for (let i = 0; i < brushData.length; i += 4) {
                if (brushData[i] > 128) { // If pixel is painted
                    const idx = i;
                    seeds.push(i / 4);
                    rSum += pixels[idx];
                    gSum += pixels[idx+1];
                    bSum += pixels[idx+2];
                    count++;
                }
            }

            if (count === 0) {
                // Fallback if brush was somehow empty, use first point
                const idx = (Math.floor(points[0].y) * w + Math.floor(points[0].x)) * 4;
                rSum = pixels[idx]; gSum = pixels[idx+1]; bSum = pixels[idx+2];
                count = 1;
                seeds.push(idx/4);
            }

            const targetLab = rgb2lab(Math.round(rSum/count), Math.round(gSum/count), Math.round(bSum/count));

            // 2. Flood Fill (Region Growing)
            // This ensures we only select pixels physically connected to the brush
            const outputAlpha = new Float32Array(w * h).fill(0); // 0.0 to 1.0
            const visited = new Uint8Array(w * h).fill(0);
            
            // Queue for BFS
            const queue = new Int32Array(w * h);
            let qHead = 0;
            let qTail = 0;

            // Initialize Queue with Seeds
            for(let seedIdx of seeds) {
                if(visited[seedIdx] === 0) {
                    visited[seedIdx] = 1;
                    outputAlpha[seedIdx] = 1.0; // Seeds are 100% selected
                    queue[qTail++] = seedIdx;
                }
            }

            // Parameters
            const tolerance = 25; // Lab distance units. 
            const softEdge = 10;  // Feather distance. Pixels between tolerance and tolerance+softEdge get partial alpha.

            const dx = [1, -1, 0, 0];
            const dy = [0, 0, 1, -1];

            while(qHead < qTail) {
                const currIdx = queue[qHead++];
                const cx = currIdx % w;
                const cy = Math.floor(currIdx / w);

                // Check Neighbors
                for(let i=0; i<4; i++) {
                    const nx = cx + dx[i];
                    const ny = cy + dy[i];

                    if(nx >= 0 && nx < w && ny >= 0 && ny < h) {
                        const nIdx = ny * w + nx;
                        
                        if(visited[nIdx] === 0) {
                            visited[nIdx] = 1;

                            // Color Distance Check
                            const pIdx = nIdx * 4;
                            const nLab = rgb2lab(pixels[pIdx], pixels[pIdx+1], pixels[pIdx+2]);
                            const dist = deltaE(targetLab, nLab);

                            if(dist < (tolerance + softEdge)) {
                                // Calculate Alpha
                                let alpha = 1.0;
                                if (dist > tolerance) {
                                    // Linear falloff for soft edge
                                    alpha = 1.0 - ((dist - tolerance) / softEdge);
                                }
                                
                                outputAlpha[nIdx] = alpha;

                                // Only continue growing if we are effectively inside the object
                                // If alpha is very low, we treat it as an edge and stop growing
                                if (alpha > 0.1) {
                                    queue[qTail++] = nIdx;
                                }
                            }
                        }
                    }
                }
            }

            // 3. Generate Output Layers
            const holeData = new ImageData(w, h); // For the original layer (The Mask)
            
            // Process output buffers
            for(let i=0; i < w * h; i++) {
                const pixelIdx = i * 4;
                const alphaVal = outputAlpha[i]; // 0.0 to 1.0

                // New Layer Pixel
                if (alphaVal > 0) {
                    // pixels[pixelIdx ... +2] remain the same color
                    pixels[pixelIdx + 3] = Math.floor(alphaVal * 255);
                } else {
                    pixels[pixelIdx + 3] = 0;
                }

                // Hole Map (for Original Layer)
                // We want to hide the parts we extracted.
                // Logic: Original * (1 - ExtractedAlpha)
                // If Extracted is 1.0 (Opaque), Hole is 0.0 (Transparent)
                // If Extracted is 0.5, Hole is 0.5.
                // When stacked: Color*0.5 + Color*0.5 = Color*1.0. Seamless.
                
                const holeAlpha = Math.floor(255 * (1 - alphaVal));
                
                // SVG Mask uses Luminance. White = Show, Black = Hide.
                // So holeAlpha 0 (Black) means Hide. Perfect.
                holeData.data[pixelIdx] = holeAlpha;
                holeData.data[pixelIdx+1] = holeAlpha;
                holeData.data[pixelIdx+2] = holeAlpha;
                holeData.data[pixelIdx+3] = 255; // Alpha of the mask image itself is always opaque
            }

            // --- Post-Processing: Dilate the Alpha slightly to fill micro-holes? ---
            // Optional, but might be good for noise. For now, Flood Fill is robust enough against noise.

            // 4. Finalize
            ctx.putImageData(fullImageData, 0, 0);
            const newLayerSrc = canvas.toDataURL('image/png');

            const holeCvs = document.createElement('canvas');
            holeCvs.width = w;
            holeCvs.height = h;
            const holeCtx = holeCvs.getContext('2d');
            holeCtx?.putImageData(holeData, 0, 0);
            const maskForOriginal = holeCvs.toDataURL('image/png');

            resolve({ newLayerSrc, maskForOriginal });
        };
        img.onerror = reject;
    });
  };

  const handleCutout = async (type: 'click' | 'brush', data: any) => {
      if (!selectedLayerId) {
          showNotification("Select a layer to split");
          return;
      }

      setIsProcessing(true);
      showNotification("Analyzing image structure...");

      const originalLayer = layers.find(l => l.id === selectedLayerId);
      if (!originalLayer) { setIsProcessing(false); return; }

      try {
          // Use stroke width relative to image size for consistent feeling
          const effectiveStroke = type === 'brush' ? data.strokeWidth : 20;

          const { newLayerSrc, maskForOriginal } = await processSmartCutout(
              originalLayer, 
              type === 'brush' ? data.points : [data],
              effectiveStroke
          );

          // 1. New Layer (The Object)
          const newLayer: Layer = {
              ...originalLayer,
              id: `layer-${Date.now()}-part`,
              name: `${originalLayer.name} (Extracted)`,
              src: newLayerSrc,
              zIndex: layers.length + 1,
              maskData: undefined,
              eraseMaskImage: undefined, // Fresh layer
              visible: true
          };

          // 2. Update Old Layer (The Hole)
          const updatedOriginal: Layer = {
              ...originalLayer,
              eraseMaskImage: maskForOriginal,
              name: `${originalLayer.name} (Base)`
          };

          setLayers(prev => {
              const others = prev.filter(l => l.id !== originalLayer.id);
              return [...others, updatedOriginal, newLayer];
          });

          setSelectedLayerId(newLayer.id);
          showNotification("Extraction complete!");
          setToolMode(ToolMode.SELECT);

      } catch (e) {
          console.error(e);
          showNotification("Failed to extract layer");
      } finally {
          setIsProcessing(false);
      }
  };

  const handleExportAll = async () => {
      setIsProcessing(true);
      showNotification("Preparing layers for export...");
      
      for (const layer of layers) {
          if (!layer.visible) continue;
          
          const link = document.createElement('a');
          link.href = layer.src;
          
          if (layer.eraseMaskImage) {
               const baked = await bakeLayerWithMask(layer);
               link.href = baked;
          }

          link.download = `${layer.name || 'layer'}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          await new Promise(r => setTimeout(r, 200)); 
      }
      
      setIsProcessing(false);
      showNotification("Export complete!");
  };

  // Helper to bake the visual mask into the exported PNG
  const bakeLayerWithMask = (layer: Layer): Promise<string> => {
      return new Promise((resolve) => {
          const cvs = document.createElement('canvas');
          cvs.width = layer.width;
          cvs.height = layer.height;
          const ctx = cvs.getContext('2d');
          
          const img = new Image();
          img.crossOrigin = "Anonymous";
          img.src = layer.src;
          img.onload = () => {
              if(!ctx) return resolve(layer.src);
              
              const mask = new Image();
              mask.crossOrigin = "Anonymous";
              mask.src = layer.eraseMaskImage!;
              mask.onload = () => {
                  // 1. Draw Mask
                  ctx.drawImage(mask, 0, 0, layer.width, layer.height);
                  
                  // 2. Composite Source
                  const maskData = ctx.getImageData(0,0,cvs.width,cvs.height);
                  ctx.clearRect(0,0,cvs.width,cvs.height);
                  ctx.drawImage(img, 0, 0, layer.width, layer.height);
                  const imgData = ctx.getImageData(0,0,cvs.width,cvs.height);
                  
                  for(let i=0; i<imgData.data.length; i+=4) {
                      // maskData pixel: White(255)=Show, Black(0)=Hide
                      const maskVal = maskData.data[i]; 
                      // Multiply alpha
                      imgData.data[i+3] = Math.floor(imgData.data[i+3] * (maskVal/255));
                  }
                  
                  ctx.putImageData(imgData, 0, 0);
                  resolve(cvs.toDataURL('image/png'));
              };
          };
      });
  };

  const handleLayerAction = (action: string, layerId: string) => {
      if (action === 'delete') {
          setLayers(prev => prev.filter(l => l.id !== layerId));
          setSelectedLayerId(null);
      } else if (action === 'cutout') {
          setToolMode(ToolMode.CUTOUT_BRUSH);
          showNotification("Brush over the object to extract");
      }
  };

  return (
    <div className="flex w-full h-screen bg-[#0a0a0a] text-white overflow-hidden">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        className="hidden" 
      />

      <div className="flex-1 flex flex-col relative h-full overflow-hidden">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 h-20 flex justify-between items-start px-6 py-5 z-30 pointer-events-none">
            <div className="pointer-events-auto flex items-center gap-4">
                 {/* Logo: Using a Custom SVG to match APC Design since local upload is not available */}
                 <div className="w-10 h-10 flex items-center justify-center">
                    <svg width="100%" height="100%" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-lg">
                        <rect width="40" height="40" rx="8" fill="#000000"/>
                        <path d="M12 12V28" stroke="#10B981" strokeWidth="4" strokeLinecap="round"/>
                        <path d="M28 12V28" stroke="#10B981" strokeWidth="4" strokeLinecap="round"/>
                        <path d="M12 20L20 28L28 20" stroke="#10B981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                        <circle cx="20" cy="14" r="3" fill="#10B981"/>
                    </svg>
                </div>
                <div className="flex flex-col">
                    <span className="font-bold text-xl tracking-tight text-white leading-none font-[Inter]">APCdesignLab</span>
                    <span className="text-[10px] text-emerald-500 font-mono tracking-widest uppercase mt-1">Advanced Processing Canvas</span>
                </div>
            </div>
            
            <div className="flex items-center gap-4 pointer-events-auto mt-1">
                <button 
                    onClick={handleExportAll}
                    disabled={isProcessing}
                    className="flex items-center gap-2 bg-[#1e1e1e] hover:bg-[#2a2a2a] border border-white/10 text-gray-200 px-4 py-2 rounded-lg font-medium text-xs transition-all"
                >
                    <Icons.Download size={14} /> Export
                </button>
                <div className="w-8 h-8 rounded-full bg-gray-700 border border-gray-500 overflow-hidden">
                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="User" />
                </div>
            </div>
        </div>

        <Canvas 
            layers={layers}
            selectedLayerId={selectedLayerId}
            onSelectLayer={setSelectedLayerId}
            onUpdateLayer={updateLayer}
            toolMode={toolMode}
            onLayerAction={handleLayerAction}
            onCutout={handleCutout}
        />

        <BottomBar 
            toolMode={toolMode} 
            setToolMode={setToolMode}
            onUndo={() => {}}
            onRedo={() => {}}
            onAddImage={handleUploadClick}
        />

        {notification && (
            <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-[#1e1e1e] border border-emerald-500/30 text-emerald-200 px-6 py-3 rounded-lg shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 z-50">
                <Icons.Sparkles className="text-emerald-500 animate-pulse" size={16} />
                <span className="text-sm font-medium">{notification}</span>
            </div>
        )}

        {isProcessing && (
            <div className="absolute inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center">
                <div className="bg-[#1e1e1e] border border-white/10 p-8 rounded-2xl flex flex-col items-center gap-4 shadow-2xl">
                    <div className="relative">
                        <div className="absolute inset-0 bg-emerald-500 blur-xl opacity-20 animate-pulse"></div>
                        <Icons.Wand className="text-emerald-500 animate-spin relative z-10" size={32} />
                    </div>
                    <span className="text-sm text-gray-300 font-medium tracking-wide">Refining Edges...</span>
                </div>
            </div>
        )}
      </div>

      <LayerPanel 
        layers={layers}
        selectedLayerId={selectedLayerId}
        onSelectLayer={setSelectedLayerId}
        onDeleteLayer={(id) => {
             setLayers(prev => prev.filter(l => l.id !== id));
             if (selectedLayerId === id) setSelectedLayerId(null);
        }}
        onToggleVisibility={(id) => {
            setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
        }}
      />
    </div>
  );
};

export default App;