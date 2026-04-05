import mongoose from "mongoose";
import { httpError } from "../middleware/errorHandler";

export function requireObjectId(id: string, label = "id"): mongoose.Types.ObjectId {
  if (!mongoose.isValidObjectId(id)) {
    throw httpError(400, `Invalid ${label}`, "INVALID_ID");
  }
  return new mongoose.Types.ObjectId(id);
}
