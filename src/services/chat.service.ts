import { inject, injectable } from "tsyringe";
import { ChatRepository } from "../core/repositories/chat.repository";
import { Types, Model } from "mongoose";
import { CHAT_MODEL_TOKEN, ChatDoc, ChatStatus, PlatformType } from "../core/models/chat.model";
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
     * Lida com migração em tempo de execução para documentos legados
     */
    private toResponseDto(chat: any): ChatResponseDto {
        // Safe access defaults
        const settings = chat.settings || {};
        const financials = chat.financials || {};
        const schedule = chat.schedule || {};

        return {
            id: chat._id.toString(),
            workspaceId: chat.workspaceId.toString(),
            chatId: chat.chatId,
            platform: chat.platform || PlatformType.WHATSAPP,
            status: chat.status || ChatStatus.ACTIVE,
            label: chat.label,

            settings: {
                language: settings.language || 'pt-BR',
                autoCreateGame: settings.autoCreateGame !== undefined ? settings.autoCreateGame : true,
                autoCreateDaysBefore: settings.autoCreateDaysBefore || 2,
                allowGuests: settings.allowGuests !== undefined ? settings.allowGuests : true,
                requirePaymentProof: settings.requirePaymentProof || false,
                sendReminders: settings.sendReminders !== undefined ? settings.sendReminders : true,
            },
            financials: {
                defaultPriceCents: financials.defaultPriceCents || 0,
                pixKey: financials.pixKey,
                pixKeyType: financials.pixKeyType,
                acceptsCash: financials.acceptsCash !== undefined ? financials.acceptsCash : true,
            },
            schedule: {
                weekday: schedule.weekday,
                time: schedule.time,
                durationMinutes: schedule.durationMinutes || 60,
                title: schedule.title || '⚽ JOGO',
                location: schedule.location,
                mapsLink: schedule.mapsLink,
            },

            // Legacy support
            name: schedule.title || chat.label || 'Chat',
            memberCount: 0,

            createdAt: chat.createdAt?.toISOString() || new Date().toISOString(),
            updatedAt: chat.updatedAt?.toISOString() || new Date().toISOString(),
        };
    }

    async listChats(filters: ListChatsDto): Promise<PaginatedChatsResponseDto> {
        const { workspaceId, status, search, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = filters;

        const query: any = {};

        if (workspaceId) {
            query.workspaceId = new Types.ObjectId(workspaceId);
        }

        if (status && status !== 'all') {
            query.status = status;
        }

        if (search) {
            query.$or = [
                { chatId: { $regex: search, $options: 'i' } },
                { "schedule.title": { $regex: search, $options: 'i' } },
                { "settings.language": { $regex: search, $options: 'i' } }
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

    async getChatById(id: string): Promise<ChatResponseDto> {
        const chat = await this.chatModel.findById(id).lean();
        if (!chat) {
            throw new Error('Chat não encontrado');
        }
        return this.toResponseDto(chat);
    }

    async createChat(data: CreateChatDto): Promise<ChatResponseDto> {
        if (!data.workspaceId || !data.chatId) {
            throw new Error('Workspace e chatId são obrigatórios');
        }

        const existing = await this.chatModel.findOne({
            workspaceId: new Types.ObjectId(data.workspaceId),
            chatId: data.chatId
        }).lean();

        if (existing) {
            throw new Error('Já existe um chat com este chatId neste workspace');
        }

        const chat = await this.chatModel.create({
            workspaceId: new Types.ObjectId(data.workspaceId),
            chatId: data.chatId,
            platform: data.platform || PlatformType.WHATSAPP,
            status: ChatStatus.ACTIVE, // Start as active simply
            label: data.label || data.name, // Use provided label or name as internal label
            settings: data.settings || {}, // Mongoose defaults will trigger
            financials: data.financials || {},
            schedule: data.schedule || {}
        });

        return this.toResponseDto(chat.toObject());
    }

    async updateChat(id: string, data: UpdateChatDto): Promise<ChatResponseDto> {
        const chat = await this.chatModel.findById(id);
        if (!chat) {
            throw new Error('Chat não encontrado');
        }

        // Update root fields
        if (data.status) chat.status = data.status as ChatStatus;
        if (data.label !== undefined) chat.label = data.label;

        // Nested updates - merge with existing
        if (data.settings) {
            chat.settings = { ...chat.settings, ...data.settings };
        }
        if (data.financials) {
            chat.financials = { ...chat.financials, ...data.financials };
        }
        if (data.schedule) {
            chat.schedule = { ...chat.schedule, ...data.schedule };
        }

        await chat.save();
        return this.toResponseDto(chat.toObject());
    }

    async deleteChat(id: string): Promise<void> {
        const chat = await this.chatModel.findById(id);
        if (!chat) {
            throw new Error('Chat não encontrado');
        }
        await this.chatModel.findByIdAndDelete(id);
    }

    async updateSchedule(id: string, data: UpdateScheduleDto): Promise<ChatResponseDto> {
        const chat = await this.chatModel.findById(id);
        if (!chat) {
            throw new Error('Chat não encontrado');
        }

        // Only update schedule fields
        chat.schedule = { ...chat.schedule, ...data };

        await chat.save();
        return this.toResponseDto(chat.toObject());
    }

    async getSchedule(id: string) {
        const chat = await this.chatModel.findById(id).lean();
        if (!chat) {
            throw new Error('Chat não encontrado');
        }
        return chat.schedule || {};
    }

    async activateChat(id: string): Promise<ChatResponseDto> {
        return this.updateStatus(id, ChatStatus.ACTIVE);
    }

    async deactivateChat(id: string): Promise<ChatResponseDto> {
        return this.updateStatus(id, ChatStatus.INACTIVE);
    }

    private async updateStatus(id: string, status: ChatStatus): Promise<ChatResponseDto> {
        const updated = await this.chatModel.findByIdAndUpdate(
            id,
            { $set: { status } },
            { new: true }
        ).lean();

        if (!updated) {
            throw new Error('Chat não encontrado ou erro ao atualizar');
        }
        return this.toResponseDto(updated);
    }

    async getStats(): Promise<ChatsStatsDto> {
        const total = await this.chatModel.countDocuments();
        const active = await this.chatModel.countDocuments({ status: ChatStatus.ACTIVE });
        const inactive = await this.chatModel.countDocuments({ status: ChatStatus.INACTIVE });
        const archived = await this.chatModel.countDocuments({ status: ChatStatus.ARCHIVED });
        const setup = await this.chatModel.countDocuments({ status: ChatStatus.SETUP_REQUIRED });

        const withSchedule = await this.chatModel.countDocuments({
            "schedule.weekday": { $exists: true, $ne: null }
        });

        return {
            totalChats: total,
            activeChats: active,
            inactiveChats: inactive,
            archivedChats: archived,
            setupRequiredChats: setup,
            chatsWithSchedule: withSchedule,
        };
    }
}

export const CHATS_SERVICE_TOKEN = "CHATS_SERVICE_TOKEN";
