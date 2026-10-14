/**
 * QRIS (Quick Response Code Indonesian Standard) Dynamic Generator & Validator
 * Standar EMVCo Merchant-Presented Mode Specification
 */

// CRC16-CCITT (polynomial 0x1021, nilai awal 0xFFFF)
export function calculateCrc16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export interface TLV {
  tag: string;
  length: number;
  value: string;
}

export function parseTLVs(payload: string): TLV[] {
  const tlvs: TLV[] = [];
  let index = 0;

  while (index < payload.length) {
    if (index + 4 > payload.length) break;
    const tag = payload.substring(index, index + 2);
    const lengthStr = payload.substring(index + 2, index + 4);
    const length = parseInt(lengthStr, 10);
    if (isNaN(length)) break;

    const valueStart = index + 4;
    const valueEnd = valueStart + length;
    if (valueEnd > payload.length) break;

    const value = payload.substring(valueStart, valueEnd);
    tlvs.push({ tag, length, value });
    index = valueEnd;
  }

  return tlvs;
}

/**
 * Validasi payload QRIS: diawali 000201 dan diakhiri tag 63 empat karakter CRC yang valid
 */
export function isValidQrisPayload(payload: string | undefined | null): boolean {
  if (!payload) return false;
  const trimmed = payload.trim();
  if (trimmed.length < 20) return false;
  if (!trimmed.startsWith('000201')) return false;

  const tag63Index = trimmed.lastIndexOf('6304');
  if (tag63Index === -1 || tag63Index + 8 !== trimmed.length) return false;

  const contentWithoutCrc = trimmed.substring(0, tag63Index + 4);
  const expectedCrc = trimmed.substring(tag63Index + 4).toUpperCase();
  const calculatedCrc = calculateCrc16(contentWithoutCrc);

  return expectedCrc === calculatedCrc;
}

/**
 * Membuat QRIS dinamis dari qrisPayload statis:
 * 1. Mengubah tag 01 dari '11' menjadi '12'
 * 2. Menghapus tag 54 lama bila ada
 * 3. Menyisipkan tag 54 berisi payableAmount tepat sebelum tag 58
 * 4. Menghitung ulang CRC16-CCITT dan menulis ulang tag 63
 */
export function generateDynamicQris(
  staticQris: string,
  payableAmount: number
): string {
  const cleanQris = staticQris.trim();
  if (!cleanQris.startsWith('000201')) {
    throw new Error('Payload QRIS tidak valid: Format harus diawali 000201.');
  }

  const tlvs = parseTLVs(cleanQris);
  if (tlvs.length === 0) {
    throw new Error('Format QRIS tidak dapat diurai.');
  }

  const roundedAmount = Math.max(1, Math.round(payableAmount));
  const amountStr = roundedAmount.toString();

  const newTlvs: TLV[] = [];
  let inserted54 = false;

  for (const tlv of tlvs) {
    // Abaikan tag CRC lama (tag 63)
    if (tlv.tag === '63') continue;

    // Hapus tag nominal lama bila ada
    if (tlv.tag === '54') continue;

    // Ubah tag 01 menjadi 12 (Dinamis)
    if (tlv.tag === '01') {
      newTlvs.push({
        tag: '01',
        length: 2,
        value: '12',
      });
      continue;
    }

    // Sisipkan tag 54 tepat sebelum tag 58
    if (tlv.tag === '58' && !inserted54) {
      newTlvs.push({
        tag: '54',
        length: amountStr.length,
        value: amountStr,
      });
      inserted54 = true;
    }

    newTlvs.push(tlv);
  }

  // Jika tag 58 tidak ada di payload, sisipkan tag 54 di akhir sebelum CRC
  if (!inserted54) {
    newTlvs.push({
      tag: '54',
      length: amountStr.length,
      value: amountStr,
    });
  }

  // Rekonstruksi string TLV
  let rawWithoutCrc = '';
  for (const tlv of newTlvs) {
    const lenStr = tlv.length.toString().padStart(2, '0');
    rawWithoutCrc += `${tlv.tag}${lenStr}${tlv.value}`;
  }

  // Tambahkan tag 6304 dan hitung CRC16-CCITT
  const dataForCrc = `${rawWithoutCrc}6304`;
  const checksum = calculateCrc16(dataForCrc);

  return `${dataForCrc}${checksum}`;
}
