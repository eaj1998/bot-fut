import { Router } from 'express';
import { container } from 'tsyringe';
import { PlayerRatingsController } from '../controllers/player-ratings.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const controller = container.resolve(PlayerRatingsController);

router.use(authenticate);

/**
 * @swagger
 * /api/ratings:
 *   get:
 *     summary: Minhas avaliações
 *     description: Lista as avaliações feitas pelo usuário autenticado
 *     tags: [Ratings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de avaliações retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       ratedId:
 *                         type: string
 *                       score:
 *                         type: number
 *       401:
 *         description: Não autenticado
 */
router.get('/', controller.getUserRatings);

/**
 * @swagger
 * /api/ratings:
 *   post:
 *     summary: Avalia um jogador
 *     description: Envia uma avaliação (1-5) para outro jogador
 *     tags: [Ratings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - targetUserId
 *               - score
 *             properties:
 *               targetUserId:
 *                 type: string
 *                 description: ID do jogador sendo avaliado
 *               score:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *                 description: Nota da avaliação
 *     responses:
 *       201:
 *         description: Avaliação enviada com sucesso
 *       400:
 *         description: Dados inválidos ou auto-avaliação
 *       401:
 *         description: Não autenticado
 */
router.post('/', controller.createRating);

export default router;
