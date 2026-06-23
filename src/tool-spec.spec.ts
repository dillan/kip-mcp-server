import { makeProgressReporter, type ToolCtx } from './tool-spec.js';

interface SentNotification {
  method: string;
  params: { progressToken: unknown; progress: number; total: number; message?: string };
}

function fakeCtx(token: string | number | undefined, sent: SentNotification[]): ToolCtx {
  return {
    server: {} as ToolCtx['server'],
    extra: {
      _meta: token === undefined ? {} : { progressToken: token },
      sendNotification: async (n: SentNotification) => {
        sent.push(n);
      },
    } as unknown as ToolCtx['extra'],
  };
}

describe('makeProgressReporter', () => {
  it('emits a progress notification when a progressToken is present', async () => {
    const sent: SentNotification[] = [];
    const report = makeProgressReporter(fakeCtx('tok', sent));
    await report(1, 4, 'halfway');
    expect(sent).toHaveLength(1);
    expect(sent[0].method).toBe('notifications/progress');
    expect(sent[0].params).toMatchObject({
      progressToken: 'tok',
      progress: 1,
      total: 4,
      message: 'halfway',
    });
  });

  it('is a no-op when there is no progressToken', async () => {
    const sent: SentNotification[] = [];
    const report = makeProgressReporter(fakeCtx(undefined, sent));
    await report(1, 4);
    expect(sent).toHaveLength(0);
  });

  it('is a no-op when there is no context at all', async () => {
    const report = makeProgressReporter(undefined);
    await expect(report(1, 2)).resolves.toBeUndefined();
  });
});
