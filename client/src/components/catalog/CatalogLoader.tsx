import { useEffect, useRef, useState } from 'react';
import { Store } from 'lucide-react';

export interface CatalogLoaderProps {
  logoUrl?: string | null;
  accentColor: string;
  businessName?: string;
  /** When false, skip the World Cup video and show the plain logo loader. */
  videoEnabled?: boolean;
  exiting: boolean;
}

/** Stop playback after this many seconds — we only show the opening of the clip. */
const CLIP_SECONDS = 5;
// Respect Vite's configured base path (the app is served under /<slug>/).
const VIDEO_SRC = `${import.meta.env.BASE_URL}videos/worldcup26.mp4`;

export function CatalogLoader({ logoUrl, accentColor, businessName, videoEnabled = true, exiting }: CatalogLoaderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoOk, setVideoOk] = useState(videoEnabled);

  useEffect(() => {
    if (!videoEnabled) return;
    const el = videoRef.current;
    if (!el) return;

    // Try to play WITH original audio. Browsers block autoplay-with-sound when
    // there was no prior user gesture (the common case for a catalog opened from
    // a link), so fall back to muted playback instead of failing silently.
    el.muted = false;
    el.play().catch(() => {
      el.muted = true;
      el.play().catch(() => setVideoOk(false));
    });

    // Only show the first CLIP_SECONDS of the clip, then freeze on the last frame.
    const onTime = () => {
      if (el.currentTime >= CLIP_SECONDS) {
        el.pause();
        el.removeEventListener('timeupdate', onTime);
      }
    };
    el.addEventListener('timeupdate', onTime);
    return () => el.removeEventListener('timeupdate', onTime);
  }, [videoEnabled]);

  return (
    <div
      className={`fixed inset-0 z-[100] overflow-hidden bg-black ${exiting ? 'animate-fade-out-screen' : ''}`}
    >
      {videoOk ? (
        <video
          ref={videoRef}
          src={VIDEO_SRC}
          autoPlay
          playsInline
          preload="auto"
          onError={() => setVideoOk(false)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        // Fallback: original logo + spinner loader if the video can't play.
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
          <div className="flex flex-col items-center gap-5">
            <div
              className="catalog-logo-shine animate-bounce-in-logo w-28 h-28 rounded-full border-4 border-white shadow-xl flex items-center justify-center bg-white"
              style={{ boxShadow: `0 10px 40px ${accentColor}33` }}
            >
              {logoUrl ? (
                <img src={logoUrl} alt={businessName || ''} className="w-full h-full object-cover" />
              ) : (
                <Store size={48} style={{ color: accentColor }} />
              )}
            </div>
            {businessName && <h1 className="text-lg font-bold text-gray-800">{businessName}</h1>}
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: accentColor }} />
              <p className="text-sm text-gray-500 font-medium">Cargando catálogo...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
