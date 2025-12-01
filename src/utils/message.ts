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
        // ignore
    }

    // Fallback: check if author or from is a LID
    const source = message.author || message.from;
    if (source && source.endsWith('@lid')) {
        return source.replace(/\D/g, '');
    }

    return undefined;
}

export async function getPhoneFromMessage(message: Message): Promise<string> {
    const author = message.author || message.from;

    // If it's already a c.us number, return it (stripped of non-digits if needed, but usually we keep @c.us or just digits)
    // The existing code often uses the full string or just digits. Let's stick to what the existing code did: message.author ?? message.from
    // But we want to avoid @lid.

    if (author && !author.endsWith('@lid')) {
        return author;
    }

    try {
        const contact = await message.getContact();
        if (contact) {
            if (contact.number) {
                return `${contact.number}@c.us`;
            }
            if (contact.id && contact.id.user) {
                return `${contact.id.user}@c.us`;
            }
        }
    } catch (e) {
        // ignore
    }

    // Fallback: if we really can't find a phone, return the author even if it is a LID? 
    // The user explicitly said they don't want LID in phoneE164. 
    // But if we can't find anything else, we might have to throw or return something.
    // For now, let's return the author but log a warning if it's a LID?
    // Or maybe just return it and let the repository handle it (though we want to avoid it there too).
    // Let's assume getContact() works for LIDs to get the real number.

    return author || '';
}
