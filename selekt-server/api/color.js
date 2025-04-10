// api/color.js
const axios = require("axios");
const ColorThief = require("colorthief");
const Vibrant = require("node-vibrant");

async function getImagePaletteData(imageUrl) {
  try {
    console.log("🔍 Procesando:", imageUrl);

    const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
    const originalBuffer = Buffer.from(response.data, "binary");

    // ⬇️ Reducción de tamaño con Jimp (con fallback)
    let reducedBuffer = originalBuffer;
    try {
      const jimpImg = await Jimp.read(originalBuffer);
      jimpImg.resize(24, Jimp.AUTO); // Ajusta si quieres más rapidez o calidad
      reducedBuffer = await jimpImg.getBufferAsync(Jimp.MIME_JPEG);
    } catch (resizeErr) {
      console.warn("⚠️ No se pudo redimensionar con Jimp:", resizeErr.message);
    }

    // ⬇️ Análisis con ColorThief
    let palette = [];
    try {
      palette = await ColorThief.getPalette(reducedBuffer, 5);
    } catch (colorErr) {
      console.warn("⚠️ ColorThief falló:", colorErr.message);
    }

    // ⬇️ Análisis con Vibrant
    let tone = "neutral";
    try {
      const vibrant = await Vibrant.from(reducedBuffer).getPalette();
      const mainTone = Object.keys(vibrant)
        .filter((k) => vibrant[k])
        .sort((a, b) => vibrant[b].population - vibrant[a].population)[0];
      tone = mainTone?.toLowerCase() || "neutral";
    } catch (vibErr) {
      console.warn("⚠️ Vibrant falló:", vibErr.message);
    }

    if (palette.length === 0) {
      console.warn("❌ No se generó paleta para:", imageUrl);
      return null;
    }

    const hexPalette = palette.map(([r, g, b]) => {
      return `#${[r, g, b]
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("")}`;
    });

    return {
      url: imageUrl,
      palette: hexPalette,
      tone,
    };
  } catch (err) {
    console.error("❌ Error total en getImagePaletteData:", err.message);
    return null;
  }
}


module.exports = async (req, res) => {
   res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { urls } = req.body;
  const results = [];

  console.log("🟡 Entrando en /api/color");
  console.log("→ Analizando paletas para:", urls.length, "imágenes");

  for (const url of urls) {
    const data = await getImagePaletteData(url);
    if (data) results.push(data);
  }

  console.log("Paletas generadas:", results.length);
  res.status(200).json({ results });
};
