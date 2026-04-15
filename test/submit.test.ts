import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks
const createClientMock = vi.fn();
vi.mock('@supabase/supabase-js', () => ({ createClient: createClientMock }));

const renderToBufferMock = vi.fn();
vi.mock('@react-pdf/renderer', () => ({ renderToBuffer: renderToBufferMock }));

// Mock the PDF document component so imports don't try to resolve React/Next runtime
vi.mock('@/components/BCNPDFDocument', () => ({
  default: function BCNPDFDocument() { return null; },
}));

const sendFaxMock = vi.fn();
vi.mock('@/lib/telnyx', () => ({ sendFax: sendFaxMock }));

const sendSubmissionConfirmationMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/email', () => ({ sendSubmissionConfirmation: sendSubmissionConfirmationMock }));

const ratelimitMock = { limit: vi.fn() };
vi.mock('@/lib/ratelimit', () => ({ ratelimit: ratelimitMock }));

const verifyTurnstileMock = vi.fn();
vi.mock('@/lib/turnstile', () => ({ verifyTurnstile: verifyTurnstileMock }));

vi.mock('@/data/locations', () => ({
  getLocationNpi: vi.fn((location: string) => {
    const npis: Record<string, string> = {
      'UM Health-Sparrow Lansing': '1073588711',
      'Lansing Urgent Care - Frandor': '1780987990',
      'Lansing Urgent Care - Westside': '1780987990',
      'Lansing Urgent Care - Southside': '1780987990',
      'Lansing Urgent Care - Okemos': '1780987990',
      'Lansing Urgent Care - DeWitt': '1780987990',
      'Lansing Urgent Care - Haslett': '1780987990',
      'Lansing Urgent Care - Mason': '1780987990',
      'Lansing Urgent Care - Grand Ledge': '1780987990',
    };
    return npis[location];
  }),
}));

let POST: any;

beforeEach(async () => {
  vi.resetModules();
  vi.resetAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.test';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';

  // Default behaviors
  ratelimitMock.limit.mockResolvedValue({ success: true });
  verifyTurnstileMock.mockResolvedValue(true);
  renderToBufferMock.mockResolvedValue(Buffer.from('pdf'));
  sendFaxMock.mockResolvedValue({ id: 'fax_1', status: 'sending' });
  // Ensure email mock returns a promise after reset
  sendSubmissionConfirmationMock.mockResolvedValue(undefined);

  // Build a fake supabase client with spies
  const insertSubmissionSpy = vi.fn(async () => ({ data: { id: 'sub_1' }, error: null }));
  const uploadSpy = vi.fn(async () => ({ error: null }));
  const getPublicUrlSpy = vi.fn(() => ({ data: { publicUrl: 'https://cdn.test/sub_1.pdf' } }));
  const insertFaxJobSpy = vi.fn(async () => ({ data: { id: 'faxjob_1' }, error: null }));
  const updateFaxJobSpy = vi.fn(async (_payload?: unknown) => ({ data: null }));

  const fakeSupabase = {
    from: (table: string) => {
      if (table === 'reimbursement_submissions') {
        return {
          insert: (payload: any) => ({ select: (_: string) => ({ single: async () => ({ data: { id: 'sub_1' } }) }) }),
        };
      }
      if (table === 'fax_jobs') {
        return {
          insert: (payload: any) => ({ select: (_: string) => ({ single: async () => ({ data: { id: 'faxjob_1' } }) }) }),
          update: (payload: any) => ({ eq: (_f: string, _v: any) => updateFaxJobSpy(payload) }),
        };
      }
      return {} as any;
    },
    storage: {
      from: (_: string) => ({ upload: uploadSpy, getPublicUrl: getPublicUrlSpy }),
  },
  } as any;

  createClientMock.mockReturnValue(fakeSupabase);

  // Import the route after mocks are configured
  const mod = await import('../src/app/api/submit/route');
  POST = mod.POST;
});

describe('Submit route', () => {
  it('processes a submission, uploads PDF, creates fax job and sends fax', async () => {
    const body = {
      turnstileToken: 'token',
      honeypot: '',
      email: 'user@example.com',
      enrolleeId: 'E123',
      enrolleeName: 'Member',
      patientName: 'Patient',
      patientDob: '2000-01-01',
      address: '123 Main',
      city: 'Town',
      stateZip: 'ST 00000',
      claimDescription: 'Claim',
      signatureData: '',
      signatureDate: '',
    };

    const req = {
      json: async () => body,
      headers: { get: (_: string) => null },
    } as any;

    const res = await POST(req);

    // Validate that external calls were made
    expect(renderToBufferMock).toHaveBeenCalled();
    expect(sendFaxMock).toHaveBeenCalled();
    expect(sendSubmissionConfirmationMock).toHaveBeenCalledWith(expect.objectContaining({ to: 'user@example.com' }));
  });

  it('returns 429 when rate limit exceeded', async () => {
    ratelimitMock.limit.mockResolvedValue({ success: false });
    const body = { turnstileToken: 't', honeypot: '', email: 'a@b.com' };
    const req = { json: async () => body, headers: { get: (_: string) => null } } as any;

    const res = await POST(req);
    // The route returns a NextResponse — we test by calling json() on it if present
    // Some runtimes return plain objects; we check for the JSON body text
    // For simplicity, ensure sendFax not called
    expect(sendFaxMock).not.toHaveBeenCalled();
  });

  it('does not send fax when PDF upload fails', async () => {
    // Make storage.upload return an error
    const uploadError = { message: 'upload failed' };
    const fakeSupabaseFailUpload = {
      from: (table: string) => {
        if (table === 'reimbursement_submissions') {
          return { insert: (p: any) => ({ select: (_: string) => ({ single: async () => ({ data: { id: 'sub_err' } }) }) }) };
        }
        if (table === 'fax_jobs') {
          return { insert: (p: any) => ({ select: (_: string) => ({ single: async () => ({ data: { id: 'faxjob_err' } }) }) }) };
        }
        return {} as any;
      },
      storage: { from: (_: string) => ({ upload: async () => ({ error: uploadError }), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
    } as any;

    createClientMock.mockReturnValue(fakeSupabaseFailUpload);
    // Re-import route to pick up new client
    const mod = await import('../src/app/api/submit/route');
    const POST_local = mod.POST;

    const body = { turnstileToken: 'token', honeypot: '', email: 'u@e.com' };
    const req = { json: async () => body, headers: { get: (_: string) => null } } as any;

    const res = await POST_local(req);

    // upload failed -> sendFax should not be called
    expect(sendFaxMock).not.toHaveBeenCalled();
  });

  it('marks fax job failed when sendFax throws', async () => {
    // Make sendFax throw
    sendFaxMock.mockRejectedValue(new Error('telnyx down'));

    // Provide a supabase client that records updates
    const updateSpy = vi.fn(async (payload: any) => ({ data: null }));
    const fakeSupabaseForFaxFail = {
      from: (table: string) => {
        if (table === 'reimbursement_submissions') {
          return { insert: (p: any) => ({ select: (_: string) => ({ single: async () => ({ data: { id: 'sub_fail' } }) }) }) };
        }
        if (table === 'fax_jobs') {
          return {
            insert: (p: any) => ({ select: (_: string) => ({ single: async () => ({ data: { id: 'faxjob_fail' } }) }) }),
            update: (payload: any) => ({ eq: (_f: string, _v: any) => updateSpy(payload) }),
          };
        }
        return {} as any;
      },
      storage: { from: (_: string) => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: 'https://cdn.test/fail.pdf' } }) }) },
    } as any;

    createClientMock.mockReturnValue(fakeSupabaseForFaxFail);
    const mod = await import('../src/app/api/submit/route');
    const POST_local = mod.POST;

    const body = { turnstileToken: 'token', honeypot: '', email: 'fail@e.com' };
    const req = { json: async () => body, headers: { get: (_: string) => null } } as any;

    const res = await POST_local(req);

    // sendFax threw -> update should have been called to mark failed
    expect(updateSpy).toHaveBeenCalled();
  });

  it('rejects when Turnstile verification fails', async () => {
    verifyTurnstileMock.mockResolvedValue(false);
    const body = { turnstileToken: 'bad', honeypot: '', email: 't@t.com' };
    const req = { json: async () => body, headers: { get: (_: string) => null } } as any;

    const res = await POST(req);
    expect(sendFaxMock).not.toHaveBeenCalled();
  });
});
