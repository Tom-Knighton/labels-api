import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ApnsTokenDocument = HydratedDocument<ApnsToken>;

@Schema({ collection: 'apns', timestamps: true })
export class ApnsToken {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, required: true, unique: true, index: true })
  token!: string;

  @Prop({ type: String, required: false, default: null })
  device?: string | null;

  @Prop({ type: Boolean, required: true, default: true })
  enabled!: boolean;
}

export const ApnsTokenSchema = SchemaFactory.createForClass(ApnsToken);
