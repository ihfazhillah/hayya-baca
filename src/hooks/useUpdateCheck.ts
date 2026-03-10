import { useState, useEffect, useRef, useCallback } from 'react';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import type { UpdateInfo, DownloadState } from '../types/update';

const GITHUB_API_TAGS_URL = 'https://api.github.com/repos/ihfazhillah/hayya-baca/tags';
const GITHUB_DOWNLOAD_BASE = 'https://github.com/ihfazhillah/hayya-baca/releases/download';
const APK_NAME_PREFIX = 'hayya-baca';
// Matches: v1.0.0, v0.1.0-alpha.1, v2.0.0-beta.3, etc.
const VERSION_PATTERN = /^v(\d+\.\d+\.\d+(?:-[\w.]+)?)$/;

/**
 * Parse version string into comparable parts.
 * "1.2.3-alpha.1" → { major:1, minor:2, patch:3, pre:"alpha", preNum:1 }
 * "1.2.3" → { major:1, minor:2, patch:3, pre:null, preNum:0 }
 */
function parseVersion(v: string) {
  const [core, ...preParts] = v.split('-');
  const [major, minor, patch] = core.split('.').map(Number);
  const preStr = preParts.join('-') || null;

  // Extract pre-release label and number: "alpha.1" → ["alpha", 1]
  let preLabel: string | null = null;
  let preNum = 0;
  if (preStr) {
    const match = preStr.match(/^(\w+)(?:\.(\d+))?$/);
    if (match) {
      preLabel = match[1];
      preNum = match[2] ? parseInt(match[2]) : 0;
    }
  }

  return { major, minor, patch, preLabel, preNum };
}

// Pre-release ordering: alpha < beta < rc < (stable)
const PRE_ORDER: Record<string, number> = { alpha: 0, beta: 1, rc: 2 };

function isNewerVersion(remote: string, local: string): boolean {
  const r = parseVersion(remote);
  const l = parseVersion(local);

  // Compare major.minor.patch
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (r[key] > l[key]) return true;
    if (r[key] < l[key]) return false;
  }

  // Same core version - compare pre-release
  // Stable (no pre) > any pre-release
  if (!r.preLabel && l.preLabel) return true;
  if (r.preLabel && !l.preLabel) return false;
  if (!r.preLabel && !l.preLabel) return false;

  // Both have pre-release: compare label then number
  const rOrder = PRE_ORDER[r.preLabel!] ?? 99;
  const lOrder = PRE_ORDER[l.preLabel!] ?? 99;
  if (rOrder > lOrder) return true;
  if (rOrder < lOrder) return false;

  return r.preNum > l.preNum;
}

function findLatestVersion(versions: string[]): string | null {
  if (versions.length === 0) return null;
  return versions.reduce((latest, v) => (isNewerVersion(v, latest) ? v : latest));
}

export function useUpdateCheck() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloadState, setDownloadState] = useState<DownloadState>({
    status: 'idle',
    progress: 0,
    error: null,
  });
  const [checking, setChecking] = useState(false);
  const downloadResumable = useRef<FileSystem.DownloadResumable | null>(null);
  const apkPath = useRef<string | null>(null);

  const checkForUpdate = useCallback(async (): Promise<UpdateInfo | null> => {
    setChecking(true);
    try {
      const response = await fetch(GITHUB_API_TAGS_URL);
      if (!response.ok) {
        setChecking(false);
        return null;
      }
      const tags: { name: string }[] = await response.json();

      const versions: string[] = [];
      for (const tag of tags) {
        const match = VERSION_PATTERN.exec(tag.name);
        if (match) versions.push(match[1]);
      }

      const latestVersion = findLatestVersion(versions);
      const currentVersion = Constants.expoConfig?.version ?? '0.0.0';

      if (latestVersion && isNewerVersion(latestVersion, currentVersion)) {
        const info: UpdateInfo = {
          latestVersion,
          currentVersion,
          isUpdateAvailable: true,
          downloadUrl: `${GITHUB_DOWNLOAD_BASE}/v${latestVersion}/${APK_NAME_PREFIX}-v${latestVersion}.apk`,
        };
        setUpdateInfo(info);
        setDownloadState({ status: 'available', progress: 0, error: null });
        setChecking(false);
        return info;
      }

      const info: UpdateInfo = {
        latestVersion: latestVersion ?? currentVersion,
        currentVersion,
        isUpdateAvailable: false,
        downloadUrl: null,
      };
      setUpdateInfo(info);
      setDownloadState({ status: 'idle', progress: 0, error: null });
      setChecking(false);
      return info;
    } catch {
      setChecking(false);
      return null;
    }
  }, []);

  const startDownload = useCallback(async () => {
    if (!updateInfo?.downloadUrl) return;

    const apkFilename = `${APK_NAME_PREFIX}-v${updateInfo.latestVersion}.apk`;
    const filePath = `${FileSystem.cacheDirectory}${apkFilename}`;
    apkPath.current = filePath;
    setDownloadState({ status: 'downloading', progress: 0, error: null });

    try {
      const resumable = FileSystem.createDownloadResumable(
        updateInfo.downloadUrl,
        filePath,
        {},
        (downloadProgress) => {
          const progress =
            downloadProgress.totalBytesExpectedToWrite > 0
              ? downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite
              : 0;
          setDownloadState((prev) => ({ ...prev, progress }));
        },
      );
      downloadResumable.current = resumable;

      const result = await resumable.downloadAsync();
      if (result?.uri) {
        setDownloadState({ status: 'ready', progress: 1, error: null });
      } else {
        setDownloadState({ status: 'error', progress: 0, error: 'Download gagal' });
      }
    } catch (err) {
      setDownloadState((prev) => {
        if (prev.status !== 'downloading') return prev;
        return {
          status: 'error',
          progress: 0,
          error: err instanceof Error ? err.message : 'Download gagal',
        };
      });
    } finally {
      downloadResumable.current = null;
    }
  }, [updateInfo]);

  const cancelDownload = useCallback(async () => {
    try {
      await downloadResumable.current?.pauseAsync();
    } catch {}
    downloadResumable.current = null;
    setDownloadState({ status: 'available', progress: 0, error: null });

    if (apkPath.current) {
      try {
        await FileSystem.deleteAsync(apkPath.current, { idempotent: true });
      } catch {}
    }
  }, []);

  const installUpdate = useCallback(async () => {
    if (!apkPath.current) return;

    try {
      const contentUri = await FileSystem.getContentUriAsync(apkPath.current);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        type: 'application/vnd.android.package-archive',
        flags: 1,
      });

      try {
        await FileSystem.deleteAsync(apkPath.current, { idempotent: true });
      } catch {}
    } catch {
      try {
        await IntentLauncher.startActivityAsync('android.settings.MANAGE_UNKNOWN_APP_SOURCES', {
          data: 'package:com.ihfazh.hayyabaca',
        });
      } catch {
        setDownloadState({
          status: 'error',
          progress: 0,
          error: 'Tidak bisa install. Aktifkan "Install unknown apps" di Settings.',
        });
      }
    }
  }, []);

  useEffect(() => {
    checkForUpdate();
  }, [checkForUpdate]);

  return {
    updateInfo,
    downloadState,
    checking,
    checkForUpdate,
    startDownload,
    cancelDownload,
    installUpdate,
  };
}
