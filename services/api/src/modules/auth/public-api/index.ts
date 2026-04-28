// Barrel — the ONLY thing other modules may import from auth.
//
// If you find yourself wanting to import from auth/internal/* or
// auth/schemas/* from another module, STOP. Add the method you need
// to AuthPublicApi (auth-public-api.ts) instead, and consume it via
// the AUTH_PUBLIC_API token. That's the rule that makes the auth
// module extractable to its own service in <1 day.
export {
  AUTH_PUBLIC_API,
  AuthPublicApi,
  OrganizationBusinessDetails,
  UserSummary,
  OrgSummary,
} from './auth-public-api';
