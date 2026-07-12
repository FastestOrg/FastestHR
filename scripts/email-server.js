import http from 'http';
import nodemailer from 'nodemailer';

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const { smtp, to, subject, html, pdfUrl, pdfFilename } = JSON.parse(body);

        if (!smtp || !smtp.smtp_host || !smtp.smtp_user || !smtp.smtp_pass) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing SMTP configuration details. Please set them up in Company Settings > Email & SMTP.' }));
          return;
        }

        if (!to || !subject || !html) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing recipient, subject, or html body' }));
          return;
        }

        console.log(`Sending email to ${to} using SMTP Host ${smtp.smtp_host}...`);

        const transporter = nodemailer.createTransport({
          host: smtp.smtp_host,
          port: parseInt(smtp.smtp_port) || 587,
          secure: parseInt(smtp.smtp_port) === 465,
          auth: {
            user: smtp.smtp_user,
            pass: smtp.smtp_pass,
          },
          tls: {
            rejectUnauthorized: false
          }
        });

        const mailOptions = {
          from: `"${smtp.smtp_from_name || 'HR Payroll'}" <${smtp.smtp_from_email || smtp.smtp_user}>`,
          to,
          subject,
          html,
          attachments: []
        };

        if (pdfUrl) {
          console.log(`Downloading payslip PDF from: ${pdfUrl}`);
          const response = await fetch(pdfUrl);
          if (!response.ok) {
            throw new Error(`Failed to download PDF from storage: ${response.statusText}`);
          }
          const pdfBuffer = Buffer.from(await response.arrayBuffer());
          mailOptions.attachments.push({
            filename: pdfFilename || 'Payslip.pdf',
            content: pdfBuffer,
            contentType: 'application/pdf'
          });
        }

        const info = await transporter.sendMail(mailOptions);
        console.log(`Email sent successfully: ${info.messageId}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, messageId: info.messageId }));
      } catch (err) {
        console.error('SMTP sending error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message || 'Failed to send email' }));
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

const PORT = 8001;
server.listen(PORT, () => {
  console.log(`🚀 Local SMTP Mail Server running on http://localhost:${PORT}`);
});
