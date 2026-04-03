/**
 * 🖨️ EL POLLO COMILON - PRINTER BRIDGE v3.0
 * -----------------------------------------
 * Soporte Híbrido: USB y NETWORK.
 * 
 * Usage:
 *   npx ts-node scripts/printer-bridge.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as net from 'net'; 
import * as dotenv from 'dotenv';
import axios from 'axios';
const Jimp = require('jimp');


// Usamos require para las librerías de hardware para evitar problemas de tipos/ESM
const escpos = require('escpos');
try {
    escpos.USB = require('escpos-usb');
    escpos.Network = require('escpos-network');
} catch (e) {
    console.warn('⚠️ Advertencia: Error cargando librerías nativas. Algunas interfaces podrían no funcionar.');
}

dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_KEY || ''
);

const PRINTER_TYPE: 'USB' | 'NETWORK' = (process.env.PRINTER_TYPE as any) || 'USB';
const PRINTER_IP = process.env.PRINTER_IP || '192.168.1.100';
const PRINTER_PORT = 9100;

console.log('🚀 [PrinterBridge v3] Arrancando...');
console.log(`📡 Modo: ${PRINTER_TYPE} ${PRINTER_TYPE === 'NETWORK' ? `(${PRINTER_IP})` : ''}`);

async function printViaNetwork(job: any): Promise<void> {
    return new Promise((resolve, reject) => {
        const device = new escpos.Network(PRINTER_IP, PRINTER_PORT);
        const printer = new escpos.Printer(device);

        device.open(async (err: any) => {
            if (err) return reject(err);

            try {
                // 1. Logo if exists
                if (job.logo_url) {
                    console.log(`[Bridge] Leyendo logo_url: ${job.logo_url}`);
                    try {
                        const response = await axios.get(job.logo_url, { responseType: 'arraybuffer' });
                        const originalBuffer = Buffer.from(response.data);
                        
                        // Procesar imagen con Jimp para compatibilidad con impresoras térmicas (ancho % 8 = 0)
                        const imageToPrint = await Jimp.read(originalBuffer);
                        imageToPrint.resize(384, Jimp.AUTO).greyscale().contrast(1);
                        const processedBuffer = await imageToPrint.getBufferAsync(Jimp.MIME_PNG);
                        
                        console.log(`[Bridge] Logo descargado y procesado. Tamaño: ${processedBuffer.length} bytes`);
                        
                        await new Promise((res, rej) => {
                            escpos.Image.load(processedBuffer, 'image/png', (image: any) => {
                                if (image) {
                                    console.log(`[Bridge] Imagen procesada (w:${image.size?.width}, h:${image.size?.height}). Enviando a impresora...`);
                                    Object.setPrototypeOf(image, escpos.Image.prototype);
                                    // raster es mucho más compatible que image para evitar la "basura" en impresoras chinas
                                    try {
                                        printer.align('ct').raster(image);
                                        console.log(`[Bridge] Comando de imagen (raster) enviado.`);
                                        res(null);
                                    } catch (imgErr: any) {
                                        console.error(`[Bridge] Error al enviar comando de imagen:`, imgErr);
                                        rej(imgErr);
                                    }
                                } else {
                                    console.log(`[Bridge] No se pudo convertir el buffer a una imagen válida para escpos.`);
                                    res(null);
                                }
                            });
                        })
                    } catch (logoErr: any) {
                        console.warn('⚠️ Error pidiendo imagen o cargando escpos:', logoErr.message);
                    }
                }

                // 2. Raw content (Text)
                const textBuffer = Buffer.from(job.raw_content, 'base64');
                
                // Añadimos el buffer de texto a la cola de impresión *después* del logo
                if ((printer as any).buffer && typeof (printer as any).buffer.write === 'function') {
                    (printer as any).buffer.write(textBuffer);
                    printer.cut().close();
                    resolve();
                } else {
                    // Fallback para adaptadores puros
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

async function printViaUSB(job: any): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            const device = new escpos.USB(); 
            const printer = new escpos.Printer(device);
            
            device.open(async (err: any) => {
                if (err) return reject(err);
                
                try {
                    if (job.logo_url) {
                        console.log(`[Bridge-USB] Leyendo logo_url: ${job.logo_url}`);
                        try {
                            const response = await axios.get(job.logo_url, { responseType: 'arraybuffer' });
                            const originalBuffer = Buffer.from(response.data);
                            
                            const imageToPrint = await Jimp.read(originalBuffer);
                            imageToPrint.resize(384, Jimp.AUTO).greyscale().contrast(1);
                            const processedBuffer = await imageToPrint.getBufferAsync(Jimp.MIME_PNG);
                            
                            console.log(`[Bridge-USB] Logo descargado y procesado. Tamaño: ${processedBuffer.length} bytes`);

                            await new Promise((res) => {
                                escpos.Image.load(processedBuffer, 'image/png', (image: any) => {
                                    if (image) {
                                        console.log(`[Bridge-USB] Imagen (w:${image.size?.width}, h:${image.size?.height}). Enviando a impresora en modo RASTER...`);
                                        Object.setPrototypeOf(image, escpos.Image.prototype);
                                        try {
                                            printer.align('ct').raster(image);
                                            console.log(`[Bridge-USB] Comando de imagen (raster) enviado.`);
                                        } catch (e) {
                                            console.error(`[Bridge-USB] Error raster:`, e);
                                        }
                                        res(null);
                                    } else {
                                        console.log(`[Bridge-USB] No se pudo convertir el buffer a una imagen válida.`);
                                        res(null);
                                    }
                                });
                            });
                        } catch (logoErr: any) {
                            console.warn('⚠️ [Bridge-USB] Error pidiendo imagen o cargando escpos:', logoErr.message);
                        }
                    }

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

async function printJob(job: any) {
    console.log(`📄 Imprimiendo pedido #${job.order_id?.slice(0, 8)}...`);

    try {
        const buffer = Buffer.from(job.raw_content, 'base64');

        if (PRINTER_TYPE === 'USB') {
            await printViaUSB(job);
        } else {
            await printViaNetwork(job);
        }

        console.log('✅ Impresión exitosa.');
        await supabase.from('print_queue').update({
            status: 'printed',
            printed_at: new Date().toISOString()
        }).eq('id', job.id);

    } catch (err: any) {
        console.error('❌ Error:', err.message);
        await supabase.from('print_queue').update({
            status: 'failed',
            error_message: err.message
        }).eq('id', job.id);
    }
}

// Escuchar cambios en tiempo real
supabase
    .channel('print_queue_channel')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'print_queue' }, (payload) => {
        if (payload.new.status === 'pending') {
            printJob(payload.new);
        }
    })
    .subscribe();

// Procesar pendientes al arrancar
(async () => {
    const { data: pendingJobs } = await supabase
        .from('print_queue')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

    if (pendingJobs && pendingJobs.length > 0) {
        console.log(`📋 Procesando ${pendingJobs.length} pedidos pendientes...`);
        for (const job of pendingJobs) {
            await printJob(job);
        }
    } else {
        console.log('✅ No hay pedidos pendientes. Esperando nuevos...');
    }
})();

process.on('SIGINT', () => {
    console.log('👋 Saliendo del bridge...');
    process.exit();
});
