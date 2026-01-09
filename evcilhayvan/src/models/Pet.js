import mongoose from "mongoose";

const PetSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    species: { type: String, enum: ["dog", "cat", "bird", "fish", "rodent", "other"], required: true },
    breed: { type: String, trim: true },
    gender: { type: String, enum: ["male", "female", "unknown"], default: "unknown" },
    ageMonths: { type: Number, min: 0, default: 0 },
    bio: { type: String, trim: true, maxlength: 500 },
    advertType: { type: String, enum: ["adoption", "mating"], default: "adoption", index: true },
    photos: { type: [String], default: [] }, // legacy
    images: { type: [String], default: [] },
    videos: { type: [String], default: [] },
    vaccinated: { type: Boolean, default: false },
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: {
        type: [Number],
        default: [0, 0],
        validate: {
          validator: function (coords) {
            return Array.isArray(coords) && coords.length === 2 && coords.every((n) => typeof n === "number");
          },
          message: "location.coordinates must be an array of two numbers [lng, lat]",
        },
      },
    },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        if ((!ret.images || ret.images.length === 0) && Array.isArray(ret.photos)) {
          ret.images = ret.photos;
        }
        if ((!ret.photos || ret.photos.length === 0) && Array.isArray(ret.images)) {
          ret.photos = ret.images;
        }
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

PetSchema.index({ name: "text", bio: "text" }, { weights: { name: 5, bio: 1 } });
PetSchema.index({ location: "2dsphere" });
PetSchema.index({ ownerId: 1, isActive: 1 });
PetSchema.index({ species: 1, vaccinated: 1 });
PetSchema.index({ advertType: 1, isActive: 1 });

PetSchema.pre("save", function (next) {
  const loc = this.location && this.location.coordinates;
  if (loc && (!Array.isArray(loc) || loc.length !== 2)) {
    return next(new Error("location.coordinates must be an array of two numbers [lng, lat]"));
  }
  next();
});

export default mongoose.model("Pet", PetSchema);
