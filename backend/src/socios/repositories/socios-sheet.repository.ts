import { Injectable, HttpStatus } from '@nestjs/common';
import { google, sheets_v4 } from 'googleapis';
import { PinoLogger } from 'nestjs-pino';
import { ApiException } from '../../common/errors/api.exception';
import { ERROR_CODES } from '../../common/errors/error-codes';

type RowMap = Record<string, string>;

export interface SocioRow {
  rowNumber: number;
  values: RowMap;
}

@Injectable()
export class SociosSheetRepository {
  private readonly headers = [
    'ci',
    'nombre',
    'telefono',
    'email',
    'member_type',
    'plan',
    'payment_ref',
    'wants_carnet',
    'birth_date',
    'category',
    'subscription_starts_at',
    'subscription_ends_at',
    'status',
    'last_operation',
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
    'page_url',
    'created_at',
    'updated_at',
  ] as const;

  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(SociosSheetRepository.name);
  }

  private getSheetId(): string {
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    if (!spreadsheetId) {
      throw new ApiException(
        ERROR_CODES.GOOGLE_SHEETS_ERROR,
        'Missing GOOGLE_SHEETS_SPREADSHEET_ID configuration.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return spreadsheetId;
  }

  private getSheetName(): string {
    return process.env.GOOGLE_SHEETS_SHEET_NAME || 'socios';
  }

  private getGoogleClient(): sheets_v4.Sheets {
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKeyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

    let email = serviceAccountEmail || '';
    let privateKey = privateKeyRaw || '';

    if (serviceAccountJson) {
      const parsed = JSON.parse(serviceAccountJson);
      email = parsed.client_email;
      privateKey = parsed.private_key;
    }

    if (!email || !privateKey) {
      throw new ApiException(
        ERROR_CODES.GOOGLE_SHEETS_ERROR,
        'Missing Google Service Account credentials.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const auth = new google.auth.JWT({
      email,
      key: privateKey.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    return google.sheets({ version: 'v4', auth });
  }

  private mapRow(headers: string[], row: string[]): RowMap {
    const mapped: RowMap = {};
    headers.forEach((header, index) => {
      mapped[header] = row[index] || '';
    });
    return mapped;
  }

  private toRowArray(data: RowMap): string[] {
    return this.headers.map((header) => data[header] || '');
  }

  async ensureHeaderRow(): Promise<void> {
    const sheets = this.getGoogleClient();
    const spreadsheetId = this.getSheetId();
    const sheetName = this.getSheetName();

    const read = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:Z1`,
    });

    const current = read.data.values?.[0] || [];
    if (current.length === this.headers.length && current.every((val, i) => val === this.headers[i])) {
      return;
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [Array.from(this.headers)] },
    });

    this.logger.info({ message: 'Sheet headers initialized', data: { sheetName } });
  }

  async findByCi(ci: string): Promise<SocioRow | null> {
    const sheets = this.getGoogleClient();
    const spreadsheetId = this.getSheetId();
    const sheetName = this.getSheetName();

    const result = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:Z`,
    });

    const rows = result.data.values || [];
    if (rows.length < 2) return null;

    const headers = rows[0];
    for (let i = 1; i < rows.length; i += 1) {
      const mapped = this.mapRow(headers, rows[i]);
      if ((mapped.ci || '').replace(/\D/g, '') === ci) {
        return { rowNumber: i + 1, values: mapped };
      }
    }

    return null;
  }

  async create(data: RowMap): Promise<void> {
    const sheets = this.getGoogleClient();
    const spreadsheetId = this.getSheetId();
    const sheetName = this.getSheetName();

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [this.toRowArray(data)],
      },
    });
  }

  async update(rowNumber: number, data: RowMap): Promise<void> {
    const sheets = this.getGoogleClient();
    const spreadsheetId = this.getSheetId();
    const sheetName = this.getSheetName();

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A${rowNumber}:Z${rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [this.toRowArray(data)],
      },
    });
  }
}
