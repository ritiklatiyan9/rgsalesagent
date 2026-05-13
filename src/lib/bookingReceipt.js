// Booking receipt generator — renders an HMAC-signed accounting-style receipt
// PDF that scans against https://www.defencegarden.com/verify-receipt using
// the same PLT receipt type the Account Software farmer-payment module uses.
//
// Web → triggers a normal browser download.
// Capacitor → writes to Cache and opens the share sheet.

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import api from '@/lib/axios';

// ── Monochrome palette: black on white with a slate accent ──
const INK    = [15, 23, 42];     // slate-900 — primary text + header rule
const TEXT   = [30, 41, 59];     // slate-800 — body text
const MUTED  = [100, 116, 139];  // slate-500 — labels
const FAINT  = [148, 163, 184];  // slate-400 — hints, page numbers
const RULE   = [203, 213, 225];  // slate-300 — dividers
const SUBTLE = [241, 245, 249];  // slate-100 — alternating rows
const RED    = [185, 28, 28];    // for OVERDUE / FAILED only
const AMBER  = [180, 83, 9];     // for PENDING / outstanding balance

const PAGE = { w: 210, h: 297, m: 16 };
const CW = PAGE.w - PAGE.m * 2;

// ── Number formatting ──
const fmtINR = (v) =>
  Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d) => {
  if (!d) return '—';
  try {
    const date = typeof d === 'string' ? new Date(d) : d;
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
};

const fmtDateLong = (d) => {
  if (!d) return '—';
  try {
    const date = typeof d === 'string' ? new Date(d) : d;
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch { return '—'; }
};

const fmtDateTime = (d) => {
  try {
    const date = typeof d === 'string' ? new Date(d) : d;
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  } catch { return '—'; }
};

// ── Indian number-to-words (lakh / crore) ──
const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const twoDigit = (n) => {
  if (n < 20) return ONES[n];
  const t = TENS[Math.floor(n / 10)];
  const o = n % 10;
  return o ? `${t} ${ONES[o]}` : t;
};

const threeDigit = (n) => {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const head = h ? `${ONES[h]} Hundred` : '';
  if (!r) return head;
  return head ? `${head} ${twoDigit(r)}` : twoDigit(r);
};

const numberToWordsIN = (num) => {
  num = Math.floor(Math.abs(Number(num) || 0));
  if (num === 0) return 'Zero';
  const crore = Math.floor(num / 10000000);
  const lakh  = Math.floor((num % 10000000) / 100000);
  const thou  = Math.floor((num % 100000) / 1000);
  const rest  = num % 1000;
  const parts = [];
  if (crore) parts.push(`${twoDigit(crore)} Crore`);
  if (lakh)  parts.push(`${twoDigit(lakh)} Lakh`);
  if (thou)  parts.push(`${twoDigit(thou)} Thousand`);
  if (rest)  parts.push(threeDigit(rest));
  return parts.join(' ').trim();
};

const amountInWords = (amt) => {
  const rupees = Math.floor(amt);
  const paise  = Math.round((amt - rupees) * 100);
  const head = `Rupees ${numberToWordsIN(rupees)}`;
  const tail = paise > 0 ? ` and ${twoDigit(paise)} Paise` : '';
  return `${head}${tail} Only`;
};

// ── jsPDF helpers ──
const setFill = (doc, [r, g, b]) => doc.setFillColor(r, g, b);
const setText = (doc, [r, g, b]) => doc.setTextColor(r, g, b);
const setDraw = (doc, [r, g, b]) => doc.setDrawColor(r, g, b);
const rect    = (doc, x, y, w, h, color) => { setFill(doc, color); doc.rect(x, y, w, h, 'F'); };
const hLine   = (doc, x1, y, x2, color = INK, weight = 0.4) => {
  setDraw(doc, color); doc.setLineWidth(weight); doc.line(x1, y, x2, y);
};

// ── Letterhead ──────────────────────────────────────────────────────────────
const drawLetterhead = (doc) => {
  const y = PAGE.m;

  // Square slate "RG" monogram
  rect(doc, PAGE.m, y, 14, 14, INK);
  setText(doc, [255, 255, 255]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('RG', PAGE.m + 7, y + 9.5, { align: 'center' });

  // Company name + tagline
  setText(doc, INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('RiverGreen', PAGE.m + 18, y + 6.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  setText(doc, MUTED);
  doc.text('Premium Plotted Developments', PAGE.m + 18, y + 11);
  doc.setFontSize(7.5);
  doc.text('www.defencegarden.com', PAGE.m + 18, y + 14.5);

  // Heavy black rule under letterhead, then a thin slate rule below
  hLine(doc, PAGE.m, y + 18, PAGE.w - PAGE.m, INK, 0.8);
  hLine(doc, PAGE.m, y + 19.2, PAGE.w - PAGE.m, RULE, 0.2);

  return y + 24;
};

// ── Meta strip: receipt no, date, mode, plot, ref ──────────────────────────
const drawMetaStrip = (doc, y, meta) => {
  const items = [
    ['Receipt No.', meta.receiptNo, 'courier'],
    ['Receipt Date', fmtDateLong(new Date()), 'helvetica'],
    ['Payment Mode', meta.paymentMode, 'helvetica'],
    ['Status', (meta.bookingStatus || '—').toUpperCase(), 'helvetica'],
  ];

  const colW = CW / items.length;
  items.forEach(([label, value, font], i) => {
    const cx = PAGE.m + colW * i;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    setText(doc, MUTED);
    doc.text(label.toUpperCase(), cx, y, { charSpace: 1 });

    doc.setFont(font, 'bold');
    doc.setFontSize(10);
    setText(doc, INK);
    doc.text(String(value || '—'), cx, y + 5);
  });

  hLine(doc, PAGE.m, y + 9, PAGE.w - PAGE.m, RULE, 0.2);
  return y + 14;
};

// ── Section header (uppercase label with a thin rule under it) ──────────────
const sectionTitle = (doc, y, label, rightLabel = '') => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  setText(doc, INK);
  doc.text(label.toUpperCase(), PAGE.m, y, { charSpace: 1.5 });
  if (rightLabel) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    setText(doc, MUTED);
    doc.text(rightLabel, PAGE.w - PAGE.m, y, { align: 'right' });
  }
  hLine(doc, PAGE.m, y + 1.5, PAGE.w - PAGE.m, INK, 0.3);
  return y + 5;
};

// Two-column key/value row (returns the y-cursor after drawing).
const kvRow = (doc, y, label, value, colWidth = CW) => {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  setText(doc, MUTED);
  doc.text(label, PAGE.m, y);
  doc.setFont('helvetica', 'bold');
  setText(doc, TEXT);
  const lines = doc.splitTextToSize(String(value || '—'), colWidth - 50);
  doc.text(lines, PAGE.m + 50, y);
  return y + 5 * Math.max(1, lines.length);
};

// ── "Received from" + amount-in-words (the formal heart of the receipt) ────
const drawReceivedBlock = (doc, y, b, amountPaid) => {
  let cy = sectionTitle(doc, y, 'Received with thanks from');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  setText(doc, INK);
  doc.text(String(b.client_name || '—'), PAGE.m, cy + 5);

  // Phone + email on a single muted line
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  setText(doc, MUTED);
  const contact = [b.client_phone, b.client_email].filter(Boolean).join('   ·   ');
  if (contact) doc.text(contact, PAGE.m, cy + 10);

  cy += contact ? 14 : 10;

  // Amount block — words + figure on a tinted strip
  rect(doc, PAGE.m, cy, CW, 18, SUBTLE);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  setText(doc, MUTED);
  doc.text('THE SUM OF', PAGE.m + 4, cy + 5, { charSpace: 1.2 });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  setText(doc, INK);
  const wordsLines = doc.splitTextToSize(amountInWords(amountPaid), CW * 0.55 - 8);
  doc.text(wordsLines.slice(0, 2), PAGE.m + 4, cy + 11);

  // Right side — figure
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  setText(doc, MUTED);
  doc.text('IN FIGURES', PAGE.w - PAGE.m - 4, cy + 5, { align: 'right', charSpace: 1.2 });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  setText(doc, INK);
  doc.text(`Rs. ${fmtINR(amountPaid)}`, PAGE.w - PAGE.m - 4, cy + 14, { align: 'right' });

  return cy + 22;
};

// ── "Towards" — purpose of the payment (1-2 sentences) ──────────────────────
const drawTowardsBlock = (doc, y, b) => {
  let cy = sectionTitle(doc, y, 'Being payment towards');
  cy += 3;

  const plotLine = `Booking of Plot No. ${b.plot_number || '—'}` +
    (b.block ? `, Block ${b.block}` : '') +
    `, ${b.colony_name || 'RiverGreen'}.`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setText(doc, TEXT);
  const lines = doc.splitTextToSize(plotLine, CW);
  doc.text(lines, PAGE.m, cy);
  cy += lines.length * 5;

  if (b.notes) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    setText(doc, MUTED);
    const nl = doc.splitTextToSize(`Notes: ${b.notes}`, CW);
    doc.text(nl, PAGE.m, cy + 1);
    cy += nl.length * 4 + 1;
  }
  return cy + 3;
};

// ── Property details + Payment summary, side by side ───────────────────────
const drawPropertyAndSummary = (doc, y, b, totals) => {
  const colW = (CW - 8) / 2;
  const startY = sectionTitle(doc, y, 'Property details', 'Payment summary');

  // Vertical divider
  setDraw(doc, RULE);
  doc.setLineWidth(0.2);
  doc.line(PAGE.m + colW + 4, startY, PAGE.m + colW + 4, startY + 42);

  // Right column header rule (matching look)
  // (already covered by sectionTitle's full-width rule)

  // Left column: property details
  const props = [
    ['Site / Project', b.colony_name || 'RiverGreen'],
    ['Plot Number',   b.plot_number || '—'],
    ['Block',         b.block || '—'],
    ['Plot Type',     b.plot_type || '—'],
    ['Area',          b.area_sqft ? `${b.area_sqft} sqft` : '—'],
    ['Dimensions',    b.dimensions || '—'],
    ['Facing',        b.facing || '—'],
    ['Booking Date',  fmtDate(b.booking_date || b.created_at)],
  ];
  let ly = startY + 2;
  props.forEach(([k, v]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    setText(doc, MUTED);
    doc.text(k, PAGE.m, ly);
    doc.setFont('helvetica', 'bold');
    setText(doc, TEXT);
    const lines = doc.splitTextToSize(String(v), colW - 30);
    doc.text(lines, PAGE.m + 30, ly);
    ly += 5;
  });

  // Right column: payment summary
  const planLine = b.payment_type === 'INSTALLMENT'
    ? `Installment · ${b.installment_count || 1} × ${b.installment_frequency || ''}`.trim()
    : 'One-Time';
  const sums = [
    ['Total Plot Price',  `Rs. ${fmtINR(totals.totalAmt)}`,    INK],
    ['Booking Amount',    `Rs. ${fmtINR(totals.bookingAmt)}`,  TEXT],
    ['Total Paid',        `Rs. ${fmtINR(totals.paid)}`,        TEXT],
    ['Balance Due',       `Rs. ${fmtINR(totals.remaining)}`,   totals.remaining > 0 ? AMBER : INK],
    ['Payment Plan',      planLine,                            TEXT],
  ];
  let ry = startY + 2;
  const rx = PAGE.m + colW + 8;
  sums.forEach(([k, v, color]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    setText(doc, MUTED);
    doc.text(k, rx, ry);
    doc.setFont('helvetica', 'bold');
    setText(doc, color);
    doc.text(String(v), PAGE.w - PAGE.m, ry, { align: 'right' });
    ry += 5;
  });

  // Highlight the Balance Due — heavy rule above the last visible total
  hLine(doc, rx, ry - 8.5, PAGE.w - PAGE.m, INK, 0.4);

  const used = Math.max(ly, ry) - startY;
  return startY + used + 4;
};

// ── Payment ledger (autoTable) ──────────────────────────────────────────────
const drawLedger = (doc, y, payments) => {
  if (!Array.isArray(payments) || payments.length === 0) return y;

  const headerY = sectionTitle(doc, y, 'Payment ledger', `${payments.length} entries`);

  const body = payments.map((p, i) => [
    String(i + 1),
    (p.payment_type || '—') + (p.installment_number > 0 ? ` #${p.installment_number}` : ''),
    fmtDate(p.payment_date),
    fmtDate(p.due_date),
    p.payment_method || '—',
    p.transaction_id || p.upi_id || '—',
    `Rs. ${fmtINR(p.amount)}`,
    p.status || '—',
  ]);

  autoTable(doc, {
    startY: headerY + 1,
    head: [['#', 'Type', 'Paid On', 'Due', 'Method', 'Reference', 'Amount', 'Status']],
    body,
    theme: 'plain',
    styles: {
      font: 'helvetica', fontSize: 8, cellPadding: 1.8,
      lineColor: RULE, lineWidth: 0.15, textColor: TEXT, valign: 'middle',
    },
    headStyles: {
      fillColor: [255, 255, 255], textColor: INK, fontStyle: 'bold',
      fontSize: 7.5, halign: 'left', lineColor: INK, lineWidth: 0.4,
    },
    alternateRowStyles: { fillColor: SUBTLE },
    columnStyles: {
      0: { cellWidth: 7,  halign: 'center', textColor: MUTED },
      1: { cellWidth: 24, fontStyle: 'bold' },
      2: { cellWidth: 22 },
      3: { cellWidth: 22 },
      4: { cellWidth: 22 },
      5: { cellWidth: 'auto', fontSize: 7.5 },
      6: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
      7: { cellWidth: 22, fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 7) {
        const v = String(data.cell.raw).toUpperCase();
        if (v === 'COMPLETED') data.cell.styles.textColor = INK;
        else if (v === 'PENDING') data.cell.styles.textColor = AMBER;
        else if (v === 'CANCELLED' || v === 'FAILED') data.cell.styles.textColor = RED;
      }
    },
    margin: { left: PAGE.m, right: PAGE.m },
  });

  return doc.lastAutoTable.finalY + 4;
};

// ── Verification panel + signature block (side by side) ────────────────────
const drawVerificationAndSignature = async (doc, y, agentName, qrUrl) => {
  let cy = sectionTitle(doc, y, 'Verification', 'Authorized signatory');

  const colW = (CW - 8) / 2;
  const blockH = 52;

  // ── Left: QR + caption ──
  const qrSize = 44;
  const qrX = PAGE.m;
  const qrY = cy + 2;

  rect(doc, qrX, qrY, qrSize, qrSize, [255, 255, 255]);
  setDraw(doc, INK);
  doc.setLineWidth(0.4);
  doc.rect(qrX, qrY, qrSize, qrSize, 'S');

  let qrEmbedded = false;
  if (qrUrl) {
    try {
      const dataUrl = await QRCode.toDataURL(qrUrl, {
        errorCorrectionLevel: 'M',
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' },
        width: 700,
      });
      const inset = 2;
      doc.addImage(dataUrl, 'PNG', qrX + inset, qrY + inset, qrSize - inset * 2, qrSize - inset * 2);
      qrEmbedded = true;
    } catch (e) {
      console.error('[receipt] QR encode failed:', e);
    }
  }
  if (!qrEmbedded) {
    setText(doc, MUTED);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.text('QR unavailable', qrX + qrSize / 2, qrY + qrSize / 2, { align: 'center' });
  }

  // QR description (right of the QR)
  const tx = qrX + qrSize + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  setText(doc, INK);
  doc.text('Scan to verify', tx, qrY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setText(doc, TEXT);
  const desc = 'This receipt is digitally signed with HMAC-SHA256 and can be verified at:';
  const descLines = doc.splitTextToSize(desc, colW - qrSize - 8);
  doc.text(descLines, tx, qrY + 11);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  setText(doc, INK);
  doc.text('www.defencegarden.com/verify-receipt', tx, qrY + 11 + descLines.length * 4 + 2);

  // ── Right: signature block ──
  const sx = PAGE.m + colW + 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  setText(doc, MUTED);
  doc.text('For RiverGreen Sales,', sx, cy + 5);

  // Signature line — push it to roughly match the QR's vertical center.
  hLine(doc, sx, cy + 36, sx + 75, INK, 0.4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  setText(doc, INK);
  doc.text(agentName || 'Authorized Signatory', sx, cy + 41);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  setText(doc, MUTED);
  doc.text('Authorized Signatory', sx, cy + 45);

  return cy + blockH + 2;
};

// ── Footer (every page) ─────────────────────────────────────────────────────
const drawFooter = (doc, issuedAt) => {
  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);

    // Thin slate rule above footer
    hLine(doc, PAGE.m, PAGE.h - PAGE.m - 9, PAGE.w - PAGE.m, RULE, 0.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    setText(doc, MUTED);
    doc.text(
      'This is a system-generated, cryptographically signed receipt and does not require a physical signature.',
      PAGE.m, PAGE.h - PAGE.m - 5
    );
    doc.text(
      'HMAC-SHA256  ·  Tamper-evident  ·  Verifiable at www.defencegarden.com/verify-receipt',
      PAGE.m, PAGE.h - PAGE.m - 1.5
    );

    setText(doc, FAINT);
    doc.text(`Issued ${issuedAt}`, PAGE.w - PAGE.m, PAGE.h - PAGE.m - 5, { align: 'right' });
    doc.text(`Page ${i} of ${total}`, PAGE.w - PAGE.m, PAGE.h - PAGE.m - 1.5, { align: 'right' });
  }
};

// ── Public API ──────────────────────────────────────────────────────────────
export const buildBookingReceipt = async (booking, payments = [], summary = null, opts = {}) => {
  // Pull the signed token first — receipt is only valuable with a working QR.
  let token = '';
  let verifyUrl = '';
  let receiptNo = `PLT_RG_${String(booking.id || '').replace(/-/g, '').slice(0, 8).toUpperCase()}`;

  try {
    const { data } = await api.get(`/bookings/${booking.id}/receipt-token`);
    if (!data?.success || !data.token || !data.verifyUrl) throw new Error('Backend returned no token');
    token = data.token;
    verifyUrl = data.verifyUrl;
    receiptNo = data.receiptNo || receiptNo;
  } catch (err) {
    const status = err?.response?.status;
    if (status === 404) throw new Error('Verification endpoint not found. Restart the backend so /receipt-token registers.');
    if (status === 403) throw new Error('You do not have access to this booking.');
    throw new Error(err?.response?.data?.message || err?.message || 'Could not fetch verification token');
  }

  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

  const totalAmt   = Number(booking.total_amount || 0);
  const paid       = Number((summary && summary.total_paid) || booking.total_paid || 0);
  const bookingAmt = Number(booking.booking_amount || 0);
  const remaining  = Math.max(0, totalAmt - paid);

  const completed = (payments || [])
    .filter((p) => String(p.status).toUpperCase() === 'COMPLETED')
    .sort((a, b) => new Date(b.payment_date || b.created_at) - new Date(a.payment_date || a.created_at));
  const latest = completed[0];

  const meta = {
    receiptNo,
    paymentMode: (latest?.payment_method || booking.payment_type || 'CASH').toUpperCase(),
    bookingStatus: booking.status,
  };
  const totals = { totalAmt, paid, remaining, bookingAmt };
  const issuedAt = fmtDateTime(new Date());

  // Render
  let cy = drawLetterhead(doc);
  cy = drawMetaStrip(doc, cy, meta);
  cy = drawReceivedBlock(doc, cy, booking, paid);
  cy = drawTowardsBlock(doc, cy, booking);
  cy = drawPropertyAndSummary(doc, cy, booking, totals);
  cy = drawLedger(doc, cy, payments);
  cy = await drawVerificationAndSignature(doc, cy, opts.agentName, verifyUrl);

  drawFooter(doc, issuedAt);

  return { doc, receiptNo, verifyUrl, token };
};

const arrayBufferToBase64 = (buf) => {
  let binary = '';
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
};

export const downloadBookingReceipt = async (booking, payments = [], summary = null, opts = {}) => {
  const { doc, receiptNo } = await buildBookingReceipt(booking, payments, summary, opts);
  const fileName = `RiverGreen-${receiptNo}.pdf`.replace(/\s+/g, '_');

  if (Capacitor.isNativePlatform?.()) {
    const base64 = arrayBufferToBase64(doc.output('arraybuffer'));
    const written = await Filesystem.writeFile({
      path: fileName, data: base64, directory: Directory.Cache, recursive: true,
    });
    try {
      await Share.share({
        title: 'Booking Receipt',
        text: `Receipt ${receiptNo} — ${booking.client_name}`,
        url: written.uri,
        dialogTitle: 'Share receipt',
      });
    } catch { /* user cancelled — file remains in cache */ }
    return { fileName, uri: written.uri, receiptNo };
  }

  doc.save(fileName);
  return { fileName, receiptNo };
};
