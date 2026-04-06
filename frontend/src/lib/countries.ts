export interface Country {
  name: string;
  code: string; // ISO 3166-1 alpha-2
  dialCode: string;
  flag: string;
}

export const COUNTRIES: Country[] = [
  { name: "Afghanistan", code: "AF", dialCode: "+93", flag: "\u{1F1E6}\u{1F1EB}" },
  { name: "Albania", code: "AL", dialCode: "+355", flag: "\u{1F1E6}\u{1F1F1}" },
  { name: "Algeria", code: "DZ", dialCode: "+213", flag: "\u{1F1E9}\u{1F1FF}" },
  { name: "Argentina", code: "AR", dialCode: "+54", flag: "\u{1F1E6}\u{1F1F7}" },
  { name: "Australia", code: "AU", dialCode: "+61", flag: "\u{1F1E6}\u{1F1FA}" },
  { name: "Austria", code: "AT", dialCode: "+43", flag: "\u{1F1E6}\u{1F1F9}" },
  { name: "Bahrain", code: "BH", dialCode: "+973", flag: "\u{1F1E7}\u{1F1ED}" },
  { name: "Bangladesh", code: "BD", dialCode: "+880", flag: "\u{1F1E7}\u{1F1E9}" },
  { name: "Belgium", code: "BE", dialCode: "+32", flag: "\u{1F1E7}\u{1F1EA}" },
  { name: "Brazil", code: "BR", dialCode: "+55", flag: "\u{1F1E7}\u{1F1F7}" },
  { name: "Canada", code: "CA", dialCode: "+1", flag: "\u{1F1E8}\u{1F1E6}" },
  { name: "Chile", code: "CL", dialCode: "+56", flag: "\u{1F1E8}\u{1F1F1}" },
  { name: "China", code: "CN", dialCode: "+86", flag: "\u{1F1E8}\u{1F1F3}" },
  { name: "Colombia", code: "CO", dialCode: "+57", flag: "\u{1F1E8}\u{1F1F4}" },
  { name: "Czech Republic", code: "CZ", dialCode: "+420", flag: "\u{1F1E8}\u{1F1FF}" },
  { name: "Denmark", code: "DK", dialCode: "+45", flag: "\u{1F1E9}\u{1F1F0}" },
  { name: "Egypt", code: "EG", dialCode: "+20", flag: "\u{1F1EA}\u{1F1EC}" },
  { name: "Ethiopia", code: "ET", dialCode: "+251", flag: "\u{1F1EA}\u{1F1F9}" },
  { name: "Finland", code: "FI", dialCode: "+358", flag: "\u{1F1EB}\u{1F1EE}" },
  { name: "France", code: "FR", dialCode: "+33", flag: "\u{1F1EB}\u{1F1F7}" },
  { name: "Germany", code: "DE", dialCode: "+49", flag: "\u{1F1E9}\u{1F1EA}" },
  { name: "Greece", code: "GR", dialCode: "+30", flag: "\u{1F1EC}\u{1F1F7}" },
  { name: "Hong Kong", code: "HK", dialCode: "+852", flag: "\u{1F1ED}\u{1F1F0}" },
  { name: "Hungary", code: "HU", dialCode: "+36", flag: "\u{1F1ED}\u{1F1FA}" },
  { name: "India", code: "IN", dialCode: "+91", flag: "\u{1F1EE}\u{1F1F3}" },
  { name: "Indonesia", code: "ID", dialCode: "+62", flag: "\u{1F1EE}\u{1F1E9}" },
  { name: "Iran", code: "IR", dialCode: "+98", flag: "\u{1F1EE}\u{1F1F7}" },
  { name: "Iraq", code: "IQ", dialCode: "+964", flag: "\u{1F1EE}\u{1F1F6}" },
  { name: "Ireland", code: "IE", dialCode: "+353", flag: "\u{1F1EE}\u{1F1EA}" },
  { name: "Israel", code: "IL", dialCode: "+972", flag: "\u{1F1EE}\u{1F1F1}" },
  { name: "Italy", code: "IT", dialCode: "+39", flag: "\u{1F1EE}\u{1F1F9}" },
  { name: "Japan", code: "JP", dialCode: "+81", flag: "\u{1F1EF}\u{1F1F5}" },
  { name: "Jordan", code: "JO", dialCode: "+962", flag: "\u{1F1EF}\u{1F1F4}" },
  { name: "Kenya", code: "KE", dialCode: "+254", flag: "\u{1F1F0}\u{1F1EA}" },
  { name: "Kuwait", code: "KW", dialCode: "+965", flag: "\u{1F1F0}\u{1F1FC}" },
  { name: "Malaysia", code: "MY", dialCode: "+60", flag: "\u{1F1F2}\u{1F1FE}" },
  { name: "Mexico", code: "MX", dialCode: "+52", flag: "\u{1F1F2}\u{1F1FD}" },
  { name: "Morocco", code: "MA", dialCode: "+212", flag: "\u{1F1F2}\u{1F1E6}" },
  { name: "Nepal", code: "NP", dialCode: "+977", flag: "\u{1F1F3}\u{1F1F5}" },
  { name: "Netherlands", code: "NL", dialCode: "+31", flag: "\u{1F1F3}\u{1F1F1}" },
  { name: "New Zealand", code: "NZ", dialCode: "+64", flag: "\u{1F1F3}\u{1F1FF}" },
  { name: "Nigeria", code: "NG", dialCode: "+234", flag: "\u{1F1F3}\u{1F1EC}" },
  { name: "Norway", code: "NO", dialCode: "+47", flag: "\u{1F1F3}\u{1F1F4}" },
  { name: "Oman", code: "OM", dialCode: "+968", flag: "\u{1F1F4}\u{1F1F2}" },
  { name: "Pakistan", code: "PK", dialCode: "+92", flag: "\u{1F1F5}\u{1F1F0}" },
  { name: "Peru", code: "PE", dialCode: "+51", flag: "\u{1F1F5}\u{1F1EA}" },
  { name: "Philippines", code: "PH", dialCode: "+63", flag: "\u{1F1F5}\u{1F1ED}" },
  { name: "Poland", code: "PL", dialCode: "+48", flag: "\u{1F1F5}\u{1F1F1}" },
  { name: "Portugal", code: "PT", dialCode: "+351", flag: "\u{1F1F5}\u{1F1F9}" },
  { name: "Qatar", code: "QA", dialCode: "+974", flag: "\u{1F1F6}\u{1F1E6}" },
  { name: "Romania", code: "RO", dialCode: "+40", flag: "\u{1F1F7}\u{1F1F4}" },
  { name: "Russia", code: "RU", dialCode: "+7", flag: "\u{1F1F7}\u{1F1FA}" },
  { name: "Saudi Arabia", code: "SA", dialCode: "+966", flag: "\u{1F1F8}\u{1F1E6}" },
  { name: "Singapore", code: "SG", dialCode: "+65", flag: "\u{1F1F8}\u{1F1EC}" },
  { name: "South Africa", code: "ZA", dialCode: "+27", flag: "\u{1F1FF}\u{1F1E6}" },
  { name: "South Korea", code: "KR", dialCode: "+82", flag: "\u{1F1F0}\u{1F1F7}" },
  { name: "Spain", code: "ES", dialCode: "+34", flag: "\u{1F1EA}\u{1F1F8}" },
  { name: "Sri Lanka", code: "LK", dialCode: "+94", flag: "\u{1F1F1}\u{1F1F0}" },
  { name: "Sweden", code: "SE", dialCode: "+46", flag: "\u{1F1F8}\u{1F1EA}" },
  { name: "Switzerland", code: "CH", dialCode: "+41", flag: "\u{1F1E8}\u{1F1ED}" },
  { name: "Taiwan", code: "TW", dialCode: "+886", flag: "\u{1F1F9}\u{1F1FC}" },
  { name: "Thailand", code: "TH", dialCode: "+66", flag: "\u{1F1F9}\u{1F1ED}" },
  { name: "Turkey", code: "TR", dialCode: "+90", flag: "\u{1F1F9}\u{1F1F7}" },
  { name: "Ukraine", code: "UA", dialCode: "+380", flag: "\u{1F1FA}\u{1F1E6}" },
  { name: "United Arab Emirates", code: "AE", dialCode: "+971", flag: "\u{1F1E6}\u{1F1EA}" },
  { name: "United Kingdom", code: "GB", dialCode: "+44", flag: "\u{1F1EC}\u{1F1E7}" },
  { name: "United States", code: "US", dialCode: "+1", flag: "\u{1F1FA}\u{1F1F8}" },
  { name: "Vietnam", code: "VN", dialCode: "+84", flag: "\u{1F1FB}\u{1F1F3}" },
];

export function getCountryByCode(code: string): Country | undefined {
  return COUNTRIES.find(c => c.code === code);
}

export function getDialCode(countryCode: string): string {
  return getCountryByCode(countryCode)?.dialCode || "+1";
}
