/**
 * DTOs para gerenciamento de Workspaces
 */

export interface CreateWorkspaceDto {
    name: string;
    slug: string;
    timezone?: string;
    settings?: {
        maxPlayers?: number;
        pricePerGameCents?: number;
        commandsEnabled?: string[];
        pix?: string;
        title?: string;
    };
}

export interface UpdateWorkspaceDto {
    name?: string;
    slug?: string;
    timezone?: string;
    settings?: {
        maxPlayers?: number;
        pricePerGameCents?: number;
        commandsEnabled?: string[];
        pix?: string;
        title?: string;
    };
}

export interface WorkspaceResponseDto {
    id: string;
    name: string;
    slug: string;
    description: string;
    platform: 'whatsapp' | 'telegram' | 'discord';
    status: 'active' | 'inactive' | 'maintenance';
    timezone: string;
    totalChats: number;
    activeChats: number;
    settings: {
        maxPlayers: number;
        pricePerGame: number;
        pricePerGameCents: number;
        commandsEnabled: string[];
        pix?: string;
        title?: string;
    };
    organizzeConfig?: {
        email: string;
        hasApiKey: boolean;
        accountId: number;
        categories: {
            fieldPayment: number;
            playerPayment: number;
            playerDebt: number;
            general: number;
        };
    };
    createdAt: string;
    lastSync: string;
    updatedAt: string;
}

export interface ListWorkspacesDto {
    status?: 'active' | 'inactive' | 'maintenance' | 'all';
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface PaginatedWorkspacesResponseDto {
    workspaces: WorkspaceResponseDto[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
}

export interface WorkspaceStatsDto {
    totalWorkspaces: number;
    activeWorkspaces: number;
    inactiveWorkspaces: number;
    totalChats: number;
    totalGames: number;
    totalRevenue: number;
}
