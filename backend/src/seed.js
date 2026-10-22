import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDb } from "./db.js";
import { Station } from "./models/Station.js";
import { stations } from "./sampleData.js";

dotenv.config();

const connected = await connectDb(process.env.MONGODB_URI);

if (!connected) {
  console.log("MongoDB connection failed. Add MONGODB_URI in .env and run this command again.");
  process.exit(1);
}

await Station.deleteMany({});
await Station.insertMany(stations);
await mongoose.disconnect();

console.log(`Seeded ${stations.length} monitoring stations.`);
