import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { PDFEngine, PDFGeneratorOptions } from '@/types/pdf-engine';

export class JsPDFEngine implements PDFEngine {
  name = 'jspdf';

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async generatePDF(
    element: HTMLElement, 
    filename: string, 
    options?: PDFGeneratorOptions
  ): Promise<Blob> {
    try {
      console.log('[jsPDF] Starting PDF generation for:', filename);
      console.log('[jsPDF] Element dimensions:', element.offsetWidth, 'x', element.offsetHeight);
      
      const defaultOptions: PDFGeneratorOptions = {
        format: 'a4',
        orientation: 'portrait',
        margin: {
          top: 10,
          right: 10,
          bottom: 10,
          left: 10
        }
      };

      const finalOptions = { ...defaultOptions, ...options };

      console.log('[jsPDF] Calling html2canvas...');
      // Enhanced html2canvas settings for better quality
      const canvas = await html2canvas(element, {
        scale: 2, // Higher scale for better quality (critical for text clarity)
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 794, // A4 width at 96 DPI
        windowHeight: 1123, // A4 height at 96 DPI
        dpi: 192, // Higher DPI for better text rendering
        letterRendering: true, // Better text rendering
        allowTaint: false,
        foreignObjectRendering: false,
        imageTimeout: 0, // No timeout for image loading
        // Fix sub-pixel rendering issues
        onclone: (clonedDoc) => {
          const clonedElement = clonedDoc.querySelector('[data-pdf-element]');
          if (clonedElement) {
            // Ensure integer positioning to avoid blurry rendering
            clonedElement.style.position = 'relative';
            clonedElement.style.transform = 'translateZ(0)';
          }
        }
      });

      console.log('[jsPDF] Canvas generated:', canvas.width, 'x', canvas.height);

      // Create PDF
      const pdf = new jsPDF({
        orientation: finalOptions.orientation,
        unit: 'mm',
        format: finalOptions.format
      });

      // Calculate dimensions to fit A4 properly
      const pageWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const marginHorizontal = finalOptions.margin.left + finalOptions.margin.right;
      const marginVertical = finalOptions.margin.top + finalOptions.margin.bottom;
      
      const maxWidth = pageWidth - marginHorizontal;
      const maxHeight = pageHeight - marginVertical;
      
      // Calculate scaled dimensions maintaining aspect ratio
      const canvasAspectRatio = canvas.width / canvas.height;
      const pageAspectRatio = maxWidth / maxHeight;
      
      let imgWidth, imgHeight;
      
      if (canvasAspectRatio > pageAspectRatio) {
        // Canvas is wider relative to page
        imgWidth = maxWidth;
        imgHeight = maxWidth / canvasAspectRatio;
      } else {
        // Canvas is taller relative to page
        imgHeight = maxHeight;
        imgWidth = maxHeight * canvasAspectRatio;
      }
      
      console.log('[jsPDF] Adding image to PDF with dimensions:', imgWidth, 'x', imgHeight);
      
      // Use PNG for better text quality (JPEG compression can blur text)
      const imgData = canvas.toDataURL('image/png');
      
      // Check if content fits on one page
      if (imgHeight <= maxHeight) {
        // Single page - center content if needed
        pdf.addImage(
          imgData,
          'PNG',
          finalOptions.margin.left,
          finalOptions.margin.top,
          imgWidth,
          imgHeight,
          undefined, // alias
          'FAST' // compression - FAST maintains quality
        );
      } else {
        // Multi-page handling
        let heightLeft = imgHeight;
        let position = 0;
        let pageNumber = 0;
        
        while (heightLeft > 0) {
          if (pageNumber > 0) {
            pdf.addPage();
          }
          
          const pageHeight = pageNumber === 0 ? maxHeight : maxHeight;
          const sourceY = position;
          const sourceHeight = Math.min(heightLeft, pageHeight);
          
          // Calculate source rectangle in canvas coordinates
          const canvasSourceY = (sourceY / imgHeight) * canvas.height;
          const canvasSourceHeight = (sourceHeight / imgHeight) * canvas.height;
          
          // Create a temporary canvas for this page section
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = canvas.width;
          pageCanvas.height = canvasSourceHeight;
          const ctx = pageCanvas.getContext('2d');
          
          // Copy the relevant portion
          ctx.drawImage(
            canvas,
            0, canvasSourceY, canvas.width, canvasSourceHeight,
            0, 0, canvas.width, canvasSourceHeight
          );
          
          // Add this section to PDF
          pdf.addImage(
            pageCanvas.toDataURL('image/png'),
            'PNG',
            finalOptions.margin.left,
            finalOptions.margin.top,
            imgWidth,
            sourceHeight,
            undefined,
            'FAST'
          );
          
          position += sourceHeight;
          heightLeft -= sourceHeight;
          pageNumber++;
        }
      }

      console.log('[jsPDF] Generating blob...');
      const blob = pdf.output('blob');
      console.log('[jsPDF] PDF blob created, size:', blob.size);
      return blob;
    } catch (error) {
      console.error('jsPDF generation failed:', error);
      throw new Error(`Failed to generate PDF with jsPDF: ${(error as Error).message}`);
    }
  }
}