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

interface ColumnDefinition {
  key: string;
  header: string;
}

@Injectable()
export class SociosSheetRepository {
  private readonly columns: ColumnDefinition[] = [
    { key: 'ci', header: 'Cedula' },
    { key: 'ci_normalizada', header: 'Cedula (normalizada)' },
    { key: 'nombre', header: 'Nombre completo' },
    { key: 'telefono', header: 'Telefono' },
    { key: 'email', header: 'Email' },
    { key: 'email_normalizado', header: 'Email (normalizado)' },
    { key: 'member_type', header: 'Tipo de socio' },
    { key: 'plan', header: 'Plan' },
    { key: 'payment_ref', header: 'Referencia de pago' },
    { key: 'wants_carnet', header: 'Quiere carnet' },
    { key: 'birth_date', header: 'Fecha de nacimiento' },
    { key: 'category', header: 'Categoria carnet' },
    { key: 'subscription_starts_at', header: 'Inicio suscripcion' },
    { key: 'subscription_ends_at', header: 'Fin suscripcion' },
    { key: 'status', header: 'Estado' },
    { key: 'last_operation', header: 'Ultima operacion' },
    { key: 'utm_source', header: 'UTM source' },
    { key: 'utm_medium', header: 'UTM medium' },
    { key: 'utm_campaign', header: 'UTM campaign' },
    { key: 'utm_content', header: 'UTM content' },
    { key: 'utm_term', header: 'UTM term' },
    { key: 'page_url', header: 'Pagina origen' },
    { key: 'created_at', header: 'Creado en' },
    { key: 'updated_at', header: 'Actualizado en' },
  ];

  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(SociosSheetRepository.name);
  }

  private normalizeHeaderName(header: string): string {
    return String(header || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private getExpectedHeaders(): string[] {
    return this.columns.map((column) => column.header);
  }

  private resolveHeaderToKey(header: string): string | null {
    const normalized = this.normalizeHeaderName(header);
    const aliasMap: Record<string, string> = {
      ci: 'ci',
      cedula: 'ci',
      'cedula (normalizada)': 'ci_normalizada',
      ci_normalizada: 'ci_normalizada',
      nombre: 'nombre',
      'nombre completo': 'nombre',
      telefono: 'telefono',
      email: 'email',
      'email (normalizado)': 'email_normalizado',
      email_normalizado: 'email_normalizado',
      member_type: 'member_type',
      'tipo de socio': 'member_type',
      plan: 'plan',
      payment_ref: 'payment_ref',
      'referencia de pago': 'payment_ref',
      wants_carnet: 'wants_carnet',
      'quiere carnet': 'wants_carnet',
      birth_date: 'birth_date',
      'fecha de nacimiento': 'birth_date',
      category: 'category',
      'categoria carnet': 'category',
      subscription_starts_at: 'subscription_starts_at',
      'inicio suscripcion': 'subscription_starts_at',
      subscription_ends_at: 'subscription_ends_at',
      'fin suscripcion': 'subscription_ends_at',
      status: 'status',
      estado: 'status',
      estado_renovacion: 'status',
      last_operation: 'last_operation',
      'ultima operacion': 'last_operation',
      utm_source: 'utm_source',
      utm_medium: 'utm_medium',
      utm_campaign: 'utm_campaign',
      utm_content: 'utm_content',
      utm_term: 'utm_term',
      page_url: 'page_url',
      'pagina origen': 'page_url',
      created_at: 'created_at',
      createdat: 'created_at',
      'creado en': 'created_at',
      updated_at: 'updated_at',
      updatedat: 'updated_at',
      'actualizado en': 'updated_at',
    };

    if (aliasMap[normalized]) {
      return aliasMap[normalized];
    }

    const byColumn = this.columns.find(
      (column) =>
        this.normalizeHeaderName(column.header) === normalized ||
        this.normalizeHeaderName(column.key) === normalized,
    );

    return byColumn?.key || null;
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
    const mapped: RowMap = this.columns.reduce<RowMap>((acc, column) => {
      acc[column.key] = '';
      return acc;
    }, {});

    headers.forEach((header, index) => {
      const key = this.resolveHeaderToKey(header);
      if (!key) return;
      mapped[key] = row[index] || '';
    });
    return mapped;
  }

  private toRowArray(data: RowMap): string[] {
    return this.columns.map((column) => data[column.key] || '');
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
    const expected = this.getExpectedHeaders();
    if (current.length === expected.length && current.every((val, i) => val === expected[i])) {
      return;
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [expected] },
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
      const ciRaw = (mapped.ci || '').replace(/\D/g, '');
      const ciNormalized = (mapped.ci_normalizada || '').replace(/\D/g, '');
      if (ciRaw === ci || ciNormalized === ci) {
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
