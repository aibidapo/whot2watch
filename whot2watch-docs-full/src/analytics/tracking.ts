// src/analytics/tracking.ts
export type Device = 'ios' | 'android' | 'web';

export interface EventEnvelope<TProps = Record<string, any>> {
  event_name: string;
  ts_iso: string;
  user_id?: string | null;
  profile_id?: string | null;
  anonymous_id: string;
  session_id?: string;
  region?: string;
  device: Device;
  app_version?: string;
  private_mode?: boolean;
  properties: TProps;
}

export interface AnalyticsSink {
  send: (event: EventEnvelope) => void;
}

export class Tracker {
  constructor(
    private sink: AnalyticsSink,
    private common: Partial<EventEnvelope> = {},
  ) {}

  setCommon(common: Partial<EventEnvelope>) {
    this.common = { ...this.common, ...common };
  }

  emit<TProps>(name: string, props: TProps) {
    const evt: EventEnvelope<TProps> = {
      event_name: name,
      ts_iso: new Date().toISOString(),
      anonymous_id: this.common.anonymous_id || 'anon-' + Math.random().toString(36).slice(2),
      device: (this.common.device as Device) || 'web',
      ...this.common,
      properties: props as any,
    };
    this.sink.send(evt as any);
  }
}
