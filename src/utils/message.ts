import { Message } from "whatsapp-web.js";

/**
 * Attempts to get the user's display name from a WhatsApp message.
 * Falls back to phone number or "Jogador" if name is not available.
 */
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

export async function getLidFromMessage(message: Message): Promise<string | undefined> {
    try {
        const contact = await message.getContact();
        if (contact) {
            // @ts-ignore
            const lid = (contact as any).lid;
            if (lid) {
                const lidStr = typeof lid === 'object' ? lid._serialized : lid;
                return lidStr.replace(/\D/g, '');
            }
        }
    } catch (e) {
        return undefined;
    }
    return undefined;
}
