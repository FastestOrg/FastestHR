import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Building, Receipt, Landmark } from 'lucide-react';
import { ProfileSectionCard } from '../components/ProfileSectionCard';
import { FileUploadField } from '../components/FileUploadField';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BankFinancialProps {
  employee: any;
  refetch: () => void;
}

function FieldView({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      <p className="text-sm font-medium text-foreground py-1">
        {value || <span className="text-muted-foreground italic font-normal">Not provided</span>}
      </p>
    </div>
  );
}

function FI({ label, name, value, onChange, type = 'text', placeholder = '' }: {
  label: string; name: string; value: string; onChange: (n: string, v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
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
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      <select value={value} onChange={(e) => onChange(name, e.target.value)}
        className="flex h-10 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none transition-colors shadow-sm">
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
        statement_doc: primary.statement_doc, passbook_doc: primary.passbook_doc,
        secondary: {
          bank_name: secondary.bank_name, holder_name: secondary.holder_name,
          account_number: secondary.account_number, account_type: secondary.account_type,
          ifsc: secondary.ifsc, branch_name: secondary.branch_name,
        },
      },
      custom_fields: {
        ...cf,
        tax_info: taxInfo,
        prev_employer_tax: prevEmpTax,
      },
    } as any;
    const { error } = await supabase.from('employees').update(updateData).eq('id', employee.id);
    if (error) { toast.error(error.message); throw error; }
    toast.success('Bank & financial details saved');
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* Primary Bank */}
      <ProfileSectionCard title="Primary Bank Account" icon={<Landmark className="h-4 w-4 text-primary/70" />} onSave={handleSave}>
        {(editing) => (
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
            {editing ? (
              <>
                <FI label="Bank Name" name="bank_name" value={primary.bank_name} onChange={upP} />
                <FI label="Account Holder Name" name="holder_name" value={primary.holder_name} onChange={upP} />
                <FI label="Account Number" name="account_number" value={primary.account_number} onChange={upP} />
                <FI label="Re-enter Account Number" name="account_number_confirm" value={primary.account_number_confirm} onChange={upP} />
                <SF label="Account Type" name="account_type" value={primary.account_type} onChange={upP} options={['Savings', 'Current']} />
                <FI label="IFSC / SWIFT / Routing Number" name="ifsc" value={primary.ifsc} onChange={upP} />
                <FI label="Branch Name" name="branch_name" value={primary.branch_name} onChange={upP} />
                <FI label="Branch Address" name="branch_address" value={primary.branch_address} onChange={upP} />
                <FileUploadField label="Upload Cancelled Cheque" value={primary.cheque_doc} onChange={(url) => upP('cheque_doc', url || '')} path={storagePath} disabled={!editing} />
                <FileUploadField label="Upload Bank Statement (3 months)" value={primary.statement_doc} onChange={(url) => upP('statement_doc', url || '')} path={storagePath} disabled={!editing} />
                <FileUploadField label="Upload Passbook First Page" value={primary.passbook_doc} onChange={(url) => upP('passbook_doc', url || '')} path={storagePath} disabled={!editing} />
              </>
            ) : (
              <>
                <FieldView label="Bank Name" value={primary.bank_name} />
                <FieldView label="Account Holder" value={primary.holder_name} />
                <FieldView label="Account Number" value={primary.account_number ? `****${primary.account_number.slice(-4)}` : ''} />
                <FieldView label="Account Type" value={primary.account_type} />
                <FieldView label="IFSC/SWIFT" value={primary.ifsc} />
                <FieldView label="Branch" value={primary.branch_name} />
              </>
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
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
              {editing ? (
                <>
                  <FI label="PAN Number / Tax ID" name="pan_number" value={taxInfo.pan_number} onChange={upT} />
                  <FileUploadField label="Upload PAN Card" value={taxInfo.pan_doc} onChange={(url) => upT('pan_doc', url || '')} path={storagePath} disabled={!editing} />
                  <FI label="Tax Residency Status" name="tax_residency" value={taxInfo.tax_residency} onChange={upT} />
                </>
              ) : (
                <>
                  <FieldView label="PAN / Tax ID" value={taxInfo.pan_number} />
                  <FieldView label="Tax Residency" value={taxInfo.tax_residency} />
                </>
              )}
            </div>
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Previous Employer Tax Details</h4>
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
                {editing ? (
                  <>
                    <FI label="Previous Employer Name" name="employer_name" value={prevEmpTax.employer_name} onChange={upPT} />
                    <FI label="Total Income" name="total_income" value={prevEmpTax.total_income} onChange={upPT} type="number" />
                    <FI label="TDS Deducted" name="tds_deducted" value={prevEmpTax.tds_deducted} onChange={upPT} type="number" />
                    <FileUploadField label="Upload Form 16" value={prevEmpTax.form16_doc} onChange={(url) => upPT('form16_doc', url || '')} path={storagePath} disabled={!editing} />
                    <FileUploadField label="Upload Last Salary Slip" value={prevEmpTax.salary_slip_doc} onChange={(url) => upPT('salary_slip_doc', url || '')} path={storagePath} disabled={!editing} />
                  </>
                ) : (
                  <>
                    <FieldView label="Prev Employer" value={prevEmpTax.employer_name} />
                    <FieldView label="Total Income" value={prevEmpTax.total_income} />
                    <FieldView label="TDS Deducted" value={prevEmpTax.tds_deducted} />
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </ProfileSectionCard>
    </div>
  );
}
