import { Router } from 'express';
import { container } from 'tsyringe';
import { MembershipsController } from '../controllers/memberships.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';

const router = Router();
const controller = container.resolve(MembershipsController);

router.use(authenticate);

// User endpoints

/**
 * @swagger
 * /api/memberships/my:
 *   get:
 *     summary: Obtém membership do usuário
 *     description: Retorna detalhes da assinatura do usuário logado em um workspace
 *     tags: [Memberships]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do workspace
 *     responses:
 *       200:
 *         description: Dados do membership
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/MembershipResponseDto'
 *       404:
 *         description: Membership não encontrado (retorna null em data)
 *       401:
 *         description: Não autenticado
 */
router.get('/my', controller.getMyMembership);

/**
 * @swagger
 * /api/memberships:
 *   post:
 *     summary: Cria um novo membership
 *     description: Usuário solicita criação de assinatura
 *     tags: [Memberships]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateMembershipDto'
 *     responses:
 *       201:
 *         description: Membership criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/MembershipResponseDto'
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autenticado
 */
router.post('/', controller.createMembership);

// Admin endpoints

/**
 * @swagger
 * /api/memberships/admin/create:
 *   post:
 *     summary: Cria membership para outro usuário
 *     description: Cria uma assinatura para um usuário específico (requer admin)
 *     tags: [Memberships]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateMembershipDto'
 *     responses:
 *       201:
 *         description: Membership criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/MembershipResponseDto'
 *       403:
 *         description: Sem permissão de admin
 */
router.post('/admin/create', requireAdmin, controller.createMembershipAdmin);

/**
 * @swagger
 * /api/memberships/admin/list:
 *   get:
 *     summary: Lista memberships
 *     description: Lista assinaturas com filtros (requer admin)
 *     tags: [Memberships]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do workspace
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *           enum: [all, active, pending, suspended, inactive]
 *         description: Filtro de status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Busca por nome ou telefone
 *     responses:
 *       200:
 *         description: Lista retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 memberships:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MembershipResponseDto'
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 */
router.get('/admin/list', requireAdmin, controller.getAdminList);

/**
 * @swagger
 * /api/memberships/{id}:
 *   put:
 *     summary: Atualiza membership
 *     description: Atualiza status ou valor da assinatura (requer admin)
 *     tags: [Memberships]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do membership
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateMembershipDto'
 *     responses:
 *       200:
 *         description: Membership atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/MembershipResponseDto'
 */
router.put('/:id', requireAdmin, controller.updateMembership);

/**
 * @swagger
 * /api/memberships/{id}/manual-payment:
 *   post:
 *     summary: Registra pagamento manual
 *     description: Registra um pagamento de assinatura manualmente (requer admin)
 *     tags: [Memberships]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do membership
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, method]
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Valor pago em reais
 *               method:
 *                 type: string
 *                 enum: [pix, dinheiro, transf, ajuste]
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Pagamento registrado com sucesso
 */
router.post('/:id/manual-payment', requireAdmin, controller.registerManualPayment);

/**
 * @swagger
 * /api/memberships/{id}/suspend:
 *   post:
 *     summary: Suspende membership
 *     description: Suspende uma assinatura (requer admin)
 *     tags: [Memberships]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do membership
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Membership suspenso com sucesso
 */
router.post('/:id/suspend', requireAdmin, controller.suspendMembership);

/**
 * @swagger
 * /api/memberships/admin/process-billing:
 *   post:
 *     summary: Processa faturamento mensal
 *     description: Executa a rotina de faturamento para assinaturas ativas de um workspace (requer admin)
 *     tags: [Memberships]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [workspaceId]
 *             properties:
 *               workspaceId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Processamento concluído
 */
router.post('/admin/process-billing', requireAdmin, controller.processMonthlyBilling);

/**
 * @swagger
 * /api/memberships/{workspaceId}/notify-invoices:
 *   post:
 *     summary: Notifica faturas pendentes
 *     description: Envia notificações WhatsApp para usuários com faturas de assinatura em aberto (requer admin)
 *     tags: [Memberships]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do workspace
 *     responses:
 *       200:
 *         description: Notificações enviadas
 */
router.post('/:workspaceId/notify-invoices', requireAdmin, controller.notifyInvoices);

// User/Admin endpoints (Controller checks permissions)

/**
 * @swagger
 * /api/memberships/{id}/cancel:
 *   post:
 *     summary: Cancela membership
 *     description: Solicita o cancelamento da assinatura. Admin pode forçar cancelamento imediato.
 *     tags: [Memberships]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               immediate:
 *                 type: boolean
 *                 description: Se true, cancela imediatamente (apenas admin ou regras específicas)
 *     responses:
 *       200:
 *         description: Solicitação processada com sucesso
 */
router.post('/:id/cancel', controller.cancelMembership);

export default router;
