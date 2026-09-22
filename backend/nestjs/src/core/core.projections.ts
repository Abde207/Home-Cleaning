export const serviceSelect = { id: true, code: true, name: true, nameAr: true, description: true, active: true, basePrice: true, durationMinutes: true } as const;
export const extraSelect = { id: true, code: true, name: true, nameAr: true, price: true, active: true } as const;
export const companySelect = { id: true, internalCode: true, name: true, status: true, commissionRate: true } as const;
export const providerCompanySelect = { id: true, name: true, status: true } as const;
export const areaSelect = { id: true, name: true, latitude: true, longitude: true, radiusKm: true, active: true } as const;
export const teamSelect = { id: true, companyId: true, internalCode: true, name: true, status: true, capacity: true, active: true } as const;
export const providerTeamDetailSelect = {
  ...teamSelect,
  latitude: true,
  longitude: true,
  locationAt: true,
  updatedAt: true,
  company: { select: providerCompanySelect },
} as const;
export const adminCompanyDetailSelect = {
  ...companySelect,
  createdAt: true,
  updatedAt: true,
  serviceAreas: { select: areaSelect, orderBy: { id: 'asc' as const } },
} as const;
export const availabilitySelect = { id: true, startsAt: true, endsAt: true, available: true } as const;
export const memberSelect = { id: true, name: true, role: true } as const;
