import mongoose from "mongoose";
import { config } from "../src/config/config.js";
import Pet from "../src/models/Pet.js";
import MatchRequest from "../src/models/MatchRequest.js";

const uri = process.env.MONGO_URI || config.mongoUri;
const swap = process.argv.includes("--swap");

const normalizeMap = new Map([
  ["adoption", "adoption"],
  ["sahiplendirme", "adoption"],
  ["adopt", "adoption"],
  ["adop", "adoption"],
  ["mating", "mating"],
  ["match", "mating"],
  ["eslestirme", "mating"],
  ["ciftlestirme", "mating"],
  ["mate", "mating"],
]);

function normalize(type) {
  const normalized = normalizeMap.get(String(type || "").trim().toLowerCase());
  if (normalized) return normalized;
  if (swap && type === "adoption") return "mating";
  if (swap && type === "mating") return "adoption";
  return type === "adoption" || type === "mating" ? type : "adoption";
}

async function fixPets() {
  let updated = 0;
  const cursor = Pet.find().cursor();
  for await (const pet of cursor) {
    const next = normalize(pet.advertType);
    if (next !== pet.advertType) {
      pet.advertType = next;
      await pet.save();
      updated += 1;
    }
  }
  return updated;
}

async function fixMatchRequests() {
  let updated = 0;
  const cursor = MatchRequest.find().cursor();
  for await (const req of cursor) {
    const next = normalize(req.advertType);
    if (next !== req.advertType) {
      req.advertType = next;
      await req.save();
      updated += 1;
    }
  }
  return updated;
}

async function main() {
  console.log(`Connecting to ${uri} ...`);
  await mongoose.connect(uri);

  const petUpdates = await fixPets();
  console.log(`Pets normalized: ${petUpdates}`);

  const requestUpdates = await fixMatchRequests();
  console.log(`Match requests normalized: ${requestUpdates}`);

  await mongoose.disconnect();
  console.log("Done. Use --swap to flip existing values if they were stored reversed.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
