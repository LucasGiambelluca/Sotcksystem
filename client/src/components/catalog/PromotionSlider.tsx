import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CatalogPromotion } from '../../types';

interface PromotionSliderProps {
  promotions: CatalogPromotion[];
  onOrder: (productId: string) => void;
  accentColor?: string;
  /** Auto-slide interval in ms (default: 5000) */
  interval?: number;
}

export const PromotionSlider: React.FC<PromotionSliderProps> = ({
  promotions,
  onOrder,
  accentColor = '#e53935',
  interval = 5000,
}) => {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const total = promotions.length;

  const goTo = useCallback((idx: number) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrent(((idx % total) + total) % total);
    setTimeout(() => setIsTransitioning(false), 500);
  }, [total, isTransitioning]);

  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1), [current, goTo]);

  // Auto-slide
  useEffect(() => {
    if (total <= 1 || isPaused) return;
    timerRef.current = setInterval(next, interval);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [next, total, isPaused, interval]);

  // Touch swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setIsPaused(true);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      diff > 0 ? next() : prev();
    }
    setIsPaused(false);
  };

  if (!promotions || total === 0) return null;

  return (
    <div
      className="promo-slider relative w-full overflow-hidden rounded-2xl shadow-lg group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Slides container */}
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {promotions.map((promo) => (
          <div
            key={promo.id}
            className="w-full flex-shrink-0 relative"
            style={{ minWidth: '100%' }}
          >
            {/* Banner image */}
            <div className="relative aspect-[21/9] md:aspect-[3/1] w-full overflow-hidden">
              {promo.image_url ? (
                <img
                  src={promo.image_url}
                  alt={promo.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${accentColor}DD 0%, ${accentColor}88 50%, ${accentColor}DD 100%)`,
                  }}
                >
                  <span className="text-white/40 text-6xl font-black">⚽</span>
                </div>
              )}

              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />

              {/* Content overlay */}
              <div className="absolute inset-0 flex items-center px-6 md:px-10">
                <div className="max-w-md">
                  <h3 className="text-white font-black text-lg md:text-2xl leading-tight drop-shadow-lg mb-1 md:mb-2">
                    {promo.title}
                  </h3>
                  {promo.description && (
                    <p className="text-white/80 text-xs md:text-sm line-clamp-2 mb-3 md:mb-4 drop-shadow">
                      {promo.description}
                    </p>
                  )}
                  {promo.target_id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOrder(promo.target_id!);
                      }}
                      className="px-5 py-2 md:px-6 md:py-2.5 rounded-full text-xs md:text-sm font-bold shadow-lg
                                 transition-all duration-200 hover:scale-105 active:scale-95
                                 text-white border border-white/20"
                      style={{ backgroundColor: accentColor }}
                    >
                      {promo.button_text || 'Pedir ahora'} →
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation arrows - only on desktop, only when >1 slide */}
      {total > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 rounded-full
                       bg-white/20 backdrop-blur-sm text-white flex items-center justify-center
                       opacity-0 group-hover:opacity-100 transition-all duration-300
                       hover:bg-white/40 active:scale-90"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 rounded-full
                       bg-white/20 backdrop-blur-sm text-white flex items-center justify-center
                       opacity-0 group-hover:opacity-100 transition-all duration-300
                       hover:bg-white/40 active:scale-90"
          >
            <ChevronRight size={18} />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {total > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {promotions.map((_, idx) => (
            <button
              key={idx}
              onClick={() => goTo(idx)}
              className="transition-all duration-300"
              style={{
                width: idx === current ? 20 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: idx === current ? '#fff' : 'rgba(255,255,255,0.4)',
              }}
            />
          ))}
        </div>
      )}

      {/* Progress bar */}
      {total > 1 && !isPaused && (
        <div className="absolute bottom-0 left-0 w-full h-[3px] bg-white/10">
          <div
            className="h-full rounded-r-full"
            style={{
              backgroundColor: accentColor,
              animation: `promoProgress ${interval}ms linear infinite`,
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes promoProgress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
};
