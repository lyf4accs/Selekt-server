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
// Serve uploaded images as static files (moved here after defining UPLOAD_DIR)
app.use("/uploads", express.static(UPLOAD_DIR));

// Almacenar hashes de imágenes procesadas
let processedHashes = new Set();
let duplicateImages = [];

async function isDuplicateImage(imagePath) {
  try {
    // Cargar la imagen con Jimp
    const image = await Jimp.read(imagePath);

    // Obtener el hash perceptual (pHash)
    const hash = image.hash();

    // Comprobar si ya existe el hash
    if (processedHashes.has(hash)) {
      console.log(`Imagen duplicada detectada: ${imagePath}`);
      duplicateImages.push(imagePath); // Guardar duplicado
      return true;
    }

    // Guardar el hash si es nuevo
    processedHashes.add(hash);
    return false;
  } catch (error) {
    console.error("Error al calcular pHash:", error);
    return false;
  }
}app.post("/api/processImages", async (req, res) => {
   deleteAllFilesInDirectory(UPLOAD_DIR);
  const images = req.body.images;
  const imagePaths = [];
  duplicateImages = []; 

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

      if (!fs.existsSync(imagePath)) {
        console.error(`No se pudo guardar la imagen en ${imagePath}`);
        continue;
      }

      imagePaths.push(imagePath);

      await isDuplicateImage(imagePath);
    }

    // Seleccionar la primera imagen duplicada como cover photo si hay duplicados
    const coverPhoto = duplicateImages.length > 0 ? `http://localhost:3000/uploads/${path.basename(duplicateImages[0])}` : null;

    const albums = [
      {
        name: "Duplicados",
        coverPhoto: coverPhoto,  
        photos: duplicateImages.map((img) => `http://localhost:3000/uploads/${path.basename(img)}`), // Absolute URLs
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
