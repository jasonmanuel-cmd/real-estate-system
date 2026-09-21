import { Router } from 'express';
import { exportController } from '../controllers/exportController';
import { authenticate, auditAction } from '../middleware/auth';

const router = Router();

// All export routes require authentication and audit logging
router.use(authenticate);

router.post('/mailing-list', auditAction('export', 'mailing_list'), exportController.exportMailingList.bind(exportController));
router.post('/call-sheet', auditAction('export', 'call_sheet'), exportController.exportCallSheet.bind(exportController));
router.post('/property-data', auditAction('export', 'property_data'), exportController.exportPropertyData.bind(exportController));

export default router;
