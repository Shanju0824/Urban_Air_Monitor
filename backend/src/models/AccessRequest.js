import mongoose from "mongoose";

const accessRequestSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
  organization: { type: String, required: true, trim: true, maxlength: 120 },
  reason: { type: String, required: true, trim: true, maxlength: 500 },
  trackingTokenHash: { type: String, select: false },
  status: { type: String, enum: ["pending", "approved"], default: "pending", index: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Authority" },
  authorityId: { type: mongoose.Schema.Types.ObjectId, ref: "Authority" }
}, { timestamps: true });

accessRequestSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { status: "pending" } });

export const AccessRequest = mongoose.model("AccessRequest", accessRequestSchema);
