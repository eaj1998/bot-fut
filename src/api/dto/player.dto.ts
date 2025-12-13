import { Types } from 'mongoose';

export interface CreatePlayerDto {
    name: string;
    phoneE164: string;
    email?: string;
    cpf?: string;
    nick?: string;
    isGoalie?: boolean;
    role?: 'admin' | 'user';
}

export interface UpdatePlayerDto {
    name?: string;
    phoneE164?: string;
    email?: string;
    cpf?: string;
    nick?: string;
    isGoalie?: boolean;
    role?: 'admin' | 'user';
    status?: 'active' | 'inactive';
}

export interface PlayerResponseDto {
    id: string;
    name: string;
    email?: string;
    phone: string;
    cpf?: string;
    nick?: string;
    isGoalie: boolean;
    status: 'active' | 'inactive';
    balance: number;
    totalDebt: number;
    role: 'admin' | 'user';
    joinDate: string;
    lastActivity: string;
    createdAt: string;
    updatedAt: string;
}

export interface ListPlayersDto {
    status?: 'active' | 'inactive' | 'all';
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: 'name' | 'createdAt' | 'totalDebt' | 'lastActivity';
    sortOrder?: 'asc' | 'desc';
}

export interface PaginatedPlayersResponseDto {
    players: PlayerResponseDto[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
    activeCount: number;
    withDebtsCount: number;
    inactiveCount: number;
}

export interface PlayersStatsDto {
    total: number;
    active: number;
    inactive: number;
    suspended: number;
    withDebts: number;
    totalDebt: number;
}
