import sharp from "sharp";

for (const [name, size] of [["icon", 96], ["icon1", 16], ["icon2", 32]]) {
  await sharp("src/app/logo.svg", { density: 1200 })
    .resize(size, size)
    .png()
    .toFile(`src/app/${name}.png`);
  console.log(`wrote src/app/${name}.png`);
}