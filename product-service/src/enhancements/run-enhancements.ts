/**
 * Run Enhancement Agents with Complete Pipeline
 */

import { EnhancementOrchestrator } from './agents/orchestrator.agent';

async function main() {
  try {
    const orchestrator = new EnhancementOrchestrator();
    await orchestrator.runEnhancements();

    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║  ✅ ENHANCEMENTS PIPELINE COMPLETED SUCCESSFULLY          ║
║                                                            ║
║  📊 All Reports Generated and Saved to:                   ║
║  /Users/ekamjitsingh/Projects/Nexora/services/            ║
║  product-service/reports/enhancements/                    ║
║                                                            ║
║  📁 Directory Structure:                                  ║
║  ├── audit-reports/        (Detailed JSON audits)        ║
║  ├── execution-reports/    (Execution logs)              ║
║  ├── metrics/              (Performance metrics)           ║
║  ├── simulations/          (Simulation results)           ║
║  ├── audit-logs/           (Audit trail)                  ║
║  └── EXECUTION_SUMMARY.md  (Overview)                     ║
║                                                            ║
║  🎯 Next Steps:                                           ║
║  1. Review EXECUTION_SUMMARY.md for overview              ║
║  2. Check audit-reports/ for detailed results             ║
║  3. Validate performance metrics                          ║
║  4. Plan P1 staging deployment                            ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `);
  } catch (error) {
    console.error('Error running enhancements:', error);
    process.exit(1);
  }
}

main();
