import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApiKeyAuthGuard } from './auth/api-key-auth.guard';
import { ApiKey, ApiKeySchema } from './auth/api-key.schema';
import { ApiKeyService } from './auth/api-key.service';
import { HomesController } from './features/homes/homes.controller';
import { env } from './utils/env';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true}),
    MongooseModule.forRoot(env.MONGODB_URI),
    MongooseModule.forFeature([{ name: ApiKey.name, schema: ApiKeySchema }])
  ],
  controllers: [HomesController],
  providers: [ApiKeyService, ApiKeyAuthGuard],
})
export class AppModule { }
