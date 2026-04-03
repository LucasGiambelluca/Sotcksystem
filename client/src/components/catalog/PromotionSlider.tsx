
import React from 'react';
import type { CatalogPromotion } from '../../types';

interface PromotionSliderProps {
  promotions: CatalogPromotion[];
  onOrder: (productId: string) => void;
}

export const PromotionSlider: React.FC<PromotionSliderProps> = ({ promotions, onOrder }) => {
  if (!promotions || promotions.length === 0) return null;

  return (
    <div className="promo-section mb-8">
      {/* Desktop Grid / Mobile Carousel Container */}
      <div className="flex overflow-x-auto md:grid md:grid-cols-3 gap-4 pb-4 md:pb-0 scroll-snap-x snap-mandatory hide-scrollbar">
        {promotions.map((promo) => (
          <div 
            key={promo.id}
            className="min-w-[85vw] md:min-w-0 bg-white rounded-2xl shadow-lg overflow-hidden flex flex-col snap-center transition-transform hover:scale-[1.02] border border-gray-100"
          >
            {/* Image Wrap */}
            <div className="relative h-48 md:h-40 overflow-hidden">
              <img 
                src={promo.image_url} 
                alt={promo.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                <h3 className="text-white font-bold text-lg leading-tight">{promo.title}</h3>
              </div>
            </div>

            {/* Content Wrap */}
            <div className="p-4 flex flex-col flex-grow">
              <p className="text-gray-600 text-sm line-clamp-2 mb-4 flex-grow">
                {promo.description}
              </p>
              
              <button
                onClick={() => promo.target_id && onOrder(promo.target_id)}
                className="w-full bg-emerald-50 text-emerald-700 font-black py-4 rounded-2xl transition-all border border-emerald-100 hover:bg-emerald-100 active:scale-95 flex items-center justify-center gap-2 group/btn"
              >
                <span>{promo.button_text || 'Pedir Ahora'}</span>
                <svg className="w-4 h-4 transform group-hover/btn:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scroll-snap-x {
          scroll-snap-type: x mandatory;
        }
        .snap-center {
          scroll-snap-align: center;
        }
      `}</style>
    </div>
  );
};
