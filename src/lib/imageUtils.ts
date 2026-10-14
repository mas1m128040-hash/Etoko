/**
 * Utilitas kompresi gambar di browser menggunakan Canvas API.
 * - Lebar maksimal 480 piksel (proporsional)
 * - Format JPEG kualitas ~0.7, target di bawah 80 KB
 * - Menolak gambar yang setelah kompresi masih di atas 150 KB
 */
export async function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Berkas harus berupa gambar (JPEG, PNG, WebP, dll).'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca berkas gambar dari perangkat.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format gambar tidak dapat dibuka oleh browser.'));
      img.onload = () => {
        try {
          const maxWidth = 480;
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Browser tidak mendukung Canvas 2D.'));
            return;
          }

          // Latar belakang putih untuk menangani transparansi PNG
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          // Kompresi awal kualitas 0.7
          let quality = 0.7;
          let dataUrl = canvas.toDataURL('image/jpeg', quality);

          // Hitung perkiraan ukuran byte dari data URL Base64
          const calculateBytes = (d: string) => {
            const base64Part = d.split(',')[1] || '';
            return Math.round((base64Part.length * 3) / 4);
          };

          let bytes = calculateBytes(dataUrl);

          // Jika masih > 90 KB, coba kurangi kualitas ke 0.55 agar mendekati target < 80 KB
          if (bytes > 90 * 1024) {
            quality = 0.55;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
            bytes = calculateBytes(dataUrl);
          }

          // Tolak bila masih di atas batas keras 150 KB
          if (bytes > 150 * 1024) {
            reject(
              new Error(
                `Ukuran gambar setelah dikompres (${Math.round(
                  bytes / 1024
                )} KB) masih di atas batas 150 KB. Silakan pilih foto dengan resolusi lebih kecil.`
              )
            );
            return;
          }

          resolve(dataUrl);
        } catch (err: any) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}
