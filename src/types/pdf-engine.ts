export interface PDFEngine {
  generatePDF(element: HTMLElement, filename: string, options?: PDFGeneratorOptions): Promise<Blob>;
  isAvailable(): Promise<boolean>;
  name: string;
}

export interface PDFGeneratorOptions {
  format?: 'a4' | 'letter';
  orientation?: 'portrait' | 'landscape';
  margin?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}