import { Module } from '@nestjs/common';
import { AdminCustomersController, CustomersController } from './customers.controller.js';
import { CustomersService } from './customers.service.js';
import { AdminServicesController, ServicesController } from './services.controller.js';
import { CompaniesController, ProviderCompaniesController, TeamsController } from './providers.controller.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { CatalogService } from './catalog.service.js';
import { AdminCatalogService } from './admin-catalog.service.js';
import { CompaniesService } from './companies.service.js';
import { TeamsService } from './teams.service.js';
import { LocationModule } from '../location/location.module.js';

@Module({ imports: [LocationModule], controllers: [AdminCustomersController, CustomersController, ServicesController, AdminServicesController, CompaniesController, ProviderCompaniesController, TeamsController, UsersController], providers: [CustomersService, UsersService, CatalogService, AdminCatalogService, CompaniesService, TeamsService], exports: [CustomersService] })
export class CoreModule {}
