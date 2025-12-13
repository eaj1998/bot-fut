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
            if (lid) {
                const lidStr = typeof lid === 'object' ? lid._serialized : lid;
                const cleanLid = lidStr.replace(/\D/g, '');
                return cleanLid;
            }
        }
    } catch (e) {
    }

    const source = message.author || message.from;
    if (source && source.endsWith('@lid')) {
        const cleanLid = source.replace(/\D/g, '');
        return cleanLid;
    }

    return undefined;
}

export async function getPhoneFromMessage(message: Message): Promise<string | undefined> {
    const author = message.author ?? message.from ?? null;
    if (author) {
        return author.replace(/@c\.us$/i, '').replace(/@lid$/i, '');
    }

    const contact = await message.getContact();
    if (contact) {
        if (contact.number) {
            return contact.number.replace(/@c\.us$/i, '').replace(/@lid$/i, '');
        } else if (contact.id?.user) {
            return contact.id.user.replace(/@c\.us$/i, '').replace(/@lid$/i, '');
        }
    }

    return undefined;
}
