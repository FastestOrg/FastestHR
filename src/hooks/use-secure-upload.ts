import { useState } from 'react';
import { toast } from 'sonner';

export interface FileValidationOptions {
  allowedExtensions?: string[];
  allowedMimeTypes?: string[];
  maxSizeBytes?: number;
  checkMagicBytes?: boolean;
}

export function useSecureUpload() {
  const [isValidating, setIsValidating] = useState(false);

  /**
   * Reads the first few bytes of a file as a hex string to verify its file type signature (magic bytes).
   */
  const getFileHeaderHex = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        if (!e.target || !e.target.result) {
          reject(new Error('Failed to read file headers'));
          return;
        }
        const arr = new Uint8Array(e.target.result as ArrayBuffer);
        let hex = '';
        for (let i = 0; i < arr.length; i++) {
          hex += arr[i].toString(16).padStart(2, '0').toUpperCase();
        }
        resolve(hex);
      };
      
      reader.onerror = () => reject(reader.error);
      
      // Read the first 8 bytes of the file
      const blob = file.slice(0, 8);
      reader.readAsArrayBuffer(blob);
    });
  };

  /**
   * Validates a file dynamically based on size, extension, mime-type, and binary magic-bytes.
   */
  const validateFile = async (file: File, options: FileValidationOptions = {}): Promise<boolean> => {
    setIsValidating(true);
    
    const defaults = {
      allowedExtensions: ['pdf', 'png', 'jpg', 'jpeg'],
      allowedMimeTypes: ['application/pdf', 'image/png', 'image/jpeg'],
      maxSizeBytes: 5 * 1024 * 1024, // 5MB default
      checkMagicBytes: true
    };

    const config = { ...defaults, ...options };
    
    // 1. Validate File Size
    if (file.size > config.maxSizeBytes) {
      const sizeMb = (config.maxSizeBytes / (1024 * 1024)).toFixed(0);
      toast.error(`File is too large. Maximum allowed size is ${sizeMb}MB.`);
      setIsValidating(false);
      return false;
    }

    // 2. Validate Extension
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!fileExt || !config.allowedExtensions.includes(fileExt)) {
      toast.error(`Invalid file format. Supported formats: ${config.allowedExtensions.join(', ').toUpperCase()}`);
      setIsValidating(false);
      return false;
    }

    // 3. Validate Mime-Type
    if (!config.allowedMimeTypes.includes(file.type)) {
      toast.error(`Invalid file content-type (${file.type}). Supported content-types: ${config.allowedMimeTypes.join(', ')}`);
      setIsValidating(false);
      return false;
    }

    // 4. Secure Magic Bytes verification
    if (config.checkMagicBytes) {
      try {
        const hex = await getFileHeaderHex(file);
        
        let isValidSignature = false;
        let fileType = '';

        if (hex.startsWith('25504446')) { // %PDF
          fileType = 'pdf';
          isValidSignature = fileExt === 'pdf' && file.type === 'application/pdf';
        } else if (hex.startsWith('89504E47')) { // PNG
          fileType = 'png';
          isValidSignature = fileExt === 'png' && file.type === 'image/png';
        } else if (hex.startsWith('FFD8FF')) { // JPEG/JPG
          fileType = 'jpg';
          isValidSignature = (fileExt === 'jpg' || fileExt === 'jpeg') && file.type === 'image/jpeg';
        } else {
          // Unrecognized magic byte signature
          toast.error('Security alert: The uploaded file has an invalid or tampered binary signature structure.');
          setIsValidating(false);
          return false;
        }

        if (!isValidSignature) {
          toast.error(`Security alert: Mismatched file extension. The file claims to be a .${fileExt} but its binary headers match a .${fileType}.`);
          setIsValidating(false);
          return false;
        }
      } catch (err) {
        console.error('Magic bytes validation error:', err);
        toast.error('File integrity verification failed.');
        setIsValidating(false);
        return false;
      }
    }

    setIsValidating(false);
    return true;
  };

  return {
    validateFile,
    isValidating
  };
}
