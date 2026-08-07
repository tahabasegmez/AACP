"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.silentLogger = exports.consoleLogger = void 0;
const write = (level, message, meta) => {
    const line = JSON.stringify({
        ts: new Date().toISOString(),
        level,
        message,
        ...(meta ?? {}),
    });
    if (level === 'error') {
        process.stderr.write(`${line}\n`);
    }
    else {
        process.stdout.write(`${line}\n`);
    }
};
exports.consoleLogger = {
    info: (m, meta) => write('info', m, meta),
    warn: (m, meta) => write('warn', m, meta),
    error: (m, meta) => write('error', m, meta),
};
/** Testlerde gürültü olmasın diye sessiz logger. */
exports.silentLogger = {
    info: () => { },
    warn: () => { },
    error: () => { },
};
//# sourceMappingURL=logger.js.map