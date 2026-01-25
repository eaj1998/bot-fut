import { Router } from 'express';
import { container } from 'tsyringe';
import { MembershipsController } from '../controllers/memberships.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';

const router = Router();
const controller = container.resolve(MembershipsController);

router.use(authenticate);

// User endpoints
router.get('/my', controller.getMyMembership);
router.post('/', controller.createMembership);

// Admin endpoints
router.post('/admin/create', requireAdmin, controller.createMembershipAdmin);
router.get('/admin/list', requireAdmin, controller.getAdminList);
router.put('/:id', requireAdmin, controller.updateMembership);
router.post('/:id/manual-payment', requireAdmin, controller.registerManualPayment);
router.post('/:id/suspend', requireAdmin, controller.suspendMembership);

// User/Admin endpoints (Controller checks permissions)
router.post('/:id/cancel', controller.cancelMembership);

export default router;
