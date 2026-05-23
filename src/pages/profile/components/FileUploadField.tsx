import { useRef, useState } from 'react';
import { Upload, File, X, Loader2, CheckCircle2, AlertCircle, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSecureUpload } from '@/hooks/use-secure-upload';

interface FileUploadFieldProps {
  label: string;
  value?: string | null;
  onChange: (url: string | null) => void;
  bucket?: string;
  path?: string;
  accept?: string;
  disabled?: boolean;
  maxSizeMB?: number;
  status?: 'Verified' | 'Pending Review' | 'Rejected' | 'Missing';
  statusReason?: string | null;
}

export function FileUploadField({
  label,
  value,
  onChange,
  bucket = 'profile-documents',
  path = '',
  accept = '.pdf,.jpg,.jpeg,.png',
  disabled = false,
  maxSizeMB = 5,
  status = 'Missing',
  statusReason,
}: FileUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const { validateFile } = useSecureUpload();

  const isImage = (url: string) => /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url);

  // Compute final status based on whether value exists
  const computedStatus = value 
    ? (status === 'Missing' ? 'Pending Review' : status)
    : 'Missing';

  const handleFile = async (file: File) => {
    // 1. Convert accept string to allowed extensions array (e.g., ['.pdf', '.png'] => ['pdf', 'png'])
    const allowedExtensions = accept
      .split(',')
      .map((ext) => ext.trim().replace(/^\./, '').toLowerCase());

    // 2. Map extensions to allowed MIME types for FICA/compliance safety
    const mimeMap: Record<string, string> = {
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
    };
    const allowedMimeTypes = allowedExtensions
      .map((ext) => mimeMap[ext])
      .filter(Boolean);

    // 3. Run secure validation (size, extension, mime, binary magic bytes)
    const isValid = await validateFile(file, {
      maxSizeBytes: maxSizeMB * 1024 * 1024,
      allowedExtensions,
      allowedMimeTypes,
      checkMagicBytes: true, // Performs strict binary header analysis
    });

    if (!isValid) return;

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${path}/${Date.now()}.${ext}`.replace(/^\//, '');
      
      const { error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, { upsert: true });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      onChange(urlData.publicUrl);
      toast.success('File uploaded successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleRemove = async () => {
    onChange(null);
  };

  // Premium HSL Badge styling generator
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
        return <CheckCircle2 className="h-3.5 w-3.5" />;
      case 'Pending Review':
        return <Clock className="h-3.5 w-3.5 animate-pulse" />;
      case 'Rejected':
        return <AlertTriangle className="h-3.5 w-3.5" />;
      default:
        return <AlertCircle className="h-3.5 w-3.5" />;
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </label>
        
        {/* Compliance Audit Status Badge */}
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium transition-all ${getBadgeStyle()}`}>
          {getStatusIcon()}
          <span>{computedStatus}</span>
        </div>
      </div>

      {value ? (
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-muted/10">
            {isImage(value) ? (
              <div className="h-12 w-12 rounded-lg overflow-hidden border border-border/30 shrink-0">
                <img src={value} alt={label} className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <File className="h-5 w-5 text-primary" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground truncate">
                {value.split('/').pop()?.split('?')[0] || 'Uploaded document'}
              </p>
              <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline font-medium inline-block mt-0.5"
              >
                View Document
              </a>
            </div>
            {!disabled && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 rounded-full"
                onClick={handleRemove}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {/* Render Rejection Alert Box */}
          {computedStatus === 'Rejected' && statusReason && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-rose-500/5 border border-rose-500/10 text-[11px] text-rose-600 dark:text-rose-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Rejection Reason: </span>
                {statusReason}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          className={`relative border-2 border-dashed rounded-xl p-4 text-center transition-all cursor-pointer ${
            dragOver
              ? 'border-primary bg-primary/5 shadow-inner scale-[0.99]'
              : 'border-border/40 hover:border-primary/50 hover:bg-muted/10'
          } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2 py-2">
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
              <span className="text-xs text-muted-foreground">Encrypting & Uploading...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-2">
              <div className="h-8 w-8 rounded-full bg-muted/30 flex items-center justify-center">
                <Upload className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Drop file or click to upload</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Max {maxSizeMB}MB • {accept.toUpperCase().replace(/\./g, '')}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
