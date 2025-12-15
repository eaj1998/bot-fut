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
        // Se termina com @lid, não é um número de telefone válido
        if (author.endsWith('@lid')) {
            return undefined;
        }
        return author.replace(/@c\.us$/i, '');
    }

    try {
        const contact = await message.getContact();
        if (contact) {
            if (contact.number) {
                const num = contact.number.replace(/@c\.us$/i, '');
                // Verifica se não é um LID
                if (num.endsWith('@lid') || /^\d{15,}$/.test(num)) {
                    return undefined;
                }
                return num;
            } else if (contact.id?.user) {
                const user = contact.id.user.replace(/@c\.us$/i, '');
                // Verifica se não é um LID
                if (user.endsWith('@lid') || /^\d{15,}$/.test(user)) {
                    return undefined;
                }
                return user;
            }
        }
    } catch (e) {
        // getContact() pode falhar, ignora o erro
    }

    return undefined;
}
