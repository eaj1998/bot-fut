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
import { WORKSPACE_MEMBER_MODEL_TOKEN, IWorkspaceMember } from "../core/models/workspace-member.model";
import { EncryptionUtil } from "../utils/encryption.util";

@injectable()
export class WorkspaceService {
    constructor(
        @inject(WorkspaceRepository) private readonly repo: WorkspaceRepository,
        @inject(CHAT_MODEL_TOKEN) private readonly chatModel: Model<ChatDoc>,
        @inject(GAME_MODEL_TOKEN) private readonly gameModel: Model<IGame>,
        @inject(WORKSPACE_MEMBER_MODEL_TOKEN) private readonly workspaceMemberModel: Model<IWorkspaceMember>
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

    async findById(id: string) {
        return await this.repo.findById(id);
    }

    /**
     * Validates if user has access to a workspace
     * @throws Error if user is not a member or lacks required roles
     */
    private async validateUserAccess(
        userId: string,
        workspaceId: string,
        requiredRoles?: string[]
    ): Promise<void> {
        const member = await this.workspaceMemberModel.findOne({
            userId,
            workspaceId,
            status: 'ACTIVE'
        });

        if (!member) {
            throw new Error('Access denied: User is not a member of this workspace');
        }

        if (requiredRoles && requiredRoles.length > 0) {
            const memberRoles = member.roles.map(r => r.toUpperCase());
            const required = requiredRoles.map(r => r.toUpperCase());

            if (!memberRoles.some(r => required.includes(r))) {
                throw new Error('Access denied: Insufficient permissions');
            }
        }
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
                logoUrl: workspace.settings?.logoUrl,
                courtCostCents: workspace.settings?.courtCostCents || 0,
                refereeCostCents: workspace.settings?.refereeCostCents || 0,
                monthlyFeeCents: workspace.settings?.monthlyFeeCents || 0,
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
     * Retorna apenas workspaces onde o usuário é membro ativo
     */
    async listWorkspaces(
        userId: string,
        filters: ListWorkspacesDto
    ): Promise<PaginatedWorkspacesResponseDto> {
        const { search, page = 1, limit = 20, sortBy = "createdAt", sortOrder = "desc" } = filters;

        const memberships = await this.workspaceMemberModel.find({
            userId,
            status: 'ACTIVE'
        }).select('workspaceId').lean();

        const workspaceIds = memberships.map(m => m.workspaceId);

        if (workspaceIds.length === 0) {
            return {
                workspaces: [],
                total: 0,
                page,
                totalPages: 0,
                limit,
            };
        }

        const query: any = {
            _id: { $in: workspaceIds }
        };

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
     * Valida se o usuário é membro do workspace
     */
    async getWorkspaceById(userId: string, id: string): Promise<WorkspaceResponseDto> {
        const workspace = await this.repo.findById(id);
        if (!workspace) {
            throw new Error("Workspace não encontrado");
        }

        // Validate user access
        await this.validateUserAccess(userId, id);

        return this.toResponseDto(workspace);
    }

    /**
     * Cria um novo workspace e adiciona o criador como OWNER
     */
    async createWorkspace(userId: string, data: CreateWorkspaceDto): Promise<WorkspaceResponseDto> {
        if (!data.name || !data.slug) {
            throw new Error("Nome e slug são obrigatórios");
        }

        // Verifica se slug já existe
        const existing = await this.repo.findBySlug(data.slug);
        if (existing) {
            throw new Error("Já existe um workspace com este slug");
        }

        // Create workspace and membership in a transaction
        const session = await this.repo["model"].db.startSession();

        try {
            return await session.withTransaction(async () => {
                const workspace = await this.repo["model"].create([{
                    name: data.name,
                    slug: data.slug,
                    timezone: data.timezone || "America/Sao_Paulo",
                    settings: data.settings || {},
                }], { session });

                // Create WorkspaceMember record for the creator
                await this.workspaceMemberModel.create([{
                    userId,
                    workspaceId: workspace[0]._id,
                    roles: ['OWNER', 'ADMIN'],
                    status: 'ACTIVE',
                }], { session });

                return this.toResponseDto(workspace[0]);
            });
        } finally {
            session.endSession();
        }
    }

    /**
     * Atualiza um workspace
     * Requer que o usuário seja ADMIN ou OWNER
     */
    async updateWorkspace(
        userId: string,
        id: string,
        data: UpdateWorkspaceDto
    ): Promise<WorkspaceResponseDto> {
        const workspace = await this.repo.findById(id);
        if (!workspace) {
            throw new Error("Workspace não encontrado");
        }

        // Validate user has ADMIN or OWNER role
        await this.validateUserAccess(userId, id, ['ADMIN', 'OWNER']);

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
     * Requer que o usuário seja OWNER
     */
    async deleteWorkspace(userId: string, id: string): Promise<void> {
        const workspace = await this.repo.findById(id);
        if (!workspace) {
            throw new Error("Workspace não encontrado");
        }

        // Only OWNER can delete workspace
        await this.validateUserAccess(userId, id, ['OWNER']);

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
     * Valida se o usuário é membro do workspace
     */
    async getWorkspaceChats(userId: string, id: string) {
        const workspace = await this.repo.findById(id);
        if (!workspace) {
            throw new Error("Workspace não encontrado");
        }

        // Validate user access
        await this.validateUserAccess(userId, id);

        return this.chatModel.find({ workspaceId: workspace._id }).lean();
    }

    /**
     * Obtém estatísticas de um workspace
     * Valida se o usuário é membro do workspace
     */
    async getWorkspaceStats(userId: string, id: string): Promise<any> {
        const workspace = await this.repo.findById(id);
        if (!workspace) {
            throw new Error("Workspace não encontrado");
        }

        // Validate user access
        await this.validateUserAccess(userId, id);

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
     * Requer que o usuário seja ADMIN ou OWNER
     */
    async updateOrganizzeSettings(
        userId: string,
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

        // Validate user has ADMIN or OWNER role
        await this.validateUserAccess(userId, workspaceId, ['ADMIN', 'OWNER']);

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
     * Requer que o usuário seja ADMIN ou OWNER
     */
    async deleteOrganizzeSettings(userId: string, workspaceId: string): Promise<WorkspaceResponseDto> {
        const workspace = await this.repo.findById(workspaceId);
        if (!workspace) {
            throw new Error("Workspace não encontrado");
        }

        // Validate user has ADMIN or OWNER role
        await this.validateUserAccess(userId, workspaceId, ['ADMIN', 'OWNER']);

        await this.repo.clearOrganizzeConfig(workspaceId);

        const updatedWorkspace = await this.repo.findById(workspaceId);
        return this.toResponseDto(updatedWorkspace);
    }
}

export const WORKSPACES_SERVICE_TOKEN = "WORKSPACES_SERVICE_TOKEN";
