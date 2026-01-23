import { Request, Response } from 'express';
import { injectable, inject } from 'tsyringe';
import { WorkspaceService, WORKSPACES_SERVICE_TOKEN } from '../../services/workspace.service';
import { AuthRequest } from '../middleware/auth.middleware';

@injectable()
export class WorkspacesController {
    constructor(
        @inject(WORKSPACES_SERVICE_TOKEN) private readonly workspaceService: WorkspaceService
    ) { }

    /**
     * Lista todos os workspaces do usuário autenticado
     */
    listWorkspaces = async (req: AuthRequest, res: Response) => {
        try {
            const userId = req.user!.id;
            const filters = {
                status: req.query.status as any,
                search: req.query.search as string,
                page: req.query.page ? parseInt(req.query.page as string) : undefined,
                limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
                sortBy: req.query.sortBy as string,
                sortOrder: req.query.sortOrder as 'asc' | 'desc',
            };

            const result = await this.workspaceService.listWorkspaces(userId, filters);
            res.json(result);
        } catch (error: any) {
            res.status(500).json({
                success: false,
                message: error.message || 'Erro ao listar workspaces',
                statusCode: 500,
            });
        }
    };

    /**
     * Obtém estatísticas gerais de workspaces
     */
    getStats = async (req: Request, res: Response) => {
        try {
            const stats = await this.workspaceService.getStats();
            res.json(stats);
        } catch (error: any) {
            res.status(500).json({
                success: false,
                message: error.message || 'Erro ao obter estatísticas',
                statusCode: 500,
            });
        }
    };

    /**
     * Obtém detalhes de um workspace
     */
    getWorkspaceById = async (req: AuthRequest, res: Response) => {
        try {
            const userId = req.user!.id;
            const { id } = req.params;
            const workspace = await this.workspaceService.getWorkspaceById(userId, id);
            res.json(workspace);
        } catch (error: any) {
            const statusCode = error.message.includes('Access denied') ? 403 :
                error.message === 'Workspace não encontrado' ? 404 : 500;
            res.status(statusCode).json({
                success: false,
                message: error.message || 'Erro ao obter workspace',
                statusCode,
            });
        }
    };

    /**
     * Obtém chats de um workspace
     */
    getWorkspaceChats = async (req: AuthRequest, res: Response) => {
        try {
            const userId = req.user!.id;
            const { id } = req.params;
            const chats = await this.workspaceService.getWorkspaceChats(userId, id);
            res.json(chats);
        } catch (error: any) {
            const statusCode = error.message.includes('Access denied') ? 403 :
                error.message === 'Workspace não encontrado' ? 404 : 500;
            res.status(statusCode).json({
                success: false,
                message: error.message || 'Erro ao obter chats',
                statusCode,
            });
        }
    };

    /**
     * Obtém estatísticas de um workspace
     */
    getWorkspaceStats = async (req: AuthRequest, res: Response) => {
        try {
            const userId = req.user!.id;
            const { id } = req.params;
            const stats = await this.workspaceService.getWorkspaceStats(userId, id);
            res.json(stats);
        } catch (error: any) {
            const statusCode = error.message.includes('Access denied') ? 403 :
                error.message === 'Workspace não encontrado' ? 404 : 500;
            res.status(statusCode).json({
                success: false,
                message: error.message || 'Erro ao obter estatísticas',
                statusCode,
            });
        }
    };

    /**
     * Cria um novo workspace
     */
    createWorkspace = async (req: AuthRequest, res: Response) => {
        try {
            const userId = req.user!.id;
            const workspace = await this.workspaceService.createWorkspace(userId, req.body);
            res.status(201).json(workspace);
        } catch (error: any) {
            const statusCode = error.message.includes('já existe') ? 409 : 400;
            res.status(statusCode).json({
                success: false,
                message: error.message || 'Erro ao criar workspace',
                statusCode,
            });
        }
    };

    /**
     * Atualiza um workspace
     */
    updateWorkspace = async (req: AuthRequest, res: Response) => {
        try {
            const userId = req.user!.id;
            const { id } = req.params;
            const workspace = await this.workspaceService.updateWorkspace(userId, id, req.body);
            res.json(workspace);
        } catch (error: any) {
            let statusCode = 500;
            if (error.message.includes('Access denied')) statusCode = 403;
            else if (error.message === 'Workspace não encontrado') statusCode = 404;
            else if (error.message.includes('já existe')) statusCode = 409;

            res.status(statusCode).json({
                success: false,
                message: error.message || 'Erro ao atualizar workspace',
                statusCode,
            });
        }
    };

    /**
     * Deleta um workspace
     */
    deleteWorkspace = async (req: AuthRequest, res: Response) => {
        try {
            const userId = req.user!.id;
            const { id } = req.params;
            await this.workspaceService.deleteWorkspace(userId, id);
            res.status(204).send();
        } catch (error: any) {
            let statusCode = 500;
            if (error.message.includes('Access denied')) statusCode = 403;
            else if (error.message === 'Workspace não encontrado') statusCode = 404;
            else if (error.message.includes('Não é possível deletar')) statusCode = 400;

            res.status(statusCode).json({
                success: false,
                message: error.message || 'Erro ao deletar workspace',
                statusCode,
            });
        }
    };

    /**
     * Atualiza configurações do Organizze para um workspace
     */
    updateOrganizzeSettings = async (req: AuthRequest, res: Response) => {
        try {
            const userId = req.user!.id;
            const { id } = req.params;
            const { email, apiKey, accountId, categories } = req.body;

            // Validate required fields (apiKey is optional - only update if provided)
            if (!email || !accountId || !categories) {
                return res.status(400).json({
                    success: false,
                    message: 'Email, accountId e categories são obrigatórios',
                    statusCode: 400,
                });
            }

            // Validate categories structure
            if (!categories.fieldPayment || !categories.playerPayment ||
                !categories.playerDebt || !categories.general) {
                return res.status(400).json({
                    success: false,
                    message: 'Todas as categorias devem ser fornecidas (fieldPayment, playerPayment, playerDebt, general)',
                    statusCode: 400,
                });
            }

            const workspace = await this.workspaceService.updateOrganizzeSettings(userId, id, {
                email,
                apiKey,
                accountId,
                categories,
            });

            res.json(workspace);
        } catch (error: any) {
            let statusCode = 500;
            if (error.message.includes('Access denied')) statusCode = 403;
            else if (error.message === 'Workspace não encontrado') statusCode = 404;

            res.status(statusCode).json({
                success: false,
                message: error.message || 'Erro ao atualizar configurações do Organizze',
                statusCode,
            });
        }
    };


    /**
     * Remove configurações do Organizze de um workspace
     */
    deleteOrganizzeSettings = async (req: AuthRequest, res: Response) => {
        try {
            const userId = req.user!.id;
            const { id } = req.params;
            const workspace = await this.workspaceService.deleteOrganizzeSettings(userId, id);
            res.json(workspace);
        } catch (error: any) {
            let statusCode = 500;
            if (error.message.includes('Access denied')) statusCode = 403;
            else if (error.message === 'Workspace não encontrado') statusCode = 404;

            res.status(statusCode).json({
                success: false,
                message: error.message || 'Erro ao remover configurações do Organizze',
                statusCode,
            });
        }
    };
}
