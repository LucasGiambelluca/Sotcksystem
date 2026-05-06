/**
 * StockSystem CLI — Unified Script Runner
 * 
 * Usage:
 *   npx ts-node src/scripts/index.ts <command>
 * 
 * Commands:
 *   init    — Seed a fresh database for a new tenant
 *   clear   — Clear operational data (orders, sessions, messages)
 *   help    — Show this help message
 */

const command = process.argv[2];

async function main() {
    switch (command) {
        case 'init': {
            const { systemInit } = await import('./system-init');
            await systemInit();
            break;
        }
        case 'clear': {
            const { clearOperationalDb } = await import('./clear-operational-db');
            await clearOperationalDb();
            break;
        }
        case 'help':
        default:
            console.log(`
╔══════════════════════════════════════════╗
║     StockSystem CLI — Script Runner      ║
╠══════════════════════════════════════════╣
║                                          ║
║  Commands:                               ║
║    init    Seed fresh database            ║
║    clear   Clear operational data         ║
║    help    Show this help message         ║
║                                          ║
║  Usage:                                  ║
║    npm run script -- init                ║
║    npm run script -- clear               ║
║                                          ║
╚══════════════════════════════════════════╝
`);
            if (command && command !== 'help') {
                console.error(`❌ Unknown command: "${command}"`);
                process.exit(1);
            }
    }
    process.exit(0);
}

main().catch((err) => {
    console.error('❌ Script failed:', err);
    process.exit(1);
});
