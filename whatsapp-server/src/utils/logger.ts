import winston from 'winston';
import path from 'path';

const logFormat = winston.format.printf((info) => {
    const { level, message, timestamp, ...metadata } = info;
    
    // Color codes in 'level' can interfere with some logic, but we just want to print it.
    let msg = `${timestamp} [${level}] : ${message} `;
    
    const cleanMeta = { ...metadata };
    // Winston-added metadata is often in info[Symbol.for('message')] or similar, 
    // but the rest spread should have captured it.
    
    delete cleanMeta.timestamp;
    delete cleanMeta.level;
    delete cleanMeta.message;
    delete cleanMeta.metadata; // If fillWith: ['metadata'] was used

    if (Object.keys(cleanMeta).length > 0) {
        // Safe stringify to handle circular references (like from Axios errors)
        const getCircularReplacer = () => {
          const seen = new WeakSet();
          return (key: string, value: any) => {
            if (typeof value === "object" && value !== null) {
              if (seen.has(value)) {
                return "[Circular]";
              }
              seen.add(value);
            }
            return value;
          };
        };
        msg += JSON.stringify(cleanMeta, getCircularReplacer());
    }
    return msg;
});

export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.colorize(),
        logFormat
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
            filename: path.join(__dirname, '../../../logs/error.log'), 
            level: 'error' 
        }),
        new winston.transports.File({ 
            filename: path.join(__dirname, '../../../logs/combined.log') 
        })
    ]
});

export default logger;
