import { Injectable, Logger } from '@nestjs/common';
import { IStatutoryReport } from './schemas/statutory-report.schema';

/**
 * Export statutory reports in the file formats the Indian government
 * portals actually accept:
 *
 *   - Form 24Q → CSV (Quarterly salary-TDS return for NSDL/Protean RPU).
 *     Admin imports into the official RPU to generate the `.fvu` file
 *     that gets uploaded. Columns match RPU's "Deductee Details" sheet.
 *
 *   - PF ECR → `.txt` with `#~#`-separated fields per EPFO's official
 *     schema (11 columns, no header). Uploaded directly to the EPFO
 *     employer portal's "ECR upload" workflow.
 *
 *   - ESI return → CSV (monthly contribution history per IP number).
 *     Imported via the ESIC employer portal.
 *
 * Design notes:
 * - We emit files "for the tool, not for the human". Field order,
 *   widths, and delimiters exactly match what each portal's schema
 *   rejects-on-deviation; changes require checking the latest spec from
 *   NSDL / EPFO / ESIC (they revise annually).
 * - Values are rendered in rupees (not paise) — matches payroll's
 *   internal storage post-Option-B. Amounts are rounded to integer as
 *   statutory portals don't accept fractions.
 * - No file-system writes — everything returned as a `Buffer` so the
 *   controller can stream it with the right Content-Type.
 */
@Injectable()
export class StatutoryExportService {
  private readonly logger = new Logger(StatutoryExportService.name);

  // ---- Public entry point — dispatch by report type ---------------------

  buildFile(report: IStatutoryReport): {
    buffer: Buffer;
    filename: string;
    contentType: string;
  } {
    switch (report.reportType) {
      case 'tds_quarterly':
        return this.buildForm24QCsv(report);
      case 'pf_ecr':
        return this.buildPfEcrTxt(report);
      case 'esi_return':
        return this.buildEsiReturnCsv(report);
      default:
        throw new Error(
          `StatutoryExportService: unsupported reportType "${report.reportType}"`,
        );
    }
  }

  // ---- Form 24Q CSV -----------------------------------------------------

  /**
   * Columns match NSDL RPU's Annexure I (deductee details) — the admin
   * imports this into RPU to generate the .fvu file. Monthly rows are
   * emitted so RPU can populate the per-month payment/deduction grid.
   *
   * Header row is included because RPU's CSV import detects by header
   * names (case-insensitive). Section code is "192" for salary.
   */
  private buildForm24QCsv(report: IStatutoryReport): {
    buffer: Buffer;
    filename: string;
    contentType: string;
  } {
    const data: any = (report as any).data || {};
    const deductees: any[] = Array.isArray(data.deducteeRecords)
      ? data.deducteeRecords
      : [];
    const quarter = data.quarter ?? report.period?.quarter ?? 1;
    const year = data.year ?? report.period?.year ?? new Date().getFullYear();

    const header = [
      'SrNo',
      'DeducteeCode',    // '01' = Company (192=Salary); RPU auto-sets based on context
      'DeducteePAN',
      'DeducteeName',
      'PaymentMonth',
      'AmountPaid',
      'TDSDeducted',
      'SurchargeDeducted',
      'CessDeducted',
      'TotalTaxDeducted',
      'DateOfDeduction',
      'SectionCode',
      'RateOfDeduction',
      'ReasonForNonDeduction',
      'ChallanSerial',
    ];

    const rows: string[] = [];
    let srNo = 1;
    for (const d of deductees) {
      const breakup: any[] = Array.isArray(d.monthlyBreakup) ? d.monthlyBreakup : [];
      for (const m of breakup) {
        const monthStr = String(m.month).padStart(2, '0');
        const grossR = Math.round(Number(m.grossEarnings) || 0);
        const tdsR = Math.round(Number(m.tds) || 0);
        // Standard convention: deduction date = last day of the pay month
        const lastDay = new Date(Number(year), Number(m.month), 0).getDate();
        const dateOfDeduction = `${String(lastDay).padStart(2, '0')}/${monthStr}/${year}`;
        rows.push(
          this.csvRow([
            String(srNo++),
            '01',
            d.pan || '',
            this.sanitizeCsv(d.name || ''),
            `${monthStr}/${year}`,
            String(grossR),
            String(tdsR),
            '0',
            '0',
            String(tdsR),
            dateOfDeduction,
            '192',
            '',                  // RPU computes effective rate
            tdsR === 0 ? 'N' : '', // N = no deduction; blank = normal
            '',                   // Challan serial added after payment — left blank for admin
          ]),
        );
      }
    }

    const body = [this.csvRow(header), ...rows].join('\r\n');
    const buffer = Buffer.from(body, 'utf8');
    const filename = `Form24Q_Q${quarter}_${year}.csv`;
    return { buffer, filename, contentType: 'text/csv' };
  }

  // ---- PF ECR .txt ------------------------------------------------------

  /**
   * EPFO Electronic Challan-cum-Return. Fixed schema, 11 fields per
   * line, delimiter = `#~#`. No header row. The portal validates the
   * column count strictly — any missing field fails the upload.
   *
   * Schema (EPFO v2.0, unchanged since 2018):
   *   1. UAN (12-digit Universal Account Number; mandatory)
   *   2. MEMBER_NAME (as on UAN record)
   *   3. GROSS_WAGES (in INR, int)
   *   4. EPF_WAGES (capped at 15k statutory ceiling; int)
   *   5. EPS_WAGES (same; int)
   *   6. EDLI_WAGES (same; int)
   *   7. EPF_CONTRI_REMITTED (employee EPF @ 12% of EPF_WAGES)
   *   8. EPS_CONTRI_REMITTED (employer EPS @ 8.33% of EPS_WAGES)
   *   9. EPF_EPS_DIFF_REMITTED (employer EPF = employer PF − EPS)
   *  10. NCP_DAYS (non-contributory period — LOP days)
   *  11. REFUND_OF_ADVANCES (0 for normal runs)
   */
  private buildPfEcrTxt(report: IStatutoryReport): {
    buffer: Buffer;
    filename: string;
    contentType: string;
  } {
    const data: any = (report as any).data || {};
    const rows: any[] = Array.isArray(data.rows) ? data.rows : [];
    const month = data.period?.month ?? report.period?.month ?? 1;
    const year = data.period?.year ?? report.period?.year ?? new Date().getFullYear();

    const SEP = '#~#';
    const lines: string[] = [];
    for (const r of rows) {
      // EPFO rejects lines where UAN is missing — skip + log so the
      // admin can see which employees need their UAN updated before
      // re-running the export.
      if (!r.uan) {
        this.logger.warn(
          `PF ECR: skipping row for member "${r.memberName || 'unknown'}" — no UAN on record`,
        );
        continue;
      }
      const cols = [
        String(r.uan),
        this.sanitizePfName(r.memberName || ''),
        this.intR(r.grossWages),
        this.intR(r.epfWages),
        this.intR(r.epsWages),
        this.intR(r.edliWages),
        this.intR(r.epfContribRemitted),
        this.intR(r.epsContribRemitted),
        this.intR(r.epfEpsDiffRemitted),
        String(Math.max(0, Math.round(Number(r.ncpDays) || 0))),
        this.intR(r.refundOfAdvances),
      ];
      lines.push(cols.join(SEP));
    }

    const body = lines.join('\n') + '\n';
    const buffer = Buffer.from(body, 'ascii');
    const mm = String(month).padStart(2, '0');
    const filename = `PF_ECR_${year}_${mm}.txt`;
    return { buffer, filename, contentType: 'text/plain' };
  }

  // ---- ESI Monthly Contribution CSV -------------------------------------

  /**
   * ESIC monthly contribution file. Columns match ESIC employer
   * portal's bulk-upload spec; header is optional but included for
   * readability.
   *
   * "Reason for zero contribution" code reference (ESIC):
   *   0 = (blank) normal contribution
   *   1 = On leave
   *   2 = Left Service
   *   3 = Retired
   *   4 = Out of Coverage
   *   5 = Expired
   *   6 = Non-Implemented Area
   */
  private buildEsiReturnCsv(report: IStatutoryReport): {
    buffer: Buffer;
    filename: string;
    contentType: string;
  } {
    const data: any = (report as any).data || {};
    const rows: any[] = Array.isArray(data.rows) ? data.rows : [];
    const month = data.period?.month ?? report.period?.month ?? 1;
    const year = data.period?.year ?? report.period?.year ?? new Date().getFullYear();

    const header = [
      'IPNumber',
      'IPName',
      'NumberOfDaysWorked',
      'TotalMonthlyWages',
      'ReasonForZeroContribution',
      'LastWorkingDay',
    ];
    const out: string[] = [this.csvRow(header)];
    for (const r of rows) {
      // Generator stores `numberOfDays` + `grossWages` + `memberName` +
      // `reasonForZeroWages`; earlier exporter-draft field names kept as
      // fallbacks so legacy records still export.
      const daysWorked = Math.max(
        0,
        Math.round(Number(r.numberOfDays ?? r.daysWorked) || 0),
      );
      const wages = this.intR(r.grossWages ?? r.monthlyWages);
      const reason = Number(r.reasonForZeroContribution ?? r.reasonForZeroWages) || 0;
      out.push(
        this.csvRow([
          String(r.ipNumber || r.esiNumber || ''),
          this.sanitizeCsv(r.ipName || r.memberName || ''),
          String(daysWorked),
          wages,
          reason === 0 ? '' : String(reason),
          r.lastWorkingDay ? String(r.lastWorkingDay).slice(0, 10) : '',
        ]),
      );
    }

    const body = out.join('\r\n');
    const buffer = Buffer.from(body, 'utf8');
    const mm = String(month).padStart(2, '0');
    const filename = `ESI_Return_${year}_${mm}.csv`;
    return { buffer, filename, contentType: 'text/csv' };
  }

  // ---- helpers ----------------------------------------------------------

  /** CSV row with RFC 4180 escaping — quotes anything containing , " or newline. */
  private csvRow(fields: string[]): string {
    return fields.map((f) => this.csvField(f)).join(',');
  }

  private csvField(v: string): string {
    if (v == null) return '';
    const s = String(v);
    if (/[",\r\n]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  /** Strip characters CSV doesn't play nice with in header imports. */
  private sanitizeCsv(v: string): string {
    return String(v || '').replace(/[\r\n]+/g, ' ').trim();
  }

  /** EPFO name field forbids the `#~#` separator literals; strip and uppercase. */
  private sanitizePfName(v: string): string {
    return String(v || '')
      .replace(/#~#/g, ' ')
      .replace(/[\r\n]+/g, ' ')
      .toUpperCase()
      .trim()
      .slice(0, 85); // EPFO field limit
  }

  private intR(v: unknown): string {
    const n = Math.round(Number(v) || 0);
    return String(Math.max(0, n));
  }
}
