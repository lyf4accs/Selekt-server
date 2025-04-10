// api/palettes.js
function simplifyHexToGroup(hex) {
  const [r, g, b] = hex.match(/\w\w/g).map((h) => parseInt(h, 16));
  const step = 96; // más pequeño = más grupos
  return `${Math.floor(r / step)}-${Math.floor(g / step)}-${Math.floor(
    b / step
  )}`;
}

module.exports = (req, res) => {
   res.setHeader("Access-Control-Allow-Origin", "*");
   res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
   res.setHeader("Access-Control-Allow-Headers", "Content-Type");

   if (req.method === "OPTIONS") return res.status(200).end();
   if (req.method !== "POST") {
     return res.status(405).json({ message: "Method Not Allowed" });
   }

  console.log("🟢 Entrando en /api/palettes");
  const { data } = req.body;

  if (!Array.isArray(data)) {
    return res.status(400).json({ error: "El formato debe ser un array." });
  }

  const groups = new Map();

  for (const item of data) {
    const simplifiedColor = simplifyHexToGroup(item.palette[0]); // usamos el primer color
    if (!groups.has(simplifiedColor)) groups.set(simplifiedColor, []);
    groups.get(simplifiedColor).push(item.url);
  }

  const albums = [];
  let id = 1;

  groups.forEach((photos, key) => {
    if (photos.length > 0) {
      albums.push({
        name: `Moodboard ${id++}`,
        colorKey: key,
        coverPhoto: photos[0],
        photos,
      });
    }
  });

  console.log("🧩 Álbumes generados:", albums.length);
  res.status(200).json({ albums });
};
