const { hammingDistance } = require("../utils");

const handler = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { hashes } = req.body;
  const SIMILAR_THRESHOLD = 6;

  const processedHashes = new Map();
  const duplicateGroups = new Map();
  const similarGroups = [];

  for (const { hash, url } of hashes) {
    const h = String(hash);
    console.log(`Recibido: ${url} con hash ${h}`);

    if (processedHashes.has(h)) {
      duplicateGroups.get(h).push(url);
      continue;
    }

    let minDistance = Infinity;
    let bestGroup = null;

    for (const group of similarGroups) {
      const distance = hammingDistance(h, group.hash);
      console.log(`Comparando con grupo ${group.hash}, distancia: ${distance}`);
      if (distance < minDistance) {
        minDistance = distance;
        bestGroup = group;
      }
    }

    if (minDistance <= SIMILAR_THRESHOLD) {
      bestGroup.images.push(url);
    } else {
      similarGroups.push({ hash: h, images: [url] });
    }

    processedHashes.set(h, [url]);
    if (!duplicateGroups.has(h)) {
      duplicateGroups.set(h, [url]);
    }
  }

  const albums = [];
  let albumId = 1;

  duplicateGroups.forEach((images) => {
    if (images.length > 1) {
      albums.push({
        name: `Álbum de Duplicados ${albumId++}`,
        coverPhoto: images[0],
        photos: images,
      });
    }
  });

  similarGroups.forEach((group) => {
    if (group.images.length > 1) {
      albums.push({
        name: `Álbum de Similares ${albumId++}`,
        coverPhoto: group.images[0],
        photos: group.images,
      });
    }
  });

  console.log("Álbumes generados:", JSON.stringify(albums, null, 2));
  res.status(200).json({ albums });
};

module.exports = handler;
