export interface NotificationPayload {
  title: string;
  body: string;
  titleId?: string;
  alertId: string;
  deepLink?: string;
}

export type NotificationChannel = 'PUSH' | 'EMAIL' | 'WEBHOOK';

export type NotificationStatus = 'SENT' | 'FAILED' | 'SUPPRESSED';

export interface PushProvider {
  send(token: string, payload: NotificationPayload): Promise<boolean>;
}
