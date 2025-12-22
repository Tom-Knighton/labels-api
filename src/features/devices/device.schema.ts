import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DeviceDocument = HydratedDocument<Device>;

@Schema({ _id: false })
export class BleInfo {
  @Prop({ type: String, required: true, unique: true })
  address!: string;

  @Prop({ type: Number, required: true, default: 400 })
  width!: number;

  @Prop({ type: Number, required: true, default: 300 })
  height!: number;
}

export const BleInfoSchema = SchemaFactory.createForClass(BleInfo);

@Schema({ _id: false })
export class ShadowInfo {
  @Prop({ type: String, required: false, default: null })
  currentImageAssetId?: string | null;

  @Prop({ type: Boolean, required: true, default: false })
  isFlashing!: boolean;

  @Prop({ type: Date, required: false, default: null })
  lastSuccessfulActionAt?: Date | null;

  @Prop({ type: Date, required: false, default: null })
  lastSeenAt?: Date | null;

  @Prop({ type: String, required: false, default: null })
  lastError?: string | null;
}

export const ShadowInfoSchema = SchemaFactory.createForClass(ShadowInfo);

@Schema({ collection: 'devices', timestamps: true })
export class Device {
  @Prop({ type: Types.ObjectId, ref: 'Home', required: true })
  homeId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  ownerUserId!: Types.ObjectId;

  @Prop({ required: true })
  name!: string;

  @Prop({ type: BleInfoSchema, required: true })
  ble!: BleInfo;

  @Prop({ type: ShadowInfoSchema, required: true, default: {} })
  shadow!: ShadowInfo;
}

export const DeviceSchema = SchemaFactory.createForClass(Device);
