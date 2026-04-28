import { Injectable, Logger } from '@nestjs/common';
// See payslip-pdf.service.ts for why we use require() instead of
// `import * as` for pdfkit (CJS default-export surface).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');
import { PassThrough } from 'stream';
import { IStatutoryReport } from './schemas/statutory-report.schema';

/**
 * Renders a two-page Form 16 PDF from a saved `StatutoryReport` document
 * (reportType: "form_16").
 *
 * The report's `data` field already contains the fully-computed partA
 * (employer + employee identification + TDS summary) and partB (salary
 * breakup + exemptions + Chapter VI-A + tax computation), so this
 * generator is purely presentational — no recompute.
 *
 * Layout decisions:
 *
 * - **Two pages, fixed format.** Part A is the TRACES-style certificate
 *   header; Part B is the employer-prepared salary breakup. Splitting
 *   them keeps each page self-contained for printing / stamping.
 * - **Plain tables, no colours on Part A.** Form 16 is a government
 *   certificate — we stay close to the official IT-Dept template format
 *   rather than applying our brand styling, which makes the document
 *   more recognisable to tax officers and bank loan officers who've
 *   seen thousands of these.
 * - **Rupees throughout** — report.data amounts are already in rupees
 *   (same unit as the rest of payroll). `formatINR` matches the payslip
 *   generator's Indian-locale format.
 * - **"—" for null fields.** If an org hasn't saved /settings/business,
 *   PAN/TAN come back null. Showing "—" instead of "null" keeps the
 *   template valid for proofreading even before full data entry.
 */
@Injectable()
export class Form16PdfService {
  private readonly logger = new Logger(Form16PdfService.name);

  async render(report: IStatutoryReport): Promise<Buffer> {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      info: {
        Title: `Form 16 — FY ${report.financialYear || ''}`,
        Author: (report as any).data?.partA?.employerName || 'Nexora Payroll',
        Subject: 'Form 16 (Section 203 of Income Tax Act)',
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

    const data: any = (report as any).data || {};
    this.drawPartA(doc, report, data.partA || {});
    doc.addPage();
    this.drawPartB(doc, data.partB || {});

    doc.end();
    await done;
    return Buffer.concat(chunks);
  }

  filename(report: IStatutoryReport): string {
    const fy = report.financialYear || 'unknown';
    const emp = (report as any).data?.partA?.employeePAN
      || (report as any).data?.partA?.employeeName
      || report.employeeId
      || 'employee';
    const safe = String(emp).replace(/[^A-Za-z0-9_-]/g, '_');
    return `Form16_${safe}_FY${fy.replace('/', '-')}.pdf`;
  }

  // ---------- helpers ----------

  private formatINR(rupees: number | undefined | null): string {
    if (typeof rupees !== 'number' || isNaN(rupees)) return '\u20B90.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(rupees);
  }

  private dash(v: any): string {
    if (v === null || v === undefined || v === '') return '—';
    return String(v);
  }

  private drawPartA(doc: PDFKit.PDFDocument, report: IStatutoryReport, partA: any): void {
    doc
      .fillColor('#0F172A')
      .font('Helvetica-Bold')
      .fontSize(14)
      .text('FORM 16', { align: 'center' });
    doc.font('Helvetica').fontSize(9).fillColor('#64748B').text(
      '[See rule 31(1)(a)]',
      { align: 'center' },
    );
    doc.text('Certificate under section 203 of the Income-tax Act, 1961', { align: 'center' });
    doc.text('for tax deducted at source on salary', { align: 'center' });

    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0F172A').text('PART A', { align: 'center' });
    doc.font('Helvetica').fontSize(8).fillColor('#64748B').text(
      'Certificate of deduction of tax at source under section 203 of the Income-tax Act, 1961',
      { align: 'center' },
    );

    doc
      .moveTo(40, doc.y + 6)
      .lineTo(555, doc.y + 6)
      .strokeColor('#0F172A')
      .lineWidth(0.75)
      .stroke();
    doc.moveDown(1);

    // Period / AY / FY bar
    const periodY = doc.y;
    this.twoColBox(doc, 40, periodY, 257, 'Financial Year', this.dash(partA.financialYear));
    this.twoColBox(doc, 298, periodY, 257, 'Assessment Year', this.dash(partA.assessmentYear));
    doc.y = periodY + 36;

    // Employer box
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#0F172A').text('Name and address of the Employer', 40, doc.y);
    doc.moveDown(0.25);
    this.boxedBlock(doc, [
      ['Name', this.dash(partA.employerName)],
      ['Address', this.dash(partA.employerAddress)],
      ['PAN of the Deductor', this.dash(partA.employerPAN)],
      ['TAN of the Deductor', this.dash(partA.employerTAN)],
    ]);

    doc.moveDown(0.5);

    // Employee box
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#0F172A').text('Name and address of the Employee', 40, doc.y);
    doc.moveDown(0.25);
    this.boxedBlock(doc, [
      ['Name', this.dash(partA.employeeName)],
      ['PAN of the Employee', this.dash(partA.employeePAN)],
      ['Designation', this.dash(partA.employeeDesignation)],
      [
        'Period of employment',
        partA.periodFrom && partA.periodTo
          ? `${new Date(partA.periodFrom).toLocaleDateString('en-IN')} to ${new Date(partA.periodTo).toLocaleDateString('en-IN')}`
          : '—',
      ],
    ]);

    doc.moveDown(1);

    // Summary of salary paid and TDS
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0F172A').text('Summary of salary paid and tax deducted', 40, doc.y);
    doc.moveDown(0.25);

    const summary: Array<[string, string]> = [
      ['Total amount paid / credited (salary)', this.formatINR(partA.totalSalaryPaid || 0)],
      ['Total tax deducted at source (TDS)', this.formatINR(partA.totalTDSDeducted || 0)],
      ['Total tax deposited to Central Govt account', this.formatINR(partA.totalTDSDeducted || 0)],
    ];
    this.boxedBlock(doc, summary);

    // Note at the bottom of page 1
    doc.moveDown(1.5);
    doc
      .fillColor('#64748B')
      .font('Helvetica-Oblique')
      .fontSize(8)
      .text(
        'This certificate is issued under Section 203 of the Income-tax Act, 1961. ' +
          'The quarterly TDS statement details (Form 24Q) must be cross-referenced against TRACES for verification.',
        40,
        doc.y,
        { width: 515, align: 'justify' },
      );
  }

  private drawPartB(doc: PDFKit.PDFDocument, partB: any): void {
    doc
      .fillColor('#0F172A')
      .font('Helvetica-Bold')
      .fontSize(11)
      .text('PART B (Annexure)', { align: 'center' });
    doc.font('Helvetica').fontSize(8).fillColor('#64748B').text(
      'Details of Salary Paid and any other income and tax deducted',
      { align: 'center' },
    );

    doc
      .moveTo(40, doc.y + 6)
      .lineTo(555, doc.y + 6)
      .strokeColor('#0F172A')
      .lineWidth(0.75)
      .stroke();
    doc.moveDown(1);

    // 1. Gross salary
    const s = partB.salaryBreakdown || {};
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0F172A').text('1. Gross Salary', 40, doc.y);
    doc.moveDown(0.25);
    this.labeledAmounts(doc, [
      ['(a) Salary as per provisions contained in section 17(1) — Basic', this.formatINR(s.basic || 0)],
      ['(b) House Rent Allowance', this.formatINR(s.hra || 0)],
      ['(c) Other allowances and perquisites', this.formatINR(s.otherAllowances || 0)],
      ['Total Gross Salary', this.formatINR(s.grossSalary || 0)],
    ]);
    doc.moveDown(0.5);

    // 2. Less: Exemptions / deductions u/s 10 + 16
    const ex = partB.exemptions || {};
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0F172A').text('2. Less: Deductions under section 16', 40, doc.y);
    doc.moveDown(0.25);
    this.labeledAmounts(doc, [
      ['(a) Standard deduction under section 16(ia)', this.formatINR(ex.standardDeduction || 0)],
      ['(b) Tax on employment / Professional Tax', this.formatINR(ex.professionalTax || 0)],
      ['(c) Interest on self-occupied housing loan u/s 24(b)', this.formatINR(ex.housingLoanInterest || 0)],
    ]);
    doc.moveDown(0.5);

    // 3. Chapter VI-A deductions
    const ch = partB.chapterVIADeductions || {};
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0F172A').text('3. Deductions under Chapter VI-A', 40, doc.y);
    doc.moveDown(0.25);
    const regimeNote = partB.regime === 'new'
      ? '(Most Chapter VI-A deductions are not allowed under the new regime.)'
      : '';
    if (regimeNote) {
      doc.font('Helvetica-Oblique').fontSize(8).fillColor('#64748B').text(regimeNote, 40, doc.y, { width: 515 });
      doc.moveDown(0.25);
    }
    this.labeledAmounts(doc, [
      ['Section 80C — Life Insurance, PF, ELSS, etc. (limit \u20B91.5L)', this.formatINR(ch.section80C || 0)],
      ['Section 80D — Medical insurance premium', this.formatINR(ch.section80D || 0)],
      ['Section 80E — Interest on education loan', this.formatINR(ch.section80E || 0)],
      ['Section 80G — Donations to approved funds', this.formatINR(ch.section80G || 0)],
      ['Total Chapter VI-A deductions', this.formatINR(ch.total || 0)],
    ]);
    doc.moveDown(0.5);

    // 4. Tax summary
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0F172A').text('4. Income & Tax Computation', 40, doc.y);
    doc.moveDown(0.25);
    const stat = partB.statutoryContributions || {};
    this.labeledAmounts(doc, [
      ['Tax Regime', (partB.regime === 'new' ? 'New (Section 115BAC)' : 'Old') as any],
      ['Gross Total Income (after section 16)', this.formatINR(partB.grossTotalIncome || 0)],
      ['Taxable Income (after Chapter VI-A)', this.formatINR(partB.taxableIncome || 0)],
      ['Employee PF contribution (informational)', this.formatINR(stat.pfEmployee || 0)],
      ['Employee ESI contribution (informational)', this.formatINR(stat.esiEmployee || 0)],
    ]);

    // Net tax box (highlighted)
    doc.moveDown(0.75);
    const boxY = doc.y;
    doc
      .rect(40, boxY, 515, 40)
      .fillColor('#F0FDF4')
      .strokeColor('#A7F3D0')
      .lineWidth(0.75)
      .fillAndStroke();
    doc
      .fillColor('#065F46')
      .font('Helvetica-Bold')
      .fontSize(10)
      .text('Total Tax Deducted at Source (TDS) for the year', 52, boxY + 8);
    doc
      .fontSize(16)
      .text(this.formatINR(partB.taxComputed || 0), 52, boxY + 6, { width: 491, align: 'right' });
    doc.y = boxY + 50;

    doc.moveDown(1.5);
    doc
      .fillColor('#64748B')
      .font('Helvetica-Oblique')
      .fontSize(8)
      .text(
        'Verification: I, [Authorised Signatory], working in the capacity of Employer, do hereby certify that ' +
          'the information given above is true, complete and correct and is based on the books of account, ' +
          'documents, TDS statements and other available records.',
        40,
        doc.y,
        { width: 515, align: 'justify' },
      );

    // Signature block
    doc.moveDown(2);
    const sigY = doc.y;
    doc.fillColor('#0F172A').font('Helvetica').fontSize(9);
    doc.text('Place:', 40, sigY);
    doc.text('Date:', 40, sigY + 16);
    doc.text('Full Name: ____________________', 300, sigY);
    doc.text('Designation: __________________', 300, sigY + 16);
    doc.text('Signature of the person responsible for deduction of tax', 300, sigY + 36);
  }

  // ---- box helpers ----

  private twoColBox(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    width: number,
    label: string,
    value: string,
  ): void {
    doc
      .rect(x, y, width, 32)
      .strokeColor('#E2E8F0')
      .lineWidth(0.5)
      .stroke();
    doc.font('Helvetica').fontSize(8).fillColor('#64748B').text(label, x + 6, y + 5, { width: width - 12 });
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0F172A').text(value, x + 6, y + 17, { width: width - 12 });
  }

  private boxedBlock(doc: PDFKit.PDFDocument, rows: Array<[string, string]>): void {
    const startY = doc.y;
    const rowHeight = 18;
    const labelCol = 180;
    const totalHeight = rows.length * rowHeight;
    doc
      .rect(40, startY, 515, totalHeight)
      .strokeColor('#E2E8F0')
      .lineWidth(0.5)
      .stroke();
    rows.forEach(([label, value], idx) => {
      const rowY = startY + idx * rowHeight;
      if (idx > 0) {
        doc
          .moveTo(40, rowY)
          .lineTo(555, rowY)
          .strokeColor('#F1F5F9')
          .lineWidth(0.5)
          .stroke();
      }
      doc.font('Helvetica').fontSize(9).fillColor('#64748B').text(label, 46, rowY + 5, { width: labelCol - 12 });
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#0F172A').text(value, 40 + labelCol, rowY + 5, { width: 515 - labelCol - 6 });
    });
    doc.y = startY + totalHeight;
  }

  private labeledAmounts(doc: PDFKit.PDFDocument, rows: Array<[string, string]>): void {
    const startY = doc.y;
    const rowHeight = 16;
    doc.font('Helvetica').fontSize(9).fillColor('#0F172A');
    rows.forEach(([label, value], idx) => {
      const rowY = startY + idx * rowHeight;
      const isTotal = /^Total/i.test(label);
      doc.font(isTotal ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor('#0F172A');
      doc.text(label, 46, rowY + 2, { width: 400 });
      doc.text(value, 446, rowY + 2, { width: 105, align: 'right' });
    });
    doc.y = startY + rows.length * rowHeight;
  }
}
