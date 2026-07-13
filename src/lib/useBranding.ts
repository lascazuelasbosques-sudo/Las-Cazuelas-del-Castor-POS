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

export const useBranding = () => {
  const [branding, setBranding] = useState<BrandingSettings>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "branding"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const logoUrlValue = data.logoUrl || '';
        const isValidLogo = logoUrlValue.startsWith('data:image/') || logoUrlValue.includes('logo_las_cazuelas_del_castor');
        setBranding({
          logoUrl: isValidLogo ? logoUrlValue : LOGO_URL,
          appName: data.appName || DEFAULT_BRANDING.appName
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
