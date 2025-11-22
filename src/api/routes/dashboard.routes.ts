import { Router } from 'express';
import { container } from 'tsyringe';
import { DashboardController } from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const controller = container.resolve(DashboardController);

// Rotas protegidas
router.use(authenticate);

/**
 * @swagger
 * /api/dashboard:
 *   get:
 *     summary: Obtém dados completos do dashboard
 *     description: Retorna estatísticas agregadas e dados recentes de todos os módulos
 *     tags: [Dashboard]
 *     parameters:
 *       - in: query
 *         name: workspaceId
 *         schema:
 *           type: string
 *         description: Filtrar por workspace específico
 *     responses:
 *       200:
 *         description: Dados do dashboard retornados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 stats:
 *                   $ref: '#/components/schemas/DashboardStatsDto'
 *                 recentGames:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       date:
 *                         type: string
 *                       time:
 *                         type: string
 *                       status:
 *                         type: string
 *                       currentPlayers:
 *                         type: integer
 *                       maxPlayers:
 *                         type: integer
 *                 recentDebts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       playerName:
 *                         type: string
 *                       amount:
 *                         type: number
 *                       status:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                 monthlyRevenue:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       month:
 *                         type: string
 *                       value:
 *                         type: number
 */
router.get('/', controller.getDashboard);

/**
 * @swagger
 * /api/dashboard/stats:
 *   get:
 *     summary: Obtém apenas estatísticas do dashboard
 *     description: Retorna estatísticas agregadas sem dados adicionais
 *     tags: [Dashboard]
 *     parameters:
 *       - in: query
 *         name: workspaceId
 *         schema:
 *           type: string
 *         description: Filtrar por workspace específico
 *     responses:
 *       200:
 *         description: Estatísticas retornadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DashboardStatsDto'
 */
router.get('/stats', controller.getStats);

export default router;
