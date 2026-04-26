import { Injectable, Logger } from '@nestjs/common';
// pdfkit is a CJS library exposing a constructor as its default export.
// `import * as` gives you the module namespace (which isn't callable);
// `require()` returns the constructor directly. We use the require-style
// import to keep the types working regardless of `esModuleInterop`.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');
import { PassThrough } from 'stream';
import { IPayslip } from './schemas/payslip.schema';

/**
 * Generates an Indian-format payslip PDF on the fly from a Payslip document.
 *
 * Design notes:
 *
 * - **On-demand, not stored.** We stream the PDF every time the endpoint is
 *   hit instead of writing it to disk / S3. Payroll is immutable after the
 *   run is finalised, so regenerating from the Payslip document always
 *   yields the same output. This avoids the usual "where does the file
 *   live / how do we clean up" operational overhead.
 * - **pdfkit over puppeteer.** A payslip is mostly tables with monotonic
 *   fonts; we don't need a chromium runtime (~150 MB in the image) to
 *   render it. pdfkit keeps the service's container footprint unchanged.
 * - **Rupees throughout.** The Payslip document already stores amounts in
 *   rupees (confirmed during Option B). This generator displays them in
 *   Indian locale (`₹12,34,567.89`) without any further conversion.
 * - **Statutory identifiers are best-effort.** UAN / PAN / ESI / bank
 *   account live on the `employeeSnapshot` but the HR schema hasn't been
 *   extended to collect them yet (gap ARCH-next). Show dashes when null
 *   so the layout stays stable.
 */
@Injectable()
export class PayslipPdfService {
  private readonly logger = new Logger(PayslipPdfService.name);

  private static readonly MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  /**
   * Render the payslip into a `Buffer`. Controller streams the buffer to
   * the browser with the right content-type + filename headers.
   */
  async render(payslip: IPayslip): Promise<Buffer> {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      info: {
        Title: `Payslip ${this.periodLabel(payslip)}`,
        Author: payslip.organizationSnapshot?.name || 'Nexora Payroll',
        Subject: 'Monthly Payslip',
        Creator: 'Nexora HR / Payroll',
      },
    });

    const stream = new PassThrough();
    const chunks: Buffer[] = [];
    stream.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    const done = new Promise<void>((resolve, reject) => {
      stream.on('end', () => resolve());
      stream.on('error', (e) => reject(e));
    });
    doc.pipe(stream);

    this.drawHeader(doc, payslip);
    this.drawEmployeeBlock(doc, payslip);
    this.drawAmountsTables(doc, payslip);
    this.drawNetSummary(doc, payslip);
    this.drawYtdBlock(doc, payslip);
    this.drawFooter(doc);

    doc.end();
    await done;
    return Buffer.concat(chunks);
  }

  // ---- Helpers ----------------------------------------------------------

  private periodLabel(payslip: IPayslip): string {
    const m = payslip.payPeriod?.month;
    const y = payslip.payPeriod?.year;
    if (typeof m === 'number' && typeof y === 'number') {
      return `${PayslipPdfService.MONTH_NAMES[m - 1]} ${y}`;
    }
    return payslip.payPeriod?.label || '—';
  }

  filename(payslip: IPayslip): string {
    const empId = payslip.employeeSnapshot?.employeeId || String(payslip.employeeId).slice(-6);
    const period = this.periodLabel(payslip).replace(' ', '_');
    return `Payslip_${empId}_${period}.pdf`;
  }

  private formatINR(rupees: number): string {
    // Indian locale grouping (₹12,34,567.89). Payslip amounts are rupees.
    if (typeof rupees !== 'number' || isNaN(rupees)) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(rupees);
  }

  private drawHeader(doc: PDFKit.PDFDocument, payslip: IPayslip): void {
    const org = payslip.organizationSnapshot || ({} as any);
    doc
      .fillColor('#0F172A')
      .font('Helvetica-Bold')
      .fontSize(18)
      .text(org.name || 'Organization', { align: 'center' });

    if (org.address) {
      doc.font('Helvetica').fontSize(9).fillColor('#64748B').text(org.address, { align: 'center' });
    }
    const idLine: string[] = [];
    if (org.pan) idLine.push(`PAN: ${org.pan}`);
    if (org.tan) idLine.push(`TAN: ${org.tan}`);
    if (idLine.length) {
      doc.text(idLine.join('   '), { align: 'center' });
    }

    doc.moveDown(0.5);
    doc
      .fillColor('#0F172A')
      .font('Helvetica-Bold')
      .fontSize(12)
      .text(`Payslip for ${this.periodLabel(payslip)}`, { align: 'center' });

    doc
      .moveTo(40, doc.y + 4)
      .lineTo(555, doc.y + 4)
      .strokeColor('#E2E8F0')
      .lineWidth(0.5)
      .stroke();
    doc.moveDown(1);
  }

  private drawEmployeeBlock(doc: PDFKit.PDFDocument, payslip: IPayslip): void {
    const emp = payslip.employeeSnapshot || ({} as any);
    const rows: Array<[string, string, string, string]> = [
      ['Employee Name', emp.name || '—', 'Employee ID', emp.employeeId || '—'],
      ['Designation', emp.designation || '—', 'Department', emp.department || '—'],
      ['PAN', emp.pan || '—', 'UAN', emp.uan || '—'],
      ['Bank A/C', emp.bankAccount || '—', 'ESI Number', emp.esiNumber || '—'],
    ];

    const startX = 40;
    const colWidths = [90, 170, 90, 165];
    const rowHeight = 16;
    let y = doc.y;

    doc.font('Helvetica').fontSize(9).fillColor('#0F172A');
    for (const row of rows) {
      let x = startX;
      for (let i = 0; i < 4; i++) {
        if (i % 2 === 0) {
          doc.fillColor('#64748B').text(row[i], x + 4, y + 3, { width: colWidths[i] - 8 });
        } else {
          doc.fillColor('#0F172A').font('Helvetica-Bold').text(row[i], x + 4, y + 3, { width: colWidths[i] - 8 });
          doc.font('Helvetica');
        }
        x += colWidths[i];
      }
      y += rowHeight;
    }
    doc.y = y + 8;
  }

  private drawAmountsTables(doc: PDFKit.PDFDocument, payslip: IPayslip): void {
    // Two side-by-side tables: earnings (left) + deductions (right).
    const tableTop = doc.y;
    const leftX = 40;
    const rightX = 300;
    const columnWidth = 255;

    const drawTable = (x: number, title: string, items: Array<{ name: string; amount: number }>, totalLabel: string, total: number, titleColor: string) => {
      doc.font('Helvetica-Bold').fontSize(11).fillColor(titleColor).text(title, x, tableTop);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#64748B');
      const headerY = tableTop + 18;
      doc.text('Component', x + 6, headerY, { width: 150 });
      doc.text('Amount', x + 160, headerY, { width: 90, align: 'right' });

      doc
        .moveTo(x, headerY + 14)
        .lineTo(x + columnWidth, headerY + 14)
        .strokeColor('#E2E8F0')
        .lineWidth(0.5)
        .stroke();

      let rowY = headerY + 18;
      doc.font('Helvetica').fontSize(9).fillColor('#0F172A');
      if (items.length === 0) {
        doc.fillColor('#94A3B8').text('—', x + 6, rowY, { width: columnWidth - 12, align: 'center' });
        rowY += 14;
      } else {
        for (const item of items) {
          doc.fillColor('#0F172A').text(item.name || '—', x + 6, rowY, { width: 150 });
          doc.text(this.formatINR(item.amount || 0), x + 160, rowY, { width: 90, align: 'right' });
          rowY += 14;
        }
      }

      doc
        .moveTo(x, rowY + 2)
        .lineTo(x + columnWidth, rowY + 2)
        .strokeColor('#E2E8F0')
        .lineWidth(0.5)
        .stroke();
      doc.font('Helvetica-Bold').fontSize(10);
      doc.fillColor('#0F172A').text(totalLabel, x + 6, rowY + 6, { width: 150 });
      doc.text(this.formatINR(total), x + 160, rowY + 6, { width: 90, align: 'right' });
      return rowY + 24;
    };

    const leftBottom = drawTable(
      leftX,
      'Earnings',
      payslip.earnings || [],
      'Gross Earnings',
      payslip.totals?.grossEarnings ?? 0,
      '#047857',
    );
    const rightBottom = drawTable(
      rightX,
      'Deductions',
      payslip.deductions || [],
      'Total Deductions',
      payslip.totals?.totalDeductions ?? 0,
      '#B91C1C',
    );

    doc.y = Math.max(leftBottom, rightBottom) + 10;
  }

  private drawNetSummary(doc: PDFKit.PDFDocument, payslip: IPayslip): void {
    const net = payslip.totals?.netPayable ?? 0;
    const words = payslip.totals?.netPayableWords;

    doc
      .rect(40, doc.y, 515, 44)
      .fillColor('#F0FDF4')
      .strokeColor('#A7F3D0')
      .lineWidth(0.75)
      .fillAndStroke();

    doc.fillColor('#065F46').font('Helvetica-Bold').fontSize(11).text('Net Payable', 52, doc.y + 8);
    doc.fontSize(18).text(this.formatINR(net), 52, doc.y + 6, { width: 491, align: 'right' });
    if (words) {
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#047857')
        .text(`In words: ${words}`, 52, doc.y + 4, { width: 491 });
    }
    doc.y += 54;
  }

  private drawYtdBlock(doc: PDFKit.PDFDocument, payslip: IPayslip): void {
    const ytd = payslip.ytdTotals;
    if (!ytd) return;
    const hasYtd = (ytd.grossEarnings || 0) > 0 || (ytd.netPayable || 0) > 0;
    if (!hasYtd) return;

    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0F172A').text('Year-to-date', 40, doc.y);
    doc.moveDown(0.25);

    const cols: Array<[string, number]> = [
      ['Gross', ytd.grossEarnings || 0],
      ['Deductions', ytd.totalDeductions || 0],
      ['PF (total)', ytd.pfTotal || 0],
      ['ESI (total)', ytd.esiTotal || 0],
      ['TDS (total)', ytd.tdsTotal || 0],
      ['Net', ytd.netPayable || 0],
    ];
    const colWidth = 515 / cols.length;
    const startX = 40;
    const startY = doc.y;

    doc.font('Helvetica').fontSize(8);
    cols.forEach(([label], idx) => {
      doc.fillColor('#64748B').text(label, startX + idx * colWidth + 4, startY, { width: colWidth - 8 });
    });
    doc.font('Helvetica-Bold').fontSize(9);
    cols.forEach(([, value], idx) => {
      doc.fillColor('#0F172A').text(this.formatINR(value), startX + idx * colWidth + 4, startY + 12, { width: colWidth - 8 });
    });
    doc.y = startY + 30;
  }

  private drawFooter(doc: PDFKit.PDFDocument): void {
    const bottomY = 780;
    doc
      .moveTo(40, bottomY - 10)
      .lineTo(555, bottomY - 10)
      .strokeColor('#E2E8F0')
      .lineWidth(0.5)
      .stroke();
    doc
      .fillColor('#94A3B8')
      .font('Helvetica')
      .fontSize(8)
      .text(
        'This is a computer-generated payslip and does not require a signature.',
        40,
        bottomY - 4,
        { width: 515, align: 'center' },
      );
  }
}
