import { useMemo, useRef } from 'react';
import DOMPurify from 'dompurify';
import { substituteVariables } from '@/lib/template-utils';

// Create a clean instance of DOMPurify to bypass global hooks that block standard stylesheet features (like @import or data URLs).
const purify = DOMPurify();

interface DocumentRendererProps {
  htmlContent: string;
  variables: Record<string, string>;
  letterheadUrl?: string | null;
  className?: string;
  isPredefinedHtml?: boolean;
}

export function DocumentRenderer({ 
  htmlContent, 
  variables, 
  letterheadUrl,
  className = "",
  isPredefinedHtml = false
}: DocumentRendererProps) {
  
  const containerRef = useRef<HTMLDivElement>(null);

  const finalHtml = useMemo(() => {
    let content = substituteVariables(htmlContent, variables);
    // Sanitize the HTML using the clean DOMPurify instance to prevent XSS while allowing styling rules
    return purify.sanitize(content, {
      ADD_TAGS: ['style'],
      ADD_ATTR: ['style'],
      FORCE_BODY: true
    });
  }, [htmlContent, variables]);

  return (
    <div className={`document-renderer ${className}`}>
      <div className={`a4-page mx-auto bg-white relative overflow-hidden print:shadow-none print:m-0 ${isPredefinedHtml ? '' : 'shadow-2xl'}`}>
        {letterheadUrl && !isPredefinedHtml && (
          <div className="letterhead-container w-full flex justify-center bg-white">
            <img 
              src={letterheadUrl} 
              alt="Letterhead" 
              className="w-full object-contain max-h-[150px]" 
            />
          </div>
        )}
        
        <div 
          ref={containerRef}
          className={`content-area max-w-none dark:prose-invert ${isPredefinedHtml ? '' : 'px-[45px] py-[30px]'}`}
          dangerouslySetInnerHTML={{ __html: finalHtml }}
        />
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .document-renderer {
          background-color: transparent;
        }
        
        .a4-page {
          width: 210mm;
          min-height: 297mm;
          padding: 0;
          margin: 0 auto;
          box-sizing: border-box;
          color: #1e293b;
        }

        .letterhead-container {
          max-height: 150px;
          overflow: hidden;
        }

        ${isPredefinedHtml ? `
        .content-area {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          font-size: 13px;
          line-height: 1.45;
          color: #1e293b;
        }
        ` : `
        .content-area {
          line-height: 1.5;
          font-size: 9.5pt;
          color: #334155;
          font-family: sans-serif;
        }

        .content-area h1 { 
          font-size: 20pt; 
          font-weight: 800; 
          color: #0f172a; 
          border-bottom: 1.5pt solid #f1f5f9;
          padding-bottom: 10pt;
          margin-bottom: 20pt;
          font-family: sans-serif;
        }
        
        .content-area h2 { 
          font-size: 14pt; 
          font-weight: 700; 
          color: #1e293b;
          margin-top: 18pt;
          margin-bottom: 8pt;
          font-family: sans-serif;
        }

        .content-area p { 
          margin-bottom: 10pt; 
          font-size: 9.5pt; 
          color: #334155; 
          line-height: 1.5;
          font-family: sans-serif;
        }

        .content-area table { 
          width: 100%; 
          border-collapse: collapse; 
          margin: 14pt 0; 
        }

        .content-area th, .content-area td { 
          border: 1px solid #e2e8f0; 
          padding: 6pt 8pt; 
          text-align: left; 
          font-size: 9pt;
        }

        .content-area th { 
          background-color: #f8fafc; 
          font-weight: 600; 
          color: #475569;
        }
        `}

        @media print {
          .document-renderer {
            background-color: white !important;
          }
          .a4-page {
            width: 100% !important;
            height: auto !important;
            min-height: initial !important;
            margin: 0 !important;
            box-shadow: none !important;
          }
          body {
            background-color: white !important;
          }
        }
      `}} />
    </div>
  );
}

export function replaceDocVariables(html: string, variables: Record<string, string>): string {
  let content = html;
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
    content = content.replace(regex, () => value);
  });
  return content;
}
