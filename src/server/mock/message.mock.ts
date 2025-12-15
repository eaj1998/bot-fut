import type { Message, Chat, Contact, GroupChat } from 'whatsapp-web.js';
import type { IBotServerPort } from '../type';

export type SyntheticUser = {
    id: string;
    phone?: string;
    lid?: string;
    name?: string;
    groupId?: string;
    groupName?: string;
    participants?: MockParticipantInput[];
};

type MockParticipantInput = {
    id: number;
    name: string;
    phone: string;
    groupId: string;
};

function digitsFromPhone(phone: string): string {
    return (phone || "").replace(/\D/g, "");
}

function makeContactIdFromDigits(digits: string, isLid: boolean = false) {
    const user = digits;
    const server = isLid ? "lid" : "c.us";
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
        async pin(duration?: number) {
            return true;
        }
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
    let contactId;
    const hasLid = !!user?.lid;

    if (user?.lid) {
        contactId = makeContactIdFromDigits(user.lid, true);
    } else if (user?.phone) {
        const digits = digitsFromPhone(user.phone);
        contactId = makeContactIdFromDigits(digits);
    }

    const contactLike: Partial<Contact> = {
        number: user?.phone,
        pushname: user?.name,
        name: user?.name,
        id: { _serialized: `${contactId?._serialized ?? 'unknown'}` } as any,
        // Add LID if present
        ...(hasLid && { lid: { _serialized: `${user.lid}@lid` } }),
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

    // Determine author based on LID or phone
    let author: string;
    if (user.lid) {
        author = `${user.lid}@lid`;
    } else {
        const phoneOrId = user.phone ?? user.id ?? '0000000000';
        const cleanPhoneOrId = phoneOrId.replace(/@c\.us$/, '');
        author = `${cleanPhoneOrId}@c.us`;
    }

    const label = isGroup ? (user.groupName ?? 'Grupo') : (user.name ?? 'Contato');

    // Create realistic _data structure based on actual WhatsApp logs
    const messageId = `3EB0${Math.random().toString(36).substring(2, 15).toUpperCase()}`;
    const timestamp = Math.floor(Date.now() / 1000);

    const _data = {
        id: {
            fromMe: false,
            remote: chatId,
            id: messageId,
            participant: user.lid ? `${user.lid}@lid` : undefined,
            _serialized: `false_${chatId}_${messageId}_${author}`
        },
        body: input,
        type: "chat",
        t: timestamp,
        notifyName: user.name,
        from: chatId,
        to: "554988417929@c.us", // Bot's number
        author: author,
        ack: 1,
        isNewMsg: true,
        star: false,
        kicNotified: false,
        recvFresh: true,
        isFromTemplate: false,
        pollInvalidated: false,
        latestEditMsgKey: null,
        latestEditSenderTimestampMs: null,
        broadcast: false,
        mentionedJidList: [],
        groupMentions: [],
        isVcardOverMmsDocument: false,
        isForwarded: false,
        hasReaction: false,
        ephemeralOutOfSync: false,
        productHeaderImageRejected: false,
        lastPlaybackProgress: 0,
        isDynamicReplyButtonsMsg: false,
        isMdHistoryMsg: false,
        stickerSentTs: 0,
        isAvatar: false,
        requiresDirectConnection: false,
        pttForwardedFeaturesEnabled: true,
        isEphemeral: false,
        isStatusV3: false,
        links: []
    };

    // Mock client with getContactLidAndPhone method
    const mockClient = {
        async getContactLidAndPhone(userIds: string[]) {
            return userIds.map(userId => {
                // Extract the user part from the ID
                const cleanId = userId.replace(/@.*$/, '');

                // Check if it's a LID or phone
                if (userId.endsWith('@lid')) {
                    return {
                        lid: cleanId,
                        pn: user.phone || undefined
                    };
                } else {
                    return {
                        lid: user.lid || undefined,
                        pn: cleanId
                    };
                }
            });
        }
    };

    return {
        from,
        author,
        body: input,
        _data,
        client: mockClient,
        getContact: async () => makeMockContact(user),
        getChat: async () => makeMockChat(chatId, label, isGroup, user.participants ?? []),
        getMentions: async () => {
            // Parse mentions from message body (format: @5511999999999)
            const mentionRegex = /@(\d+)/g;
            const mentions: Contact[] = [];
            let match;

            while ((match = mentionRegex.exec(input)) !== null) {
                const phone = match[1];
                const digits = digitsFromPhone(phone);
                const contactId = makeContactIdFromDigits(digits);
                mentions.push({
                    id: contactId as any,
                    number: phone,
                    pushname: `User ${phone}`,
                    name: `User ${phone}`,
                } as Contact);
            }

            return mentions;
        },
        pin: async (duration?: number) => true,
        reply: async (msg: string) => {
            await server.sendMessage(user.id ?? chatId, String(msg));
            return {} as Message;
        },
    } as any as Partial<Message>;
}
