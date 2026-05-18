import { useMemo, useRef } from 'react';
import DOMPurify from 'dompurify';

interface OfferLetterRendererProps {
  htmlContent: string;
  variables: Record<string, string>;
  letterheadUrl?: string | null;
  className?: string;
  isPredefinedHtml?: boolean;
}

export function OfferLetterRenderer({ 
  htmlContent, 
  variables, 
  letterheadUrl,
  className = "",
  isPredefinedHtml = false
}: OfferLetterRendererProps) {
  
  const containerRef = useRef<HTMLDivElement>(null);

  const finalHtml = useMemo(() => {
    let content = htmlContent;
    Object.entries(variables).forEach(([key, value]) => {
      // Support both {{Key}} and {{key}} formats
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'gi');
      content = content.replace(regex, () => value);
    });
    // Sanitize the HTML to prevent XSS vulnerabilities while allowing custom styles
    return DOMPurify.sanitize(content, {
      ADD_TAGS: ['style'],
      ADD_ATTR: ['style'],
      FORCE_BODY: true
    });
  }, [htmlContent, variables]);

  return (
    <div className={`offer-letter-renderer ${className}`}>
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
          className={`content-area max-w-none dark:prose-invert ${isPredefinedHtml ? '' : 'p-12 sm:p-16 md:p-20 prose prose-slate'}`}
          dangerouslySetInnerHTML={{ __html: finalHtml }}
        />
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .offer-letter-renderer {
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

        ${isPredefinedHtml ? '' : `
        .content-area {
          line-height: 1.6;
        }

        .content-area h1 { 
          font-size: 2.25rem; 
          font-weight: 800; 
          color: #0f172a; 
          border-bottom: 2px solid #f1f5f9;
          padding-bottom: 0.75rem;
          margin-bottom: 2rem;
        }
        
        .content-area h2 { 
          font-size: 1.5rem; 
          font-weight: 700; 
          color: #1e293b;
          margin-top: 2rem;
          margin-bottom: 1rem;
        }

        .content-area p { 
          margin-bottom: 1.25rem; 
          font-size: 1rem; 
          color: #334155; 
        }

        .content-area table { 
          width: 100%; 
          border-collapse: collapse; 
          margin: 2rem 0; 
        }

        .content-area th, .content-area td { 
          border: 1px solid #e2e8f0; 
          padding: 0.75rem; 
          text-align: left; 
        }

        .content-area th { 
          background-color: #f8fafc; 
          font-weight: 600; 
          color: #475569;
        }
        `}

        @media print {
          .offer-letter-renderer {
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

        /* Variable styling if needed */
        .offer-variable {
          font-weight: 600;
          color: #2563eb;
        }
      `}} />
    </div>
  );
}

export function replaceVariables(html: string, variables: Record<string, string>): string {
    let content = html;
    Object.entries(variables).forEach(([key, value]) => {
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'gi');
      content = content.replace(regex, () => value);
    });
    return content;
}
