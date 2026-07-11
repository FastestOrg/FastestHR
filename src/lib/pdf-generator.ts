import { supabase } from '@/integrations/supabase/client';
// @ts-ignore
import html2pdf from 'html2pdf.js';

// Global serialized queue for DOM-heavy PDF operations to prevent concurrent reflows and flicker
let pdfGenerationQueue: Promise<any> = Promise.resolve();

async function enqueuePDFGeneration<T>(task: () => Promise<T>): Promise<T> {
  const nextTask = pdfGenerationQueue.then(task);
  pdfGenerationQueue = nextTask.catch(() => {});
  return nextTask;
}

interface CompensationStructure {
  basic_pay: number;
  dearness_allowance: number;
  house_rental: number;
  conveyance_allowance: number;
  special_allowance: number;
  medical_insurance: number;
}

interface GenerateOfferParams extends GeneratePDFParams {
  candidateName: string;
  jobTitle: string;
  joiningDate: string;
  payout: number | string;
  offerNumber: string;
  candidateId: string;
  offerLink?: string;
  compensationStructure?: CompensationStructure | null;
  status?: string;
  signedAt?: string;
  signingIp?: string;
  signingUserAgent?: string;
}

interface GeneratePDFParams {
  htmlContent: string;
  letterheadUrl?: string | null;
  companyId: string;
  isPredefinedHtml?: boolean;
  customVariableValues?: Record<string, string>;
  currency?: string;
  today?: string;
}

interface GenerateSendDeskParams extends GeneratePDFParams {
  documentId: string;
  documentName: string;
}

/**
 * Escapes HTML characters to prevent XSS.
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Replaces template variables in HTML content with actual values.
 */
function substituteVariables(html: string, vars: Record<string, string>): string {
  let result = html;
  for (const [key, value] of Object.entries(vars)) {
    // Support case-insensitive replacement for base variables
    const regex = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    // Escape the value to prevent XSS from user inputs (e.g., candidate name, custom vars)
    const safeValue = escapeHtml(String(value));
    result = result.replace(regex, () => safeValue);
  }
  
  // Auto-fix for legacy template Javascript that incorrectly parses currency symbols
  // Changes: .replace(/,/g, '')  ->  .replace(/[^0-9.-]/g, '')
  result = result.replace(/\.replace\(\s*\/[^/]*?(?:[,$€£₹]|Rs)[^/]*?\/[gim]*\s*,\s*(?:''|"")\s*\)/g, ".replace(/[^0-9.-]/g, '')");
  
  return result;
}

/**
 * Formats a YYYY-MM-DD date string to 'MMM D, YYYY' format (e.g. Jan 8, 2027).
 */
function formatDateString(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.trim().split('-');
  if (parts.length === 3) {
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  return dateStr;
}

/**
 * Builds the variable map from offer parameters.
 */
function buildVariableMap(params: Partial<GenerateOfferParams>): Record<string, string> {
  const baseMap: Record<string, string> = {};

  if (params.candidateName) {
    baseMap['{{Name}}'] = params.candidateName;
    baseMap['{{candidate_name}}'] = params.candidateName;
  }
  
  if (params.jobTitle) {
    baseMap['{{Designation}}'] = params.jobTitle;
    baseMap['{{job_title}}'] = params.jobTitle;
  }

  if (params.joiningDate) {
    const formattedJoiningDate = formatDateString(params.joiningDate);
    baseMap['{{Joined Date}}'] = formattedJoiningDate;
    baseMap['{{joined_date}}'] = formattedJoiningDate;
  }

  if (params.payout !== undefined) {
    const payoutNum = typeof params.payout === 'string' 
      ? parseFloat(params.payout.replace(/[^0-9.-]+/g, "")) 
      : params.payout;

    const formattedPayout = (payoutNum || 0).toLocaleString('en-US', {
      style: 'currency',
      currency: params.currency || 'USD',
    });
    baseMap['{{Payout}}'] = formattedPayout;
    baseMap['{{payout}}'] = formattedPayout;
  }

  if (params.offerNumber) {
    baseMap['{{Offer Number}}'] = params.offerNumber;
    baseMap['{{offer_number}}'] = params.offerNumber;
  }

  if (params.offerLink) {
    baseMap['{{Offer Link}}'] = params.offerLink || '';
    baseMap['{{offer_link}}'] = params.offerLink || '';
  }

  const formattedToday = params.today || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  baseMap['{{Today}}'] = formattedToday;
  baseMap['{{today}}'] = formattedToday;

  // Merge compensation structure variables
  if (params.compensationStructure) {
    const cs = params.compensationStructure;
    baseMap['{{Basic Pay Percent}}'] = `${cs.basic_pay}%`;
    baseMap['{{DA Percent}}'] = `${cs.dearness_allowance}%`;
    baseMap['{{HRA Percent}}'] = `${cs.house_rental}%`;
    baseMap['{{Conveyance Percent}}'] = `${cs.conveyance_allowance}%`;
    baseMap['{{Special Allowance Percent}}'] = `${cs.special_allowance}%`;
    baseMap['{{Medical Insurance Percent}}'] = `${cs.medical_insurance}%`;
  }

  // Merge custom variables into the map
  if (params.customVariableValues) {
    for (const [key, value] of Object.entries(params.customVariableValues)) {
      baseMap[`{{${key}}}`] = value;
    }
  }

  return baseMap;
}

/**
 * Builds the DOM element for predefined HTML mode.
 * No system styles, no padding, no letterhead, no wrapper divs.
 * The user's HTML is injected as-is — identical to how OfferLetterRenderer renders it in preview.
 */
function buildPredefinedHtmlElement(html: string): HTMLElement {
  const el = document.createElement('div');
  // Enforce zero margins on the container itself
  el.style.cssText = 'width: 210mm; margin: 0; padding: 0; border: none; background-color: white;';
  
  // A strict CSS reset applied ONLY to the very top elements.
  // This removes the "upper padding" caused by browser default paragraph/heading margins
  // while preserving the user's intended spacing between paragraphs inside the body.
  el.innerHTML = `
    <style>
      /* Force the wrapper into a tight Flexbox column to obliterate any whitespace, line-breaks, or visual margins between pages */
      #pdf-predefined-wrapper {
        display: flex !important;
        flex-direction: column !important;
        gap: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        border: none !important;
      }
      #pdf-predefined-wrapper > *:first-child {
        margin-top: 0 !important;
        padding-top: 0 !important;
      }
      #pdf-predefined-wrapper > *:first-child > *:first-child {
        margin-top: 0 !important; 
        padding-top: 0 !important;
      }
      /* Kill all external separation/margins on the pages themselves to guarantee mathematical canvas slicing alignment */
      #pdf-predefined-wrapper .page {
        margin: 0 !important;
        border: none !important;
        box-sizing: border-box !important;
      }
      /* Hide any stray <br> tags placed between pages */
      #pdf-predefined-wrapper > br {
        display: none !important;
      }
    </style>
    <div id="pdf-predefined-wrapper">
      ${html}
    </div>
  `;
  
  return el;
}

/**
 * Builds the DOM element for raw/standard HTML mode.
 * Applies system layout: letterhead image, padding, typography styles.
 */
function buildRawHtmlElement(html: string, letterheadUrl?: string | null): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText =
    'width:210mm;min-height:297mm;padding:0;margin:0;background-color:white;color:#1e293b;font-family:sans-serif;';

  let letterheadBlock = '';
  if (letterheadUrl) {
    letterheadBlock = `
      <div style="width:100%;max-height:150px;overflow:hidden;display:flex;justify-content:center;background-color:white;">
        <img src="${letterheadUrl}" style="width:100%;object-fit:contain;max-height:150px;" crossorigin="anonymous" />
      </div>`;
  }

  el.innerHTML = `
    <div style="background-color:white;">
      ${letterheadBlock}
      <div style="padding:40px 60px;line-height:1.6;">
        <style>
          h1 { font-size:28pt; font-weight:800; color:#0f172a; border-bottom:2pt solid #f1f5f9; padding-bottom:15pt; margin-bottom:30pt; font-family:sans-serif; }
          h2 { font-size:18pt; font-weight:700; color:#1e293b; margin-top:25pt; margin-bottom:12pt; font-family:sans-serif; }
          p  { font-size:11pt; color:#334155; margin-bottom:15pt; line-height:1.6; font-family:sans-serif; }
          table { width:100%; border-collapse:collapse; margin:20pt 0; }
          th, td { border:1px solid #e2e8f0; padding:10pt; text-align:left; font-size:10pt; }
          th { background-color:#f8fafc; font-weight:600; color:#475569; }
        </style>
        ${html}
      </div>
    </div>`;

  return el;
}

/**
 * Core function to generate and upload PDF
 */
async function generateAndUploadPDF(
  params: GeneratePDFParams,
  bucketName: string,
  fileNamePrefix: string
): Promise<{ pdfPath: string; manipulatedHtml: string }> {
  const { htmlContent, letterheadUrl, companyId, isPredefinedHtml = false } = params;

  // 1. Replace template variables (if any provided in customVariableValues)
  // For SendDesk, variables are usually already replaced before calling this, 
  // but we support it for consistency.
  const vars = buildVariableMap(params);
  let finalHtml = substituteVariables(htmlContent, vars);

  // Append Certificate of Digital Signature if offer is signed
  if ((params as any).status === 'signed') {
    const auditBlock = `
      <div style="margin-top: 50px; padding: 20px; border: 2px dashed #10b981; border-radius: 8px; background-color: #f0fdf4; font-family: sans-serif; page-break-inside: avoid;">
        <h3 style="margin: 0 0 10px 0; color: #166534; font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
          ✓ Secure Digital Signature Certificate
        </h3>
        <table style="width: 100%; border-collapse: collapse; margin: 0; font-size: 11px;">
          <tr>
            <td style="padding: 4px 0; color: #64748b; font-weight: 500; width: 140px; border: none;">Candidate Name:</td>
            <td style="padding: 4px 0; color: #0f172a; font-weight: 600; border: none;">${escapeHtml((params as any).candidateName || '')}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b; font-weight: 500; border: none;">IP Address:</td>
            <td style="padding: 4px 0; color: #0f172a; font-family: monospace; border: none;">${escapeHtml((params as any).signingIp || 'N/A')}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b; font-weight: 500; border: none;">Timestamp (UTC):</td>
            <td style="padding: 4px 0; color: #0f172a; border: none;">${(params as any).signedAt ? new Date((params as any).signedAt).toUTCString() : 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b; font-weight: 500; border: none;">User Agent:</td>
            <td style="padding: 4px 0; color: #64748b; font-size: 10px; line-height: 1.2; border: none;">${escapeHtml((params as any).signingUserAgent || 'N/A')}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b; font-weight: 500; border: none;">Security Method:</td>
            <td style="padding: 4px 0; color: #166534; font-weight: 600; border: none;">Double-Factor Email OTP Challenge Verified</td>
          </tr>
        </table>
      </div>
    `;
    finalHtml = finalHtml + auditBlock;
  }

  // 2. Build the source element
  const pdfElement = isPredefinedHtml
    ? buildPredefinedHtmlElement(finalHtml)
    : buildRawHtmlElement(finalHtml, letterheadUrl);

  // 3. Configure html2pdf options
  const opt = {
    margin: (isPredefinedHtml ? [0, 0, 0, 0] : [10, 10, 10, 10]) as [number, number, number, number],
    filename: `${fileNamePrefix}.pdf`,
    image: { type: 'jpeg' as const, quality: 1 },
    html2canvas: { 
      scale: 2, 
      useCORS: true,
      scrollY: 0,
      scrollX: 0,
      windowWidth: 794 
    },
    jsPDF: isPredefinedHtml 
      ? { unit: 'px' as const, format: [794, 1123] as [number, number], orientation: 'portrait' as const, hotfixes: ["px_scaling"] }
      : { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
    pagebreak: isPredefinedHtml ? { mode: [] } : { mode: ['css', 'legacy'] }
  };

  let pdfBlob: Blob;
  const originalOverflow = document.body.style.overflow;

  const result = await enqueuePDFGeneration(async () => {
    try {
      document.body.style.overflow = 'hidden';
      pdfElement.style.position = 'absolute';
      pdfElement.style.top = '-9999px';
      pdfElement.style.left = '-9999px';
      pdfElement.style.visibility = 'hidden';
      document.body.appendChild(pdfElement);

      const scripts = Array.from(pdfElement.querySelectorAll('script'));
      for (const oldScript of scripts) {
        const newScript = document.createElement('script');
        newScript.textContent = oldScript.textContent || '';
        Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
        oldScript.parentNode?.replaceChild(newScript, oldScript);
      }

      if (scripts.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const manipulatedHtml = pdfElement.innerHTML;
      
      // Remove from DOM and reset styles so html2pdf can render it correctly without viewport scaling/clipping bugs.
      if (document.body.contains(pdfElement)) {
        document.body.removeChild(pdfElement);
      }
      pdfElement.style.position = '';
      pdfElement.style.top = '';
      pdfElement.style.left = '';
      pdfElement.style.visibility = '';

      const blob = await html2pdf().set(opt).from(pdfElement).output('blob');
      return { blob, manipulatedHtml };
    } finally {
      document.body.style.overflow = originalOverflow;
      if (document.body.contains(pdfElement)) {
        document.body.removeChild(pdfElement);
      }
    }
  });

  pdfBlob = result.blob;
  const manipulatedHtml = result.manipulatedHtml;

  const fileName = `${companyId}/${fileNamePrefix}_${Date.now()}.pdf`;
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(fileName, pdfBlob, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Failed to upload PDF: ${uploadError.message}`);
  }

  return { pdfPath: uploadData.path, manipulatedHtml };
}

/**
 * Generates a PDF blob from offer HTML, uploads it to Supabase Storage, returns the path and the final manipulated HTML.
 */
export async function generateAndUploadOfferPDF(params: GenerateOfferParams): Promise<{ pdfPath: string, manipulatedHtml: string }> {
  return generateAndUploadPDF(params, 'offer_letters', `Offer-${params.candidateName.replace(/\s+/g, '-')}`);
}

/**
 * Generates a PDF blob from SendDesk HTML, uploads it to Supabase Storage, returns the path.
 */
export async function generateAndUploadSendDeskPDF(params: GenerateSendDeskParams): Promise<{ pdfPath: string }> {
  const result = await generateAndUploadPDF(params, 'senddesk-documents', `${params.documentId}`);
  return { pdfPath: result.pdfPath };
}

/**
 * Utility: replaces variables in HTML without generating a PDF.
 */
export function replaceHtmlVariables(
  htmlContent: string,
  params: Partial<GenerateOfferParams>
): string {
  const vars = buildVariableMap(params);
  return substituteVariables(htmlContent, vars);
}

interface GeneratePayslipPDFParams {
  companyName: string;
  employeeName: string;
  employeeEmail: string;
  employeeCode?: string;
  department?: string;
  designation?: string;
  periodStart: string;
  periodEnd: string;
  slip: any;
  currency?: string;
  skipDownload?: boolean;
}

export async function generateAndDownloadPayslipPDF(params: GeneratePayslipPDFParams): Promise<void> {
  const {
    companyName,
    employeeName,
    employeeEmail,
    employeeCode,
    department,
    designation,
    periodStart,
    periodEnd,
    slip,
    currency = 'USD',
    skipDownload = false
  } = params;

  // 1. If pdf_url is already cached in the database, fetch signed URL and trigger download
  if (slip?.pdf_url) {
    if (skipDownload) {
      return;
    }
    try {
      const { data, error } = await supabase.storage
        .from('payslips')
        .createSignedUrl(slip.pdf_url, 60);
      if (!error && data?.signedUrl) {
        const a = document.createElement('a');
        a.href = data.signedUrl;
        a.target = '_blank';
        a.download = `Payslip_${employeeName.replace(/\s+/g, '_')}_${periodStart}_to_${periodEnd}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      } else {
        console.warn("Failed to get signed URL for cached payslip, regenerating...", error);
      }
    } catch (err) {
      console.warn("Error retrieving cached payslip PDF, regenerating...", err);
    }
  }

  function formatCurrency(amount: number, curr: string = 'USD') {
    try {
      return new Intl.NumberFormat(curr === 'INR' ? 'en-IN' : 'en-US', {
        style: 'currency',
        currency: curr,
      }).format(amount);
    } catch (e) {
      return `${curr} ${amount.toFixed(2)}`;
    }
  }

  function convertNumberToWords(amount: number, curr: string = 'USD'): string {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    
    function convertLessThanThousand(num: number): string {
      if (num === 0) return '';
      let result = '';
      if (num >= 100) {
        result += ones[Math.floor(num / 100)] + ' Hundred ';
        num %= 100;
      }
      if (num >= 20) {
        result += tens[Math.floor(num / 10)] + ' ';
        num %= 10;
      }
      if (num > 0) {
        result += ones[num] + ' ';
      }
      return result.trim();
    }

    const integerPart = Math.floor(amount);
    const decimalPart = Math.round((amount - integerPart) * 100);

    if (integerPart === 0 && decimalPart === 0) {
      return 'Zero';
    }

    let words = '';
    let temp = integerPart;

    const units = ['', 'Thousand', 'Million', 'Billion'];
    let unitIndex = 0;

    while (temp > 0) {
      const chunk = temp % 1000;
      if (chunk > 0) {
        const chunkWords = convertLessThanThousand(chunk);
        words = chunkWords + ' ' + units[unitIndex] + ' ' + words;
      }
      temp = Math.floor(temp / 1000);
      unitIndex++;
    }

    words = words.trim();
    if (curr === 'INR') {
      words = words + ' Rupees';
      if (decimalPart > 0) {
        words += ' and ' + convertLessThanThousand(decimalPart) + ' Paisa';
      }
      words += ' Only';
    } else if (curr === 'USD') {
      words = words + ' Dollars';
      if (decimalPart > 0) {
        words += ' and ' + convertLessThanThousand(decimalPart) + ' Cents';
      }
      words += ' Only';
    } else if (curr === 'EUR') {
      words = words + ' Euros';
      if (decimalPart > 0) {
        words += ' and ' + convertLessThanThousand(decimalPart) + ' Cents';
      }
      words += ' Only';
    } else if (curr === 'GBP') {
      words = words + ' Pounds';
      if (decimalPart > 0) {
        words += ' and ' + convertLessThanThousand(decimalPart) + ' Pence';
      }
      words += ' Only';
    } else if (curr === 'AED') {
      words = words + ' Dirhams';
      if (decimalPart > 0) {
        words += ' and ' + convertLessThanThousand(decimalPart) + ' Fils';
      }
      words += ' Only';
    } else if (curr === 'SAR') {
      words = words + ' Riyals';
      if (decimalPart > 0) {
        words += ' and ' + convertLessThanThousand(decimalPart) + ' Halalas';
      }
      words += ' Only';
    } else {
      words = words + ' ' + curr;
      if (decimalPart > 0) {
        words += ' and ' + convertLessThanThousand(decimalPart) + ' Cents';
      }
      words += ' Only';
    }
    return words;
  }

  const earningsList: { name: string; amount: number }[] = [];
  const deductionsList: { name: string; amount: number }[] = [];

  const jurisdiction = slip.breakdown?.jurisdiction || 'USA';
  const overtimePayout = slip.breakdown?.overtime_payout || 0;
  const overtimeHours = slip.breakdown?.overtime_hours || 0;
  const overtimeMultiplier = slip.breakdown?.overtime_multiplier || 1.5;
  const attendancePenalty = slip.breakdown?.attendance_penalty || 0;
  const lateCount = slip.breakdown?.late_count || 0;

  // regular base salary excludes overtime payout
  const gross = slip.gross_salary || 0;
  const regularGross = Math.max(0, gross - overtimePayout);
  const totalDed = slip.total_deductions || 0;

  // Distribute earnings
  if (jurisdiction === 'IND') {
    const basic = Math.round(regularGross * 0.50 * 100) / 100;
    const hra = Math.round(regularGross * 0.30 * 100) / 100;
    const da = Math.round(regularGross * 0.10 * 100) / 100;
    const special = Math.round((regularGross - basic - hra - da) * 100) / 100;

    earningsList.push({ name: 'Basic Salary', amount: basic });
    earningsList.push({ name: 'House Rent Allowance (HRA)', amount: hra });
    earningsList.push({ name: 'Dearness Allowance (DA)', amount: da });
    if (special > 0) {
      earningsList.push({ name: 'Special Allowance', amount: special });
    }
  } else {
    const basic = Math.round(regularGross * 0.70 * 100) / 100;
    const special = Math.round((regularGross - basic) * 100) / 100;

    earningsList.push({ name: 'Basic Pay', amount: basic });
    if (special > 0) {
      earningsList.push({ name: 'Special Allowance', amount: special });
    }
  }

  // Append Overtime Pay if present
  if (overtimePayout > 0) {
    earningsList.push({ name: `Overtime Pay (${overtimeHours} hrs at ${overtimeMultiplier}x)`, amount: overtimePayout });
  }

  // Distribute deductions
  const taxDetail = slip.breakdown?.details || {};
  if (jurisdiction === 'IND') {
    const taxMonthly = slip.breakdown?.income_tax_monthly || 0;
    const epfMonthly = taxDetail.epfMonthly || 0;
    
    if (taxMonthly > 0) {
      deductionsList.push({ name: 'Income Tax (TDS)', amount: taxMonthly });
    }
    if (epfMonthly > 0) {
      deductionsList.push({ name: 'Employee Provident Fund (EPF)', amount: epfMonthly });
    }

    // Append Attendance Penalty if present
    if (attendancePenalty > 0) {
      deductionsList.push({ name: `Late-in Penalty (${lateCount} Late In)`, amount: attendancePenalty });
    }

    const calculatedDed = taxMonthly + epfMonthly + attendancePenalty;
    const otherDed = Math.round((totalDed - calculatedDed) * 100) / 100;
    if (otherDed > 0) {
      deductionsList.push({ name: 'Other Deductions / LOP Adjustment', amount: otherDed });
    } else if (otherDed < 0) {
      if (deductionsList.length > 0) {
        deductionsList[deductionsList.length - 1].amount = Math.round((deductionsList[deductionsList.length - 1].amount + otherDed) * 100) / 100;
      }
    }
  } else {
    const taxMonthly = slip.breakdown?.income_tax_monthly || 0;
    const ssMonthly = taxDetail.socialSecurityMonthly || 0;
    const medicareMonthly = taxDetail.medicareMonthly || 0;

    if (taxMonthly > 0) {
      deductionsList.push({ name: 'Federal Income Tax', amount: taxMonthly });
    }
    if (ssMonthly > 0) {
      deductionsList.push({ name: 'Social Security Tax', amount: ssMonthly });
    }
    if (medicareMonthly > 0) {
      deductionsList.push({ name: 'Medicare Tax', amount: medicareMonthly });
    }

    // Append Attendance Penalty if present
    if (attendancePenalty > 0) {
      deductionsList.push({ name: `Late-in Penalty (${lateCount} Late In)`, amount: attendancePenalty });
    }

    const calculatedDed = taxMonthly + ssMonthly + medicareMonthly + attendancePenalty;
    const otherDed = Math.round((totalDed - calculatedDed) * 100) / 100;
    if (otherDed > 0) {
      deductionsList.push({ name: 'Other Deductions / LOP Adjustment', amount: otherDed });
    } else if (otherDed < 0) {
      if (deductionsList.length > 0) {
        deductionsList[deductionsList.length - 1].amount = Math.round((deductionsList[deductionsList.length - 1].amount + otherDed) * 100) / 100;
      }
    }
  }

  if (deductionsList.length === 0 && totalDed > 0) {
    deductionsList.push({ name: 'Statutory Deductions', amount: totalDed });
  }

  const amountInWords = convertNumberToWords(slip.net_salary || 0, currency);

  const container = document.createElement('div');
  container.style.cssText = 'width: 210mm; padding: 20px; background: white; margin: 0; box-sizing: border-box; font-family: sans-serif;';
  
  container.innerHTML = `
    <div style="padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #3b82f6; padding-bottom: 12px; margin-bottom: 15px;">
        <div>
          <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #1e3a8a;">${escapeHtml(companyName)}</h1>
          <p style="margin: 2px 0 0 0; font-size: 11px; color: #64748b; font-weight: 500;">Official Payslip Document</p>
        </div>
        <div style="text-align: right;">
          <h2 style="margin: 0; font-size: 18px; font-weight: 700; color: #0f172a;">PAYSLIP</h2>
          <p style="margin: 2px 0 0 0; font-size: 11px; color: #3b82f6; font-weight: 600;">${escapeHtml(periodStart)} — ${escapeHtml(periodEnd)}</p>
        </div>
      </div>

      <!-- Employee details -->
      <div style="display: flex; gap: 20px; background-color: #f8fafc; padding: 12px; border-radius: 6px; margin-bottom: 15px; border: 1px solid #f1f5f9; font-size: 12px;">
        <div style="flex: 1;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="height: 20px;">
              <td style="color: #64748b; font-weight: 500; width: 110px;">Employee Name:</td>
              <td style="color: #0f172a; font-weight: 600;">${escapeHtml(employeeName)}</td>
            </tr>
            <tr style="height: 20px;">
              <td style="color: #64748b; font-weight: 500;">Email Address:</td>
              <td style="color: #0f172a;">${escapeHtml(employeeEmail)}</td>
            </tr>
            ${employeeCode ? `
            <tr style="height: 20px;">
              <td style="color: #64748b; font-weight: 500;">Employee ID:</td>
              <td style="color: #0f172a; font-weight: 600;">${escapeHtml(employeeCode)}</td>
            </tr>` : ''}
            ${department ? `
            <tr style="height: 20px;">
              <td style="color: #64748b; font-weight: 500;">Department:</td>
              <td style="color: #0f172a;">${escapeHtml(department)}</td>
            </tr>` : ''}
          </table>
        </div>
        <div style="flex: 1;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="height: 20px;">
              <td style="color: #64748b; font-weight: 500; width: 110px;">Designation:</td>
              <td style="color: #0f172a; font-weight: 600;">${escapeHtml(designation || 'Staff')}</td>
            </tr>
            <tr style="height: 20px;">
              <td style="color: #64748b; font-weight: 500;">Tax Jurisdiction:</td>
              <td style="color: #0f172a; font-weight: 600;">${escapeHtml(jurisdiction)}</td>
            </tr>
            <tr style="height: 20px;">
              <td style="color: #64748b; font-weight: 500;">Working Days:</td>
              <td style="color: #0f172a;">${escapeHtml(String(slip.working_days || 0))}</td>
            </tr>
            <tr style="height: 20px;">
              <td style="color: #64748b; font-weight: 500;">Paid / LOP Days:</td>
              <td style="color: #0f172a;"><span style="color: #10b981; font-weight: 600;">${escapeHtml(String(slip.paid_days || 0))} Paid</span> / <span style="color: #ef4444; font-weight: 600;">${escapeHtml(String(slip.lop_days || 0))} LOP</span></td>
            </tr>
          </table>
        </div>
      </div>

      <!-- Earnings & Deductions Tables -->
      <div style="display: flex; gap: 15px; margin-bottom: 15px;">
        <!-- Earnings -->
        <div style="flex: 1; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
          <div style="background-color: #eff6ff; padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">
            <h3 style="margin: 0; font-size: 11px; font-weight: 700; color: #1e40af; letter-spacing: 0.05em; text-transform: uppercase;">Earnings</h3>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
            ${earningsList.map(item => `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 12px; color: #475569; font-weight: 500;">${escapeHtml(item.name)}</td>
                <td style="padding: 8px 12px; text-align: right; color: #0f172a; font-weight: 600;">${escapeHtml(formatCurrency(item.amount, currency))}</td>
              </tr>
            `).join('')}
            <tr style="background-color: #f8fafc; font-weight: bold; border-top: 1px solid #e2e8f0;">
              <td style="padding: 10px 12px; color: #1e3a8a; font-weight: 700;">Total Earnings (A)</td>
              <td style="padding: 10px 12px; text-align: right; color: #1e3a8a; font-weight: 700;">${escapeHtml(formatCurrency(slip.gross_salary || 0, currency))}</td>
            </tr>
          </table>
        </div>

        <!-- Deductions -->
        <div style="flex: 1; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
          <div style="background-color: #fff1f2; padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">
            <h3 style="margin: 0; font-size: 11px; font-weight: 700; color: #9f1239; letter-spacing: 0.05em; text-transform: uppercase;">Deductions</h3>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
            ${deductionsList.length === 0 ? `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 12px; color: #94a3b8; font-style: italic;">No deductions</td>
                <td style="padding: 8px 12px; text-align: right; color: #94a3b8; font-style: italic;">${escapeHtml(formatCurrency(0, currency))}</td>
              </tr>
            ` : deductionsList.map(item => `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 12px; color: #475569; font-weight: 500;">${escapeHtml(item.name)}</td>
                <td style="padding: 8px 12px; text-align: right; color: #0f172a; font-weight: 600;">${escapeHtml(formatCurrency(item.amount, currency))}</td>
              </tr>
            `).join('')}
            <tr style="background-color: #f8fafc; font-weight: bold; border-top: 1px solid #e2e8f0;">
              <td style="padding: 10px 12px; color: #9f1239; font-weight: 700;">Total Deductions (B)</td>
              <td style="padding: 10px 12px; text-align: right; color: #9f1239; font-weight: 700;">${escapeHtml(formatCurrency(slip.total_deductions || 0, currency))}</td>
            </tr>
          </table>
        </div>
      </div>

      <!-- Summary -->
      <div style="background-color: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 6px; padding: 12px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <div>
          <h3 style="margin: 0; font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 0.05em;">Net Pay Take-Home (A - B)</h3>
          <p style="margin: 3px 0 0 0; font-size: 10px; color: #15803d; font-style: italic; font-weight: 500;">Amount in words: ${escapeHtml(amountInWords)}</p>
        </div>
        <div style="font-size: 18px; font-weight: 800; color: #166534;">
          ${escapeHtml(formatCurrency(slip.net_salary || 0, currency))}
        </div>
      </div>

      <!-- Footer -->
      <div style="border-top: 1px solid #e2e8f0; padding-top: 12px; text-align: center; font-size: 10px; color: #94a3b8; font-weight: 500;">
        <p style="margin: 0 0 2px 0;">This is a system generated payslip. No physical signature is required.</p>
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} ${escapeHtml(companyName)}. All rights reserved.</p>
      </div>
    </div>
  `;

  const opt = {
    margin: [0, 0, 0, 0] as [number, number, number, number],
    filename: `Payslip_${employeeName.replace(/\s+/g, '_')}_${periodStart}_to_${periodEnd}.pdf`,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { 
      scale: 2, 
      useCORS: true,
      windowWidth: 794 
    },
    jsPDF: { unit: 'px' as const, format: [794, 1123] as [number, number], orientation: 'portrait' as const }
  };

  const originalOverflow = document.body.style.overflow;
  let pdfBlob: Blob | null = null;
  
  pdfBlob = await enqueuePDFGeneration(async () => {
    try {
      document.body.style.overflow = 'hidden';
      
      container.style.position = 'absolute';
      container.style.top = '-9999px';
      container.style.left = '-9999px';
      container.style.visibility = 'hidden';
      document.body.appendChild(container);

      // Remove from DOM and reset styles so html2pdf can render it correctly without viewport scaling/clipping bugs.
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
      container.style.position = '';
      container.style.top = '';
      container.style.left = '';
      container.style.visibility = '';

      return await html2pdf().set(opt).from(container).output('blob');
    } finally {
      document.body.style.overflow = originalOverflow;
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    }
  });

  if (!pdfBlob) {
    throw new Error("Failed to generate PDF Blob");
  }

  // 3. Upload to secure bucket if we have a valid slip and employee/company IDs
  if (slip?.id && slip?.company_id && slip?.employee_id) {
    const fileExtension = 'pdf';
    const uniqueId = Date.now();
    const fileName = `${slip.company_id}/${slip.employee_id}/Payslip_${periodStart}_to_${periodEnd}_${uniqueId}.${fileExtension}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('payslips')
      .upload(fileName, pdfBlob, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload payslip PDF: ${uploadError.message}`);
    }

    // Update the payslip record with the path
    const { error: updateError } = await supabase
      .from('payslips')
      .update({ pdf_url: uploadData.path })
      .eq('id', slip.id);

    if (updateError) {
      console.error("Failed to update payslip with pdf_url:", updateError);
    }

    // Get signed URL to trigger download
    const { data: signedData, error: signedError } = await supabase.storage
      .from('payslips')
      .createSignedUrl(uploadData.path, 60);

    if (signedError || !signedData?.signedUrl) {
      throw new Error(`Failed to create signed URL for uploaded payslip: ${signedError?.message || 'unknown error'}`);
    }

    if (!skipDownload) {
      const a = document.createElement('a');
      a.href = signedData.signedUrl;
      a.target = '_blank';
      a.download = `Payslip_${employeeName.replace(/\s+/g, '_')}_${periodStart}_to_${periodEnd}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  } else {
    // Fallback: trigger standard browser download if no DB record matches
    if (!skipDownload) {
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Payslip_${employeeName.replace(/\s+/g, '_')}_${periodStart}_to_${periodEnd}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }
}
