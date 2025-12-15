/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import * as React from "react";
import { Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSize?: number; // in MB
  disabled?: boolean;
  className?: string;
}

export function FileUpload({
  onFileSelect,
  accept = ".txt,.md",
  maxSize = 10,
  disabled = false,
  className,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const file = files[0];
      validateAndSelectFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      validateAndSelectFile(files[0]);
    }
  };

  const validateAndSelectFile = (file: File) => {
    // Check file size
    const maxSizeBytes = maxSize * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      alert(`File size exceeds ${maxSize}MB limit`);
      return;
    }

    // Check file extension
    const acceptedExtensions = accept.split(",").map((ext) => ext.trim());
    const fileExt = file.name.split(".").pop()?.toLowerCase();

    // If file has no extension, reject it
    if (!fileExt) {
      alert(`File must have a valid extension. Only ${accept} files are supported`);
      return;
    }

    const fileExtension = "." + fileExt;

    if (!acceptedExtensions.includes(fileExtension)) {
      alert(`Only ${accept} files are supported`);
      return;
    }

    onFileSelect(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      className={cn(
        "relative rounded-lg border-2 border-dashed transition-colors",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-muted-foreground/50",
        disabled && "opacity-50 cursor-not-allowed",
        !disabled && "cursor-pointer",
        className
      )}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={!disabled ? handleClick : undefined}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        disabled={disabled}
        className="hidden"
      />

      <div className="flex flex-col items-center justify-center p-8 text-center">
        <Upload
          className={cn(
            "h-10 w-10 mb-4",
            isDragging ? "text-primary" : "text-muted-foreground"
          )}
        />
        <p className="text-sm font-medium mb-1">
          {isDragging ? "Drop file here" : "Drop file here or click to browse"}
        </p>
        <p className="text-xs text-muted-foreground">
          {accept.toUpperCase()} files up to {maxSize}MB
        </p>
      </div>
    </div>
  );
}
