import React, { useRef, useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Hand, ShieldAlert } from 'lucide-react';

interface AnnotatedScreenshotProps {
  image: string; // dataUrl or url
  box: [number, number, number, number] | null; // [x, y, w, h] in image space
  verdict: 'safe' | 'caution' | 'scam';
  naturalWidth?: number;
  naturalHeight?: number;
}

export const AnnotatedScreenshot: React.FC<AnnotatedScreenshotProps> = ({
  image,
  box,
  verdict,
  naturalWidth = 1000,
  naturalHeight = 1600,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0, scale: 1 });
  const [zoomScale, setZoomScale] = useState(1);
  const prefersReducedMotion = useReducedMotion();

  const handleImageLoad = () => {
    if (imgRef.current) {
      const clientW = imgRef.current.clientWidth;
      const clientH = imgRef.current.clientHeight;
      const natW = imgRef.current.naturalWidth || naturalWidth;
      const natH = imgRef.current.naturalHeight || naturalHeight;
      setDimensions({
        width: clientW,
        height: clientH,
        scale: clientW / natW,
      });
    }
  };

  useEffect(() => {
    window.addEventListener('resize', handleImageLoad);
    return () => window.removeEventListener('resize', handleImageLoad);
  }, []);

  // Compute scaled bounding box
  const hasBox = box && box.length === 4;
  const scale = dimensions.scale || 1;
  const rawX = hasBox ? box![0] : 0;
  const rawY = hasBox ? box![1] : 0;
  const rawW = hasBox ? box![2] : 0;
  const rawH = hasBox ? box![3] : 0;

  const bx = rawX * scale;
  const by = rawY * scale;
  const bw = Math.max(28, rawW * scale);
  const bh = Math.max(28, rawH * scale);

  // Circle is an ellipse 20% larger than the box
  const padX = bw * 0.2;
  const padY = bh * 0.2;
  const cx = bx + bw / 2;
  const cy = by + bh / 2;
  const rx = (bw / 2) + padX;
  const ry = (bh / 2) + padY;

  // Colorful strokes: Red for scam, Orange for caution, Green for safe
  const strokeColor =
    verdict === 'scam'
      ? '#DC2626'
      : verdict === 'caution'
      ? '#EA580C'
      : '#16A34A';

  const pointerBgClass =
    verdict === 'caution' ? 'bg-orange' : 'bg-green';

  const toggleZoom = () => {
    setZoomScale(prev => (prev === 1 ? 1.5 : 1));
  };

  return (
    <div
      ref={containerRef}
      onClick={toggleZoom}
      title="Tap to zoom"
      className="relative w-full rounded-3xl overflow-hidden border-2 border-line bg-cream shadow-soft transition-transform duration-300 cursor-zoom-in select-none"
      style={{
        transform: `scale(${zoomScale})`,
        transformOrigin: hasBox ? `${(cx / (dimensions.width || 1)) * 100}% ${(cy / (dimensions.height || 1)) * 100}%` : 'center',
      }}
    >
      <img
        ref={imgRef}
        src={image}
        alt="Screen to analyze"
        onLoad={handleImageLoad}
        className="w-full h-auto block rounded-3xl object-contain max-h-[65vh] mx-auto"
      />

      {/* SVG Overlay & Spotlight Mask */}
      {dimensions.width > 0 && dimensions.height > 0 && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        >
          <defs>
            {/* Spotlight mask: cut out the target button area */}
            {hasBox && verdict !== 'scam' && (
              <mask id="spotlight-mask">
                {/* Opaque white background exposes dimming */}
                <rect width="100%" height="100%" fill="white" />
                {/* Black cutout reveals the original unblurred image */}
                <ellipse cx={cx} cy={cy} rx={rx + 8} ry={ry + 8} fill="black" />
              </mask>
            )}
          </defs>

          {/* Dimmed spotlight layer for non-target areas */}
          {hasBox && verdict !== 'scam' && (
            <rect
              width="100%"
              height="100%"
              fill="rgba(253, 251, 247, 0.60)"
              mask="url(#spotlight-mask)"
            />
          )}

          {/* Scam Highlight: Soft red outline across suspicious area */}
          {verdict === 'scam' && hasBox && (
            <rect
              x={bx - 4}
              y={by - 4}
              width={bw + 8}
              height={bh + 8}
              rx={12}
              fill="rgba(220, 38, 38, 0.15)"
              stroke="#DC2626"
              strokeWidth="3.5"
              strokeDasharray="6 4"
            />
          )}

          {/* Safe / Caution: Single circled button */}
          {verdict !== 'scam' && hasBox && (
            <g>
              {/* Outer pulsing ring */}
              {!prefersReducedMotion && (
                <ellipse
                  cx={cx}
                  cy={cy}
                  rx={rx + 6}
                  ry={ry + 6}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="2.5"
                  className="animate-pulse-ring"
                />
              )}

              {/* Animated drawing circle */}
              <motion.ellipse
                cx={cx}
                cy={cy}
                rx={rx}
                ry={ry}
                fill="none"
                stroke={strokeColor}
                strokeWidth="4"
                strokeLinecap="round"
                initial={prefersReducedMotion ? { pathLength: 1 } : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </g>
          )}
        </svg>
      )}

      {/* Bobbing Hand Pointer below target button */}
      {verdict !== 'scam' && hasBox && dimensions.width > 0 && (
        <div
          className={`absolute pointer-events-none z-10 flex flex-col items-center ${
            prefersReducedMotion ? '' : 'animate-bob'
          }`}
          style={{
            left: `${cx}px`,
            top: `${cy + ry + 6}px`,
            transform: 'translateX(-50%)',
          }}
        >
          <div className={`${pointerBgClass} text-white p-1.5 rounded-full shadow-md`}>
            <Hand className="w-5 h-5 -rotate-90 fill-white" />
          </div>
          <span className={`mt-1 text-xs font-black ${pointerBgClass} text-white px-2.5 py-0.5 rounded-full shadow-sm tracking-wider uppercase`}>
            TAP HERE
          </span>
        </div>
      )}

      {/* Scam Warning Badge if scam detected */}
      {verdict === 'scam' && (
        <div className="absolute top-3 left-3 right-3 bg-red text-white px-4 py-3 rounded-2xl shadow-red flex items-center gap-2.5 font-black text-sm tracking-wide z-10 border-2 border-white/40">
          <ShieldAlert className="w-6 h-6 flex-shrink-0 animate-bounce" />
          <span>STOP. DO NOT TOUCH ANY BUTTON ON THIS SCREEN.</span>
        </div>
      )}
    </div>
  );
};
