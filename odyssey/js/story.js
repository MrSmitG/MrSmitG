/* Story chapters & dialogue for The Odyssey */
const STORY = {
  chapters: [
    {
      id: "sea",
      label: "Chapter I",
      title: "The Wine-Dark Sea",
      blurb:
        "Troy has fallen by your cunning. Poseidon remembers. Gather your crew upon the shore and set a course for Ithaca — if the gods allow.",
      objective: "Speak with Athena, then board the ship",
      startDialogue: [
        {
          speaker: "Athena",
          text: "Odysseus of Ithaca. The horse you built ended a war — and began your penance. Poseidon’s eye is upon you.",
        },
        {
          speaker: "Odysseus",
          text: "Then let him watch. I have a wife who waits, and a son who has grown without me.",
        },
        {
          speaker: "Athena",
          text: "Walk the beach. Rally what men remain. When you are ready, board the black ship. I will not abandon you — but I cannot spare you every storm.",
        },
      ],
    },
    {
      id: "cyclops",
      label: "Chapter II",
      title: "The Cave of Polyphemus",
      blurb:
        "Hunger drives you onto a strange shore. In the cliff-cave lives a giant who knows no law of hospitality — Zeus’s law, broken at your peril.",
      objective: "Steal the firebrand and blind the Cyclops",
      startDialogue: [
        {
          speaker: "Eurylochus",
          text: "My king… there is cheese and flock enough for a feast. But something breathes in that cave that is not a man.",
        },
        {
          speaker: "Odysseus",
          text: "We take what we need. Zeus’s law bids hosts welcome strangers — even giants must honor it.",
        },
        {
          speaker: "Athena",
          text: "Cunning over strength, Odysseus. Find the firebrand. When he sleeps, strike true — then flee before the mountain wakes.",
        },
      ],
    },
    {
      id: "circe",
      label: "Chapter III",
      title: "Circe’s Grove",
      blurb:
        "An island of perfume and pigs. The sorceress shows men what they truly are. Carry moly. Free your crew. Do not forget who you are.",
      objective: "Gather moly herbs, free the crew, confront Circe",
      startDialogue: [
        {
          speaker: "Athena",
          text: "Circe weaves men into beasts. Take the white moly that grows in shade — it will armor your blood against her cup.",
        },
        {
          speaker: "Hermes",
          text: "A gift from the gods, wanderer. Drink nothing she offers until the moly is yours. Then draw your blade — and she will listen.",
        },
      ],
    },
    {
      id: "sirens",
      label: "Chapter IV",
      title: "The Sirens’ Song",
      blurb:
        "Beauty that kills. Lash yourself to the mast if you must hear — but do not steer toward the rocks. Survive the wine-dark channel.",
      objective: "Reach the far shore without crashing",
      startDialogue: [
        {
          speaker: "Circe",
          text: "Beyond my island the Sirens wait. Their song promises knowledge of all that was and will be. It is a lie that tastes like truth.",
        },
        {
          speaker: "Odysseus",
          text: "I will hear them. Bind me to the mast. If I beg for release — sail on.",
        },
        {
          speaker: "Athena",
          text: "Steer through the channel. Avoid the rocks. The song will pull at your hands — hold your course for Ithaca.",
        },
      ],
    },
    {
      id: "ithaca",
      label: "Chapter V",
      title: "The Halls of Ithaca",
      blurb:
        "Twenty years. Suitors feast on your house. Penelope weaves and unweaves hope. Enter as a beggar. Reclaim your name.",
      objective: "Defeat the suitors and reclaim the hall",
      startDialogue: [
        {
          speaker: "Athena",
          text: "Your palace groans with strangers who call themselves guests. Zeus’s law cuts both ways, Odysseus. They have violated your hearth.",
        },
        {
          speaker: "Penelope",
          text: "(From afar) Whoever you are, stranger — the queen of Ithaca still waits for a husband who keeps his word.",
        },
        {
          speaker: "Odysseus",
          text: "Then let the beggar become the king. For Penelope. For Telemachus. For home.",
        },
      ],
    },
  ],

  ending: {
    title: "Ithaca",
    text: "The bow sings. The hall is quiet. Penelope knows your scar before your name. The sea will always remember — but tonight, the hearth is yours. The journey ends where it began: home.",
  },

  toasts: {
    crewSaved: "A crewman joins you",
    moly: "Moly gathered — Circe’s magic falters",
    brand: "Firebrand claimed",
    objective: "Objective updated",
    chapterClear: "The path forward opens…",
  },
};
