// Barrel — the ONLY thing other modules may import from payroll.
export {
  PAYROLL_PUBLIC_API,
  PayrollPublicApi,
  PayrollRunSummary,
  PayslipSummary,
} from './payroll-public-api';

// Domain event names — re-exported here so notification (the future
// in-monolith subscriber) can `import { PAYROLL_RUN_FINALIZED } from
// '@modules/payroll/public-api'` without reaching into events/.
export const PAYROLL_RUN_INITIATED = 'payroll.run.initiated';
export const PAYROLL_RUN_FINALIZED = 'payroll.run.finalized';
export const PAYROLL_RUN_PAID = 'payroll.run.paid';
export const PAYSLIP_GENERATED = 'payroll.payslip.generated';
