/**
 * Genera los iconos PWA a partir del SVG del isotipo.
 *
 * Iconos producidos en /public/icons/:
 *  - icon-192.png      → manifest "any" 192x192
 *  - icon-512.png      → manifest "any" 512x512
 *  - icon-maskable-192.png → manifest "maskable" 192x192 (con safe area 20%)
 *  - icon-maskable-512.png → manifest "maskable" 512x512 (con safe area 20%)
 *  - apple-touch-icon.png  → iOS / Android home 180x180
 *  - favicon-32.png    → favicon 32x32
 *  - favicon-16.png    → favicon 16x16
 *
 * Para iconos "maskable" Android recorta los bordes; el isotipo se renderiza
 * dentro del 60% central con padding navy alrededor para que nunca se corte.
 *
 * Re-ejecutar: `npx tsx scripts/generate-pwa-icons.ts`
 */
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
const SRC_SVG = join(ROOT, 'public/brand/logo-icon-color.svg');
const OUT_DIR = join(ROOT, 'public/icons');

mkdirSync(OUT_DIR, { recursive: true });

const svgBuffer = readFileSync(SRC_SVG);

// El isotipo es coral (#FF6B4A) sobre fondo transparente.
// Para iconos PWA usamos fondo navy deep (#1B2438) que combina con el
// theme_color del manifest, asegurando un splash screen continuo.
const NAVY_DEEP = { r: 0x1B, g: 0x24, b: 0x38, alpha: 1 };

async function renderIcon(size: number, filename: string, maskable = false) {
    // Para "any" el isotipo ocupa ~70% del lienzo centrado.
    // Para "maskable" Android puede recortar 10% por borde → contenido al 60% central.
    const innerRatio = maskable ? 0.6 : 0.7;
    const innerSize = Math.round(size * innerRatio);

    const inner = await sharp(svgBuffer, { density: 600 })
        .resize(innerSize, innerSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();

    const offset = Math.round((size - innerSize) / 2);

    await sharp({
        create: {
            width: size,
            height: size,
            channels: 4,
            background: NAVY_DEEP,
        },
    })
        .composite([{ input: inner, top: offset, left: offset }])
        .png()
        .toFile(join(OUT_DIR, filename));

    console.log(`✓ ${filename} (${size}x${size}${maskable ? ' maskable' : ''})`);
}

async function renderFavicon(size: number, filename: string) {
    // Favicon: isotipo sobre fondo transparente para que se adapte a barras claras/oscuras.
    await sharp(svgBuffer, { density: 600 })
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toFile(join(OUT_DIR, filename));
    console.log(`✓ ${filename} (${size}x${size} transparent)`);
}

async function main() {
    await renderIcon(192, 'icon-192.png');
    await renderIcon(512, 'icon-512.png');
    await renderIcon(192, 'icon-maskable-192.png', true);
    await renderIcon(512, 'icon-maskable-512.png', true);
    await renderIcon(180, 'apple-touch-icon.png');
    await renderFavicon(32, 'favicon-32.png');
    await renderFavicon(16, 'favicon-16.png');
    console.log('\nIconos PWA generados en /public/icons/');
}

main().catch((err) => {
    console.error('Error generando iconos:', err);
    process.exit(1);
});
