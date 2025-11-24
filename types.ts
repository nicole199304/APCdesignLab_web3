export interface Layer {
  id: string;
  type: 'image' | 'mask';
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  name: string;
  visible?: boolean;
  maskData?: {
    points: {x: number, y: number}[];
    strokeWidth: number;
    isSoft?: boolean;
  };
  eraseMasks?: {
    points: {x: number, y: number}[];
    strokeWidth: number;
    isSoft?: boolean;
  }[];
  // Raster-based erase mask (white=show, black=hide)
  eraseMaskImage?: string;
}

export interface CanvasState {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export enum ToolMode {
  SELECT = 'SELECT',
  HAND = 'HAND',
  CROP = 'CROP',
  CUTOUT_CLICK = 'CUTOUT_CLICK',
  CUTOUT_BRUSH = 'CUTOUT_BRUSH'
}