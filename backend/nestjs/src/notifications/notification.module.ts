import { Module } from '@nestjs/common';
import { NotificationController, DeviceTokenController } from './notification.controller.js';
import { NotificationService, PUSH_NOTIFICATION_PROVIDER } from './notification.service.js';
import { MockPushNotificationProvider } from './notification.provider.js';
import { NotificationWorker } from './notification.worker.js';

@Module({ controllers: [NotificationController, DeviceTokenController], providers: [NotificationService, NotificationWorker, { provide: PUSH_NOTIFICATION_PROVIDER, useClass: MockPushNotificationProvider }] })
export class NotificationModule {}
