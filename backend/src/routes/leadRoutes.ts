import { Router } from 'express';
import { leadController } from '../controllers/leadController';
import { authenticate, auditAction } from '../middleware/auth';

const router = Router();

// All lead routes require authentication
router.use(authenticate);

// Lead feed and CRUD
router.get('/', leadController.getLeads.bind(leadController));
router.get('/:id', leadController.getLead.bind(leadController));
router.post('/', auditAction('create', 'lead'), leadController.createLead.bind(leadController));
router.patch('/:id', leadController.updateLead.bind(leadController));
router.delete('/:id', auditAction('delete', 'lead'), leadController.deleteLead.bind(leadController));

// Outreach tracking
router.post('/:id/outreach', leadController.logOutreach.bind(leadController));

export default router;
