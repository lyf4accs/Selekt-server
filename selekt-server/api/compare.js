const { hammingDistance } = require("../utils");

const handler = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method Not Allowed" });

  const { hashes } = req.body;

  const SIMILAR_THRESHOLD = 6;
  const processedHashes = new Map();
  const duplicateGroups = new Map();
  const similarGroups = [];

  for (const { hash, url } of hashes) {
    if (processedHashes.has(hash)) {
      duplicateGroups.get(hash).push(url);
      continue;
    }

    let addedToGroup = false;
    for (const group of similarGroups) {
      const distance = hammingDistance(hash, group.hash);
      if (distance <= SIMILAR_THRESHOLD) {
        group.images.push(url);
        addedToGroup = true;
        break;
      }
    }

    if (!addedToGroup) {
      similarGroups.push({ hash, images: [url] });
    }

    processedHashes.set(hash, [url]);
    if (!duplicateGroups.has(hash)) {
      duplicateGroups.set(hash, [url]);
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

  res.status(200).json({ albums });
};

module.exports = { default: handler };
