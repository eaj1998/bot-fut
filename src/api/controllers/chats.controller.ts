import { Request, Response } from 'express';
import { injectable, inject } from 'tsyringe';
import { ChatService, CHATS_SERVICE_TOKEN } from '../../services/chat.service';
import { AuthRequest } from '../middleware/auth.middleware';

@injectable()
export class ChatsController {
    constructor(
        @inject(CHATS_SERVICE_TOKEN) private readonly chatService: ChatService
    ) { }

    /**
     * Lista todos os chats do workspace
     */
    listChats = async (req: AuthRequest, res: Response) => {
        try {
            // Enforce workspaceId from header or query, prioritizing header for security context
            const workspaceId = req.headers['x-workspace-id'] as string || req.query.workspaceId as string;

            if (!workspaceId) {
                return res.status(400).json({
                    success: false,
                    message: 'Workspace ID é obrigatório (header x-workspace-id)',
                    statusCode: 400,
                });
            }

            const filters = {
                workspaceId,
                status: req.query.status as any,
                search: req.query.search as string,
                page: req.query.page ? parseInt(req.query.page as string) : undefined,
                limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
                sortBy: req.query.sortBy as string,
                sortOrder: req.query.sortOrder as 'asc' | 'desc',
            };

            const result = await this.chatService.listChats(filters);
            res.json(result);
        } catch (error: any) {
            res.status(500).json({
                success: false,
                message: error.message || 'Erro ao listar chats',
                statusCode: 500,
            });
        }
    };

    /**
     * Obtém estatísticas gerais de chats
     */
    getStats = async (req: Request, res: Response) => {
        try {
            const stats = await this.chatService.getStats();
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
     * Obtém detalhes de um chat
     */
    getChatById = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const chat = await this.chatService.getChatById(id);
            res.json(chat);
        } catch (error: any) {
            const statusCode = error.message === 'Chat não encontrado' ? 404 : 500;
            res.status(statusCode).json({
                success: false,
                message: error.message || 'Erro ao obter chat',
                statusCode,
            });
        }
    };

    /**
     * Obtém schedule de um chat
     */
    getSchedule = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const schedule = await this.chatService.getSchedule(id);
            res.json(schedule || {});
        } catch (error: any) {
            const statusCode = error.message === 'Chat não encontrado' ? 404 : 500;
            res.status(statusCode).json({
                success: false,
                message: error.message || 'Erro ao obter schedule',
                statusCode,
            });
        }
    };

    /**
     * Cria/vincula um novo chat (bind)
     */
    createChat = async (req: Request, res: Response) => {
        try {
            const chat = await this.chatService.createChat(req.body);
            res.status(201).json(chat);
        } catch (error: any) {
            const statusCode = error.message.includes('já existe') ? 409 : 400;
            res.status(statusCode).json({
                success: false,
                message: error.message || 'Erro ao criar chat',
                statusCode,
            });
        }
    };

    /**
     * Atualiza um chat
     */
    updateChat = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const chat = await this.chatService.updateChat(id, req.body);
            res.json(chat);
        } catch (error: any) {
            const statusCode = error.message === 'Chat não encontrado' ? 404 : 500;
            res.status(statusCode).json({
                success: false,
                message: error.message || 'Erro ao atualizar chat',
                statusCode,
            });
        }
    };

    /**
     * Deleta um chat
     */
    deleteChat = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            await this.chatService.deleteChat(id);
            res.status(204).send();
        } catch (error: any) {
            const statusCode = error.message === 'Chat não encontrado' ? 404 : 500;
            res.status(statusCode).json({
                success: false,
                message: error.message || 'Erro ao deletar chat',
                statusCode,
            });
        }
    };

    /**
     * Atualiza schedule de um chat
     */
    updateSchedule = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const chat = await this.chatService.updateSchedule(id, req.body);
            res.json(chat);
        } catch (error: any) {
            const statusCode = error.message === 'Chat não encontrado' ? 404 : 500;
            res.status(statusCode).json({
                success: false,
                message: error.message || 'Erro ao atualizar schedule',
                statusCode,
            });
        }
    };

    /**
     * Ativa um chat
     */
    activateChat = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const chat = await this.chatService.activateChat(id);
            res.json(chat);
        } catch (error: any) {
            const statusCode = error.message === 'Chat não encontrado' ? 404 : 500;
            res.status(statusCode).json({
                success: false,
                message: error.message || 'Erro ao ativar chat',
                statusCode,
            });
        }
    };

    /**
     * Desativa um chat
     */
    deactivateChat = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const chat = await this.chatService.deactivateChat(id);
            res.json(chat);
        } catch (error: any) {
            const statusCode = error.message === 'Chat não encontrado' ? 404 : 500;
            res.status(statusCode).json({
                success: false,
                message: error.message || 'Erro ao desativar chat',
                statusCode,
            });
        }
    };
}
