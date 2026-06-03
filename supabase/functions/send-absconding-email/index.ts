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

    const { employee_id, company_id, consecutive_days } = await req.json();

    if (!employee_id || !company_id) {
      throw new Error('Missing required employee_id or company_id');
    }

    // 1. Fetch company details (SMTP details and attendance_settings)
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

    // 2. Fetch employee details (work_email, first_name, last_name)
    const { data: employee, error: employeeError } = await supabaseClient
      .from('employees')
      .select('first_name, last_name, work_email, personal_email')
      .eq('id', employee_id)
      .single();

    if (employeeError || !employee) {
      throw new Error('Employee not found');
    }

    const recipientEmail = employee.work_email || employee.personal_email;
    if (!recipientEmail) {
      throw new Error('Employee has no email address configured');
    }

    const employeeName = `${employee.first_name} ${employee.last_name}`.trim();
    const settings = company.attendance_settings as any;
    
    // 3. Prepare email body
    const defaultTemplate = "Dear {{employee_name}},\n\nYou have been absent from work or on leave for {{consecutive_days}} consecutive days without any official communication. Please contact the HR department immediately.\n\nBest regards,\n{{company_name}}";
    const template = settings?.absconding_email_template || defaultTemplate;
    
    const emailBody = template
      .replace(/\{\{employee_name\}\}/gi, employeeName)
      .replace(/\{\{consecutive_days\}\}/gi, String(consecutive_days || settings?.absconding_consecutive_leaves || 5))
      .replace(/\{\{company_name\}\}/gi, company.name);

    // Convert newlines to HTML paragraphs/breaks
    const emailHtml = emailBody
      .split('\n')
      .map((line: string) => line.trim() === '' ? '<br/>' : `<p style="margin:0 0 8px 0">${line}</p>`)
      .join('\n');

    // 4. Configure transport & Send Email
    const transporter = nodemailer.createTransport({
      host: company.smtp_host,
      port: parseInt(company.smtp_port),
      secure: parseInt(company.smtp_port) === 465,
      auth: {
        user: company.smtp_user,
        pass: company.smtp_pass,
      },
    });

    const info = await transporter.sendMail({
      from: `"${company.smtp_from_name || 'HR Department'}" <${company.smtp_from_email || company.smtp_user}>`,
      to: recipientEmail,
      subject: `Absconding Notification - ${company.name}`,
      html: `
        <div style="font-family: sans-serif; line-height: 1.6; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
          <div style="margin-bottom: 20px; border-bottom: 2px solid #ef4444; padding-bottom: 10px;">
            <h2 style="color: #ef4444; margin: 0;">Urgent Notice</h2>
          </div>
          ${emailHtml}
        </div>
      `,
    });

    return new Response(JSON.stringify({ success: true, messageId: info.messageId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('Absconding Email Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
