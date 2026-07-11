import { Buffer } from "node:buffer";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import * as nodemailer from "npm:nodemailer@6.9.8";

// Polyfill Buffer for nodemailer running in Deno
(globalThis as any).Buffer = Buffer;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { payslip_id, company_id, employee_id, pdf_path } = await req.json();

    if (!payslip_id || !company_id || !employee_id || !pdf_path) {
      throw new Error('Missing required fields (payslip_id, company_id, employee_id, pdf_path)');
    }

    // 1. Fetch company SMTP details
    const { data: company, error: companyError } = await supabaseClient
      .from('companies')
      .select('*')
      .eq('id', company_id)
      .single();

    if (companyError || !company) {
      throw new Error(`Company not found: ${companyError?.message}`);
    }

    if (!company.smtp_host || !company.smtp_user || !company.smtp_pass) {
      throw new Error(`SMTP is not configured for this company. Please set it up in Company Settings.`);
    }

    // 2. Fetch employee details
    const { data: employee, error: employeeError } = await supabaseClient
      .from('employees')
      .select('first_name, last_name, work_email, personal_email')
      .eq('id', employee_id)
      .single();

    if (employeeError || !employee) {
      throw new Error(`Employee not found: ${employeeError?.message}`);
    }

    const recipientEmail = employee.work_email || employee.personal_email;
    if (!recipientEmail) {
      throw new Error('Employee has no email address configured');
    }

    const employeeName = `${employee.first_name} ${employee.last_name}`.trim();

    // 3. Fetch payslip details for period info
    const { data: payslip, error: payslipError } = await supabaseClient
      .from('payslips')
      .select('*, payroll_runs(period_start, period_end)')
      .eq('id', payslip_id)
      .single();

    if (payslipError || !payslip) {
      throw new Error(`Payslip not found: ${payslipError?.message}`);
    }

    const periodStart = payslip.payroll_runs?.period_start || '';
    const periodEnd = payslip.payroll_runs?.period_end || '';

    // 4. Download PDF from Storage to attach
    console.log(`Downloading PDF from payslips bucket: ${pdf_path}`);
    const { data: pdfBlob, error: downloadError } = await supabaseClient
      .storage
      .from('payslips')
      .download(pdf_path);

    if (downloadError || !pdfBlob) {
      throw new Error(`Failed to download PDF attachment: ${downloadError?.message}`);
    }
    const pdfBuffer = await pdfBlob.arrayBuffer();

    // 5. Configure transport & Send Email
    const transporter = nodemailer.createTransport({
      host: company.smtp_host,
      port: parseInt(company.smtp_port) || 587,
      secure: parseInt(company.smtp_port) === 465,
      auth: {
        user: company.smtp_user,
        pass: company.smtp_pass,
      },
    });

    const info = await transporter.sendMail({
      from: `"${company.smtp_from_name || 'HR Payroll'}" <${company.smtp_from_email || company.smtp_user}>`,
      to: recipientEmail,
      subject: `Official Payslip: ${periodStart} to ${periodEnd} - ${company.name}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; padding: 24px; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #0f172a;">
          <div style="margin-bottom: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px;">
            <h2 style="color: #0f172a; margin: 0; font-size: 20px; font-weight: 700;">${company.name}</h2>
            <p style="color: #64748b; margin: 4px 0 0 0; font-size: 12px; font-weight: 500;">Official Payslip Notification</p>
          </div>
          
          <p style="margin: 0 0 16px 0; font-size: 14px;">Dear <strong>${employeeName}</strong>,</p>
          
          <p style="margin: 0 0 16px 0; font-size: 14px; color: #334155;">
            Your payslip for the payroll cycle starting <strong>${periodStart}</strong> and ending <strong>${periodEnd}</strong> has been generated and is now available.
          </p>

          <div style="margin: 24px 0; padding: 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="padding: 4px 0; color: #64748b;">Gross Salary:</td>
                <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #0f172a;">${(company.currency || 'USD') === 'INR' ? '₹' : '$'}${payslip.gross_salary}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #64748b;">Total Deductions:</td>
                <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #ef4444;">${(company.currency || 'USD') === 'INR' ? '₹' : '$'}${payslip.total_deductions}</td>
              </tr>
              <tr style="border-top: 1px solid #e2e8f0;">
                <td style="padding: 8px 0 0 0; color: #0f172a; font-weight: 700; font-size: 14px;">Net Salary Payout:</td>
                <td style="padding: 8px 0 0 0; text-align: right; font-weight: 700; color: #10b981; font-size: 14px;">${(company.currency || 'USD') === 'INR' ? '₹' : '$'}${payslip.net_salary}</td>
              </tr>
            </table>
          </div>

          <p style="margin: 0 0 16px 0; font-size: 14px; color: #334155;">
            We have attached the official PDF copy of your payslip to this email for your records. 
            You can also view, audit, and download all your past payslips at any time in the <strong>Employee Portal</strong>.
          </p>

          <div style="margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 11px; color: #94a3b8; text-align: center;">
            <p style="margin: 0;">This is an automated system email. Please do not reply directly to this message.</p>
            <p style="margin: 4px 0 0 0;">&copy; ${new Date().getFullYear()} ${company.name}. All rights reserved.</p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `Payslip_${employeeName.replace(/\s+/g, '_')}_${periodStart}_to_${periodEnd}.pdf`,
          content: Buffer.from(pdfBuffer),
          contentType: 'application/pdf'
        }
      ]
    });

    return new Response(JSON.stringify({ success: true, messageId: info.messageId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('Payslip Email Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
