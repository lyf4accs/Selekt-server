const express = require("express");
const vision = require("@google-cloud/vision");
const phash = require("phash");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const sharp = require("sharp");
const fs = require("fs");

// Inicializar el servidor
const app = express();

// Configurar middlewares
app.use(cors()); // Permitir peticiones de otros dominios (CORS)
app.use(bodyParser.json({ limit: "10mb" })); // Aumentar el límite de tamaño de las imágenes en base64

// Ruta al archivo de credenciales JSON de Google Cloud Vision
const keyFilename = path.join(__dirname, "credencialesSELEKT.json");

// Crear cliente de Vision API
const clientVision = new vision.ImageAnnotatorClient({ keyFilename });

// Variable para almacenar imágenes procesadas
let processedImages = [];

// Lista de "moodboards", agrupando por colores
let moodboards = {};

// Función para calcular el hash perceptual de la imagen usando phash
async function getImageHash(imageBuffer) {
  return phash(imageBuffer); // Usando la librería phash para obtener el hash perceptual
}

// Función para obtener los colores dominantes de una imagen usando Google Vision
async function getDominantColors(imageBuffer) {
  const [result] = await clientVision.imageProperties({
    image: { content: imageBuffer },
  });
  const colors = result.imagePropertiesAnnotation.dominantColors.colors;
  return colors;
}

// Función para agrupar imágenes por colores
async function addToMoodboard(imageBuffer, imageName) {
  try {
    // Obtener el hash perceptual para evitar duplicados
    const imageHash = await getImageHash(imageBuffer);
    if (processedImages.includes(imageHash)) {
      console.log(`Imagen duplicada detectada: ${imageName}`);
      return; // No agregar si ya existe un duplicado
    }
    processedImages.push(imageHash); // Marcar la imagen como procesada

    // Obtener los colores dominantes de la imagen usando Google Vision
    const dominantColors = await getDominantColors(imageBuffer);
    const mainColor = dominantColors[0].color;

    // Crear un identificador para el moodboard basado en el color dominante
    const moodboardKey = `rgb(${mainColor.red}, ${mainColor.green}, ${mainColor.blue})`;

    // Si el moodboard ya existe, añadir la imagen; de lo contrario, crear uno nuevo
    if (!moodboards[moodboardKey]) {
      moodboards[moodboardKey] = [];
    }

    moodboards[moodboardKey].push(imageName);
    console.log(`Imagen añadida al moodboard: ${imageName}`);
  } catch (error) {
    console.error("Error al procesar la imagen para el moodboard:", error);
  }
}

// Endpoint para procesar imágenes y agruparlas en moodboards
app.post("/processImages", async (req, res) => {
  const images = req.body.images; // Recibir un array de imágenes en base64
  try {
    for (const [index, imageBase64] of images.entries()) {
      const imageBuffer = Buffer.from(imageBase64, "base64");

      // Generar nombre para la imagen (en este caso, solo usando el índice)
      const imageName = `image_${index + 1}`;

      // Añadir la imagen al moodboard basado en su color dominante
      await addToMoodboard(imageBuffer, imageName);
    }

    // Enviar respuesta con los moodboards generados
    res.json({ moodboards });
  } catch (error) {
    console.error("Error al procesar las imágenes:", error);
    res.status(500).json({ error: "Error al procesar las imágenes" });
  }
});


// Iniciar el servidor en el puerto 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
