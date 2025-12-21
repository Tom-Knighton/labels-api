import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Home, HomeDocument } from './home.schema';
import { CreateHomeDto } from './dto/create-home.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class HomesService {
  constructor(
    @InjectModel(Home.name) private homeModel: Model<HomeDocument>,
  ) {}

  async create(createHomeDto: CreateHomeDto): Promise<HomeDocument> {
    const joinCode = this.generateJoinCode();
    
    const createdHome = new this.homeModel({
      ...createHomeDto,
      joinCode,
    });
    
    return createdHome.save();
  }

  private generateJoinCode(): string {
    return randomBytes(3).toString('hex').toUpperCase();
  }
}
