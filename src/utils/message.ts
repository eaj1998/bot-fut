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
            // @ts-ignore
            const lid = (contact as any).lid;
            if (lid) {
                const lidStr = typeof lid === 'object' ? lid._serialized : lid;
                const cleanLid = lidStr.replace(/\D/g, '');
                console.log('[getLidFromMessage] Found LID in contact:', cleanLid);
                return cleanLid;
            }
        }
    } catch (e) {
    }

    const source = message.author || message.from;
    if (source && source.endsWith('@lid')) {
        const cleanLid = source.replace(/\D/g, '');
        console.log('[getLidFromMessage] Found LID in author/from:', cleanLid);
        return cleanLid;
    }

    console.log('[getLidFromMessage] No LID found');
    return undefined;
}

export async function getPhoneFromMessage(message: Message): Promise<string | undefined> {
    const author = message.author || message.from;

    console.log('[getPhoneFromMessage] author/from:', author);

    if (author && !author.endsWith('@lid')) {
        console.log('[getPhoneFromMessage] Using author/from as phone:', author);
        return author;
    }

    try {
        const contact = await message.getContact();
        if (contact) {
            if (contact.number) {
                const phone = `${contact.number}@c.us`;
                console.log('[getPhoneFromMessage] Found phone in contact.number:', phone);
                return phone;
            }
            if (contact.id && contact.id.user) {
                const phone = `${contact.id.user}@c.us`;
                console.log('[getPhoneFromMessage] Found phone in contact.id.user:', phone);
                return phone;
            }
        }
    } catch (e) {
    }

    console.log('[getPhoneFromMessage] No phone found, returning undefined');
    return undefined;
}
