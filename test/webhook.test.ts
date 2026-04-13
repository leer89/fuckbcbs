import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock createClient from supabase so route uses our fake client
const createClientMock = vi.fn();
vi.mock('@supabase/supabase-js', () => ({ createClient: createClientMock }));

// Mock telnyx + email helpers
const sendFaxMock = vi.fn();
vi.mock('@/lib/telnyx', () => ({ sendFax: sendFaxMock }));

const sendFaxDeliveredEmailMock = vi.fn().mockResolvedValue(undefined);
const sendFaxFailedEmailMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/email', () => ({
  sendFaxDeliveredEmail: sendFaxDeliveredEmailMock,
  sendFaxFailedEmail: sendFaxFailedEmailMock,
}));

let POST: any;

beforeEach(async () => {
  vi.resetAllMocks();
  process.env.NEXT_PUBLIC_APP_URL = 'https://test.app';
  // Ensure email mocks return promises after reset
  sendFaxDeliveredEmailMock.mockResolvedValue(undefined);
  sendFaxFailedEmailMock.mockResolvedValue(undefined);
  // Re-import the route after mocks
  const mod = await import('../src/app/api/fax/webhook/route');
  POST = mod.POST;
});

describe('Fax webhook handler', () => {
  it('marks fax as delivered and emails the user', async () => {
    const faxJob = { id: 'job_1', submission_id: 'sub_1', attempts: 1 };
    const submission = { email: 'user@example.com', enrollee_name: 'Member' };

    // Fake supabase client behavior
    const updateCalls: any[] = [];
    const fakeSupabase = {
      from: (table: string) => {
        if (table === 'fax_jobs') {
          return {
            select: () => ({ eq: () => ({ single: async () => ({ data: faxJob, error: null }) }) }),
            update: (payload: any) => ({ eq: (_f: string, _v: any) => ({ then: () => {}, catch: () => {}, // chain compatibility
              // for async/await
              toJSON: () => {},
            }), // keep shape but record
            __call: () => { updateCalls.push(payload); return Promise.resolve({}); } }),
          } as any;
        }
        if (table === 'reimbursement_submissions') {
          return { select: () => ({ eq: () => ({ single: async () => ({ data: submission }) }) }) } as any;
        }
        return {} as any;
      },
      storage: {
        from: () => ({ getPublicUrl: (_: string) => ({ data: { publicUrl: 'https://cdn.test/doc.pdf' } }) }),
      },
    } as any;

    // Create a simple update tracker for fax_jobs.update().eq()
    const updateSpy = vi.fn(async (payload: any) => ({ data: null }));
    // Provide a createClient that returns an object whose from('fax_jobs').update(...).eq resolves
    createClientMock.mockReturnValue({
      from: (table: string) => {
        if (table === 'fax_jobs') {
          return {
            select: () => ({ eq: () => ({ single: async () => ({ data: faxJob }) }) }),
            update: (payload: any) => ({ eq: (_f: string, _v: any) => updateSpy(payload) }),
          };
        }
        if (table === 'reimbursement_submissions') {
          return { select: () => ({ eq: () => ({ single: async () => ({ data: submission }) }) }) };
        }
        return {} as any;
      },
      storage: fakeSupabase.storage,
    });

    const req = { json: async () => ({ data: { event_type: 'fax.delivered', payload: { fax_id: 'fax_123', status: 'delivered' } } }) } as any;

    const res = await POST(req);

    // Expect an update call to set status delivered
    expect(updateSpy).toHaveBeenCalled();
    const calledWith = updateSpy.mock.calls[0][0];
    expect(calledWith).toMatchObject({ status: 'delivered' });

    // Expect email helper called
    expect(sendFaxDeliveredEmailMock).toHaveBeenCalledWith(expect.objectContaining({ to: 'user@example.com' }));
  });

  it('retries failed fax when attempts < MAX and updates job', async () => {
    const faxJob = { id: 'job_2', submission_id: 'sub_2', attempts: 1, pdf_storage_path: '2.pdf' };
    const submission = { email: 'user2@example.com', enrollee_name: 'Member2' };

    const getPublicUrlMock = vi.fn(() => ({ data: { publicUrl: 'https://cdn.test/2.pdf' } }));
    const updateSpy = vi.fn(async (payload: any) => ({ data: null }));

    createClientMock.mockReturnValue({
      from: (table: string) => {
        if (table === 'fax_jobs') {
          return {
            select: () => ({ eq: () => ({ single: async () => ({ data: faxJob }) }) }),
            update: (payload: any) => ({ eq: (_f: string, _v: any) => updateSpy(payload) }),
          };
        }
        if (table === 'reimbursement_submissions') {
          return { select: () => ({ eq: () => ({ single: async () => ({ data: submission }) }) }) };
        }
        return {} as any;
      },
      storage: {
        from: (_: string) => ({ getPublicUrl: getPublicUrlMock }),
      },
    });

    sendFaxMock.mockResolvedValue({ id: 'fax_new', status: 'sending' });

    const req = { json: async () => ({ data: { event_type: 'fax.failed', payload: { fax_id: 'fax_old', status: 'failed', failure_reason: 'busy' } } }) } as any;

    const res = await POST(req);

    // Expect storage getPublicUrl called
    expect(getPublicUrlMock).toHaveBeenCalledWith('2.pdf');

    // Expect sendFax called with the publicUrl we returned
    expect(sendFaxMock).toHaveBeenCalledWith(expect.objectContaining({ mediaUrl: 'https://cdn.test/2.pdf', webhookUrl: expect.any(String) }));

    // Expect update called to set new telnyx_fax_id and status sending
    expect(updateSpy).toHaveBeenCalled();
    const calledWith = updateSpy.mock.calls[0][0];
    expect(calledWith).toMatchObject({ telnyx_fax_id: 'fax_new', status: 'sending' });

    // Expect failed email to have been sent
    expect(sendFaxFailedEmailMock).toHaveBeenCalledWith(expect.objectContaining({ to: 'user2@example.com' }));
  });
});
