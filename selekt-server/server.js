const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const Jimp = require("jimp");

const app = express();

app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR);
}

// Función para eliminar todos los archivos en el directorio uploads
const deleteAllFilesInDirectory = (dirPath) => {
  const files = fs.readdirSync(dirPath);
  for (let file of files) {
    const filePath = path.join(dirPath, file);
    fs.unlinkSync(filePath); // Eliminar cada archivo
  }
};

// Serve uploaded images as static files
app.use("/uploads", express.static(UPLOAD_DIR));

let processedHashes = new Set();
let duplicateImages = [];
let similarImages = [];

// Función para calcular la distancia Hamming entre dos hashes
function hammingDistance(hash1, hash2) {
  let distance = 0;
  let xor = hash1 ^ hash2; // XOR de los dos hashes
  while (xor) {
    distance += xor & 1; // Sumar 1 por cada bit diferente
    xor >>>= 1; // Desplazar los bits a la derecha
  }
  return distance;
}

// Definir un umbral para considerar imágenes similares 
const SIMILAR_THRESHOLD = 40;

async function isDuplicateImage(imagePath) {
  try {
    // Cargar la imagen con Jimp
    const image = await Jimp.read(imagePath);

    // Obtener el hash perceptual (pHash)
    const hash = image.hash();

    // Comprobar si ya existe el hash (duplicado)
    if (processedHashes.has(hash)) {
      console.log(`Imagen duplicada detectada: ${imagePath}`);
      duplicateImages.push(imagePath); // Guardar duplicado
      return true;
    }

    // Comparar con los hashes existentes para ver si es similar
    for (let existingHash of processedHashes) {
      const distance = hammingDistance(hash, existingHash);
      if (distance <= SIMILAR_THRESHOLD) {
        console.log(`Imagen similar detectada: ${imagePath}`);
        similarImages.push(imagePath); // Guardar imagen similar
        return false;
      }
    }

    // Guardar el hash si es nuevo
    processedHashes.add(hash);
    return false;
  } catch (error) {
    console.error("Error al calcular pHash:", error);
    return false;
  }
}

app.post("/api/processImages", async (req, res) => {
  // Limpiar la carpeta uploads antes de procesar las nuevas imágenes
  deleteAllFilesInDirectory(UPLOAD_DIR);

  const images = req.body.images;
  const imagePaths = [];
  duplicateImages = [];
  similarImages = []; // Reset similar images for each request

  try {
    for (let i = 0; i < images.length; i++) {
      let imageData = images[i];

      // Check if the data is in a data URL format
      if (imageData.startsWith("data:image")) {
        const base64Data = imageData.split(",")[1]; // Extract base64 part only
        imageData = base64Data;
      }

      console.log(`Imagen ${i + 1}:`);
      console.log("Base64 length:", imageData.length); // Log the length of the base64 string

      // Convert base64 data to Buffer
      const imageBuffer = Buffer.from(imageData, "base64");

      // Log the buffer length and first few bytes
      console.log("Buffer length:", imageBuffer.length);
      console.log("First 10 bytes of buffer:", imageBuffer.slice(0, 10));

      if (imageBuffer.length === 0) {
        console.log("La imagen está vacía");
        continue; // Skip empty images
      }

      const imagePath = path.join(UPLOAD_DIR, `image_${i + 1}.jpg`);
      fs.writeFileSync(imagePath, imageBuffer);

      // Check if the image was saved successfully
      if (!fs.existsSync(imagePath)) {
        console.error(`No se pudo guardar la imagen en ${imagePath}`);
        continue;
      }

      imagePaths.push(imagePath);

      // Verificar si es duplicado o similar
      await isDuplicateImage(imagePath);
    }

    // Devolver las imágenes duplicadas y similares
    const albums = [
      {
        name: "Duplicados",
        coverPhoto:
          duplicateImages.length > 0
            ? `http://localhost:3000/uploads/${path.basename(
                duplicateImages[0]
              )}`
            : null,
        photos: duplicateImages.map(
          (img) => `http://localhost:3000/uploads/${path.basename(img)}`
        ), // Absolute URLs
      },
      {
        name: "Similares",
        coverPhoto:
          similarImages.length > 0
            ? `http://localhost:3000/uploads/${path.basename(similarImages[0])}`
            : null,
        photos: similarImages.map(
          (img) => `http://localhost:3000/uploads/${path.basename(img)}`
        ), // Absolute URLs
      },
    ];

    res.json({ albums });
  } catch (error) {
    console.error("Error al procesar las imágenes:", error);
    res.status(500).json({ error: "Error al procesar las imágenes" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
