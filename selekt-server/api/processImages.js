// /api/processImages.js
const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const Jimp = require("jimp");

const app = express();
app.use(bodyParser.json({ limit: "100mb" }));

const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

let processedHashes = new Map();
let duplicateGroups = new Map();
let similarGroups = [];
const SIMILAR_THRESHOLD = 6;

function hammingDistance(hash1, hash2) {
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) distance++;
  }
  return distance;
}

async function processImage(imagePath) {
  try {
    const image = await Jimp.read(imagePath);
    const hash = image.hash();

    if (processedHashes.has(hash)) {
      duplicateGroups.get(hash).push(imagePath);
      return;
    }

    let addedToGroup = false;
    for (let group of similarGroups) {
      const distance = hammingDistance(hash, group.hash);
      if (distance <= SIMILAR_THRESHOLD) {
        group.images.push(imagePath);
        addedToGroup = true;
        break;
      }
    }

    if (!addedToGroup) {
      similarGroups.push({ hash, images: [imagePath] });
    }

    processedHashes.set(hash, [imagePath]);
  } catch (error) {
    console.error("Error procesando imagen:", error);
  }
}

// Ruta del API
export default async function handler(req, res) {
  if (req.method === "POST") {
    const images = req.body.images;
    const imagePaths = [];

    for (let i = 0; i < images.length; i++) {
      let imageData = images[i].startsWith("data:image")
        ? images[i].split(",")[1]
        : images[i];
      const imageBuffer = Buffer.from(imageData, "base64");
      const imagePath = path.join(UPLOAD_DIR, `image_${i + 1}.jpg`);
      fs.writeFileSync(imagePath, imageBuffer);
      imagePaths.push(imagePath);
      await processImage(imagePath);
    }

    const albums = [];
    let albumId = 1;

    duplicateGroups.forEach((images) => {
      if (images.length > 1) {
        albums.push({
          name: `Álbum de Duplicados ${albumId++}`,
          photos: images.map((img) => `/uploads/${path.basename(img)}`),
        });
      }
    });

    similarGroups.forEach((group) => {
      if (group.images.length > 1) {
        albums.push({
          name: `Álbum de Similares ${albumId++}`,
          photos: group.images.map((img) => `/uploads/${path.basename(img)}`),
        });
      }
    });

    res.json({ albums });
  } else {
    res.status(405).json({ error: "Método no permitido" });
  }
}
