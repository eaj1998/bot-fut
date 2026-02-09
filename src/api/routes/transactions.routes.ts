import { Router } from 'express';
import { container } from 'tsyringe';
import { TransactionsController } from '../controllers/transactions.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const controller = container.resolve(TransactionsController);

// Todas as rotas de transações requerem autenticação
router.use(authenticate);

// GET /api/transactions/balance
// Retorna o saldo do usuário (Total Pending) e histórico de transações pendentes/vencidas
/**
 * @swagger
 * /api/transactions/balance:
 *   get:
 *     summary: Obtém saldo do usuário
 *     description: Retorna o saldo (total pending) e histórico de transações pendentes/vencidas do usuário logado
 *     tags: [Transactions]
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
 *         description: Saldo retornado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalPending:
 *                   type: number
 *                 history:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TransactionResponseDto'
 *       400:
 *         description: Workspace ID não informado
 *       401:
 *         description: Não autenticado
 */
router.get('/balance', controller.getMyBalance);

// GET /api/transactions/stats
// Retorna estatísticas financeiras do workspace (Revenue, Expenses, Balance, Pending)
/**
 * @swagger
 * /api/transactions/stats:
 *   get:
 *     summary: Obtém estatísticas financeiras
 *     description: Retorna estatísticas financeiras agregadas de um workspace (receita, despesa, saldo, pendente)
 *     tags: [Transactions]
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
 *         description: Estatísticas retornadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 income:
 *                   type: number
 *                 expense:
 *                   type: number
 *                 balance:
 *                   type: number
 */
router.get('/stats', controller.getStats);

// GET /api/transactions/chart
// Retorna dados agregados para gráficos (receitas vs despesas por dia)
/**
 * @swagger
 * /api/transactions/chart:
 *   get:
 *     summary: Obtém dados para gráficos
 *     description: Retorna dados financeiros agregados por dia para gráficos
 *     tags: [Transactions]
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
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Número de dias para análise
 *     responses:
 *       200:
 *         description: Dados do gráfico
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   date:
 *                     type: string
 *                   income:
 *                     type: number
 *                   expense:
 *                     type: number
 */
router.get('/chart', controller.getChartData);

// GET /api/transactions
// Retorna todas as transações (para admin)
/**
 * @swagger
 * /api/transactions:
 *   get:
 *     summary: Lista transações (Admin)
 *     description: Retorna todas as transações com filtros (requer permissões de admin/visualização)
 *     tags: [Transactions]
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
 *         name: type
 *         schema:
 *           type: string
 *           enum: [INCOME, EXPENSE]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, COMPLETED, CANCELLED]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de transações
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 transactions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TransactionResponseDto'
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 */
router.get('/', controller.getAll);

// POST /api/transactions
// Cria uma nova transação (receita ou despesa)
/**
 * @swagger
 * /api/transactions:
 *   post:
 *     summary: Cria nova transação
 *     description: Cria uma nova transação financeira manual (receita ou despesa)
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateTransactionDto'
 *     responses:
 *       201:
 *         description: Transação criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TransactionResponseDto'
 *       400:
 *         description: Dados inválidos
 */
router.post('/', controller.create);

// GET /api/transactions/my
// Retorna lista de transações (filtros e paginação podem ser implementados no futuro)
/**
 * @swagger
 * /api/transactions/my:
 *   get:
 *     summary: Lista minhas transações
 *     description: Retorna o histórico de transações do usuário logado
 *     tags: [Transactions]
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
 *         description: Histórico de transações
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 transactions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TransactionResponseDto'
 *                 total:
 *                   type: integer
 */
router.get('/my', controller.getMyTransactions);

// POST /api/transactions/:id/pay
// Processa o pagamento de uma transação
/**
 * @swagger
 * /api/transactions/{id}/pay:
 *   post:
 *     summary: Pagar transação
 *     description: Registra o pagamento de uma transação pendente
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da transação
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               method:
 *                 type: string
 *                 enum: [pix, dinheiro, transf, ajuste]
 *                 default: pix
 *     responses:
 *       200:
 *         description: Pagamento registrado com sucesso
 *       404:
 *         description: Transação não encontrada
 *       400:
 *         description: Transação já paga ou erro
 */
router.post('/:id/pay', controller.payTransaction);

// PUT /api/transactions/:id
// Atualiza status ou descrição de uma transação
/**
 * @swagger
 * /api/transactions/{id}:
 *   put:
 *     summary: Atualiza transação
 *     description: Atualiza status ou descrição de uma transação existente (Admin)
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da transação
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateTransactionDto'
 *     responses:
 *       200:
 *         description: Transação atualizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TransactionResponseDto'
 */
router.put('/:id', controller.update);

// POST /api/transactions/:workspaceId/notify-singles
// Dispara cobrança de pendências avulsas (não mensais)
/**
 * @swagger
 * /api/transactions/{workspaceId}/notify-singles:
 *   post:
 *     summary: Notifica pendências avulsas
 *     description: Envia notificações WhatsApp para usuários com débitos avulsos pendentes no workspace (Admin)
 *     tags: [Transactions]
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 */
router.post('/:workspaceId/notify-singles', controller.notifySinglePayments);

export default router;
