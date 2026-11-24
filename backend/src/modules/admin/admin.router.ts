import { Router } from 'express';
import { requireAdmin } from '../../middleware/auth';
import { reconcile } from '../../services/reconciler';
import { createBullBoard } from '../../queue/bullBoard';
import { logger } from '../../config/logger';

export const adminRouter = Router();

// Mount Bull Board at /admin/queues
const serverAdapter = createBullBoard();
adminRouter.use('/queues', requireAdmin, serverAdapter.getRouter());

// POST /admin/reconcile
adminRouter.post('/reconcile', requireAdmin, async (req, res) => {
  try {
    const result = await reconcile({ force: true });
    res.json({ success: true, result });
  } catch (err) {
    logger.error({ err }, 'Manual reconcile failed');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Reconcile failed' } });
  }
});
