import { Router } from 'express';
import { whatsappClient } from '../../infrastructure/whatsapp/WhatsAppClient';

const router = Router();

// List all groups
router.get('/', async (req, res) => {
    const sock = whatsappClient.getSock();
    if (!sock) return res.status(503).json({ error: 'WhatsApp not connected' });

    try {
        const groups = await sock.groupFetchAllParticipating();
        const result = Object.values(groups).map((g: any) => ({
            id: g.id,
            subject: g.subject,
            owner: g.owner,
            creation: g.creation,
            participants: g.participants?.length || 0,
            announce: g.announce || false,
        }));
        res.json(result);
    } catch (err: any) {
        console.error('[Groups] Error listing:', err);
        res.status(500).json({ error: 'Failed to list groups' });
    }
});

// Create a new group
router.post('/create', async (req, res) => {
    const sock = whatsappClient.getSock();
    if (!sock) return res.status(503).json({ error: 'WhatsApp no conectado' });

    const { subject, participants } = req.body;
    if (!subject || !participants || participants.length === 0) {
        return res.status(400).json({ error: 'Se requiere nombre y al menos 1 participante' });
    }

    try {
        const validJids: string[] = [];
        const invalidNumbers: string[] = [];

        for (const p of participants) {
            if (p.includes('@lid')) {
                invalidNumbers.push(`${p} (formato LID, no soportado para grupos)`);
                continue;
            }

            const clean = p.replace(/[^0-9]/g, '');

            if (clean.length < 8) {
                invalidNumbers.push(`${p} (número muy corto, no es válido)`);
                continue;
            }

            const jid = p.includes('@') ? p : `${clean}@s.whatsapp.net`;
            validJids.push(jid);
        }

        if (validJids.length === 0) {
            return res.status(400).json({
                error: 'Ningún contacto tiene un número válido de WhatsApp. Los formatos @lid no sirven para grupos.',
                invalid: invalidNumbers,
            });
        }

        const group = await sock.groupCreate(subject, [validJids[0]]);

        let addedCount = 1;
        const failedJids: string[] = [];

        if (validJids.length > 1) {
            const remaining = validJids.slice(1);
            for (let i = 0; i < remaining.length; i += 2) {
                const batch = remaining.slice(i, i + 2);
                try {
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    await sock.groupParticipantsUpdate(group.id, batch, 'add');
                    addedCount += batch.length;
                } catch (batchErr: any) {
                    failedJids.push(...batch);
                }
            }
        }

        res.json({
            id: group.id,
            subject: subject,
            participants: addedCount,
            failed: failedJids.length > 0 ? failedJids : undefined,
            skipped: invalidNumbers.length > 0 ? invalidNumbers : undefined,
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message || 'Error al crear el grupo' });
    }
});

// Get invite link
router.get('/:groupId/invite', async (req, res) => {
    const sock = whatsappClient.getSock();
    if (!sock) return res.status(503).json({ error: 'WhatsApp not connected' });

    try {
        const code = await sock.groupInviteCode(req.params.groupId);
        res.json({ url: `https://chat.whatsapp.com/${code}` });
    } catch (err: any) {
        res.status(500).json({ error: err.message || 'Failed to get invite link' });
    }
});

// Send message to group
router.post('/:groupId/send', async (req, res) => {
    const sock = whatsappClient.getSock();
    if (!sock) return res.status(503).json({ error: 'WhatsApp not connected' });

    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    try {
        await sock.sendMessage(req.params.groupId, { text: message });
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message || 'Failed to send message' });
    }
});

// Add participants to a group
router.post('/:groupId/participants', async (req, res) => {
    const sock = whatsappClient.getSock();
    if (!sock) return res.status(503).json({ error: 'WhatsApp not connected' });

    const { phones } = req.body;
    if (!phones || phones.length === 0) return res.status(400).json({ error: 'Phones required' });

    try {
        const jids = phones.map((p: string) => {
            if (p.includes('@')) return p;
            return `${p.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
        });

        await sock.groupParticipantsUpdate(req.params.groupId, jids, 'add');
        res.json({ success: true, added: jids.length });
    } catch (err: any) {
        res.status(500).json({ error: err.message || 'Failed to add participants' });
    }
});

// Toggle group announcement setting
router.patch('/:groupId/settings', async (req, res) => {
    const sock = whatsappClient.getSock();
    if (!sock) return res.status(503).json({ error: 'WhatsApp not connected' });

    const { announcements } = req.body;

    try {
        await sock.groupSettingUpdate(req.params.groupId, announcements ? 'announcement' : 'not_announcement');
        res.json({ success: true, announce: announcements });
    } catch (err: any) {
        res.status(500).json({ error: err.message || 'Failed to update settings' });
    }
});

export default router;
