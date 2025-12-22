import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Home, HomeDocument } from './home.schema';
import { CreateHomeDto } from './dto/create-home.dto';
import { randomBytes } from 'crypto';
import { User, UserDocument } from '../users/user.schema';
import { Device, DeviceDocument } from '../devices/device.schema';
import { HomeDetailsDto, UserWithDevicesDto } from './dto/home-details.dto';
import { DeviceResponseDto } from '../devices/dto/device-response.dto';

@Injectable()
export class HomesService {
  constructor(
    @InjectModel(Home.name) private homeModel: Model<HomeDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Device.name) private deviceModel: Model<DeviceDocument>,
  ) {}

  async create(createHomeDto: CreateHomeDto): Promise<HomeDocument> {
    const joinCode = this.generateJoinCode();
    
    const createdHome = new this.homeModel({
      ...createHomeDto,
      joinCode,
    });
    
    return createdHome.save();
  }

  async findByJoinCode(joinCode: string): Promise<HomeDocument | null> {
    return this.homeModel.findOne({ joinCode }).exec();
  }

  async getHomeDetailsForUser(userId: string): Promise<HomeDetailsDto> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const home = await this.homeModel.findById(user.homeId).exec();
    if (!home) {
      throw new NotFoundException('Home not found');
    }

    const users = await this.userModel.find({ homeId: home._id }).exec();
    const devices = await this.deviceModel.find({ homeId: home._id }).exec();
    const devicesByUserId = new Map<string, DeviceDocument[]>();
    for (const device of devices) {
      const ownerIdStr = device.ownerUserId.toString();
      if (!devicesByUserId.has(ownerIdStr)) {
        devicesByUserId.set(ownerIdStr, []);
      }
      devicesByUserId.get(ownerIdStr)!.push(device);
    }

    const dto = new HomeDetailsDto();
    dto.id = home._id.toString();
    dto.name = home.name;
    dto.isPrivate = home.isPrivate;
    dto.joinCode = home.joinCode;
    dto.users = users.map(u => {
      const userDto = new UserWithDevicesDto();
      userDto.id = u._id.toString();
      userDto.name = u.name;
      userDto.isActive = u.isActive;
      userDto.homeId = u.homeId.toString();
      userDto.devices = (devicesByUserId.get(u._id.toString()) || []).map(d => 
        DeviceResponseDto.fromDocument(d)
      );
      return userDto;
    });

    return dto;
  }

  private generateJoinCode(): string {
    return randomBytes(3).toString('hex').toUpperCase();
  }
}
