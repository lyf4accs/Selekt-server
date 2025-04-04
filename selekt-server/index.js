

/**
 * Phash: Perceptual Hashing: Se basa en la estructura visual de la imagen en lugar de sus datos binarios. 
 * Funciona analizando los píxeles, aplicando transformaciones matemáticas y generando una firma que permanece similar incluso si la imagen cambia ligeramente.
 * * Convertir a escala de grises para reducir información innecesaria de color.
    Redimensionar la imagen a un tamaño fijo (por ejemplo, 32x32 píxeles) para hacerla manejable.
    Aplicar Transformada Discreta de Coseno (DCT) para extraer la información más importante de la imagen.
    Obtener los valores medios de las frecuencias bajas y compararlos con cada píxel para generar una secuencia binaria.
    Convertir el resultado en un hash de bits (por ejemplo, 64 bits).
      Este hash se puede comparar con otros mediante la distancia de Hamming para ver qué tan similares son las imágenes.
 * Hamming Distance (Distancia de Hamming): 
      Se cuenta cuántos bits son diferentes: Si dos imágenes son ideénticas la distancia es cero. Cuanto más grande sea la distancia, más diferentes son las imágenes
 */

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const Jimp = require("jimp");
const supabase = require("./supabaseClient");

const app = express();
// Permitir solicitudes de localhost y el dominio de tu frontend
const corsOptions = {
  origin: [
    "http://localhost:4200", // Si usas Angular en local
    "https://tu-frontend-en-netlify.netlify.app", // Tu frontend en producción
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept"],
};

app.use(cors(corsOptions)); 
app.options("/api/*", cors(corsOptions));  // Para manejar las solicitudes OPTIONS
app.use(bodyParser.json({ limit: "100mb" }));

const BASE_URL =
  process.env.BASE_URL ||
  "https://selekt-server-59ndg39ug-lyf4accs-projects.vercel.app";

app.get("/", (req, res) => {
  const htmlResponse = `
    <html>
        <head>
            <title>NodeJs y Express en Vercel</title>
        </head>
        <body>
            <h1>backend server</h1>
        </body>
    </html>
    `;
  res.send(htmlResponse);
});

// Server
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

async function uploadImageToSupabase(imageBuffer, imageName) {
  // Subir la imagen a Supabase Storage
  const { data, error } = await supabase.storage
    .from("images") // Asegúrate de que este sea tu bucket en Supabase
    .upload(imageName, imageBuffer, {
      cacheControl: "3600",
      upsert: true, // Reemplaza el archivo si ya existe
    });

  if (error) {
    console.error("Error subiendo la imagen:", error);
    throw new Error("Error subiendo la imagen");
  }

  // Obtener la URL pública de la imagen subida
  const imageUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/images/${imageName}`;
  return imageUrl;
}

async function processImage(imageBuffer, imageName) {
  try {
    const image = await Jimp.read(imageBuffer);
    const hash = image.hash();

    if (processedHashes.has(hash)) {
      if (!duplicateGroups.has(hash)) {
        duplicateGroups.set(hash, [processedHashes.get(hash)[0]]);
      }
      duplicateGroups.get(hash).push(imageName);
      return;
    }

    let addedToGroup = false;
    for (let group of similarGroups) {
      const distance = hammingDistance(hash, group.hash);
      if (distance <= SIMILAR_THRESHOLD) {
        group.images.push(imageName);
        addedToGroup = true;
        break;
      }
    }

    if (!addedToGroup) {
      similarGroups.push({ hash, images: [imageName] });
    }

    processedHashes.set(hash, [imageName]);
  } catch (error) {
    console.error("Error procesando imagen:", error);
  }
}

app.post("/api/processImages", async (req, res) => {
  console.log("Recibiendo imágenes para procesar...");
  processedHashes.clear();
  duplicateGroups.clear();
  similarGroups = [];

  const images = req.body.images;
  const imagePaths = [];
  const imageUrls = [];

  for (let i = 0; i < images.length; i++) {
    let imageData = images[i].startsWith("data:image")
      ? images[i].split(",")[1]
      : images[i];
    const imageBuffer = Buffer.from(imageData, "base64");
    const imageName = `image_${i + 1}.jpg`;

    try {
      const imageUrl = await uploadImageToSupabase(imageBuffer, imageName);
      imageUrls.push(imageUrl);
      await processImage(imageBuffer, imageName);
    } catch (error) {
      console.error("Error subiendo o procesando imagen", error);
      return res
        .status(500)
        .json({ message: "Error subiendo o procesando imagen" });
    }
  }

  const albums = [];
  let albumId = 1;

  duplicateGroups.forEach((images) => {
    if (images.length > 1) {
      albums.push({
        name: `Álbum de Duplicados ${albumId++}`,
        coverPhoto: images[0], // Usamos la URL de la primera imagen
        photos: images,
      });
    }
  });

  similarGroups.forEach((group) => {
    if (group.images.length > 1) {
      albums.push({
        name: `Álbum de Similares ${albumId++}`,
        coverPhoto: group.images[0], // Usamos la URL de la primera imagen
        photos: group.images,
      });
    }
  });

  res.json({ albums });
});



module.exports = app;




