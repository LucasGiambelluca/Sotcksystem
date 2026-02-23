import { supabase } from '../config/database';

export class StorageService {
    private bucket = 'chat-media';

    async uploadMedia(phone: string, buffer: Buffer, mimeType: string): Promise<string | null> {
        try {
            const ext = this.getExtension(mimeType);
            const filename = `${phone}/${Date.now()}.${ext}`;

            const { data, error } = await this.supabase.storage
                .from(this.bucket)
                .upload(filename, buffer, {
                    contentType: mimeType,
                    upsert: false
                });

            if (error) {
                console.error('[StorageService] Upload Error:', error);
                return null;
            }

            const { data: publicData } = this.supabase.storage
                .from(this.bucket)
                .getPublicUrl(filename);
            
            return publicData.publicUrl;
        } catch (err) {
            console.error('[StorageService] Critical Error:', err);
            return null;
        }
    }

    private getExtension(mimeType: string): string {
        const map: Record<string, string> = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/webp': 'webp',
            'application/pdf': 'pdf',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
            'application/vnd.ms-excel': 'xls'
        };
        return map[mimeType] || 'bin';
    }

    private get supabase() {
        return supabase;
    }
}

export default new StorageService();
