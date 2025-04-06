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
const IS_LOCAL = process.env.LOCAL_ENV === "true";


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
app.options('*', cors(corsOptions)); // Para manejar las solicitudes OPTIONS
app.use(bodyParser.json({ limit: "100mb" }));

  const UPLOAD_DIR = path.join(__dirname, "uploads");
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const BASE_URL = process.env.BASE_URL || "https://selekt-server.vercel.app";

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
  //esto es sólo para local
  const deleteAllFilesInDirectory = (dirPath) => {
      fs.readdirSync(dirPath).forEach((file) =>
        fs.unlinkSync(path.join(dirPath, file))
      );
    };

    app.use("/uploads", express.static(UPLOAD_DIR));

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
       const isUrl = imagePath.startsWith("http");
       const imageId = isUrl
         ? imagePath.split("/").pop()
         : path.basename(imagePath);

       console.log(`Procesando imagen: ${imageId}`);

       const image = await Jimp.read(imagePath); // Lee desde path local o URL
       const hash = image.hash();
       console.log(`Hash generado para ${imageId}: ${hash}`);

       if (processedHashes.has(hash)) {
         console.log(`Imagen duplicada detectada: ${imageId}`);
         duplicateGroups.get(hash).push(imagePath);
         return;
       }

       let addedToGroup = false;
       for (let group of similarGroups) {
         const distance = hammingDistance(hash, group.hash);
         if (distance <= SIMILAR_THRESHOLD) {
           console.log(
             `Imagen similar encontrada: ${imageId} (distancia: ${distance})`
           );
           group.images.push(imagePath);
           addedToGroup = true;
           break;
         }
       }

       if (!addedToGroup) {
         console.log(`Imagen única añadida: ${imageId}`);
         similarGroups.push({ hash, images: [imagePath] });
       }

       processedHashes.set(hash, [imagePath]);
       if (!duplicateGroups.has(hash)) {
         duplicateGroups.set(hash, [imagePath]); // Para que funcionen los álbumes de duplicados
       }
     } catch (error) {
       console.error(`Error procesando ${imagePath}:`, error);
     }
   }


    app.post("/", async (req, res) => {
      console.log("Recibiendo imágenes para procesar...");
      deleteAllFilesInDirectory(UPLOAD_DIR);
      processedHashes.clear();
      duplicateGroups.clear();
      similarGroups = [];

      const images = req.body.images;

      for (let i = 0; i < images.length; i++) {
        let imageData = images[i].startsWith("data:image")
          ? images[i].split(",")[1]
          : images[i];
        console.log(
          `Procesando imagen ${i + 1}, tamaño base64: ${imageData.length}`
        );
        const imageBuffer = Buffer.from(imageData, "base64");

        // Guardar local
        const imagePath = path.join(UPLOAD_DIR, `image_${i + 1}.jpg`);
        fs.writeFileSync(imagePath, imageBuffer);

        // Subir a Supabase
        const fileName = `image_${Date.now()}_${i + 1}.jpg`;
        const { data, error } = await supabase.storage
          .from("images")
          .upload(fileName, imageBuffer, {
            contentType: "image/jpeg",
            upsert: true,
          });

        if (error) {
          console.error("Error subiendo imagen a Supabase:", error);
          continue;
        }

        const { data: publicUrlData } = supabase.storage
          .from("images")
          .getPublicUrl(fileName);

        const publicUrl = publicUrlData.publicUrl;

        // Solo una vez: usa local o supabase según entorno
        const imageSource = IS_LOCAL ? imagePath : publicUrl;
        await processImage(imageSource);
      }

      console.log("Generando álbumes...");
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

      res.json({ albums });
    });

  const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
    app.use("/uploads", express.static(UPLOAD_DIR));
module.exports = app;
