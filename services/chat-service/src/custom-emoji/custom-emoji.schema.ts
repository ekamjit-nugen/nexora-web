import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export interface ICustomEmoji extends Document {
  name: string;
  url: string;
  uploadedBy: string;
  organizationId: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ timestamps: true })
export class CustomEmoji extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  uploadedBy: string;

  @Prop({ required: true })
  organizationId: string;

  @Prop({ default: false })
  isDeleted: boolean;
}

export const CustomEmojiSchema = SchemaFactory.createForClass(CustomEmoji);
CustomEmojiSchema.index({ organizationId: 1, name: 1 }, { unique: true });
CustomEmojiSchema.index({ organizationId: 1, isDeleted: 1 });
