// Intake decisions, not existing CMS IDs or permission to publish.
export const groups = {
  "street-photography": { title: "Street photography", kind: "photographs" },
  "black-and-white": { title: "Black-and-white photography", kind: "photographs" },
  portraiture: { title: "Portraiture", kind: "photographs" },
  multicaf: { title: "Photographie, fondation Multicaf (2024)", kind: "photographs", year: "2024" },
  "theatre-costuming": { title: "Photography, Costuming for Theatre course, McGill University", kind: "photographs" },
  "circle-of-fashion": { title: "Circle of Fashion", kind: "fashion-projects", year: "2025", existingSelection: true },
  phassion: { title: "PHASSION", kind: "fashion-projects", year: "2026" },
  tableaux: { title: "Tableaux", kind: "posts" },
  "digital-tableaux": { title: "Digital tableaux", kind: "posts" },
  "sunday-missile": { title: "Sunday Missile", kind: "posts" },
  "xix-visuals-for-december": { title: "XIX visuals for December", kind: "videos", year: "2025" },
  "to-hang-by-a-thread": { title: "To Hang by a Thread", kind: "videos", year: "2025", existingSelection: true },
  "placement-review": { title: "Covers, backgrounds, contact and navigation images", kind: "hold" },
};

export const pageGroups = {
  "/fotos": "street-photography", "/experimental": "black-and-white", "/portraiture": "portraiture",
  "/photograhie-fondation-multicaf": "multicaf", "/sewing-catherine-request": "theatre-costuming",
  "/sewing": "circle-of-fashion", "/tableaux": "tableaux", "/digital-tableaux": "digital-tableaux",
  "/sunday-missile": "sunday-missile", "/fondation-multicaf-2024": "xix-visuals-for-december",
  "/films": "to-hang-by-a-thread",
};

export function groupForImage(page, image) {
  if (["/", "/copie-de-sewing"].includes(page.path)) {
    const phassion = page.texts.find(block => block.text.startsWith("PHASSION,"));
    if (!phassion) throw new Error("Fashion section boundary changed; review source grouping.");
    return image.offset > phassion.offset ? "phassion" : "circle-of-fashion";
  }
  return pageGroups[page.path] || "placement-review";
}

export const youtubeProjects = {
  R7oFdBKswIo: { slug: "struggles-and-jugglers", year: "2025" },
  "34dthdTo4Rc": { slug: "the-bins-from-trash-to-treasure", year: "2024" },
  ux9BG4qgobc: { slug: "a-quiet-gaze-into-tvm-bootcamp", year: "2025" },
  TyQC8Ew05ho: { slug: "nightmare-on-mctavish", year: "2025" },
};

// Verify these actual local images before excluding their Adobe compositions.
// Differently graded copies remain explicitly reviewable, not byte-identical claims.
export const existingImages = Object.fromEntries([
  ["cc0f7f99-9ead-426a-b26a-8a3d38878801", "DSC04669-Edit.jpg"],
  ["31e4123d-0aa3-479c-824e-48beb4346b39", "DSC04651-Edit-2.jpg"],
  ["b8b4a4bf-5fc1-4781-80fc-83bf23d33756", "DSC04596-Edit-2.jpg"],
  ["dfbbdb99-47d8-43cd-8d8f-368dec9d2913", "DSC04587-Edit.jpg"],
  ["fbf53e78-f863-4561-8d26-519226adbe0b", "DSC04619-Edit-2.jpg"],
  ["980dd4d1-a806-4090-8e2b-5d873d48b5cc", "DSC04613-Edit-2.jpg"],
  ["1d806ec8-50d3-4dce-9e7f-481684ba1940", "DSC04631-Edit.jpg"],
  ["543f2b32-2fc7-42f4-8ec2-cef313a0954a", "DSC04642-Edit.jpg"],
  ["51fcca0a-4f4c-4281-ac40-715cec0f4043", "DSC04605-Edit-2.jpg"],
  ["34f63ccd-3a41-4f8f-bb98-84cdcc973069", "DSC04635-Edit-3.jpg"],
  ["01a62d15-1ae1-4d00-9c05-7a0185c8ac65", "DSC04669-Edit.jpg"],
  ["5ed33325-e19e-4b02-a5cd-b1548f4df4de", "DSC04651-Edit-2.jpg"],
  ["229a822e-d2ca-405e-a77c-ae41a690a7da", "DSC04596-Edit-2.jpg"],
  ["1ff17c64-6f09-4822-b653-defde3a8a2e4", "DSC04587-Edit.jpg"],
  ["a1a73344-90e4-46da-8cb0-18c29112c9da", "DSC04619-Edit-2.jpg"],
  ["c01ed695-3630-40cc-a4de-a0e66e8c049e", "DSC04613-Edit-2.jpg"],
  ["753ab8a7-b2fc-49eb-9930-54571293ab4d", "DSC04631-Edit.jpg"],
  ["5fa3a7f0-aa04-4edf-8cb0-0fa211420405", "DSC04642-Edit.jpg"],
  ["aae2cbf9-2fed-4a64-93b8-4d1157a60f2b", "DSC04605-Edit-2.jpg"],
  ["ccf286f5-f278-4b33-8703-6d7099f6904a", "DSC04635-Edit-3.jpg"],
  ["c457b4b4-6726-4862-aacf-77f252d3b441", "To Hang by a Thread (2025) - Cover.jpg"],
  ["c9fb1ff3-758e-4cd2-8c64-2077ffafe054", "will in living.png"],
  ["56ae3d0c-14cd-4ce0-976a-635247aab031", "AA017.jpg"],
  ["eab032aa-f573-44bb-b471-90ea907b6d9b", "DSC02930.jpg"],
  ["9cb0c54b-86e9-46e1-8df5-2c54d345cef4", "DSC02897.jpg"],
  ["db5074d8-7328-43b7-bce4-613d3240e947", "DSC02917.jpg"],
]);

// Same preview composition; retain the association without another download.
export const compositionAliases = {
  "db34181b-d883-4261-9ca9-6c2ebf1406ef": "84ad6150-fe43-4bd3-b3d2-b3be9889a1c4",
  "e9f527c1-b7df-420f-bb52-9754d394e81f": "60fd036e-ad38-4f91-83a9-3041467f7a75",
};
