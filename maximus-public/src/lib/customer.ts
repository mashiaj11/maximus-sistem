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

const CUSTOMER_SESSION_KEY = "maximus:customer-confirmed-session";

export function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

export function isCustomerConfirmedThisSession() {
  return (
    typeof window !== "undefined" && window.sessionStorage.getItem(CUSTOMER_SESSION_KEY) === "true"
  );
}

export function confirmCustomerForSession() {
  if (typeof window !== "undefined") window.sessionStorage.setItem(CUSTOMER_SESSION_KEY, "true");
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

export async function findCustomerByPhone(phone: string, name?: string) {
  return getCustomerByPhone(phone, name);
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
