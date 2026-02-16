import { Router } from 'express';
import { container } from 'tsyringe';
import express from 'express';
import { YoutubeWebhookController } from '../controllers/youtube.controller';

const router = Router();
const controller = container.resolve(YoutubeWebhookController);

// Middleware específico para XML nesta rota pode ser necessário se o global não cobrir
// Mas para manter simples e compatível com o ApiServer existente, vamos usar express.text nas rotas específicas se precisar
// O ApiServer tem express.json() e urlencoded(). Para XML do youtube, precisamos ler o body como string.

// Vamos adicionar um middleware de text parser apenas para estas rotas se o body estiver vindo vazio
router.use(express.text({ type: ['application/xml', 'application/atom+xml', 'text/xml'] }));


router.get('/', controller.verifyWebhook);
router.post('/', controller.handleNotification);

export default router;
