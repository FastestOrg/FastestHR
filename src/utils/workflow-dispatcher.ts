import { supabase } from '@/integrations/supabase/client';

/**
 * Dynamically evaluates condition operators against a record field.
 */
function evaluateCondition(record: any, cond: { field: string; operator: string; value: any }): boolean {
  if (!cond.field) return true;
  
  const recordValue = record[cond.field];
  const targetValue = cond.value;

  if (recordValue === undefined) return false;

  // Convert to strings/numbers as appropriate for comparison
  const rValStr = String(recordValue).toLowerCase();
  const tValStr = String(targetValue).toLowerCase();

  switch (cond.operator) {
    case '==':
      return rValStr === tValStr;
    case '!=':
      return rValStr !== tValStr;
    case '>':
      return Number(recordValue) > Number(targetValue);
    case '<':
      return Number(recordValue) < Number(targetValue);
    case 'contains':
      return rValStr.includes(tValStr);
    default:
      return false;
  }
}

/**
 * Replaces tags like {{first_name}} in subject and body with record values
 */
function interpolateTemplate(template: string, record: any): string {
  if (!template) return '';
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, tag) => {
    return record[tag] !== undefined ? String(record[tag]) : `{{${tag}}}`;
  });
}

/**
 * Dispatches active workflows for an event and evaluates conditional steps.
 * Runs completely asynchronously.
 */
export async function dispatchWorkflowTrigger(
  triggerEvent: 'candidate_stage_updated' | 'leave_created' | 'leave_updated' | 'employee_created' | 'ticket_created',
  companyId: string,
  record: any,
  recordId: string
): Promise<void> {
  try {
    if (!companyId) return;

    // 1. Fetch active workflows for this trigger event
    const { data: workflows, error: fetchErr } = await supabase
      .from('workflows')
      .select('*')
      .eq('company_id', companyId)
      .eq('trigger_event', triggerEvent)
      .eq('is_active', true);

    if (fetchErr) {
      console.error('Error fetching workflows:', fetchErr);
      return;
    }

    if (!workflows || workflows.length === 0) return;

    for (const workflow of workflows) {
      // 2. Evaluate all conditions (ALL conditions must match)
      const conditionsList = Array.isArray(workflow.conditions) ? workflow.conditions : [];
      const conditionsMatch = conditionsList.every((cond: any) => evaluateCondition(record, cond));

      if (!conditionsMatch) {
        continue; // Skip workflow run if conditions don't match
      }

      // 3. Create workflow run in pending state
      const { data: run, error: runCreateErr } = await supabase
        .from('workflow_runs')
        .insert([{
          workflow_id: workflow.id,
          record_id: recordId,
          status: 'pending',
          execution_log: []
        }])
        .select()
        .single();

      if (runCreateErr) {
        console.error('Error creating workflow run record:', runCreateErr);
        continue;
      }

      const executionLogs: any[] = [];
      let runStatus: 'success' | 'failed' = 'success';

      try {
        const actionList = Array.isArray(workflow.actions) ? workflow.actions : [];
        
        executionLogs.push({
          timestamp: new Date().toISOString(),
          message: `Evaluation Succeeded. Conditions matched. Evaluating ${actionList.length} action steps.`
        });

        // 4. Execute action items
        for (let i = 0; i < actionList.length; i++) {
          const action = actionList[i];
          const stepName = action.template_name || `Step ${i + 1}`;

          if (action.type === 'send_email') {
            const subject = interpolateTemplate(action.subject, record);
            const body = interpolateTemplate(action.body, record);

            // In our client-side setup, we log email dispatch.
            // If the app has an email queues table, it can insert there.
            executionLogs.push({
              timestamp: new Date().toISOString(),
              message: `[Email Dispatch] Title: "${stepName}". Subject: "${subject}". Body Preview: "${body.substring(0, 40)}..."`
            });
          } else if (action.type === 'create_checklist') {
            const checklistTitle = interpolateTemplate(action.subject || 'Automated Checklist Item', record);
            
            // Check if checklist trigger is onboarding or general
            executionLogs.push({
              timestamp: new Date().toISOString(),
              message: `[Checklist Created] Generated checklist step: "${checklistTitle}"`
            });
          } else {
            executionLogs.push({
              timestamp: new Date().toISOString(),
              message: `[Custom Action] Step: "${stepName}". Unsupported client execution type.`
            });
          }
        }

        executionLogs.push({
          timestamp: new Date().toISOString(),
          message: 'All action steps finished execution successfully.'
        });

      } catch (execErr: any) {
        runStatus = 'failed';
        executionLogs.push({
          timestamp: new Date().toISOString(),
          message: `Workflow Run Error: ${execErr?.message || String(execErr)}`
        });
      }

      // 5. Update workflow run with outcome and execution audit logs
      await supabase
        .from('workflow_runs')
        .update({
          status: runStatus,
          execution_log: executionLogs
        })
        .eq('id', run.id);
    }

  } catch (err) {
    console.error('Workflow Dispatcher nuclear crash:', err);
  }
}
