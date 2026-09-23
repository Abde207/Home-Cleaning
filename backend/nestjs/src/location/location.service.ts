import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/database.module.js';
import type { Actor } from '../auth/authorization.js';
import type { AddressDto } from '../core/core.dto.js';
import { GEOCODING_PROVIDER, type GeocodingProvider } from './location.provider.js';

const addressSelect = { id: true, label: true, addressText: true, latitude: true, longitude: true, isDefault: true, validationStatus: true, geocodedAt: true, geocodingProvider: true } as const;

function coordinates(latitude: number | undefined, longitude: number | undefined) {
  if ((latitude === undefined) !== (longitude === undefined)) throw new BadRequestException({ code: 'ADDRESS_COORDINATES_INCOMPLETE' });
  if (latitude !== undefined && longitude !== undefined && (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180)) throw new BadRequestException({ code: 'ADDRESS_COORDINATES_INVALID' });
}

@Injectable()
export class LocationService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService,
    @Inject(GEOCODING_PROVIDER) readonly geocoder: GeocodingProvider) {}

  private async resolve(dto: AddressDto) {
    coordinates(dto.latitude, dto.longitude);
    if (dto.latitude !== undefined && dto.longitude !== undefined) return { latitude: dto.latitude, longitude: dto.longitude, geocodedAt: new Date(), geocodingProvider: 'client-validated' };
    const result = await this.geocoder.geocode(dto.addressText);
    return { latitude: result.latitude, longitude: result.longitude, geocodedAt: new Date(), geocodingProvider: this.geocoder.name };
  }

  async validateAddress(dto: AddressDto) {
    const point = await this.resolve(dto);
    return { label: dto.label, addressText: dto.addressText, ...point, validationStatus: 'VERIFIED' };
  }

  private async customerId(actor: Actor) {
    const customer = await this.db.customer.findUnique({ where: { userId: actor.userId }, select: { id: true } });
    if (!customer) throw new NotFoundException();
    return customer.id;
  }

  async createAddress(actor: Actor, dto: AddressDto) {
    const customerId = await this.customerId(actor), point = await this.resolve(dto);
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Customer" WHERE id = ${customerId}::uuid FOR UPDATE`;
      const count = await tx.address.count({ where: { customerId, archivedAt: null } });
      const isDefault = dto.isDefault === true || count === 0;
      if (isDefault) await tx.address.updateMany({ where: { customerId, archivedAt: null }, data: { isDefault: false } });
      return tx.address.create({ data: { label: dto.label, addressText: dto.addressText, ...point, isDefault, validationStatus: 'VERIFIED', customerId }, select: addressSelect });
    });
  }

  async updateAddress(actor: Actor, id: string, dto: AddressDto) {
    const customerId = await this.customerId(actor), point = await this.resolve(dto);
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Customer" WHERE id = ${customerId}::uuid FOR UPDATE`;
      const before = await tx.address.findFirst({ where: { id, customerId, archivedAt: null }, select: addressSelect });
      if (!before) throw new NotFoundException();
      const isDefault = dto.isDefault ?? before.isDefault;
      if (isDefault) await tx.address.updateMany({ where: { customerId, archivedAt: null, id: { not: id } }, data: { isDefault: false } });
      return tx.address.update({ where: { id }, data: { label: dto.label, addressText: dto.addressText, ...point, isDefault, validationStatus: 'VERIFIED' }, select: addressSelect });
    });
  }

  async archiveAddress(actor: Actor, id: string) {
    const customerId = await this.customerId(actor);
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Customer" WHERE id = ${customerId}::uuid FOR UPDATE`;
      const address = await tx.address.findFirst({ where: { id, customerId, archivedAt: null }, select: { id: true, isDefault: true } });
      if (!address) throw new NotFoundException();
      await tx.address.update({ where: { id }, data: { archivedAt: new Date(), isDefault: false } });
      if (address.isDefault) {
        const next = await tx.address.findFirst({ where: { customerId, archivedAt: null, id: { not: id } }, orderBy: { id: 'asc' }, select: { id: true } });
        if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
      }
      return { archived: true };
    });
  }

  async reverseGeocode(latitude: number, longitude: number) {
    coordinates(latitude, longitude);
    return this.geocoder.reverseGeocode(latitude, longitude);
  }
}
