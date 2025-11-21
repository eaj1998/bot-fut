import { Router } from 'express';
import { container } from 'tsyringe';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const controller = container.resolve(AuthController);

/**
 * @swagger
 * /api/auth/request-otp:
 *   post:
 *     summary: Solicita código OTP
 *     description: Envia um código OTP via WhatsApp para autenticação
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *             properties:
 *               phone:
 *                 type: string
 *                 description: Número de telefone com código do país
 *                 example: "+5549999999999"
 *     responses:
 *       200:
 *         description: OTP enviado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "OTP sent successfully"
 *       400:
 *         description: Telefone inválido
 */
router.post('/request-otp', controller.requestOtp);

/**
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     summary: Verifica código OTP
 *     description: Valida o código OTP e retorna tokens de autenticação
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - otp
 *             properties:
 *               phone:
 *                 type: string
 *                 description: Número de telefone com código do país
 *                 example: "+5549999999999"
 *               otp:
 *                 type: string
 *                 description: Código OTP recebido
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Autenticação bem-sucedida
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                   description: Token JWT de acesso
 *                 refreshToken:
 *                   type: string
 *                   description: Token para renovação
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     phone:
 *                       type: string
 *       401:
 *         description: OTP inválido ou expirado
 */
router.post('/verify-otp', controller.verifyOtp);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Renova token de acesso
 *     description: Gera um novo access token usando o refresh token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Refresh token válido
 *     responses:
 *       200:
 *         description: Token renovado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                   description: Novo token JWT de acesso
 *       401:
 *         description: Refresh token inválido ou expirado
 */
router.post('/refresh', controller.refreshToken);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Obtém dados do usuário autenticado
 *     description: Retorna informações do usuário atualmente autenticado
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dados do usuário
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 phone:
 *                   type: string
 *                 role:
 *                   type: string
 *                   enum: [user, admin]
 *       401:
 *         description: Não autenticado
 */
router.get('/me', authenticate, controller.getMe);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Faz logout do usuário
 *     description: Invalida os tokens de autenticação do usuário
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout realizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Logged out successfully"
 *       401:
 *         description: Não autenticado
 */
router.post('/logout', authenticate, controller.logout);

export default router;
