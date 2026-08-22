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
  displayValue = true,
  format = 'CODE128',
  className = '',
  lineColor = '#000000',
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const cleanVal = (value || '000000').trim();

    try {
      JsBarcode(svgRef.current, cleanVal, {
        format: format || 'CODE128',
        width: Math.max(1, width),
        height: Math.max(10, height),
        displayValue: false, // We render the text separately for crisp Arabic + English layout
        margin: 0,
        background: 'transparent',
        lineColor,
      });
    } catch (e) {
      // Fallback in case string has characters invalid for specific formats
      try {
        const sanitized = cleanVal.replace(/[^a-zA-Z0-9_-]/g, '') || '000000';
        JsBarcode(svgRef.current, sanitized, {
          format: 'CODE128',
          width: Math.max(1, width),
          height: Math.max(10, height),
          displayValue: false,
          margin: 0,
          background: 'transparent',
          lineColor,
        });
      } catch (fallbackError) {
        console.warn('Could not generate barcode SVG for value:', value, fallbackError);
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
          className="font-mono font-black tracking-wider text-black text-center select-none block leading-none pt-0.5"
          style={{ fontSize: `${fontSize}px` }}
        >
          {value || '---'}
        </span>
      )}
    </div>
  );
};

export default BarcodeItem;
