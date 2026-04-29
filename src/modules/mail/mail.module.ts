import { Module, Global } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { MailService } from './mail.service';

@Global()
@Module({
  imports: [
    MailerModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        transport: {
          host: config.get('MAIL_HOST') || 'smtp.gmail.com',
          port: config.get('MAIL_PORT') || 465,
          secure: true, // Switched to 465 SSL connection
          tls: {
            rejectUnauthorized: false,
          },
          auth: {
            user: config.get('MAIL_USER'),
            pass: config.get('MAIL_PASS'),
          },
        },
        defaults: {
          from: '"Difmo Pvt Ltd" <info@difmo.com>',
        },
        template: {
          dir: join(process.cwd(), 'src', 'modules', 'mail', 'templates'),
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true,
          },
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [MailService],
  exports: [MailerModule, MailService],
})
export class MailModule { }

// NOTE: If emails are not being delivered, ensure the following env vars are set for the backend:
// MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS
// Example (.env):
// MAIL_HOST=smtp.gmail.com
// MAIL_PORT=465
// MAIL_USER=your-email@gmail.com
// MAIL_PASS=your-app-password-or-smtp-password
