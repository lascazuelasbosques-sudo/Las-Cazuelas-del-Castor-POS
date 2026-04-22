import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export interface BrandingSettings {
  logoUrl: string;
  appName: string;
}

const DEFAULT_BRANDING: BrandingSettings = {
  logoUrl: "https://lookaside.fbsbx.com/lookaside/crawler/media/?media_id=502697321857942",
  appName: "Las Cazuelas del Castor"
};

export const useBranding = () => {
  const [branding, setBranding] = useState<BrandingSettings>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "branding"), (docSnap) => {
      if (docSnap.exists()) {
        setBranding({
          logoUrl: docSnap.data().logoUrl || DEFAULT_BRANDING.logoUrl,
          appName: docSnap.data().appName || DEFAULT_BRANDING.appName
        });
      }
      setLoading(false);
    }, (error) => {
        console.error("Error fetching branding:", error);
        setLoading(false);
    });

    return () => unsub();
  }, []);

  return { branding, loading };
};
