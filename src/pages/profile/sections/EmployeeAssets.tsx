import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProfileSectionCard } from '../components/ProfileSectionCard';
import { Laptop, Calendar, CheckCircle2, PenTool, AlertCircle, RefreshCw, Type, Eye } from 'lucide-react';
import { toast } from 'sonner';

interface EmployeeAssetsProps {
  employee: any;
  refetch: () => void;
}

export default function EmployeeAssets({ employee, refetch }: EmployeeAssetsProps) {
  const queryClient = useQueryClient();
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [signatureMode, setSignatureMode] = useState<'draw' | 'type'>('draw');
  const [typedName, setTypedName] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Fetch assets assigned to the current employee
  const { data: myAssets = [], isLoading } = useQuery({
    queryKey: ['my-assets', employee.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .eq('assigned_employee_id', employee.id)
        .order('assignment_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!employee.id,
  });

  // Canvas drawing setup & helper functions
  useEffect(() => {
    if (selectedAsset && signatureMode === 'draw' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#2563eb'; // blue-600
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [selectedAsset, signatureMode]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // Sign off Handover mutation
  const signOffAsset = useMutation({
    mutationFn: async () => {
      let signatureDataUrl = '';

      if (signatureMode === 'draw') {
        const canvas = canvasRef.current;
        if (!canvas) throw new Error('Canvas not found');
        
        // Simple blank canvas check: check if the canvas has any painted pixels
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Context not found');
        const buffer = new Uint32Array(ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
        const isBlank = !buffer.some(color => color !== 0);
        if (isBlank) {
          throw new Error('Please sign the canvas before submitting');
        }
        signatureDataUrl = canvas.toDataURL('image/png');
      } else {
        if (!typedName.trim()) {
          throw new Error('Please type your name before submitting');
        }
        // Draw typed text onto an off-screen canvas to convert it into a beautiful signature image
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 450;
        tempCanvas.height = 150;
        const ctx = tempCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
          ctx.font = 'italic bold 32px cursive';
          ctx.fillStyle = '#1e3a8a'; // deep dark blue
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(typedName, tempCanvas.width / 2, tempCanvas.height / 2);
          signatureDataUrl = tempCanvas.toDataURL('image/png');
        }
      }

      const { error } = await supabase
        .from('assets')
        .update({
          signature_url: signatureDataUrl,
          signed_at: new Date().toISOString(),
        })
        .eq('id', selectedAsset.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-assets'] });
      toast.success('Handover sign-off completed successfully');
      setSelectedAsset(null);
      setTypedName('');
      refetch();
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to submit signature');
    },
  });

  return (
    <ProfileSectionCard
      title="Assigned Equipment & Assets"
      icon={<Laptop className="h-4 w-4 text-primary/70" />}
      readOnly
    >
      {() => (
        <div className="space-y-6">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
          ) : myAssets.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border/50 rounded-xl bg-muted/5">
              <Laptop className="w-10 h-10 mx-auto mb-3 opacity-20 text-primary" />
              <p className="text-sm font-medium">No assets assigned</p>
              <p className="text-xs text-muted-foreground mt-1">
                You currently have no company-issued laptops or devices assigned to you.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {myAssets.map((asset: any) => {
                const isSigned = !!asset.signed_at;
                return (
                  <div
                    key={asset.id}
                    className="flex flex-col md:flex-row md:items-center justify-between p-5 rounded-xl border border-border/40 bg-background/50 hover:bg-background/80 transition-all shadow-sm gap-4 animate-in fade-in duration-300"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-11 h-11 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                        <Laptop className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-sm">{asset.model_name}</p>
                          <Badge variant="outline" className="text-[10px] bg-muted/30">
                            {asset.category}
                          </Badge>
                          {isSigned ? (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[9px] uppercase tracking-wide">
                              Accepted & Signed
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[9px] uppercase tracking-wide animate-pulse">
                              Pending Sign-off
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Serial Number: <span className="font-mono">{asset.serial_number}</span>
                        </p>
                        {asset.assignment_date && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-muted-foreground/60" />
                            Assigned on: {new Date(asset.assignment_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 justify-end border-t md:border-t-0 pt-3 md:pt-0 border-border/10">
                      {isSigned ? (
                        <div className="flex flex-col text-right">
                          <span className="text-xs font-medium text-emerald-600 flex items-center gap-1.5 justify-end">
                            <CheckCircle2 className="w-4 h-4" /> Signed off
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(asset.signed_at).toLocaleString()}
                          </span>
                          {asset.signature_url && (
                            <Dialog>
                              <DialogContent className="max-w-sm bg-card border-border/50">
                                <DialogHeader>
                                  <DialogTitle className="text-sm font-medium">Digital Signature Proof</DialogTitle>
                                  <DialogDescription>Signed off on {new Date(asset.signed_at).toLocaleDateString()}</DialogDescription>
                                </DialogHeader>
                                <div className="p-4 border border-border/50 rounded-xl bg-white flex justify-center items-center">
                                  <img src={asset.signature_url} alt="Signature Proof" className="max-h-24 object-contain" />
                                </div>
                              </DialogContent>
                              <Button variant="link" className="text-[10px] text-primary h-6 p-0 hover:underline flex items-center gap-1 justify-end">
                                <Eye className="w-3 h-3" /> View Signature Proof
                              </Button>
                            </Dialog>
                          )}
                        </div>
                      ) : (
                        <Button
                          onClick={() => {
                            setSelectedAsset(asset);
                            setTypedName('');
                          }}
                          className="w-full md:w-auto shadow-sm gap-1.5"
                          size="sm"
                        >
                          <PenTool className="w-3.5 h-3.5" /> Sign Handover Agreement
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Signature/Sign-off Modal */}
          {selectedAsset && (
            <Dialog open={!!selectedAsset} onOpenChange={(open) => !open && setSelectedAsset(null)}>
              <DialogContent className="max-w-lg bg-card border-border/50">
                <DialogHeader>
                  <DialogTitle className="text-base font-semibold">Hardware Handover Sign-off</DialogTitle>
                  <DialogDescription>
                    Review the handover agreement terms for your assigned device.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-3">
                  <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Device Details</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Model:</span> <span className="font-semibold">{selectedAsset.model_name}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Serial No:</span> <span className="font-mono font-semibold">{selectedAsset.serial_number}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border border-border/40 rounded-xl bg-background text-[11px] text-muted-foreground leading-relaxed space-y-2 h-32 overflow-y-auto shadow-inner">
                    <h4 className="font-semibold text-foreground text-xs">Hardware Acceptance Terms & Conditions</h4>
                    <p>
                      1. I acknowledge receipt of the physical IT equipment detailed above in fully operational, good working condition.
                    </p>
                    <p>
                      2. I agree to safeguard the device and use it strictly in compliance with company security practices, including preserving confidentiality of access credentials.
                    </p>
                    <p>
                      3. I understand that this device remains the property of the company and must be returned immediately upon termination of employment or request by IT administration.
                    </p>
                    <p>
                      4. In the event of damage due to negligence or loss, I agree to report the incident to the IT support desk within 24 hours.
                    </p>
                  </div>

                  <Tabs value={signatureMode} onValueChange={(val: any) => setSignatureMode(val)} className="w-full">
                    <TabsList className="grid grid-cols-2 w-full h-10 p-1 bg-muted/40">
                      <TabsTrigger value="draw" className="text-xs gap-1.5">
                        <PenTool className="w-3.5 h-3.5" /> Draw Signature
                      </TabsTrigger>
                      <TabsTrigger value="type" className="text-xs gap-1.5">
                        <Type className="w-3.5 h-3.5" /> Type Name
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="draw" className="space-y-2 pt-2 focus-visible:outline-none">
                      <div className="relative border border-border/50 rounded-xl bg-white overflow-hidden shadow-sm h-40">
                        <canvas
                          ref={canvasRef}
                          width={450}
                          height={160}
                          onMouseDown={startDrawing}
                          onMouseMove={draw}
                          onMouseUp={stopDrawing}
                          onMouseLeave={stopDrawing}
                          onTouchStart={startDrawing}
                          onTouchMove={draw}
                          onTouchEnd={stopDrawing}
                          className="w-full h-full cursor-crosshair bg-white"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={clearCanvas}
                          className="absolute right-2 bottom-2 text-xs h-7 px-2 hover:bg-muted text-muted-foreground"
                        >
                          <RefreshCw className="w-3 h-3 mr-1" /> Clear
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground text-center">Use your mouse or touch screen to draw your signature in the box.</p>
                    </TabsContent>

                    <TabsContent value="type" className="space-y-4 pt-2 focus-visible:outline-none">
                      <div className="space-y-2">
                        <Label htmlFor="typed-name" className="text-xs">Type your full legal name</Label>
                        <Input
                          id="typed-name"
                          value={typedName}
                          onChange={(e) => setTypedName(e.target.value)}
                          placeholder="e.g. John Doe"
                          className="h-10"
                        />
                      </div>
                      {typedName && (
                        <div className="p-4 border border-dashed border-primary/30 bg-primary/5 rounded-xl text-center h-20 flex items-center justify-center">
                          <span className="text-3xl italic font-semibold text-primary/80 select-none tracking-wide" style={{ fontFamily: 'cursive' }}>
                            {typedName}
                          </span>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                  <Button variant="outline" onClick={() => setSelectedAsset(null)}>Cancel</Button>
                  <Button
                    onClick={() => signOffAsset.mutate()}
                    disabled={signOffAsset.isPending}
                    className="shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    I Accept & Sign
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      )}
    </ProfileSectionCard>
  );
}
