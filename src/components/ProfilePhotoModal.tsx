import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, 
  Camera, 
  HardDrive, 
  Cloud, 
  Move, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Check, 
  Trash2, 
  Sparkles,
  Link as LinkIcon,
  Globe,
  AlertCircle
} from 'lucide-react';
import { shrinkAvatarDataUrl } from '../lib/avatar';

interface ProfilePhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAvatarUrl?: string;
  userName?: string;
  onSaveAvatar: (avatarUrl: string) => void;
  onRemoveAvatar: () => void;
}

export const ProfilePhotoModal: React.FC<ProfilePhotoModalProps> = ({
  isOpen,
  onClose,
  currentAvatarUrl,
  userName = 'ALU Scholar',
  onSaveAvatar,
  onRemoveAvatar,
}) => {
  // Mode: 'choose_source' | 'crop_reposition'
  const [mode, setMode] = useState<'choose_source' | 'crop_reposition'>('choose_source');
  
  // Selected Image state for cropping
  const [selectedImgSrc, setSelectedImgSrc] = useState<string>('');

  // Positioning & Zoom Controls
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1.0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Reset modal state when opening
  useEffect(() => {
    if (isOpen) {
      if (currentAvatarUrl) {
        setSelectedImgSrc(currentAvatarUrl);
      } else {
        setSelectedImgSrc('');
      }
      setMode('choose_source');
      setPan({ x: 0, y: 0 });
      setZoom(1.0);
      setShowConfirmDelete(false);
      setSourceError(null);
    }
  }, [isOpen, currentAvatarUrl]);

  // Handle local storage file pick. The photo is decoded first so an
  // unsupported phone format (e.g. HEIC) is reported instead of silently
  // failing later and leaving the old picture in place.
  const handleLocalFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setSourceError('That file is not a picture. Choose a photo from your phone or computer.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (!result) {
        setSourceError('The picture could not be read. Try a different photo.');
        return;
      }
      const probe = new Image();
      probe.onload = () => {
        setSourceError(null);
        setSelectedImgSrc(result);
        setPan({ x: 0, y: 0 });
        setZoom(1.0);
        setMode('crop_reposition');
      };
      probe.onerror = () => {
        setSourceError('This photo format cannot be opened on this device. Choose a JPG or PNG picture.');
      };
      probe.src = result;
    };
    reader.onerror = () => {
      setSourceError('The picture could not be read. Try a different photo.');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Mouse & Touch Dragging handlers for positioning in the center
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPan({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Center button helper
  const handleCenterImage = () => {
    setPan({ x: 0, y: 0 });
    setZoom(1.0);
  };

  // Crop and save output using HTML5 Canvas
  const handleSaveCropped = () => {
    if (!selectedImgSrc) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const targetSize = 224;
      const canvas = document.createElement('canvas');
      canvas.width = targetSize;
      canvas.height = targetSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw background
      ctx.fillStyle = '#0f4c3a';
      ctx.fillRect(0, 0, targetSize, targetSize);

      // Save context for clipping circular crop
      ctx.save();
      ctx.beginPath();
      ctx.arc(targetSize / 2, targetSize / 2, targetSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      // Calculate source image drawing dimensions
      const viewportSize = 240; // Size of the interactive crop box in UI
      const scaleFactor = targetSize / viewportSize;

      // Base aspect ratio calculation to "cover" the viewport
      const imgAspect = img.width / img.height;
      let drawW: number;
      let drawH: number;

      if (imgAspect >= 1) {
        drawH = viewportSize * zoom;
        drawW = drawH * imgAspect;
      } else {
        drawW = viewportSize * zoom;
        drawH = drawW / imgAspect;
      }

      // Compute top-left drawing coordinates based on centered offset + user pan
      const baseLeft = (viewportSize - drawW) / 2 + pan.x;
      const baseTop = (viewportSize - drawH) / 2 + pan.y;

      // Draw scaled and panned image to canvas
      ctx.drawImage(
        img,
        baseLeft * scaleFactor,
        baseTop * scaleFactor,
        drawW * scaleFactor,
        drawH * scaleFactor
      );

      ctx.restore();

      try {
        const finalDataUrl = canvas.toDataURL('image/jpeg', 0.82);
        // Never hand an oversized picture to the profile save: shrink it here
        // so it always fits the account document.
        shrinkAvatarDataUrl(finalDataUrl, 110000).then((prepared) => {
          if (!prepared) {
            setSourceError('This picture could not be processed. Choose a different photo.');
            return;
          }
          onSaveAvatar(prepared);
          onClose();
        });
      } catch (err) {
        console.warn('Canvas export failed:', err);
        setSourceError('This picture could not be processed on this device. Choose a JPG or PNG photo.');
      }
    };

    img.onerror = () => {
      setSourceError('This photo format cannot be opened on this device. Choose a JPG or PNG picture.');
    };

    img.src = selectedImgSrc;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-lg bg-white dark:bg-[#121620] border border-[#e5e9e7] dark:border-[#222a3a] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] modal-enter"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-[#1e2638] flex items-center justify-between shrink-0 bg-gray-50/60 dark:bg-[#151a24]/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#e8f5f0] dark:bg-emerald-950/60 text-[#0f4c3a] dark:text-emerald-400 flex items-center justify-center shadow-xs">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                {mode === 'choose_source' ? 'Profile Picture Source' : 'Center & Adjust Picture'}
              </h2>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                {mode === 'choose_source' 
                  ? 'Upload your own photo' 
                  : 'Drag to center your face and zoom to fit'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white dark:bg-[#1a2130] text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border border-gray-200 dark:border-[#263248] flex items-center justify-center shadow-xs transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          
          {/* ================= STEP 1: CHOOSE SOURCE ================= */}
          {mode === 'choose_source' && (
            <div className="space-y-4">
              
              {/* Current Picture Status (If exists) */}
              {currentAvatarUrl && (
                <div className="space-y-2.5">
                  <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-[#171d29] border border-gray-200 dark:border-[#222a3a] flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img 
                        src={currentAvatarUrl} 
                        alt="Current Avatar" 
                        className="w-12 h-12 rounded-full object-cover ring-2 ring-[#0f4c3a]/40 shadow-xs shrink-0" 
                      />
                      <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white">Current Profile Picture</p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">Active across your student records</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedImgSrc(currentAvatarUrl);
                          setMode('crop_reposition');
                        }}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[#0f4c3a] dark:text-emerald-400 bg-white dark:bg-[#121620] border border-gray-200 dark:border-[#263248] hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        Re-center
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowConfirmDelete(true)}
                        className="p-1.5 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="Remove profile picture"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Inline Delete Confirmation Notice */}
                  {showConfirmDelete && (
                    <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex flex-col gap-2.5 modal-enter">
                      <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-bold text-xs">
                        <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Are you sure you want to remove your profile picture?</span>
                      </div>
                      <p className="text-[11px] text-rose-600 dark:text-rose-400">
                        Your avatar will revert to showing your initials until you upload or center a new photo.
                      </p>
                      <div className="flex items-center gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setShowConfirmDelete(false);
                            onRemoveAvatar();
                            onClose();
                          }}
                          className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-full shadow-xs cursor-pointer"
                        >
                          Yes, Remove Picture
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowConfirmDelete(false)}
                          className="px-3.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-[#121620] hover:bg-gray-50 border border-gray-200 dark:border-gray-700 rounded-full cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Upload from device — the only way to set a photo */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full p-6 rounded-2xl border-2 border-dashed border-[#0f4c3a]/30 dark:border-emerald-500/30 hover:border-[#0f4c3a] dark:hover:border-emerald-400 bg-[#e8f5f0]/30 dark:bg-[#0f4c3a]/10 hover:bg-[#e8f5f0]/60 dark:hover:bg-[#0f4c3a]/20 transition-all flex flex-col items-center justify-center gap-2.5 text-center cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-2xl bg-[#0f4c3a] text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Upload Your Photo</h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                    Pick a picture from your phone or laptop. Until you do, your profile shows your first initial.
                  </p>
                </div>
                <span className="text-[10px] font-semibold text-[#0f4c3a] dark:text-emerald-400 bg-white dark:bg-[#121620] px-2.5 py-1 rounded-full border border-[#0f4c3a]/20">
                  Browse Local File
                </span>
              </button>

              {sourceError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-[11px] font-medium flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{sourceError}</span>
                </div>
              )}

              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLocalFile}
                className="hidden"
              />
            </div>
          )}

          {/* ================= STEP 2: CROP & REPOSITION IN THE MIDDLE ================= */}
          {mode === 'crop_reposition' && (
            <div className="space-y-4">
              {sourceError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-[11px] font-medium flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{sourceError}</span>
                </div>
              )}
              
              {/* Interactive Viewport instructions */}
              <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                <span className="font-semibold flex items-center gap-1.5 text-[#0f4c3a] dark:text-emerald-400">
                  <Move className="w-3.5 h-3.5" />
                  <span>Click / Touch &amp; Drag picture to center</span>
                </span>
                <button
                  type="button"
                  onClick={handleCenterImage}
                  className="text-[11px] font-semibold text-gray-500 hover:text-gray-800 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Center</span>
                </button>
              </div>

              {/* Crop Canvas Interactive Container */}
              <div className="relative flex items-center justify-center py-2">
                
                {/* 240px circular mask viewport */}
                <div 
                  className="w-60 h-60 rounded-full border-4 border-[#0f4c3a] dark:border-emerald-400 shadow-xl overflow-hidden relative cursor-grab active:cursor-grabbing select-none bg-black/90 touch-none"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                >
                  {/* The Image being panned and zoomed */}
                  <img
                    ref={imageRef}
                    src={selectedImgSrc}
                    alt="Center Preview"
                    draggable={false}
                    className="max-w-none pointer-events-none absolute select-none transition-transform duration-75 ease-out"
                    style={{
                      transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                      transformOrigin: 'center center',
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />

                  {/* Circular Crosshair / Target Overlay to assist perfect centering */}
                  <div className="absolute inset-0 pointer-events-none border border-white/20 rounded-full flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full border border-white/50 bg-white/20" />
                    <div className="absolute inset-x-0 h-px bg-white/15" />
                    <div className="absolute inset-y-0 w-px bg-white/15" />
                  </div>
                </div>

                {/* Live Companion Mini Preview */}
                <div className="hidden sm:flex flex-col items-center gap-1 absolute right-2 bottom-2 bg-white/90 dark:bg-[#121620]/90 backdrop-blur-sm p-2 rounded-2xl border border-gray-200 dark:border-[#222a3a] shadow-md">
                  <span className="text-[9px] font-bold text-gray-500 uppercase">Navbar Icon</span>
                  <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-[#0f4c3a] bg-black">
                    <img
                      src={selectedImgSrc}
                      alt="Mini Preview"
                      className="w-full h-full object-cover"
                      style={{
                        transform: `translate(${pan.x * 0.15}px, ${pan.y * 0.15}px) scale(${zoom})`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Zoom & Centering Controls */}
              <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-[#151a24] border border-gray-200 dark:border-[#222a3a] space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-700 dark:text-gray-300">
                  <span className="flex items-center gap-1.5">
                    <ZoomIn className="w-3.5 h-3.5" />
                    <span>Zoom Level:</span>
                  </span>
                  <span className="font-mono text-[11px]">{Math.round(zoom * 100)}%</span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setZoom((prev) => Math.max(0.8, prev - 0.15))}
                    className="p-1.5 rounded-lg bg-white dark:bg-[#10141d] border border-gray-200 dark:border-[#263248] text-gray-600 dark:text-gray-300 hover:bg-gray-100 cursor-pointer"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>

                  <input
                    type="range"
                    min="0.8"
                    max="3.0"
                    step="0.05"
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="flex-1 accent-[#0f4c3a] dark:accent-emerald-400 cursor-pointer"
                  />

                  <button
                    type="button"
                    onClick={() => setZoom((prev) => Math.min(3.0, prev + 0.15))}
                    className="p-1.5 rounded-lg bg-white dark:bg-[#10141d] border border-gray-200 dark:border-[#263248] text-gray-600 dark:text-gray-300 hover:bg-gray-100 cursor-pointer"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Source switch button */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setMode('choose_source')}
                  className="text-xs font-semibold text-gray-500 hover:text-gray-800 dark:hover:text-white transition-colors cursor-pointer"
                >
                  ← Pick a different picture
                </button>
                <button
                  type="button"
                  onClick={handleCenterImage}
                  className="text-xs font-semibold text-[#0f4c3a] dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  Set exactly in center
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-[#1e2638] flex items-center justify-between gap-3 shrink-0 bg-gray-50/60 dark:bg-[#151a24]/60">
          {mode === 'crop_reposition' ? (
            <>
              <button
                type="button"
                onClick={() => setMode('choose_source')}
                className="px-4 py-2 rounded-full text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1a2333] transition-colors cursor-pointer"
              >
                Back
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-full text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1a2333] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCropped}
                  className="btn-pine px-5 py-2 text-xs font-semibold text-white shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Save Centered Picture</span>
                </button>
              </div>
            </>
          ) : (
            <>
              {currentAvatarUrl ? (
                <button
                  type="button"
                  onClick={() => setShowConfirmDelete(true)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-full transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Picture</span>
                </button>
              ) : (
                <div />
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1a2333] transition-colors cursor-pointer"
              >
                Close
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
};
