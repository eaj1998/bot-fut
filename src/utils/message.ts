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

export async function getLidFromMessage(message: Message): Promise<string | undefined> {
    try {
        const contact = await message.getContact();
        if (contact) {
            const lid = (contact as any).lid;
            console.log('[getLidFromMessage] contact.lid:', lid);
            if (lid) {
                const lidStr = typeof lid === 'object' ? lid._serialized : lid;
                const cleanLid = lidStr.replace(/\D/g, '');
                console.log('[getLidFromMessage] cleanLid:', cleanLid);
                return cleanLid;
            }
        }
    } catch (e) {
        console.log('[getLidFromMessage] Error getting contact:', e);
    }

    const source = message.author || message.from;
    console.log('[getLidFromMessage] source:', source);
    if (source && source.endsWith('@lid')) {
        const cleanLid = source.replace(/\D/g, '');
        console.log('[getLidFromMessage] cleanLid from source:', cleanLid);
        return cleanLid;
    }

    return undefined;
}

export async function getPhoneFromMessage(message: Message): Promise<string | undefined> {
    const author = message.author ?? message.from ?? null;
    console.log('[getPhoneFromMessage] author/from:', author);

    if (author) {
        // Se termina com @lid, não é um número de telefone válido
        if (author.endsWith('@lid')) {
            console.log('[getPhoneFromMessage] Detected LID, returning undefined');
            return undefined;
        }
        const phone = author.replace(/@c\.us$/i, '');
        console.log('[getPhoneFromMessage] Extracted phone:', phone);
        return phone;
    }

    try {
        const contact = await message.getContact();
        if (contact) {
            if (contact.number) {
                const num = contact.number.replace(/@c\.us$/i, '');
                console.log('[getPhoneFromMessage] contact.number:', num);
                // Verifica se não é um LID
                if (num.endsWith('@lid') || /^\d{15,}$/.test(num)) {
                    console.log('[getPhoneFromMessage] contact.number is LID, returning undefined');
                    return undefined;
                }
                return num;
            } else if (contact.id?.user) {
                const user = contact.id.user.replace(/@c\.us$/i, '');
                console.log('[getPhoneFromMessage] contact.id.user:', user);
                // Verifica se não é um LID
                if (user.endsWith('@lid') || /^\d{15,}$/.test(user)) {
                    console.log('[getPhoneFromMessage] contact.id.user is LID, returning undefined');
                    return undefined;
                }
                return user;
            }
        }
    } catch (e) {
        console.log('[getPhoneFromMessage] Error getting contact:', e);
    }

    return undefined;
}
