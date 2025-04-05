

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
    "https://selek-t-app.netlify.app", // Tu frontend en producción
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept"],
};

app.use(cors(corsOptions)); 
app.options("/api/*", cors(corsOptions));  // Para manejar las solicitudes OPTIONS
app.use(bodyParser.json({ limit: "100mb" }));

const BASE_URL = process.env.BASE_URL || "https://selekt-server.vercel.app/";

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
// Función para descargar las imágenes desde las URLs proporcionadas
async function downloadImage(imageUrl) {
  const response = await fetch(imageUrl);
  const buffer = await response.buffer();
  return buffer;
}

// Procesar una imagen para obtener su phash
async function processImage(imageBuffer, imageUrl) {
  try {
    const image = await Jimp.read(imageBuffer);
    const hash = image.hash();

    // Si ya existe este hash, es un duplicado
    if (processedHashes.has(hash)) {
      if (!duplicateGroups.has(hash)) {
        duplicateGroups.set(hash, [processedHashes.get(hash)[0]]);
      }
      duplicateGroups.get(hash).push(imageUrl);
      return;
    }

    // Buscar imágenes similares utilizando la distancia de Hamming
    let addedToGroup = false;
    for (let group of similarGroups) {
      const distance = hammingDistance(hash, group.hash);
      if (distance <= SIMILAR_THRESHOLD) {
        group.images.push(imageUrl);
        addedToGroup = true;
        break;
      }
    }

    // Si no se añadió a ningún grupo similar, crear un nuevo grupo
    if (!addedToGroup) {
      similarGroups.push({ hash, images: [imageUrl] });
    }

    // Registrar la imagen procesada con su hash
    processedHashes.set(hash, [imageUrl]);
  } catch (error) {
    console.error("Error procesando imagen:", error);
  }
}

// Endpoint para procesar las imágenes enviadas por el frontend
app.post("/api/processImages", async (req, res) => {
  console.log("Recibiendo imágenes para procesar...");
  
  // Limpiar los grupos previos
  processedHashes.clear();
  duplicateGroups.clear();
  similarGroups = [];

  const images = req.body.images;  // Las imágenes llegan como URLs desde el frontend

  for (let i = 0; i < images.length; i++) {
    const imageUrl = images[i];  // URL de la imagen que ha sido subida a Supabase

    try {
      // Descargar la imagen desde la URL
      const imageBuffer = await downloadImage(imageUrl);
      // Procesar la imagen
      await processImage(imageBuffer, imageUrl);
    } catch (error) {
      console.error("Error descargando o procesando imagen", error);
      return res
        .status(500)
        .json({ message: "Error descargando o procesando imagen" });
    }
  }

  // Crear los álbumes de imágenes duplicadas y similares
  const albums = [];
  let albumId = 1;

  // Crear álbumes de duplicados
  duplicateGroups.forEach((images) => {
    if (images.length > 1) {
      albums.push({
        name: `Álbum de Duplicados ${albumId++}`,
        coverPhoto: images[0],  // Usamos la URL de la primera imagen como portada
        photos: images,  // Todas las imágenes duplicadas
      });
    }
  });

  // Crear álbumes de similares
  similarGroups.forEach((group) => {
    if (group.images.length > 1) {
      albums.push({
        name: `Álbum de Similares ${albumId++}`,
        coverPhoto: group.images[0],  // Usamos la URL de la primera imagen como portada
        photos: group.images,  // Todas las imágenes similares
      });
    }
  });

  // Devolver los álbumes con las imágenes duplicadas y similares
  res.json({ albums });
});

// Iniciar el servidor
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});

module.exports = app;




