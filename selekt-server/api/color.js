const getColors = require("get-image-colors");
const fetch = require("node-fetch");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method Not Allowed" });

  const { urls } = req.body;
  if (!Array.isArray(urls))
    return res.status(400).json({ error: "Debe enviar un array de 'urls'" });

  async function fetchAndAnalyzeColor(url) {
    try {
      const response = await fetch(url);
      const buffer = await response.buffer();
      const colors = await getColors(buffer, "image/jpeg");
      const rgb = colors[0].rgb();
      return { url, rgb };
    } catch (error) {
      console.error(`Error procesando ${url}`, error);
      return null;
    }
  }

  const results = await Promise.all(urls.map(fetchAndAnalyzeColor));
  res.status(200).json({ colors: results.filter(Boolean) });
};
