/** Public role identity only; never a verification mark or authorization check. */
export function AdminBadge({ admin }: { admin?: boolean }) {
  return admin ? <span className="admin-badge">অ্যাডমিন</span> : null;
}
