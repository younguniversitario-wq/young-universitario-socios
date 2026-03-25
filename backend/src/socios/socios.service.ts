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

  private normalizeWhitespace(value: string | undefined): string {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeEmail(value: string | undefined): string {
    return this.normalizeWhitespace(value).toLowerCase();
  }

  private normalizePhone(value: string | undefined): string {
    const normalized = this.normalizeWhitespace(value).replace(/[^\d+]/g, '');
    if (!normalized) return '';
    if (normalized.startsWith('+')) return normalized;
    return normalized.replace(/[^\d]/g, '');
  }

  private normalizeMemberInput(input: RegisterOrRenewSocioInputDto): RegisterOrRenewSocioInputDto {
    return {
      ...input,
      ci: String(input.ci || '').replace(/\D/g, ''),
      nombre: this.normalizeWhitespace(input.nombre),
      telefono: this.normalizePhone(input.telefono),
      email: this.normalizeEmail(input.email),
      payment_ref: this.normalizeWhitespace(input.payment_ref),
      birth_date: this.normalizeWhitespace(input.birth_date),
      category: this.normalizeWhitespace(input.category),
      pageUrl: this.normalizeWhitespace(input.pageUrl),
      utm_source: this.normalizeWhitespace(input.utm_source),
      utm_medium: this.normalizeWhitespace(input.utm_medium),
      utm_campaign: this.normalizeWhitespace(input.utm_campaign),
      utm_content: this.normalizeWhitespace(input.utm_content),
      utm_term: this.normalizeWhitespace(input.utm_term),
    };
  }

  private async dispatchNotifications(payload: {
    operation: 'created' | 'renewed';
    ci: string;
    nombre?: string;
    plan: 'semestral' | 'anual';
    email?: string;
    telefono?: string;
    paymentRef?: string;
    subscriptionEndsAt: string;
  }): Promise<void> {
    try {
      await this.adminEmailService.notifyAdmin(payload);
    } catch (error) {
      this.logger.warn({
        message: 'Admin email notification failed',
        data: { ci: payload.ci, operation: payload.operation, error: (error as Error).message },
      });
    }

    try {
      await this.adminEmailService.notifyMember(payload);
    } catch (error) {
      this.logger.warn({
        message: 'Member email notification failed',
        data: { ci: payload.ci, operation: payload.operation, error: (error as Error).message },
      });
    }
  }

  async registerOrRenew(
    input: RegisterOrRenewSocioInputDto,
    formKey: string | undefined,
  ): Promise<RegisterOrRenewSocioOutputDto> {
    this.assertFormKey(formKey);
    await this.sociosSheetRepository.ensureHeaderRow();

    const normalizedInput = this.normalizeMemberInput(input);
    const ci = normalizedInput.ci;
    const nowIso = new Date().toISOString();

    if (!ci) {
      throw new ApiException(
        ERROR_CODES.INVALID_PAYLOAD,
        'CI is required.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const existing = await this.sociosSheetRepository.findByCi(ci);

    if (normalizedInput.member_type === 'renovacion' && !existing) {
      throw new ApiException(
        ERROR_CODES.MEMBER_NOT_FOUND_FOR_RENEWAL,
        'No existe un socio con esa cedula para renovar.',
        HttpStatus.NOT_FOUND,
        { ci },
      );
    }

    const window = this.computeSubscriptionWindow(
      normalizedInput.plan,
      existing?.values.subscription_ends_at,
    );

    if (existing) {
      const normalizedExistingPhone = this.normalizePhone(existing.values.telefono);
      const normalizedExistingEmail = this.normalizeEmail(existing.values.email);
      const updated: Record<string, string> = {
        ...existing.values,
        ci: ci,
        ci_normalizada: ci,
        member_type: normalizedInput.member_type,
        plan: normalizedInput.plan,
        payment_ref: normalizedInput.payment_ref || existing.values.payment_ref || '',
        telefono: normalizedInput.telefono || normalizedExistingPhone,
        email: normalizedInput.email || normalizedExistingEmail,
        email_normalizado: normalizedInput.email || normalizedExistingEmail,
        subscription_starts_at: window.startsAt,
        subscription_ends_at: window.endsAt,
        status: 'activo',
        last_operation: 'renewed',
        page_url: normalizedInput.pageUrl,
        utm_source: normalizedInput.utm_source || existing.values.utm_source || '',
        utm_medium: normalizedInput.utm_medium || existing.values.utm_medium || '',
        utm_campaign: normalizedInput.utm_campaign || existing.values.utm_campaign || '',
        utm_content: normalizedInput.utm_content || existing.values.utm_content || '',
        utm_term: normalizedInput.utm_term || existing.values.utm_term || '',
        updated_at: nowIso,
      };

      await this.sociosSheetRepository.update(existing.rowNumber, updated);
      await this.dispatchNotifications({
        operation: 'renewed',
        ci,
        nombre: updated.nombre || existing.values.nombre,
        plan: normalizedInput.plan,
        email: updated.email || existing.values.email,
        telefono: updated.telefono || existing.values.telefono,
        paymentRef: normalizedInput.payment_ref,
        subscriptionEndsAt: window.endsAt,
      });

      this.logger.info({ message: 'Socio renewed', data: { ci, plan: normalizedInput.plan } });

      return new RegisterOrRenewSocioOutputDto({
        operation: 'renewed',
        message: 'Renovacion registrada correctamente.',
        ci,
        subscription_ends_at: window.endsAt,
      });
    }

    if (!normalizedInput.nombre || !normalizedInput.telefono || !normalizedInput.email) {
      throw new ApiException(
        ERROR_CODES.INVALID_PAYLOAD,
        'nombre, telefono y email son obligatorios para socio nuevo.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const created = {
      ci,
      ci_normalizada: ci,
      nombre: normalizedInput.nombre,
      telefono: normalizedInput.telefono,
      email: normalizedInput.email,
      email_normalizado: normalizedInput.email,
      member_type: normalizedInput.member_type,
      plan: normalizedInput.plan,
      payment_ref: normalizedInput.payment_ref || '',
      wants_carnet: normalizedInput.wants_carnet || 'no',
      birth_date: normalizedInput.birth_date || '',
      category: normalizedInput.category || '',
      subscription_starts_at: window.startsAt,
      subscription_ends_at: window.endsAt,
      status: 'activo',
      last_operation: 'created',
      utm_source: normalizedInput.utm_source || '',
      utm_medium: normalizedInput.utm_medium || '',
      utm_campaign: normalizedInput.utm_campaign || '',
      utm_content: normalizedInput.utm_content || '',
      utm_term: normalizedInput.utm_term || '',
      page_url: normalizedInput.pageUrl,
      created_at: nowIso,
      updated_at: nowIso,
    };

      await this.sociosSheetRepository.create(created);
      await this.dispatchNotifications({
        operation: 'created',
        ci,
        nombre: created.nombre,
        plan: normalizedInput.plan,
        email: created.email,
        telefono: created.telefono,
        paymentRef: normalizedInput.payment_ref,
        subscriptionEndsAt: window.endsAt,
      });

    this.logger.info({ message: 'Socio created', data: { ci, plan: normalizedInput.plan } });

    return new RegisterOrRenewSocioOutputDto({
      operation: 'created',
      message: 'Socio registrado correctamente.',
      ci,
      subscription_ends_at: window.endsAt,
    });
  }
}
