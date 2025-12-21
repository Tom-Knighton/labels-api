import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ApiKeyDocument = HydratedDocument<ApiKey>;

@Schema({ collection: 'api_keys', timestamps: true })
export class ApiKey {
  @Prop({ required: true, unique: true, index: true })
  key!: string;

  @Prop({ required: true, default: true })
  active!: boolean;

  @Prop({ required: true, default: ''})
  userId!: string;
}

export const ApiKeySchema = SchemaFactory.createForClass(ApiKey);