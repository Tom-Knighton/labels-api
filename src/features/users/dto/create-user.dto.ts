import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsString } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ description: 'The name of the user' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'The ID of the home the user belongs to' })
  @IsMongoId()
  @IsNotEmpty()
  homeId!: string;
}
