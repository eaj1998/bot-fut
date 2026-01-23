import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from '../../config/swagger.config';
import authRoutes from './auth.routes';
import gamesRoutes from './games.routes';
import playersRoutes from './players.routes';
import debtsRoutes from './debts.routes';
import workspacesRoutes from './workspaces.routes';
import chatsRoutes from './chats.routes';
import dashboardRoutes from './dashboard.routes';
import bbqRoutes from './bbq.routes';
import membershipsRoutes from './memberships.routes';
import transactionsRoutes from './transactions.routes';

const router = Router();

// Swagger documentation
router.use('/api-docs', swaggerUi.serve);
router.get('/api-docs', swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Bot Futebol API Documentation',
}));

// API routes
router.use('/auth', authRoutes);
router.use('/games', gamesRoutes);
router.use('/players', playersRoutes);
router.use('/debts', debtsRoutes);
router.use('/workspaces', workspacesRoutes);
router.use('/chats', chatsRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/bbq', bbqRoutes);
router.use('/memberships', membershipsRoutes);
router.use('/transactions', transactionsRoutes);

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
