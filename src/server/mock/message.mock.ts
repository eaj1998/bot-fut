import type { Message, Chat, Contact, GroupChat } from 'whatsapp-web.js';
import type { IBotServerPort } from '../type';

export type SyntheticUser = {
    id: string;
    phone?: string;
    name?: string;
    groupId?: string;
    groupName?: string;
    participants?: MockParticipantInput[];
};

type MockParticipantInput = {
    id: number;
    name: string;
    phone: string;      // ex: "+5547999123456"
    groupId: string;    // ex: "1111111111111111111@g.us"
};

function digitsFromPhone(phone: string): string {
    return (phone || "").replace(/\D/g, "");
}

function makeContactIdFromDigits(digits: string) {
    const user = digits;
    const server = "c.us";
    return { user, server, _serialized: `${user}@${server}` } as const;
}

function parseChatId(chatId: string) {
    const [user, server = "g.us"] = (chatId || "").split("@");
    return { user, server, _serialized: `${user}@${server}` } as const;
}

export function makeMockChat(
    chatId: string,
    label: string,
    isGroup: boolean,
    participants: MockParticipantInput[] = []
): Chat {
    const base = {
        id: parseChatId(chatId) as any,
        name: label,
        isGroup,
        async sendMessage() { return undefined as any; },
        async fetchMessages() { return [] as any; },
    };

    const groupParticipants = participants
        .filter(p => p.groupId === chatId)
        .map(p => {
            const digits = digitsFromPhone(p.phone);                 
            const contactId = makeContactIdFromDigits(digits);       
            return {
                id: contactId as any,
                isAdmin: false,
                isSuperAdmin: false,
                name: p.name as any,
            };
        });

    const groupLike: Partial<GroupChat> = {
        ...base,
        participants: groupParticipants as any,
    };

    return groupLike as GroupChat;
}

export function makeMockContact(user?: SyntheticUser): Contact {
    const contactLike: Partial<Contact> = {
        number: user?.phone,
        pushname: user?.name,
        name: user?.name,
        id: { _serialized: `${user?.phone ?? 'unknown'}@c.us` } as any,
    };
    return contactLike as Contact;
}

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
        getContact: async () => makeMockContact(user),
        getChat: async () => makeMockChat(chatId, label, isGroup, user.participants ?? []),

        reply: async (msg) => {
            await server.sendMessage(user.id ?? chatId, String(msg));
            return {} as Message;
        },
    };
}
