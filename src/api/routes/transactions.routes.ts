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
router.get('/balance', controller.getMyBalance);

// GET /api/transactions/stats
// Retorna estatísticas financeiras do workspace (Revenue, Expenses, Balance, Pending)
router.get('/stats', controller.getStats);

// GET /api/transactions/chart
// Retorna dados agregados para gráficos (receitas vs despesas por dia)
router.get('/chart', controller.getChartData);

// GET /api/transactions
// Retorna todas as transações (para admin)
router.get('/', controller.getAll);

// POST /api/transactions
// Cria uma nova transação (receita ou despesa)
router.post('/', controller.create);

// GET /api/transactions/my
// Retorna lista de transações (filtros e paginação podem ser implementados no futuro)
router.get('/my', controller.getMyTransactions);

// POST /api/transactions/:id/pay
// Processa o pagamento de uma transação
router.post('/:id/pay', controller.payTransaction);

// PUT /api/transactions/:id
// Atualiza status ou descrição de uma transação
router.put('/:id', controller.update);

// POST /api/transactions/:workspaceId/notify-singles
// Dispara cobrança de pendências avulsas (não mensais)
router.post('/:workspaceId/notify-singles', controller.notifySinglePayments);

export default router;
