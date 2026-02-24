import { Types } from 'mongoose';

export interface DebtResponseDto {
    id: string;
    playerId: string;
    playerName: string;
    gameId?: string;
    gameName?: string;
    slot?: number;
    workspaceId: string;
    amount: number;
    amountCents: number;
    dueDate?: string;
    type: 'debit' | 'credit';
    status: "pendente" | "confirmado" | "estornado";
    notes?: string;
    category: string;
    createdAt: string;
    paidAt?: string;
    updatedAt: string;
}
