import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Building, Landmark, Receipt, CheckCircle2, Clock, AlertTriangle, AlertCircle } from 'lucide-react';
import { ProfileSectionCard } from '../components/ProfileSectionCard';
import { FileUploadField } from '../components/FileUploadField';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BankFinancialProps {
  employee: {
    id: string;
    company_id: string;
    bank_details?: {
      bank_name?: string | null;
      holder_name?: string | null;
      account_number?: string | null;
      account_type?: string | null;
      ifsc?: string | null;
      branch_name?: string | null;
      branch_address?: string | null;
      cheque_doc?: string | null;
      cheque_status?: string | null;
      cheque_reason?: string | null;
      statement_doc?: string | null;
      statement_status?: string | null;
      statement_reason?: string | null;
      passbook_doc?: string | null;
      passbook_status?: string | null;
      passbook_reason?: string | null;
      secondary?: {
        bank_name?: string | null;
        holder_name?: string | null;
        account_number?: string | null;
        account_type?: string | null;
        ifsc?: string | null;
        branch_name?: string | null;
      } | null;
    } | null;
    custom_fields?: {
      tax_info?: {
        pan_number?: string | null;
        pan_doc?: string | null;
        pan_status?: string | null;
        pan_reason?: string | null;
        tax_residency?: string | null;
      } | null;
      prev_employer_tax?: {
        employer_name?: string | null;
        total_income?: string | null;
        tds_deducted?: string | null;
        form16_doc?: string | null;
        form16_status?: string | null;
        form16_reason?: string | null;
        salary_slip_doc?: string | null;
        salary_slip_status?: string | null;
        salary_slip_reason?: string | null;
      } | null;
      [key: string]: unknown;
    } | null;
    [key: string]: unknown;
  };
  refetch: () => void;
}

function FieldView({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
      <p className="text-sm font-semibold text-foreground py-0.5">
        {value || <span className="text-muted-foreground italic font-normal">Not provided</span>}
      </p>
    </div>
  );
}

function FieldViewWithBadge({ 
  label, 
  value, 
  docUrl, 
  status, 
  reason 
}: { 
  label: string; 
  value?: string | null; 
  docUrl?: string | null; 
  status?: string; 
  reason?: string | null; 
}) {
  const computedStatus = docUrl 
    ? (status === 'Missing' || !status ? 'Pending Review' : status)
    : 'Missing';

  const getBadgeStyle = () => {
    switch (computedStatus) {
      case 'Verified':
        return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400';
      case 'Pending Review':
        return 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400';
      case 'Rejected':
        return 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400';
      default:
        return 'bg-muted/50 border-border/30 text-muted-foreground';
    }
  };

  const getStatusIcon = () => {
    switch (computedStatus) {
      case 'Verified':
        return <CheckCircle2 className="h-3 w-3 mr-1 inline" />;
      case 'Pending Review':
        return <Clock className="h-3 w-3 mr-1 inline animate-pulse" />;
      case 'Rejected':
        return <AlertTriangle className="h-3 w-3 mr-1 inline" />;
      default:
        return <AlertCircle className="h-3 w-3 mr-1 inline" />;
    }
  };

  return (
    <div className="space-y-1.5 p-3 rounded-xl border border-border/40 bg-muted/5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
          <span className={`px-2 py-0.5 rounded-full border text-[9px] font-semibold flex items-center ${getBadgeStyle()}`}>
            {getStatusIcon()}
            {computedStatus}
          </span>
        </div>
        <p className="text-sm font-semibold text-foreground truncate">
          {value || <span className="text-muted-foreground italic font-normal">Not uploaded</span>}
        </p>
      </div>
      {docUrl && (
        <div className="pt-2 border-t border-border/20 mt-2 flex items-center justify-between text-xs">
          <a href={docUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold">
            View Document
          </a>
        </div>
      )}
      {computedStatus === 'Rejected' && reason && (
        <div className="mt-2 text-[10px] bg-rose-500/5 p-1.5 rounded text-rose-600 dark:text-rose-400 border border-rose-500/10">
          <span className="font-semibold">Reason:</span> {reason}
        </div>
      )}
    </div>
  );
}

function FI({ label, name, value, onChange, type = 'text', placeholder = '' }: {
  label: string; name: string; value: string; onChange: (n: string, v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
      <Input type={type} value={value} onChange={(e) => onChange(name, e.target.value)} placeholder={placeholder}
        className="bg-background border-border/50 text-sm h-10 transition-colors focus:border-primary shadow-sm" />
    </div>
  );
}

function SF({ label, name, value, onChange, options }: {
  label: string; name: string; value: string; onChange: (n: string, v: string) => void; options: string[];
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
      <select value={value} onChange={(e) => onChange(name, e.target.value)}
        className="flex h-10 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none transition-colors shadow-sm animate-none">
        <option value="">— Select —</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

export default function BankFinancial({ employee, refetch }: BankFinancialProps) {
  const bd = employee.bank_details || {};
  const cf = employee.custom_fields || {};
  const tax = cf.tax_info || {};
  const prevTax = cf.prev_employer_tax || {};
  const storagePath = `${employee.company_id}/${employee.id}/bank`;

  const [primary, setPrimary] = useState({
    bank_name: bd.bank_name || '', holder_name: bd.holder_name || '',
    account_number: bd.account_number || '', account_number_confirm: bd.account_number || '',
    account_type: bd.account_type || '', ifsc: bd.ifsc || '',
    branch_name: bd.branch_name || '', branch_address: bd.branch_address || '',
    cheque_doc: bd.cheque_doc || '', statement_doc: bd.statement_doc || '',
    passbook_doc: bd.passbook_doc || '',
  });

  const [secondary, setSecondary] = useState({
    bank_name: bd.secondary?.bank_name || '', holder_name: bd.secondary?.holder_name || '',
    account_number: bd.secondary?.account_number || '', account_type: bd.secondary?.account_type || '',
    ifsc: bd.secondary?.ifsc || '', branch_name: bd.secondary?.branch_name || '',
  });

  const [taxInfo, setTaxInfo] = useState({
    pan_number: tax.pan_number || '', pan_doc: tax.pan_doc || '',
    tax_residency: tax.tax_residency || '',
  });

  const [prevEmpTax, setPrevEmpTax] = useState({
    employer_name: prevTax.employer_name || '', total_income: prevTax.total_income || '',
    tds_deducted: prevTax.tds_deducted || '', form16_doc: prevTax.form16_doc || '',
    salary_slip_doc: prevTax.salary_slip_doc || '',
  });

  const upP = (n: string, v: string) => setPrimary(p => ({ ...p, [n]: v }));
  const upS = (n: string, v: string) => setSecondary(p => ({ ...p, [n]: v }));
  const upT = (n: string, v: string) => setTaxInfo(p => ({ ...p, [n]: v }));
  const upPT = (n: string, v: string) => setPrevEmpTax(p => ({ ...p, [n]: v }));

  const handleSave = async () => {
    if (primary.account_number && primary.account_number !== primary.account_number_confirm) {
      toast.error('Account numbers do not match');
      throw new Error('Account mismatch');
    }
    const updateData = {
      bank_details: {
        bank_name: primary.bank_name, holder_name: primary.holder_name,
        account_number: primary.account_number, account_type: primary.account_type,
        ifsc: primary.ifsc, branch_name: primary.branch_name,
        branch_address: primary.branch_address, cheque_doc: primary.cheque_doc,
        cheque_status: bd.cheque_status || (primary.cheque_doc ? 'Pending Review' : 'Missing'),
        cheque_reason: bd.cheque_reason || null,
        statement_doc: primary.statement_doc,
        statement_status: bd.statement_status || (primary.statement_doc ? 'Pending Review' : 'Missing'),
        statement_reason: bd.statement_reason || null,
        passbook_doc: primary.passbook_doc,
        passbook_status: bd.passbook_status || (primary.passbook_doc ? 'Pending Review' : 'Missing'),
        passbook_reason: bd.passbook_reason || null,
        secondary: {
          bank_name: secondary.bank_name, holder_name: secondary.holder_name,
          account_number: secondary.account_number, account_type: secondary.account_type,
          ifsc: secondary.ifsc, branch_name: secondary.branch_name,
        },
      },
      custom_fields: {
        ...cf,
        tax_info: {
          ...taxInfo,
          pan_status: tax.pan_status || (taxInfo.pan_doc ? 'Pending Review' : 'Missing'),
          pan_reason: tax.pan_reason || null,
        },
        prev_employer_tax: {
          ...prevEmpTax,
          form16_status: prevTax.form16_status || (prevEmpTax.form16_doc ? 'Pending Review' : 'Missing'),
          form16_reason: prevTax.form16_reason || null,
          salary_slip_status: prevTax.salary_slip_status || (prevEmpTax.salary_slip_doc ? 'Pending Review' : 'Missing'),
          salary_slip_reason: prevTax.salary_slip_reason || null,
        },
      },
    };
    const { error } = await supabase.from('employees').update(updateData).eq('id', employee.id);
    if (error) { toast.error(error.message); throw error; }
    toast.success('Bank & financial details saved successfully');
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* Primary Bank */}
      <ProfileSectionCard title="Primary Bank Account" icon={<Landmark className="h-4 w-4 text-primary/70" />} onSave={handleSave}>
        {(editing) => (
          <div>
            {editing ? (
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
                <FI label="Bank Name" name="bank_name" value={primary.bank_name} onChange={upP} />
                <FI label="Account Holder Name" name="holder_name" value={primary.holder_name} onChange={upP} />
                <FI label="Account Number" name="account_number" value={primary.account_number} onChange={upP} />
                <FI label="Re-enter Account Number" name="account_number_confirm" value={primary.account_number_confirm} onChange={upP} />
                <SF label="Account Type" name="account_type" value={primary.account_type} onChange={upP} options={['Savings', 'Current']} />
                <FI label="IFSC / SWIFT / Routing Number" name="ifsc" value={primary.ifsc} onChange={upP} />
                <FI label="Branch Name" name="branch_name" value={primary.branch_name} onChange={upP} />
                <FI label="Branch Address" name="branch_address" value={primary.branch_address} onChange={upP} />
                <div className="col-span-1 sm:col-span-2 grid sm:grid-cols-3 gap-6 pt-3">
                  <FileUploadField 
                    label="Cancelled Cheque" 
                    value={primary.cheque_doc} 
                    onChange={(url) => upP('cheque_doc', url || '')} 
                    path={storagePath} 
                    accept=".pdf,.jpg,.jpeg,.png"
                    status={bd.cheque_status}
                    statusReason={bd.cheque_reason}
                  />
                  <FileUploadField 
                    label="Bank Statement (3M)" 
                    value={primary.statement_doc} 
                    onChange={(url) => upP('statement_doc', url || '')} 
                    path={storagePath} 
                    accept=".pdf,.jpg,.jpeg,.png"
                    status={bd.statement_status}
                    statusReason={bd.statement_reason}
                  />
                  <FileUploadField 
                    label="Passbook First Page" 
                    value={primary.passbook_doc} 
                    onChange={(url) => upP('passbook_doc', url || '')} 
                    path={storagePath} 
                    accept=".pdf,.jpg,.jpeg,.png"
                    status={bd.passbook_status}
                    statusReason={bd.passbook_reason}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-5">
                  <FieldView label="Bank Name" value={primary.bank_name} />
                  <FieldView label="Account Holder" value={primary.holder_name} />
                  <FieldView label="Account Number" value={primary.account_number ? `****${primary.account_number.slice(-4)}` : ''} />
                  <FieldView label="Account Type" value={primary.account_type} />
                  <FieldView label="IFSC/SWIFT" value={primary.ifsc} />
                  <FieldView label="Branch" value={primary.branch_name} />
                </div>
                <div className="grid sm:grid-cols-3 gap-6 pt-2">
                  <FieldViewWithBadge 
                    label="Cancelled Cheque" 
                    value={primary.cheque_doc ? 'Cheque Image/PDF' : ''} 
                    docUrl={primary.cheque_doc}
                    status={bd.cheque_status}
                    reason={bd.cheque_reason}
                  />
                  <FieldViewWithBadge 
                    label="Bank Statement (3M)" 
                    value={primary.statement_doc ? 'Statement Document' : ''} 
                    docUrl={primary.statement_doc}
                    status={bd.statement_status}
                    reason={bd.statement_reason}
                  />
                  <FieldViewWithBadge 
                    label="Passbook First Page" 
                    value={primary.passbook_doc ? 'Passbook Document' : ''} 
                    docUrl={primary.passbook_doc}
                    status={bd.passbook_status}
                    reason={bd.passbook_reason}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </ProfileSectionCard>

      {/* Secondary Bank */}
      <ProfileSectionCard title="Secondary Bank Account (Optional)" icon={<Building className="h-4 w-4 text-primary/70" />} onSave={handleSave}>
        {(editing) => (
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
            {editing ? (
              <>
                <FI label="Bank Name" name="bank_name" value={secondary.bank_name} onChange={upS} />
                <FI label="Account Holder Name" name="holder_name" value={secondary.holder_name} onChange={upS} />
                <FI label="Account Number" name="account_number" value={secondary.account_number} onChange={upS} />
                <SF label="Account Type" name="account_type" value={secondary.account_type} onChange={upS} options={['Savings', 'Current']} />
                <FI label="IFSC / SWIFT / Routing Number" name="ifsc" value={secondary.ifsc} onChange={upS} />
                <FI label="Branch Name" name="branch_name" value={secondary.branch_name} onChange={upS} />
              </>
            ) : (
              <>
                <FieldView label="Bank Name" value={secondary.bank_name} />
                <FieldView label="Account Holder" value={secondary.holder_name} />
                <FieldView label="Account Number" value={secondary.account_number ? `****${secondary.account_number.slice(-4)}` : ''} />
                <FieldView label="Account Type" value={secondary.account_type} />
                <FieldView label="IFSC/SWIFT" value={secondary.ifsc} />
                <FieldView label="Branch" value={secondary.branch_name} />
              </>
            )}
          </div>
        )}
      </ProfileSectionCard>

      {/* Tax Information */}
      <ProfileSectionCard title="Tax Information" icon={<Receipt className="h-4 w-4 text-primary/70" />} onSave={handleSave}>
        {(editing) => (
          <div className="space-y-8">
            {editing ? (
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
                <FI label="PAN Number / Tax ID" name="pan_number" value={taxInfo.pan_number} onChange={upT} />
                <FI label="Tax Residency Status" name="tax_residency" value={taxInfo.tax_residency} onChange={upT} />
                <div className="col-span-1 sm:col-span-2 pt-2">
                  <FileUploadField 
                    label="Upload PAN Card Document" 
                    value={taxInfo.pan_doc} 
                    onChange={(url) => upT('pan_doc', url || '')} 
                    path={storagePath} 
                    accept=".pdf,.jpg,.jpeg,.png"
                    status={tax.pan_status}
                    statusReason={tax.pan_reason}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
                  <FieldView label="PAN / Tax ID" value={taxInfo.pan_number} />
                  <FieldView label="Tax Residency" value={taxInfo.tax_residency} />
                </div>
                <div className="grid sm:grid-cols-2 gap-6">
                  <FieldViewWithBadge 
                    label="PAN Card Document" 
                    value={taxInfo.pan_doc ? 'PAN Card PDF/Image' : ''} 
                    docUrl={taxInfo.pan_doc}
                    status={tax.pan_status}
                    reason={tax.pan_reason}
                  />
                </div>
              </div>
            )}

            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 border-b border-border/20 pb-2">Previous Employer Tax Details</h4>
              {editing ? (
                <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
                  <FI label="Previous Employer Name" name="employer_name" value={prevEmpTax.employer_name} onChange={upPT} />
                  <FI label="Total Income" name="total_income" value={prevEmpTax.total_income} onChange={upPT} type="number" />
                  <FI label="TDS Deducted" name="tds_deducted" value={prevEmpTax.tds_deducted} onChange={upPT} type="number" />
                  <div className="col-span-1 sm:col-span-2 grid sm:grid-cols-2 gap-6 pt-2">
                    <FileUploadField 
                      label="Upload Form 16" 
                      value={prevEmpTax.form16_doc} 
                      onChange={(url) => upPT('form16_doc', url || '')} 
                      path={storagePath} 
                      accept=".pdf,.jpg,.jpeg,.png"
                      status={prevTax.form16_status}
                      statusReason={prevTax.form16_reason}
                    />
                    <FileUploadField 
                      label="Upload Last Salary Slip" 
                      value={prevEmpTax.salary_slip_doc} 
                      onChange={(url) => upPT('salary_slip_doc', url || '')} 
                      path={storagePath} 
                      accept=".pdf,.jpg,.jpeg,.png"
                      status={prevTax.salary_slip_status}
                      statusReason={prevTax.salary_slip_reason}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-5">
                    <FieldView label="Prev Employer" value={prevEmpTax.employer_name} />
                    <FieldView label="Total Income" value={prevEmpTax.total_income} />
                    <FieldView label="TDS Deducted" value={prevEmpTax.tds_deducted} />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-6">
                    <FieldViewWithBadge 
                      label="Form 16" 
                      value={prevEmpTax.form16_doc ? 'Form 16 PDF' : ''} 
                      docUrl={prevEmpTax.form16_doc}
                      status={prevTax.form16_status}
                      reason={prevTax.form16_reason}
                    />
                    <FieldViewWithBadge 
                      label="Last Salary Slip" 
                      value={prevEmpTax.salary_slip_doc ? 'Salary Slip PDF/Image' : ''} 
                      docUrl={prevEmpTax.salary_slip_doc}
                      status={prevTax.salary_slip_status}
                      reason={prevTax.salary_slip_reason}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </ProfileSectionCard>
    </div>
  );
}
