import React from 'react';
import { AlertCircle, RefreshCw, KeyRound, ShieldAlert, WifiOff } from 'lucide-react';
import { Button } from './Button';

export interface FirebaseNoticeCardProps {
  title?: string;
  error: unknown | Error | { code?: string; message?: string } | null;
  onRetry?: () => void;
  className?: string;
}

export const FirebaseNoticeCard: React.FC<FirebaseNoticeCardProps> = ({
  title = 'Kendala Koneksi Firebase Firestore',
  error,
  onRetry,
  className = '',
}) => {
  if (!error) return null;

  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
      ? String((error as any).message)
      : String(error);

  const errorCode =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as any).code)
      : rawMessage.match(/\(([a-zA-Z0-9_\-\/]+)\)/)?.[1] ||
        (rawMessage.includes('permission-denied')
          ? 'permission-denied'
          : rawMessage.includes('unavailable')
          ? 'unavailable'
          : rawMessage.includes('operation-not-allowed')
          ? 'auth/operation-not-allowed'
          : rawMessage.includes('not-found')
          ? 'not-found'
          : 'firebase-error');

  // Friendly Indonesian guide based on error code
  let guideText =
    'Terjadi kesalahan saat berkomunikasi dengan server Cloud Firestore.';
  let icon = <AlertCircle className="w-6 h-6 text-red-500 shrink-0" />;

  if (
    errorCode.includes('operation-not-allowed') ||
    rawMessage.includes('operation-not-allowed')
  ) {
    guideText =
      'Penyedia login Anonim belum diaktifkan. Buka Firebase Console > Build > Authentication > tab "Sign-in method", lalu Aktifkan penyedia "Anonymous".';
    icon = <KeyRound className="w-6 h-6 text-amber-500 shrink-0" />;
  } else if (
    errorCode.includes('permission-denied') ||
    rawMessage.includes('permission-denied') ||
    rawMessage.includes('Missing or insufficient permissions')
  ) {
    guideText =
      'Izin baca/tulis ditolak oleh Firestore Security Rules. Pastikan rules pada database "ai-studio-60a554e0-4898-421c-8fb4-b68f3c12bd34" sudah di-deploy dan mengizinkan akses.';
    icon = <ShieldAlert className="w-6 h-6 text-red-500 shrink-0" />;
  } else if (
    errorCode.includes('unavailable') ||
    rawMessage.includes('unavailable') ||
    rawMessage.includes('offline')
  ) {
    guideText =
      'Layanan Firestore tidak dapat dihubungi atau perangkat sedang offline. Periksa koneksi internet Anda.';
    icon = <WifiOff className="w-6 h-6 text-amber-500 shrink-0" />;
  } else if (errorCode.includes('not-found') || rawMessage.includes('not-found')) {
    guideText =
      'Dokumen atau database yang dicari tidak ditemukan di Firestore.';
  }

  return (
    <div
      className={`p-5 rounded-2xl bg-red-50/90 dark:bg-red-950/40 border-2 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200 shadow-md ${className}`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-red-100 dark:bg-red-900/60 mt-0.5">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h4 className="text-sm font-bold text-red-800 dark:text-red-300">
              {title}
            </h4>
            <span className="px-2 py-0.5 rounded-md font-mono text-[11px] font-bold bg-red-200 dark:bg-red-900 text-red-900 dark:text-red-100 border border-red-300 dark:border-red-700">
              {errorCode}
            </span>
          </div>

          <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed font-medium">
            {guideText}
          </p>

          <div className="mt-2.5 p-2 rounded-lg bg-red-100/70 dark:bg-stone-900/80 font-mono text-[11px] text-red-900 dark:text-red-400 break-words border border-red-200 dark:border-red-900">
            {rawMessage}
          </div>

          {onRetry && (
            <div className="mt-3.5 flex justify-end">
              <Button
                variant="danger"
                size="sm"
                onClick={onRetry}
                icon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Coba Lagi
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const FirebaseErrorCard = FirebaseNoticeCard;
