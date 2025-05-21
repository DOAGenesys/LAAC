/**
 * Type definitions for Genesys Cloud API responses
 */

export interface GenesysUserGeolocation {
  country: string;
  countryName: string;
  city: string;
  region: string;
  latitude: number;
  longitude: number;
}

export interface GenesysDivision {
  id: string;
  name: string;
  selfUri: string;
}

export interface GenesysUser {
  id: string;
  name: string;
  division: GenesysDivision;
  geolocation?: GenesysUserGeolocation;
  selfUri: string;
}

export interface DivisionSwitchRequest {
  userId: string;
  targetDivisionId: string;
}

export interface DivisionSwitchResponse {
  updated: boolean;
} 