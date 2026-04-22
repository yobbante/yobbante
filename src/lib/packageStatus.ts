import { PACKAGE_STATUS_ORDER, type PackageStatus } from './types';

/**
 * Single source of truth for forward-only package state machine.
 * CREATED → RECEIVED → IN_STORAGE → READY_TO_SHIP → SHIPPED → DELIVERED.
 */
export function statusRank(s: PackageStatus): number {
  return PACKAGE_STATUS_ORDER.indexOf(s);
}

export function canTransitionPackage(from: PackageStatus, to: PackageStatus): boolean {
  return statusRank(to) > statusRank(from);
}

export class InvalidPackageTransitionError extends Error {
  constructor(public from: PackageStatus, public to: PackageStatus) {
    super(`Transition invalide : un colis « ${from} » ne peut pas revenir à « ${to} ».`);
    this.name = 'InvalidPackageTransitionError';
  }
}
