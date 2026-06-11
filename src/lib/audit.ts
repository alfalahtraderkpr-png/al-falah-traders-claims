export async function logAction({
  userId,
  userName,
  action,
  entity,
  entityId,
  details,
}: {
  userId?: string;
  userName?: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: string;
}) {
  try {
    const res = await fetch('/api/audit-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, userName, action, entity, entityId, details }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
