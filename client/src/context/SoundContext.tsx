import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

interface SoundContextType {
    soundEnabled: boolean;
    enableSound: () => void;
    disableSound: () => void;
    playNotification: () => void;
}

const SoundContext = createContext<SoundContextType>({
    soundEnabled: false,
    enableSound: () => {},
    disableSound: () => {},
    playNotification: () => {}
});

export const useSound = () => useContext(SoundContext);

export const SoundProvider = ({ children }: { children: React.ReactNode }) => {
    // Only persist within the SPA session to comply with browser audio autoplay policies.
    // We cannot use localStorage because a hard reload requires a new user interaction.
    const [soundEnabled, setSoundEnabled] = useState(false);
    
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const lastSoundTime = useRef<number>(0);
    const SOUND_COOLDOWN_MS = 2000;

    useEffect(() => {
        // Initialize audio element
        audioRef.current = new Audio('/sounds/notification.mp3');
        audioRef.current.load();
    }, []);

    const enableSound = () => {
        setSoundEnabled(true);
        if (audioRef.current) {
            audioRef.current.volume = 1;
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(e => {
                console.error("Failed to play notification sound", e);
            });
        }
    };

    const disableSound = () => {
        setSoundEnabled(false);
    };

    const playNotification = () => {
        if (!soundEnabled || !audioRef.current) return;
        
        const now = Date.now();
        if (now - lastSoundTime.current < SOUND_COOLDOWN_MS) return;
        lastSoundTime.current = now;
        
        try {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(e => {
                console.error("Audio playback failed", e);
                // If playback fails, it's likely because the context was suspended
                // Forcing soundEnabled to false will prompt the user to enable it again
                setSoundEnabled(false);
            });
        } catch (e) {
            console.error("Audio playback error", e);
        }
    };

    return (
        <SoundContext.Provider value={{ soundEnabled, enableSound, disableSound, playNotification }}>
            {children}
        </SoundContext.Provider>
    );
};
