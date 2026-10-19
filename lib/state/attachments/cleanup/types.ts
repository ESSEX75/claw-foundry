/** Defines retention cleanup evidence independently of attachment storage. */

/** Evidence returned before attachment retention cleanup is audited. */
export type AttachmentPurgeManifestEntry = {
  /** Removed file basename. */
  filename: string;
  /** Removed file size. */
  size: number;
  /** SHA-256 digest of removed bytes. */
  sha256: string;
};

/** Audit checkpoint invoked before any attachment bytes are removed. */
export type AttachmentPurgeCheckpoint = (manifest: readonly AttachmentPurgeManifestEntry[]) => Promise<void>;
