/**
 * DTOs para gerenciamento de Chats
 */

export interface ChatSettingsDto {
    language?: string;
    autoCreateGame?: boolean;
    autoCreateDaysBefore?: number;
    allowGuests?: boolean;
    requirePaymentProof?: boolean;
    sendReminders?: boolean;
}

export interface ChatFinancialsDto {
    defaultPriceCents?: number;
    pixKey?: string;
    pixKeyType?: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP';
    acceptsCash?: boolean;
}

export interface ChatScheduleDto {
    weekday?: number;
    time?: string;
    durationMinutes?: number;
    title?: string;
    location?: string;
    mapsLink?: string;
}

export interface CreateChatDto {
    workspaceId: string;
    chatId: string;
    name?: string;
    label?: string;
    platform?: 'WHATSAPP' | 'TELEGRAM';
    settings?: ChatSettingsDto;
    financials?: ChatFinancialsDto;
    schedule?: ChatScheduleDto;
}

export interface UpdateChatDto {
    status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' | 'SETUP_REQUIRED';
    label?: string;
    settings?: ChatSettingsDto;
    financials?: ChatFinancialsDto;
    schedule?: ChatScheduleDto;
}

// Para compatibilidade com rota específica de schedule, se houver
export interface UpdateScheduleDto {
    weekday?: number;
    time?: string;
    durationMinutes?: number;
    title?: string;
    location?: string;
    mapsLink?: string;
}

export interface ChatResponseDto {
    id: string;
    workspaceId: string;
    chatId: string;
    platform: string;
    status: string;
    label?: string;

    // Nested objects
    settings: {
        language: string;
        autoCreateGame: boolean;
        autoCreateDaysBefore: number;
        allowGuests: boolean;
        requirePaymentProof: boolean;
        sendReminders: boolean;
    };
    financials: {
        defaultPriceCents: number;
        pixKey?: string;
        pixKeyType?: string;
        acceptsCash: boolean;
    };
    schedule: {
        weekday?: number;
        time?: string;
        durationMinutes?: number;
        title?: string;
        location?: string;
        mapsLink?: string;
    };

    // Legacy/Computed fields support
    name?: string;
    memberCount?: number;

    createdAt: string;
    updatedAt: string;
}

export interface ListChatsDto {
    workspaceId?: string;
    status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' | 'SETUP_REQUIRED' | 'all';
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
    setupRequiredChats: number;
    chatsWithSchedule: number;
}
