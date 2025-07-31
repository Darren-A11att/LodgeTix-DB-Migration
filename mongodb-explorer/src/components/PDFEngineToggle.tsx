import React, { useState, useEffect } from 'react';

interface PDFEngineToggleProps {
  onEngineChange?: (engine: string) => void;
}

export const PDFEngineToggle: React.FC<PDFEngineToggleProps> = ({ onEngineChange }) => {
  const [currentEngine, setCurrentEngine] = useState('jspdf');

  useEffect(() => {
    // Load preference from localStorage
    const saved = localStorage.getItem('pdfEngine') || 'jspdf';
    setCurrentEngine(saved);
  }, []);

  const handleChange = (engine: string) => {
    setCurrentEngine(engine);
    localStorage.setItem('pdfEngine', engine);
    onEngineChange?.(engine);
  };

  // Only show in development mode
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border rounded-lg shadow-lg p-4 z-50">
      <h4 className="text-sm font-semibold mb-2">PDF Engine</h4>
      <div className="space-y-2">
        <label className="flex items-center">
          <input
            type="radio"
            value="jspdf"
            checked={currentEngine === 'jspdf'}
            onChange={(e) => handleChange(e.target.value)}
            className="mr-2"
          />
          <span className="text-sm">jsPDF (Recommended)</span>
        </label>
        <label className="flex items-center">
          <input
            type="radio"
            value="puppeteer"
            checked={currentEngine === 'puppeteer'}
            onChange={(e) => handleChange(e.target.value)}
            className="mr-2"
          />
          <span className="text-sm">Puppeteer (Legacy)</span>
        </label>
      </div>
    </div>
  );
};