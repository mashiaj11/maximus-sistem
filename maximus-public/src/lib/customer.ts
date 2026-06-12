import type { CustomerAddress, CustomerProfile } from "./types";
import {
  deleteAddressFromSupabase,
  clearLocalCustomerProfile,
  getCurrentCustomerFromSupabase,
  getCustomerByPhone,
  getLocalCustomerProfile,
  saveAddressToSupabase,
  saveCustomerToSupabase,
  saveLocalCustomerProfile,
  setDefaultAddressOnSupabase,
} from "./supabase-data";

export function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

export async function getCurrentCustomer() {
  return getCurrentCustomerFromSupabase();
}

export function getSavedCustomerProfile() {
  return getLocalCustomerProfile();
}

export function saveSavedCustomerProfile(data: {
  name: string;
  phone: string;
  customer_id?: string;
  last_address_id?: string;
}) {
  saveLocalCustomerProfile(data);
}

export function clearSavedCustomerProfile() {
  clearLocalCustomerProfile();
}

export async function findCustomerByPhone(phone: string) {
  return getCustomerByPhone(phone);
}

export async function saveCustomer(data: { name: string; phone: string }) {
  return saveCustomerToSupabase(data);
}

export async function saveAddress(
  customerId: string,
  address: Omit<CustomerAddress, "id" | "createdAt" | "updatedAt"> & { id?: string },
) {
  return saveAddressToSupabase(customerId, address);
}

export async function deleteAddress(customerId: string, addressId: string) {
  return deleteAddressFromSupabase(customerId, addressId);
}

export async function setDefaultAddress(customerId: string, addressId: string) {
  return setDefaultAddressOnSupabase(customerId, addressId);
}
