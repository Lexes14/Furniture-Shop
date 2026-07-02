const nodemailer = require('nodemailer');

function isEmailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined,
  });
}

async function sendMail({ to, subject, text, html, attachments = [] }) {
  if (!isEmailConfigured()) {
    return {
      skipped: true,
      reason: 'SMTP is not configured',
    };
  }

  const transporter = getTransporter();
  return transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
    attachments,
  });
}

function formatCurrency(value) {
  const number = Number(value || 0);
  return `₱${number.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function emailShell(bodyHtml) {
  return `
    <div style="background:#f5efe6; padding: 32px 16px; font-family: Arial, sans-serif;">
      <div style="max-width: 560px; margin: 0 auto; background:#fffaf3; border-radius: 16px; overflow: hidden; border: 1px solid rgba(124,74,45,0.14);">
        <div style="background: linear-gradient(135deg, #7c4a2d 0%, #5d341e 100%); padding: 24px 28px;">
          <div style="color:#ffffff; font-size: 18px; font-weight: bold; letter-spacing: 0.04em; text-transform: uppercase;">Furniture Shop</div>
          <div style="color:#f2e8db; font-size: 12px; margin-top: 4px;">Quality furniture, delivered with care</div>
        </div>
        <div style="padding: 28px;">
          ${bodyHtml}
        </div>
        <div style="padding: 16px 28px; border-top: 1px solid rgba(124,74,45,0.1); color:#9a8f83; font-size: 11px; text-align:center;">
          This is an automated message from Furniture Shop. Please do not reply directly to this email.
        </div>
      </div>
    </div>
  `;
}

// Generic status notification (no itemized order data) — used for simple
// updates like refunds or reservation status where a full receipt table
// isn't necessary.
async function sendStatusEmail({ to, title, message, attachments = [] }) {
  const subject = `Furniture Shop - ${title}`;
  const text = `${title}\n\n${message}`;

  const bodyHtml = `
    <h2 style="margin: 0 0 12px; color:#1f2937; font-size: 20px;">${title}</h2>
    <p style="margin: 0 0 4px; color:#374151; font-size: 14px; line-height: 1.6;">${message}</p>
  `;

  return sendMail({ to, subject, text, html: emailShell(bodyHtml), attachments });
}

function buildOrderTableHtml(order) {
  const items = order.items || [];

  const rows = items.map((item) => `
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #f0e6d8; color:#1f2937; font-size:13px;">${item.name}</td>
      <td style="padding: 8px 0; border-bottom: 1px solid #f0e6d8; color:#1f2937; font-size:13px; text-align:center;">${item.quantity}</td>
      <td style="padding: 8px 0; border-bottom: 1px solid #f0e6d8; color:#1f2937; font-size:13px; text-align:right;">${formatCurrency(item.price)}</td>
      <td style="padding: 8px 0; border-bottom: 1px solid #f0e6d8; color:#1f2937; font-size:13px; text-align:right;">${formatCurrency(item.subtotal)}</td>
    </tr>
  `).join('');

  return `
    <table style="width:100%; border-collapse: collapse; margin-top: 16px;">
      <thead>
        <tr>
          <th style="text-align:left; padding: 6px 0; border-bottom: 2px solid #7c4a2d; color:#5d341e; font-size:11px; text-transform:uppercase; letter-spacing:0.04em;">Item</th>
          <th style="text-align:center; padding: 6px 0; border-bottom: 2px solid #7c4a2d; color:#5d341e; font-size:11px; text-transform:uppercase; letter-spacing:0.04em;">Qty</th>
          <th style="text-align:right; padding: 6px 0; border-bottom: 2px solid #7c4a2d; color:#5d341e; font-size:11px; text-transform:uppercase; letter-spacing:0.04em;">Price</th>
          <th style="text-align:right; padding: 6px 0; border-bottom: 2px solid #7c4a2d; color:#5d341e; font-size:11px; text-transform:uppercase; letter-spacing:0.04em;">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
    <table style="width:100%; margin-top: 14px;">
      <tr>
        <td style="padding: 3px 0; color:#6b7280; font-size:13px;">Subtotal</td>
        <td style="padding: 3px 0; color:#1f2937; font-size:13px; text-align:right;">${formatCurrency(order.subtotal)}</td>
      </tr>
      <tr>
        <td style="padding: 3px 0; color:#6b7280; font-size:13px;">Shipping Fee</td>
        <td style="padding: 3px 0; color:#1f2937; font-size:13px; text-align:right;">${formatCurrency(order.shippingFee)}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0 0; color:#5d341e; font-size:15px; font-weight:bold; border-top: 1px solid #e5d9c8;">Grand Total</td>
        <td style="padding: 8px 0 0; color:#5d341e; font-size:15px; font-weight:bold; text-align:right; border-top: 1px solid #e5d9c8;">${formatCurrency(order.grandTotal)}</td>
      </tr>
    </table>
  `;
}

// Renders the actual order contents (items, quantities, prices, totals)
// directly inside the email body — used for order/payment status
// notifications so the recipient sees a real receipt in their inbox, not
// just a one-line status update with a PDF attached.
async function sendOrderReceiptEmail({ to, title, message, order, attachments = [] }) {
  const safeOrder = order || {};
  const subject = `Furniture Shop - ${title}${safeOrder.orderNumber ? ` (${safeOrder.orderNumber})` : ''}`;
  const text = `${title}\n\n${message}\n\nOrder Number: ${safeOrder.orderNumber || 'N/A'}\nGrand Total: ${formatCurrency(safeOrder.grandTotal)}`;

  const bodyHtml = `
    <h2 style="margin: 0 0 8px; color:#1f2937; font-size: 20px;">${title}</h2>
    <p style="margin: 0 0 4px; color:#374151; font-size: 14px; line-height: 1.6;">${message}</p>

    <div style="margin-top: 18px; padding: 14px 16px; background:#f5efe6; border-radius: 10px;">
      <div style="color:#6b7280; font-size:11px; text-transform:uppercase; letter-spacing:0.05em;">Order Number</div>
      <div style="color:#5d341e; font-size:15px; font-weight:bold;">${safeOrder.orderNumber || 'N/A'}</div>
    </div>

    <table style="width:100%; margin-top: 14px;">
      <tr>
        <td style="padding: 3px 0; color:#6b7280; font-size:12px; width:50%;">Payment Method</td>
        <td style="padding: 3px 0; color:#1f2937; font-size:12px; text-align:right;">${safeOrder.paymentMethod || 'N/A'}</td>
      </tr>
      <tr>
        <td style="padding: 3px 0; color:#6b7280; font-size:12px;">Shipping Address</td>
        <td style="padding: 3px 0; color:#1f2937; font-size:12px; text-align:right;">${safeOrder.shippingAddress || 'N/A'}</td>
      </tr>
    </table>

    ${buildOrderTableHtml(safeOrder)}
  `;

  return sendMail({ to, subject, text, html: emailShell(bodyHtml), attachments });
}

module.exports = {
  sendMail,
  sendStatusEmail,
  sendOrderReceiptEmail,
  isEmailConfigured,
};