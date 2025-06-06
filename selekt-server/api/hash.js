const Jimp = require("jimp");

const handler = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method Not Allowed" });

  const { url } = req.body;

  try {
    const image = await Jimp.read(url);
    await image.resize(24, 24);

    const hashRaw = image.hash();
    const hash = String(hashRaw); // aseguramos string
    console.log(`Hash generado para ${url}: ${hash}`);

    res.status(200).json({ hash, url });
  } catch (err) {
    console.error("Error procesando imagen:", err);
    res.status(500).json({ error: "Error procesando imagen" });
  }
};

module.exports = handler;
