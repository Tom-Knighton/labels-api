import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApiKeyAuthGuard } from './auth/api-key-auth.guard';
import { ApiKey, ApiKeySchema } from './auth/api-key.schema';
import { ApiKeyService } from './auth/api-key.service';
import { HomesController } from './features/homes/homes.controller';
import { env } from './utils/env';
import { ConfigModule } from '@nestjs/config';
import { Home, HomeSchema } from './features/homes/home.schema';
import { HomesService } from './features/homes/homes.service';
import { User, UserSchema } from './features/users/user.schema';
import { UsersController } from './features/users/users.controller';
import { UsersService } from './features/users/users.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true}),
    MongooseModule.forRoot(env.MONGODB_URI),
    MongooseModule.forFeature([
      { name: ApiKey.name, schema: ApiKeySchema },
      { name: Home.name, schema: HomeSchema },
      { name: User.name, schema: UserSchema }
    ])
  ],
  controllers: [HomesController, UsersController],
  providers: [ApiKeyService, ApiKeyAuthGuard, HomesService, UsersService],
})
export class AppModule { }
