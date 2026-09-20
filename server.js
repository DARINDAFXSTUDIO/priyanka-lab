import express from "express";
import multer from "multer";
import OpenAI from "openai";
import sharp from "sharp";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3000);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }
});

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const version = "3.0-web";
const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || "gpt-5.6-luna";
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";

app.get("/api/health", (_req, res) => {
  res.json({
    app: "PRIYANKA LAB",
    status: "online",
    version
  });
});

const analysisPrompt = `You are PRIYANKA LAB, an AI beauty-content studio.
Analyze one normal phone photo made by a home-service beauty artist.

Return JSON only:
{
  "category":"Mehndi|Nails|Bridal Mehndi|Bridal Nails|Unknown",
  "quality":"GOOD|ACCEPTABLE|BAD",
  "style":"short description of the visible work",
  "composition":"short description of framing/light/background",
  "problems":["..."],
  "title":"short elegant Instagram title",
  "caption":"friendly professional Instagram caption",
  "hashtags":["#..."]
}

Rules:
- Preserve the artist's actual visible work.
- Never invent hidden Mehndi, nail art, fingers, anatomy, jewellery, tools, or surroundings.
- Never claim the artist has a salon/parlour.
- Home-service wording is allowed only when supported by the user's supplied context; do not invent service areas.
- GOOD means the actual work is clear enough to preserve faithfully.
- ACCEPTABLE means it is usable but needs presentation enhancement.
- BAD means the work is too blurry, obstructed, tiny, distorted, or otherwise unclear to preserve accurately.
- If uncertain about a design detail, describe it as unknown rather than guessing.`;

app.post("/api/analyze", upload.single("photo"), async (req, res) => {
  try {
    if (!client) return res.status(503).json({ error: "OPENAI_API_KEY is not configured." });
    if (!req.file) return res.status(400).json({ error: "Photo missing." });

    const b64 = req.file.buffer.toString("base64");
    const response = await client.responses.create({
      model: TEXT_MODEL,
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: analysisPrompt },
          { type: "input_image", image_url: `data:${req.file.mimetype};base64,${b64}` }
        ]
      }]
    });

    const match = (response.output_text || "").match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Unexpected analysis response.");
    const data = JSON.parse(match[0]);

    if (!["GOOD", "ACCEPTABLE", "BAD"].includes(data.quality)) {
      data.quality = "ACCEPTABLE";
    }
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Analysis failed." });
  }
});

const prompts = {
  hero: `Create a premium Instagram portfolio presentation from the supplied source photo.
Preserve the exact visible Mehndi/Nail work, hand/finger anatomy, nail shape, skin tone and every visible design detail.
Only improve presentation: exposure, white balance, natural contrast, realistic sharpness, crop, composition, background distractions and shadows.
Use an elegant neutral cream/beige beauty presentation.
Do not redraw, extend, complete, redesign or invent any work that is not clearly visible.
Do not invent hidden fingers, hidden nail surfaces, hidden Mehndi, jewellery, props, or a salon.
Natural realistic photography. No text. No logo.`,
  detail: `Create a clean close-up Instagram detail image from the supplied source photo.
Crop/reframe only what is actually visible. Preserve the exact visible Mehndi/Nail work and anatomy.
Do not redraw, extend, complete, redesign or invent unseen design.
Improve only natural lighting, clarity, crop, contrast and distractions.
Natural realistic skin and photography. No text. No logo.`,
  aesthetic: `Create an elegant beauty aesthetic presentation using the supplied source photo.
Keep the actual visible Mehndi/Nail work unchanged and clearly recognizable.
You may refine the visible background into subtle cream/beige fabric, a clean surface, natural light, restrained flowers or restrained jewellery only where this does not obscure or alter the real work.
Do not create a salon/parlour and do not imply one exists.
Do not invent missing work, fingers, nail surfaces, Mehndi details or hidden angles.
No text. No logo.`,
  editorial: `Create a refined editorial Instagram composition from the supplied source photo.
Preserve the exact visible Mehndi/Nail design, anatomy and all visible work.
Improve composition, light, depth, negative space and background presentation only.
Sophisticated cream/brown beauty editorial look, still realistic and faithful to the source.
Do not invent hidden details, redesign the work, change nail art, change Mehndi, or fabricate a salon.
No text. No logo.`
};

async function editImage(buffer, mime, prompt) {
  if (!client) throw new Error("OPENAI_API_KEY is not configured.");
  const result = await client.images.edit({
    model: IMAGE_MODEL,
    image: new File([buffer], "source-image", { type: mime }),
    prompt,
    size: "1024x1024",
    quality: "medium"
  });
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image returned by image model.");
  return Buffer.from(b64, "base64");
}

async function applyLogo(img, logoBuffer) {
  if (!logoBuffer) return img;
  const logoPng = await sharp(logoBuffer)
    .resize({ width: 190, height: 80, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();

  return sharp(img)
    .composite([{ input: logoPng, gravity: "southeast", blend: "over" }])
    .png()
    .toBuffer();
}

app.post("/api/generate/:variant", upload.fields([
  { name: "photo", maxCount: 1 },
  { name: "logo", maxCount: 1 }
]), async (req, res) => {
  try {
    const photo = req.files?.photo?.[0];
    const logo = req.files?.logo?.[0]?.buffer;
    const variant = req.params.variant.toLowerCase();

    if (!photo) return res.status(400).json({ error: "Photo missing." });
    if (!prompts[variant]) return res.status(400).json({ error: "Unknown variant." });

    let img = await editImage(photo.buffer, photo.mimetype, prompts[variant]);
    img = await applyLogo(img, logo);

    res.json({
      name: variant,
      label: variant.toUpperCase(),
      data: `data:image/png;base64,${img.toString("base64")}`
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || `Failed to create ${req.params.variant}.` });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("\n================================");
  console.log("       PRIYANKA LAB");
  console.log("   AI Beauty Content Studio");
  console.log("================================\n");
  console.log(`Local: http://localhost:${PORT}`);
  console.log("PRIYANKA LAB is ready as a web app.");
  console.log("For online use, deploy this project and open its public HTTPS URL.");
});
