import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

export type DeviceMode = 'pc' | 'mobile';
export type DevicePreference = 'auto' | 'pc' | 'mobile';

interface DeviceModeContextType {
  /** The actively applied design mode: 'pc' (mouse & keyboard) or 'mobile' (touchscreen) */
  deviceMode: DeviceMode;
  /** True when the active layout is optimized for PC (mouse, keyboard, wide viewports) */
  isPC: boolean;
  /** True when the active layout is optimized for Touch (mobile, tablet, fingers, bottom nav) */
  isTouch: boolean;
  /** User preference setting: 'auto' | 'pc' | 'mobile' */
  preference: DevicePreference;
  /** Set user preference to auto, forced pc, or forced mobile */
  setPreference: (pref: DevicePreference) => void;
  /** Quick toggle through modes: auto -> pc -> mobile -> auto */
  cycleDeviceMode: () => void;
  /** Raw detected hardware capability: 'pc' or 'mobile' */
  detectedHardware: DeviceMode;
}

const DeviceModeContext = createContext<DeviceModeContextType | undefined>(undefined);

function detectSystemHardware(): DeviceMode {
  if (typeof window === 'undefined') return 'pc';
  
  // 1. Pointer type (Mouse vs Touch)
  const hasFinePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  const hasCoarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const canHover = window.matchMedia && window.matchMedia('(hover: hover)').matches;
  
  // 2. Screen dimensions
  const isLargeScreen = window.innerWidth >= 1024;
  
  // 3. Touch capabilities
  const maxTouchPoints = navigator.maxTouchPoints || 0;
  
  // 4. User Agent heuristics
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // If fine pointer (mouse) and can hover on wide screen -> definitely PC
  if (isLargeScreen && hasFinePointer && canHover && !isMobileUA) {
    return 'pc';
  }

  // If coarse pointer, phone/tablet user-agent, or small screen width -> Mobile / Touchscreen
  if (!isLargeScreen || isMobileUA || (hasCoarsePointer && !hasFinePointer) || (maxTouchPoints > 0 && !isLargeScreen)) {
    return 'mobile';
  }

  // Default to PC if screen is large and has mouse pointer
  return isLargeScreen ? 'pc' : 'mobile';
}

export const DeviceModeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [preference, setPreferenceState] = useState<DevicePreference>(() => {
    try {
      const saved = localStorage.getItem('pos_device_mode_preference');
      if (saved === 'pc' || saved === 'mobile' || saved === 'auto') return saved;
    } catch (e) {}
    return 'auto';
  });

  const [detectedHardware, setDetectedHardware] = useState<DeviceMode>(() => detectSystemHardware());

  // Listen to viewport resizing and pointer media queries
  useEffect(() => {
    const handleUpdate = () => {
      setDetectedHardware(detectSystemHardware());
    };

    window.addEventListener('resize', handleUpdate);
    window.addEventListener('orientationchange', handleUpdate);

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('orientationchange', handleUpdate);
    };
  }, []);

  // Compute active mode based on preference or hardware detection
  const activeMode: DeviceMode = preference === 'auto' ? detectedHardware : preference;
  const isPC = activeMode === 'pc';
  const isTouch = activeMode === 'mobile';

  const setPreference = useCallback((pref: DevicePreference) => {
    setPreferenceState(pref);
    try {
      localStorage.setItem('pos_device_mode_preference', pref);
    } catch (e) {}
  }, []);

  const cycleDeviceMode = useCallback(() => {
    setPreferenceState((prev) => {
      let next: DevicePreference;
      if (prev === 'auto') next = 'pc';
      else if (prev === 'pc') next = 'mobile';
      else next = 'auto';

      try {
        localStorage.setItem('pos_device_mode_preference', next);
      } catch (e) {}
      return next;
    });
  }, []);

  // Sync classes to body element for global styling adaptations
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      const body = document.body;
      
      root.classList.remove('mode-pc', 'mode-touch');
      body.classList.remove('is-pc-mode', 'is-touch-mode');

      if (isPC) {
        root.classList.add('mode-pc');
        body.classList.add('is-pc-mode');
      } else {
        root.classList.add('mode-touch');
        body.classList.add('is-touch-mode');
      }
    }
  }, [isPC]);

  return (
    <DeviceModeContext.Provider value={{
      deviceMode: activeMode,
      isPC,
      isTouch,
      preference,
      setPreference,
      cycleDeviceMode,
      detectedHardware
    }}>
      {children}
    </DeviceModeContext.Provider>
  );
};

export const useDeviceMode = (): DeviceModeContextType => {
  const context = useContext(DeviceModeContext);
  if (!context) {
    const isWide = typeof window !== 'undefined' && window.innerWidth >= 1024;
    return {
      deviceMode: isWide ? 'pc' : 'mobile',
      isPC: isWide,
      isTouch: !isWide,
      preference: 'auto',
      setPreference: () => {},
      cycleDeviceMode: () => {},
      detectedHardware: isWide ? 'pc' : 'mobile'
    };
  }
  return context;
};
