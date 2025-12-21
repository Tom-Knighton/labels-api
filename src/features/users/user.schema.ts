import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ collection: 'users', timestamps: true })
export class User {
  @Prop({ required: true })
  name!: string;

  @Prop({ type: Types.ObjectId, ref: 'Home', required: true })
  homeId!: Types.ObjectId;

  @Prop({ required: true, default: true })
  isActive!: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
