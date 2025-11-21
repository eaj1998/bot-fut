import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from '../../config/swagger.config';
import authRoutes from './auth.routes';
import gamesRoutes from './games.routes';

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

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
