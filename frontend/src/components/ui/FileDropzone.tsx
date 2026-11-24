import { useCallback, useRef, type DragEvent } from 'react';

interface FileDropzoneProps {
  accept?: string;
  maxSizeMB?: number;
  onFile: (file: File) => void;
  error?: string;
  hint?: string;
  fileInfo?: string | null;
}

export function FileDropzone({
  accept = '.csv,.txt',
  maxSizeMB = 10,
  onFile,
  error,
  hint,
  fileInfo,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (!file) return;

      // Type check
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!['csv', 'txt'].includes(ext ?? '')) {
        return; // Caller should show error
      }

      // Size check
      if (file.size > maxSizeMB * 1024 * 1024) {
        return;
      }

      onFile(file);
    },
    [onFile, maxSizeMB]
  );

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
          transition-all duration-200 group
          ${
            error
              ? 'border-red-500/50 bg-red-500/5 hover:border-red-500/80'
              : fileInfo
              ? 'border-brand-accent/50 bg-brand-accent/5'
              : 'border-brand-border hover:border-brand-accent/50 hover:bg-brand-accent/5'
          }
        `}
        role="button"
        tabIndex={0}
        aria-label="Upload CSV or TXT file"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = ''; // Reset so same file can be re-uploaded
          }}
          aria-hidden="true"
        />

        <div className="flex flex-col items-center gap-3">
          {fileInfo ? (
            <>
              <div className="w-12 h-12 rounded-xl bg-brand-accent/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-brand-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-brand-accent">{fileInfo}</p>
              <p className="text-xs text-brand-text-muted">Click to upload a different file</p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-xl bg-brand-surface flex items-center justify-center group-hover:bg-brand-accent/10 transition-colors">
                <svg className="w-6 h-6 text-brand-text-muted group-hover:text-brand-accent transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-brand-text-secondary">
                  <span className="text-brand-accent font-medium">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-brand-text-muted mt-1">
                  {hint ?? `CSV or TXT, up to ${maxSizeMB}MB`}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
      {error && (
        <p className="mt-1.5 text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
