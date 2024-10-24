const express = require('express');
const vision = require('@google-cloud/vision');
const { v2: translate } = require('@google-cloud/translate');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

// Inicializar el servidor
const app = express();

// Configurar middlewares
app.use(cors()); // Permitir peticiones de otros dominios (CORS)
app.use(bodyParser.json({ limit: '10mb' })); // Aumentar el límite de tamaño de las imágenes en base64

// Ruta al archivo de credenciales JSON
const keyFilename = path.join(__dirname, 'credencialesAPI.json');

// Crear cliente de Vision API y Translation API
const clientVision = new vision.ImageAnnotatorClient({ keyFilename });
const clientTranslate = new translate.Translate({ keyFilename });

// Lista de palabras clave para identificar alimentos en español
const foodKeywords = [
  'manzana', 'plátano', 'banana', 'hamburguesa', 'zanahoria', 'patata', 'pastel', 'sándwich', 'pasta',
  'bistec', 'sushi', 'pan', 'queso', 'chocolate', 'huevo', 'pescado', 'pollo',
  'tomate', 'cebolla', 'helado', 'café', 'té', 'carne', 'arroz', 'sopa'
];

// Endpoint para procesar la imagen y detectar alimentos
app.post('/detectFood', async (req, res) => {
  const imageBase64 = req.body.image; // Obtener la imagen en formato base64 del cuerpo de la petición
  try {
    // Detectar etiquetas en la imagen usando Vision API
    const [result] = await clientVision.labelDetection({
      image: { content: imageBase64 }
    });
    const labels = result.labelAnnotations.map(label => label.description);
    console.log(labels);
    // Traducir las etiquetas al español usando Translation API
    const [translations] = await clientTranslate.translate(labels, 'es');
    const translatedLabels = Array.isArray(translations) ? translations : [translations];

    // Filtrar las etiquetas que coincidan con palabras clave de alimentos
    const foodLabels = translatedLabels.filter(label => foodKeywords.includes(label.toLowerCase()));
    console.log(foodLabels);

    // Enviar los resultados de vuelta al cliente
    res.json({ labels });
  } catch (error) {
    console.error("Error al detectar alimentos:", error);
    res.status(500).json({ error: "Error al procesar la imagen" });
  }
});

// Iniciar el servidor en el puerto 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
