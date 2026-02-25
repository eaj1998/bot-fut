
import { Router } from 'express';
import { container } from 'tsyringe';
import { HelpController } from '../controllers/help.controller';
import { UserModel, USER_MODEL_TOKEN } from '../../core/models/user.model';

const router = Router();
const helpController = container.resolve(HelpController);

/**
 * @swagger
 * /api/public/commands:
 *   get:
 *     summary: Lista comandos disponíveis
 *     description: Retorna a lista de comandos e descrições disponíveis no bot
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: Lista de comandos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/HelpCommandDto'
 */
router.get('/commands', helpController.getCommands);

/**
 * @swagger
 * /api/public/users:
 *   get:
 *     summary: Lista usuários para teste
 *     description: Retorna lista de usuários ativos para interface de teste do chat
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: Lista de usuários
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   phone:
 *                     type: string
 *                   lid:
 *                     type: string
 */
router.get('/users', async (req, res) => {
    try {
        const users = await UserModel.find({ status: 'active' })
            .select('_id name phoneE164 lid')
            .limit(50)
            .exec();

        const validGroups = [
            // '120363146006960373@g.us',
            '120363385759902376@g.us',
            // '120363390493860577@g.us'
        ];

        const formattedUsers = users.map((user, index) => ({
            id: index + 1,
            name: user.name,
            phone: user.phoneE164?.replace('@c.us', '') || '',
            lid: user.lid || undefined,
            groupId: validGroups[Math.floor(Math.random() * validGroups.length)]
        }));

        res.json(formattedUsers);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

export default router;

