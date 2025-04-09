// index.js (versión local consolidada)
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const Jimp = require("jimp");
const path = require("path");
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const SIMILAR_THRESHOLD = 6;
const IS_LOCAL = true;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

app.use(cors());
app.use(bodyParser.json({ limit: "500mb" }));

let processedHashes = new Map();
let duplicateGroups = new Map();
let similarGroups = [];

function hammingDistance(hash1, hash2) {
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) distance++;
  }
  return distance;
}

app.post("/api/upload", async (req, res) => {
  const images = req.body.images;
  const urls = [];

  for (let i = 0; i < images.length; i++) {
    const base64 = images[i].split(",")[1];
    const buffer = Buffer.from(base64, "base64");
    const fileName = `image_${Date.now()}_${i + 1}.jpg`;

    const { error } = await supabase.storage
      .from("images")
      .upload(fileName, buffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (error) {
      console.error("Error al subir:", error);
      continue;
    }

    const { data: publicUrlData } = supabase.storage
      .from("images")
      .getPublicUrl(fileName);
    urls.push(publicUrlData.publicUrl);
  }

  res.status(200).json({ urls });
});

app.post("/api/hash", async (req, res) => {
  const { url } = req.body;
  try {
    const image = await Jimp.read(url);
    await image.resize(24, 24);
    const hash = String(image.hash());
    console.log(`Hash generado para ${url}: ${hash}`);
    res.status(200).json({ hash, url });
  } catch (err) {
    console.error("Error procesando imagen:", err);
    res.status(500).json({ error: "Error procesando imagen" });
  }
});

app.post("/api/compare", (req, res) => {
  const { hashes } = req.body;
  processedHashes.clear();
  duplicateGroups.clear();
  similarGroups = [];

  for (const { hash, url } of hashes) {
    console.log(`Recibido: ${url} con hash ${hash}`);
    if (processedHashes.has(hash)) {
      duplicateGroups.get(hash).push(url);
      continue;
    }

    let minDistance = Infinity;
    let bestGroup = null;

    for (const group of similarGroups) {
      const distance = hammingDistance(hash, group.hash);
      console.log(`Comparando con grupo ${group.hash}, distancia: ${distance}`);
      if (distance < minDistance) {
        minDistance = distance;
        bestGroup = group;
      }
    }

    if (minDistance <= SIMILAR_THRESHOLD) {
      bestGroup.images.push(url);
    } else {
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

  console.log("Álbumes generados:", JSON.stringify(albums, null, 2));
  res.status(200).json({ albums });
});

app.listen(PORT, () =>
  console.log(`Servidor corriendo en http://localhost:${PORT}`)
);
