// Central contact info for Yobbanté
// CLIENTS — ligne 607 (assistance, devis, support)
export const YOBBANTE_WHATSAPP = '221786078080'; // E.164 without + for wa.me
export const YOBBANTE_WHATSAPP_DISPLAY = '+221 78 607 80 80';
export const YOBBANTE_PHONE_DISPLAY = '+221 78 607 80 80';

// TRANSPORTEURS / GP — ligne 122 (recrutement GP, support partenaires)
export const YOBBANTE_GP_WHATSAPP = '221781221891';
export const YOBBANTE_GP_WHATSAPP_DISPLAY = '+221 78 122 18 91';

export function whatsappLink(message: string): string {
  return `https://wa.me/${YOBBANTE_WHATSAPP}?text=${encodeURIComponent(message)}`;
}

export function gpWhatsappLink(message: string): string {
  return `https://wa.me/${YOBBANTE_GP_WHATSAPP}?text=${encodeURIComponent(message)}`;
}
