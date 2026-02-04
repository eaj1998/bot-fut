import { Request, Response } from 'express';
import { injectable, inject } from 'tsyringe';
import { MembershipService, MEMBERSHIP_SERVICE_TOKEN } from '../../services/membership.service';
import { MembershipRepository } from '../../core/repositories/membership.repository';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';

interface CreateMembershipDto {
    planValue: number; // em reais
}

interface UpdateMembershipDto {
    planValue?: number; // em reais
    billingDay?: number;
}

interface ManualPaymentDto {
    amount: number; // em reais
    method: 'pix' | 'dinheiro' | 'transf' | 'ajuste';
    description?: string;
}

interface SuspendMembershipDto {
    reason: string;
}

interface CancelMembershipDto {
    immediate: boolean;
}

@injectable()
export class MembershipsController {
    constructor(
        @inject(MEMBERSHIP_SERVICE_TOKEN) private membershipService: MembershipService
    ) { }

    /**
     * GET /api/memberships/my
     * Busca membership do usuário logado
     */
    getMyMembership = asyncHandler(async (req: AuthRequest, res: Response) => {
        const userId = req.user!.id;
        const workspaceId = req.query.workspaceId as string;

        if (!workspaceId) {
            return res.status(400).json({
                success: false,
                message: 'workspaceId é obrigatório'
            });
        }

        const membership = await this.membershipService.getMyMembership(userId, workspaceId);

        res.json({
            success: true,
            data: membership
        });
    });

    /**
     * POST /api/memberships
     * Criar nova membership
     */
    createMembership = asyncHandler(async (req: AuthRequest, res: Response) => {
        const userId = req.user!.id;
        const { planValue }: CreateMembershipDto = req.body;
        const workspaceId = req.body.workspaceId as string;

        if (!workspaceId) {
            return res.status(400).json({
                success: false,
                message: 'workspaceId é obrigatório'
            });
        }

        const planValueCents = Math.round(planValue * 100);
        const nextDueDate = MembershipRepository.calculateNextDueDate();

        const membership = await this.membershipService.createMembership({
            workspaceId,
            userId,
            planValue: planValueCents,
            startDate: new Date(),
            nextDueDate
        });

        res.status(201).json({
            success: true,
            data: membership,
            message: 'Membership criado com sucesso'
        });
    });

    // ==================== ADMIN ENDPOINTS ====================

    /**
     * GET /api/memberships/admin/list
     * Lista todas as memberships (admin)
     */
    getAdminList = asyncHandler(async (req: Request, res: Response) => {
        const workspaceId = req.query.workspaceId as string;
        const page = req.query.page ? parseInt(req.query.page as string) : 1;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
        const filter = req.query.filter as string | undefined;
        const search = req.query.search as string | undefined;

        if (!workspaceId) {
            return res.status(400).json({
                success: false,
                message: 'workspaceId é obrigatório'
            });
        }

        const result = await this.membershipService.getAdminList(workspaceId, page, limit, filter, search);

        res.json({
            success: true,
            ...result
        });
    });

    /**
     * POST /api/memberships/admin/create
     * Criar membership para um usuário específico (admin)
     */
    createMembershipAdmin = asyncHandler(async (req: Request, res: Response) => {
        const { userId, planValue, workspaceId, billingDay } = req.body;

        if (!userId || !workspaceId || planValue === undefined) {
            return res.status(400).json({
                success: false,
                message: 'userId, workspaceId e planValue são obrigatórios'
            });
        }

        const planValueCents = Math.round(planValue * 100);
        const nextDueDate = MembershipRepository.calculateNextDueDate(undefined, billingDay, false);

        const membership = await this.membershipService.createMembership({
            workspaceId,
            userId,
            planValue: planValueCents,
            startDate: new Date(),
            nextDueDate
        });

        res.status(201).json({
            success: true,
            data: membership,
            message: 'Membership criado com sucesso'
        });
    });

    /**
     * PUT /api/memberships/:id
     * Atualizar membership (admin)
     */
    updateMembership = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const dto: UpdateMembershipDto = req.body;

        const membership = await this.membershipService.updateMembership(id as string, dto);

        res.json({
            success: true,
            data: membership,
            message: 'Membership atualizado com sucesso'
        });
    });

    /**
     * POST /api/memberships/:id/manual-payment
     * Registrar pagamento manual (admin GOD MODE!)
     */
    registerManualPayment = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const dto: ManualPaymentDto = req.body;

        const result = await this.membershipService.registerManualPayment(id as string, dto);

        res.json({
            success: true,
            data: result,
            message: '✅ Pagamento registrado! Membership reativado.'
        });
    });

    /**
     * POST /api/memberships/:id/suspend
     * Suspender membership manualmente (admin)
     */
    suspendMembership = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const { reason }: SuspendMembershipDto = req.body;

        const membership = await this.membershipService.suspendMembership(id as string, reason);

        res.json({
            success: true,
            data: membership,
            message: 'Membership suspenso com sucesso'
        });
    });

    /**
     * POST /api/memberships/:id/cancel
     * Cancelar membership (admin)
     */
    cancelMembership = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { id } = req.params;
        const { immediate }: CancelMembershipDto = req.body;
        const userId = req.user!.id;
        const role = req.user!.role;
        const result = await this.membershipService.cancelMembership(id as string, immediate, userId, role);

        res.json({
            success: true,
            data: result,
            message: immediate
                ? 'Membership cancelado imediatamente'
                : 'Membership agendado para cancelamento'
        });
    });
    /**
     * POST /api/memberships/admin/process-billing
     * Processa a cobrança mensal de assinaturas ativas
     */
    processMonthlyBilling = asyncHandler(async (req: Request, res: Response) => {
        const { workspaceId } = req.body;

        if (!workspaceId) {
            return res.status(400).json({
                success: false,
                message: 'workspaceId é obrigatório'
            });
        }

        const result = await this.membershipService.processMonthlyBilling(workspaceId);

        res.json({
            success: true,
            message: `Processamento concluído: ${result.created} cobranças geradas.`,
            data: result
        });
    });

    /**
     * POST /api/memberships/:workspaceId/notify-invoices
     * Envia notificações WhatsApp para usuários com faturas pendentes
     */
    notifyInvoices = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { workspaceId } = req.params;

        if (!workspaceId) {
            return res.status(400).json({
                success: false,
                message: 'workspaceId é obrigatório'
            });
        }

        const report = await this.membershipService.notifyPendingInvoices(workspaceId);

        return res.status(200).json({
            success: true,
            message: 'Notificações enviadas',
            data: report
        });
    });
}
