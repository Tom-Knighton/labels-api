import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomBytes } from 'crypto';
import { Model, Types } from 'mongoose';
import { ApiKey, ApiKeyDocument } from 'src/auth/api-key.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { User, UserDocument } from './user.schema';
import { Home } from '../homes/home.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(ApiKey.name) private apiKeyModel: Model<ApiKeyDocument>,
    @InjectModel(Home.name) private homeModel: Model<Home>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<{ user: UserDocument; apiKey: string }> {

    const existingUserWithname = await this.userModel.findOne({ name: createUserDto.name, homeId: new Types.ObjectId(createUserDto.homeId) }).exec();
    if (existingUserWithname) {
      throw new Error('User with this name already exists in the specified home');
    }
    
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

  async findById(userId: string): Promise<UserDocument | null> {
    return this.userModel.findById(userId).exec();
  }

  async usersInHome(homeId: string, joinCode: string): Promise<UserDocument[]> {
    const home = await this.homeModel.findOne({ _id: new Types.ObjectId(homeId), joinCode }).exec();
    if (!home) {
      return [];
    }
    return this.userModel.find({ homeId: new Types.ObjectId(homeId) }).exec();
  }

  async authById(userId: string, homeCode: string): Promise<{ user: UserDocument; apiKey: string } | null> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      return null;
    }

    const home = await this.homeModel.findOne({ _id: user.homeId, joinCode: homeCode }).exec();
    if (!home) {
      return null;
    }
    
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
