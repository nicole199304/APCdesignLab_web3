import React from 'react';
import { Icons } from './Icons';
import { ToolMode } from '../types';

interface BottomBarProps {
  toolMode: ToolMode;
  setToolMode: (mode: ToolMode) => void;
  onUndo: () => void;
  onRedo: () => void;
  onAddImage: () => void;
}

export const BottomBar: React.FC<BottomBarProps> = ({ 
  toolMode, 
  setToolMode,
  onUndo,
  onRedo,
  onAddImage
}) => {
  const tools = [
    { mode: ToolMode.SELECT, icon: Icons.Select, label: 'Select (V)' },
    { mode: ToolMode.HAND, icon: Icons.Hand, label: 'Pan (H)' },
    { mode: ToolMode.CROP, icon: Icons.Crop, label: 'Crop (C)' },
  ];

  const cutoutModes = [
      { mode: ToolMode.CUTOUT_CLICK, icon: Icons.Click, label: 'Click Select' },
      { mode: ToolMode.CUTOUT_BRUSH, icon: Icons.Brush, label: 'Smudge' },
  ];

  const isCutoutActive = toolMode === ToolMode.CUTOUT_CLICK || toolMode === ToolMode.CUTOUT_BRUSH;

  return (
    <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-row items-start gap-4 z-40">
        
        {/* Main Vertical Toolbar */}
        <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl shadow-2xl p-2 flex flex-col items-center gap-2 backdrop-blur-sm">
            
            {/* Standard Tools */}
            <div className="flex flex-col gap-1 pb-2 border-b border-white/10 w-full">
                {tools.map(tool => (
                    <button
                        key={tool.mode}
                        onClick={() => setToolMode(tool.mode)}
                        className={`p-3 rounded-xl transition-all relative group ${
                            toolMode === tool.mode 
                            ? 'bg-purple-600 text-white shadow-lg' 
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <tool.icon size={20} />
                        
                        {/* Tooltip */}
                        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2 py-1 bg-black/80 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">
                            {tool.label}
                        </div>
                    </button>
                ))}
            </div>

            {/* AI Tools */}
            <div className="flex flex-col gap-1 pb-2 border-b border-white/10 w-full">
                 <button
                    onClick={() => setToolMode(ToolMode.CUTOUT_CLICK)}
                    className={`p-3 rounded-xl transition-all relative group ${
                        isCutoutActive
                        ? 'bg-gradient-to-br from-purple-600 to-blue-600 text-white shadow-lg' 
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                    <Icons.Wand size={20} />
                     <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2 py-1 bg-black/80 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">
                            Smart Cutout (AI)
                    </div>
                </button>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-1 w-full pt-1">
                <button onClick={onAddImage} className="p-3 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl group relative">
                    <Icons.Plus size={20} />
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2 py-1 bg-black/80 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">
                        Add Image
                    </div>
                </button>
                <button onClick={onUndo} className="p-3 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl group relative">
                    <Icons.Undo size={20} />
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2 py-1 bg-black/80 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">
                        Undo
                    </div>
                </button>
                <button onClick={onRedo} className="p-3 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl group relative">
                    <Icons.Redo size={20} />
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2 py-1 bg-black/80 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">
                        Redo
                    </div>
                </button>
            </div>
        </div>

        {/* AI Sub-menu (Pops out to the right) */}
        {isCutoutActive && (
            <div className="bg-[#1e1e1e] border border-white/10 rounded-xl shadow-xl p-2 flex flex-col items-start gap-1 backdrop-blur-md animate-in slide-in-from-left-2 self-center">
                <span className="text-[10px] uppercase font-bold text-purple-400 px-2 py-1 tracking-wider">AI Extract</span>
                <div className="w-full h-[1px] bg-white/10 my-0.5"></div>
                {cutoutModes.map(tool => (
                    <button
                        key={tool.mode}
                        onClick={() => setToolMode(tool.mode)}
                        className={`w-full px-3 py-2 rounded-lg transition-all flex items-center gap-3 text-xs font-medium ${
                            toolMode === tool.mode 
                            ? 'bg-purple-600 text-white shadow-lg' 
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <tool.icon size={14} />
                        {tool.label}
                    </button>
                ))}
            </div>
        )}
    </div>
  );
};