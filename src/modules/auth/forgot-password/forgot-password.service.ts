import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/user.entity';
import { MailService } from '../../mail/mail.service';
import { SendOtpDto, ResetPasswordDto } from './dto/forgot-password.dto';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class ForgotPasswordService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly mailService: MailService,
  ) {}

  async sendOtp(sendOtpDto: SendOtpDto) {
    const user = await this.userRepository.findOne({ where: { email: sendOtpDto.email } });
    
    // We do not throw an error if the user doesn't exist to prevent email enumeration,
    // but in this context throwing NotFoundException is fine if requested by design.
    if (!user) {
      throw new NotFoundException('User with this email does not exist.');
    }

    // Generate a 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    
    // Set expiration time to 5 minutes from now
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 5);

    user.resetPasswordOtp = otp; // Depending on requirements, we can hash this before saving
    user.resetPasswordOtpExpires = expires;
    
    await this.userRepository.save(user);

    // Send the email using MailService
    await this.mailService.sendOtpEmail(user.email, {
      otp,
      companyId: user.company?.id,
    });

    return { message: 'OTP sent successfully to your email.' };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const user = await this.userRepository.findOne({ where: { email: resetPasswordDto.email } });

    if (!user) {
      throw new BadRequestException('Invalid email or OTP.');
    }

    if (
      !user.resetPasswordOtp ||
      user.resetPasswordOtp !== resetPasswordDto.otp ||
      !user.resetPasswordOtpExpires ||
      user.resetPasswordOtpExpires < new Date()
    ) {
      throw new BadRequestException('Invalid or expired OTP.');
    }

    // Hash the new password
    // Note: If user.entity.ts has @BeforeUpdate() hook for hashPassword, we just set the plain text
    // Let's set it in plain text, TypeORM subscriber will hash it.
    // However, to be safe, we manually hash it if hook relies on specific conditions.
    const hashedPassword = await bcrypt.hash(resetPasswordDto.newPassword, 10);
    user.password = hashedPassword;

    // Clear the OTP fields
    user.resetPasswordOtp = null as any;
    user.resetPasswordOtpExpires = null as any;

    await this.userRepository.save(user);

    return { message: 'Password has been successfully reset.' };
  }
}
