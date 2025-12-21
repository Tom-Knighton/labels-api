import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type HomeDocument = HydratedDocument<Home>;

@Schema({ collection: 'homes', timestamps: true })
export class Home {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, unique: true, index: true })
  joinCode!: string;

  @Prop({ required: true, default: false })
  isPrivate!: boolean;
}

export const HomeSchema = SchemaFactory.createForClass(Home);