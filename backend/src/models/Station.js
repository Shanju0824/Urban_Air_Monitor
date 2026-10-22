import mongoose from "mongoose";

const readingSchema = new mongoose.Schema(
  {
    recordedAt: { type: Date, required: true },
    aqi: { type: Number, required: true, min: 0 },
    pm25: { type: Number, required: true, min: 0 },
    pm10: { type: Number, required: true, min: 0 },
    no2: { type: Number, required: true, min: 0 },
    so2: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const stationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    zone: { type: String, required: true, trim: true },
    coordinates: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true }
    },
    readings: { type: [readingSchema], default: [] }
  },
  { timestamps: true }
);

export const Station = mongoose.model("Station", stationSchema);
