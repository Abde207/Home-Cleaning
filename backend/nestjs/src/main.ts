import { ConfigService } from '@nestjs/config';
import { createApp } from './bootstrap.js';

const app = await createApp();
const config = app.get(ConfigService);
await app.listen(config.getOrThrow<number>('PORT'), config.getOrThrow<string>('HOST'));
