import "dotenv/config";
import { prisma } from "./lib/prisma.js";
import type { AnatomyIdAnswer, AnatomyIdPrompt, FlashcardAnswer, FlashcardPrompt } from "./lib/itemTypes.js";

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

  // Anatomy Guesser starter content. Images are public-domain plates from
  // Gray's Anatomy (1918) hosted on Wikimedia Commons, linked via the
  // Special:FilePath hotlink mechanism (stable regardless of the file's
  // underlying storage path). A deliberately small, single-subject set —
  // see the note in the Anatomy Guesser build message about why.
  const skeletal = await prisma.conceptNode.upsert({
    where: { id: "seed-skeletal" },
    create: { id: "seed-skeletal", name: "Skeletal System", kind: "SYSTEM" },
    update: {},
  });
  const longBones = await prisma.conceptNode.upsert({
    where: { id: "seed-long-bones" },
    create: { id: "seed-long-bones", name: "Long Bones", kind: "STRUCTURE", parentId: skeletal.id },
    update: {},
  });
  const handSkeleton = await prisma.conceptNode.upsert({
    where: { id: "seed-hand-skeleton" },
    create: { id: "seed-hand-skeleton", name: "Bones of the Hand", kind: "STRUCTURE", parentId: skeletal.id },
    update: {},
  });

  // Each bone gets its own concept (not just the shared "Long Bones" category)
  // so the confusion-pair engine can tell "confused Femur for Humerus" apart
  // from "confused Femur for Tibia" — a shared category concept would make
  // every wrong long-bone guess collapse onto the same (correct===guessed)
  // concept id and never register as a confusion.
  const femurConcept = await prisma.conceptNode.upsert({
    where: { id: "seed-concept-femur" },
    create: { id: "seed-concept-femur", name: "Femur", kind: "STRUCTURE", parentId: longBones.id },
    update: {},
  });
  const humerusConcept = await prisma.conceptNode.upsert({
    where: { id: "seed-concept-humerus" },
    create: { id: "seed-concept-humerus", name: "Humerus", kind: "STRUCTURE", parentId: longBones.id },
    update: {},
  });
  const handBonesConcept = await prisma.conceptNode.upsert({
    where: { id: "seed-concept-hand-bones" },
    create: { id: "seed-concept-hand-bones", name: "Bones of the hand", kind: "STRUCTURE", parentId: handSkeleton.id },
    update: {},
  });
  const axialSkeleton = await prisma.conceptNode.upsert({
    where: { id: "seed-axial-skeleton" },
    create: { id: "seed-axial-skeleton", name: "Axial Skeleton", kind: "REGION", parentId: skeletal.id },
    update: {},
  });
  const girdleBones = await prisma.conceptNode.upsert({
    where: { id: "seed-girdle-bones" },
    create: { id: "seed-girdle-bones", name: "Girdle Bones", kind: "REGION", parentId: skeletal.id },
    update: {},
  });
  const footSkeleton = await prisma.conceptNode.upsert({
    where: { id: "seed-foot-skeleton" },
    create: { id: "seed-foot-skeleton", name: "Bones of the Foot", kind: "STRUCTURE", parentId: skeletal.id },
    update: {},
  });

  // Progressive full-body skeletal set: large, unmistakable structures first
  // (skull, vertebral column, hip bone — low difficulty), then paired
  // forearm/leg bones, then smaller/finer bones (clavicle, patella, foot) at
  // higher difficulty — same "start broad, narrow to fine distinctions"
  // scaling as the existing femur/humerus/hand items, just covering the rest
  // of the body now instead of only the upper limb.
  const skullConcept = await prisma.conceptNode.upsert({
    where: { id: "seed-concept-skull" },
    create: { id: "seed-concept-skull", name: "Skull", kind: "STRUCTURE", parentId: axialSkeleton.id },
    update: {},
  });
  const vertebralColumnConcept = await prisma.conceptNode.upsert({
    where: { id: "seed-concept-vertebral-column" },
    create: { id: "seed-concept-vertebral-column", name: "Vertebral column", kind: "STRUCTURE", parentId: axialSkeleton.id },
    update: {},
  });
  const hipBoneConcept = await prisma.conceptNode.upsert({
    where: { id: "seed-concept-hip-bone" },
    create: { id: "seed-concept-hip-bone", name: "Hip bone", kind: "STRUCTURE", parentId: girdleBones.id },
    update: {},
  });
  const scapulaConcept = await prisma.conceptNode.upsert({
    where: { id: "seed-concept-scapula" },
    create: { id: "seed-concept-scapula", name: "Scapula", kind: "STRUCTURE", parentId: girdleBones.id },
    update: {},
  });
  const clavicleConcept = await prisma.conceptNode.upsert({
    where: { id: "seed-concept-clavicle" },
    create: { id: "seed-concept-clavicle", name: "Clavicle", kind: "STRUCTURE", parentId: girdleBones.id },
    update: {},
  });
  const forearmBonesConcept = await prisma.conceptNode.upsert({
    where: { id: "seed-concept-forearm-bones" },
    create: { id: "seed-concept-forearm-bones", name: "Radius and ulna", kind: "STRUCTURE", parentId: longBones.id },
    update: {},
  });
  const legBonesConcept = await prisma.conceptNode.upsert({
    where: { id: "seed-concept-leg-bones" },
    create: { id: "seed-concept-leg-bones", name: "Tibia and fibula", kind: "STRUCTURE", parentId: longBones.id },
    update: {},
  });
  const patellaConcept = await prisma.conceptNode.upsert({
    where: { id: "seed-concept-patella" },
    create: { id: "seed-concept-patella", name: "Patella", kind: "STRUCTURE", parentId: longBones.id },
    update: {},
  });
  const footBonesConcept = await prisma.conceptNode.upsert({
    where: { id: "seed-concept-foot-bones" },
    create: { id: "seed-concept-foot-bones", name: "Bones of the foot", kind: "STRUCTURE", parentId: footSkeleton.id },
    update: {},
  });

  const COMMONS = "https://commons.wikimedia.org/wiki/Special:FilePath";
  const anatomyItems: Array<{
    id: string;
    imageFile: string;
    choices: string[];
    correctChoice: string;
    conceptId: string;
    difficulty: number;
  }> = [
    {
      id: "seed-anatomy-femur",
      imageFile: "Femur.png",
      choices: ["Femur", "Tibia", "Humerus", "Fibula"],
      correctChoice: "Femur",
      conceptId: femurConcept.id,
      difficulty: 0.2,
    },
    {
      id: "seed-anatomy-humerus",
      imageFile: "Humerus_-_lateral_view.png",
      choices: ["Humerus", "Radius", "Ulna", "Femur"],
      correctChoice: "Humerus",
      conceptId: humerusConcept.id,
      difficulty: 0.2,
    },
    {
      id: "seed-anatomy-hand-region",
      imageFile: "Gray219.png",
      choices: ["Bones of the hand", "Bones of the foot", "Bones of the skull", "Vertebral column"],
      correctChoice: "Bones of the hand",
      conceptId: handBonesConcept.id,
      difficulty: 0.4,
    },
    {
      id: "seed-anatomy-skull",
      imageFile: "Gray188.png",
      choices: ["Skull", "Mandible", "Vertebral column", "Hip bone"],
      correctChoice: "Skull",
      conceptId: skullConcept.id,
      difficulty: 0.15,
    },
    {
      id: "seed-anatomy-vertebral-column",
      imageFile: "Gray_111_-_Vertebral_column-coloured.png",
      choices: ["Vertebral column", "Sternum", "Rib cage", "Hip bone"],
      correctChoice: "Vertebral column",
      conceptId: vertebralColumnConcept.id,
      difficulty: 0.2,
    },
    {
      id: "seed-anatomy-hip-bone",
      imageFile: "Gray235.png",
      choices: ["Hip bone", "Scapula", "Skull", "Sternum"],
      correctChoice: "Hip bone",
      conceptId: hipBoneConcept.id,
      difficulty: 0.25,
    },
    {
      id: "seed-anatomy-scapula",
      imageFile: "Scapula_-_posterior_view.png",
      choices: ["Scapula", "Hip bone", "Patella", "Clavicle"],
      correctChoice: "Scapula",
      conceptId: scapulaConcept.id,
      difficulty: 0.35,
    },
    {
      id: "seed-anatomy-clavicle",
      imageFile: "Gray201.png",
      choices: ["Clavicle", "Scapula", "Radius and ulna", "Patella"],
      correctChoice: "Clavicle",
      conceptId: clavicleConcept.id,
      difficulty: 0.35,
    },
    {
      id: "seed-anatomy-forearm-bones",
      imageFile: "Radius_and_Ulna.jpg",
      choices: ["Radius and ulna", "Tibia and fibula", "Humerus", "Femur"],
      correctChoice: "Radius and ulna",
      conceptId: forearmBonesConcept.id,
      difficulty: 0.4,
    },
    {
      id: "seed-anatomy-leg-bones",
      imageFile: "811_Tibia_and_fibula.jpg",
      choices: ["Tibia and fibula", "Radius and ulna", "Femur", "Humerus"],
      correctChoice: "Tibia and fibula",
      conceptId: legBonesConcept.id,
      difficulty: 0.4,
    },
    {
      id: "seed-anatomy-patella",
      imageFile: "Gray256.png",
      choices: ["Patella", "Clavicle", "Bones of the foot", "Bones of the hand"],
      correctChoice: "Patella",
      conceptId: patellaConcept.id,
      difficulty: 0.5,
    },
    {
      id: "seed-anatomy-foot-bones",
      imageFile: "Gray268.png",
      choices: ["Bones of the foot", "Bones of the hand", "Vertebral column", "Hip bone"],
      correctChoice: "Bones of the foot",
      conceptId: footBonesConcept.id,
      difficulty: 0.4,
    },
  ];

  for (const a of anatomyItems) {
    const prompt: AnatomyIdPrompt = {
      imageUrl: `${COMMONS}/${a.imageFile}?width=800`,
      pinX: 0.5,
      pinY: 0.5,
      choices: a.choices,
    };
    const answerKey: AnatomyIdAnswer = { correctChoice: a.correctChoice };

    const item = await prisma.item.upsert({
      where: { id: a.id },
      create: {
        id: a.id,
        type: "ANATOMY_ID",
        module: "ANATOMY",
        prompt: JSON.stringify(prompt),
        answerKey: JSON.stringify(answerKey),
        difficulty: a.difficulty,
        source: "SEED",
      },
      update: {},
    });

    await prisma.itemConcept.upsert({
      where: { itemId_conceptId: { itemId: item.id, conceptId: a.conceptId } },
      create: { itemId: item.id, conceptId: a.conceptId },
      update: {},
    });
  }

  await prisma.streakState.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });

  console.log(`Seeded ${cards.length} flashcards and ${anatomyItems.length} anatomy items.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
