import React from 'react';
import { Icons } from './Icons';
import { Layer } from '../types';

interface FloatingMenuProps {
  layer: Layer;
  zoom: number;
  onAction: (action: string) => void;
}

const MenuButton = ({ icon: Icon, label, onClick, className = "" }: { icon: any, label: string, onClick: () => void, className?: string }) => (
  <button 
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className={`flex items-center gap-3 w-full p-2.5 hover:bg-white/10 transition-colors text-left text-xs font-medium text-gray-200 ${className}`}
  >
    <Icon size={14} className={className.includes('text-red') ? "text-red-400" : "text-gray-400"} />
    {label}
  </button>
);

export const FloatingMenu: React.FC<FloatingMenuProps> = ({ layer, zoom, onAction }) => {
  return (
    <div 
      className="absolute bg-[#1a1a1a]/95 backdrop-blur-md border border-white/10 rounded-lg shadow-2xl flex flex-col w-40 overflow-hidden z-50 animate-in fade-in zoom-in duration-200"
      style={{
        left: '100%',
        top: 0,
        marginLeft: '12px',
        transformOrigin: 'top left'
      }}
      onMouseDown={(e) => e.stopPropagation()} // Prevent canvas drag
    >
      <div className="px-3 py-2 border-b border-white/10 text-[10px] text-gray-500 uppercase tracking-wider font-bold">
        Tools
      </div>
      <MenuButton icon={Icons.Wand} label="Split Layer" onClick={() => onAction('cutout')} />
      <div className="h-[1px] bg-white/10 my-1" />
      <MenuButton icon={Icons.Crop} label="Crop" onClick={() => onAction('crop')} />
      <div className="h-[1px] bg-white/10 my-1" />
      <MenuButton 
        icon={Icons.Trash} 
        label="Delete" 
        onClick={() => onAction('delete')} 
        className="text-red-400 hover:bg-red-500/10"
      />
    </div>
  );
};
