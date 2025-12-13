import { Message } from "whatsapp-web.js";
import { inject, injectable } from "tsyringe";
import { WorkspaceRepository } from "../core/repositories/workspace.repository";
import { ChatModel } from "../core/models/chat.model";
import { GameModel } from "../core/models/game.model";
import {
    CreateWorkspaceDto,
    UpdateWorkspaceDto,
    WorkspaceResponseDto,
    ListWorkspacesDto,
    PaginatedWorkspacesResponseDto,
    WorkspaceStatsDto,
} from "../api/dto/workspace.dto";
import { Model, Types } from "mongoose";
import { CHAT_MODEL_TOKEN, ChatDoc } from "../core/models/chat.model";
import { GAME_MODEL_TOKEN, IGame } from "../core/models/game.model";
import { EncryptionUtil } from "../utils/encryption.util";

@injectable()
export class WorkspaceService {
    constructor(
        @inject(WorkspaceRepository) private readonly repo: WorkspaceRepository,
        @inject(CHAT_MODEL_TOKEN) private readonly chatModel: Model<ChatDoc>,
        @inject(GAME_MODEL_TOKEN) private readonly gameModel: Model<IGame>
    ) { }

    async resolveWorkspaceFromMessage(message: Message) {
        const chat = await message.getChat();
        const chatId = chat.id._serialized;
        const workspace = await this.repo.getWorkspaceByChat(chatId);
        return { chatId, chat, workspace };
    }

    async resolveWorkspaceBySlug(slug: string) {
        return await this.repo.findBySlug(slug);
    }

    /**
     * Converte documento do workspace para DTO de resposta
     */
    private async toResponseDto(workspace: any): Promise<WorkspaceResponseDto> {
        // Conta chats do workspace
        const totalChats = await this.chatModel.countDocuments({
            workspaceId: workspace._id,
        });

        const activeChats = await this.chatModel.countDocuments({
            workspaceId: workspace._id,
            // Assuming active chats have some criteria
        });

        return {
            id: workspace._id.toString(),
            name: workspace.name,
            slug: workspace.slug,
            description: `Workspace ${workspace.name}`,
            platform: "whatsapp",
            status: "active",
            timezone: workspace.timezone || "America/Sao_Paulo",
            totalChats,
            activeChats,
            settings: {
                maxPlayers: workspace.settings?.maxPlayers || 16,
                pricePerGame: (workspace.settings?.pricePerGameCents || 1400) / 100,
                pricePerGameCents: workspace.settings?.pricePerGameCents || 1400,
                commandsEnabled: workspace.settings?.commandsEnabled || [],
                pix: workspace.settings?.pix,
                title: workspace.settings?.title,
            },
            organizzeConfig: workspace.organizzeConfig ? {
                email: workspace.organizzeConfig.email ?
                    EncryptionUtil.decrypt(workspace.organizzeConfig.email) :
                    '',
                hasApiKey: !!workspace.organizzeConfig.apiKey,
                accountId: workspace.organizzeConfig.accountId,
                categories: workspace.organizzeConfig.categories,
            } : undefined,
            createdAt:
                workspace.createdAt?.toISOString() || new Date().toISOString(),
            lastSync:
                workspace.updatedAt?.toISOString() || new Date().toISOString(),
            updatedAt:
                workspace.updatedAt?.toISOString() || new Date().toISOString(),
        };
    }

    /**
     * Lista workspaces com filtros e paginação
     */
    async listWorkspaces(
        filters: ListWorkspacesDto
    ): Promise<PaginatedWorkspacesResponseDto> {
        const { search, page = 1, limit = 20, sortBy = "createdAt", sortOrder = "desc" } = filters;

        const query: any = {};

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { slug: { $regex: search, $options: "i" } },
            ];
        }

        const sort: any = {};
        sort[sortBy] = sortOrder === "asc" ? 1 : -1;

        const skip = (page - 1) * limit;

        const workspaces = await this.repo["model"]
            .find(query)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await this.repo["model"].countDocuments(query);

        const workspacesDto = await Promise.all(
            workspaces.map((ws) => this.toResponseDto(ws))
        );

        return {
            workspaces: workspacesDto,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            limit,
        };
    }

    /**
     * Obtém um workspace por ID
     */
    async getWorkspaceById(id: string): Promise<WorkspaceResponseDto> {
        const workspace = await this.repo.findById(id);
        if (!workspace) {
            throw new Error("Workspace não encontrado");
        }
        return this.toResponseDto(workspace);
    }

    /**
     * Cria um novo workspace
     */
    async createWorkspace(data: CreateWorkspaceDto): Promise<WorkspaceResponseDto> {
        if (!data.name || !data.slug) {
            throw new Error("Nome e slug são obrigatórios");
        }

        // Verifica se slug já existe
        const existing = await this.repo.findBySlug(data.slug);
        if (existing) {
            throw new Error("Já existe um workspace com este slug");
        }

        const workspace = await this.repo["model"].create({
            name: data.name,
            slug: data.slug,
            timezone: data.timezone || "America/Sao_Paulo",
            settings: data.settings || {},
        });

        return this.toResponseDto(workspace);
    }

    /**
     * Atualiza um workspace
     */
    async updateWorkspace(
        id: string,
        data: UpdateWorkspaceDto
    ): Promise<WorkspaceResponseDto> {
        const workspace = await this.repo.findById(id);
        if (!workspace) {
            throw new Error("Workspace não encontrado");
        }

        // Verifica se o novo slug já está em uso
        if (data.slug && data.slug !== workspace.slug) {
            const existing = await this.repo.findBySlug(data.slug);
            if (existing) {
                throw new Error("Já existe um workspace com este slug");
            }
        }

        const updated = await this.repo["model"].findByIdAndUpdate(
            id,
            { $set: data },
            { new: true }
        );

        if (!updated) {
            throw new Error("Erro ao atualizar workspace");
        }

        return this.toResponseDto(updated);
    }

    /**
     * Deleta um workspace
     */
    async deleteWorkspace(id: string): Promise<void> {
        const workspace = await this.repo.findById(id);
        if (!workspace) {
            throw new Error("Workspace não encontrado");
        }

        // Verifica se tem chats vinculados
        const chatsCount = await this.chatModel.countDocuments({
            workspaceId: workspace._id,
        });

        if (chatsCount > 0) {
            throw new Error(
                `Não é possível deletar workspace com ${chatsCount} chat(s) vinculado(s)`
            );
        }

        await this.repo["model"].findByIdAndDelete(id);
    }

    /**
     * Obtém chats de um workspace
     */
    async getWorkspaceChats(id: string) {
        const workspace = await this.repo.findById(id);
        if (!workspace) {
            throw new Error("Workspace não encontrado");
        }

        return this.chatModel.find({ workspaceId: workspace._id }).lean();
    }

    /**
     * Obtém estatísticas de um workspace
     */
    async getWorkspaceStats(id: string): Promise<any> {
        const workspace = await this.repo.findById(id);
        if (!workspace) {
            throw new Error("Workspace não encontrado");
        }

        const totalChats = await this.chatModel.countDocuments({
            workspaceId: workspace._id,
        });

        const totalGames = await this.gameModel.countDocuments({
            workspaceId: workspace._id,
        });

        const upcomingGames = await this.gameModel.countDocuments({
            workspaceId: workspace._id,
            startDate: { $gte: new Date() },
        });

        return {
            totalChats,
            totalGames,
            upcomingGames,
        };
    }

    /**
     * Obtém estatísticas gerais de workspaces
     */
    async getStats(): Promise<WorkspaceStatsDto> {
        const total = await this.repo["model"].countDocuments();
        const totalChats = await this.chatModel.countDocuments();
        const totalGames = await this.gameModel.countDocuments();

        return {
            totalWorkspaces: total,
            activeWorkspaces: total, // Todos considerados ativos por enquanto
            inactiveWorkspaces: 0,
            totalChats,
            totalGames,
            totalRevenue: 0, // Poderia calcular via Ledger
        };
    }

    /**
     * Atualiza configurações do Organizze para um workspace
     */
    async updateOrganizzeSettings(
        workspaceId: string,
        settings: {
            email: string;
            apiKey?: string;
            accountId: number;
            categories: {
                fieldPayment: number;
                playerPayment: number;
                playerDebt: number;
                general: number;
            };
        }
    ): Promise<any> {
        const workspace = await this.repo.findById(workspaceId);
        if (!workspace) {
            throw new Error("Workspace não encontrado");
        }

        // Only update apiKey if provided, otherwise keep existing
        const updatedSettings = {
            email: settings.email,
            apiKey: settings.apiKey || workspace.organizzeConfig?.apiKey,
            accountId: settings.accountId,
            categories: settings.categories,
        };

        // Update Organizze config (encryption happens in repository)
        await this.repo.updateOrganizzeConfig(workspaceId, updatedSettings);

        // Return workspace with sanitized Organizze config (no API key exposed)
        const organizzeConfig = await this.repo.getOrganizzeConfigForResponse(workspaceId);

        const responseDto = await this.toResponseDto(workspace);

        return {
            ...responseDto,
            organizzeConfig,
        };
    }

    /**
     * Remove configurações do Organizze de um workspace
     */
    async deleteOrganizzeSettings(workspaceId: string): Promise<WorkspaceResponseDto> {
        const workspace = await this.repo.findById(workspaceId);
        if (!workspace) {
            throw new Error("Workspace não encontrado");
        }

        await this.repo.clearOrganizzeConfig(workspaceId);

        const updatedWorkspace = await this.repo.findById(workspaceId);
        return this.toResponseDto(updatedWorkspace);
    }
}

export const WORKSPACES_SERVICE_TOKEN = "WORKSPACES_SERVICE_TOKEN";
