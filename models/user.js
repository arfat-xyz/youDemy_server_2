import mongoose from "mongoose";
const { Schema } = mongoose;
const userSchema = new Schema(
  {
    password: { type: String, require: true, min: 6, max: 64 },
    picture: { type: String, default: "avatar.png" },
    role: {
      type: [String],
      default: ["Subscriber"],
      enum: ["Subscriber", "Instructor", "Admin"],
    },
    stripe_account_id: "",
    stripe_seller: {},
    stripeSession: {},
    name: { type: String, trim: true, require: true },
    email: { unique: true, type: String, trim: true, require: true },
    passwordResetCode: {
      data: String,
      default: "",
    },
  },

  { timestamps: true }
);
export default mongoose.model("User", userSchema);
