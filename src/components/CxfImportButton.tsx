import { Upload } from "lucide-react";
import type { ChangeEvent } from "react";

type CxfImportButtonProps = {
  fileName: string | null;
  error: string | null;
  onFileUpload: (file: File | null) => void;
};

export default function CxfImportButton({ fileName, error, onFileUpload }: CxfImportButtonProps) {
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = "";
    if (file) {
      onFileUpload(file);
    }
  };

  return (
    <div className="cxf-import">
      {error && (
        <p className="cxf-import-error" role="alert">
          {error}
        </p>
      )}
      <label className="cxf-import-button" title={fileName ? `Loaded: ${fileName}. Click to import another CxF file.` : "Import a CxF file"}>
        <Upload aria-hidden="true" size={14} />
        <span>{fileName ?? "Import CxF"}</span>
        <input type="file" accept=".cxf,.xml,text/xml,application/xml" onChange={handleFileChange} />
      </label>
    </div>
  );
}
