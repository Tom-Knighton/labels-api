import { Injectable, UnauthorizedException, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Device, DeviceDocument } from './device.schema';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { ApiKeyService } from 'src/auth/api-key.service';
import { User, UserDocument } from '../users/user.schema';

@Injectable()
export class DevicesService {
  constructor(
    @InjectModel(Device.name) private deviceModel: Model<DeviceDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  async registerForUser(apiKey: string, dto: RegisterDeviceDto): Promise<DeviceDocument> {
    const apiKeyDoc = await this.apiKeyService.getActiveApiKey(apiKey);
    if (!apiKeyDoc) {
      throw new UnauthorizedException('Invalid API key');
    }

    const user = await this.userModel.findById(apiKeyDoc.userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user already has a device with the same name
    const existingByName = await this.deviceModel.findOne({
      ownerUserId: user._id,
      name: dto.name,
    }).exec();

    if (existingByName) {
      throw new ConflictException('You already have a device with this name');
    }

    // Check if user already has a device with the same address
    const existingByAddress = await this.deviceModel.findOne({
      ownerUserId: user._id,
      'ble.address': dto.address,
    }).exec();

    if (existingByAddress) {
      throw new ConflictException('You already have a device with this address');
    }

    const device = new this.deviceModel({
      homeId: user.homeId,
      ownerUserId: user._id,
      name: dto.name,
      ble: { 
        address: dto.address,
        width: dto.width,
        height: dto.height,
      },
      shadow: {
        isFlashing: false,
      },
    });

    return device.save();
  }

  async removeForUser(apiKey: string, deviceId: string): Promise<void> {
    const apiKeyDoc = await this.apiKeyService.getActiveApiKey(apiKey);
    if (!apiKeyDoc) {
      throw new UnauthorizedException('Invalid API key');
    }

    const device = await this.deviceModel.findById(deviceId).exec();
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    if (device.ownerUserId.toString() !== apiKeyDoc.userId) {
      throw new ForbiddenException('Not the device owner');
    }

    await this.deviceModel.deleteOne({ _id: device._id }).exec();
  }

  async getDevicesForUser(apiKey: string): Promise<DeviceDocument[]> {
    const apiKeyDoc = await this.apiKeyService.getActiveApiKey(apiKey);
    if (!apiKeyDoc) {
      throw new UnauthorizedException('Invalid API key');
    }

    const ownerId = new Types.ObjectId(apiKeyDoc.userId);
    return this.deviceModel.find({ ownerUserId: ownerId }).exec();
  }
}
