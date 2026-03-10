export interface UpdateInfo {
  latestVersion: string;
  currentVersion: string;
  isUpdateAvailable: boolean;
  downloadUrl: string | null;
}

export type DownloadStatus = 'idle' | 'available' | 'downloading' | 'error' | 'ready';

export interface DownloadState {
  status: DownloadStatus;
  progress: number;
  error: string | null;
}
