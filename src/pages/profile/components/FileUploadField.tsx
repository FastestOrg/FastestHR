import { useRef, useState } from 'react';
import { Upload, File, X, Image, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FileUploadFieldProps {
  label: string;
  value?: string | null;
  onChange: (url: string | null) => void;
  bucket?: string;
  path?: string;
  accept?: string;
  disabled?: boolean;
  maxSizeMB?: number;
}

export function FileUploadField({
  label,
  value,
  onChange,
  bucket = 'profile-documents',
  path = '',
  accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx',
  disabled = false,
  maxSizeMB = 5,
}: FileUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const isImage = (url: string) => /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url);

  const handleFile = async (file: File) => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`File size must be less than ${maxSizeMB}MB`);
      return;
    }

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
    } catch (err: any) {
      toast.error(err?.message || 'Upload failed');
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

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </label>

      {value ? (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/10">
          {isImage(value) ? (
            <div className="h-12 w-12 rounded-md overflow-hidden border border-border/30 shrink-0">
              <img src={value} alt={label} className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <File className="h-5 w-5 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">
              {value.split('/').pop()?.split('?')[0] || 'Uploaded file'}
            </p>
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              View file
            </a>
          </div>
          {!disabled && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
              onClick={handleRemove}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ) : (
        <div
          className={`relative border-2 border-dashed rounded-lg p-4 text-center transition-all cursor-pointer ${
            dragOver
              ? 'border-primary bg-primary/5'
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
              <span className="text-xs text-muted-foreground">Uploading...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-2">
              <div className="h-8 w-8 rounded-full bg-muted/30 flex items-center justify-center">
                <Upload className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs font-medium text-foreground">Drop file or click to upload</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Max {maxSizeMB}MB • {accept.replace(/\./g, '').toUpperCase()}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
