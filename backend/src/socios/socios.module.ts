import { Module } from '@nestjs/common';
import { AdminEmailService } from '../notifications/admin-email.service';
import { SociosController } from './socios.controller';
import { SociosService } from './socios.service';
import { SociosSheetRepository } from './repositories/socios-sheet.repository';

@Module({
  controllers: [SociosController],
  providers: [SociosService, SociosSheetRepository, AdminEmailService],
})
export class SociosModule {}
