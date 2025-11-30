import { Router } from 'express';
import { container } from 'tsyringe';
import { WorkspacesController } from '../controllers/workspaces.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';

const router = Router();
const controller = container.resolve(WorkspacesController);

/**
 * @swagger
 * /api/workspaces:
 *   get:
 *     summary: Lista todos os workspaces
 *     description: Retorna uma lista paginada de workspaces com filtros opcionais
 *     tags: [Workspaces]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, maintenance, all]
 *         description: Filtrar por status do workspace
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar por nome ou slug
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
 *           enum: [name, createdAt, totalChats]
 *         description: Campo para ordenação
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Direção da ordenação
 *     responses:
 *       200:
 *         description: Lista de workspaces retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 workspaces:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/WorkspaceResponseDto'
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 limit:
 *                   type: integer
 */
router.get('/', controller.listWorkspaces);

/**
 * @swagger
 * /api/workspaces/stats:
 *   get:
 *     summary: Obtém estatísticas de workspaces
 *     description: Retorna estatísticas agregadas sobre workspaces
 *     tags: [Workspaces]
 *     responses:
 *       200:
 *         description: Estatísticas retornadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalWorkspaces:
 *                   type: integer
 *                 activeWorkspaces:
 *                   type: integer
 *                 inactiveWorkspaces:
 *                   type: integer
 *                 totalChats:
 *                   type: integer
 *                 totalGames:
 *                   type: integer
 *                 totalRevenue:
 *                   type: number
 */
router.get('/stats', controller.getStats);

/**
 * @swagger
 * /api/workspaces/{id}:
 *   get:
 *     summary: Obtém detalhes de um workspace
 *     description: Retorna informações detalhadas de um workspace específico
 *     tags: [Workspaces]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do workspace
 *     responses:
 *       200:
 *         description: Detalhes do workspace
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkspaceResponseDto'
 *       404:
 *         description: Workspace não encontrado
 */
router.get('/:id', controller.getWorkspaceById);

/**
 * @swagger
 * /api/workspaces/{id}/chats:
 *   get:
 *     summary: Obtém chats de um workspace
 *     description: Retorna lista de chats vinculados a um workspace
 *     tags: [Workspaces]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do workspace
 *     responses:
 *       200:
 *         description: Lista de chats
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       404:
 *         description: Workspace não encontrado
 */
router.get('/:id/chats', controller.getWorkspaceChats);

/**
 * @swagger
 * /api/workspaces/{id}/stats:
 *   get:
 *     summary: Obtém estatísticas de um workspace
 *     description: Retorna estatísticas específicas de um workspace
 *     tags: [Workspaces]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do workspace
 *     responses:
 *       200:
 *         description: Estatísticas do workspace
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalChats:
 *                   type: integer
 *                 totalGames:
 *                   type: integer
 *                 upcomingGames:
 *                   type: integer
 *       404:
 *         description: Workspace não encontrado
 */
router.get('/:id/stats', controller.getWorkspaceStats);

// Rotas protegidas (requerem autenticação)
router.use(authenticate);

/**
 * @swagger
 * /api/workspaces:
 *   post:
 *     summary: Cria um novo workspace
 *     description: Cria um novo workspace (requer autenticação de admin)
 *     tags: [Workspaces]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - slug
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Arena Viana"
 *               slug:
 *                 type: string
 *                 example: "viana"
 *               timezone:
 *                 type: string
 *                 example: "America/Sao_Paulo"
 *               settings:
 *                 type: object
 *                 properties:
 *                   maxPlayers:
 *                     type: integer
 *                     example: 16
 *                   pricePerGameCents:
 *                     type: integer
 *                     example: 1400
 *                   commandsEnabled:
 *                     type: array
 *                     items:
 *                       type: string
 *                     example: ["/lista", "/entrar", "/sair"]
 *                   pix:
 *                     type: string
 *                     example: "+5549999999999"
 *                   title:
 *                     type: string
 *                     example: "⚽ VIANA"
 *     responses:
 *       201:
 *         description: Workspace criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkspaceResponseDto'
 *       400:
 *         description: Dados inválidos
 *       409:
 *         description: Workspace já existe
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão de admin
 */
router.post('/', requireAdmin, controller.createWorkspace);

/**
 * @swagger
 * /api/workspaces/{id}:
 *   put:
 *     summary: Atualiza um workspace
 *     description: Atualiza informações de um workspace existente (requer autenticação de admin)
 *     tags: [Workspaces]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do workspace
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               timezone:
 *                 type: string
 *               settings:
 *                 type: object
 *                 properties:
 *                   maxPlayers:
 *                     type: integer
 *                   pricePerGameCents:
 *                     type: integer
 *                   commandsEnabled:
 *                     type: array
 *                     items:
 *                       type: string
 *                   pix:
 *                     type: string
 *                   title:
 *                     type: string
 *     responses:
 *       200:
 *         description: Workspace atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkspaceResponseDto'
 *       404:
 *         description: Workspace não encontrado
 *       409:
 *         description: Conflito (slug já existe)
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão de admin
 */
router.put('/:id', requireAdmin, controller.updateWorkspace);

/**
 * @swagger
 * /api/workspaces/{id}:
 *   delete:
 *     summary: Deleta um workspace
 *     description: Remove um workspace do sistema (requer autenticação de admin)
 *     tags: [Workspaces]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do workspace
 *     responses:
 *       204:
 *         description: Workspace deletado com sucesso
 *       400:
 *         description: Workspace possui chats vinculados
 *       404:
 *         description: Workspace não encontrado
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão de admin
 */
router.delete('/:id', requireAdmin, controller.deleteWorkspace);

/**
 * @swagger
 * /api/workspaces/{id}/organizze:
 *   patch:
 *     summary: Atualiza configurações do Organizze
 *     description: Atualiza credenciais e categorias do Organizze para um workspace (requer autenticação de admin)
 *     tags: [Workspaces]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do workspace
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - apiKey
 *               - accountId
 *               - categories
 *             properties:
 *               email:
 *                 type: string
 *                 example: "user@example.com"
 *               apiKey:
 *                 type: string
 *                 example: "abc123xyz"
 *               accountId:
 *                 type: integer
 *                 example: 9099386
 *               categories:
 *                 type: object
 *                 properties:
 *                   fieldPayment:
 *                     type: integer
 *                     example: 152977750
 *                   playerPayment:
 *                     type: integer
 *                     example: 152977751
 *                   playerDebt:
 *                     type: integer
 *                     example: 152977752
 *                   general:
 *                     type: integer
 *                     example: 152977753
 *     responses:
 *       200:
 *         description: Configurações atualizadas com sucesso
 *       400:
 *         description: Dados inválidos
 *       404:
 *         description: Workspace não encontrado
 */
router.patch('/:id/organizze', requireAdmin, controller.updateOrganizzeSettings);

export default router;
