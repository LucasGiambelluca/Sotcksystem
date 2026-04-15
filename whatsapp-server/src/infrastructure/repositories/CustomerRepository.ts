import { supabase } from '../../config/database';
import { logger } from '../../utils/logger';
import { PhoneUtils } from '../../utils/phoneUtils';

export interface CustomerProfile {
    phone: string;
    name?: string;
    lastAddress?: string;
    lastOrderItems?: any[];
}

export class CustomerRepository {
    private readonly TABLE = 'whatsapp_conversations';

    async getProfile(phone: string): Promise<CustomerProfile | null> {
        const cleanPhone = PhoneUtils.normalize(phone);
        
        try {
            // 1. Get info from whatsapp_conversations
            const { data: contact } = await supabase
                .from('whatsapp_conversations')
                .select('contact_name, last_message')
                .eq('phone', cleanPhone)
                .maybeSingle();

            // 2. Get info from last completed flows to find address
            const { data: lastExecs } = await supabase
                .from('flow_executions_history')
                .select('context')
                .eq('phone', cleanPhone)
                .order('completed_at', { ascending: false })
                .limit(5);

            let address = null;
            let name = contact?.contact_name !== cleanPhone ? contact?.contact_name : null;

            // Try to extract address from history context
            if (lastExecs) {
                for (const exec of lastExecs) {
                    const ctx = exec.context;
                    // Check various common address fields
                    const foundAddress = ctx?.variables?.global?.direccion_cliente || 
                                         ctx?.variables?.global?.address ||
                                         ctx?.direccion_cliente;
                    if (foundAddress) {
                        address = foundAddress;
                        break;
                    }
                }
            }

            return {
                phone: cleanPhone,
                name: name || undefined,
                lastAddress: address || undefined
            };

        } catch (err) {
            logger.error(`[CustomerRepo] Failed to fetch profile for ${phone}`, err);
            return null;
        }
    }
}

export const customerRepository = new CustomerRepository();
