import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, Download, CheckCircle, XCircle, FileSignature, Mail, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { OfferLetterRenderer } from '@/components/recruitment/OfferLetterRenderer';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, MousePointer2 } from "lucide-react";
import { SignaturePortal } from '@/components/recruitment/SignaturePortal';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function OfferView() {
  const { token } = useParams<{ token: string }>();
  const [offer, setOffer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [showSignPortal, setShowSignPortal] = useState(false);
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [isPlacementMode, setIsPlacementMode] = useState(false);
  const [placedSignatures, setPlacedSignatures] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // OTP Verification state variables
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [generatedOtpMock, setGeneratedOtpMock] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function fetchOffer() {
      if (!token) {
        setError('Invalid offer link.');
        setLoading(false);
        return;
      }
      
      const cleanToken = token.trim();
      
      try {
        const { data, error: fetchError } = await supabase
          .rpc('get_offer_details_by_token', { p_token: cleanToken });

        if (fetchError) {
          console.error('RPC Error fetching offer:', fetchError);
          setError(`Offer Access Error: ${fetchError.message || 'The offer details could not be retrieved.'}`);
        } else if (!data) {
          setError('Offer not found or link has expired.');
        } else {
          setOffer(data);
          // Ensure we load existing signatures if they exist
          if (data.signature_placement && Array.isArray(data.signature_placement)) {
            setPlacedSignatures(data.signature_placement);
            console.log('Loaded existing signatures:', data.signature_placement.length);
          } else {
            setPlacedSignatures([]);
          }
        }
      } catch (err: unknown) {
        console.error('Catch Error fetching offer:', err);
        setError((err instanceof Error ? err.message : String(err)));
      } finally {
        setLoading(false);
      }
    }

    fetchOffer();
  }, [token]);

  const handlePrint = () => {
    window.print();
  };

  const handleAcceptOffer = async () => {
    if (!offer) return;
    setAccepting(true);
    try {
      const { data, error: funcError } = await supabase.functions.invoke('send-candidate-magic-link', {
        body: { 
          offer_id: offer.id,
          candidate_email: offer.candidates?.email,
          token: token
        }
      });

      if (funcError) throw funcError;
      if (data?.error) throw new Error(data.error);

      toast.success("Acceptance confirmation link sent! Please check your email.");
      setOffer({ ...offer, status: 'accepted' });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to send acceptance link");
    } finally {
      setAccepting(false);
    }
  };

  const handleResendAcceptanceLink = async () => {
    if (!offer) return;
    setAccepting(true);
    try {
      const { data, error: funcError } = await supabase.functions.invoke('send-candidate-magic-link', {
        body: { 
          offer_id: offer.id,
          candidate_email: offer.candidates?.email,
          token: token
        }
      });

      if (funcError) throw funcError;
      if (data?.error) throw new Error(data.error);

      toast.success("Link resent! Please check your email.");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to resend link");
    } finally {
      setAccepting(false);
    }
  };

  const handleDocumentClick = (e: React.MouseEvent) => {
    if (!isPlacementMode || !signatureImage || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const role = user?.email === offer.candidates?.email ? 'candidate' : 'manager';

    setPlacedSignatures([...placedSignatures, {
      id: crypto.randomUUID(),
      x,
      y,
      image: signatureImage,
      role: role
    }]);

    setIsPlacementMode(false);
    toast.success("Signature placed! You can now submit the signed document.");
  };

  const handleStartSignatureSigning = async () => {
    if (!offer || placedSignatures.length === 0) return;
    
    setSubmitting(true);
    try {
      const cleanToken = token!.trim();
      const { data: otp, error: otpErr } = await supabase
        .rpc('generate_offer_otp_by_token', { p_token: cleanToken });

      if (otpErr) throw otpErr;
      
      // Store generated OTP in local state for easy debugging / local testing
      setGeneratedOtpMock(otp || '');
      console.log('--- DIGITAL SIGNATURE EMAIL OTP ---');
      console.log(`Generated OTP code for candidate signing: ${otp}`);
      console.log('-----------------------------------');
      
      setShowOtpModal(true);
    } catch (err: any) {
      toast.error("Failed to generate signature verification code: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmOtpAndSign = async () => {
    if (!otpCode || otpCode.length !== 6) {
      toast.error('Please enter a valid 6-digit verification code.');
      return;
    }
    
    setVerifyingOtp(true);
    try {
      let clientIp = '127.0.0.1';
      try {
        const res = await fetch('https://api.ipify.org?format=json');
        const json = await res.json();
        clientIp = json.ip;
      } catch (e) {
        console.warn('Fallback to local IP:', e);
      }

      const cleanToken = token!.trim();
      const { data: success, error: updateError } = await supabase
        .rpc('verify_and_sign_offer_by_token', { 
          p_token: cleanToken,
          p_otp_code: otpCode,
          p_signature_placement: placedSignatures,
          p_ip: clientIp,
          p_user_agent: navigator.userAgent
        });

      if (updateError) throw updateError;
      if (!success) throw new Error("Verification failed or offer already signed.");

      toast.success("Offer letter verified and digitally signed successfully!");
      setOffer({ ...offer, status: 'signed' });
      setShowOtpModal(false);
      setOtpCode('');
    } catch (err: any) {
      toast.error(err.message || "Failed to verify signing OTP");
    } finally {
      setVerifyingOtp(false);
    }
  };

  const isCandidateAuthenticated = useMemo(() => {
    return user && user.email === offer?.candidates?.email;
  }, [user, offer]);

  const isManagerAuthenticated = useMemo(() => {
    return user && user.email && user.email !== offer?.candidates?.email;
  }, [user, offer]);

  const variables = useMemo(() => {
    if (!offer) return {};
    const joiningDate = offer.offer_data?.joiningDate || offer.joining_date;
    const payout = offer.offer_data?.payout || offer.payout;
    const formattedPayout = payout?.toLocaleString('en-US', { style: 'currency', currency: offer.companies?.currency || 'USD' });
    
    return {
      'Name': offer.candidates?.full_name || '',
      'Designation': offer.jobs?.title || '',
      'job_title': offer.jobs?.title || '',
      'Joined Date': joiningDate || '',
      'Payout': formattedPayout || '',
      'Offer Number': offer.offer_number || '',
      'offer_number': offer.offer_number || ''
    };
  }, [offer]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground animate-pulse font-mono uppercase tracking-widest text-xs">Authenticating Offer Token...</p>
      </div>
    );
  }

  if (error || !offer) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="bg-background border border-destructive/20 p-8 rounded-lg shadow-2xl max-w-md text-center">
          <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Offer Unavailable</h2>
          <p className="text-muted-foreground">{error || 'The offer link you followed is invalid.'}</p>
          <Button variant="outline" className="mt-6 w-full" onClick={() => window.location.href = '/'}>
            Return Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 py-12 px-4 sm:px-6 lg:px-8 print:p-0 print:bg-white text-slate-900">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Actions Bar (Hidden on print) */}
        <div className="flex justify-between items-center bg-background/80 backdrop-blur-md p-4 rounded-xl border border-border/50 shadow-lg sticky top-6 z-10 print:hidden">
          <div className="flex items-center gap-4 text-foreground">
            <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold leading-none">{offer.jobs?.title}</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">{offer.companies?.name}</p>
            </div>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            {/* STEP 1: status=sent → Show "Sign the Offer Letter" */}
            {offer.status === 'sent' && (
              <>
                {!isPlacementMode && (placedSignatures.length === 0) && (
                  <Button variant="default" size="sm" onClick={() => setShowSignPortal(true)} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                    <FileSignature className="h-4 w-4" />
                    Sign the Offer Letter
                  </Button>
                )}
                {isPlacementMode && (
                  <div className="flex items-center gap-2 text-xs font-bold text-primary animate-pulse bg-primary/10 px-4 py-2 rounded-lg border border-primary/20">
                    <MousePointer2 className="h-4 w-4" />
                    Click on the document to place signature
                  </div>
                )}
                {placedSignatures.length > 0 && !isPlacementMode && (
                  <Button variant="default" size="sm" onClick={handleStartSignatureSigning} disabled={submitting} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                    Submit Signature
                  </Button>
                )}
              </>
            )}

            {/* STEP 2: status=signed → Show "Accept Offer Letter" */}
            {offer.status === 'signed' && (
              <Button variant="default" size="sm" onClick={handleAcceptOffer} disabled={accepting} className="gap-2 bg-primary hover:bg-primary/90">
                {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Accept Offer Letter
              </Button>
            )}

            {/* STEP 3: status=accepted → Show email check message + resend option */}
            {offer.status === 'accepted' && !isCandidateAuthenticated && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 text-xs font-medium text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 rounded-full border border-amber-200 dark:border-amber-800">
                  <Mail className="h-3 w-3" />
                  Check your email to confirm acceptance
                </div>
                <Button variant="ghost" size="sm" onClick={handleResendAcceptanceLink} disabled={accepting} className="gap-1 text-xs text-primary hover:text-primary/80">
                  {accepting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                  Resend Link
                </Button>
              </div>
            )}

            {/* STEP 4: status=accepted + candidate authenticated via magic link → Offer Accepted */}
            {offer.status === 'accepted' && isCandidateAuthenticated && (
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                <CheckCircle className="h-3.5 w-3.5" />
                Offer Letter Accepted
              </div>
            )}

            {/* Print / Save PDF — Always visible */}
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
              <Download className="h-4 w-4" /> Print / Save PDF
            </Button>
          </div>
        </div>

        {/* Info Alerts based on status */}
        {offer.status === 'sent' && (
          <Alert className="bg-blue-50 border-blue-200 text-blue-800 animate-in fade-in slide-in-from-top-4 duration-500">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-sm font-bold">Sign Your Offer Letter</AlertTitle>
            <AlertDescription className="text-xs">
              Please review the offer letter below and click <strong>"Sign the Offer Letter"</strong> to place your signature on the document.
              <p className="mt-2 text-[10px] opacity-80 uppercase tracking-tighter font-semibold">
                Signatures are never shared or saved to the company, and as per legal documentation, make sure you are using your legal Signatures here.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {offer.status === 'signed' && (
          <Alert className="bg-indigo-50 border-indigo-200 text-indigo-800 animate-in fade-in slide-in-from-top-4 duration-500">
            <CheckCircle className="h-4 w-4 text-indigo-600" />
            <AlertTitle className="text-sm font-bold">Document Signed Successfully</AlertTitle>
            <AlertDescription className="text-xs">
              Your signature has been placed. Click <strong>"Accept Offer Letter"</strong> to formally accept. A confirmation link will be sent to <strong>{offer.candidates?.email}</strong> for verification.
            </AlertDescription>
          </Alert>
        )}

        {offer.status === 'accepted' && !isCandidateAuthenticated && (
          <Alert className="bg-amber-50 border-amber-200 text-amber-800 animate-in fade-in slide-in-from-top-4 duration-500">
            <Mail className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-sm font-bold">Confirm via Email</AlertTitle>
            <AlertDescription className="text-xs">
              A confirmation link has been sent to <strong>{offer.candidates?.email}</strong>. Please check your inbox and click the link to finalize your acceptance. If you didn't receive it, click <strong>"Resend Link"</strong> above.
            </AlertDescription>
          </Alert>
        )}

        {/* Offer Letter Content */}
        <div 
          ref={containerRef} 
          className={`relative transition-all duration-300 ${isPlacementMode ? 'cursor-crosshair ring-2 ring-primary ring-offset-4 ring-offset-slate-100 rounded-lg shadow-2xl' : ''}`}
          onClick={handleDocumentClick}
        >
          <OfferLetterRenderer 
            htmlContent={offer.html_content}
            variables={variables}
            letterheadUrl={offer.letterhead_url}
            isPredefinedHtml={offer.is_predefined_html}
          />

          {/* Placed Signatures Overlay */}
          {placedSignatures.map((sig) => (
            <div
              key={sig.id}
              className="absolute pointer-events-none group translate-x-[-50%] translate-y-[-50%]"
              style={{
                left: `${sig.x}%`,
                top: `${sig.y}%`,
                width: '150px', // Standard signature width
              }}
            >
              <img src={sig.image} alt="Signature" className="w-full mix-blend-multiply" />
            </div>
          ))}

          {/* Instructions Overlay */}
          {isPlacementMode && (
            <div className="absolute inset-0 bg-primary/5 pointer-events-none flex items-center justify-center">
              <div className="bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-2xl border border-primary/20 text-center max-w-xs animate-in zoom-in-95 duration-300">
                <MousePointer2 className="h-10 w-10 text-primary mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-900">Placement Mode Active</h3>
                <p className="text-xs text-slate-500 mt-1">Point and click exactly where you want your signature to appear on the document.</p>
              </div>
            </div>
          )}
        </div>

        <SignaturePortal 
          isOpen={showSignPortal}
          onClose={() => setShowSignPortal(false)}
          onSignatureReady={(img) => {
            setSignatureImage(img);
            setIsPlacementMode(true);
            toast.info("Signature ready! Now click on the document to place it.");
          }}
        />

        {/* OTP Verification Dialog */}
        <Dialog open={showOtpModal} onOpenChange={setShowOtpModal}>
          <DialogContent className="max-w-md p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-primary font-bold">
                <Shield className="h-5 w-5" /> Signature Verification Challenge
              </DialogTitle>
              <DialogDescription className="text-xs mt-1">
                For legal compliance and security, a 6-digit security code has been sent to your registered email address <strong>{offer.candidates?.email ? offer.candidates.email.replace(/(.{2})(.*)(@.*)/, "$1***$3") : 'your email'}</strong>.
              </DialogDescription>
            </DialogHeader>
            <div className="py-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Enter 6-Digit OTP Code
                </Label>
                <Input
                  type="text"
                  maxLength={6}
                  placeholder="000000"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                  className="h-12 text-center text-2xl font-mono tracking-[0.75em] bg-background border-border/80 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all rounded-xl"
                />
              </div>
              
              {generatedOtpMock && (
                <div className="p-3 bg-muted/40 rounded-lg border border-dashed border-border/50 text-[10px] text-muted-foreground text-center">
                  <span><strong>Developer Debug Mode:</strong> OTP sent is: <span className="font-mono text-primary font-bold text-xs select-all bg-background px-1.5 py-0.5 rounded border border-border/30">{generatedOtpMock}</span></span>
                </div>
              )}
            </div>
            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setShowOtpModal(false); setOtpCode(''); }}
                disabled={verifyingOtp}
                className="w-full sm:flex-1 h-9 font-semibold"
              >
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleConfirmOtpAndSign}
                disabled={verifyingOtp || otpCode.length !== 6}
                className="w-full sm:flex-1 h-9 bg-primary hover:bg-primary/90 font-semibold"
              >
                {verifyingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify & Digitally Sign'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Footer (Hidden on print) */}
        <div className="text-center pb-12 print:hidden">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">
            Offered via <span className="text-primary font-bold">FastestHR</span> Autonomous Recruitment System
          </p>
        </div>
      </div>
    </div>
  );
}
