import { BRAND } from "@/lib/config";
export function Support() {
  return BRAND.supportEmail ? (
    <p className="muted small">
      সহায়তা বা সিদ্ধান্তের আপিল:{" "}
      <a href={`mailto:${encodeURIComponent(BRAND.supportEmail)}`}>
        {BRAND.supportEmail}
      </a>
      । ব্যক্তিগত নম্বর, password বা গোপন তথ্য পাঠিও না।
    </p>
  ) : null;
}
