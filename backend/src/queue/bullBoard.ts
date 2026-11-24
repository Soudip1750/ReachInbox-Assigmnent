import { createBullBoard as _createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { emailQueue } from './emailQueue';

class EmailJobsAdapter extends BullMQAdapter {
  public override getName(): string {
    return 'Email-jobs';
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public override getStatuses(): any[] {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return super.getStatuses().filter((s: any) => s !== 'waiting-children');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public override getJobStatuses(): any[] {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return super.getJobStatuses().filter((s: any) => s !== 'waiting-children');
  }
}

export function createBullBoard() {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  _createBullBoard({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queues: [new EmailJobsAdapter(emailQueue, { description: 'Campaign Email Delivery Queue' }) as any],
    serverAdapter,
    options: {
      uiConfig: {
        boardTitle: 'ReachInbox Queue Dashboard',
        pollingInterval: {
          showSetting: true,
          forceInterval: 2000,
        },
      },
    },
  });

  return serverAdapter;
}
