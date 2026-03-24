import { HttpStatus, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { ApiException } from '../common/errors/api.exception';
import { ERROR_CODES } from '../common/errors/error-codes';
import { AdminEmailService } from '../notifications/admin-email.service';
import { RegisterOrRenewSocioInputDto } from './dtos/input/register-or-renew-socio.input.dto';
import { RegisterOrRenewSocioOutputDto } from './dtos/output/register-or-renew-socio.output.dto';
import { SociosSheetRepository } from './repositories/socios-sheet.repository';

@Injectable()
export class SociosService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly sociosSheetRepository: SociosSheetRepository,
    private readonly adminEmailService: AdminEmailService,
  ) {
    this.logger.setContext(SociosService.name);
  }

  private assertFormKey(formKey: string | undefined): void {
    const expectedFormKey = process.env.FORM_KEY;
    if (!expectedFormKey || !formKey || formKey !== expectedFormKey) {
      throw new ApiException(
        ERROR_CODES.INVALID_FORM_KEY,
        'Invalid form key.',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  private computeSubscriptionWindow(
    plan: 'semestral' | 'anual',
    previousEndDate: string | undefined,
  ): { startsAt: string; endsAt: string } {
    const now = new Date();
    const previousEnd = previousEndDate ? new Date(previousEndDate) : null;
    const baseDate = previousEnd && previousEnd > now ? previousEnd : now;

    const startsAt = new Date(baseDate);
    const endsAt = new Date(baseDate);

    if (plan === 'anual') {
      endsAt.setMonth(endsAt.getMonth() + 12);
    } else {
      endsAt.setMonth(endsAt.getMonth() + 6);
    }

    return {
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    };
  }

  async registerOrRenew(
    input: RegisterOrRenewSocioInputDto,
    formKey: string | undefined,
  ): Promise<RegisterOrRenewSocioOutputDto> {
    this.assertFormKey(formKey);
    await this.sociosSheetRepository.ensureHeaderRow();

    const ci = input.ci.replace(/\D/g, '');
    const nowIso = new Date().toISOString();

    if (!ci) {
      throw new ApiException(
        ERROR_CODES.INVALID_PAYLOAD,
        'CI is required.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const existing = await this.sociosSheetRepository.findByCi(ci);

    if (input.member_type === 'renovacion' && !existing) {
      throw new ApiException(
        ERROR_CODES.MEMBER_NOT_FOUND_FOR_RENEWAL,
        'No existe un socio con esa cedula para renovar.',
        HttpStatus.NOT_FOUND,
        { ci },
      );
    }

    const window = this.computeSubscriptionWindow(input.plan, existing?.values.subscription_ends_at);

    if (existing) {
      const updated: Record<string, string> = {
        ...existing.values,
        member_type: input.member_type,
        plan: input.plan,
        payment_ref: input.payment_ref || existing.values.payment_ref || '',
        subscription_starts_at: window.startsAt,
        subscription_ends_at: window.endsAt,
        status: 'activo',
        last_operation: 'renewed',
        page_url: input.pageUrl,
        utm_source: input.utm_source || existing.values.utm_source || '',
        utm_medium: input.utm_medium || existing.values.utm_medium || '',
        utm_campaign: input.utm_campaign || existing.values.utm_campaign || '',
        utm_content: input.utm_content || existing.values.utm_content || '',
        utm_term: input.utm_term || existing.values.utm_term || '',
        updated_at: nowIso,
      };

      await this.sociosSheetRepository.update(existing.rowNumber, updated);
      await this.adminEmailService.notifyAdmin({
        operation: 'renewed',
        ci,
        nombre: updated.nombre || existing.values.nombre,
        plan: input.plan,
        email: updated.email || existing.values.email,
        telefono: updated.telefono || existing.values.telefono,
        paymentRef: input.payment_ref,
        subscriptionEndsAt: window.endsAt,
      });

      this.logger.info({ message: 'Socio renewed', data: { ci, plan: input.plan } });

      return new RegisterOrRenewSocioOutputDto({
        operation: 'renewed',
        message: 'Renovacion registrada correctamente.',
        ci,
        subscription_ends_at: window.endsAt,
      });
    }

    if (!input.nombre || !input.telefono || !input.email) {
      throw new ApiException(
        ERROR_CODES.INVALID_PAYLOAD,
        'nombre, telefono y email son obligatorios para socio nuevo.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const created = {
      ci,
      nombre: input.nombre,
      telefono: input.telefono,
      email: input.email,
      member_type: input.member_type,
      plan: input.plan,
      payment_ref: input.payment_ref || '',
      wants_carnet: input.wants_carnet || 'no',
      birth_date: input.birth_date || '',
      category: input.category || '',
      subscription_starts_at: window.startsAt,
      subscription_ends_at: window.endsAt,
      status: 'activo',
      last_operation: 'created',
      utm_source: input.utm_source || '',
      utm_medium: input.utm_medium || '',
      utm_campaign: input.utm_campaign || '',
      utm_content: input.utm_content || '',
      utm_term: input.utm_term || '',
      page_url: input.pageUrl,
      created_at: nowIso,
      updated_at: nowIso,
    };

    await this.sociosSheetRepository.create(created);
    await this.adminEmailService.notifyAdmin({
      operation: 'created',
      ci,
      nombre: created.nombre,
      plan: input.plan,
      email: created.email,
      telefono: created.telefono,
      paymentRef: input.payment_ref,
      subscriptionEndsAt: window.endsAt,
    });

    this.logger.info({ message: 'Socio created', data: { ci, plan: input.plan } });

    return new RegisterOrRenewSocioOutputDto({
      operation: 'created',
      message: 'Socio registrado correctamente.',
      ci,
      subscription_ends_at: window.endsAt,
    });
  }
}
