import mongoose from "mongoose";

export async function connectDb(uri) {
  if (!uri) return false;

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 2500 });
    return true;
  } catch (error) {
    console.warn(`MongoDB unavailable, using sample data: ${error.message}`);
    return false;
  }
}
