import { AdminCustomerQueryDto, ListQueryDto } from './core.dto.js';
import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/database.module.js';
import type { Actor } from '../auth/authorization.js';
import type { AddressDto, ProfileDto, PropertyDto } from './core.dto.js';
import { LocationService } from '../location/location.service.js';
import { bookingListSelect } from '../booking/booking.projections.js';

@Injectable()
export class CustomersService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService, @Optional() @Inject(LocationService) private readonly location?: LocationService) {}
  async list(page: AdminCustomerQueryDto = new AdminCustomerQueryDto()) {
    const user: Prisma.UserWhereInput = {
      ...(page.status ? { status: page.status } : {}),
      ...(page.locale ? { locale: page.locale } : {}),
      ...(page.query ? { OR: [{ phone: { startsWith: page.query } }, { name: { contains: page.query, mode: 'insensitive' } }] } : {}),
    };
    const customers = await this.db.customer.findMany({
      take: page.limit, skip: page.offset, orderBy: { id: 'asc' }, where: { user },
      select: {
        id: true, userId: true,
        user: { select: { name: true, phone: true, locale: true, status: true, createdAt: true } },
        _count: { select: { bookings: true } },
        bookings: { select: { createdAt: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1 },
      },
    });
    return customers.map(customer => {
      // Keep the service seam compatible with lightweight unit doubles; the real Prisma projection always includes these fields.
      if (!customer._count || !customer.bookings) return { id: customer.id, ...customer.user };
      return {
        id: customer.id, userId: customer.userId, ...customer.user,
        bookingCount: customer._count.bookings, lastBookingAt: customer.bookings[0]?.createdAt ?? null,
      };
    });
  }
  async detail(id: string) {
    const customer = await this.db.customer.findUniqueOrThrow({
      where: { id },
      select: {
        id: true, userId: true,
        user: { select: { name: true, phone: true, locale: true, status: true, createdAt: true } },
        _count: { select: { addresses: true, properties: true, bookings: true } },
        bookings: { select: bookingListSelect, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 10 },
      },
    });
    if (!customer._count || !customer.bookings) return { id: customer.id, ...customer.user };
    return {
      id: customer.id, userId: customer.userId, ...customer.user,
      counts: customer._count, recentBookings: customer.bookings,
    };
  }
  async customerId(actor: Actor) {
    const customer = await this.db.customer.findUnique({ where: { userId: actor.userId }, select: { id: true } });
    if (!customer) throw new NotFoundException();
    return customer.id;
  }
  profile(actor: Actor) { return this.db.user.findUniqueOrThrow({ where: { id: actor.userId }, select: { id: true, name: true, phone: true, locale: true } }); }
  updateProfile(actor: Actor, dto: ProfileDto) { return this.db.user.update({ where: { id: actor.userId }, data: dto, select: { id: true, name: true, phone: true, locale: true } }); }
  async addresses(actor: Actor, page: ListQueryDto = new ListQueryDto()) { return this.db.address.findMany({ where: { customerId: await this.customerId(actor), archivedAt: null }, select: { id: true, label: true, addressText: true, latitude: true, longitude: true, isDefault: true, validationStatus: true }, take: page.limit, skip: page.offset, orderBy: { id: 'asc' } }); }
  async createAddress(actor: Actor, dto: AddressDto) { if (this.location) return this.location.createAddress(actor, dto); return this.db.address.create({ data: { label: dto.label, addressText: dto.addressText, latitude: dto.latitude!, longitude: dto.longitude!, customerId: await this.customerId(actor) }, select: { id: true, label: true, addressText: true, latitude: true, longitude: true } }); }
  async updateAddress(actor: Actor, id: string, dto: AddressDto) { if (this.location) return this.location.updateAddress(actor, id, dto); return this.db.address.update({ where: { id, customerId: await this.customerId(actor), archivedAt: null }, data: dto, select: { id: true, label: true, addressText: true, latitude: true, longitude: true } }); }
  async archiveAddress(actor: Actor, id: string) { if (this.location) return this.location.archiveAddress(actor, id); await this.db.address.update({ where: { id, customerId: await this.customerId(actor) }, data: { archivedAt: new Date() } }); return { archived: true }; }
  validateAddress(dto: AddressDto) { if (!this.location) throw new NotFoundException(); return this.location.validateAddress(dto); }
  async properties(actor: Actor, page: ListQueryDto = new ListQueryDto()) { return this.db.property.findMany({ where: { customerId: await this.customerId(actor), archivedAt: null }, select: { id: true, type: true, size: true, rooms: true, bathrooms: true }, take: page.limit, skip: page.offset, orderBy: { id: 'asc' } }); }
  async saveProperty(actor: Actor, dto: PropertyDto, id?: string) {
    if (new Prisma.Decimal(dto.size).lte(0)) throw new BadRequestException();
    const customerId = await this.customerId(actor);
    const select = { id: true, type: true, size: true, rooms: true, bathrooms: true } as const;
    return id ? this.db.property.update({ where: { id, customerId, archivedAt: null }, data: dto, select }) : this.db.property.create({ data: { ...dto, customerId }, select });
  }
  async archiveProperty(actor: Actor, id: string) {
    await this.db.property.update({ where: { id, customerId: await this.customerId(actor) }, data: { archivedAt: new Date() } });
    return { archived: true };
  }
}
