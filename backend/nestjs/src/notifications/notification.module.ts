import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationController, DeviceTokenController } from './notification.controller.js';
import { NotificationService, PUSH_NOTIFICATION_PROVIDER } from './notification.service.js';
import { FcmPushNotificationProvider, MockPushNotificationProvider } from './notification.provider.js';
import { NotificationWorker } from './notification.worker.js';

@Module({ controllers: [NotificationController, DeviceTokenController], providers: [NotificationService, NotificationWorker, { provide: PUSH_NOTIFICATION_PROVIDER,
  inject: [ConfigService], useFactory: (config: ConfigService) => config.get('PUSH_PROVIDER') === 'fcm_apns'
    ? new FcmPushNotificationProvider(config.getOrThrow('FCM_PROJECT_ID'), config.getOrThrow('FCM_CLIENT_EMAIL'),
      config.getOrThrow<string>('FCM_PRIVATE_KEY').replaceAll('\\n', '\n')) : new MockPushNotificationProvider() }] })
export class NotificationModule {}
