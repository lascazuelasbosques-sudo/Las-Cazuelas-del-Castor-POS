import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
const LOGO_URL = "/logo_las_cazuelas_del_castor.jpg";

export interface BrandingSettings {
  logoUrl: string;
  appName: string;
}

const DEFAULT_BRANDING: BrandingSettings = {
  logoUrl: LOGO_URL,
  appName: "Las Cazuelas del Castor"
};

const CACHE_KEY = "cazuelas_branding_cache";

export const useBranding = () => {
  const [branding, setBranding] = useState<BrandingSettings>(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.warn("Error reading branding cache", e);
    }
    return DEFAULT_BRANDING;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "branding"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const logoUrlValue = data.logoUrl || '';
        const isValidLogo = logoUrlValue.startsWith('data:image/') || logoUrlValue.includes('logo_las_cazuelas_del_castor');
        const updated = {
          logoUrl: isValidLogo ? logoUrlValue : LOGO_URL,
          appName: data.appName || DEFAULT_BRANDING.appName
        };
        setBranding(updated);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(updated));
        } catch (e) {
          console.warn("Error saving branding cache", e);
        }
      }
      setLoading(false);
    }, (error: any) => {
        if (error?.message && (error.message.includes("Quota") || error.message.includes("resource-exhausted") || error.message.includes("unavailable"))) {
          console.warn("Firestore quota/offline reached for branding. Using local cache.");
        } else {
          console.error("Error fetching branding:", error);
        }
        setLoading(false);
    });

    return () => unsub();
  }, []);

  return { branding, loading };
};
