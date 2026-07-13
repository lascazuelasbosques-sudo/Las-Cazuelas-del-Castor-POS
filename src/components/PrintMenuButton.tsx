import React, { useRef, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { Button } from './Button';
import { Product, Category } from '../types';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import toast from 'react-hot-toast';

interface PrintMenuButtonProps {
  products: Product[];
  categories: Category[];
  branding: {
    logoUrl: string;
    appName: string;
  };
}

interface PageTemplateProps {
  productList: Product[];
  showHeader?: boolean;
  showFooter?: boolean;
  innerRef: React.RefObject<HTMLDivElement | null>;
  branding: {
    logoUrl: string;
    appName: string;
  };
}

const PageTemplate = ({ productList, showHeader, showFooter, innerRef, branding }: PageTemplateProps) => (
  <div 
    ref={innerRef}
    style={{ 
      width: '816px', 
      height: '1056px',
      backgroundColor: '#FDF5E6',
      padding: showHeader ? '5px 60px' : '10px 60px',
      fontFamily: "'Inter', sans-serif",
      position: 'fixed',
      left: '-10000px',
      top: '0',
      boxSizing: 'border-box',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      zIndex: -1,
      pointerEvents: 'none',
      opacity: 0,
      visibility: 'hidden'
    }}
  >
    {/* Header */}
    {showHeader && (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', position: 'relative', zIndex: 1, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <img 
            src={branding.logoUrl} 
            alt="Logo" 
            style={{ width: '90px', height: '90px', objectFit: 'contain', borderRadius: '15px', backgroundColor: 'white' }} 
            crossOrigin="anonymous" 
          />
          <div>
            <h1 style={{ fontSize: '38px', color: '#4B2C20', margin: '0', lineHeight: '1', letterSpacing: '-0.02em', fontFamily: "'Playfair Display', serif" }}>{branding.appName}</h1>
          </div>
        </div>
      </div>
    )}

    {/* When no header, just show CARTA nicely top left or right depending on needs */}
    {!showHeader && (
       <div style={{ textAlign: 'right', marginBottom: '10px', position: 'relative', zIndex: 1, flexShrink: 0 }}>
       </div>
    )}

    {/* Menu Content */}
    <h2 style={{ fontSize: '28px', color: '#1c1917', textAlign: 'center', fontWeight: '900', marginBottom: showHeader ? '10px' : '15px', letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: "'Playfair Display', serif", flexShrink: 0 }}>Carta</h2>
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '12px', 
      position: 'relative', 
      zIndex: 1,
      flexGrow: 1
    }}>
      {productList.map(item => (
        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ flexGrow: 0, display: 'flex', flexDirection: 'column', minWidth: '0', flexShrink: 1 }}>
            <span style={{ fontWeight: '800', color: '#1c1917', textTransform: 'uppercase', fontSize: '16px', fontFamily: 'sans-serif', letterSpacing: '0.01em', lineHeight: '1.2' }}>{item.name}</span>
          </div>
          <div style={{ flexGrow: 1, borderBottom: '2px dotted #a8a29e', minWidth: '20px', transform: 'translateY(4px)' }}></div>
          <div style={{ 
            flexShrink: 0, 
            backgroundColor: '#F1BF00', 
            padding: '4px 10px', 
            borderRadius: '4px',
            boxShadow: '2px 2px 0px rgba(0,0,0,0.1)'
          }}>
            <span style={{ fontWeight: '900', color: '#4B2C20', fontSize: '17px', fontFamily: 'sans-serif' }}>${item.price}</span>
          </div>
        </div>
      ))}
    </div>

    {/* Footer info found in images */}
    {showFooter && (
      <div style={{ 
        marginTop: 'auto', 
        paddingTop: showHeader ? '25px' : '5px', 
        paddingBottom: '15px', 
        position: 'relative', 
        zIndex: 1, 
        flexShrink: 0 
      }}>
         {/* Unified Footer Info with Box/Banner */}
         <div style={{ 
           backgroundColor: '#C04000', 
           padding: '12px 20px', 
           borderRadius: '16px', 
           textAlign: 'center', 
           boxShadow: '0 8px 16px -4px rgba(192, 64, 0, 0.4)',
           border: '3px solid #F1BF00',
           display: 'flex',
           flexDirection: 'column',
           gap: '4px'
         }}>
           <h4 style={{ color: 'white', fontSize: '20px', margin: '0', fontWeight: 'bold', fontFamily: "'Playfair Display', serif" }}>
             ¡Taquizas para cualquier tipo de evento!
           </h4>
           <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
             <p style={{ color: '#FDE047', fontSize: '13px', margin: '0', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
               Cotizaciones vía WhatsApp:
             </p>
             <p style={{ color: 'white', fontSize: '28px', margin: '0', fontWeight: '900', letterSpacing: '0.05em' }}>
               56 2115 7999
             </p>
           </div>
         </div>
      </div>
    )}
  </div>
);

export const PrintMenuButton = ({ products, categories, branding }: PrintMenuButtonProps) => {
  const menuPage1Ref = useRef<HTMLDivElement>(null);
  const menuPage2Ref = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  const sortedProducts = products
    .filter(p => p.available)
    .sort((a, b) => {
      // Default to high number if printOrder is missing so it goes to bottom
      const orderA = a.printOrder ?? 999;
      const orderB = b.printOrder ?? 999;
      return orderA - orderB;
    });

  // Split products for front and back (14 on front, rest on back to allow air for footer on both)
  const page1Products = sortedProducts.slice(0, 14);
  const page2Products = sortedProducts.slice(14);

  const handlePrint = async () => {
    if (!menuPage1Ref.current || !menuPage2Ref.current) {
      toast.error("Error: Referencias no encontradas");
      return;
    }
    
    setIsPrinting(true);
    const toastId = toast.loading("Generando PDF de la carta...");
    
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'letter'
      });
      
      const capturePage = async (element: HTMLElement) => {
        // Backup styles
        const originalStyles = {
          position: element.style.position,
          left: element.style.left,
          top: element.style.top,
          zIndex: element.style.zIndex,
          opacity: element.style.opacity,
          display: element.style.display,
          visibility: element.style.visibility
        };

        // Brute force visibility for capture
        element.style.position = 'fixed';
        element.style.left = '0px';
        element.style.top = '0px';
        element.style.zIndex = '999999';
        element.style.opacity = '1';
        element.style.display = 'flex';
        element.style.visibility = 'visible';

        // Wait to ensure rendering
        await new Promise(resolve => requestAnimationFrame(resolve));
        await new Promise(resolve => setTimeout(resolve, 800));

        try {
          const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#FDF5E6',
            width: 816,
            height: 1056,
            logging: false,
            scrollX: 0,
            scrollY: 0,
            imageTimeout: 15000,
            onclone: (clonedDoc) => {
              // Critical Fix: Remove oklch colors which crash html2canvas/jsPDF in many browsers
              const styleTags = clonedDoc.getElementsByTagName('style');
              for (let i = 0; i < styleTags.length; i++) {
                const style = styleTags[i];
                if (style.innerHTML.includes('oklch')) {
                  style.innerHTML = style.innerHTML.replace(/[^{};]*:[^;]*oklch\([^)]*\)[^;]*;?/g, '');
                }
              }
            }
          });
          
          const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
          if (!dataUrl || dataUrl === 'data:,') {
            throw new Error("El sistema de captura falló al procesar la imagen (Canvas vacío)");
          }
          return dataUrl;
        } finally {
          // Restore original styles exactly as they were
          Object.assign(element.style, originalStyles);
        }
      };

      // Page 1 (Front)
      const img1 = await capturePage(menuPage1Ref.current);
      pdf.addImage(img1, 'JPEG', 0, 0, 612, 792, undefined, 'FAST');

      // Page 2 (Back)
      pdf.addPage();
      const img2 = await capturePage(menuPage2Ref.current);
      pdf.addImage(img2, 'JPEG', 0, 0, 612, 792, undefined, 'FAST');
      
      // Save PDF via a robust Blob approach
      const fileName = `Carta_${branding.appName.replace(/\s+/g, '_')}.pdf`;
      const pdfBlob = pdf.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 1000); // 1s delay for cleanup

      toast.success("Carta descargada exitosamente", { id: toastId });
    } catch (error) {
      console.error("PDF Export Error:", error);
      toast.error(`Error de impresión: ${error instanceof Error ? error.message : "Error durante la exportación"}`, { id: toastId });
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <>
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={handlePrint}
        disabled={isPrinting}
        className="flex items-center gap-2 border border-mex-terracotta/20 text-mex-terracotta hover:bg-mex-terracotta hover:text-white transition-all h-9"
      >
        {isPrinting ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
        <span className="text-[10px] font-black uppercase tracking-widest">
          {isPrinting ? "Generando..." : "Imprimir Carta (Frente/Vuelta)"}
        </span>
      </Button>

      {/* Hidden Menu Templates */}
      <PageTemplate productList={page1Products} showHeader showFooter innerRef={menuPage1Ref} branding={branding} />
      <PageTemplate productList={page2Products} showFooter innerRef={menuPage2Ref} branding={branding} />
    </>
  );
};
