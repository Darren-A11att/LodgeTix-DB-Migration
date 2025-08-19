export async function comparePDFEngines(element: HTMLElement, filename: string) {
  const { JsPDFEngine } = await import('./pdf-engines/jspdf-engine');
  const { PuppeteerEngine } = await import('./pdf-engines/puppeteer-engine');

  const jspdf = new JsPDFEngine();
  const puppeteer = new PuppeteerEngine();

  console.log('Generating PDFs with both engines for comparison...');

  try {
    const results = await Promise.allSettled([
      jspdf.generatePDF(element, `${filename}-jspdf`),
      puppeteer.generatePDF(element, `${filename}-puppeteer`)
    ]);

    const [jspdfResult, puppeteerResult] = results;

    if (jspdfResult.status === 'fulfilled') {
      console.log('jsPDF size:', jspdfResult.value.size);
      const url = URL.createObjectURL(jspdfResult.value);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}-jspdf.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      console.error('jsPDF failed:', jspdfResult.reason);
    }

    if (puppeteerResult.status === 'fulfilled') {
      console.log('Puppeteer size:', puppeteerResult.value.size);
      const url = URL.createObjectURL(puppeteerResult.value);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}-puppeteer.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      console.error('Puppeteer failed:', puppeteerResult.reason);
    }

    console.log('Comparison complete - check downloads folder');
  } catch (error) {
    console.error('Comparison failed:', error);
  }
}

// Add to window for easy testing in console
if (typeof window !== 'undefined') {
  (window as any).comparePDFEngines = comparePDFEngines;
}