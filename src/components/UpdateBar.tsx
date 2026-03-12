import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useUpdate } from '../context/UpdateContext';

export function UpdateBar() {
  const { updateInfo, downloadState, startDownload, cancelDownload, installUpdate } = useUpdate();

  useEffect(() => {
    if (downloadState.status === 'ready') {
      installUpdate();
    }
  }, [downloadState.status, installUpdate]);

  if (downloadState.status === 'idle') return null;

  const progressPercent = Math.round(downloadState.progress * 100);

  return (
    <View style={styles.container}>
      {downloadState.status === 'available' && (
        <Pressable style={styles.button} onPress={startDownload}>
          <Text style={styles.buttonText}>
            Update tersedia (v{updateInfo?.latestVersion})
          </Text>
        </Pressable>
      )}

      {downloadState.status === 'downloading' && (
        <View style={styles.button}>
          <View style={styles.progressRow}>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
            </View>
            <Text style={styles.progressText}>{progressPercent}%</Text>
            <Pressable onPress={cancelDownload} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Batal</Text>
            </Pressable>
          </View>
        </View>
      )}

      {downloadState.status === 'ready' && (
        <Pressable style={styles.button} onPress={installUpdate}>
          <Text style={styles.buttonText}>Menginstall...</Text>
        </Pressable>
      )}

      {downloadState.status === 'error' && (
        <Pressable style={[styles.button, styles.errorButton]} onPress={startDownload}>
          <Text style={styles.buttonText}>
            {downloadState.error ?? 'Download gagal'} — Ketuk untuk coba lagi
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 8,
  },
  button: {
    backgroundColor: '#6C5CE7',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  errorButton: {
    backgroundColor: '#E53935',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 12,
  },
  progressBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFF',
    borderRadius: 4,
  },
  progressText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'right',
  },
  cancelButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cancelText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.8,
  },
});
