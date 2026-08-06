import { useMemo, useRef } from 'react';
import DOMPurify from 'dompurify';
import { substituteVariables } from '@/lib/template-utils';

// Create a clean instance of DOMPurify to bypass global hooks that block standard stylesheet features (like @import or data URLs). Never ever change this. This is imporatnt file to load Offer Letter Correctly.
const purify = DOMPurify();

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
    let content = substituteVariables(htmlContent, variables);
    // Sanitize the HTML using the clean DOMPurify instance to prevent XSS while allowing styling rules
    return purify.sanitize(content, {
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
          className={`content-area max-w-none ${isPredefinedHtml ? '' : 'p-12 sm:p-16 md:p-20 prose prose-slate dark:prose-invert'}`}
          dangerouslySetInnerHTML={{ __html: finalHtml }}
        />
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
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

        ${isPredefinedHtml ? `
        .content-area {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          font-size: 13px;
          line-height: 1.45;
          color: #1e293b;
          box-sizing: border-box;
        }
        .content-area * {
          box-sizing: border-box;
        }
        ` : `
        .content-area {
          line-height: 1.6;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }

        .content-area h1 { 
          font-size: 28pt; 
          font-weight: 800; 
          color: #0f172a; 
          border-bottom: 2pt solid #f1f5f9;
          padding-bottom: 15pt;
          margin-bottom: 30pt;
        }
        
        .content-area h2 { 
          font-size: 18pt; 
          font-weight: 700; 
          color: #1e293b;
          margin-top: 25pt;
          margin-bottom: 12pt;
        }

        .content-area p { 
          margin-bottom: 15pt; 
          font-size: 11pt; 
          color: #334155; 
          line-height: 1.6;
        }

        .content-area table { 
          width: 100%; 
          border-collapse: collapse; 
          margin: 20pt 0; 
        }

        .content-area th, .content-area td { 
          border: 1px solid #e2e8f0; 
          padding: 10pt; 
          text-align: left; 
          font-size: 10pt; 
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
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
    content = content.replace(regex, () => value);
  });
  return content;
}
