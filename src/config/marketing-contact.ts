/**
 * Constantes de contacto del marketing público de KPSULA.
 *
 * Si cambia el número de teléfono o el email, se cambia acá una sola
 * vez y se aplica en todas las pantallas (contacto, navbar, hero, etc.).
 */

/** Número WhatsApp de ventas (Gustavo) — formato internacional sin "+", espacios ni guiones. */
export const WHATSAPP_SALES_NUMBER = '584125556315';

/** Versión humana para mostrar en pantalla. */
export const WHATSAPP_SALES_DISPLAY = '+58 412 555-6315';

/** Link directo a WhatsApp Web/App con ese número. */
export const WHATSAPP_SALES_LINK = `https://wa.me/${WHATSAPP_SALES_NUMBER}`;

/** Mensaje pre-cargado cuando el visitante hace click en "Solicitar demo". */
const DEMO_MESSAGE = 'Hola, me interesa solicitar una demo de KPSULA para mi restaurante.';

/** Link a WhatsApp con el mensaje "Solicitar demo" pre-cargado. */
export const WHATSAPP_DEMO_LINK = `${WHATSAPP_SALES_LINK}?text=${encodeURIComponent(DEMO_MESSAGE)}`;
