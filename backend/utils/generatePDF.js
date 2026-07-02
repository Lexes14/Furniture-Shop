const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const BRAND_COLOR = '#7c4a2d';
const BRAND_DARK = '#5d341e';
const TEXT_COLOR = '#1f2937';
const MUTED_COLOR = '#6b7280';
const LINE_COLOR = '#e5d9c8';
const TABLE_HEADER_BG = '#f5efe6';
const TABLE_ALT_ROW_BG = '#faf7f2';

function formatCurrency(value) {
  const number = Number(value || 0);
  return `PHP ${number.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function drawHeader(doc, title) {
  const pageWidth = doc.page.width;

  doc.rect(0, 0, pageWidth, 90).fill(BRAND_COLOR);

  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(20)
    .text('Furniture Shop', 50, 30);

  doc
    .fillColor('#f2e8db')
    .font('Helvetica')
    .fontSize(10)
    .text('Quality furniture, delivered with care', 50, 55);

  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(14)
    .text(title || 'Receipt', 0, 35, { align: 'right', width: pageWidth - 50 });

  doc.fillColor(TEXT_COLOR);
  doc.y = 112;
}

function drawDetails(doc, details) {
  if (!details.length) {
    return;
  }

  details.forEach((row) => {
    doc
      .font('Helvetica-Bold')
      .fillColor(MUTED_COLOR)
      .fontSize(9)
      .text(String(row.label || '').toUpperCase(), 50, doc.y);

    doc
      .font('Helvetica')
      .fillColor(TEXT_COLOR)
      .fontSize(11)
      .text(String(row.value ?? 'N/A'), 50, doc.y + 2);

    doc.moveDown(0.7);
  });

  doc.moveDown(0.3);
  doc
    .moveTo(50, doc.y)
    .lineTo(doc.page.width - 50, doc.y)
    .strokeColor(LINE_COLOR)
    .lineWidth(1)
    .stroke();
  doc.moveDown(0.8);
}

function drawItemsTable(doc, items) {
  if (!items || !items.length) {
    return;
  }

  const left = 50;
  const right = doc.page.width - 50;
  const colName = left;
  const colQty = right - 220;
  const colPrice = right - 150;
  const colSubtotal = right - 70;
  const rowHeight = 24;

  doc.font('Helvetica-Bold').fontSize(11).fillColor(BRAND_DARK).text('Order Items', left, doc.y);
  doc.moveDown(0.4);

  // Header row
  doc.rect(left, doc.y, right - left, rowHeight).fill(TABLE_HEADER_BG);
  const headerY = doc.y + 8;
  doc.fillColor(BRAND_DARK).font('Helvetica-Bold').fontSize(9);
  doc.text('ITEM', colName + 8, headerY);
  doc.text('QTY', colQty, headerY, { width: 40, align: 'right' });
  doc.text('PRICE', colPrice, headerY, { width: 70, align: 'right' });
  doc.text('SUBTOTAL', colSubtotal, headerY, { width: 70, align: 'right' });

  doc.y += rowHeight;

  items.forEach((item, index) => {
    const rowY = doc.y;

    if (index % 2 === 1) {
      doc.rect(left, rowY, right - left, rowHeight).fill(TABLE_ALT_ROW_BG);
    }

    const textY = rowY + 8;
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(TEXT_COLOR)
      .text(item.name, colName + 8, textY, { width: colQty - colName - 16 });
    doc.text(String(item.quantity), colQty, textY, { width: 40, align: 'right' });
    doc.text(formatCurrency(item.price), colPrice, textY, { width: 70, align: 'right' });
    doc.text(formatCurrency(item.subtotal), colSubtotal, textY, { width: 70, align: 'right' });

    doc.y = rowY + rowHeight;
  });

  doc
    .moveTo(left, doc.y)
    .lineTo(right, doc.y)
    .strokeColor(LINE_COLOR)
    .lineWidth(1)
    .stroke();

  doc.moveDown(1);
}

function drawSummary(doc, summary) {
  if (!summary.length) {
    return;
  }

  const right = doc.page.width - 50;
  const boxWidth = 220;
  const boxLeft = right - boxWidth;
  const valueWidth = 90;

  summary.forEach((row, index) => {
    const isLast = index === summary.length - 1;

    if (isLast) {
      doc
        .moveTo(boxLeft, doc.y)
        .lineTo(right, doc.y)
        .strokeColor(LINE_COLOR)
        .lineWidth(1)
        .stroke();
      doc.moveDown(0.4);
    }

    const rowY = doc.y;
    const fontSize = isLast ? 12 : 10;
    const color = isLast ? BRAND_DARK : TEXT_COLOR;

    doc
      .font(isLast ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(fontSize)
      .fillColor(color)
      .text(row.label, boxLeft, rowY, { width: boxWidth - valueWidth });

    doc
      .font(isLast ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(fontSize)
      .fillColor(color)
      .text(row.value, boxLeft + boxWidth - valueWidth, rowY, { width: valueWidth, align: 'right' });

    doc.y = rowY + (isLast ? 20 : 16);
  });
}

function drawFooter(doc) {
  const bottom = doc.page.height - 60;

  doc
    .moveTo(50, bottom)
    .lineTo(doc.page.width - 50, bottom)
    .strokeColor(LINE_COLOR)
    .lineWidth(1)
    .stroke();

  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(MUTED_COLOR)
    .text('Thank you for shopping with Furniture Shop.', 50, bottom + 8, { align: 'center', width: doc.page.width - 100 });

  doc.text(
    `Generated on ${new Date().toLocaleString('en-PH')}`,
    50,
    bottom + 20,
    { align: 'center', width: doc.page.width - 100 }
  );
}

async function generateReceiptPDF({ filePath, title, details = [], items = null, summary = [] }) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    drawHeader(doc, title);
    drawDetails(doc, details);
    drawItemsTable(doc, items);
    drawSummary(doc, summary);
    drawFooter(doc);

    doc.end();

    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
}

module.exports = {
  generateReceiptPDF,
};