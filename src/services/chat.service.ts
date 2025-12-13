import { inject, injectable } from "tsyringe";
import { ChatRepository } from "../core/repositories/chat.repository";
import { Types, Model } from "mongoose";
import { CHAT_MODEL_TOKEN, ChatDoc } from "../core/models/chat.model";
import {
    CreateChatDto,
    UpdateChatDto,
    UpdateScheduleDto,
    ChatResponseDto,
    ListChatsDto,
    PaginatedChatsResponseDto,
    ChatsStatsDto,
} from "../api/dto/chat.dto";

@injectable()
export class ChatService {
    constructor(
        @inject(ChatRepository) private readonly repo: ChatRepository,
        @inject(CHAT_MODEL_TOKEN) private readonly chatModel: Model<ChatDoc>
    ) { }

    async findByWorkspaceAndChat(workspaceId: Types.ObjectId, chatId: string) {
        return this.repo.findByWorkspaceAndChat(workspaceId, chatId);
    }

    /**
     * Converte documento do chat para DTO de resposta
     */
    private toResponseDto(chat: any): ChatResponseDto {
        return {
            id: chat._id.toString(),
            workspaceId: chat.workspaceId.toString(),
            name: chat.label || 'Chat',
            chatId: chat.chatId,
            label: chat.label,
            type: 'group', // Assumindo group por padrão
            status: 'active', // Chat model não tem status, assumindo active
            memberCount: 0, // Não temos essa informação no modelo atual
            schedule: chat.schedule ? {
                weekday: chat.schedule.weekday || 0,
                time: chat.schedule.time || '20:30',
                title: chat.schedule.title || '⚽ JOGO',
                priceCents: chat.schedule.priceCents || 1400,
                pix: chat.schedule.pix || '',
            } : undefined,
            lastMessage: undefined,
            lastMessageAt: undefined,
            createdAt: chat.createdAt?.toISOString() || new Date().toISOString(),
            updatedAt: chat.updatedAt?.toISOString() || new Date().toISOString(),
        };
    }

    /**
     * Lista chats com filtros e paginação
     */
    async listChats(filters: ListChatsDto): Promise<PaginatedChatsResponseDto> {
        const { workspaceId, search, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = filters;

        const query: any = {};

        if (workspaceId) {
            query.workspaceId = new Types.ObjectId(workspaceId);
        }

        if (search) {
            query.$or = [
                { chatId: { $regex: search, $options: 'i' } },
                { label: { $regex: search, $options: 'i' } },
            ];
        }

        const sort: any = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        const skip = (page - 1) * limit;

        const [chats, total] = await Promise.all([
            this.chatModel.find(query).sort(sort).skip(skip).limit(limit).lean(),
            this.chatModel.countDocuments(query),
        ]);

        const chatsDto = chats.map((chat) => this.toResponseDto(chat));

        return {
            chats: chatsDto,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            limit,
        };
    }

    /**
     * Obtém um chat por ID
     */
    async getChatById(id: string): Promise<ChatResponseDto> {
        const chat = await this.chatModel.findById(id).lean();
        if (!chat) {
            throw new Error('Chat não encontrado');
        }
        return this.toResponseDto(chat);
    }

    /**
     * Cria/vincula um novo chat (bind)
     */
    async createChat(data: CreateChatDto): Promise<ChatResponseDto> {
        if (!data.workspaceId || !data.chatId) {
            throw new Error('Workspace e chatId são obrigatórios');
        }

        // Verifica se chat já existe
        const existing = await this.chatModel.findOne({ chatId: data.chatId }).lean();
        if (existing) {
            throw new Error('Já existe um chat com este chatId');
        }

        const chat = await this.chatModel.create({
            workspaceId: new Types.ObjectId(data.workspaceId),
            chatId: data.chatId,
            label: data.label || data.name,
            schedule: data.schedule,
        });

        return this.toResponseDto(chat);
    }

    /**
     * Atualiza um chat
     */
    async updateChat(id: string, data: UpdateChatDto): Promise<ChatResponseDto> {
        const chat = await this.chatModel.findById(id);
        if (!chat) {
            throw new Error('Chat não encontrado');
        }

        const updated = await this.chatModel.findByIdAndUpdate(
            id,
            { $set: data },
            { new: true }
        ).lean();

        if (!updated) {
            throw new Error('Erro ao atualizar chat');
        }

        return this.toResponseDto(updated);
    }

    /**
     * Deleta um chat
     */
    async deleteChat(id: string): Promise<void> {
        const chat = await this.chatModel.findById(id);
        if (!chat) {
            throw new Error('Chat não encontrado');
        }

        await this.chatModel.findByIdAndDelete(id);
    }

    /**
     * Atualiza schedule de um chat
     */
    async updateSchedule(id: string, data: UpdateScheduleDto): Promise<ChatResponseDto> {
        const chat = await this.chatModel.findById(id);
        if (!chat) {
            throw new Error('Chat não encontrado');
        }

        const updated = await this.chatModel.findByIdAndUpdate(
            id,
            { $set: { schedule: data } },
            { new: true }
        ).lean();

        if (!updated) {
            throw new Error('Erro ao atualizar schedule');
        }

        return this.toResponseDto(updated);
    }

    /**
     * Obtém schedule de um chat
     */
    async getSchedule(id: string) {
        const chat = await this.chatModel.findById(id).lean();
        if (!chat) {
            throw new Error('Chat não encontrado');
        }

        return chat.schedule || null;
    }

    /**
     * Ativa um chat
     */
    async activateChat(id: string): Promise<ChatResponseDto> {
        const chat = await this.chatModel.findById(id).lean();
        if (!chat) {
            throw new Error('Chat não encontrado');
        }
        // futura implementacao, como nao tem status apenas retorna
        return this.toResponseDto(chat);
    }

    /**
     * Desativa um chat
     */
    async deactivateChat(id: string): Promise<ChatResponseDto> {
        const chat = await this.chatModel.findById(id).lean();
        if (!chat) {
            throw new Error('Chat não encontrado');
        }
        // futura implementacao, como nao tem status apenas retorna
        return this.toResponseDto(chat);
    }

    /**
     * Obtém estatísticas de chats
     */
    async getStats(): Promise<ChatsStatsDto> {
        const total = await this.chatModel.countDocuments();
        const withSchedule = await this.chatModel.countDocuments({
            schedule: { $exists: true, $ne: null },
        });

        return {
            totalChats: total,
            activeChats: total,
            inactiveChats: 0,
            archivedChats: 0,
            chatsWithSchedule: withSchedule,
        };
    }
}

export const CHATS_SERVICE_TOKEN = "CHATS_SERVICE_TOKEN";
