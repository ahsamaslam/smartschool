import { useRef, useState } from "react";
import toast from "react-hot-toast";
import Modal from "./Modal";
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  DocumentArrowDownIcon,
} from "@heroicons/react/24/outline";

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export default function BulkImportModal({
  isOpen,
  onClose,
  title,
  templateFileName,
  onDownloadTemplate,
  onUpload,
  guidance = [],
  onSuccess,
}) {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const resetState = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDownloadTemplate = async () => {
    setDownloading(true);
    try {
      const res = await onDownloadTemplate();
      downloadBlob(res.data, templateFileName || "import_template.xlsx");
      toast.success("Template downloaded");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to download template");
    } finally {
      setDownloading(false);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a file first");
      return;
    }

    setUploading(true);
    try {
      const res = await onUpload(file);
      const successCount = res?.data?.success_count || 0;
      const errorCount = res?.data?.error_count || 0;
      toast.success(`${successCount} record(s) imported successfully`);
      if (errorCount > 0) {
        const topErrors = (res?.data?.errors || []).slice(0, 5).join("\n");
        toast.error(`${errorCount} failed\n${topErrors}`);
      }
      resetState();
      onClose();
      onSuccess?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          <p className="font-semibold">Upload guide</p>
          <ul className="mt-2 list-disc list-inside space-y-1 text-xs">
            {guidance.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={handleDownloadTemplate}
          disabled={downloading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <ArrowDownTrayIcon className="h-4 w-4" />
          {downloading ? "Downloading..." : "Download Template"}
        </button>

        <div className="rounded-lg border-2 border-dashed border-gray-300 p-5 text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (selected) {
                setFile(selected);
              }
            }}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
          >
            <DocumentArrowDownIcon className="h-4 w-4" />
            {file ? "Change File" : "Select Upload File"}
          </button>
          {file && <p className="mt-2 text-xs text-gray-600">{file.name}</p>}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              resetState();
              onClose();
            }}
            className="flex-1 rounded-lg bg-gray-100 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading || !file}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            <ArrowUpTrayIcon className="h-4 w-4" />
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
