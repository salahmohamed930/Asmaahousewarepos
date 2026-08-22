import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeItemProps {
  value: string;
  width?: number;
  height?: number;
  fontSize?: number;
  displayValue?: boolean;
  format?: 'CODE128' | 'EAN13' | 'UPC' | 'CODE39' | 'ITF';
  className?: string;
  lineColor?: string;
}

export const BarcodeItem: React.FC<BarcodeItemProps> = ({
  value,
  width = 1.5,
  height = 32,
  fontSize = 9,
  displayValue = false,
  format = 'CODE128',
  className = '',
  lineColor = '#000000',
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    // Clear previous SVG content to avoid corrupt rendering
    while (svgRef.current.firstChild) {
      svgRef.current.removeChild(svgRef.current.firstChild);
    }

    const rawVal = (value || '').trim();
    // Sanitize: CODE128 only supports standard ASCII characters (32-126).
    // If rawVal contains non-ASCII (e.g. Arabic), extract valid chars or convert to a safe numeric representation
    let cleanVal = rawVal.replace(/[^\x20-\x7E]/g, '').trim();
    if (!cleanVal) {
      // If string was purely Arabic or empty, generate a consistent pseudo-barcode from the string hash or fallback
      let hash = 0;
      for (let i = 0; i < rawVal.length; i++) {
        hash = (hash * 31 + rawVal.charCodeAt(i)) >>> 0;
      }
      cleanVal = hash > 0 ? String(hash).padStart(6, '0') : '000000';
    }

    try {
      JsBarcode(svgRef.current, cleanVal, {
        format: format || 'CODE128',
        width: Math.max(1.2, width),
        height: Math.max(12, height),
        displayValue: false, // We render the text separately for ultra crisp typography
        margin: 0,
        background: 'transparent',
        lineColor,
        valid: (valid) => {
          if (!valid && svgRef.current) {
            // If validation failed, fallback to digits only
            try {
              const digitsOnly = cleanVal.replace(/\D/g, '') || '12345678';
              JsBarcode(svgRef.current, digitsOnly, {
                format: 'CODE128',
                width: Math.max(1.2, width),
                height: Math.max(12, height),
                displayValue: false,
                margin: 0,
                background: 'transparent',
                lineColor,
              });
            } catch {
              // Ignore fallback errors
            }
          }
        },
      });
    } catch {
      // Secondary fallback in case of any unhandled syntax
      try {
        if (svgRef.current) {
          JsBarcode(svgRef.current, '000000', {
            format: 'CODE128',
            width: Math.max(1.2, width),
            height: Math.max(12, height),
            displayValue: false,
            margin: 0,
            background: 'transparent',
            lineColor,
          });
        }
      } catch {
        // Safe fail
      }
    }
  }, [value, width, height, format, lineColor]);

  return (
    <div className={`flex flex-col items-center justify-center w-full ${className}`}>
      <svg
        ref={svgRef}
        className="block max-w-full mx-auto"
        style={{
          minHeight: `${height}px`,
          shapeRendering: 'crispEdges',
        }}
      />
      {displayValue && (
        <span
          className="font-mono font-black tracking-wider text-black text-center select-none block leading-none -mt-0.5"
          style={{ fontSize: `${fontSize}px` }}
        >
          {value || '---'}
        </span>
      )}
    </div>
  );
};

export default BarcodeItem;
