import React from 'react';

export interface RenderOptions {
  title?: string;
  styles?: string[]; // additional CSS strings to inline
}

const baseCss = `
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; color: #111; }
  .page { width: 210mm; min-height: 297mm; padding: 10mm; box-sizing: border-box; }
  .title { font-size: 22px; font-weight: 700; }
  .muted { color:#666; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top: 12px; }
  .section-title { font-weight:700; margin: 16px 0 8px; }
  table { width:100%; border-collapse: collapse; }
  th, td { text-align:left; padding:6px 4px; }
  thead th { color:#666; font-weight:600; border-bottom:1px solid #ddd; }
  tfoot td { border-top: 1px solid #ddd; }
  .right { text-align:right; }
  @page { size: A4; margin: 10mm; }
`;

export function renderDocumentToHtml(node: React.ReactElement, opts: RenderOptions = {}): string {
  // Dynamically import ReactDOMServer only when this function is called
  const ReactDOMServer = require('react-dom/server');
  const content = ReactDOMServer.renderToStaticMarkup(node);
  const customCss = (opts.styles || []).join('\n');
  const title = opts.title || 'Document';
  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8"/>
      <title>${escapeHtml(title)}</title>
      <style>${baseCss}\n${customCss}</style>
    </head>
    <body><div class="page">${content}</div></body>
  </html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

export default renderDocumentToHtml;

