import { Router } from 'express';
import { container } from 'tsyringe';
import { DebtsController } from '../controllers/debts.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';

const router = Router();
const controller = container.resolve(DebtsController);

// Rotas protegidas
router.use(authenticate);

/**
 * @swagger
 * /api/debts:
 *   get:
 *     summary: Lista todos os débitos
 *     description: Retorna uma lista paginada de débitos com filtros opcionais
 *     tags: [Debts]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, paid, overdue, cancelled, all]
 *         description: Filtrar por status
 *       - in: query
 *         name: playerId
 *         schema:
 *           type: string
 *         description: Filtrar por jogador
 *       - in: query
 *         name: gameId
 *         schema:
 *           type: string
 *         description: Filtrar por jogo
 *       - in: query
 *         name: workspaceId
 *         schema:
 *           type: string
 *         description: Filtrar por workspace
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
 *     responses:
 *       200:
 *         description: Lista de débitos
 */
router.get('/', controller.listDebts);

/**
 * @swagger
 * /api/debts/stats:
 *   get:
 *     summary: Obtém estatísticas de débitos
 *     description: Retorna estatísticas agregadas sobre débitos
 *     tags: [Debts]
 *     parameters:
 *       - in: query
 *         name: workspaceId
 *         schema:
 *           type: string
 *         description: Filtrar por workspace
 *     responses:
 *       200:
 *         description: Estatísticas de débitos
 */
router.get('/stats', controller.getStats);

/**
 * @swagger
 * /api/debts/{id}:
 *   get:
 *     summary: Obtém detalhes de um débito
 *     description: Retorna informações detalhadas de um débito específico
 *     tags: [Debts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detalhes do débito
 *       404:
 *         description: Débito não encontrado
 */
router.get('/:id', controller.getDebtById);

/**
 * @swagger
 * /api/debts:
 *   post:
 *     summary: Cria um novo débito
 *     description: Cria um novo débito para um jogador (requer autenticação de admin)
 *     tags: [Debts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - playerId
 *               - workspaceId
 *               - amount
 *             properties:
 *               playerId:
 *                 type: string
 *               workspaceId:
 *                 type: string
 *               gameId:
 *                 type: string
 *               amount:
 *                 type: number
 *                 example: 50.00
 *               notes:
 *                 type: string
 *               category:
 *                 type: string
 *                 enum: [field-payment, player-payment, player-debt, general]
 *     responses:
 *       201:
 *         description: Débito criado com sucesso
 *       400:
 *         description: Dados inválidos
 *       404:
 *         description: Jogador não encontrado
 */
router.post('/', requireAdmin, controller.createDebt);

/**
 * @swagger
 * /api/debts/{id}/pay:
 *   post:
 *     summary: Registra pagamento de débito
 *     description: Marca um débito como pago (requer autenticação)
 *     tags: [Debts]
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
 *               amount:
 *                 type: number
 *                 description: Valor pago (se parcial)
 *               method:
 *                 type: string
 *                 enum: [pix, dinheiro, transf]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Pagamento registrado
 *       404:
 *         description: Débito não encontrado
 */
router.post('/:id/pay', controller.payDebt);

/**
 * @swagger
 * /api/debts/{id}:
 *   delete:
 *     summary: Cancela um débito
 *     description: Cancela um débito existente (requer autenticação de admin)
 *     tags: [Debts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Débito cancelado
 *       404:
 *         description: Débito não encontrado
 */
router.delete('/:id', requireAdmin, controller.cancelDebt);

/**
 * @swagger
 * /api/debts/send-reminders:
 *   post:
 *     summary: Envia lembretes de pagamento
 *     description: Envia lembretes via WhatsApp para jogadores com débitos (requer autenticação de admin)
 *     tags: [Debts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               debtIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               workspaceId:
 *                 type: string
 *               onlyOverdue:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Lembretes enviados
 */
router.post('/send-reminders', requireAdmin, controller.sendReminders);

export default router;
