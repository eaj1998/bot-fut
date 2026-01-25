import { Request, Response } from 'express';
import { TransactionStatus } from '../../core/models/transaction.model';
import { inject, singleton, injectable } from 'tsyringe';
import { BBQService, BBQ_SERVICE_TOKEN } from '../../services/bbq.service';
import { asyncHandler } from '../middleware/error.middleware';
import {
    CreateBBQDto,
    UpdateBBQDto,
    UpdateBBQStatusDto,
    BBQResponseDto,
    BBQFilterDto,
    BBQStatus,
    BBQStatsDto
} from '../dto/bbq.dto';
import { IBBQ } from '../../core/models/bbq.model';
import { BBQRepository, BBQ_REPOSITORY_TOKEN } from '../../core/repositories/bbq.repository';

import { TransactionRepository, TRANSACTION_REPOSITORY_TOKEN } from '../../core/repositories/transaction.repository';
import { WorkspaceRepository } from '../../core/repositories/workspace.repository';
import { LoggerService } from '../../logger/logger.service';
import axios from 'axios';

@injectable()
export class BBQController {
    constructor(
        @inject(BBQ_SERVICE_TOKEN) private bbqService: BBQService,
        @inject(BBQ_REPOSITORY_TOKEN) private bbqRepository: BBQRepository,
        @inject(TRANSACTION_REPOSITORY_TOKEN) private transactionRepository: TransactionRepository,
        @inject(WorkspaceRepository) private workspaceRepository: WorkspaceRepository,
        @inject(LoggerService) private loggerService: LoggerService,
    ) { }

    private mapBBQToResponse(bbq: IBBQ): BBQResponseDto {
        return {
            id: bbq._id.toString(),
            chatId: bbq.chatId,
            workspaceId: bbq.workspaceId,
            description: bbq.description,
            status: bbq.status as BBQStatus,
            date: bbq.date.toISOString(),
            createdAt: bbq.createdAt.toISOString(),
            closedAt: bbq.closedAt?.toISOString(),
            finishedAt: bbq.finishedAt?.toISOString(),
            participants: bbq.participants.map(p => {
                const inviter = p.invitedBy
                    ? bbq.participants.find(participant => participant.userId === p.invitedBy)
                    : null;

                return {
                    userId: p.userId,
                    userName: p.userName,
                    invitedBy: p.invitedBy,
                    invitedByName: inviter?.userName || null,
                    isPaid: p.isPaid || false,
                    isGuest: p.isGuest || false,
                    isFree: p.isFree || false,
                    debtId: p.debtId,
                    transactionId: p.transactionId
                };
            }),
            financials: {
                meatCost: bbq.financials?.meatCost || 0,
                cookCost: bbq.financials?.cookCost || 0,
                ticketPrice: bbq.financials?.ticketPrice || 0
            },
            participantCount: bbq.participants.length,
        };
    }

    listBBQs = asyncHandler(async (req: Request, res: Response) => {
        const filters: BBQFilterDto = {
            status: req.query.status as BBQStatus,
            chatId: req.query.chatId as string,
            workspaceId: req.query.workspaceId as string,
            dateFrom: req.query.dateFrom as string,
            dateTo: req.query.dateTo as string,
            page: req.query.page ? parseInt(req.query.page as string) : 1,
            limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        };

        const query: any = {};

        if (filters.status) {
            query.status = filters.status;
        }

        if (filters.chatId) {
            query.chatId = filters.chatId;
        }

        if (filters.workspaceId) {
            query.workspaceId = filters.workspaceId;
        }

        if (filters.dateFrom || filters.dateTo) {
            query.date = {};
            if (filters.dateFrom) {
                query.date.$gte = new Date(filters.dateFrom);
            }
            if (filters.dateTo) {
                query.date.$lte = new Date(filters.dateTo);
            }
        }

        const page = filters.page || 1;
        const limit = filters.limit || 20;
        const skip = (page - 1) * limit;

        const [allBBQs, total] = await Promise.all([
            this.bbqRepository['model'].find(query).lean(),
            this.bbqRepository['model'].countDocuments(query),
        ]);

        const sortedBBQs = allBBQs.sort((a, b) => {
            const statusPriority: Record<string, number> = {
                'open': 0,
                'closed': 1,
                'finished': 2,
                'cancelled': 3
            };

            const priorityA = statusPriority[a.status] ?? 999;
            const priorityB = statusPriority[b.status] ?? 999;

            if (priorityA !== priorityB) {
                return priorityA - priorityB;
            }

            return new Date(b.date).getTime() - new Date(a.date).getTime();
        });

        const bbqs = sortedBBQs.slice(skip, skip + limit);

        const totalPages = Math.ceil(total / limit);

        res.json({
            success: true,
            data: {
                bbqs: bbqs.map(bbq => this.mapBBQToResponse(bbq as IBBQ)),
                total,
                page,
                totalPages,
                limit,
            },
        });
    });

    getBBQById = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const bbq = await this.bbqRepository.findById(id as string);

        if (!bbq) {
            res.status(404).json({
                success: false,
                message: 'BBQ não encontrado',
            });
            return;
        }

        res.json({
            success: true,
            data: this.mapBBQToResponse(bbq),
        });
    });

    getStats = asyncHandler(async (req: Request, res: Response) => {
        const workspaceId = req.query.workspaceId as string;

        const query: any = {};
        if (workspaceId) {
            query.workspaceId = workspaceId;
        }

        const [total, open, closed, finished, cancelled] = await Promise.all([
            this.bbqRepository['model'].countDocuments(query),
            this.bbqRepository['model'].countDocuments({ ...query, status: 'open' }),
            this.bbqRepository['model'].countDocuments({ ...query, status: 'closed' }),
            this.bbqRepository['model'].countDocuments({ ...query, status: 'finished' }),
            this.bbqRepository['model'].countDocuments({ ...query, status: 'cancelled' }),
        ]);

        const stats: BBQStatsDto = {
            total,
            open,
            closed,
            finished,
            cancelled,
        };

        res.json({
            success: true,
            data: stats,
        });
    });

    createBBQ = asyncHandler(async (req: Request, res: Response) => {
        const dto: CreateBBQDto = req.body;

        let date: Date;
        if (dto.date) {
            date = new Date(dto.date);
        } else {
            date = new Date();
            date.setUTCHours(0, 0, 0, 0);
        }

        const bbq = await this.bbqRepository.create(
            dto.workspaceId,
            dto.chatId,
            date
        );

        if (dto.description) {
            // Simple update for description if needed, or add to create method
            await this.bbqRepository['model'].findByIdAndUpdate(bbq._id, { description: dto.description });
        }

        const updatedBBQ = await this.bbqRepository.findById(bbq._id.toString());

        res.status(201).json({
            success: true,
            data: this.mapBBQToResponse(updatedBBQ!),
            message: 'BBQ criado com sucesso',
        });
    });

    togglePayment = asyncHandler(async (req: Request, res: Response) => {
        const { id, userId } = req.params;
        const { isPaid } = req.body;

        if (typeof isPaid !== 'boolean') {
            res.status(400).json({ success: false, message: 'isPaid deve ser um valor booleano' });
            return;
        }

        const bbq = await this.bbqRepository.findById(id as string);
        if (!bbq) {
            res.status(404).json({ success: false, message: 'BBQ não encontrado' });
            return;
        }

        const participant = bbq.participants.find(p => p.userId === userId);
        if (!participant) {
            res.status(404).json({ success: false, message: 'Participante não encontrado' });
            return;
        }

        if (participant.isFree) {
            res.status(400).json({ success: false, message: 'Participante isento não precisa pagar.' });
            return;
        }

        // If closed, transaction exists. Toggle status.
        if (bbq.status === 'closed' && participant.transactionId) {
            if (isPaid) {
                await this.transactionRepository.markAsPaid(participant.transactionId, new Date(), 'ajuste');
            } else {
                await this.transactionRepository.updateTransaction(participant.transactionId, { status: TransactionStatus.PENDING, paidAt: undefined });
            }
        }

        // Update BBQ model state
        const updatedBBQ = await this.bbqRepository.updateParticipantPaymentStatus(id as string, userId as string, isPaid);

        res.json({
            success: true,
            data: this.mapBBQToResponse(updatedBBQ!),
            message: `${participant.userName} marcado como ${isPaid ? 'pago' : 'pendente'}`,
        });
    });

    updateBBQ = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const dto: UpdateBBQDto = req.body;

        const bbq = await this.bbqRepository.findById(id as string);

        if (!bbq) {
            res.status(404).json({
                success: false,
                message: 'BBQ não encontrado',
            });
            return;
        }

        const updateData: any = {};

        if (dto.date) {
            const date = new Date(dto.date);

            updateData.date = date;
        }

        if (dto.description !== undefined) {
            updateData.description = dto.description;
        }

        if (dto.financials) {
            updateData.financials = { ...bbq.financials, ...dto.financials };
        }

        if (dto.status) {
            updateData.status = dto.status;

            if (dto.status === 'closed' && !bbq.closedAt) {
                updateData.closedAt = new Date();
            } else if (dto.status === 'finished' && !bbq.finishedAt) {
                updateData.finishedAt = new Date();
            }
        }

        const updatedBBQ = await this.bbqRepository['model'].findByIdAndUpdate(
            id,
            updateData,
            { new: true }
        ).lean();

        res.json({
            success: true,
            data: this.mapBBQToResponse(updatedBBQ as IBBQ),
            message: 'BBQ atualizado com sucesso',
        });
    });

    updateStatus = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const { status }: UpdateBBQStatusDto = req.body;

        const bbq = await this.bbqRepository.findById(id as string);

        if (!bbq) {
            res.status(404).json({
                success: false,
                message: 'BBQ não encontrado',
            });
            return;
        }

        const updateData: any = { status };

        if (status === 'closed' && !bbq.closedAt) {
            updateData.closedAt = new Date();
        } else if (status === 'finished' && !bbq.finishedAt) {
            updateData.finishedAt = new Date();
        }

        const updatedBBQ = await this.bbqRepository['model'].findByIdAndUpdate(
            id,
            updateData,
            { new: true }
        ).lean();

        res.json({
            success: true,
            data: this.mapBBQToResponse(updatedBBQ as IBBQ),
            message: 'Status do BBQ atualizado com sucesso',
        });
    });

    closeBBQ = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;

        const bbq = await this.bbqRepository.findById(id as string);

        if (!bbq) {
            res.status(404).json({
                success: false,
                message: 'BBQ não encontrado',
            });
            return;
        }

        if (bbq.status !== 'open') {
            res.status(400).json({
                success: false,
                message: 'BBQ já está fechado ou cancelado',
            });
            return;
        }

        if (!bbq.financials?.ticketPrice || bbq.financials.ticketPrice === 0) {
            res.status(400).json({
                success: false,
                message: 'Defina o valor por pessoa antes de fechar o churrasco',
            });
            return;
        }

        if (bbq.participants.length === 0) {
            res.status(400).json({
                success: false,
                message: 'Não há participantes no churrasco',
            });
            return;
        }

        const result = await this.bbqService.closeBBQ(bbq.workspaceId, bbq.chatId, bbq._id.toString());

        if (!result.success) {
            res.status(400).json(result);
            return;
        }

        const updatedBBQ = await this.bbqRepository.findById(id as string);
        const totalParticipants = updatedBBQ!.participants.length;
        const totalValue = (updatedBBQ!.financials.ticketPrice / 100) * totalParticipants; // Logic check on service

        res.json({
            success: true,
            data: this.mapBBQToResponse(updatedBBQ!),
            message: result.message,
        });
    });

    cancelBBQ = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const bbq = await this.bbqRepository.findById(id as string);
        if (!bbq) {
            res.status(404).json({ success: false, message: 'BBQ não encontrado' });
            return;
        }

        const result = await this.bbqService.cancelBBQ(bbq.workspaceId, bbq.chatId, bbq._id.toString());

        if (!result.success) {
            res.status(400).json(result);
            return;
        }

        const updatedBBQ = await this.bbqRepository.findById(id as string);

        res.json({
            success: true,
            data: this.mapBBQToResponse(updatedBBQ!),
            message: result.message,
        });
    });

    addParticipant = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const { userId, userName, invitedBy, guestName } = req.body;

        // Validation: Either (userId + userName) OR (invitedBy + guestName)
        const isGuest = !!invitedBy;
        const name = isGuest ? guestName : userName;

        if (isGuest) {
            if (!invitedBy || !guestName) {
                res.status(400).json({ success: false, message: 'invitedBy e guestName são obrigatórios para convidados' });
                return;
            }
        } else {
            if (!userId || !userName) {
                res.status(400).json({ success: false, message: 'userId e userName são obrigatórios' });
                return;
            }
        }

        const bbq = await this.bbqRepository.findById(id as string);
        if (!bbq) {
            res.status(404).json({ success: false, message: 'BBQ não encontrado' });
            return;
        }

        let result;
        if (invitedBy) {
            // "Inviter" placeholder for name, or fetch if needed. Service usually just needs ID.
            result = await this.bbqService.addGuest(bbq.workspaceId, bbq.chatId, invitedBy, "Inviter", name, id as string);
        } else {
            result = await this.bbqService.joinBBQ(bbq.workspaceId, bbq.chatId, userId, name, id as string);
        }

        if (!result.success) {
            res.status(400).json(result);
            return;
        }

        const updatedBBQ = await this.bbqRepository.findById(id as string);

        res.json({
            success: true,
            data: this.mapBBQToResponse(updatedBBQ!),
            message: result.message,
        });
    });

    removeParticipant = asyncHandler(async (req: Request, res: Response) => {
        const { id, userId } = req.params;
        const bbq = await this.bbqRepository.findById(id as string);

        if (!bbq) {
            res.status(404).json({ success: false, message: 'BBQ não encontrado' });
            return;
        }

        // Logic split: is it a guest removal or self removal?
        // Using generic leaveBBQ for user, but we might need removeGuest if it's a guest ID format
        // Simulating simple removal for API parity
        const result = await this.bbqService.leaveBBQ(bbq.workspaceId, bbq.chatId, userId as string, "User", id as string);

        if (!result.success) {
            // Fallback: try removing as guest logic if implemented distinctly or force repo removal
            // For now assume service handles it
            res.status(400).json(result);
            return;
        }

        const updatedBBQ = await this.bbqRepository.findById(id as string);

        res.json({
            success: true,
            data: this.mapBBQToResponse(updatedBBQ!),
            message: result.message,
        });
    });

    toggleParticipantPayment = asyncHandler(async (req: Request, res: Response) => {
        const { id, userId } = req.params;
        const { isPaid } = req.body;

        if (typeof isPaid !== 'boolean') {
            res.status(400).json({ success: false, message: 'isPaid deve ser um valor booleano' });
            return;
        }

        const bbq = await this.bbqRepository.findById(id as string);
        if (!bbq) {
            res.status(404).json({ success: false, message: 'BBQ não encontrado' });
            return;
        }

        const participant = bbq.participants.find(p => p.userId === userId);
        if (!participant) {
            res.status(404).json({ success: false, message: 'Participante não encontrado' });
            return;
        }

        if (participant.isFree) {
            res.status(400).json({ success: false, message: 'Participante isento não precisa pagar.' });
            return;
        }

        // If closed, transaction exists. Toggle status.
        if (bbq.status === 'closed' && participant.transactionId) {
            if (isPaid) {
                await this.transactionRepository.markAsPaid(participant.transactionId, new Date(), 'ajuste');
            } else {
                await this.transactionRepository.updateTransaction(participant.transactionId, { status: TransactionStatus.PENDING, paidAt: undefined });
            }
        }

        // Update BBQ model state
        const updatedBBQ = await this.bbqRepository.updateParticipantPaymentStatus(id as string, userId as string, isPaid);

        res.json({
            success: true,
            data: this.mapBBQToResponse(updatedBBQ!),
            message: `${participant.userName} marcado como ${isPaid ? 'pago' : 'pendente'}`,
        });
    });
}
