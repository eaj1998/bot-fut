import { Message } from "whatsapp-web.js";

export async function getUserNameFromMessage(message: Message): Promise<string> {
    try {
        const notifyName = (message as any)._data?.notifyName;
        if (notifyName && notifyName.trim()) {
            return notifyName.trim();
        }

        try {
            const contact = await message.getContact();
            if (contact) {
                const name = contact.pushname || contact.name || contact.number;
                if (name && name.trim()) {
                    return name.trim();
                }
            }
        } catch (e) {
        }

        if (message.author) {
            return message.author.split('@')[0];
        }
        return "Jogador";
    } catch (error) {
        return "Jogador";
    }
}

/**
 * Gets both LID and phone number using WhatsApp's official method
 */
export async function getLidAndPhoneFromMessage(message: Message): Promise<{ lid?: string; phone?: string }> {
    try {
        // Get the user ID from the message
        const userId = message.author || message.from;
        if (!userId) {
            console.log('[getLidAndPhoneFromMessage] No userId found');
            return {};
        }

        // Use WhatsApp's official method to get both LID and phone
        const client = (message as any).client;
        if (client && typeof client.getContactLidAndPhone === 'function') {
            console.log('[getLidAndPhoneFromMessage] Using getContactLidAndPhone for:', userId);
            const result = await client.getContactLidAndPhone([userId]);
            console.log('[getLidAndPhoneFromMessage] Result:', JSON.stringify(result, null, 2));

            if (result && result.length > 0) {
                const data = result[0];
                return {
                    lid: data.lid || undefined,
                    phone: data.pn || undefined
                };
            }
        } else {
            console.log('[getLidAndPhoneFromMessage] getContactLidAndPhone not available, falling back to manual extraction');
        }
    } catch (e) {
        console.log('[getLidAndPhoneFromMessage] Error:', e);
    }

    // Fallback to manual extraction
    return await getLidAndPhoneManually(message);
}

/**
 * Manual fallback for extracting LID and phone
 */
async function getLidAndPhoneManually(message: Message): Promise<{ lid?: string; phone?: string }> {
    const result: { lid?: string; phone?: string } = {};

    try {
        const contact = await message.getContact();
        if (contact) {
            const lid = (contact as any).lid;
            if (lid) {
                const lidStr = typeof lid === 'object' ? lid._serialized : lid;
                result.lid = lidStr.replace(/\D/g, '');
            }
        }
    } catch (e) {
        console.log('[getLidAndPhoneManually] Error getting contact:', e);
    }

    const author = message.author ?? message.from ?? null;
    if (author) {
        if (author.endsWith('@lid')) {
            result.lid = author.replace(/\D/g, '');
        } else if (author.endsWith('@c.us')) {
            result.phone = author.replace(/@c\.us$/i, '');
        }
    }

    return result;
}

export async function getLidFromMessage(message: Message): Promise<string | undefined> {
    const { lid } = await getLidAndPhoneFromMessage(message);
    return lid;
}

export async function getPhoneFromMessage(message: Message): Promise<string | undefined> {
    const { phone } = await getLidAndPhoneFromMessage(message);
    return phone;
}
