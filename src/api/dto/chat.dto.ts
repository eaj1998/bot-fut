/**
 * DTOs para gerenciamento de Chats
 */

export interface ChatScheduleDto {
    weekday: number; // 0 = Dom, 1 = Seg, ..., 6 = Sáb
    time: string; // "HH:mm"
    title: string;
    priceCents: number;
    pix: string;
}

export interface CreateChatDto {
    workspaceId: string;
    chatId: string; // ID do chat na plataforma (WhatsApp)
    name?: string;
    label?: string;
    schedule?: ChatScheduleDto;
}

export interface UpdateChatDto {
    name?: string;
    label?: string;
    schedule?: ChatScheduleDto;
    status?: 'active' | 'inactive' | 'archived';
}

export interface UpdateScheduleDto {
    weekday?: number;
    time?: string;
    title?: string;
    priceCents?: number;
    pix?: string;
}

export interface ChatResponseDto {
    id: string;
    workspaceId: string;
    name: string;
    chatId: string;
    label?: string;
    type: 'group' | 'private';
    status: 'active' | 'inactive' | 'archived';
    memberCount: number;
    schedule?: ChatScheduleDto;
    lastMessage?: string;
    lastMessageAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface ListChatsDto {
    workspaceId?: string;
    status?: 'active' | 'inactive' | 'archived' | 'all';
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface PaginatedChatsResponseDto {
    chats: ChatResponseDto[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
}

export interface ChatsStatsDto {
    totalChats: number;
    activeChats: number;
    inactiveChats: number;
    archivedChats: number;
    chatsWithSchedule: number;
}
