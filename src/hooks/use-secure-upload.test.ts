import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useSecureUpload } from "./use-secure-upload";
import { toast } from "sonner";

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Helper to create mock files with specific bytes
const createFileWithBytes = (
  bytes: number[],
  name: string,
  type: string
): File => {
  const uint8Array = new Uint8Array(bytes);
  return new File([uint8Array], name, { type });
};

// Common magic bytes sequences
const MAGIC_BYTES = {
  PDF: [0x25, 0x50, 0x44, 0x46, 0x00, 0x00, 0x00, 0x00],
  PNG: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  JPG: [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46],
  INVALID: [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
};

describe("useSecureUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Validation logic", () => {
    it("should accept a valid PDF file", async () => {
      const { result } = renderHook(() => useSecureUpload());
      const file = createFileWithBytes(
        MAGIC_BYTES.PDF,
        "document.pdf",
        "application/pdf"
      );

      let isValid;
      await act(async () => {
        isValid = await result.current.validateFile(file);
      });

      expect(isValid).toBe(true);
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("should accept a valid PNG file", async () => {
      const { result } = renderHook(() => useSecureUpload());
      const file = createFileWithBytes(
        MAGIC_BYTES.PNG,
        "image.png",
        "image/png"
      );

      let isValid;
      await act(async () => {
        isValid = await result.current.validateFile(file);
      });

      expect(isValid).toBe(true);
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("should accept a valid JPG file", async () => {
      const { result } = renderHook(() => useSecureUpload());
      const file = createFileWithBytes(
        MAGIC_BYTES.JPG,
        "photo.jpg",
        "image/jpeg"
      );

      let isValid;
      await act(async () => {
        isValid = await result.current.validateFile(file);
      });

      expect(isValid).toBe(true);
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("should reject file exceeding max size", async () => {
      const { result } = renderHook(() => useSecureUpload());
      // Create a large file
      const file = new File([new ArrayBuffer(6 * 1024 * 1024)], "large.pdf", {
        type: "application/pdf",
      });

      let isValid;
      await act(async () => {
        isValid = await result.current.validateFile(file, {
          maxSizeBytes: 5 * 1024 * 1024,
        });
      });

      expect(isValid).toBe(false);
      expect(toast.error).toHaveBeenCalledWith(
        "File is too large. Maximum allowed size is 5MB."
      );
    });

    it("should reject invalid extension", async () => {
      const { result } = renderHook(() => useSecureUpload());
      const file = createFileWithBytes(
        MAGIC_BYTES.PDF,
        "document.txt",
        "text/plain"
      );

      let isValid;
      await act(async () => {
        isValid = await result.current.validateFile(file);
      });

      expect(isValid).toBe(false);
      expect(toast.error).toHaveBeenCalledWith(
        "Invalid file format. Supported formats: PDF, PNG, JPG, JPEG"
      );
    });

    it("should reject invalid mime type", async () => {
      const { result } = renderHook(() => useSecureUpload());
      const file = createFileWithBytes(
        MAGIC_BYTES.PDF,
        "document.pdf",
        "text/plain"
      );

      let isValid;
      await act(async () => {
        isValid = await result.current.validateFile(file);
      });

      expect(isValid).toBe(false);
      expect(toast.error).toHaveBeenCalledWith(
        "Invalid file content-type (text/plain). Supported content-types: application/pdf, image/png, image/jpeg"
      );
    });

    it("should reject file with invalid magic bytes", async () => {
      const { result } = renderHook(() => useSecureUpload());
      const file = createFileWithBytes(
        MAGIC_BYTES.INVALID,
        "fake.pdf",
        "application/pdf"
      );

      let isValid;
      await act(async () => {
        isValid = await result.current.validateFile(file);
      });

      expect(isValid).toBe(false);
      expect(toast.error).toHaveBeenCalledWith(
        "Security alert: The uploaded file has an invalid or tampered binary signature structure."
      );
    });

    it("should reject file with mismatched extension and magic bytes", async () => {
      const { result } = renderHook(() => useSecureUpload());
      // File has PDF extension and mime type but PNG magic bytes
      const file = createFileWithBytes(
        MAGIC_BYTES.PNG,
        "sneaky.pdf",
        "application/pdf"
      );

      let isValid;
      await act(async () => {
        isValid = await result.current.validateFile(file);
      });

      expect(isValid).toBe(false);
      expect(toast.error).toHaveBeenCalledWith(
        "Security alert: Mismatched file extension. The file claims to be a .pdf but its binary headers match a .png."
      );
    });

    it("should handle error during magic bytes reading", async () => {
      const { result } = renderHook(() => useSecureUpload());

      const file = new File(["dummy"], "error.pdf", { type: "application/pdf" });

      // Override file.slice to make FileReader readAsArrayBuffer fail
      const originalSlice = File.prototype.slice;
      File.prototype.slice = function(...args: [number?, number?, string?]) {
        const slicedBlob = originalSlice.apply(this, args);
        // Add a mock to fail the FileReader when reading this blob
        Object.defineProperty(slicedBlob, 'type', {
            get: () => { throw new Error('Simulated Read Error') }
        })
        return slicedBlob;
      };

      const originalFileReader = global.FileReader;

      // Mock FileReader to fail
      class MockFileReader {
          error = new Error("Read failed");
          onerror: (() => void) | null = null;
          readAsArrayBuffer() {
              if (this.onerror) {
                  setTimeout(this.onerror, 0);
              }
          }
      }
      global.FileReader = MockFileReader as unknown as typeof FileReader;

      let isValid;
      await act(async () => {
        isValid = await result.current.validateFile(file);
      });

      expect(isValid).toBe(false);
      expect(toast.error).toHaveBeenCalledWith("File integrity verification failed.");

      global.FileReader = originalFileReader;
      File.prototype.slice = originalSlice;
    });

    it("should skip magic bytes check if disabled", async () => {
        const { result } = renderHook(() => useSecureUpload());
        const file = createFileWithBytes(
          MAGIC_BYTES.INVALID, // Invalid magic bytes
          "document.pdf",
          "application/pdf"
        );

        let isValid;
        await act(async () => {
          isValid = await result.current.validateFile(file, { checkMagicBytes: false });
        });

        expect(isValid).toBe(true);
        expect(toast.error).not.toHaveBeenCalled();
    });
  });

  describe("isValidating state", () => {
    it("should toggle isValidating state during validation", async () => {
      const { result } = renderHook(() => useSecureUpload());

      const file = createFileWithBytes(
        MAGIC_BYTES.PDF,
        "document.pdf",
        "application/pdf"
      );

      expect(result.current.isValidating).toBe(false);

      let promise;

      act(() => {
          promise = result.current.validateFile(file);
      });

      // It might not be synchronously set depending on how state updates are batched,
      // but in this hook, it is synchronous.
      expect(result.current.isValidating).toBe(true);

      await act(async () => {
          await promise;
      });

      expect(result.current.isValidating).toBe(false);
    });
  });
});
