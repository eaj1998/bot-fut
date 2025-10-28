import type { Message, Chat, Contact } from 'whatsapp-web.js';
import type { IBotServerPort } from '../type';

export type SyntheticUser = {
    id: string;
    phone?: string;
    name?: string;
    groupId?: string;
    groupName?: string;
};

/**
 * Cria um mock de Chat (grupo ou DM)
 */
export function makeMockChat(chatId: string, label: string, isGroup: boolean): Chat {
    const chatLike: Partial<Chat> = {
        id: { _serialized: chatId } as any,
        name: label,
        isGroup,
        async sendMessage() { return undefined as any; },
        async fetchMessages() { return [] as any; },
    };
    return chatLike as Chat;
}

/**
 * Cria um mock de Contact
 */
export function makeMockContact(name?: string): Contact {
    const contactLike: Partial<Contact> = {
        pushname: name,
        name,
        id: { _serialized: `${name ?? 'unknown'}@c.us` } as any,
    };
    return contactLike as Contact;
}

/**
 * Cria um mock de Message parcial para simular entrada do usuário
 */
export function makeMockMessage(
    input: string,
    user: SyntheticUser,
    server: IBotServerPort  
): Partial<Message> {
    const chatId = String(user.groupId ?? 'unknown@g.us');
    const isGroup = chatId.endsWith('@g.us');
    const from = isGroup ? chatId : (user.id ?? `${user.phone}@c.us`);
    const author = `${user.phone ?? user.id ?? '0000000000'}@c.us`;
    const label = isGroup ? (user.groupName ?? 'Grupo') : (user.name ?? 'Contato');

    return {
        from,
        author,
        body: input,
        getContact: async () => makeMockContact(user.name),
        getChat: async () => makeMockChat(chatId, label, isGroup),

        // 👇 agora reply usa o server real
        reply: async (msg) => {
            await server.sendMessage(user.id ?? chatId, String(msg));
            return {} as Message;
        },
    };
}
