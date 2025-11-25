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
 * /api/dashboard/{workspaceId}:
 *   get:
 *     summary: Obtém dados completos do dashboard
 *     description: Retorna estatísticas agregadas e dados recentes de todos os módulos para um workspace específico
 *     tags: [Dashboard]
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do workspace
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
router.get('/:workspaceId', controller.getDashboard);

/**
 * @swagger
 * /api/dashboard/{workspaceId}/stats:
 *   get:
 *     summary: Obtém apenas estatísticas do dashboard
 *     description: Retorna estatísticas agregadas sem dados adicionais para um workspace específico
 *     tags: [Dashboard]
 *     parameters:
 *       - in: path
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
 *               $ref: '#/components/schemas/DashboardStatsDto'
 */
router.get('/:workspaceId/stats', controller.getStats);

export default router;
