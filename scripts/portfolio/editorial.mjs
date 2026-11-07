// Descriptions written after inspecting this intake's 24-image contact sheet.
export const descriptions = Object.fromEntries([
  ["acbdd359-5dee-47e9-a81d-b829d666e3ae", "A model in a cream crisscross top and loose dark trousers walks along a church runway carrying a brown bag."],
  ["b5016cc0-4cc3-4028-bea7-7c6a25d5facb", "A model walks down a church runway beneath stained-glass windows."],
  ["0ac5eccb-b963-4c87-9074-441742f7fd31", "A model wears a dark fitted top, a draped grey skirt and trousers on a runway."],
  ["8836565c-bb37-4fda-b3e2-c2109fc68f52", "A model in a pale crisscross top and loose dark trousers stands on a church runway."],
  ["d84224e8-d4ab-42f5-8628-58133008d140", "A model in a dark fitted top and draped grey garment poses beside a seated runway audience."],
  ["cbf28576-a316-478b-a6c0-0fb5f04851a2", "An abstract composition layers a blurred face, circular light trails and translucent rectangles."],
  ["da70f0b1-c017-45e9-8f08-3fc68f9b0f6e", "A soft pink cloud-like form floats over a blurred yellow, green and black abstract background."],
  ["861d47d6-0ee5-4fb3-9054-19c849037ce3", "An orange and yellow light wash obscures a building entrance and steps."],
  ["8ae11d68-6a47-448f-b648-7ea69beb9a14", "A circular swirl of yellow, orange, dark blue and white light fills the image."],
  ["b72ec05b-003a-4d57-823d-14091a7e3ec3", "A blurred figure is surrounded by layered orange, yellow and pink light."],
  ["a1ded9da-6112-4bf8-871e-8ee9882df8a0", "A person's hands and dark trousers appear below a wide white band against a tiled wall."],
  ["3f47ceb4-2224-4ca5-a0c1-be5b222ca83a", "A grey circular digital collage frames a smaller photograph of people behind netting."],
  ["79780ff0-f958-4e2e-8bbf-78803c2d4417", "Several people stand behind netting in a dimly lit interior."],
  ["0bf2125a-6c21-4a06-b035-6187947bbb5e", "People stand and sit behind hanging netting in a dark interior."],
  ["9b866f9f-75d2-4871-9fa5-601bb957d743", "A densely textured multicoloured mixed-media artwork rests against a pale wall."],
  ["c5be0f84-5e09-463c-b9e6-3a99f38c6275", "A handmade book with a dark cloud-like image on its cover lies on a wooden surface."],
  ["3d6681c9-793d-47f9-b5db-155f417b839b", "An open handmade book shows a handwritten title page reading dysregulation by Arnaud Belec."],
  ["c705dd18-ad10-4c60-9900-280072a56c17", "An open collage book combines a yellow cloud-like shape with black-and-white cut-out photographs."],
  ["e06602b5-543a-4d7f-a4ae-2b0d423a43fd", "A collage-book spread layers a black-and-white figure, instruments and long diagonal shapes."],
  ["73835d25-23c0-4359-b3ea-2be0e7099d08", "An open collage book shows repeated small black symbols and a long curved object across white pages."],
  ["b75f6d7b-be21-47ee-b6a9-cc55d07884ee", "A collage-book spread combines a large black-and-white object with a tan textured cut-out."],
  ["eaa40eb4-c67b-4097-8233-79e6152745af", "An open book places dense handwritten marks beside a plain grey page."],
  ["646c1b97-f75a-45da-a0c2-1598b993560b", "The back of a handmade book carries a high-contrast black-and-white textured image."],
  ["de83989b-088f-4c5f-a03e-8a26ff9b3fa4", "A black frame holds a white line portrait on a black background."],
]);

export const importGroups = ["phassion", "tableaux", "digital-tableaux", "sunday-missile", "xix-visuals-for-december"];

const leaf = value => ({ type: "text", version: 1, text: value, format: 0, detail: 0, mode: "normal", style: "" });
export const paragraph = value => ({ type: "paragraph", version: 1, children: [leaf(value)], direction: null, format: "", indent: 0, textFormat: 0, textStyle: "" });
export const uploadNode = id => ({ type: "upload", version: 3, relationTo: "media", value: id, fields: {} });
export const document = children => ({ root: { type: "root", version: 1, children, direction: null, format: "", indent: 0 } });
export function linkedParagraph(label, url) {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error("Invalid editorial source link.");
  return { ...paragraph(""), children: [{ type: "link", version: 3, children: [leaf(label)], direction: null, format: "", indent: 0, fields: { linkType: "custom", url: parsed.href, newTab: true } }] };
}

export function journalBody(page, ids) {
  const nodes = [];
  const elements = [...page.texts.map(item => ({ ...item, kind: "text" })), ...page.images.map(item => ({ ...item, kind: "image" }))].sort((a, b) => a.offset - b.offset);
  for (const item of elements) {
    if (item.kind === "text") nodes.push(...item.text.split(/\n+/).filter(Boolean).map(paragraph));
    else if (ids[item.id]) nodes.push(uploadNode(ids[item.id]));
    else if (item.id === "c9fb1ff3-758e-4cd2-8c64-2077ffafe054") nodes.push(linkedParagraph("will in living.png — existing photograph", "https://arnaud-belec.vercel.app/photos/will%20in%20living.png"));
    else throw new Error("Unresolved image in Journal source order.");
  }
  for (const url of [...new Set(page.links)].filter(url => /^https?:\/\//.test(url))) nodes.push(linkedParagraph(url, url));
  return document(nodes);
}

export const youtubeCopy = {
  R7oFdBKswIo: { excerpt: "ethnographic film/experimental" },
  "34dthdTo4Rc": { excerpt: "documentary", credits: "finalist at Dawson Film Festival (2024)\ncategory: documentary" },
  ux9BG4qgobc: { excerpt: "A gaze into TVM Bootcamp - Short film for TVM" },
  TyQC8Ew05ho: { excerpt: "Nightmare on McTavish - Ad for SSMU 4FLOORS haunted house" },
};
