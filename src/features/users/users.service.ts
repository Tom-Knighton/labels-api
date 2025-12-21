import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomBytes } from 'crypto';
import { Model, Types } from 'mongoose';
import { ApiKey, ApiKeyDocument } from 'src/auth/api-key.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { User, UserDocument } from './user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(ApiKey.name) private apiKeyModel: Model<ApiKeyDocument>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<{ user: UserDocument; apiKey: string }> {
    const user = new this.userModel({
      name: createUserDto.name,
      homeId: new Types.ObjectId(createUserDto.homeId),
    });
    
    await user.save();

    const apiKeyValue = this.generateApiKey();
    const apiKey = new this.apiKeyModel({
      key: apiKeyValue,
      userId: user._id,
      active: true,
    });
    
    await apiKey.save();

    return { user, apiKey: apiKeyValue };
  }

  private generateApiKey(): string {
    return randomBytes(32).toString('hex');
  }
}
