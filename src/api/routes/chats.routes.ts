import { Router } from 'express';
import { container } from 'tsyringe';
import { ChatsController } from '../controllers/chats.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';

const router = Router();
const controller = container.resolve(ChatsController);

/**
 * @swagger
 * /api/chats:
 *   get:
 *     summary: Lista todos os chats
 *     description: Retorna uma lista paginada de chats com filtros opcionais
 *     tags: [Chats]
 *     parameters:
 *       - in: query
 *         name: workspaceId
 *         schema:
 *           type: string
 *         description: Filtrar por workspace
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, archived, all]
 *         description: Filtrar por status do chat
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar por chatId ou label
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número da página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Itens por página
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [label, createdAt]
 *         description: Campo para ordenação
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Direção da ordenação
 *     responses:
 *       200:
 *         description: Lista de chats retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 chats:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ChatResponseDto'
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 limit:
 *                   type: integer
 */
router.get('/', controller.listChats);

/**
 * @swagger
 * /api/chats/stats:
 *   get:
 *     summary: Obtém estatísticas de chats
 *     description: Retorna estatísticas agregadas sobre chats
 *     tags: [Chats]
 *     responses:
 *       200:
 *         description: Estatísticas retornadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalChats:
 *                   type: integer
 *                 activeChats:
 *                   type: integer
 *                 inactiveChats:
 *                   type: integer
 *                 archivedChats:
 *                   type: integer
 *                 chatsWithSchedule:
 *                   type: integer
 */
router.get('/stats', controller.getStats);

/**
 * @swagger
 * /api/chats/{id}:
 *   get:
 *     summary: Obtém detalhes de um chat
 *     description: Retorna informações detalhadas de um chat específico
 *     tags: [Chats]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do chat
 *     responses:
 *       200:
 *         description: Detalhes do chat
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatResponseDto'
 *       404:
 *         description: Chat não encontrado
 */
router.get('/:id', controller.getChatById);

/**
 * @swagger
 * /api/chats/{id}/schedule:
 *   get:
 *     summary: Obtém schedule de um chat
 *     description: Retorna configuração de schedule de um chat
 *     tags: [Chats]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do chat
 *     responses:
 *       200:
 *         description: Schedule do chat
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatScheduleDto'
 *       404:
 *         description: Chat não encontrado
 */
router.get('/:id/schedule', controller.getSchedule);

// Rotas protegidas (requerem autenticação)
router.use(authenticate);

/**
 * @swagger
 * /api/chats:
 *   post:
 *     summary: Cria/vincula um novo chat (bind)
 *     description: Vincula um chat do WhatsApp a um workspace (requer autenticação de admin)
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - workspaceId
 *               - chatId
 *             properties:
 *               workspaceId:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439011"
 *               chatId:
 *                 type: string
 *                 example: "120363123456789012@g.us"
 *               name:
 *                 type: string
 *                 example: "Grupo Campo Viana"
 *               label:
 *                 type: string
 *                 example: "Viana Segunda"
 *               schedule:
 *                 type: object
 *                 properties:
 *                   weekday:
 *                     type: integer
 *                     minimum: 0
 *                     maximum: 6
 *                     example: 1
 *                   time:
 *                     type: string
 *                     example: "20:30"
 *                   title:
 *                     type: string
 *                     example: "⚽ CAMPO DO VIANA"
 *                   priceCents:
 *                     type: integer
 *                     example: 1400
 *                   pix:
 *                     type: string
 *                     example: "+5549999999999"
 *     responses:
 *       201:
 *         description: Chat criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatResponseDto'
 *       400:
 *         description: Dados inválidos
 *       409:
 *         description: Chat já existe
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão de admin
 */
router.post('/', requireAdmin, controller.createChat);

/**
 * @swagger
 * /api/chats/{id}:
 *   put:
 *     summary: Atualiza um chat
 *     description: Atualiza informações de um chat existente (requer autenticação de admin)
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do chat
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               label:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [active, inactive, archived]
 *               schedule:
 *                 type: object
 *                 properties:
 *                   weekday:
 *                     type: integer
 *                   time:
 *                     type: string
 *                   title:
 *                     type: string
 *                   priceCents:
 *                     type: integer
 *                   pix:
 *                     type: string
 *     responses:
 *       200:
 *         description: Chat atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatResponseDto'
 *       404:
 *         description: Chat não encontrado
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão de admin
 */
router.put('/:id', requireAdmin, controller.updateChat);

/**
 * @swagger
 * /api/chats/{id}:
 *   delete:
 *     summary: Deleta um chat
 *     description: Remove um chat do sistema (requer autenticação de admin)
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do chat
 *     responses:
 *       204:
 *         description: Chat deletado com sucesso
 *       404:
 *         description: Chat não encontrado
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão de admin
 */
router.delete('/:id', requireAdmin, controller.deleteChat);

/**
 * @swagger
 * /api/chats/{id}/schedule:
 *   put:
 *     summary: Atualiza schedule de um chat
 *     description: Configura/atualiza schedule de um chat (requer autenticação de admin)
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do chat
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               weekday:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 6
 *               time:
 *                 type: string
 *               title:
 *                 type: string
 *               priceCents:
 *                 type: integer
 *               pix:
 *                 type: string
 *     responses:
 *       200:
 *         description: Schedule atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatResponseDto'
 *       404:
 *         description: Chat não encontrado
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão de admin
 */
router.put('/:id/schedule', requireAdmin, controller.updateSchedule);

/**
 * @swagger
 * /api/chats/{id}/activate:
 *   post:
 *     summary: Ativa um chat
 *     description: Ativa um chat inativo ou arquivado (requer autenticação de admin)
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do chat
 *     responses:
 *       200:
 *         description: Chat ativado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatResponseDto'
 *       404:
 *         description: Chat não encontrado
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão de admin
 */
router.post('/:id/activate', requireAdmin, controller.activateChat);

/**
 * @swagger
 * /api/chats/{id}/deactivate:
 *   post:
 *     summary: Desativa um chat
 *     description: Desativa um chat ativo (requer autenticação de admin)
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do chat
 *     responses:
 *       200:
 *         description: Chat desativado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatResponseDto'
 *       404:
 *         description: Chat não encontrado
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão de admin
 */
router.post('/:id/deactivate', requireAdmin, controller.deactivateChat);

export default router;
