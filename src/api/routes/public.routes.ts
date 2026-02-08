
import { Router } from 'express';
import { container } from 'tsyringe';
import { HelpController } from '../controllers/help.controller';

const router = Router();
const helpController = container.resolve(HelpController);

router.get('/commands', helpController.getCommands);

export default router;
