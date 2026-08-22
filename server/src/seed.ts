import "dotenv/config";
import { prisma } from "./lib/prisma.js";
import type { FlashcardAnswer, FlashcardPrompt } from "./lib/itemTypes.js";

// A small starter deck so Stage 1 has something to review end-to-end.
// Real content arrives via Quiz Mode A/B (stages 3-4) and the Diagnosis/
// Anatomy modules (stages 2, 5) — this is just enough to prove the FSRS
// loop and concept hierarchy work.
async function main() {
  const musculoskeletal = await prisma.conceptNode.upsert({
    where: { id: "seed-musculoskeletal" },
    create: { id: "seed-musculoskeletal", name: "Musculoskeletal System", kind: "SYSTEM" },
    update: {},
  });

  const forearm = await prisma.conceptNode.upsert({
    where: { id: "seed-forearm" },
    create: { id: "seed-forearm", name: "Forearm", kind: "REGION", parentId: musculoskeletal.id },
    update: {},
  });

  const flexors = await prisma.conceptNode.upsert({
    where: { id: "seed-forearm-flexors" },
    create: {
      id: "seed-forearm-flexors",
      name: "Forearm Flexor Muscles",
      kind: "STRUCTURE",
      parentId: forearm.id,
      description: "Muscles on the anterior forearm that flex the wrist/fingers.",
    },
    update: {},
  });

  const extensors = await prisma.conceptNode.upsert({
    where: { id: "seed-forearm-extensors" },
    create: {
      id: "seed-forearm-extensors",
      name: "Forearm Extensor Muscles",
      kind: "STRUCTURE",
      parentId: forearm.id,
      description: "Muscles on the posterior forearm that extend the wrist/fingers.",
    },
    update: {},
  });

  const cardio = await prisma.conceptNode.upsert({
    where: { id: "seed-cardio" },
    create: { id: "seed-cardio", name: "Cardiovascular System", kind: "SYSTEM" },
    update: {},
  });

  const mi = await prisma.conceptNode.upsert({
    where: { id: "seed-mi" },
    create: {
      id: "seed-mi",
      name: "Myocardial Infarction",
      kind: "DIAGNOSIS",
      parentId: cardio.id,
      description: "Necrosis of myocardial tissue due to ischemia.",
    },
    update: {},
  });

  const cards: Array<{ id: string; front: string; back: string; conceptId: string; difficulty: number }> = [
    {
      id: "seed-card-flexor-carpi-radialis",
      front: "Which forearm flexor inserts on the base of the 2nd/3rd metacarpals and flexes + abducts the wrist?",
      back: "Flexor carpi radialis",
      conceptId: flexors.id,
      difficulty: 0.4,
    },
    {
      id: "seed-card-fdp-vs-fds",
      front: "What distinguishes flexor digitorum profundus from flexor digitorum superficialis functionally?",
      back: "FDP flexes the DIP joints (and can flex PIP/MCP); FDS flexes the PIP joints only. Testing DIP flexion in isolation tests FDP.",
      conceptId: flexors.id,
      difficulty: 0.6,
    },
    {
      id: "seed-card-ecrl-action",
      front: "What is the primary action of extensor carpi radialis longus?",
      back: "Extension and abduction (radial deviation) of the wrist",
      conceptId: extensors.id,
      difficulty: 0.4,
    },
    {
      id: "seed-card-extensor-radial-nerve",
      front: "Which nerve innervates essentially all extensor forearm muscles, and via which branch?",
      back: "Radial nerve, via the posterior interosseous nerve (deep branch) for most; the nerve proper for brachioradialis/ECRL.",
      conceptId: extensors.id,
      difficulty: 0.7,
    },
    {
      id: "seed-card-mi-troponin",
      front: "What is the most sensitive and specific biomarker for myocardial infarction, and when does it rise?",
      back: "Troponin (I or T); rises within 3-4 hours of infarction and stays elevated 7-14 days.",
      conceptId: mi.id,
      difficulty: 0.3,
    },
    {
      id: "seed-card-mi-stemi-vessel",
      front: "ST elevation in leads II, III, aVF suggests occlusion of which coronary artery?",
      back: "Right coronary artery (RCA) — inferior wall MI",
      conceptId: mi.id,
      difficulty: 0.6,
    },
  ];

  for (const c of cards) {
    const prompt: FlashcardPrompt = { front: c.front };
    const answerKey: FlashcardAnswer = { back: c.back };

    const item = await prisma.item.upsert({
      where: { id: c.id },
      create: {
        id: c.id,
        type: "FLASHCARD",
        module: "REVIEW",
        prompt: JSON.stringify(prompt),
        answerKey: JSON.stringify(answerKey),
        difficulty: c.difficulty,
        source: "SEED",
      },
      update: {},
    });

    await prisma.itemConcept.upsert({
      where: { itemId_conceptId: { itemId: item.id, conceptId: c.conceptId } },
      create: { itemId: item.id, conceptId: c.conceptId },
      update: {},
    });
  }

  await prisma.streakState.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });

  console.log(`Seeded ${cards.length} flashcards across ${5} concepts.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
