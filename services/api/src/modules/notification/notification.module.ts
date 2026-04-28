import { Module } from '@nestjs/common';
import { PushModule } from './internal/push/push.module';
import { PreferencesModule } from './internal/preferences/preferences.module';
import { DeliveryModule } from './internal/delivery/delivery.module';

/**
 * NotificationModule wrapper.
 *
 * The legacy notification-service had three sub-modules: push (FCM
 * web-push), preferences (per-user channel prefs), delivery
 * (templated dispatch). All inner forFeature calls have been
 * patched to NOTIFICATION_DB.
 *
 * Minimal public-API for now — most cross-module signals will flow
 * via EventBus subscribers (this module is the natural consumer of
 * payroll/run/finalized, hr/employee/onboarded, etc.).
 */
@Module({
  imports: [PushModule, PreferencesModule, DeliveryModule],
})
export class NotificationModule {}
