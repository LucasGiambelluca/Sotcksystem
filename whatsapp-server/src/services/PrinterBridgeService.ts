import { supabase } from '../config/database';
import axios from 'axios';
import { logger } from '../utils/logger';
const Jimp = require('jimp');

// Dynamic loading of hardware libraries
const escpos = require('escpos');
try {
    escpos.USB = require('escpos-usb');
    escpos.Network = require('escpos-network');
} catch (e) {
    logger.warn('⚠️ [PrinterBridge] Native ESC/POS libraries not found. Some interfaces may be unavailable.');
}

/**
 * PrinterBridgeService
 * Automatically polls and processes the print_queue table.
 */
export class PrinterBridgeService {
    private static instance: PrinterBridgeService;
    private isRunning = false;
    private processingLock = false;

    private constructor() {}

    public static getInstance(): PrinterBridgeService {
        if (!PrinterBridgeService.instance) {
            PrinterBridgeService.instance = new PrinterBridgeService();
        }
        return PrinterBridgeService.instance;
    }

    public async start() {
        if (this.isRunning) return;
        
        const enabled = process.env.ENABLE_PRINTER_BRIDGE === 'true';
        if (!enabled) {
            console.log('ℹ️ [PrinterBridge] Service is disabled (ENABLE_PRINTER_BRIDGE != true).');
            return;
        }

        this.isRunning = true;
        const printerType = (process.env.PRINTER_TYPE as any) || 'USB';
        const printerIp = process.env.PRINTER_IP || '192.168.1.100';

        logger.info(`🚀 [PrinterBridge] Starting automated queue worker...`);
        logger.info(`📡 [PrinterBridge] Mode: ${printerType} ${printerType === 'NETWORK' ? `(${printerIp})` : ''}`);

        // 1. Subscribe to Realtime inserts
        supabase
            .channel('print_queue_worker')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'print_queue' }, (payload) => {
                if (payload.new.status === 'pending') {
                    this.processJob(payload.new);
                }
            })
            .subscribe((status) => {
                logger.info(`📡 [PrinterBridge] Subscription status: ${status}`);
            });

        // 2. Initial processing of pending jobs
        this.processPending();

        // 3. Heartbeat for monitoring
        setInterval(() => {
            logger.info('💓 [PrinterBridge] Worker heartbeat: still watching queue.');
        }, 300000); // Every 5 minutes
    }

    private async processPending() {
        try {
            const { data: pendingJobs } = await supabase
                .from('print_queue')
                .select('*')
                .eq('status', 'pending')
                .order('created_at', { ascending: true });

            if (pendingJobs && pendingJobs.length > 0) {
                logger.info(`📋 [PrinterBridge] Processing ${pendingJobs.length} pending jobs in queue...`);
                for (const job of pendingJobs) {
                    await this.processJob(job);
                }
            } else {
                logger.info('✅ [PrinterBridge] Queue is empty. Waiting for new jobs.');
            }
        } catch (error) {
            logger.error('❌ [PrinterBridge] Error processing pending jobs:', error);
        }
    }

    private async processJob(job: any) {
        if (this.processingLock) {
            logger.info(`⏳ [PrinterBridge] Printer is busy. Job #${job.order_id?.slice(0, 8)} will wait for polling.`);
            return;
        }

        try {
            this.processingLock = true;
            logger.info(`📄 [PrinterBridge] Printing order #${job.order_id?.slice(0, 8)}...`);

            const printerType = process.env.PRINTER_TYPE || 'USB';
            
            if (printerType === 'USB') {
                await this.printViaUSB(job);
            } else {
                await this.printViaNetwork(job);
            }

            logger.info(`✅ [PrinterBridge] Printed successfully: #${job.order_id?.slice(0, 8)}`);
            await supabase.from('print_queue').update({
                status: 'printed',
                printed_at: new Date().toISOString()
            }).eq('id', job.id);

            // Mandatory cooldown after each job to let the printer finish cutting/resetting
            await new Promise(r => setTimeout(r, 2000));
            this.processingLock = false;

        } catch (err: any) {
            logger.error(`❌ [PrinterBridge] Print failed for #${job.order_id?.slice(0, 8)}:`, { error: err.message });
            await supabase.from('print_queue').update({
                status: 'failed',
                error_message: err.message
            }).eq('id', job.id);
            this.processingLock = false;
        }
    }

    private async printViaNetwork(job: any): Promise<void> {
        const ip = process.env.PRINTER_IP || '192.168.1.100';
        const port = 9100;

        return new Promise((resolve, reject) => {
            const device = new escpos.Network(ip, port);
            const printer = new escpos.Printer(device);

            device.open(async (err: any) => {
                if (err) return reject(err);

                try {
                    // Give the printer some time to stabilize after opening the port
                    // Cold start on many thermal printers requires significant time (up to 1s)
                    await new Promise(r => setTimeout(r, 1000));
                    
                    // Initialize hardware multiple times to break through any noise
                    printer.hardware('INIT');
                    await new Promise(r => setTimeout(r, 500));
                    printer.hardware('INIT');
                    await new Promise(r => setTimeout(r, 500));
                    
                    await this.handleLogo(printer, job.logo_url);
                    
                    // Critical pause after logo to ensure printer is out of raster mode
                    // Some printers stay in "graphics mode" and ignore following ESC commands
                    await new Promise(r => setTimeout(r, 1200));
                    printer.hardware('INIT'); 
                    await new Promise(r => setTimeout(r, 500));
                    printer.hardware('INIT'); // Double reset after logo
                    
                    const textBuffer = Buffer.from(job.raw_content, 'base64');
                    if ((printer as any).buffer && typeof (printer as any).buffer.write === 'function') {
                        (printer as any).buffer.write(textBuffer);
                        printer.cut().close();
                        resolve();
                    } else {
                        printer.flush(() => {
                            device.write(textBuffer, (writeErr: any) => {
                                if (writeErr) reject(writeErr);
                                else {
                                    printer.cut().close();
                                    resolve();
                                }
                            });
                        });
                    }
                } catch (runErr) {
                    reject(runErr);
                }
            });
        });
    }

    private async printViaUSB(job: any): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                const device = new escpos.USB(); 
                const printer = new escpos.Printer(device);
                
                device.open(async (err: any) => {
                    if (err) return reject(err);
                    
                    try {
                        // Give the printer some time to stabilize after opening the port
                        await new Promise(r => setTimeout(r, 1000));

                        // Initialize hardware twice with a delay
                        printer.hardware('INIT');
                        await new Promise(r => setTimeout(r, 500));
                        printer.hardware('INIT');
                        await new Promise(r => setTimeout(r, 500));

                        await this.handleLogo(printer, job.logo_url);
                        
                        // Critical pause after logo
                        await new Promise(r => setTimeout(r, 1200));
                        printer.hardware('INIT');
                        await new Promise(r => setTimeout(r, 500));
                        printer.hardware('INIT');
                        
                        const textBuffer = Buffer.from(job.raw_content, 'base64');
                        if ((printer as any).buffer && typeof (printer as any).buffer.write === 'function') {
                            (printer as any).buffer.write(textBuffer);
                            printer.cut().close();
                            resolve();
                        } else {
                            printer.flush(() => {
                                device.write(textBuffer, (writeErr: any) => {
                                    if (writeErr) reject(writeErr);
                                    else {
                                        printer.cut().close();
                                        resolve();
                                    }
                                });
                            });
                        }
                    } catch (e) {
                        reject(e);
                    }
                });
            } catch (err) {
                reject(err);
            }
        });
    }

    private async handleLogo(printer: any, logoUrl?: string) {
        if (!logoUrl) {
            logger.info('ℹ️ [PrinterBridge] No logo_url provided in job. Skipping.');
            return;
        }

        try {
            logger.info(`📡 [PrinterBridge] Downloading logo: ${logoUrl}`);
            const response = await axios.get(logoUrl, { responseType: 'arraybuffer' });
            const originalBuffer = Buffer.from(response.data);
            
            logger.info(`🖼️ [PrinterBridge] Processing logo with Jimp...`);
            const imageToPrint = await Jimp.read(originalBuffer);
            
            // 384px is safer for 58mm/80mm compatibility (some 80mm printers struggle with >500px on raster)
            imageToPrint.resize(384, Jimp.AUTO).greyscale().contrast(1);
            // Convert to pure black & white using threshold (Jimp has no .blackWhite())
            imageToPrint.scan(0, 0, imageToPrint.bitmap.width, imageToPrint.bitmap.height, (x: number, y: number, idx: number) => {
                const gray = imageToPrint.bitmap.data[idx]; // R channel (already greyscale)
                const bw = gray < 128 ? 0 : 255;
                imageToPrint.bitmap.data[idx] = bw;     // R
                imageToPrint.bitmap.data[idx + 1] = bw; // G
                imageToPrint.bitmap.data[idx + 2] = bw; // B
            });
            const processedBuffer = await imageToPrint.getBufferAsync(Jimp.MIME_PNG);
            
            await new Promise((res) => {
                escpos.Image.load(processedBuffer, 'image/png', (image: any) => {
                    if (image) {
                        try {
                            logger.info(`🖨️ [PrinterBridge] Sending raster image to printer...`);
                            Object.setPrototypeOf(image, escpos.Image.prototype);
                            printer.align('ct').raster(image); 
                            // Small delay after image to ensure buffer is processed
                            setTimeout(() => res(null), 300);
                        } catch (e) {
                            logger.error(`❌ [PrinterBridge] Printer.raster error:`, e);
                            res(null);
                        }
                    } else {
                        logger.warn(`⚠️ [PrinterBridge] escpos.Image.load returned null image`);
                        res(null);
                    }
                });
            });
            logger.info(`✅ [PrinterBridge] Logo processed and sent.`);
        } catch (err: any) {
            logger.warn(`⚠️ [PrinterBridge] Skipping logo due to error: ${err.message}`);
        }
    }
}
