import { test, expect, describe, vi, beforeEach } from 'vitest';
import { dispatchWorkflowTrigger } from '../utils/workflow-dispatcher';
import { supabase } from '../integrations/supabase/client';

vi.mock('../integrations/supabase/client', () => {
  const supabase = {
    from: vi.fn(),
  };
  return { supabase };
});

describe('Workflow Dispatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('Performance with 50 matching workflows', async () => {
    const numWorkflows = 50;
    const workflows = Array.from({ length: numWorkflows }, (_, i) => ({
      id: `wf-${i}`,
      company_id: 'test-company',
      trigger_event: 'candidate_stage_updated',
      is_active: true,
      conditions: [{ field: 'status', operator: '==', value: 'active' }],
      actions: [{ type: 'send_email', subject: 'Hello', body: 'World' }]
    }));

    const mockInsert = vi.fn().mockImplementation((data) => {
        const arr = Array.isArray(data) ? data : [data];
        return {
            select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: `run-${arr[0].workflow_id}` }, error: null }),
                then: (cb: any) => cb({ data: arr.map(item => ({ id: `run-${item.workflow_id}`, workflow_id: item.workflow_id })), error: null })
            })
        };
    });

    const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
    });

    const isWorkflowTable = false;

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'workflows') {
        return {
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        eq: vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ data: workflows, error: null }), 5)))
                    })
                })
            })
        };
      }
      if (table === 'workflow_runs') {
        const insertMock = vi.fn().mockImplementation((data) => {
            const arr = Array.isArray(data) ? data : [data];
            return {
                select: vi.fn().mockReturnValue({
                    single: vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ data: { id: `run-${arr[0].workflow_id}` }, error: null }), 2))),
                    then: (cb: any) => cb({ data: arr.map(item => ({ id: `run-${item.workflow_id}`, workflow_id: item.workflow_id })), error: null })
                })
            };
        });

        const updateMock = vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ error: null }), 2)))
        });

        mockInsert.mockImplementation(insertMock);
        mockUpdate.mockImplementation(updateMock);

        const upsertMock = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ error: null }), 2)));

        return {
          insert: mockInsert,
          update: mockUpdate,
          upsert: upsertMock,
        };
      }
    });

    const start = performance.now();
    await dispatchWorkflowTrigger('candidate_stage_updated', 'test-company', { status: 'active' }, 'record-123');
    const end = performance.now();

    expect(mockInsert.mock.calls.length).toBeGreaterThan(0);
  });
});
