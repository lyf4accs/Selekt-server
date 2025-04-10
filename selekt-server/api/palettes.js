module.exports = function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method Not Allowed" });

  const { colors } = req.body;
  if (!Array.isArray(colors))
    return res.status(400).json({ error: "Debe enviar un array de 'colors'" });

  const COLOR_THRESHOLD = 50;
  const groups = [];

  const colorDistance = (a, b) =>
    Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);

  for (const { url, rgb } of colors) {
    let added = false;

    for (const group of groups) {
      if (colorDistance(rgb, group.representative) < COLOR_THRESHOLD) {
        group.photos.push(url);
        added = true;
        break;
      }
    }

    if (!added) {
      groups.push({ representative: rgb, photos: [url] });
    }
  }

  const albums = groups.map((g, i) => ({
    name: `Moodboard ${i + 1}`,
    coverPhoto: g.photos[0],
    photos: g.photos,
  }));

  res.status(200).json({ albums });
};
