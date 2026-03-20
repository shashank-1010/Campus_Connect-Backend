import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IItem extends Document {
  userId: Types.ObjectId;
  title: string;
  description: string;
  price: number;
  imageUrl?: string;
  whatsapp?: string;
  status: 'available' | 'reserved' | 'sold' | 'removed';
  createdAt: Date;
}

const ItemSchema = new Schema<IItem>(
  {
    userId: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true,
      index: true  // ✅ ADD THIS FOR SPEED
    },
    title: { 
      type: String, 
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    description: { 
      type: String, 
      required: [true, 'Description is required'],
      maxlength: [2000, 'Description cannot exceed 2000 characters']
    },
    price: { 
      type: Number, 
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative']
    },
    imageUrl: { 
      type: String,
      match: [/^https?:\/\/.+/, 'Invalid image URL']
    },
    whatsapp: { 
      type: String,
      match: [/^[0-9]{10}$/, 'WhatsApp number must be 10 digits']
    },
    status: { 
      type: String, 
      enum: ['available', 'reserved', 'sold', 'removed'], 
      default: 'available',
      index: true  // ✅ ADD THIS FOR SPEED
    },
  },
  { timestamps: true }
);

// ✅ ADD THESE INDEXES FOR PERFORMANCE
ItemSchema.index({ userId: 1, createdAt: -1 });
ItemSchema.index({ status: 1, createdAt: -1 });

// Remove __v when sending response
ItemSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

export default mongoose.model<IItem>('Item', ItemSchema);
