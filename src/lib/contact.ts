// Central contact info for Yobbanté
export const YOBBANTE_WHATSAPP = '221786078080'; // E.164 without + for wa.me
export const YOBBANTE_WHATSAPP_DISPLAY = '+221 78 607 80 80';

export function whatsappLink(message: string): string {
  return `https://wa.me/${YOBBANTE_WHATSAPP}?text=${encodeURIComponent(message)}`;
}
