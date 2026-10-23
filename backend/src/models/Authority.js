import mongoose from "mongoose";

const authoritySchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true, minlength: 3, maxlength: 40 },
  email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  governmentStaffId: { type: String, unique: true, sparse: true, trim: true, maxlength: 60 },
  passwordHash: { type: String, required: false, select: false },
  role: { type: String, enum: ["admin", "authority"], default: "authority" },
  active: { type: Boolean, default: false }
}, { timestamps: true });

export const Authority = mongoose.model("Authority", authoritySchema);
