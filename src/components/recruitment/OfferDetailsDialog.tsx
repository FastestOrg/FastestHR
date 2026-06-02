import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Loader2, Calendar, Banknote, Variable, FileSignature, Info, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { CustomVariable } from './OfferTemplateEditor';
import { SignaturePortal } from './SignaturePortal';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface OfferDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: { 
    joiningDate: string; 
    payout: number; 
    customVariableValues: Record<string, string>;
    totalDuration?: number;
    managerSignature?: string;
  }) => void;
  candidateName: string;
  jobEmploymentType?: string;
  defaultJoiningDate?: string;
  defaultPayout?: number;
  defaultCustomVariableValues?: Record<string, string>;
  customVariables?: CustomVariable[];
  isSubmitting?: boolean;
}

export function OfferDetailsDialog({ 
  isOpen, 
  onClose, 
  onConfirm, 
  candidateName,
  defaultJoiningDate,
  defaultPayout,
  defaultCustomVariableValues,
  customVariables = [],
  isSubmitting = false,
  jobEmploymentType
}: OfferDetailsDialogProps) {
  const [joiningDate, setJoiningDate] = useState('');
  const [payout, setPayout] = useState('');
  const [totalDuration, setTotalDuration] = useState('');
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [managerSignature, setManagerSignature] = useState<string | null>(null);
  const [showSignPortal, setShowSignPortal] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setJoiningDate(defaultJoiningDate || '');
      setPayout(defaultPayout ? defaultPayout.toString() : '');
      // Initialize custom variable values from defaults or empty
      const initial: Record<string, string> = {};
      for (const cv of customVariables) {
        initial[cv.key] = defaultCustomVariableValues?.[cv.key] || '';
      }
      setCustomValues(initial);
    }
  }, [isOpen, defaultJoiningDate, defaultPayout, defaultCustomVariableValues, customVariables]);

  const handleConfirm = () => {
    if (!joiningDate || !payout) {
      toast.error('Please fill in Joining Date and Payout');
      return;
    }

    // Validate required custom variables
    for (const cv of customVariables) {
      if (cv.required && !customValues[cv.key]?.trim()) {
        toast.error(`Please fill in "${cv.label || cv.key}"`);
        return;
      }
    }

    onConfirm({
      joiningDate,
      payout: parseFloat(payout),
      customVariableValues: customValues,
      totalDuration: jobEmploymentType === 'intern' && totalDuration ? parseInt(totalDuration, 10) : undefined,
      managerSignature: managerSignature || undefined
    });
  };

  const getInputIcon = (type: string) => {
    switch (type) {
      case 'date': return <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />;
      case 'number': return <Banknote className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />;
      default: return <Variable className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Finalize Offer Details</DialogTitle>
          <DialogDescription>
            Enter the offer details for <strong>{candidateName}</strong>. The offer letter template configured in stage automation will be used.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Joining Date</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                type="date"
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Annual Payout (CTC)</Label>
            <div className="relative">
              <Banknote className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                type="number"
                value={payout}
                onChange={(e) => setPayout(e.target.value)}
                placeholder="e.g. 1200000"
                className="pl-10"
              />
            </div>
          </div>

          {jobEmploymentType === 'intern' && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Duration (Days)</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="number"
                  value={totalDuration}
                  onChange={(e) => setTotalDuration(e.target.value)}
                  placeholder="e.g. 90"
                  className="pl-10"
                />
              </div>
            </div>
          )}

          {/* Custom Variable Fields */}
          {customVariables.filter(cv => cv.type !== 'current_date').length > 0 && (
            <>
              <div className="border-t border-border/30 pt-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-3">Additional Fields</p>
              </div>
              {customVariables.filter(cv => cv.type !== 'current_date').map((cv) => (
                <div key={cv.key} className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {cv.label || cv.key}
                    {cv.required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  <div className="relative">
                    {getInputIcon(cv.type)}
                    <Input 
                      type={cv.type === 'number' ? 'number' : cv.type === 'date' ? 'date' : 'text'}
                      value={customValues[cv.key] || ''}
                      onChange={(e) => setCustomValues(prev => ({ ...prev, [cv.key]: e.target.value }))}
                      placeholder={`Enter ${cv.label || cv.key}`}
                      className="pl-10"
                    />
                  </div>
                </div>
              ))}
            </>
          )}

          <div className="border-t border-border/30 pt-4 mt-6">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">Company Representative Signature</Label>
            {managerSignature ? (
              <div className="relative group bg-slate-50 border rounded-lg p-4 flex items-center justify-center min-h-[80px]">
                <img src={managerSignature} alt="Manager Signature" className="max-h-[60px] object-contain mix-blend-multiply" />
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => setManagerSignature(null)}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ) : (
              <Button 
                variant="outline" 
                className="w-full border-dashed py-8 flex flex-col gap-2 group hover:border-primary/50 hover:bg-primary/5 transition-all"
                onClick={() => setShowSignPortal(true)}
              >
                <div className="h-10 w-10 rounded-full bg-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileSignature className="h-5 w-5 text-primary" />
                </div>
                <span className="text-xs font-medium">Add My Signature (Optional)</span>
              </Button>
            )}
            
            <Alert className="mt-4 bg-amber-50/50 border-amber-200/50 py-2">
              <Info className="h-3 w-3 text-amber-600" />
              <AlertDescription className="text-[10px] text-amber-800 leading-tight">
                Signatures are never shared or saved to the company, and as per legal documentation, make sure you are using your legal Signatures here.
              </AlertDescription>
            </Alert>
          </div>
        </div>

        <SignaturePortal 
          isOpen={showSignPortal}
          onClose={() => setShowSignPortal(false)}
          onSignatureReady={setManagerSignature}
        />

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirm & Send Offer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
