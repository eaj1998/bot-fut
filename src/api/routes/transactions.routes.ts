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

// GET /api/transactions/my
// Retorna lista de transações (filtros e paginação podem ser implementados no futuro)
router.get('/my', controller.getMyTransactions);

// POST /api/transactions/:id/pay
// Processa o pagamento de uma transação
router.post('/:id/pay', controller.payTransaction);

export default router;
