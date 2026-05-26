import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ForgotPasswordService } from './forgot-password.service';
import { SendOtpDto, ResetPasswordDto } from './dto/forgot-password.dto';

@Controller('auth/forgot-password')
export class ForgotPasswordController {
  constructor(private readonly forgotPasswordService: ForgotPasswordService) {}

  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  async sendOtp(@Body() sendOtpDto: SendOtpDto) {
    return this.forgotPasswordService.sendOtp(sendOtpDto);
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.forgotPasswordService.resetPassword(resetPasswordDto);
  }
}
