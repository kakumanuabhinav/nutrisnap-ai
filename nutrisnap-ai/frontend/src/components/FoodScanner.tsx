import { useRef, useState, type DragEvent } from "react";

interface UploadAreaProps {
  onFileSelected: (file: File) => void;
}

export function UploadArea({ onFileSelected }: UploadAreaProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    onFileSelected(file);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`card border-dashed border-2 flex flex-col items-center justify-center gap-4 py-14 px-6 text-center transition ${
        isDragging ? "border-cyan-accent bg-cyan-accent/5" : "border-white/10"
      }`}
    >
      <div className="text-5xl">📷</div>
      <div>
        <div className="font-medium">Upload or capture a food photo</div>
        <div className="text-sm text-white/40 mt-1">Drag and drop, or choose an option below</div>
      </div>
      <div className="flex flex-wrap gap-3 justify-center">
        <button className="btn-primary" onClick={() => cameraInputRef.current?.click()}>
          Take Photo
        </button>
        <button className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
          Upload Image
        </button>
      </div>

      {/* Rear-camera capture on supported mobile browsers; falls back to a
          normal file picker automatically where capture isn't supported. */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}

const SCAN_STAGES = ["Uploading image", "Analyzing food", "Calculating nutrition", "Preparing results"];

export function ScanLoader({ stage }: { stage: number }) {
  return (
    <div className="card flex flex-col items-center gap-6 py-14">
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 rounded-full border-2 border-cyan-accent/20" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-accent animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center text-2xl">🥗</div>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-xs">
        {SCAN_STAGES.map((label, i) => (
          <div key={label} className="flex items-center gap-3 text-sm">
            <span
              className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 ${
                i < stage
                  ? "bg-cyan-accent text-black"
                  : i === stage
                    ? "border-2 border-cyan-accent animate-pulse"
                    : "border border-white/15"
              }`}
            >
              {i < stage ? "✓" : ""}
            </span>
            <span className={i <= stage ? "text-white" : "text-white/30"}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
