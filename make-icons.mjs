import sharp from "sharp";

const src = process.argv[2];
if (!src) {
  console.error("Usage: node make-icons.mjs <path-to-logo>");
  process.exit(1);
}

for (const size of [192, 512]) {
  await sharp(src, { density: 600 })
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(`public/icon-${size}.png`);
  console.log(`wrote public/icon-${size}.png`);
}