const fs = require("fs");
const path = require("path");
const Jimp = require("jimp");

const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

let processedHashes = new Map();
let duplicateGroups = new Map();
let similarGroups = [];
const SIMILAR_THRESHOLD = 6; // Reducido para mayor precisión

function hammingDistance(hash1, hash2) {
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) distance++;
  }
  return distance;
}

async function processImage(imagePath) {
  try {
    console.log(`Procesando imagen: ${imagePath}`);
    const image = await Jimp.read(imagePath);
    const hash = image.hash();
    console.log(`Hash generado: ${hash}`);

    if (processedHashes.has(hash)) {
      console.log(`Imagen duplicada encontrada: ${imagePath}`);
      duplicateGroups.get(hash).push(imagePath);
      return;
    }

    let addedToGroup = false;
    for (let group of similarGroups) {
      const distance = hammingDistance(hash, group.hash);
      console.log(`Comparando con grupo existente, distancia: ${distance}`);
      if (distance <= SIMILAR_THRESHOLD) {
        console.log(`Imagen similar encontrada: ${imagePath}`);
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

module.exports = async (req, res) => {
  // Check if the request is a POST request with images in the body
  if (req.method === "POST") {
    console.log("Recibiendo imágenes para procesar...");
    const images = req.body.images;
    const imagePaths = [];

    // Delete old images in the upload directory
    const deleteAllFilesInDirectory = (dirPath) => {
      fs.readdirSync(dirPath).forEach((file) =>
        fs.unlinkSync(path.join(dirPath, file))
      );
    };
    deleteAllFilesInDirectory(UPLOAD_DIR);
    processedHashes.clear();
    duplicateGroups.clear();
    similarGroups = [];

    // Save and process each image
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

    // Prepare albums of duplicates and similar images
    const albums = [];
    let albumId = 1;

    duplicateGroups.forEach((images) => {
      if (images.length > 1) {
        albums.push({
          name: `Álbum de Duplicados ${albumId++}`,
          coverPhoto: `/uploads/${path.basename(images[0])}`,
          photos: images.map((img) => `/uploads/${path.basename(img)}`),
        });
      }
    });

    similarGroups.forEach((group) => {
      if (group.images.length > 1) {
        albums.push({
          name: `Álbum de Similares ${albumId++}`,
          coverPhoto: `/uploads/${path.basename(group.images[0])}`,
          photos: group.images.map((img) => `/uploads/${path.basename(img)}`),
        });
      }
    });

    res.status(200).json({ albums });
  } else {
    res.status(405).json({ message: "Método no permitido" });
  }
};
