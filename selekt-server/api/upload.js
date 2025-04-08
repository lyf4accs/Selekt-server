const { supabase } = require("../supabaseClient");

const handler = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

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
};

module.exports = {
  default: handler,
  config: {
    api: {
      bodyParser: {
        sizeLimit: "500mb",
      },
    },
  },
};
