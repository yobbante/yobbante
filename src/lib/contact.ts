// Central contact info for Yobbanté
export const YOBBANTE_WHATSAPP = '221770000000'; // E.164 without + for wa.me
export const YOBBANTE_WHATSAPP_DISPLAY = '+221 77 000 00 00';

export function whatsappLink(message: string): string {
  return `https://wa.me/${YOBBANTE_WHATSAPP}?text=${encodeURIComponent(message)}`;
}
