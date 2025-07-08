// Base64 encoded logo for PDF generation
// This is a placeholder - the actual logo needs to be converted to base64
export const LODGETIX_LOGO_BASE64 = 'data:image/svg+xml;base64,';

// Function to load logo dynamically
export async function loadLogoAsBase64(): Promise<string> {
  try {
    const response = await fetch('/images/lodgetix-logo.svg');
    const svgText = await response.text();
    const base64 = btoa(unescape(encodeURIComponent(svgText)));
    return `data:image/svg+xml;base64,${base64}`;
  } catch (error) {
    console.error('Failed to load logo:', error);
    return '';
  }
}