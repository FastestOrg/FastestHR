import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, Download, CheckCircle, XCircle, FileSignature, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { OfferLetterRenderer } from '@/components/recruitment/OfferLetterRenderer';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, MousePointer2 } from "lucide-react";
import { SignaturePortal } from '@/components/recruitment/SignaturePortal';

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
      if (!token) return;
      
      try {
        const { data, error: fetchError } = await supabase
          .rpc('get_offer_details_by_token', { p_token: token });

        if (fetchError || !data) {
          setError('Offer not found or link has expired.');
        } else {
          setOffer(data);
          if (data.signature_placement) {
            setPlacedSignatures(data.signature_placement);
          }
        }
      } catch (err: unknown) {
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

      toast.success("Authentication link sent! Please check your email to securely sign the document.");
      setOffer({ ...offer, status: 'accepted' });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to send magic link");
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

  const handleSubmitSignature = async () => {
    if (!offer || placedSignatures.length === 0) return;
    
    setSubmitting(true);
    try {
      const { error: updateError } = await supabase
        .from('candidate_offers')
        .update({
          status: 'signed',
          signed_at: new Date().toISOString(),
          signature_placement: placedSignatures
        })
        .eq('id', offer.id);

      if (updateError) throw updateError;

      toast.success("Document signed and submitted successfully!");
      setOffer({ ...offer, status: 'signed' });
    } catch (err: any) {
      toast.error("Failed to submit signature: " + err.message);
    } finally {
      setSubmitting(false);
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
          <div className="flex gap-2">
            {offer.status === 'sent' && (
              <Button variant="default" size="sm" onClick={handleAcceptOffer} disabled={accepting} className="gap-2 bg-primary hover:bg-primary/90">
                {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />}
                Accept Offer Letter
              </Button>
            )}
            {offer.status === 'accepted' && !isCandidateAuthenticated && (
              <div className="flex items-center gap-2 text-xs font-medium text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                <Mail className="h-3 w-3" />
                Awaiting Login via Email Link
              </div>
            )}
            {(offer.status === 'sent' || (offer.status === 'accepted' && isManagerAuthenticated)) && (
              <div className="flex gap-2">
                {!isPlacementMode && placedSignatures.filter(s => s.role === 'manager').length === 0 && (
                  <Button variant="default" size="sm" onClick={() => setShowSignPortal(true)} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                    <FileSignature className="h-4 w-4" />
                    Sign as Company Representative
                  </Button>
                )}
                {isPlacementMode && (
                  <div className="flex items-center gap-2 text-xs font-bold text-primary animate-pulse bg-primary/10 px-4 py-2 rounded-lg border border-primary/20">
                    <MousePointer2 className="h-4 w-4" />
                    Click on the document to place signature
                  </div>
                )}
              </div>
            )}

            {offer.status === 'accepted' && isCandidateAuthenticated && (
              <div className="flex gap-2">
                {!isPlacementMode && placedSignatures.filter(s => s.role === 'candidate').length === 0 && (
                  <Button variant="default" size="sm" onClick={() => setShowSignPortal(true)} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                    <FileSignature className="h-4 w-4" />
                    Sign Now
                  </Button>
                )}
                {isPlacementMode && (
                  <div className="flex items-center gap-2 text-xs font-bold text-primary animate-pulse bg-primary/10 px-4 py-2 rounded-lg border border-primary/20">
                    <MousePointer2 className="h-4 w-4" />
                    Click on the document to place signature
                  </div>
                )}
              </div>
            )}
            
            {(placedSignatures.length > 0 && !isPlacementMode && offer.status !== 'signed') && (
              <Button variant="default" size="sm" onClick={handleSubmitSignature} disabled={submitting} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                {isManagerAuthenticated ? 'Save Signature' : 'Submit Signed Document'}
              </Button>
            )}
            {offer.status === 'signed' && (
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                <CheckCircle className="h-3 w-3" />
                Successfully Signed
              </div>
            )}
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
              <Download className="h-4 w-4" /> Print / Save PDF
            </Button>
          </div>
        </div>

        {offer.status === 'sent' && (
          <Alert className="bg-blue-50 border-blue-200 text-blue-800 animate-in fade-in slide-in-from-top-4 duration-500">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-sm font-bold">Document Signing Requirement</AlertTitle>
            <AlertDescription className="text-xs">
              Once you click "Accept Offer Letter", a secure magic link will be sent to <strong>{offer.candidates?.email}</strong>. 
              You must log in using that link to verify your identity before signing the document legally.
              <p className="mt-2 text-[10px] opacity-80 uppercase tracking-tighter font-semibold">
                Signatures are never shared or saved to the company, and as per legal documentation, make sure you are using your legal Signatures here.
              </p>
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
