// Helpers for working with Google Drive share links.
// Documents now store a Google Drive link instead of an uploaded file.

export const DRIVE_LINK_HELPER_TEXT =
  "Paste a Google Drive share link. Make sure the file is shared with the right person or set to anyone with the link.";

// Extract the Drive file id from common share link formats.
const extractFileId = (url: string): string | null => {
  if (!url) return null;
  // https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  const fileMatch = url.match(/\/file\/d\/([^/]+)/);
  if (fileMatch) return fileMatch[1];
  // https://drive.google.com/open?id=FILE_ID  OR  ...?id=FILE_ID
  const idMatch = url.match(/[?&]id=([^&]+)/);
  if (idMatch) return idMatch[1];
  // Google Docs/Sheets/Slides: /document/d/ID, /spreadsheets/d/ID, /presentation/d/ID
  const docMatch = url.match(/\/(?:document|spreadsheets|presentation)\/d\/([^/]+)/);
  if (docMatch) return docMatch[1];
  return null;
};

// Basic validation that the pasted value is a Google Drive / Docs link.
export const isValidDriveLink = (url: string): boolean => {
  if (!url) return false;
  const trimmed = url.trim();
  return (
    /^https?:\/\//i.test(trimmed) &&
    (/drive\.google\.com/i.test(trimmed) || /docs\.google\.com/i.test(trimmed))
  );
};

// URL that opens the Drive item directly (in a new tab).
export const getDriveOpenUrl = (url: string): string => url?.trim() || "";

// URL suitable for embedding an inline preview (iframe).
export const getDrivePreviewUrl = (url: string): string => {
  const trimmed = url?.trim() || "";
  if (!trimmed) return "";

  const fileId = extractFileId(trimmed);

  // Google Docs/Sheets/Slides preview
  if (/docs\.google\.com/i.test(trimmed)) {
    if (/\/(document|spreadsheets|presentation)\/d\//.test(trimmed)) {
      return trimmed.replace(/\/(edit|view)(\?[^#]*)?(#.*)?$/i, "/preview").replace(/\/$/, "");
    }
    return trimmed;
  }

  // Standard Drive file → use the /preview endpoint
  if (fileId) {
    return `https://drive.google.com/file/d/${fileId}/preview`;
  }

  return trimmed;
};