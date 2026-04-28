import { Injectable, Logger } from '@nestjs/common';
// See payslip-pdf.service.ts for the require() rationale.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');
import { PassThrough } from 'stream';
import { IOffboarding } from './schemas/offboarding.schema';

export type LetterKind = 'experience' | 'relieving';

export interface LetterContext {
  offboarding: IOffboarding;
  employee: {
    firstName?: string;
    lastName?: string;
    employeeId?: string; // business id (NXR-0002)
    designationName?: string | null;
    departmentName?: string | null;
    joiningDate?: Date | string;
  } | null;
  organization: {
    name?: string;
    address?: string;
    pan?: string;
    tan?: string;
    logo?: string;
  } | null;
  issuer: {
    name?: string;
    designation?: string;
  } | null;
}

/**
 * Renders Experience + Relieving letters as A4 PDFs with on-demand
 * generation (no file storage) so amendments to the underlying data (e.g.
 * corrected joining date) always produce a fresh document.
 *
 * Why two separate letters:
 *
 * - **Experience letter** is a "to whom it may concern" service certificate
 *   an ex-employee shows to a future employer. It confirms tenure +
 *   designation, doesn't mention the reason for exit or F&F status.
 * - **Relieving letter** is addressed directly to the employee,
 *   confirms the separation is complete (no dues, no handover pending),
 *   and references the full & final settlement.
 *
 * Both are traditionally printed on company letterhead. We use plain
 * text + org name header; customers can customise by swapping in their
 * own letterhead upload later (TODO: wire org.logo + header image).
 */
@Injectable()
export class OffboardingLetterPdfService {
  private readonly logger = new Logger(OffboardingLetterPdfService.name);

  async render(kind: LetterKind, ctx: LetterContext): Promise<Buffer> {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 60,
      info: {
        Title: kind === 'experience' ? 'Experience Letter' : 'Relieving Letter',
        Author: ctx.organization?.name || 'Nexora HR',
        Subject: kind === 'experience'
          ? 'Service / Experience Certificate'
          : 'Relieving Letter on Separation',
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

    this.drawLetterhead(doc, ctx);
    if (kind === 'experience') this.drawExperienceBody(doc, ctx);
    else this.drawRelievingBody(doc, ctx);
    this.drawSignatureBlock(doc, ctx);

    doc.end();
    await done;
    return Buffer.concat(chunks);
  }

  filename(kind: LetterKind, ctx: LetterContext): string {
    const name = ctx.employee
      ? [ctx.employee.firstName, ctx.employee.lastName].filter(Boolean).join('_')
      : 'Employee';
    const cleanName = name.replace(/[^A-Za-z0-9_-]/g, '_');
    const kindLabel = kind === 'experience' ? 'Experience' : 'Relieving';
    return `${kindLabel}_Letter_${cleanName || 'Employee'}.pdf`;
  }

  // ---- helpers --------------------------------------------------------

  private formatDate(d: Date | string | undefined | null): string {
    if (!d) return '—';
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt.getTime())) return '—';
    return dt.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
  }

  private fullName(e: LetterContext['employee']): string {
    if (!e) return 'the Employee';
    const n = [e.firstName, e.lastName].filter(Boolean).join(' ').trim();
    return n || 'the Employee';
  }

  private drawLetterhead(doc: PDFKit.PDFDocument, ctx: LetterContext): void {
    const org = ctx.organization || {};
    doc
      .fillColor('#0F172A')
      .font('Helvetica-Bold')
      .fontSize(18)
      .text(org.name || 'Organization', { align: 'center' });
    if (org.address) {
      doc.font('Helvetica').fontSize(9).fillColor('#64748B').text(org.address, { align: 'center' });
    }
    const ids: string[] = [];
    if (org.pan) ids.push(`PAN: ${org.pan}`);
    if (org.tan) ids.push(`TAN: ${org.tan}`);
    if (ids.length) {
      doc.text(ids.join('   '), { align: 'center' });
    }
    doc
      .moveTo(60, doc.y + 8)
      .lineTo(535, doc.y + 8)
      .strokeColor('#0F172A')
      .lineWidth(0.75)
      .stroke();
    doc.moveDown(2);

    // Issue date top-right
    doc.fillColor('#0F172A').font('Helvetica').fontSize(10);
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    doc.text(`Date: ${today}`, 60, doc.y, { width: 475, align: 'right' });
    doc.moveDown(1.5);
  }

  private drawExperienceBody(doc: PDFKit.PDFDocument, ctx: LetterContext): void {
    const emp = ctx.employee || ({} as any);
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#0F172A');
    doc.text('TO WHOM IT MAY CONCERN', { align: 'center' });
    doc.moveDown(1);

    doc.font('Helvetica').fontSize(11).fillColor('#0F172A');
    const name = this.fullName(emp);
    const empIdStr = emp.employeeId ? ` (Employee ID: ${emp.employeeId})` : '';
    const designation = emp.designationName || '—';
    const department = emp.departmentName ? ` in the ${emp.departmentName} department` : '';
    const joining = this.formatDate(emp.joiningDate);
    const lwd = this.formatDate(
      (ctx.offboarding as any).lastWorkingDate || (ctx.offboarding as any).lastWorkingDay,
    );

    const paragraphs: string[] = [
      `This is to certify that ${name}${empIdStr} was employed with us from ${joining} to ${lwd} in the position of ${designation}${department}.`,
      `During the tenure of employment with us, we have found ${name} to be a sincere, dedicated and professional employee. Their contributions to the team have been valued by the organisation.`,
      `We wish ${name} all the very best for their future endeavours.`,
    ];
    for (const p of paragraphs) {
      doc.text(p, { align: 'justify', paragraphGap: 10, lineGap: 4 });
    }
  }

  private drawRelievingBody(doc: PDFKit.PDFDocument, ctx: LetterContext): void {
    const emp = ctx.employee || ({} as any);
    const org = ctx.organization || ({} as any);

    doc.font('Helvetica-Bold').fontSize(13).fillColor('#0F172A');
    doc.text('RELIEVING LETTER', { align: 'center' });
    doc.moveDown(1);

    const name = this.fullName(emp);
    const empIdStr = emp.employeeId ? ` (Employee ID: ${emp.employeeId})` : '';
    const designation = emp.designationName || '—';
    const lwd = this.formatDate(
      (ctx.offboarding as any).lastWorkingDate || (ctx.offboarding as any).lastWorkingDay,
    );
    const orgName = org.name || 'the Company';

    doc.font('Helvetica').fontSize(11).fillColor('#0F172A');
    doc.text(`Dear ${name},`, { paragraphGap: 8 });

    const paragraphs: string[] = [
      `This letter confirms that you${empIdStr} have been relieved from your services with ${orgName} with effect from ${lwd} (your last working day).`,
      `During your employment, you held the position of ${designation}. We acknowledge that you have handed over your responsibilities as per the handover process and completed your exit formalities.`,
      `Your full and final settlement has been processed in accordance with the company's offboarding policy. Any dues or reimbursements, if applicable, will be credited to your registered bank account.`,
      `We would like to thank you for the services rendered to ${orgName} and wish you the very best for your future career.`,
    ];
    for (const p of paragraphs) {
      doc.text(p, { align: 'justify', paragraphGap: 10, lineGap: 4 });
    }
  }

  private drawSignatureBlock(doc: PDFKit.PDFDocument, ctx: LetterContext): void {
    // Leave ample room for a physical signature / seal, then an issuer
    // name + designation block. Drop to a fixed y near the bottom so the
    // signature always sits predictably when the letter body is short.
    const signatureY = Math.max(doc.y + 40, 640);
    doc.y = signatureY;
    doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(10);
    const issuer = ctx.issuer || {};
    doc.text('For ' + (ctx.organization?.name || 'the Organization'));
    doc.moveDown(3); // space for signature
    doc.text(issuer.name || '__________________________');
    doc.font('Helvetica').fontSize(10);
    doc.text(issuer.designation || 'Authorised Signatory');

    // Footer
    doc
      .fillColor('#94A3B8')
      .font('Helvetica-Oblique')
      .fontSize(8)
      .text(
        'This letter is generated by the company\'s HR system. Any queries regarding authenticity may be directed to the HR department.',
        60,
        790,
        { width: 475, align: 'center' },
      );
  }
}
